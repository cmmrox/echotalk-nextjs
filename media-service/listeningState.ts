/**
 * Per-session "listening" flag.
 *
 * When listening=false (AI is speaking), the inbound audio pipeline discards
 * accumulated RTP frames instead of queuing them for STT. This prevents the
 * server from transcribing its own TTS output picked up by the microphone.
 *
 * Flow:
 *   browser starts AI playback  → POST set-listening?listening=0
 *     → server blocks new turns + discards current segment accumulation
 *   browser finishes AI playback → POST set-listening?listening=1
 *     → server resumes normal turn processing
 */

declare global {
  var __echotalkListeningState:
    | { bySession: Map<string, boolean> }
    | undefined;
}

function getStore() {
  if (!globalThis.__echotalkListeningState) {
    globalThis.__echotalkListeningState = { bySession: new Map() };
  }
  return globalThis.__echotalkListeningState;
}

import { clearInterruption, resolveInterruption } from "@/media-service/interruptions";
import { pushMediaSessionEvent, setConversationState } from "@/media-service/sessionManager";

/** Returns true (listening) by default — unknown sessions are assumed to be listening. */
export function isSessionListening(sessionId: string): boolean {
  return getStore().bySession.get(sessionId) !== false;
}

export function setSessionListening(sessionId: string, listening: boolean) {
  getStore().bySession.set(sessionId, listening);
  if (listening) {
    const resolved = resolveInterruption(sessionId, "listening_resumed");
    if (resolved.previous.active || resolved.previous.candidate) {
      pushMediaSessionEvent(sessionId, "interruption_resolved", {
        source: "listening_state",
        previous: resolved.previous,
      });
    }
  } else {
    clearInterruption(sessionId);
  }
  setConversationState(sessionId, listening ? "listening" : "assistant_speaking", {
    source: "listening_state",
    listening,
  });
}

export function removeListeningState(sessionId: string) {
  getStore().bySession.delete(sessionId);
}
