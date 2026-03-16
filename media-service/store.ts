import { RTCPeerConnection } from "werift";

export type InboundTrackObserver = {
  kind: string;
  id: string;
  streamId?: string;
  remote: boolean;
  muted: boolean;
  receivedRtpPackets: number;
  receivedBytes: number;
  lastPacketAt?: string;
};

export type MediaServiceSession = {
  id: string;
  createdAt: string;
  updatedAt: string;
  status:
    | "created"
    | "signaling"
    | "connected"
    | "processing"
    | "speaking"
    | "stopped"
    | "error";
  events: Array<{
    type: string;
    at: string;
    data?: Record<string, unknown>;
  }>;
  turns: Array<{
    role: "user" | "assistant";
    text: string;
    language?: string;
    at: string;
  }>;
  inboundTrack?: InboundTrackObserver;
  segmentation?: {
    packetCount: number;
    totalBytes: number;
    payloadCount?: number;
    startedAt?: string;
    lastPacketAt?: string;
    completedTurns: number;
  };
  turnWindow?: {
    ready: boolean;
    packetCount: number;
    totalBytes: number;
    completedTurns: number;
    lastReadyAt?: string;
  };
  processing?: {
    queued: boolean;
    processing: boolean;
    processedTurns: number;
    lastQueuedAt?: string;
    lastProcessedAt?: string;
  };
  latestResult?: {
    turnNumber: number;
    transcript: string;
    detectedLanguage: string;
    replyText: string;
    replyLanguage: string;
    createdAt: string;
  };
  latestTts?: {
    turnNumber: number;
    contentType: string;
    createdAt: string;
  };
  outboundAudio?: {
    ready: boolean;
    turnNumber?: number;
    contentType?: string;
    createdAt?: string;
    delivered?: boolean;
    deliveredAt?: string;
  };
};

export type MediaPeerBundle = {
  pc: RTCPeerConnection;
};

declare global {
  var __echotalkMediaServiceStore:
    | {
        sessions: Map<string, MediaServiceSession>;
        peers: Map<string, MediaPeerBundle>;
      }
    | undefined;
}

export function getMediaServiceStore() {
  if (!globalThis.__echotalkMediaServiceStore) {
    globalThis.__echotalkMediaServiceStore = {
      sessions: new Map(),
      peers: new Map(),
    };
  }

  return globalThis.__echotalkMediaServiceStore;
}
