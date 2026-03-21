export type EndpointingDecision = {
  shouldFinalize: boolean;
  reason:
    | "speech_not_stopped"
    | "too_short_wait"
    | "strong_short_utterance"
    | "natural_pause_extend"
    | "default_finalize"
    | "wait_for_more_context";
  suggestedDelayMs?: number;
  silenceMs?: number;
  speechDurationMs?: number;
};

export type EndpointingInput = {
  packetCount: number;
  payloadCount: number;
  totalBytes: number;
  speechStartedAt?: string;
  speechStoppedAt?: string;
  minSilenceMs: number;
  pauseExtensionMs: number;
  naturalPausePacketThreshold: number;
  shortUtterancePacketThreshold: number;
  minPacketsForTurn: number;
  minAverageBytesPerPacket: number;
};

export function decideEndpoint(input: EndpointingInput): EndpointingDecision {
  const {
    packetCount,
    payloadCount,
    totalBytes,
    speechStartedAt,
    speechStoppedAt,
    minSilenceMs,
    pauseExtensionMs,
    naturalPausePacketThreshold,
    shortUtterancePacketThreshold,
    minPacketsForTurn,
    minAverageBytesPerPacket,
  } = input;

  if (!speechStoppedAt) {
    return {
      shouldFinalize: false,
      reason: "speech_not_stopped",
    };
  }

  const stoppedAt = Date.parse(speechStoppedAt);
  const silenceMs = Number.isFinite(stoppedAt) ? Date.now() - stoppedAt : 0;
  const startedAt = speechStartedAt ? Date.parse(speechStartedAt) : NaN;
  const speechDurationMs = Number.isFinite(startedAt) && Number.isFinite(stoppedAt)
    ? Math.max(0, stoppedAt - startedAt)
    : undefined;

  const avgBytesPerPacket = packetCount > 0 ? totalBytes / packetCount : 0;
  const signalLooksStrong = avgBytesPerPacket >= minAverageBytesPerPacket;

  const strongShortUtterance =
    payloadCount >= shortUtterancePacketThreshold &&
    payloadCount < minPacketsForTurn &&
    signalLooksStrong &&
    (speechDurationMs === undefined || speechDurationMs <= 2500);

  const longishTurnWithBriefPause =
    packetCount >= naturalPausePacketThreshold &&
    silenceMs < minSilenceMs + pauseExtensionMs;

  if (strongShortUtterance) {
    return {
      shouldFinalize: true,
      reason: "strong_short_utterance",
      silenceMs,
      speechDurationMs,
    };
  }

  if (silenceMs < minSilenceMs) {
    return {
      shouldFinalize: false,
      reason: "too_short_wait",
      suggestedDelayMs: minSilenceMs - silenceMs,
      silenceMs,
      speechDurationMs,
    };
  }

  if (longishTurnWithBriefPause) {
    return {
      shouldFinalize: false,
      reason: "natural_pause_extend",
      suggestedDelayMs: minSilenceMs + pauseExtensionMs - silenceMs,
      silenceMs,
      speechDurationMs,
    };
  }

  if (packetCount >= minPacketsForTurn && signalLooksStrong) {
    return {
      shouldFinalize: true,
      reason: "default_finalize",
      silenceMs,
      speechDurationMs,
    };
  }

  return {
    shouldFinalize: false,
    reason: "wait_for_more_context",
    suggestedDelayMs: 250,
    silenceMs,
    speechDurationMs,
  };
}
