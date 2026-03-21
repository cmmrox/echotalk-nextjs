import type { WebRtcSession } from "@/lib/webrtc/sessionRegistry";
import type { RTCPeerConnection } from "werift";

type PeerBundle = {
  pc: RTCPeerConnection;
};

type GlobalStore = {
  sessions: Map<string, WebRtcSession>;
  peers: Map<string, PeerBundle>;
};

declare global {
  var __echotalkWebRtcStore: GlobalStore | undefined;
}

export function getWebRtcStore(): GlobalStore {
  if (!globalThis.__echotalkWebRtcStore) {
    globalThis.__echotalkWebRtcStore = {
      sessions: new Map(),
      peers: new Map(),
    };
  }

  return globalThis.__echotalkWebRtcStore;
}

export type { PeerBundle };
