import { queueTurnIfReady } from "@/media-service/processingQueue";
import { appendSegmentPacket, finalizeSegment, snapshotSegment } from "@/media-service/segmentationBuffer";
import {
  appendTurnAudio,
} from "@/media-service/turnAudioStore";
import { markTurnReady, updateTurnWindow } from "@/media-service/turnState";
import type { InboundTrackObserver } from "@/media-service/store";
import {
  pushMediaSessionEvent,
  updateMediaSession,
} from "@/media-service/sessionManager";
import { isSessionListening } from "@/media-service/listeningState";

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
      appendSegmentPacket(sessionId, payloadBytes, payload);

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
        const segment = snapshotSegment(sessionId);
        console.log("[media-service/inboundTrack] RTP progress", {
          sessionId,
          packets: observer.receivedRtpPackets,
          bytes: observer.receivedBytes,
          segment,
        });
        const turnWindow = updateTurnWindow(sessionId, {
          ready: false,
          packetCount: segment.packetCount,
          totalBytes: segment.totalBytes,
          completedTurns: segment.completedTurns,
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
        });
      }

      if (observer.receivedRtpPackets % 300 === 0) {
        const finalized = finalizeSegment(sessionId);
        const turnNumber = finalized.completedTurns;

        // Skip processing if the AI is currently speaking — discard this window
        // so we don't accidentally transcribe the AI's own voice from the mic.
        if (!isSessionListening(sessionId)) {
          console.log("[media-service/inboundTrack] segment discarded (AI speaking)", {
            sessionId,
            frameCount: finalized.frames.length,
          });
          pushMediaSessionEvent(sessionId, "segment_discarded_ai_speaking", {
            frameCount: finalized.frames.length,
          });
          return;
        }

        console.log("[media-service/inboundTrack] segment window completed", {
          sessionId,
          turnNumber,
          packetCount: finalized.packetCount,
          totalBytes: finalized.totalBytes,
          frameCount: finalized.frames.length,
          completedTurns: finalized.completedTurns,
        });

        // Store the individual raw Opus frames from this turn window.
        // Each frame is one RTP payload (one Opus packet, ~20ms of audio).
        // The OGG Opus container builder in audioPackaging.ts uses these frames.
        const storedAudio = appendTurnAudio(sessionId, {
          turnNumber,
          mimeType: "audio/ogg; codecs=opus",
          frames: finalized.frames,
        });

        const turnWindow = markTurnReady(sessionId, {
          packetCount: finalized.packetCount,
          totalBytes: finalized.totalBytes,
          completedTurns: finalized.completedTurns,
        });
        const processing = queueTurnIfReady(sessionId);
        updateMediaSession(sessionId, {
          inboundTrack: { ...observer },
          segmentation: finalized,
          turnWindow: { ...turnWindow },
          processing: { ...processing },
        });
        pushMediaSessionEvent(sessionId, "segment_window_completed", finalized);
        pushMediaSessionEvent(sessionId, "turn_window_ready", turnWindow);
        pushMediaSessionEvent(sessionId, "turn_audio_stored", {
          turnNumber: storedAudio.turnNumber,
          mimeType: storedAudio.mimeType,
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
