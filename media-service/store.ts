import { RTCPeerConnection, MediaStreamTrack } from "werift";
import type { RTCRtpSender } from "werift";

import type { ConversationState } from "@/media-service/conversationState";

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
  /**
   * Legacy coarse session status kept for backwards compatibility with the
   * current UI and route responses. New work should prefer conversationState.
   */
  status:
    | "created"
    | "signaling"
    | "connected"
    | "processing"
    | "speaking"
    | "stopped"
    | "error";
  /**
   * Authoritative fine-grained state for live conversation flow.
   * Phase 1 introduces this alongside the legacy `status` field so the
   * implementation can migrate incrementally without breaking the UI.
   */
  conversationState: ConversationState;
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
  latestMetrics?: {
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
    durations?: Record<string, number | undefined>;
  };
  outboundAudio?: {
    ready: boolean;
    turnNumber?: number;
    contentType?: string;
    createdAt?: string;
    delivered?: boolean;
    deliveredAt?: string;
    /** true when audio is being delivered via WebRTC RTP (not HTTP fetch) */
    rtcMode?: boolean;
  };
};

export type MediaPeerBundle = {
  pc: RTCPeerConnection;
  /** Local audio track added to the peer for sending TTS audio to the browser */
  localAudioTrack?: MediaStreamTrack;
  /** RTP sender for the local audio track */
  localAudioSender?: RTCRtpSender;
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
