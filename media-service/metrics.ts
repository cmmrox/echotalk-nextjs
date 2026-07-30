import { pushMediaSessionEvent, updateMediaSession } from "@/media-service/sessionManager";

export type TurnMetricRecord = {
  turnNumber: number;
  startedAt?: string;
  finalizedAt?: string;
  sttStartedAt?: string;
  sttCompletedAt?: string;
  agentStartedAt?: string;
  agentCompletedAt?: string;
  ttsStartedAt?: string;
  ttsCompletedAt?: string;
  playbackStartedAt?: string;
  playbackFinishedAt?: string;
  finalizeReason?: string;
  endpointReason?: string;
  playbackMode?: "rtc" | "http";
};

declare global {
  var __echotalkTurnMetrics:
    | { bySession: Map<string, Map<number, TurnMetricRecord>> }
    | undefined;
}

function getStore() {
  if (!globalThis.__echotalkTurnMetrics) {
    globalThis.__echotalkTurnMetrics = { bySession: new Map() };
  }
  return globalThis.__echotalkTurnMetrics;
}

function getSessionMetrics(sessionId: string) {
  const store = getStore();
  const existing = store.bySession.get(sessionId);
  if (existing) return existing;
  const created = new Map<number, TurnMetricRecord>();
  store.bySession.set(sessionId, created);
  return created;
}

function getMetric(sessionId: string, turnNumber: number) {
  const sessionMetrics = getSessionMetrics(sessionId);
  const existing = sessionMetrics.get(turnNumber);
  if (existing) return existing;
  const created: TurnMetricRecord = { turnNumber };
  sessionMetrics.set(turnNumber, created);
  return created;
}

function durationMs(from?: string, to?: string) {
  if (!from || !to) return undefined;
  const a = Date.parse(from);
  const b = Date.parse(to);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return undefined;
  return Math.max(0, b - a);
}

function snapshot(metric: TurnMetricRecord) {
  return {
    ...metric,
    durations: {
      detectToFinalizeMs: durationMs(metric.startedAt, metric.finalizedAt),
      sttMs: durationMs(metric.sttStartedAt, metric.sttCompletedAt),
      agentMs: durationMs(metric.agentStartedAt, metric.agentCompletedAt),
      ttsMs: durationMs(metric.ttsStartedAt, metric.ttsCompletedAt),
      playbackMs: durationMs(metric.playbackStartedAt, metric.playbackFinishedAt),
      endToPlaybackMs: durationMs(metric.finalizedAt, metric.playbackStartedAt),
    },
  };
}

function publish(sessionId: string, turnNumber: number) {
  const metric = getMetric(sessionId, turnNumber);
  const data = snapshot(metric);
  pushMediaSessionEvent(sessionId, "turn_metrics_updated", data);
  updateMediaSession(sessionId, {
    latestMetrics: data,
  });
  return data;
}

export function markTurnMetric(sessionId: string, turnNumber: number, patch: Partial<TurnMetricRecord>) {
  const metric = getMetric(sessionId, turnNumber);
  Object.assign(metric, patch);
  return publish(sessionId, turnNumber);
}

export function getTurnMetricSnapshot(sessionId: string, turnNumber: number) {
  return snapshot(getMetric(sessionId, turnNumber));
}

export function buildTurnMetricPatch(turnNumber: number, patch: Partial<TurnMetricRecord>) {
  return {
    turnNumber,
    ...patch,
  };
}

export function removeTurnMetrics(sessionId: string) {
  getStore().bySession.delete(sessionId);
}
