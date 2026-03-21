export type InterruptionState = {
  active: boolean;
  candidate: boolean;
  interruptedAt?: string;
  candidateAt?: string;
  lastReason?: string;
};

declare global {
  var __echotalkInterruptions:
    | { bySession: Map<string, InterruptionState> }
    | undefined;
}

function getStore() {
  if (!globalThis.__echotalkInterruptions) {
    globalThis.__echotalkInterruptions = { bySession: new Map() };
  }
  return globalThis.__echotalkInterruptions;
}

function getState(sessionId: string): InterruptionState {
  const existing = getStore().bySession.get(sessionId);
  if (existing) return existing;
  const created: InterruptionState = { active: false, candidate: false };
  getStore().bySession.set(sessionId, created);
  return created;
}

export function markInterruptionCandidate(sessionId: string, reason = "speech_start") {
  const state = getState(sessionId);
  state.candidate = true;
  state.candidateAt = new Date().toISOString();
  state.lastReason = reason;
  return { ...state };
}

export function markInterruptionCommitted(sessionId: string, reason = "speech_confirmed") {
  const state = getState(sessionId);
  state.candidate = false;
  state.active = true;
  state.lastReason = reason;
  state.interruptedAt = new Date().toISOString();
  return { ...state };
}

export function getInterruptionTelemetry(sessionId: string) {
  const state = getState(sessionId);
  const candidateAgeMs = state.candidateAt
    ? Math.max(0, Date.now() - Date.parse(state.candidateAt))
    : undefined;
  const activeAgeMs = state.interruptedAt
    ? Math.max(0, Date.now() - Date.parse(state.interruptedAt))
    : undefined;
  return {
    ...state,
    candidateAgeMs,
    activeAgeMs,
  };
}

export function shouldCommitInterruption(sessionId: string, minCandidateMs = 120) {
  const state = getState(sessionId);
  if (!state.candidateAt) return true;
  const candidateAt = Date.parse(state.candidateAt);
  if (!Number.isFinite(candidateAt)) return true;
  return Date.now() - candidateAt >= minCandidateMs;
}

export function clearInterruption(sessionId: string) {
  const state = getState(sessionId);
  state.active = false;
  state.candidate = false;
  state.candidateAt = undefined;
  state.lastReason = undefined;
  return { ...state };
}

export function resolveInterruption(sessionId: string, reason = "resolved") {
  const state = getState(sessionId);
  const previous = { ...state };
  state.active = false;
  state.candidate = false;
  state.candidateAt = undefined;
  state.lastReason = reason;
  return {
    previous,
    current: { ...state },
  };
}

export function getInterruptionState(sessionId: string) {
  return { ...getState(sessionId) };
}

export function removeInterruptionState(sessionId: string) {
  getStore().bySession.delete(sessionId);
}
