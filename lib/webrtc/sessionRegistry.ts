import { v4 as uuidv4 } from "uuid";

import { getWebRtcStore } from "@/lib/webrtc/store";

export type SessionEvent = {
  type: string;
  at: string;
  data?: Record<string, unknown>;
};

export type ConversationEntry = {
  role: "user" | "assistant";
  text: string;
  language?: string;
  at: string;
};

export type WebRtcSession = {
  id: string;
  createdAt: string;
  updatedAt: string;
  status:
    | "created"
    | "signaling"
    | "connected"
    | "listening"
    | "processing"
    | "speaking"
    | "stopped"
    | "error";
  events: SessionEvent[];
  turns: ConversationEntry[];
  lastError?: string;
};

const MAX_EVENTS = 100;
const MAX_TURNS = 20;

export function createWebRtcSession(): WebRtcSession {
  const now = new Date().toISOString();
  const session: WebRtcSession = {
    id: uuidv4(),
    createdAt: now,
    updatedAt: now,
    status: "created",
    events: [],
    turns: [],
  };

  getWebRtcStore().sessions.set(session.id, session);
  return session;
}

export function getWebRtcSession(id: string): WebRtcSession | undefined {
  return getWebRtcStore().sessions.get(id);
}

export function updateWebRtcSession(
  id: string,
  patch: Partial<Omit<WebRtcSession, "id" | "createdAt" | "events" | "turns">>
): WebRtcSession | undefined {
  const session = getWebRtcStore().sessions.get(id);
  if (!session) return undefined;

  Object.assign(session, patch, { updatedAt: new Date().toISOString() });
  return session;
}

export function pushSessionEvent(
  id: string,
  type: string,
  data?: Record<string, unknown>
): WebRtcSession | undefined {
  const session = getWebRtcStore().sessions.get(id);
  if (!session) return undefined;

  session.events.push({ type, at: new Date().toISOString(), data });
  session.updatedAt = new Date().toISOString();
  if (session.events.length > MAX_EVENTS) {
    session.events.splice(0, session.events.length - MAX_EVENTS);
  }
  return session;
}

export function appendConversationTurn(
  id: string,
  turn: Omit<ConversationEntry, "at">
): WebRtcSession | undefined {
  const session = getWebRtcStore().sessions.get(id);
  if (!session) return undefined;

  session.turns.push({ ...turn, at: new Date().toISOString() });
  session.updatedAt = new Date().toISOString();
  if (session.turns.length > MAX_TURNS) {
    session.turns.splice(0, session.turns.length - MAX_TURNS);
  }
  return session;
}

export function removeWebRtcSession(id: string): boolean {
  return getWebRtcStore().sessions.delete(id);
}
