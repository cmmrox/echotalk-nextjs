import { v4 as uuidv4 } from "uuid";

import { getMediaServiceStore } from "@/media-service/store";

export function createMediaSession() {
  const now = new Date().toISOString();
  const session = {
    id: uuidv4(),
    createdAt: now,
    updatedAt: now,
    status: "created" as const,
    events: [] as Array<{
      type: string;
      at: string;
      data?: Record<string, unknown>;
    }>,
    turns: [] as Array<{
      role: "user" | "assistant";
      text: string;
      language?: string;
      at: string;
    }>,
    inboundTrack: undefined,
    segmentation: undefined,
    turnWindow: undefined,
    processing: undefined,
    latestResult: undefined,
    latestTts: undefined,
    outboundAudio: undefined,
  };

  getMediaServiceStore().sessions.set(session.id, session);
  return session;
}

export function getMediaSession(sessionId: string) {
  return getMediaServiceStore().sessions.get(sessionId);
}

export function updateMediaSession(
  sessionId: string,
  patch: Partial<ReturnType<typeof createMediaSession>>
) {
  const session = getMediaServiceStore().sessions.get(sessionId);
  if (!session) return undefined;
  Object.assign(session, patch, { updatedAt: new Date().toISOString() });
  return session;
}

export function pushMediaSessionEvent(
  sessionId: string,
  type: string,
  data?: Record<string, unknown>
) {
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
  turn: {
    role: "user" | "assistant";
    text: string;
    language?: string;
  }
) {
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
