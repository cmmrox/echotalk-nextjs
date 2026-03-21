import {
  finalizeTurnIfReady,
  handleProgressSnapshot,
  handleInboundPacket,
  shouldFinalizeOnTimeWindow,
  skipNoSpeechWindow,
} from "@/media-service/turnDetector";
import type { InboundTrackObserver } from "@/media-service/store";
import {
  pushMediaSessionEvent,
  updateMediaSession,
} from "@/media-service/sessionManager";

export function attachInboundTrackObserver(params: {
  sessionId: string;
  track: {
    kind?: string;
    id?: string;
    streamId?: string;
    remote?: boolean;
    muted?: boolean;
    onReceiveRtp?: {
      subscribe?: (cb: (rtp: { payload?: Buffer | Uint8Array }) => void) => void;
    };
  };
}) {
  const { sessionId, track } = params;

  const observer: InboundTrackObserver = {
    kind: track.kind ?? "unknown",
    id: track.id ?? "unknown",
    streamId: track.streamId,
    remote: Boolean(track.remote),
    muted: Boolean(track.muted),
    receivedRtpPackets: 0,
    receivedBytes: 0,
  };

  console.log("[media-service/inboundTrack] observer attached", {
    sessionId,
    kind: observer.kind,
    id: observer.id,
    remote: observer.remote,
    muted: observer.muted,
  });
  updateMediaSession(sessionId, {
    inboundTrack: observer,
    status: "connected",
  });
  pushMediaSessionEvent(sessionId, "inbound_track_observer_attached", {
    kind: observer.kind,
    id: observer.id,
    remote: observer.remote,
    muted: observer.muted,
  });

  if (track.onReceiveRtp?.subscribe) {
    track.onReceiveRtp.subscribe((rtp) => {
      const payload = rtp.payload;
      const payloadBytes = payload?.length ?? 0;
      observer.receivedRtpPackets += 1;
      observer.receivedBytes += payloadBytes;
      observer.lastPacketAt = new Date().toISOString();
      handleInboundPacket(sessionId, { bytes: payloadBytes, payload });

      if (observer.receivedRtpPackets === 1) {
        console.log("[media-service/inboundTrack] first RTP packet", {
          sessionId,
          kind: observer.kind,
          id: observer.id,
          payloadBytes,
        });
        pushMediaSessionEvent(sessionId, "inbound_rtp_started", {
          kind: observer.kind,
          id: observer.id,
        });
      }

      if (observer.receivedRtpPackets % 100 === 0) {
        const { segment, turnWindow, speechSignal } = handleProgressSnapshot(sessionId);
        console.log("[media-service/inboundTrack] RTP progress", {
          sessionId,
          packets: observer.receivedRtpPackets,
          bytes: observer.receivedBytes,
          segment,
          speechSignal,
        });
        updateMediaSession(sessionId, {
          inboundTrack: { ...observer },
          segmentation: segment,
          turnWindow: { ...turnWindow },
        });
        pushMediaSessionEvent(sessionId, "inbound_rtp_progress", {
          packets: observer.receivedRtpPackets,
          bytes: observer.receivedBytes,
          segment,
          speechSignal,
        });
      }

      if (observer.receivedRtpPackets % 300 === 0) {
        if (!shouldFinalizeOnTimeWindow(sessionId)) {
          console.log("[media-service/inboundTrack] 300-packet window skipped (no speech detected)", {
            sessionId,
            packets: observer.receivedRtpPackets,
          });
          skipNoSpeechWindow(sessionId, observer.receivedRtpPackets);
          return;
        }

        const finalizedTurn = finalizeTurnIfReady({
          sessionId,
          reason: "time_window",
        });

        if (!finalizedTurn.ok) {
          console.log("[media-service/inboundTrack] 300-packet window skipped", {
            sessionId,
            packets: observer.receivedRtpPackets,
            reason: finalizedTurn.reason,
            endpointDecision: finalizedTurn.endpointDecision,
          });
          pushMediaSessionEvent(sessionId, "segment_window_skipped", {
            packets: observer.receivedRtpPackets,
            reason: finalizedTurn.reason,
            endpointDecision: finalizedTurn.endpointDecision,
          });
          return;
        }

        console.log("[media-service/inboundTrack] segment window completed", {
          sessionId,
          turnNumber: finalizedTurn.finalized.completedTurns,
          packetCount: finalizedTurn.finalized.packetCount,
          totalBytes: finalizedTurn.finalized.totalBytes,
          frameCount: finalizedTurn.finalized.frames.length,
          completedTurns: finalizedTurn.finalized.completedTurns,
          endpointDecision: finalizedTurn.endpointDecision,
        });

        updateMediaSession(sessionId, {
          inboundTrack: { ...observer },
          segmentation: finalizedTurn.finalized,
          turnWindow: { ...finalizedTurn.turnWindow },
          processing: { ...finalizedTurn.processing },
        });
      }
    });
  } else {
    pushMediaSessionEvent(sessionId, "inbound_track_missing_rtp_subscription", {
      kind: observer.kind,
      id: observer.id,
    });
  }

  return observer;
}
