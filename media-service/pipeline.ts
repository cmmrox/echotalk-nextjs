import { packageFramesForStt } from "@/media-service/audioPackaging";
import { markTurnMetric } from "@/media-service/metrics";
import { clearOutboundDelivery, prepareOutboundDelivery } from "@/media-service/outboundDelivery";
import { audioBufferToOpusFrames } from "@/media-service/opusFromMp3";
import { getOutboundSender, scheduleOutboundAudio } from "@/media-service/outboundAudioTrack";
import { appendMediaResult } from "@/media-service/resultStore";
import {
  appendMediaTurn,
  getMediaSession,
  pushMediaSessionEvent,
  updateMediaSession,
} from "@/media-service/sessionManager";
import { appendStoredTtsAudio } from "@/media-service/ttsStore";
import {
  getTurnAudio,
  removeTurnAudio,
} from "@/media-service/turnAudioStore";
import {
  createTurnRecord,
  updateTurnRecord,
} from "@/media-service/turnRecords";
import { setSessionListening } from "@/media-service/listeningState";
import { generateAgentReply } from "@/lib/services/agent";
import { transcribeAudioBuffer } from "@/lib/services/stt";
import { synthesizeSpeechBuffer } from "@/lib/services/tts";
import { consumeProviderOperation } from "@/lib/security/providerBudget";

export type PipelineOutcome = {
  turnNumber: number;
  transcript: string;
  detectedLanguage: string;
  replyText: string;
  replyLanguage: string;
  latestTts?: {
    turnNumber: number;
    contentType: string;
    createdAt: string;
  };
  outboundAudio?: {
    ready: boolean;
    turnNumber: number;
    contentType: string;
    createdAt: string;
    rtcMode?: boolean;
  };
  hasUsableSpeech: boolean;
  failureStage?: "stt" | "agent" | "tts" | "pipeline";
};

export function buildPipelineLatestResult(outcome: PipelineOutcome) {
  return {
    turnNumber: outcome.turnNumber,
    transcript: outcome.transcript,
    detectedLanguage: outcome.detectedLanguage,
    replyText: outcome.replyText,
    replyLanguage: outcome.replyLanguage,
    createdAt: new Date().toISOString(),
  };
}

export function buildPipelineSessionPatch(outcome: PipelineOutcome) {
  return {
    latestResult: buildPipelineLatestResult(outcome),
    latestTts: outcome.latestTts,
    outboundAudio: outcome.outboundAudio,
  };
}

export async function runProcessingPipeline(params: {
  sessionId: string;
  turnNumber: number;
}): Promise<PipelineOutcome> {
  const { sessionId, turnNumber } = params;
  const turnRecord = createTurnRecord(sessionId, turnNumber);
  updateTurnRecord(sessionId, turnNumber, (record) => {
    record.state = "recognizing";
  });

  const storedAudio = getTurnAudio(sessionId, turnNumber);
  const frames = storedAudio?.frames ?? [];
  const packaged = packageFramesForStt(frames);
  const buffer = packaged.buffer;
  const mimeType = packaged.mimeType;

  const frameSizes = frames.map((f) => f.length);
  const avgFrameSize = frameSizes.length
    ? frameSizes.reduce((a, b) => a + b, 0) / frameSizes.length
    : 0;
  const silenceFrames = frameSizes.filter((s) => s <= 5).length;
  const voiceFrames = frameSizes.filter((s) => s > 5).length;
  const firstVoiceFrame = frames.find((f) => f.length > 5);
  const tocConfig = firstVoiceFrame ? (firstVoiceFrame[0] >> 3) : -1;
  const isCeltOnly = tocConfig >= 16;

  if (isCeltOnly) {
    pushMediaSessionEvent(sessionId, "processing_stt_skipped_celt_only", {
      turnNumber,
      tocConfig,
      voiceFrames,
    });
    updateTurnRecord(sessionId, turnNumber, (record) => {
      record.state = "no_speech";
      record.failureCode = "unsupported_opus_mode";
    });
    removeTurnAudio(sessionId, turnNumber);
    return {
      turnNumber,
      transcript: "",
      detectedLanguage: "en-US",
      replyText: "",
      replyLanguage: "en-US",
      hasUsableSpeech: false,
      failureStage: "stt",
    };
  }

  const isLikelySpeech = voiceFrames >= 20 && avgFrameSize >= 20;
  if (!isLikelySpeech) {
    pushMediaSessionEvent(sessionId, "processing_stt_skipped_silence", {
      turnNumber,
      voiceFrames,
      silenceFrames,
      avgFrameSize,
    });
    updateTurnRecord(sessionId, turnNumber, (record) => {
      record.state = "no_speech";
      record.failureCode = "no_usable_speech";
    });
    removeTurnAudio(sessionId, turnNumber);
    return {
      turnNumber,
      transcript: "",
      detectedLanguage: "en-US",
      replyText: "",
      replyLanguage: "en-US",
      hasUsableSpeech: false,
      failureStage: "stt",
    };
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
  markTurnMetric(sessionId, turnNumber, { sttStartedAt: new Date().toISOString() });

  consumeProviderOperation(sessionId, "recognize");
  const stt = await transcribeAudioBuffer({
    buffer,
    inputMimeType: mimeType,
  });

  pushMediaSessionEvent(sessionId, "processing_stt_completed", {
    turnNumber,
    transcriptLength: stt.transcript.length,
    detectedLanguage: stt.detectedLanguage,
  });
  markTurnMetric(sessionId, turnNumber, { sttCompletedAt: new Date().toISOString() });
  updateTurnRecord(sessionId, turnNumber, (record) => {
    record.state = stt.transcript.trim() ? "recognized" : "no_speech";
    record.transcript.raw = stt.transcript;
    record.transcript.verbatim = stt.transcript;
    record.transcript.detectedLanguage = stt.detectedLanguage;
    record.transcript.segments = stt.segments;
    record.providers.push(stt.identity);
  });

  let agentReplyText = "";
  let agentReplyLanguage = stt.detectedLanguage || "en-US";

  if (stt.transcript.trim()) {
    // Capture permitted history before recording the current turn. The model
    // service adds currentTurn exactly once after this chronological history.
    const recentTurns = (getMediaSession(sessionId)?.turns ?? []).map((turn) => ({
      role: turn.role,
      text: turn.text,
      language: turn.language,
    }));
    appendMediaTurn(sessionId, {
      role: "user",
      text: stt.transcript,
      language: stt.detectedLanguage,
      turnNumber,
      turnId: turnRecord.turnId,
    });

    pushMediaSessionEvent(sessionId, "processing_agent_started", {
      turnNumber,
      transcriptLength: stt.transcript.length,
      recentTurnCount: recentTurns.length,
    });
    markTurnMetric(sessionId, turnNumber, { agentStartedAt: new Date().toISOString() });
    updateTurnRecord(sessionId, turnNumber, (record) => {
      record.state = "responding";
    });

    consumeProviderOperation(sessionId, "respond");
    const agent = await generateAgentReply({
      transcript: stt.transcript,
      detectedLanguage: stt.detectedLanguage,
      recentTurns,
      idempotencyKey: turnRecord.idempotencyKey,
    });
    agentReplyText = agent.replyText;
    agentReplyLanguage = agent.replyLanguage;

    pushMediaSessionEvent(sessionId, "processing_agent_completed", {
      turnNumber,
      replyLength: agent.replyText.length,
      replyLanguage: agent.replyLanguage,
    });
    markTurnMetric(sessionId, turnNumber, { agentCompletedAt: new Date().toISOString() });
    updateTurnRecord(sessionId, turnNumber, (record) => {
      record.state = "responded";
      record.response.displayText = agent.replyText;
      record.response.ttsText = agent.replyText;
      record.response.replyLanguage = agent.replyLanguage;
      record.providers.push(agent.identity);
      if (agent.usage) record.usage.push(agent.usage);
    });
  }

  const result = appendMediaResult(sessionId, {
    turnNumber,
    transcript: stt.transcript,
    detectedLanguage: stt.detectedLanguage,
    replyText: agentReplyText,
    replyLanguage: agentReplyLanguage,
  });

  if (result.replyText.trim()) {
    appendMediaTurn(sessionId, {
      role: "assistant",
      text: result.replyText,
      language: result.replyLanguage,
      turnNumber,
      turnId: turnRecord.turnId,
    });
  }

  let latestTts:
    | {
        turnNumber: number;
        contentType: string;
        createdAt: string;
      }
    | undefined;
  let outboundAudio:
    | {
        ready: boolean;
        turnNumber: number;
        contentType: string;
        createdAt: string;
        rtcMode?: boolean;
      }
    | undefined;

  if (result.replyText.trim() && stt.transcript.trim()) {
    pushMediaSessionEvent(sessionId, "processing_tts_started", {
      turnNumber,
      replyLength: result.replyText.length,
      languageCode: result.replyLanguage,
    });
    markTurnMetric(sessionId, turnNumber, { ttsStartedAt: new Date().toISOString() });
    updateTurnRecord(sessionId, turnNumber, (record) => {
      record.state = "synthesizing";
    });

    consumeProviderOperation(sessionId, "synthesize");
    const tts = await synthesizeSpeechBuffer({
      text: result.replyText,
      languageCode: result.replyLanguage,
    });

    clearOutboundDelivery(sessionId);

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

    const rtcSender = getOutboundSender(sessionId);
    let rtcDelivered = false;

    if (rtcSender) {
      try {
        const opusFrames = await audioBufferToOpusFrames(tts.buffer);
        scheduleOutboundAudio(sessionId, opusFrames).catch((err) => {
          console.warn("[media-service/pipeline] WebRTC audio error", {
            sessionId,
            err: String(err),
          });
        });
        rtcDelivered = true;
        pushMediaSessionEvent(sessionId, "processing_tts_rtc_scheduled", {
          turnNumber,
          frameCount: opusFrames.length,
        });
      } catch (rtcErr) {
        console.warn("[media-service/pipeline] WebRTC audio conversion failed, using HTTP", {
          sessionId,
          err: String(rtcErr),
        });
      }
    }

    prepareOutboundDelivery(sessionId, rtcDelivered ? "rtc" : "http");
    setSessionListening(sessionId, false);
    pushMediaSessionEvent(sessionId, "listening_gate_closed", {
      turnNumber,
      playbackMode: rtcDelivered ? "rtc" : "http",
    });

    setTimeout(() => {
      setSessionListening(sessionId, true);
      pushMediaSessionEvent(sessionId, "listening_gate_reopened_timeout", {
        turnNumber,
        playbackMode: rtcDelivered ? "rtc" : "http",
      });
    }, 8000);

    outboundAudio = {
      ready: true,
      turnNumber,
      contentType: storedTts.contentType,
      createdAt: storedTts.createdAt,
      rtcMode: rtcDelivered,
    };

    updateMediaSession(sessionId, {
      outboundAudio,
    });

    pushMediaSessionEvent(sessionId, "processing_tts_completed", {
      turnNumber,
      contentType: tts.contentType,
      bytes: tts.buffer.length,
      rtcDelivered,
      playbackMode: rtcDelivered ? "rtc" : "http",
    });
    markTurnMetric(sessionId, turnNumber, {
      ttsCompletedAt: new Date().toISOString(),
      playbackMode: rtcDelivered ? "rtc" : "http",
    });
    updateTurnRecord(sessionId, turnNumber, (record) => {
      record.state = "completed";
      record.providers.push(tts.identity);
      record.usage.push(tts.usage);
    });
  } else if (stt.transcript.trim()) {
    updateTurnRecord(sessionId, turnNumber, (record) => {
      record.state = "completed";
    });
  }

  removeTurnAudio(sessionId, turnNumber);
  return {
    turnNumber,
    transcript: result.transcript,
    detectedLanguage: result.detectedLanguage,
    replyText: result.replyText,
    replyLanguage: result.replyLanguage,
    latestTts,
    outboundAudio,
    hasUsableSpeech: Boolean(result.transcript.trim()),
  };
}
