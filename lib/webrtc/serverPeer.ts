import { RTCPeerConnection } from "werift";

import {
  getWebRtcSession,
  pushSessionEvent,
  removeWebRtcSession,
  updateWebRtcSession,
} from "@/lib/webrtc/sessionRegistry";
import { getWebRtcStore } from "@/lib/webrtc/store";

export function getServerPeer(sessionId: string) {
  return getWebRtcStore().peers.get(sessionId);
}

export async function ensureServerPeer(sessionId: string) {
  const existing = getWebRtcStore().peers.get(sessionId);
  if (existing) {
    console.log("[webrtc/serverPeer] reuse existing peer", { sessionId });
    return existing;
  }

  const session = getWebRtcSession(sessionId);
  if (!session) {
    console.error("[webrtc/serverPeer] missing session for peer creation", {
      sessionId,
    });
    throw new Error("Session not found");
  }

  console.log("[webrtc/serverPeer] creating peer", {
    sessionId,
    sessionStatus: session.status,
  });

  const pc = new RTCPeerConnection();

  pc.onIceCandidate.subscribe((candidate) => {
    pushSessionEvent(sessionId, "server_ice_candidate", {
      candidate: candidate ? JSON.stringify(candidate.toJSON()) : null,
    });
  });

  pc.onTrack.subscribe((event) => {
    const maybeTrack =
      typeof event === "object" && event !== null && "track" in event
        ? (event as { track?: { kind?: string; id?: string } }).track
        : undefined;

    if (!maybeTrack) {
      pushSessionEvent(sessionId, "server_track_event_without_track", {
        eventType: typeof event,
      });
      console.warn("[webrtc/serverPeer] onTrack event without track", {
        sessionId,
        event,
      });
      return;
    }

    pushSessionEvent(sessionId, "server_track_received", {
      kind: maybeTrack.kind ?? "unknown",
      id: maybeTrack.id ?? "unknown",
    });
    updateWebRtcSession(sessionId, { status: "connected" });
  });

  pc.connectionStateChange.subscribe(() => {
    pushSessionEvent(sessionId, "server_connection_state", {
      connectionState: pc.connectionState,
      iceConnectionState: pc.iceConnectionState,
    });

    if (pc.connectionState === "connected") {
      updateWebRtcSession(sessionId, { status: "connected" });
    }

    if (pc.connectionState === "failed" || pc.connectionState === "closed") {
      updateWebRtcSession(sessionId, {
        status: pc.connectionState === "closed" ? "stopped" : "error",
      });
    }
  });

  const bundle = { pc };
  getWebRtcStore().peers.set(sessionId, bundle);
  return bundle;
}

export async function acceptOffer(params: {
  sessionId: string;
  sdp: string;
  type: "offer";
}) {
  const { sessionId, sdp, type } = params;
  const { pc } = await ensureServerPeer(sessionId);

  console.log("[webrtc/serverPeer] setRemoteDescription:start", {
    sessionId,
    type,
    sdpLength: sdp.length,
  });
  await pc.setRemoteDescription({ sdp, type });
  console.log("[webrtc/serverPeer] setRemoteDescription:done", { sessionId });
  pushSessionEvent(sessionId, "server_remote_description_set", {
    type,
    sdpLength: sdp.length,
  });

  console.log("[webrtc/serverPeer] createAnswer:start", { sessionId });
  const answer = await pc.createAnswer();
  console.log("[webrtc/serverPeer] createAnswer:done", {
    sessionId,
    answerType: answer.type,
    answerSdpLength: answer.sdp?.length ?? 0,
  });
  pushSessionEvent(sessionId, "server_answer_object_created", {
    type: answer.type,
    sdpLength: answer.sdp?.length ?? 0,
  });
  console.log("[webrtc/serverPeer] setLocalDescription:start", { sessionId });
  await pc.setLocalDescription(answer);
  console.log("[webrtc/serverPeer] setLocalDescription:done", { sessionId });
  console.log("[webrtc/serverPeer] gatherCandidates:start", { sessionId });
  await pc.gatherCandidates();
  console.log("[webrtc/serverPeer] gatherCandidates:done", { sessionId });

  const local = pc.localDescription;
  if (!local?.sdp) {
    throw new Error("Failed to generate local answer SDP");
  }

  pushSessionEvent(sessionId, "server_answer_created", {
    sdpLength: local.sdp.length,
    type: local.type,
  });
  updateWebRtcSession(sessionId, { status: "signaling" });

  return {
    type: local.type,
    sdp: local.sdp,
  };
}

export async function addRemoteIceCandidate(params: {
  sessionId: string;
  candidate: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
}) {
  const { sessionId, candidate, sdpMid, sdpMLineIndex } = params;
  const { pc } = await ensureServerPeer(sessionId);

  await pc.addIceCandidate({
    candidate,
    sdpMid: sdpMid ?? undefined,
    sdpMLineIndex: sdpMLineIndex ?? undefined,
  });

  pushSessionEvent(sessionId, "server_remote_ice_added", {
    candidateLength: candidate.length,
    sdpMid: sdpMid ?? null,
    sdpMLineIndex: sdpMLineIndex ?? null,
  });
}

export function closeServerPeer(sessionId: string) {
  const bundle = getWebRtcStore().peers.get(sessionId);
  if (bundle) {
    try {
      bundle.pc.close();
    } catch {
      // ignore cleanup errors
    }
    getWebRtcStore().peers.delete(sessionId);
  }

  removeWebRtcSession(sessionId);
}
