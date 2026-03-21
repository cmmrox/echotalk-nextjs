/**
 * Per-session speech-start tracker.
 *
 * The browser VAD calls /api/media-service/speech-start when it detects
 * the user beginning to speak. We record that signal here so the server-side
 * 300-packet time window can gate itself: if no speech-start was received
 * during a window, the window contains only background noise and should be
 * skipped entirely.
 */

declare global {
  var __echotalkSpeechStartTracker:
    | { bySession: Map<string, boolean> }
    | undefined;
}

function getStore() {
  if (!globalThis.__echotalkSpeechStartTracker) {
    globalThis.__echotalkSpeechStartTracker = { bySession: new Map() };
  }
  return globalThis.__echotalkSpeechStartTracker;
}

/** Called when the browser VAD fires onSpeechStart. */
export function markSpeechStarted(sessionId: string) {
  getStore().bySession.set(sessionId, true);
}

/** Returns true if speech-start was received since the last clearSpeechStart. */
export function hadSpeechStart(sessionId: string): boolean {
  return getStore().bySession.get(sessionId) === true;
}

/** Called after a turn is processed to reset the flag for the next window. */
export function clearSpeechStart(sessionId: string) {
  getStore().bySession.set(sessionId, false);
}

export function removeSpeechStart(sessionId: string) {
  getStore().bySession.delete(sessionId);
}
