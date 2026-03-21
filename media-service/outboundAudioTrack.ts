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

import { getInterruptionState } from "@/media-service/interruptions";
import { markTurnMetric } from "@/media-service/metrics";
import {
  pushMediaSessionEvent,
  setConversationState,
  updateMediaSession,
} from "@/media-service/sessionManager";
import { setSessionListening } from "@/media-service/listeningState";

// ---------------------------------------------------------------------------
// Per-session state
// ---------------------------------------------------------------------------

import { getMediaServiceStore } from "@/media-service/store";

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
  const turnNumber = getMediaServiceStore().sessions.get(sessionId)?.outboundAudio?.turnNumber ?? null;

  pushMediaSessionEvent(sessionId, "outbound_rtc_started", {
    turnNumber,
    frameCount: frames.length,
    durationSeconds: (frames.length * FRAME_DURATION_MS / 1000).toFixed(2),
  });
  if (typeof turnNumber === "number") {
    markTurnMetric(sessionId, turnNumber, {
      playbackStartedAt: new Date().toISOString(),
      playbackMode: "rtc",
    });
  }

  console.log("[outboundAudioTrack] starting playback", {
    sessionId,
    frameCount: frames.length,
    durationSeconds: (frames.length * FRAME_DURATION_MS / 1000).toFixed(2),
  });

  const sender = state.sender;
  const peerBundle = getMediaServiceStore().peers.get(sessionId);
  const localTrack = peerBundle?.localAudioTrack;

  // Inspect sender internals to diagnose silent sendRtp no-ops.
  const senderAny = sender as unknown as {
    codec?: { mimeType?: string; payloadType?: number };
    ssrc?: number;
    dtlsTransport?: { state?: string };
    sendParameters?: { encodings?: unknown[] };
  };
  const codecInfo  = senderAny.codec;
  const ssrcInfo   = senderAny.ssrc;
  const dtlsState  = senderAny.dtlsTransport?.state ?? "unknown";
  console.log("[outboundAudioTrack] sender diagnostics at playback start", {
    sessionId,
    codec:     codecInfo ? `${codecInfo.mimeType} pt=${codecInfo.payloadType}` : "NOT SET ⚠️",
    ssrc:      ssrcInfo  ?? "unknown",
    dtlsState,
    hasLocalTrack: Boolean(localTrack),
  });
  if (dtlsState !== "connected") {
    // Bug 4 fix: poll DTLS state every 100ms for up to 3000ms instead of a
    // blind 200ms sleep, which was too short for slow ICE convergence.
    console.warn("[outboundAudioTrack] DTLS not connected — polling for up to 3s", { dtlsState });
    const POLL_INTERVAL_MS = 100;
    const POLL_MAX_MS = 3000;
    let waited = 0;
    while (senderAny.dtlsTransport?.state !== "connected" && waited < POLL_MAX_MS) {
      await new Promise<void>((r) => setTimeout(r, POLL_INTERVAL_MS));
      waited += POLL_INTERVAL_MS;
    }
    const finalDtlsState = senderAny.dtlsTransport?.state ?? "unknown";
    if (finalDtlsState !== "connected") {
      console.error("[outboundAudioTrack] DTLS still not connected after 3s — aborting playback", {
        sessionId,
        finalDtlsState,
      });
      pushMediaSessionEvent(sessionId, "outbound_rtc_dtls_timeout", { finalDtlsState });
      return false;
    }
    console.log("[outboundAudioTrack] DTLS connected after polling", { sessionId, waited });
  }

  return new Promise<boolean>((resolve) => {
    const sendNext = () => {
      const interruption = getInterruptionState(sessionId);
      if (interruption.active) {
        cancelled = true;
        pushMediaSessionEvent(sessionId, "outbound_rtc_interrupted", {
          frameIndex,
          interruption,
        });
        setConversationState(sessionId, "recovering", {
          source: "outbound_audio",
          frameIndex,
          interruption,
        });
      } else if (interruption.candidate) {
        pushMediaSessionEvent(sessionId, "outbound_rtc_interruption_candidate", {
          frameIndex,
          interruption,
        });
        setConversationState(sessionId, "interruption_candidate", {
          source: "outbound_audio",
          frameIndex,
          interruption,
        });
      }

      if (cancelled) {
        finish();
        return;
      }

      if (frameIndex >= frames.length) {
        finish();
        return;
      }

      const frame = frames[frameIndex];

      // Build RTP packet and feed it into the local werift MediaStreamTrack.
      // That lets werift's normal sender pipeline stamp/send the packet instead
      // of bypassing the track with sender.sendRtp(), which appears to negotiate
      // successfully but can still yield silent playback in the browser.
      const header = new RtpHeader();
      header.sequenceNumber = frameIndex & 0xffff;
      header.timestamp = timestamp;
      header.marker = frameIndex === 0;
      header.payloadType = codecInfo?.payloadType ?? 111;
      if (typeof ssrcInfo === "number") {
        header.ssrc = ssrcInfo;
      }

      const packet = new RtpPacket(header, frame);

      try {
        if (localTrack?.writeRtp) {
          localTrack.writeRtp(packet);
        } else {
          sender.sendRtp(packet).catch(() => {});
        }
      } catch {
        sender.sendRtp(packet).catch(() => {});
      }

      frameIndex++;
      timestamp = (timestamp + SAMPLES_PER_FRAME) >>> 0;

      setTimeout(sendNext, FRAME_DURATION_MS);
    };

    const finish = () => {
      state.playing = false;
      state.cancelFn = undefined;
      cancelled = false;

      // Bug 1 fix: re-open the server-side listening gate now that the AI has
      // finished speaking over WebRTC. This is the authoritative signal for the
      // WebRTC path (the 8s safety-net timeout in processingQueue.ts fires later
      // as a backup for the HTTP-only path).
      setSessionListening(sessionId, true);
      console.log("[outboundAudioTrack] listening gate reopened (playback finished)", {
        sessionId,
        sentFrames: frameIndex,
      });

      updateMediaSession(sessionId, { status: "connected" });
      if (typeof turnNumber === "number") {
        markTurnMetric(sessionId, turnNumber, {
          playbackFinishedAt: new Date().toISOString(),
          playbackMode: "rtc",
        });
      }
      pushMediaSessionEvent(sessionId, "outbound_rtc_ended", {
        turnNumber,
        sentFrames: frameIndex,
      });
      pushMediaSessionEvent(sessionId, "listening_gate_reopened_rtc", { sentFrames: frameIndex });
      console.log("[outboundAudioTrack] playback finished", {
        sessionId,
        sentFrames: frameIndex,
      });
      resolve(true);
    };

    sendNext();
  });
}
