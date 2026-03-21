import { RTCPeerConnection, MediaStreamTrack } from "werift";

import { attachInboundTrackObserver } from "@/media-service/inboundTrack";
import { removeListeningState } from "@/media-service/listeningState";
import { registerOutboundSender, removeOutboundSender } from "@/media-service/outboundAudioTrack";
import { getMediaServiceStore } from "@/media-service/store";
import {
  getMediaSession,
  pushMediaSessionEvent,
  updateMediaSession,
} from "@/media-service/sessionManager";

// ---------------------------------------------------------------------------
// ICE candidate buffer — trickle ICE candidates can arrive before the offer.
// We buffer them and apply once the remote description is set.
// ---------------------------------------------------------------------------
type IceCandidate = {
  candidate: string;
  sdpMid?: string;
  sdpMLineIndex?: number;
};

const pendingIce = new Map<string, IceCandidate[]>();

function getPendingIceCandidates(sessionId: string): IceCandidate[] {
  return pendingIce.get(sessionId) ?? [];
}

function clearPendingIceCandidates(sessionId: string) {
  pendingIce.delete(sessionId);
}

function bufferIceCandidate(sessionId: string, c: IceCandidate) {
  const existing = pendingIce.get(sessionId) ?? [];
  existing.push(c);
  pendingIce.set(sessionId, existing);
}

export async function ensureMediaPeer(sessionId: string) {
  const existing = getMediaServiceStore().peers.get(sessionId);
  if (existing) {
    console.log("[media-service/peer] reuse existing peer", { sessionId });
    return existing;
  }

  const session = getMediaSession(sessionId);
  if (!session) {
    throw new Error("Media session not found");
  }

  console.log("[media-service/peer] create peer", {
    sessionId,
    sessionStatus: session.status,
  });

  const pc = new RTCPeerConnection();

  pc.onIceCandidate.subscribe((candidate) => {
    pushMediaSessionEvent(sessionId, "server_ice_candidate", {
      candidate: candidate ? JSON.stringify(candidate.toJSON()) : null,
    });
  });

  pc.onTrack.subscribe((event) => {
    console.log("[media-service/peer] onTrack event", {
      sessionId,
      eventType: typeof event,
      eventKeys:
        typeof event === "object" && event !== null ? Object.keys(event) : [],
    });

    const maybeTrack =
      typeof event === "object" && event !== null
        ? "track" in event
          ? (event as { track?: { kind?: string; id?: string } }).track
          : "kind" in event && "id" in event && "onReceiveRtp" in event
            ? (event as {
                kind?: string;
                id?: string;
                streamId?: string;
                remote?: boolean;
                muted?: boolean;
                onReceiveRtp?: {
                  subscribe?: (cb: (rtp: { payload?: Buffer | Uint8Array }) => void) => void;
                };
              })
            : undefined
        : undefined;

    if (!maybeTrack) {
      pushMediaSessionEvent(sessionId, "track_event_without_track", {
        eventType: typeof event,
      });
      console.warn("[media-service/peer] track event without track", {
        sessionId,
        event,
      });
      return;
    }

    console.log("[media-service/peer] track received", {
      sessionId,
      kind: maybeTrack.kind ?? "unknown",
      id: maybeTrack.id ?? "unknown",
    });
    pushMediaSessionEvent(sessionId, "track_received", {
      kind: maybeTrack.kind ?? "unknown",
      id: maybeTrack.id ?? "unknown",
    });

    attachInboundTrackObserver({
      sessionId,
      track: maybeTrack,
    });

    updateMediaSession(sessionId, { status: "connected" });
  });

  pc.connectionStateChange.subscribe(() => {
    const cs = pc.connectionState;
    const ics = pc.iceConnectionState;
    console.log("[media-service/peer] connection state", {
      sessionId,
      connectionState: cs,
      iceConnectionState: ics,
    });
    pushMediaSessionEvent(sessionId, "connection_state_changed", {
      connectionState: cs,
      iceConnectionState: ics,
    });

    // Stage 21: auto-cleanup when the peer disconnects or fails so we don't
    // hold stale in-memory state forever.
    if (cs === "closed" || cs === "failed" || cs === "disconnected") {
      updateMediaSession(sessionId, { status: "stopped" });
      // Re-open the listening gate in case it was left closed (AI was speaking).
      removeListeningState(sessionId);
      // Remove the peer from the registry — session row stays so the client can
      // still read it and knows the session ended.
      getMediaServiceStore().peers.delete(sessionId);
      console.log("[media-service/peer] peer cleaned up after", cs, { sessionId });
    }
  });

  const bundle: import("@/media-service/store").MediaPeerBundle = { pc };
  getMediaServiceStore().peers.set(sessionId, bundle);
  return bundle;
}

export async function mediaAcceptOffer(params: {
  sessionId: string;
  sdp: string;
  type: "offer";
}) {
  const { sessionId, sdp, type } = params;
  const { pc } = await ensureMediaPeer(sessionId);

  await pc.setRemoteDescription({ sdp, type });
  pushMediaSessionEvent(sessionId, "remote_description_set", {
    type,
    sdpLength: sdp.length,
  });

  // Add a local audio track so the server can send TTS audio back to the browser.
  // This must be done BEFORE createAnswer() so the SDP includes our outbound audio.
  try {
    const bundle = getMediaServiceStore().peers.get(sessionId);
    if (bundle && !bundle.localAudioTrack) {
      const localAudioTrack = new MediaStreamTrack({ kind: "audio" });
      const localAudioSender = pc.addTrack(localAudioTrack);
      bundle.localAudioTrack = localAudioTrack;
      bundle.localAudioSender = localAudioSender;
      registerOutboundSender(sessionId, localAudioSender);
      console.log("[media-service/peer] local audio track added", { sessionId });
      pushMediaSessionEvent(sessionId, "local_audio_track_added", {});
    }
  } catch (err) {
    console.warn("[media-service/peer] failed to add local audio track", {
      sessionId,
      err: String(err),
    });
  }

  // Apply any ICE candidates that arrived before the offer (trickle ICE ordering).
  const buffered = getPendingIceCandidates(sessionId);
  if (buffered.length > 0) {
    console.log("[media-service/peer] applying buffered ICE candidates", {
      sessionId,
      count: buffered.length,
    });
    for (const c of buffered) {
      await pc.addIceCandidate(c).catch((err) => {
        console.warn("[media-service/peer] buffered ICE add error", { sessionId, err: String(err) });
      });
    }
    clearPendingIceCandidates(sessionId);
  }

  const answer = await pc.createAnswer();

  // Log SDP direction lines so we can confirm the outbound audio track is negotiated.
  const sdpLines = (answer.sdp ?? "").split("\n");
  const audioSection = sdpLines
    .filter((l) =>
      l.startsWith("m=") || l.includes("sendrecv") || l.includes("sendonly") ||
      l.includes("recvonly") || l.startsWith("a=msid") || l.startsWith("a=ssrc")
    )
    .join(" | ");
  console.log("[media-service/peer] answer SDP summary", { sessionId, audioSection });

  await pc.setLocalDescription(answer);

  // Gather candidates with a timeout — don't block indefinitely.
  // Host candidates are available almost immediately; STUN/TURN may take longer.
  // After 2.5 s we proceed with whatever is gathered.
  const GATHER_TIMEOUT_MS = 2500;
  await Promise.race([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pc as any).gatherCandidates(),
    new Promise<void>((resolve) => setTimeout(resolve, GATHER_TIMEOUT_MS)),
  ]);

  const local = pc.localDescription;
  if (!local?.sdp) {
    throw new Error("Failed to generate media-service answer SDP");
  }

  console.log("[media-service/peer] answer ready", {
    sessionId,
    sdpLength: local.sdp.length,
  });
  pushMediaSessionEvent(sessionId, "answer_created", {
    type: local.type,
    sdpLength: local.sdp.length,
  });
  updateMediaSession(sessionId, { status: "signaling" });

  return {
    type: local.type,
    sdp: local.sdp,
  };
}

export async function mediaAddIce(params: {
  sessionId: string;
  candidate: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
}) {
  const { sessionId, candidate, sdpMid, sdpMLineIndex } = params;
  const { pc } = await ensureMediaPeer(sessionId);

  const iceEntry: IceCandidate = {
    candidate,
    sdpMid: sdpMid ?? undefined,
    sdpMLineIndex: sdpMLineIndex ?? undefined,
  };

  // Buffer candidates that arrive before the offer (remote description not set yet).
  // They will be applied in mediaAcceptOffer after setRemoteDescription.
  if (!pc.remoteDescription) {
    bufferIceCandidate(sessionId, iceEntry);
    console.log("[media-service/ice] buffered (no remote desc yet)", {
      sessionId,
      buffered: getPendingIceCandidates(sessionId).length,
    });
    pushMediaSessionEvent(sessionId, "remote_ice_buffered", {
      candidateLength: candidate.length,
    });
    return;
  }

  await pc.addIceCandidate(iceEntry);

  pushMediaSessionEvent(sessionId, "remote_ice_added", {
    candidateLength: candidate.length,
    sdpMid: sdpMid ?? null,
    sdpMLineIndex: sdpMLineIndex ?? null,
  });
}
