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
import { consumeProviderOperation } from "@/lib/security/providerBudget";
import { getProviderBundle } from "@/lib/services/providerBundle";
import { scheduleSessionTimer } from "@/media-service/sessionWork";

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
  signal?: AbortSignal;
}): Promise<PipelineOutcome> {
  const { sessionId, turnNumber, signal } = params;
  const providers = getProviderBundle();
  const turnRecord = createTurnRecord(sessionId, turnNumber);
  updateTurnRecord(sessionId, turnNumber, (record) => {
    record.state = "recognizing";
    record.timing.recognitionStartedAt = new Date().toISOString();
    record.route.transcriptPolicyVersion = providers.transcriptPolicy.version;
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
      record.timing.completedAt = new Date().toISOString();
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
      record.timing.completedAt = new Date().toISOString();
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

  const recognitionBudget = consumeProviderOperation(sessionId, "recognize");
  const stt = await providers.recognizer.recognize({
    audio: buffer,
    inputMimeType: mimeType,
    signal,
  });
  const transcriptForms = providers.transcriptPolicy.apply(stt);
  const acceptedTranscript =
    transcriptForms.corrected ??
    transcriptForms.normalized ??
    transcriptForms.verbatim;

  pushMediaSessionEvent(sessionId, "processing_stt_completed", {
    turnNumber,
    transcriptLength: acceptedTranscript.length,
    detectedLanguage: stt.detectedLanguage,
  });
  markTurnMetric(sessionId, turnNumber, { sttCompletedAt: new Date().toISOString() });
  updateTurnRecord(sessionId, turnNumber, (record) => {
    record.state = acceptedTranscript.trim() ? "recognized" : "no_speech";
    record.transcript = transcriptForms;
    record.providers.push(stt.identity);
    record.route.recognizer = stt.identity;
    record.quality.recognitionConfidence = stt.confidence;
    record.quality.segmentCount = stt.segments.length;
    record.quality.hasUsableSpeech = Boolean(acceptedTranscript.trim());
    record.timing.recognizedAt = new Date().toISOString();
    record.cost.reservedCostUsd = recognitionBudget.reservedCostUsd;
  });

  let agentReplyText = "";
  let agentReplyLanguage = stt.detectedLanguage || "en-US";

  if (acceptedTranscript.trim()) {
    // Capture permitted history before recording the current turn. The model
    // service adds currentTurn exactly once after this chronological history.
    const recentTurns = (getMediaSession(sessionId)?.turns ?? []).map((turn) => ({
      role: turn.role,
      text: turn.text,
      language: turn.language,
    }));
    appendMediaTurn(sessionId, {
      role: "user",
      text: acceptedTranscript,
      language: stt.detectedLanguage,
      turnNumber,
      turnId: turnRecord.turnId,
    });

    pushMediaSessionEvent(sessionId, "processing_agent_started", {
      turnNumber,
      transcriptLength: acceptedTranscript.length,
      recentTurnCount: recentTurns.length,
    });
    markTurnMetric(sessionId, turnNumber, { agentStartedAt: new Date().toISOString() });
    updateTurnRecord(sessionId, turnNumber, (record) => {
      record.state = "responding";
      record.timing.responseStartedAt = new Date().toISOString();
    });

    const agent = await providers.conversationModel.respond({
      currentTurn: acceptedTranscript,
      detectedLanguage: stt.detectedLanguage,
      permittedHistory: recentTurns,
      idempotencyKey: turnRecord.idempotencyKey,
      signal,
      onProviderAttempt: () => {
        const budget = consumeProviderOperation(sessionId, "respond");
        updateTurnRecord(sessionId, turnNumber, (record) => {
          record.cost.reservedCostUsd = budget.reservedCostUsd;
        });
      },
    });
    agentReplyText = agent.displayText;
    agentReplyLanguage = agent.replyLanguage;

    pushMediaSessionEvent(sessionId, "processing_agent_completed", {
      turnNumber,
      replyLength: agent.displayText.length,
      replyLanguage: agent.replyLanguage,
    });
    markTurnMetric(sessionId, turnNumber, { agentCompletedAt: new Date().toISOString() });
    updateTurnRecord(sessionId, turnNumber, (record) => {
      record.state = "responded";
      record.response.displayText = agent.displayText;
      record.response.ttsText = agent.ttsText;
      record.response.replyLanguage = agent.replyLanguage;
      record.providers.push(agent.identity);
      record.route.conversationModel = agent.identity;
      record.timing.respondedAt = new Date().toISOString();
      if (agent.usage) record.usage.push(agent.usage);
    });
  }

  const result = appendMediaResult(sessionId, {
    turnNumber,
    transcript: acceptedTranscript,
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

  if (result.replyText.trim() && acceptedTranscript.trim()) {
    pushMediaSessionEvent(sessionId, "processing_tts_started", {
      turnNumber,
      replyLength: result.replyText.length,
      languageCode: result.replyLanguage,
    });
    markTurnMetric(sessionId, turnNumber, { ttsStartedAt: new Date().toISOString() });
    updateTurnRecord(sessionId, turnNumber, (record) => {
      record.state = "synthesizing";
      record.timing.synthesisStartedAt = new Date().toISOString();
    });

    const synthesisBudget = consumeProviderOperation(sessionId, "synthesize");
    const tts = await providers.synthesizer.synthesize({
      text: result.replyText,
      languageCode: result.replyLanguage,
      signal,
    });

    clearOutboundDelivery(sessionId);

    const storedTts = appendStoredTtsAudio(sessionId, {
      turnNumber,
      contentType: tts.contentType,
      audioBase64: tts.audio.toString("base64"),
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
        const opusFrames = await audioBufferToOpusFrames(tts.audio);
        scheduleOutboundAudio(sessionId, opusFrames).catch((err) => {
          console.warn("[media-service/pipeline] WebRTC audio error", {
            sessionId,
            errorClass: err instanceof Error ? err.name : "unknown",
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
          errorClass: rtcErr instanceof Error ? rtcErr.name : "unknown",
        });
      }
    }

    prepareOutboundDelivery(sessionId, rtcDelivered ? "rtc" : "http");
    setSessionListening(sessionId, false);
    pushMediaSessionEvent(sessionId, "listening_gate_closed", {
      turnNumber,
      playbackMode: rtcDelivered ? "rtc" : "http",
    });

    scheduleSessionTimer(sessionId, () => {
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
      bytes: tts.audio.length,
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
      record.route.synthesizer = tts.identity;
      if (tts.usage) record.usage.push(tts.usage);
      record.cost.reservedCostUsd = synthesisBudget.reservedCostUsd;
      record.cost.reportedCostUsd = record.usage.some(
        (usage) => typeof usage.estimatedCostUsd === "number"
      )
        ? Number(record.usage.reduce(
            (sum, usage) => sum + (usage.estimatedCostUsd ?? 0),
            0
          ).toFixed(6))
        : null;
      record.timing.completedAt = new Date().toISOString();
    });
  } else if (acceptedTranscript.trim()) {
    updateTurnRecord(sessionId, turnNumber, (record) => {
      record.state = "completed";
      record.timing.completedAt = new Date().toISOString();
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
