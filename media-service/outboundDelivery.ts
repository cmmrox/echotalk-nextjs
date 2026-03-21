import { getLatestStoredTtsAudio } from "@/media-service/ttsStore";
import {
  pushMediaSessionEvent,
  updateMediaSession,
} from "@/media-service/sessionManager";

type DeliveryState = {
  deliverable: boolean;
  delivered: boolean;
  playbackMode?: "rtc" | "http";
  turnNumber?: number;
  contentType?: string;
  bytes?: number;
  createdAt?: string;
  deliveredAt?: string;
};

declare global {
  var __echotalkOutboundDelivery:
    | {
        bySession: Map<string, DeliveryState>;
      }
    | undefined;
}

function getDeliveryStore() {
  if (!globalThis.__echotalkOutboundDelivery) {
    globalThis.__echotalkOutboundDelivery = {
      bySession: new Map(),
    };
  }

  return globalThis.__echotalkOutboundDelivery;
}

export function prepareOutboundDelivery(
  sessionId: string,
  playbackMode: "rtc" | "http" = "http"
) {
  const latest = getLatestStoredTtsAudio(sessionId);
  if (!latest) {
    console.warn("[media-service/outbound] prepare called without TTS", {
      sessionId,
    });
    return null;
  }

  const state: DeliveryState = {
    deliverable: true,
    delivered: false,
    playbackMode,
    turnNumber: latest.turnNumber,
    contentType: latest.contentType,
    bytes: Buffer.from(latest.audioBase64, "base64").length,
    createdAt: latest.createdAt,
  };

  console.log("[media-service/outbound] prepared", {
    sessionId,
    turnNumber: state.turnNumber,
    contentType: state.contentType,
    bytes: state.bytes,
  });
  getDeliveryStore().bySession.set(sessionId, state);
  updateMediaSession(sessionId, {
    outboundAudio: {
      ready: true,
      turnNumber: state.turnNumber,
      contentType: state.contentType,
      createdAt: state.createdAt,
    },
  });
  pushMediaSessionEvent(sessionId, "outbound_delivery_prepared", {
    turnNumber: state.turnNumber,
    contentType: state.contentType,
    bytes: state.bytes,
    playbackMode: state.playbackMode,
  });

  return state;
}

export function markOutboundDelivered(sessionId: string, expectedTurnNumber?: number) {
  const state = getDeliveryStore().bySession.get(sessionId);
  if (!state) return null;

  if (
    typeof expectedTurnNumber === "number" &&
    typeof state.turnNumber === "number" &&
    state.turnNumber !== expectedTurnNumber
  ) {
    pushMediaSessionEvent(sessionId, "outbound_delivery_mark_rejected_turn_mismatch", {
      expectedTurnNumber,
      actualTurnNumber: state.turnNumber,
      playbackMode: state.playbackMode,
    });
    return null;
  }

  state.delivered = true;
  state.deliveredAt = new Date().toISOString();
  pushMediaSessionEvent(sessionId, "outbound_delivery_marked", {
    turnNumber: state.turnNumber,
    deliveredAt: state.deliveredAt,
    playbackMode: state.playbackMode,
  });
  return state;
}

export function getOutboundDeliveryState(sessionId: string) {
  return getDeliveryStore().bySession.get(sessionId) ?? null;
}

export function clearOutboundDelivery(sessionId: string) {
  const existing = getDeliveryStore().bySession.get(sessionId) ?? null;
  if (existing) {
    pushMediaSessionEvent(sessionId, "outbound_delivery_cleared", {
      turnNumber: existing.turnNumber,
      playbackMode: existing.playbackMode,
      delivered: existing.delivered,
    });
  }
  getDeliveryStore().bySession.delete(sessionId);
  return existing;
}
