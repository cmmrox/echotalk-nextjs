/**
 * Outbound WebRTC audio track manager.
 *
 * After TTS synthesis, this module:
 *   1. Receives raw Opus frames (from opusFromMp3.ts)
 *   2. Paces them at 20 ms intervals (50 packets/sec)
 *   3. Sends them via the werift RTCRtpSender as RTP packets
 *
 * The browser receives the audio on its remote MediaStream track and plays it
 * automatically via the <audio> element with srcObject = remoteStream.
 */

import { RtpPacket, RtpHeader } from "werift";
import type { RTCRtpSender } from "werift";

import {
  pushMediaSessionEvent,
  updateMediaSession,
} from "@/media-service/sessionManager";

// ---------------------------------------------------------------------------
// Per-session state
// ---------------------------------------------------------------------------

type OutboundState = {
  sender: RTCRtpSender;
  playing: boolean;
  cancelFn?: () => void;
};

declare global {
  var __echotalkOutboundAudioTrack:
    | { bySession: Map<string, OutboundState> }
    | undefined;
}

function getStore() {
  if (!globalThis.__echotalkOutboundAudioTrack) {
    globalThis.__echotalkOutboundAudioTrack = { bySession: new Map() };
  }
  return globalThis.__echotalkOutboundAudioTrack;
}

// ---------------------------------------------------------------------------
// Registration (called from peerManager after addTrack)
// ---------------------------------------------------------------------------

export function registerOutboundSender(
  sessionId: string,
  sender: RTCRtpSender
) {
  getStore().bySession.set(sessionId, { sender, playing: false });
  console.log("[outboundAudioTrack] sender registered", { sessionId });
}

export function getOutboundSender(sessionId: string): RTCRtpSender | null {
  return getStore().bySession.get(sessionId)?.sender ?? null;
}

export function removeOutboundSender(sessionId: string) {
  const state = getStore().bySession.get(sessionId);
  state?.cancelFn?.();
  getStore().bySession.delete(sessionId);
}

export function isOutboundPlaying(sessionId: string): boolean {
  return getStore().bySession.get(sessionId)?.playing ?? false;
}

// ---------------------------------------------------------------------------
// Schedule Opus frames over WebRTC
// ---------------------------------------------------------------------------

const FRAME_DURATION_MS = 20;    // 20 ms per Opus frame
const SAMPLES_PER_FRAME = 960;   // 48 kHz × 20 ms

/**
 * Send Opus frames over the WebRTC RTP sender, paced at 20 ms/frame.
 * Manages turn-taking state on the session while playing.
 *
 * @returns Promise that resolves when all frames have been scheduled
 *          (actual playback continues asynchronously).
 */
export async function scheduleOutboundAudio(
  sessionId: string,
  frames: Buffer[]
): Promise<boolean> {
  if (frames.length === 0) return false;

  const state = getStore().bySession.get(sessionId);
  if (!state?.sender) {
    console.warn("[outboundAudioTrack] no sender for session", { sessionId });
    return false;
  }

  // Cancel any previous in-progress stream.
  state.cancelFn?.();

  let cancelled = false;
  let frameIndex = 0;
  let timestamp = (Math.random() * 0xffffffff) >>> 0; // random start timestamp

  state.playing = true;
  state.cancelFn = () => { cancelled = true; };

  // Mark session as speaking
  updateMediaSession(sessionId, { status: "speaking" });
  pushMediaSessionEvent(sessionId, "outbound_rtc_started", {
    frameCount: frames.length,
    durationSeconds: (frames.length * FRAME_DURATION_MS / 1000).toFixed(2),
  });

  console.log("[outboundAudioTrack] starting playback", {
    sessionId,
    frameCount: frames.length,
    durationSeconds: (frames.length * FRAME_DURATION_MS / 1000).toFixed(2),
  });

  const sender = state.sender;

  return new Promise<boolean>((resolve) => {
    const sendNext = () => {
      if (cancelled) {
        finish();
        return;
      }

      if (frameIndex >= frames.length) {
        finish();
        return;
      }

      const frame = frames[frameIndex];

      // Build minimal RTP header — sender.sendRtp fills ssrc + payloadType
      const header = new RtpHeader();
      header.sequenceNumber = 0;     // overwritten by sender
      header.timestamp = timestamp;
      header.marker = frameIndex === 0; // set marker on first frame of sequence

      const packet = new RtpPacket(header, frame);
      sender.sendRtp(packet).catch(() => {});

      frameIndex++;
      timestamp = (timestamp + SAMPLES_PER_FRAME) >>> 0;

      setTimeout(sendNext, FRAME_DURATION_MS);
    };

    const finish = () => {
      state.playing = false;
      state.cancelFn = undefined;
      cancelled = false;

      updateMediaSession(sessionId, { status: "connected" });
      pushMediaSessionEvent(sessionId, "outbound_rtc_ended", {
        sentFrames: frameIndex,
      });
      console.log("[outboundAudioTrack] playback finished", {
        sessionId,
        sentFrames: frameIndex,
      });
      resolve(true);
    };

    sendNext();
  });
}
