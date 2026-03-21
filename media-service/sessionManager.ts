import { v4 as uuidv4 } from "uuid";

import { getMediaServiceStore } from "@/media-service/store";
import type { MediaServiceSession } from "@/media-service/store";

// Re-export for convenience so callers don't need two imports
export type { MediaServiceSession as MediaSession };
export type MediaTurnResult = NonNullable<MediaServiceSession["latestResult"]>;

// ---------------------------------------------------------------------------
// CRUD helpers
// ---------------------------------------------------------------------------

export function createMediaSession(): MediaServiceSession {
  const now = new Date().toISOString();
  const session: MediaServiceSession = {
    id: uuidv4(),
    createdAt: now,
    updatedAt: now,
    status: "created",
    events: [],
    turns: [],
  };

  getMediaServiceStore().sessions.set(session.id, session);
  return session;
}

export function getMediaSession(sessionId: string): MediaServiceSession | undefined {
  return getMediaServiceStore().sessions.get(sessionId);
}

export function updateMediaSession(
  sessionId: string,
  patch: Partial<MediaServiceSession>
): MediaServiceSession | undefined {
  const session = getMediaServiceStore().sessions.get(sessionId);
  if (!session) return undefined;
  Object.assign(session, patch, { updatedAt: new Date().toISOString() });
  return session;
}

export function pushMediaSessionEvent(
  sessionId: string,
  type: string,
  data?: Record<string, unknown>
): MediaServiceSession | undefined {
  const session = getMediaServiceStore().sessions.get(sessionId);
  if (!session) return undefined;
  session.events.push({ type, at: new Date().toISOString(), data });
  session.updatedAt = new Date().toISOString();
  if (session.events.length > 100) {
    session.events.splice(0, session.events.length - 100);
  }
  return session;
}

export function appendMediaTurn(
  sessionId: string,
  turn: { role: "user" | "assistant"; text: string; language?: string }
): MediaServiceSession | undefined {
  const session = getMediaServiceStore().sessions.get(sessionId);
  if (!session) return undefined;
  session.turns.push({ ...turn, at: new Date().toISOString() });
  session.updatedAt = new Date().toISOString();
  if (session.turns.length > 20) {
    session.turns.splice(0, session.turns.length - 20);
  }
  return session;
}

export function closeMediaSession(sessionId: string) {
  const store = getMediaServiceStore();
  const peer = store.peers.get(sessionId);
  if (peer) {
    try {
      peer.pc.close();
    } catch {
      // ignore cleanup errors
    }
    store.peers.delete(sessionId);
  }
  store.sessions.delete(sessionId);
}
