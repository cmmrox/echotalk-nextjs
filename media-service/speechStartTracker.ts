/**
 * Per-session speech-start tracker.
 *
 * The browser VAD calls /api/media-service/speech-start when it detects
 * the user beginning to speak. We record that signal here so the server-side
 * 300-packet time window can gate itself: if no speech-start was received
 * during a window, the window contains only background noise and should be
 * skipped entirely.
 */

type SpeechSignalState = {
  started: boolean;
  lastStartedAt?: string;
  lastStoppedAt?: string;
};

declare global {
  var __echotalkSpeechStartTracker:
    | { bySession: Map<string, SpeechSignalState> }
    | undefined;
}

function getStore() {
  if (!globalThis.__echotalkSpeechStartTracker) {
    globalThis.__echotalkSpeechStartTracker = { bySession: new Map() };
  }
  return globalThis.__echotalkSpeechStartTracker;
}

function getState(sessionId: string): SpeechSignalState {
  const existing = getStore().bySession.get(sessionId);
  if (existing) return existing;

  const created: SpeechSignalState = { started: false };
  getStore().bySession.set(sessionId, created);
  return created;
}

/** Called when the browser VAD fires onSpeechStart. */
export function markSpeechStarted(sessionId: string) {
  const state = getState(sessionId);
  state.started = true;
  state.lastStartedAt = new Date().toISOString();
}

export function markSpeechStopped(sessionId: string) {
  const state = getState(sessionId);
  state.lastStoppedAt = new Date().toISOString();
}

/** Returns true if speech-start was received since the last clearSpeechStart. */
export function hadSpeechStart(sessionId: string): boolean {
  return getState(sessionId).started === true;
}

export function getSpeechSignalState(sessionId: string) {
  return { ...getState(sessionId) };
}

/** Called after a turn is processed to reset the flag for the next window. */
export function clearSpeechStart(sessionId: string) {
  const state = getState(sessionId);
  state.started = false;
}

export function removeSpeechStart(sessionId: string) {
  getStore().bySession.delete(sessionId);
}
