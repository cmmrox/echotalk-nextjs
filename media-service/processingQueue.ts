import { packageFramesForStt } from "@/media-service/audioPackaging";
import { prepareOutboundDelivery } from "@/media-service/outboundDelivery";
import { appendMediaResult } from "@/media-service/resultStore";
import { appendStoredTtsAudio } from "@/media-service/ttsStore";
import {
  getLatestTurnAudio,
} from "@/media-service/turnAudioStore";
import { clearTurnReady, getTurnWindow, markTurnReady } from "@/media-service/turnState";
import {
  appendMediaTurn,
  getMediaSession,
  pushMediaSessionEvent,
  updateMediaSession,
} from "@/media-service/sessionManager";
import { generateAgentReply } from "@/lib/services/agent";
import { transcribeAudioBuffer } from "@/lib/services/stt";
import { synthesizeSpeechBuffer } from "@/lib/services/tts";
import { audioBufferToOpusFrames } from "@/media-service/opusFromMp3";
import {
  getOutboundSender,
  scheduleOutboundAudio,
} from "@/media-service/outboundAudioTrack";
import { setSessionListening } from "@/media-service/listeningState";

type ProcessingState = {
  queued: boolean;
  processing: boolean;
  processedTurns: number;
  lastQueuedAt?: string;
  lastProcessedAt?: string;
  /** A turn arrived while we were busy — process it immediately after current finishes. */
  pendingTurnStored: boolean;
};

declare global {
  var __echotalkProcessingQueue:
    | {
        bySession: Map<string, ProcessingState>;
      }
    | undefined;
}

function getProcessingStore() {
  if (!globalThis.__echotalkProcessingQueue) {
    globalThis.__echotalkProcessingQueue = {
      bySession: new Map(),
    };
  }

  return globalThis.__echotalkProcessingQueue;
}

function getProcessingState(sessionId: string): ProcessingState {
  const store = getProcessingStore();
  const existing = store.bySession.get(sessionId);
  if (existing) return existing;

  const created: ProcessingState = {
    queued: false,
    processing: false,
    processedTurns: 0,
    pendingTurnStored: false,
  };
  store.bySession.set(sessionId, created);
  return created;
}

async function runStubStt(sessionId: string, turnNumber: number) {
  const storedAudio = getLatestTurnAudio(sessionId);
  const frames = storedAudio?.frames ?? [];
  const packaged = packageFramesForStt(frames);
  const buffer = packaged.buffer;
  const mimeType = packaged.mimeType;

  // --- DEBUG: analyse raw frame sizes + first bytes to detect silence/format ---
  const frameSizes = frames.map((f) => f.length);
  const avgFrameSize = frameSizes.length
    ? frameSizes.reduce((a, b) => a + b, 0) / frameSizes.length
    : 0;
  const silenceFrames = frameSizes.filter((s) => s <= 5).length;
  const voiceFrames   = frameSizes.filter((s) => s > 5).length;
  // Show first byte (Opus TOC) of the first 5 frames as hex so we can identify format
  const firstFrameHex = frames.slice(0, 5).map((f) =>
    f.length > 0 ? Array.from(f.slice(0, 4)).map((b) => b.toString(16).padStart(2, "0")).join(" ") : "(empty)"
  );
  console.log("[media-service/processing] frame analysis", {
    sessionId,
    turnNumber,
    totalFrames: frames.length,
    avgFrameBytes: avgFrameSize.toFixed(1),
    silenceFrames,
    voiceFrames,
    firstFewSizes: frameSizes.slice(0, 10),
    firstFrameHex,
  });

  // Fix 2a: Check Opus TOC byte of the first real frame.
  // Chrome uses Hybrid mode (config 12–15) or SILK mode (config 0–11) for speech.
  // Chrome switches to CELT-only mode (config 16–31) for NON-speech audio
  // (background noise, music, fan hum, AEC echo residue).
  // Google STT reliably returns empty for CELT-only audio — skip it early.
  const firstVoiceFrame = frames.find(f => f.length > 5);
  const tocConfig = firstVoiceFrame ? (firstVoiceFrame[0] >> 3) : -1;
  const isCeltOnly = tocConfig >= 16;
  if (isCeltOnly) {
    console.log("[media-service/processing] skipping STT — CELT-only Opus (non-speech audio)", {
      sessionId,
      turnNumber,
      tocConfig,
      tocByte: firstVoiceFrame?.[0].toString(16),
      voiceFrames,
    });
    pushMediaSessionEvent(sessionId, "processing_stt_skipped_celt_only", {
      turnNumber,
      tocConfig,
      voiceFrames,
    });
    return {
      transcript: "",
      detectedLanguage: "en-US",
      confidence: null,
      notes: {
        sttApi: "v2" as const,
        model: "stub-skipped-celt",
        languageCodes: ["en-US"],
        inputMimeType: mimeType,
      },
    };
  }

  // Fix 2b: tighten the voice frame gate.
  //   - Require at least 60 voice frames (≥ 1.2s of real speech, up from 30)
  //   - Require average frame size ≥ 20 bytes
  const isLikelySpeech = voiceFrames >= 60 && avgFrameSize >= 20;
  if (!isLikelySpeech) {
    console.log("[media-service/processing] skipping STT — likely not speech", {
      sessionId,
      turnNumber,
      voiceFrames,
      silenceFrames,
      avgFrameSize: Number(avgFrameSize.toFixed(1)),
      reason: voiceFrames < 60 ? "too few voice frames (<60)" : "avg frame too small (<20 bytes)",
    });
    pushMediaSessionEvent(sessionId, "processing_stt_skipped_silence", {
      turnNumber,
      voiceFrames,
      silenceFrames,
      avgFrameSize,
    });
    return {
      transcript: "",
      detectedLanguage: "en-US",
      confidence: null,
      notes: {
        sttApi: "v2" as const,
        model: "stub-skipped-silence",
        languageCodes: ["en-US"],
        inputMimeType: mimeType,
      },
    };
  }

  // --- DEBUG: dump OGG to /tmp for offline inspection ---
  if (buffer.length > 0) {
    const fs = await import("fs/promises");
    const debugPath = `/tmp/echotalk-debug-turn-${turnNumber}-${sessionId.slice(0, 8)}.ogg`;
    await fs.writeFile(debugPath, buffer).catch(() => {});
    console.log("[media-service/processing] OGG dumped to", debugPath);
  }

  pushMediaSessionEvent(sessionId, "processing_stt_started", {
    turnNumber,
    bytes: buffer.length,
    mimeType,
    packagingMode: packaged.mode,
    frameCount: packaged.frameCount,
    hasStoredAudio: Boolean(storedAudio),
    avgFrameBytes: avgFrameSize.toFixed(1),
    silenceFrames,
    voiceFrames,
  });

  try {
    const stt = await transcribeAudioBuffer({
      buffer,
      inputMimeType: mimeType,
    });
    console.log("[media-service/processing] STT result", {
      sessionId,
      turnNumber,
      transcriptLength: stt.transcript.length,
      transcript: stt.transcript.slice(0, 120) || "(empty)",
      detectedLanguage: stt.detectedLanguage,
    });
    pushMediaSessionEvent(sessionId, "processing_stt_completed", {
      turnNumber,
      transcriptLength: stt.transcript.length,
      detectedLanguage: stt.detectedLanguage,
    });
    return stt;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[media-service/processing] STT error", {
      sessionId,
      turnNumber,
      message,
    });
    pushMediaSessionEvent(sessionId, "processing_stt_failed", {
      turnNumber,
      message,
    });
    return {
      transcript: `[stt-pending] media turn ${turnNumber}`,
      detectedLanguage: "en-US",
      confidence: null,
      notes: {
        sttApi: "v2" as const,
        model: "stub-fallback",
        languageCodes: ["en-US"],
        inputMimeType: "audio/webm",
      },
    };
  }
}

export function queueTurnIfReady(sessionId: string) {
  const turnWindow = getTurnWindow(sessionId);
  const processing = getProcessingState(sessionId);

  console.log("[media-service/processing] queueTurnIfReady", {
    sessionId,
    turnReady: turnWindow.ready,
    packetCount: turnWindow.packetCount,
    totalBytes: turnWindow.totalBytes,
    processing: processing.processing,
    queued: processing.queued,
  });

  if (!turnWindow.ready) {
    return processing;
  }

  // Fix 1: if already busy, remember that a new turn is waiting instead of dropping it.
  if (processing.processing || processing.queued) {
    if (!processing.pendingTurnStored) {
      processing.pendingTurnStored = true;
      console.log("[media-service/processing] turn queued as pending (busy)", { sessionId });
      pushMediaSessionEvent(sessionId, "processing_turn_pending_while_busy", {});
    }
    return processing;
  }

  processing.queued = true;
  processing.lastQueuedAt = new Date().toISOString();
  updateMediaSession(sessionId, { status: "processing" });
  pushMediaSessionEvent(sessionId, "processing_queued", {
    packetCount: turnWindow.packetCount,
    totalBytes: turnWindow.totalBytes,
    completedTurns: turnWindow.completedTurns,
  });

  queueMicrotask(async () => {
    console.log("[media-service/processing] microtask start", { sessionId });
    const current = getProcessingState(sessionId);
    current.queued = false;
    current.processing = true;
    pushMediaSessionEvent(sessionId, "processing_started", {
      packetCount: turnWindow.packetCount,
      totalBytes: turnWindow.totalBytes,
      completedTurns: turnWindow.completedTurns,
    });

    current.processedTurns += 1;
    const turnNumber = current.processedTurns;
    console.log("[media-service/processing] STT phase", {
      sessionId,
      turnNumber,
    });
    const stt = await runStubStt(sessionId, turnNumber);

    let agentReplyText = `[placeholder reply] media turn ${turnNumber} processed`;
    let agentReplyLanguage = stt.detectedLanguage || "en-US";

    if (stt.transcript.trim()) {
      const recentTurns = (getMediaSession(sessionId)?.turns ?? []).map((turn) => ({
        role: turn.role,
        text: turn.text,
        language: turn.language,
      }));

      pushMediaSessionEvent(sessionId, "processing_agent_started", {
        turnNumber,
        transcriptLength: stt.transcript.length,
        recentTurnCount: recentTurns.length,
      });

      try {
        console.log("[media-service/processing] agent phase", {
          sessionId,
          turnNumber,
          transcriptPreview: stt.transcript.slice(0, 80),
          recentTurnCount: recentTurns.length,
        });
        const agent = await generateAgentReply({
          transcript: stt.transcript,
          detectedLanguage: stt.detectedLanguage,
          recentTurns,
        });
        agentReplyText = agent.replyText;
        agentReplyLanguage = agent.replyLanguage;
        pushMediaSessionEvent(sessionId, "processing_agent_completed", {
          turnNumber,
          replyLength: agent.replyText.length,
          replyLanguage: agent.replyLanguage,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        pushMediaSessionEvent(sessionId, "processing_agent_failed", {
          turnNumber,
          message,
        });
      }
    }

    current.processing = false;
    current.lastProcessedAt = new Date().toISOString();

    const result = appendMediaResult(sessionId, {
      turnNumber,
      transcript: stt.transcript,
      detectedLanguage: stt.detectedLanguage,
      replyText: agentReplyText,
      replyLanguage: agentReplyLanguage,
    });

    appendMediaTurn(sessionId, {
      role: "assistant",
      text: result.replyText,
      language: result.replyLanguage,
    });

    let latestTts:
      | {
          turnNumber: number;
          contentType: string;
          createdAt: string;
        }
      | undefined;

    // Only TTS if STT actually got real speech — skip placeholder turns (silence/noise).
    if (result.replyText.trim() && stt.transcript.trim()) {
      pushMediaSessionEvent(sessionId, "processing_tts_started", {
        turnNumber,
        replyLength: result.replyText.length,
        languageCode: result.replyLanguage,
      });

      try {
        console.log("[media-service/processing] TTS phase", {
          sessionId,
          turnNumber,
          replyLength: result.replyText.length,
          replyLanguage: result.replyLanguage,
        });
        const tts = await synthesizeSpeechBuffer({
          text: result.replyText,
          languageCode: result.replyLanguage,
        });

        // Store TTS audio for HTTP fallback delivery (always keep this path).
        const storedTts = appendStoredTtsAudio(sessionId, {
          turnNumber,
          contentType: tts.contentType,
          audioBase64: tts.buffer.toString("base64"),
        });
        latestTts = {
          turnNumber: storedTts.turnNumber,
          contentType: storedTts.contentType,
          createdAt: storedTts.createdAt,
        };

        // Always prepare HTTP delivery as a safe fallback, even when WebRTC
        // delivery is attempted. This lets the client recover automatically if
        // the remote WebRTC track is negotiated but still produces no audible
        // sound in the browser.
        prepareOutboundDelivery(sessionId);

        // Bug 1 fix: immediately block the server-side listening gate so that
        // RTP packets captured while the AI speaks are not sent to STT.
        // Previously this relied on the CLIENT polling and sending a HTTP round-
        // trip (500 ms+ delay) — by which point the mic had already recorded the
        // AI speech.
        setSessionListening(sessionId, false);
        console.log("[media-service/processing] listening gate closed (AI speaking)", {
          sessionId,
          turnNumber,
        });
        pushMediaSessionEvent(sessionId, "listening_gate_closed", { turnNumber });

        // Safety-net for the HTTP-fallback path: re-enable listening after 8s
        // in case the client fails to send the listening=1 acknowledgment back.
        // For the WebRTC path, outboundAudioTrack.finish() re-enables it sooner.
        setTimeout(() => {
          setSessionListening(sessionId, true);
          console.log("[media-service/processing] listening gate reopened (safety timeout)", {
            sessionId,
            turnNumber,
          });
          pushMediaSessionEvent(sessionId, "listening_gate_reopened_timeout", { turnNumber });
        }, 8000);

        // Attempt WebRTC audio delivery first (real-time, no polling needed).
        const rtcSender = getOutboundSender(sessionId);
        let rtcDelivered = false;

        if (rtcSender) {
          try {
            console.log("[media-service/processing] converting TTS to Opus for WebRTC", {
              sessionId,
              turnNumber,
              bytes: tts.buffer.length,
            });
            const opusFrames = await audioBufferToOpusFrames(tts.buffer);
            // scheduleOutboundAudio runs asynchronously (paced at 20ms/frame).
            // We don't await it so processing completes and the client can
            // see the transcript immediately while audio plays in the background.
            scheduleOutboundAudio(sessionId, opusFrames).catch((err) => {
              console.warn("[media-service/processing] WebRTC audio error", {
                sessionId, err: String(err),
              });
            });
            rtcDelivered = true;
            pushMediaSessionEvent(sessionId, "processing_tts_rtc_scheduled", {
              turnNumber,
              frameCount: opusFrames.length,
            });
          } catch (rtcErr) {
            console.warn("[media-service/processing] WebRTC audio conversion failed, using HTTP", {
              sessionId,
              err: String(rtcErr),
            });
          }
        }

        // Mark outboundAudio so the client knows audio is ready (rtcMode flag
        // tells the panel not to fetch the HTTP audio since WebRTC delivers it).
        updateMediaSession(sessionId, {
          outboundAudio: {
            ready: true,
            turnNumber,
            contentType: storedTts.contentType,
            createdAt: storedTts.createdAt,
            rtcMode: rtcDelivered,
          },
        });

        pushMediaSessionEvent(sessionId, "processing_tts_completed", {
          turnNumber,
          contentType: tts.contentType,
          bytes: tts.buffer.length,
          rtcDelivered,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        pushMediaSessionEvent(sessionId, "processing_tts_failed", {
          turnNumber,
          message,
        });
      }
    }

    clearTurnReady(sessionId);
    updateMediaSession(sessionId, {
      status: "connected",
      processing: { ...current },
      latestResult: result,
      latestTts,
      outboundAudio: latestTts
        ? {
            ready: true,
            turnNumber: latestTts.turnNumber,
            contentType: latestTts.contentType,
            createdAt: latestTts.createdAt,
          }
        : undefined,
    });
    pushMediaSessionEvent(sessionId, "processing_completed_stub", {
      processedTurns: current.processedTurns,
      latestResult: result,
      latestTts,
    });

    // Fix 1: if a turn arrived while we were busy, process it now.
    if (current.pendingTurnStored) {
      current.pendingTurnStored = false;
      console.log("[media-service/processing] processing pending turn now", { sessionId });
      pushMediaSessionEvent(sessionId, "processing_deferred_turn_start", {});
      // Re-read the latest stored turn audio and kick off a fresh run.
      const pendingTurnWindow = getTurnWindow(sessionId);
      if (pendingTurnWindow.packetCount > 0) {
        markTurnReady(sessionId, {
          packetCount: pendingTurnWindow.packetCount,
          totalBytes: pendingTurnWindow.totalBytes,
          completedTurns: pendingTurnWindow.completedTurns,
        });
        queueTurnIfReady(sessionId);
      }
    }
  });

  return processing;
}

export function getProcessingSnapshot(sessionId: string) {
  return getProcessingState(sessionId);
}
