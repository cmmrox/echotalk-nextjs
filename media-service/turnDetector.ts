import { queueTurnIfReady } from "@/media-service/processingQueue";
import type { SegmentationState } from "@/media-service/segmentationBuffer";
import {
  appendSegmentPacket,
  finalizeSegmentIfPending,
  getSegmentationState,
  markSegmentStart,
  resetSegment,
  snapshotSegment,
} from "@/media-service/segmentationBuffer";
import {
  decideEndpoint,
  type EndpointingDecision,
} from "@/media-service/endpointingHeuristics";
import {
  getInterruptionState,
  getInterruptionTelemetry,
  markInterruptionCandidate,
  markInterruptionCommitted,
  shouldCommitInterruption,
} from "@/media-service/interruptions";
import { isSessionListening } from "@/media-service/listeningState";
import {
  clearSpeechStart,
  getSpeechSignalState,
  hadSpeechStart,
  markSpeechStopped,
} from "@/media-service/speechStartTracker";
import { markTurnMetric } from "@/media-service/metrics";
import {
  pushMediaSessionEvent,
  setConversationState,
  updateMediaSession,
} from "@/media-service/sessionManager";
import { appendTurnAudio } from "@/media-service/turnAudioStore";
import type { TurnWindow } from "@/media-service/turnState";
import { markTurnPending, markTurnReady, updateTurnWindow } from "@/media-service/turnState";

type PacketInfo = {
  bytes: number;
  payload?: Buffer | Uint8Array;
};

const DEFAULT_THRESHOLDS: TurnDetectorThresholds = {
  minPacketsForTurn: 20,
  shortUtterancePacketThreshold: 12,
  minSilenceMs: 350,
  pauseExtensionMs: 650,
  naturalPausePacketThreshold: 24,
  minAverageBytesPerPacket: 18,
};

export type FinalizeReason = "vad_trigger" | "time_window";

export type TurnDetectorProgressSnapshot = {
  segment: ReturnType<typeof snapshotSegment>;
  turnWindow: TurnWindow;
  speechSignal: ReturnType<typeof getSpeechSignalState>;
};

export type TurnDetectorThresholds = {
  minPacketsForTurn: number;
  shortUtterancePacketThreshold: number;
  minSilenceMs: number;
  pauseExtensionMs: number;
  naturalPausePacketThreshold: number;
  minAverageBytesPerPacket: number;
};

export type FinalizeTurnResult =
  | {
      ok: false;
      reason: "ai_speaking" | "no_pending_audio" | "endpoint_wait";
      endpointDecision?: EndpointingDecision;
    }
  | {
      ok: true;
      finalized: ReturnType<typeof finalizeSegmentIfPending> extends infer T
        ? Exclude<T, null>
        : never;
      storedAudio: ReturnType<typeof appendTurnAudio>;
      turnWindow: TurnWindow;
      processing: ReturnType<typeof queueTurnIfReady>;
      endpointDecision: EndpointingDecision;
    };

export function handleInboundPacket(sessionId: string, packet: PacketInfo) {
  appendSegmentPacket(sessionId, packet.bytes, packet.payload);
  return snapshotSegment(sessionId);
}

export function handleSpeechStartHint(sessionId: string) {
  markSegmentStart(sessionId);

  if (!isSessionListening(sessionId)) {
    const interruption = markInterruptionCandidate(sessionId, "speech_start_during_ai");
    const telemetry = getInterruptionTelemetry(sessionId);
    setConversationState(sessionId, "interruption_candidate", {
      source: "speech_start_hint",
      interruption,
      telemetry,
    });
    pushMediaSessionEvent(sessionId, "interruption_candidate_started", {
      source: "speech_start_hint",
      interruption,
      telemetry,
    });
    return;
  }

  setConversationState(sessionId, "user_speaking", {
    source: "speech_start_hint",
  });
}

export function handleSpeechStopHint(sessionId: string) {
  markSpeechStopped(sessionId);
  const interruption = getInterruptionState(sessionId);

  if (interruption.active) {
    const committed = markInterruptionCommitted(sessionId, "speech_stop_after_candidate");
    const telemetry = getInterruptionTelemetry(sessionId);
    setConversationState(sessionId, "recovering", {
      source: "speech_stop_hint",
      interruption: committed,
      telemetry,
    });
    pushMediaSessionEvent(sessionId, "interruption_committed", {
      source: "speech_stop_hint",
      interruption: committed,
      telemetry,
    });
    return;
  }

  if (interruption.candidate) {
    if (!shouldCommitInterruption(sessionId)) {
      pushMediaSessionEvent(sessionId, "interruption_candidate_rejected", {
        source: "speech_stop_hint",
        interruption,
        telemetry: getInterruptionTelemetry(sessionId),
      });
      return;
    }

    const committed = markInterruptionCommitted(sessionId, "speech_stop_after_candidate");
    const telemetry = getInterruptionTelemetry(sessionId);
    setConversationState(sessionId, "recovering", {
      source: "speech_stop_hint",
      interruption: committed,
      telemetry,
    });
    pushMediaSessionEvent(sessionId, "interruption_committed", {
      source: "speech_stop_hint",
      interruption: committed,
      telemetry,
    });
    return;
  }

  setConversationState(sessionId, "user_pause_candidate", {
    source: "speech_stop_hint",
  });
}

export function handleProgressSnapshot(sessionId: string): TurnDetectorProgressSnapshot {
  const segment = snapshotSegment(sessionId);
  const turnWindow = updateTurnWindow(sessionId, {
    ready: false,
    packetCount: segment.packetCount,
    totalBytes: segment.totalBytes,
    completedTurns: segment.completedTurns,
  });
  const speechSignal = getSpeechSignalState(sessionId);
  const averageBytesPerPacket = segment.packetCount > 0
    ? segment.totalBytes / segment.packetCount
    : 0;

  updateMediaSession(sessionId, {
    segmentation: segment,
    turnWindow: { ...turnWindow },
  });

  pushMediaSessionEvent(sessionId, "turn_detector_progress", {
    packetCount: segment.packetCount,
    payloadCount: segment.payloadCount,
    totalBytes: segment.totalBytes,
    averageBytesPerPacket: Number(averageBytesPerPacket.toFixed(2)),
    speechSignal,
  });

  return { segment, turnWindow, speechSignal };
}

export function skipNoSpeechWindow(sessionId: string, packets: number) {
  resetSegment(sessionId);
  setConversationState(sessionId, "listening", {
    source: "time_window_skip_no_speech",
  });
  pushMediaSessionEvent(sessionId, "segment_window_skipped_no_speech", {
    packets,
  });
}

export function finalizeTurnIfReady(params: {
  sessionId: string;
  reason: FinalizeReason;
  thresholds?: Partial<TurnDetectorThresholds>;
}): FinalizeTurnResult {
  const { sessionId, reason } = params;
  const thresholds: TurnDetectorThresholds = {
    ...DEFAULT_THRESHOLDS,
    ...(params.thresholds ?? {}),
  };

  if (!isSessionListening(sessionId)) {
    pushMediaSessionEvent(sessionId, "turn_finalize_blocked_ai_speaking", {
      reason,
    });
    return { ok: false as const, reason: "ai_speaking" as const };
  }

  const segment = snapshotSegment(sessionId);
  const speechSignal = getSpeechSignalState(sessionId);
  const payloadCount = segment.payloadCount ?? 0;

  const averageBytesPerPacket = segment.packetCount > 0
    ? segment.totalBytes / segment.packetCount
    : 0;

  const endpointDecision = decideEndpoint({
    packetCount: segment.packetCount,
    payloadCount,
    totalBytes: segment.totalBytes,
    speechStartedAt: speechSignal.lastStartedAt,
    speechStoppedAt: speechSignal.lastStoppedAt,
    minSilenceMs: thresholds.minSilenceMs,
    pauseExtensionMs: thresholds.pauseExtensionMs,
    naturalPausePacketThreshold: thresholds.naturalPausePacketThreshold,
    shortUtterancePacketThreshold: thresholds.shortUtterancePacketThreshold,
    minPacketsForTurn: thresholds.minPacketsForTurn,
    minAverageBytesPerPacket: thresholds.minAverageBytesPerPacket,
  });

  if (!endpointDecision.shouldFinalize) {
    const noPending =
      endpointDecision.reason === "wait_for_more_context" &&
      payloadCount < thresholds.shortUtterancePacketThreshold;

    if (endpointDecision.reason === "natural_pause_extend") {
      setConversationState(sessionId, "user_pause_candidate", {
        source: "endpoint_pause_extend",
        suggestedDelayMs: endpointDecision.suggestedDelayMs,
      });
    }

    pushMediaSessionEvent(sessionId, "turn_endpoint_deferred", {
      reason,
      packetCount: segment.packetCount,
      payloadCount,
      totalBytes: segment.totalBytes,
      averageBytesPerPacket: Number(averageBytesPerPacket.toFixed(2)),
      thresholds,
      endpointDecision,
    });

    return {
      ok: false as const,
      reason: noPending ? "no_pending_audio" as const : "endpoint_wait" as const,
      endpointDecision,
    };
  }

  const qualifiesAsShortUtterance = endpointDecision.reason === "strong_short_utterance";

  const finalized = finalizeSegmentIfPending(sessionId);
  if (!finalized) {
    return { ok: false as const, reason: "no_pending_audio" as const };
  }

  setConversationState(sessionId, "finalizing_user_turn", { reason });

  const storedAudio = appendTurnAudio(sessionId, {
    turnNumber: finalized.completedTurns,
    mimeType: "audio/ogg; codecs=opus",
    frames: finalized.frames,
  });

  const turnWindow = markTurnReady(sessionId, {
    packetCount: finalized.packetCount,
    totalBytes: finalized.totalBytes,
    completedTurns: finalized.completedTurns,
  });

  const processing = queueTurnIfReady(sessionId);
  clearSpeechStart(sessionId);

  updateMediaSession(sessionId, {
    segmentation: finalized,
    turnWindow: { ...turnWindow },
    processing: { ...processing },
  });

  pushMediaSessionEvent(sessionId, "turn_finalized", {
    reason,
    turnNumber: finalized.completedTurns,
    packetCount: finalized.packetCount,
    frameCount: finalized.frames.length,
    qualifiesAsShortUtterance,
    averageBytesPerPacket: Number(averageBytesPerPacket.toFixed(2)),
    thresholds,
    endpointDecision,
  });
  markTurnMetric(sessionId, finalized.completedTurns, {
    startedAt: speechSignal.lastStartedAt,
    finalizedAt: new Date().toISOString(),
    finalizeReason: reason,
    endpointReason: endpointDecision.reason,
  });
  pushMediaSessionEvent(sessionId, "turn_audio_stored", {
    turnNumber: storedAudio.turnNumber,
    mimeType: storedAudio.mimeType,
  });

  setConversationState(sessionId, "processing_stt", {
    reason,
    turnNumber: finalized.completedTurns,
  });

  return {
    ok: true as const,
    finalized,
    storedAudio,
    turnWindow,
    processing,
    endpointDecision,
  };
}

export function shouldFinalizeOnTimeWindow(sessionId: string) {
  return hadSpeechStart(sessionId);
}

export function getTurnDetectorSnapshot(sessionId: string) {
  return {
    segment: snapshotSegment(sessionId),
    turnWindow: updateTurnWindow(sessionId, {}),
    speechSignal: getSpeechSignalState(sessionId),
    segmentationState: { ...getSegmentationState(sessionId) } as SegmentationState,
  };
}
