"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { FullWebRtcClientSession } from "@/lib/webrtc/fullClientSession";
import { VadLoop } from "@/lib/webrtc/vadLoop";

type LiveSessionPanelProps = {
  onError?: (message: string | null) => void;
};

type SessionViewState =
  | "idle"
  | "starting"
  | "signaling"
  | "connected"
  | "polling"
  | "capturing"
  | "processing"
  | "error";

export function LiveSessionPanel({ onError }: LiveSessionPanelProps) {
  const fullSessionRef = React.useRef<FullWebRtcClientSession | null>(null);
  const vadRef = React.useRef<VadLoop | null>(null);
  const audioContextRef = React.useRef<AudioContext | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const ttsAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const lastPlayedTurnRef = React.useRef<number | null>(null);
  const [state, setState] = React.useState<SessionViewState>("idle");
  const [sessionId, setSessionId] = React.useState<string>("");
  const [events, setEvents] = React.useState<
    Array<{ type: string; at: string; data?: Record<string, unknown> }>
  >([]);
  const [telemetry, setTelemetry] = React.useState<{
    hasInboundTrack: boolean;
    inboundTrack?: {
      kind: string;
      id: string;
      remote: boolean;
      muted: boolean;
      receivedRtpPackets: number;
      receivedBytes: number;
      lastPacketAt?: string;
    } | null;
    segmentation?: {
      packetCount: number;
      totalBytes: number;
      payloadCount?: number;
      startedAt?: string;
      lastPacketAt?: string;
      completedTurns: number;
    } | null;
    turnWindow?: {
      ready: boolean;
      packetCount: number;
      totalBytes: number;
      completedTurns: number;
      lastReadyAt?: string;
    } | null;
    processing?: {
      queued: boolean;
      processing: boolean;
      processedTurns: number;
      lastQueuedAt?: string;
      lastProcessedAt?: string;
    } | null;
    latestResult?: {
      turnNumber: number;
      transcript: string;
      detectedLanguage: string;
      replyText: string;
      replyLanguage: string;
      createdAt: string;
    } | null;
    latestTts?: {
      turnNumber: number;
      contentType: string;
      createdAt: string;
    } | null;
    outboundAudio?: {
      ready: boolean;
      turnNumber?: number;
      contentType?: string;
      createdAt?: string;
      delivered?: boolean;
      deliveredAt?: string;
    } | null;
    eventCount: number;
    turnCount: number;
  } | null>(null);

  const refreshSnapshot = React.useCallback(async () => {
    const client = fullSessionRef.current;
    if (!client?.id) return;

    try {
      const snapshot = await client.fetchSnapshot();
      setSessionId(snapshot.sessionId ?? "");
      setTelemetry(snapshot.telemetry ?? null);
      setEvents(
        (snapshot.events ?? []).map((event) => ({
          type: event.type,
          at: event.at,
          data: event.data,
        }))
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      onError?.(message);
      setState("error");
    }
  }, [onError]);

  const playLatestOutboundAudio = React.useCallback(async () => {
    const client = fullSessionRef.current;
    if (!client?.id) return;
    if (!telemetry?.outboundAudio?.ready) return;

    const turnNumber = telemetry.outboundAudio.turnNumber ?? null;
    if (!turnNumber || lastPlayedTurnRef.current === turnNumber) return;

    // Mark early to prevent duplicate play attempts while this async fn is in flight.
    lastPlayedTurnRef.current = turnNumber;

    console.log("[live-session-panel] outbound audio fetch", {
      sessionId: client.id,
      turnNumber,
    });

    try {
      const res = await fetch(
        `/api/media-service/outbound/latest?sessionId=${client.id}&markDelivered=1`
      );
      if (!res.ok) {
        console.warn("[live-session-panel] outbound fetch failed", {
          sessionId: client.id,
          turnNumber,
          status: res.status,
        });
        return;
      }

      const arrayBuffer = await res.arrayBuffer();
      const contentType =
        telemetry.outboundAudio.contentType ?? "audio/mpeg";

      console.log("[live-session-panel] outbound audio received", {
        sessionId: client.id,
        turnNumber,
        bytes: arrayBuffer.byteLength,
        contentType,
      });

      // Prefer AudioContext playback — it is immune to browser autoplay restrictions
      // once the AudioContext was created after a user gesture (Start button click).
      const audioContext = audioContextRef.current;
      if (audioContext && arrayBuffer.byteLength > 0) {
        try {
          // Resume in case the browser suspended the context.
          if (audioContext.state === "suspended") {
            await audioContext.resume();
          }
          const decoded = await audioContext.decodeAudioData(
            arrayBuffer.slice(0) // slice to avoid detached buffer issues
          );
          const source = audioContext.createBufferSource();
          source.buffer = decoded;
          source.connect(audioContext.destination);
          source.start(0);
          console.log("[live-session-panel] AudioContext playback started", {
            sessionId: client.id,
            turnNumber,
            duration: decoded.duration.toFixed(2) + "s",
          });
          return;
        } catch (acErr) {
          console.warn(
            "[live-session-panel] AudioContext decode failed, falling back to <audio>",
            acErr
          );
        }
      }

      // Fallback: HTMLAudioElement (may be blocked by autoplay policy).
      const blob = new Blob([arrayBuffer], { type: contentType });
      const url = URL.createObjectURL(blob);
      if (ttsAudioRef.current) {
        ttsAudioRef.current.src = url;
        ttsAudioRef.current.onended = () => {
          URL.revokeObjectURL(url);
          console.log("[live-session-panel] <audio> playback ended", {
            sessionId: client.id,
            turnNumber,
          });
        };
        await ttsAudioRef.current.play().catch((playErr) => {
          console.warn("[live-session-panel] <audio>.play() failed", {
            sessionId: client.id,
            turnNumber,
            error: String(playErr),
          });
          URL.revokeObjectURL(url);
        });
      }
    } catch (err) {
      console.warn("[live-session-panel] playLatestOutboundAudio error", {
        sessionId: client.id,
        turnNumber,
        error: String(err),
      });
    }
  }, [telemetry]);

  async function start() {
    onError?.(null);
    setState("starting");

    try {
      const fullClient = new FullWebRtcClientSession();
      fullSessionRef.current = fullClient;

      const session = await fullClient.connect();
      console.log("[live-session-panel] full session connected", {
        sessionId: session.sessionId,
      });
      setSessionId(session.sessionId);
      setState("signaling");

      const remoteStream = fullClient.getRemoteStream();
      if (audioRef.current && remoteStream) {
        audioRef.current.srcObject = remoteStream;
        audioRef.current.autoplay = true;
        audioRef.current.playsInline = true;
      }

      const localStream = fullClient.getLocalStream();
      if (!localStream) {
        throw new Error("Local media stream is not available");
      }

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      // Full media-service mode: use VAD to trigger server-side turn processing
      // the moment the user stops speaking — instead of waiting for the fixed
      // 300-packet (~6s) time window. This cuts response latency dramatically.
      vadRef.current = new VadLoop(audioContext, localStream, {
        onSpeechStart: () => {
          console.log("[live-session-panel] local speech detected start", {
            sessionId: session.sessionId,
          });
          setState("capturing");
        },
        onSpeechEnd: () => {
          console.log("[live-session-panel] local speech detected end", {
            sessionId: session.sessionId,
          });
          setState("processing");

          // Trigger server-side STT immediately now that the user has stopped.
          fetch(
            `/api/media-service/trigger-turn?sessionId=${session.sessionId}`,
            { method: "POST" }
          )
            .then((r) => r.json())
            .then((data) => {
              console.log("[live-session-panel] trigger-turn response", data);
            })
            .catch((err) => {
              console.warn("[live-session-panel] trigger-turn failed", err);
            })
            .finally(() => {
              setState("connected");
            });
        },
      });
      vadRef.current.start();

      setState("connected");
      await refreshSnapshot();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      onError?.(message);
      setState("error");
    }
  }

  async function stop() {
    try {
      setState("idle");
      vadRef.current?.stop();
      vadRef.current = null;
      await audioContextRef.current?.close().catch(() => undefined);
      audioContextRef.current = null;
      await fullSessionRef.current?.stop();
      fullSessionRef.current = null;
      setSessionId("");
      setEvents([]);
      setTelemetry(null);
      lastPlayedTurnRef.current = null;
      if (audioRef.current) {
        audioRef.current.srcObject = null;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      onError?.(message);
      setState("error");
    }
  }

  React.useEffect(() => {
    if (!sessionId || !fullSessionRef.current) return;

    const interval = window.setInterval(() => {
      void refreshSnapshot();
      void playLatestOutboundAudio();
    }, 500);

    return () => {
      window.clearInterval(interval);
    };
  }, [playLatestOutboundAudio, refreshSnapshot, sessionId]);

  React.useEffect(() => {
    return () => {
      vadRef.current?.stop();
      void audioContextRef.current?.close().catch(() => undefined);
      void fullSessionRef.current?.stop();
    };
  }, []);

  const isActive = state !== "idle" && state !== "error";

  return (
    <div className="w-full rounded-md border p-3 text-sm">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-medium">Live WebRTC Session</p>
            <p className="text-xs text-muted-foreground">
              UI status: <span className="font-medium">{state}</span>
            </p>
            {sessionId ? (
              <p className="text-xs text-muted-foreground break-all">
                Session ID: {sessionId}
              </p>
            ) : null}
          </div>

          {isActive ? (
            <Button onClick={stop} variant="destructive">
              Stop Conversation
            </Button>
          ) : (
            <Button onClick={start}>Start Conversation</Button>
          )}
        </div>

        <audio ref={audioRef} hidden />
        <audio ref={ttsAudioRef} hidden />

        {telemetry ? (
          <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
            <p className="font-medium">Media service telemetry</p>
            <p className="mt-1">
              Inbound track attached: {telemetry.hasInboundTrack ? "yes" : "no"}
            </p>
            <p>Event count: {telemetry.eventCount}</p>
            <p>Turn count: {telemetry.turnCount}</p>
            {telemetry.inboundTrack ? (
              <div className="mt-2 space-y-1">
                <p>Track kind: {telemetry.inboundTrack.kind}</p>
                <p>Track id: {telemetry.inboundTrack.id}</p>
                <p>RTP packets: {telemetry.inboundTrack.receivedRtpPackets}</p>
                <p>RTP bytes: {telemetry.inboundTrack.receivedBytes}</p>
              </div>
            ) : null}
            {telemetry.segmentation ? (
              <div className="mt-2 space-y-1">
                <p>Segment packets: {telemetry.segmentation.packetCount}</p>
                <p>Segment bytes: {telemetry.segmentation.totalBytes}</p>
                <p>Completed windows: {telemetry.segmentation.completedTurns}</p>
                <p>Payload packets: {telemetry.segmentation.payloadCount ?? 0}</p>
              </div>
            ) : null}
            {telemetry.turnWindow ? (
              <div className="mt-2 space-y-1">
                <p>Turn ready: {telemetry.turnWindow.ready ? "yes" : "no"}</p>
                <p>Turn packets: {telemetry.turnWindow.packetCount}</p>
                <p>Turn bytes: {telemetry.turnWindow.totalBytes}</p>
              </div>
            ) : null}
            {telemetry.processing ? (
              <div className="mt-2 space-y-1">
                <p>Queued: {telemetry.processing.queued ? "yes" : "no"}</p>
                <p>Processing: {telemetry.processing.processing ? "yes" : "no"}</p>
                <p>Processed turns: {telemetry.processing.processedTurns}</p>
              </div>
            ) : null}
            {telemetry.latestResult ? (
              <div className="mt-2 space-y-1">
                <p>Latest result turn: {telemetry.latestResult.turnNumber}</p>
                <p>Latest transcript: {telemetry.latestResult.transcript}</p>
                <p>Latest reply: {telemetry.latestResult.replyText}</p>
              </div>
            ) : null}
            {telemetry.latestTts ? (
              <div className="mt-2 space-y-1">
                <p>Latest TTS turn: {telemetry.latestTts.turnNumber}</p>
                <p>TTS content type: {telemetry.latestTts.contentType}</p>
              </div>
            ) : null}
            {telemetry.outboundAudio ? (
              <div className="mt-2 space-y-1">
                <p>Outbound audio ready: {telemetry.outboundAudio.ready ? "yes" : "no"}</p>
                <p>Outbound turn: {telemetry.outboundAudio.turnNumber ?? "-"}</p>
                <p>Outbound type: {telemetry.outboundAudio.contentType ?? "-"}</p>
              </div>
            ) : null}
          </div>
        ) : null}

        {events.length ? (
          <div className="rounded-md border bg-muted/20 p-3">
            <p className="text-xs font-medium text-muted-foreground">
              Session events
            </p>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {events.slice(-8).reverse().map((event, index) => (
                <li key={`${event.at}-${event.type}-${index}`}>
                  <span className="font-medium">{event.type}</span> ·{" "}
                  {new Date(event.at).toLocaleTimeString()}
                  {event.data ? (
                    <span className="block opacity-80">
                      {JSON.stringify(event.data)}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            No live events yet. Start a session to initialize WebRTC signaling and watch server events here.
          </p>
        )}
      </div>
    </div>
  );
}
