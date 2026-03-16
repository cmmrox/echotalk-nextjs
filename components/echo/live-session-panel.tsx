"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { FullWebRtcClientSession } from "@/lib/webrtc/fullClientSession";
import { VadLoop } from "@/lib/webrtc/vadLoop";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LiveSessionPanelProps = {
  onError?: (message: string | null) => void;
};

type SessionPhase =
  | "idle"
  | "starting"
  | "connected"
  | "capturing"   // user is speaking
  | "processing"  // waiting for STT / agent / TTS
  | "speaking"    // AI audio playing
  | "error";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  language?: string;
  turnNumber?: number;
};

type TelemetrySnapshot = {
  hasInboundTrack: boolean;
  inboundTrack?: {
    kind: string;
    receivedRtpPackets: number;
    receivedBytes: number;
  } | null;
  segmentation?: { packetCount: number; totalBytes: number; completedTurns: number } | null;
  processing?: { queued: boolean; processing: boolean; processedTurns: number } | null;
  latestResult?: {
    turnNumber: number;
    transcript: string;
    detectedLanguage: string;
    replyText: string;
    replyLanguage: string;
    createdAt: string;
  } | null;
  outboundAudio?: {
    ready: boolean;
    turnNumber?: number;
    contentType?: string;
    createdAt?: string;
    /** true = audio delivered via WebRTC track; false/absent = use HTTP fetch */
    rtcMode?: boolean;
  } | null;
  turns?: Array<{ role: string; text: string; language?: string }>;
  events?: Array<{ type: string; at: string; data?: Record<string, unknown> }>;
  eventCount: number;
  turnCount: number;
};

// ---------------------------------------------------------------------------
// Mic level bar
// ---------------------------------------------------------------------------

function MicLevelBar({
  level,
  active,
  muted,
}: {
  level: number;
  active: boolean;
  muted: boolean;
}) {
  // level is 0-127; normalise to 0-100%
  const pct = Math.min(100, Math.round((level / 80) * 100));
  const color =
    !active || muted ? "bg-muted"
    : pct > 75 ? "bg-red-500"
    : pct > 40 ? "bg-yellow-400"
    : pct > 8  ? "bg-green-500"
    : "bg-muted";

  return (
    <div className="flex items-center gap-2">
      <span className={`text-xs w-7 shrink-0 ${muted ? "text-orange-500" : "text-muted-foreground"}`}>
        {muted ? "🔇" : "Mic"}
      </span>
      <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-75 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-xs w-14 text-right shrink-0 ${muted ? "text-orange-500" : "text-muted-foreground"}`}>
        {muted ? "AI speaking" : active ? `${pct}%` : "—"}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Phase label
// ---------------------------------------------------------------------------

function PhaseLabel({ phase }: { phase: SessionPhase }) {
  const map: Record<SessionPhase, { label: string; color: string }> = {
    idle:       { label: "Idle",        color: "text-muted-foreground" },
    starting:   { label: "Connecting…", color: "text-yellow-600 dark:text-yellow-400" },
    connected:  { label: "Listening",   color: "text-green-600 dark:text-green-400" },
    capturing:  { label: "🎙 Speaking…", color: "text-blue-600 dark:text-blue-400" },
    processing: { label: "⏳ Thinking…", color: "text-orange-500" },
    speaking:   { label: "🔊 Speaking…", color: "text-purple-600 dark:text-purple-400" },
    error:      { label: "Error",       color: "text-destructive" },
  };
  const { label, color } = map[phase];
  return <span className={`text-xs font-medium ${color}`}>{label}</span>;
}

// ---------------------------------------------------------------------------
// Chat bubble
// ---------------------------------------------------------------------------

function ChatBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-snug shadow-sm
          ${isUser
            ? "rounded-br-sm bg-blue-600 text-white"
            : "rounded-bl-sm bg-muted text-foreground border"
          }`}
      >
        <p className="whitespace-pre-wrap break-words">{msg.text}</p>
        {msg.language ? (
          <p className={`mt-1 text-[10px] ${isUser ? "text-blue-200" : "text-muted-foreground"}`}>
            {msg.language}
          </p>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function LiveSessionPanel({ onError }: LiveSessionPanelProps) {
  const fullSessionRef       = React.useRef<FullWebRtcClientSession | null>(null);
  const vadRef               = React.useRef<VadLoop | null>(null);
  const audioContextRef      = React.useRef<AudioContext | null>(null);
  const audioRef             = React.useRef<HTMLAudioElement | null>(null);
  const ttsAudioRef          = React.useRef<HTMLAudioElement | null>(null);
  const lastPlayedTurnRef    = React.useRef<number | null>(null);
  const chatEndRef           = React.useRef<HTMLDivElement | null>(null);
  /** Track how many session events we have already scanned for RTC events */
  const lastEventCountRef    = React.useRef<number>(0);

  const [phase, setPhase]           = React.useState<SessionPhase>("idle");
  const [sessionId, setSessionId]   = React.useState<string>("");
  const [micLevel, setMicLevel]     = React.useState<number>(0);
  const [vadMuted, setVadMuted]     = React.useState<boolean>(false);
  const [messages, setMessages]     = React.useState<ChatMessage[]>([]);
  const [telemetry, setTelemetry]   = React.useState<TelemetrySnapshot | null>(null);
  const [showDebug, setShowDebug]   = React.useState(false);
  const [playingTurn, setPlayingTurn] = React.useState<number | null>(null);

  // Scroll to bottom whenever messages change
  React.useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ---------------------------------------------------------------------------
  // Snapshot polling → update messages from server turns
  // ---------------------------------------------------------------------------

  const refreshSnapshot = React.useCallback(async () => {
    const client = fullSessionRef.current;
    if (!client?.id) return;

    try {
      const snapshot = await client.fetchSnapshot();
      setSessionId(snapshot.sessionId ?? "");

      const t = snapshot.telemetry ?? null;
      setTelemetry(t as TelemetrySnapshot | null);

      // Build messages from the server turn list.
      const serverTurns = (t as TelemetrySnapshot | null)?.turns ?? [];
      if (serverTurns.length > 0) {
        setMessages(
          serverTurns.map((turn, idx) => ({
            id: `turn-${idx}`,
            role: turn.role === "user" ? "user" : "assistant",
            text: turn.text,
            language: turn.language,
            turnNumber: idx,
          }))
        );
      }

      // Scan new session events for WebRTC audio lifecycle signals.
      // outbound_rtc_started → mute VAD (AI is about to speak via WebRTC)
      // outbound_rtc_ended   → unmute VAD (AI finished speaking)
      const allEvents = (snapshot as Record<string, unknown>).events;
      if (Array.isArray(allEvents)) {
        const newEvents = allEvents.slice(lastEventCountRef.current);
        lastEventCountRef.current = allEvents.length;

        for (const ev of newEvents as Array<{ type: string }>) {
          if (ev.type === "outbound_rtc_started") {
            vadRef.current?.mute();
            setVadMuted(true);
            setPhase("speaking");
            fetch(
              `/api/media-service/set-listening?sessionId=${client.id}&listening=0`,
              { method: "POST" }
            ).catch(() => {});
          } else if (ev.type === "outbound_rtc_ended") {
            vadRef.current?.unmute();
            setVadMuted(false);
            setPhase((p) => (p === "speaking" ? "connected" : p));
            fetch(
              `/api/media-service/set-listening?sessionId=${client.id}&listening=1`,
              { method: "POST" }
            ).catch(() => {});
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      onError?.(message);
      setPhase("error");
    }
  }, [onError]);

  // ---------------------------------------------------------------------------
  // Turn-taking helpers
  // ---------------------------------------------------------------------------

  /** Tell the server to stop/start accepting new speech turns. */
  const setServerListening = React.useCallback(
    (listening: boolean, sessionIdOverride?: string) => {
      const id = sessionIdOverride ?? fullSessionRef.current?.id;
      if (!id) return;
      fetch(
        `/api/media-service/set-listening?sessionId=${id}&listening=${listening ? 1 : 0}`,
        { method: "POST" }
      ).catch(console.warn);
    },
    []
  );

  // ---------------------------------------------------------------------------
  // Audio playback
  // ---------------------------------------------------------------------------

  const playLatestOutboundAudio = React.useCallback(async () => {
    const client = fullSessionRef.current;
    if (!client?.id) return;

    const snap = telemetry;
    if (!snap?.outboundAudio?.ready) return;

    const turnNumber = snap.outboundAudio.turnNumber ?? null;
    if (!turnNumber || lastPlayedTurnRef.current === turnNumber) return;
    lastPlayedTurnRef.current = turnNumber;

    // ── WebRTC mode: audio is delivered via the remote MediaStream track. ──
    // The browser plays it automatically through audioRef.srcObject.
    // Turn-taking (VAD mute/unmute) is handled by outbound_rtc_started/ended
    // events scanned in refreshSnapshot. Nothing to do here except mark seen.
    if (snap.outboundAudio.rtcMode) {
      console.log("[live-session-panel] RTC audio delivery — remote stream handles playback", {
        sessionId: client.id,
        turnNumber,
      });
      // Mark HTTP endpoint as delivered so it doesn't accumulate stale state.
      fetch(`/api/media-service/outbound/latest?sessionId=${client.id}&markDelivered=1`)
        .catch(() => {});
      return;
    }

    // ── HTTP fallback mode: fetch MP3 and play via AudioContext / <audio>. ──
    setPhase("speaking");
    setPlayingTurn(turnNumber);
    vadRef.current?.mute();
    setVadMuted(true);
    setServerListening(false);

    const onPlaybackDone = () => {
      setPhase("connected");
      setPlayingTurn(null);
      vadRef.current?.unmute();
      setVadMuted(false);
      setServerListening(true);
    };

    try {
      const res = await fetch(
        `/api/media-service/outbound/latest?sessionId=${client.id}&markDelivered=1`
      );
      if (!res.ok) { onPlaybackDone(); return; }

      const arrayBuffer = await res.arrayBuffer();
      if (arrayBuffer.byteLength === 0) { onPlaybackDone(); return; }

      const audioContext = audioContextRef.current;
      if (audioContext) {
        if (audioContext.state === "suspended") await audioContext.resume();
        try {
          const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
          const source  = audioContext.createBufferSource();
          source.buffer = decoded;
          source.connect(audioContext.destination);
          source.onended = onPlaybackDone;
          source.start(0);
          console.log("[live-session-panel] HTTP audio playback started", {
            sessionId: client.id,
            turnNumber,
            duration: decoded.duration.toFixed(2) + "s",
          });
          return;
        } catch (err) {
          console.warn("[live-session-panel] AudioContext decode failed, trying <audio>", err);
        }
      }

      // Fallback: HTMLAudioElement
      const contentType = snap.outboundAudio.contentType ?? "audio/mpeg";
      const blob = new Blob([arrayBuffer], { type: contentType });
      const url  = URL.createObjectURL(blob);
      if (ttsAudioRef.current) {
        ttsAudioRef.current.src = url;
        ttsAudioRef.current.onended = () => { URL.revokeObjectURL(url); onPlaybackDone(); };
        await ttsAudioRef.current.play().catch(() => { URL.revokeObjectURL(url); onPlaybackDone(); });
      } else {
        onPlaybackDone();
      }
    } catch {
      onPlaybackDone();
    }
  }, [telemetry, setServerListening]);

  // ---------------------------------------------------------------------------
  // Polling interval
  // ---------------------------------------------------------------------------

  React.useEffect(() => {
    if (!sessionId || !fullSessionRef.current) return;

    const interval = window.setInterval(() => {
      void refreshSnapshot();
      void playLatestOutboundAudio();
    }, 500);

    return () => window.clearInterval(interval);
  }, [playLatestOutboundAudio, refreshSnapshot, sessionId]);

  // ---------------------------------------------------------------------------
  // Start / Stop
  // ---------------------------------------------------------------------------

  async function start() {
    onError?.(null);
    setPhase("starting");
    setMessages([]);
    lastPlayedTurnRef.current = null;
    lastEventCountRef.current = 0;

    try {
      const fullClient = new FullWebRtcClientSession();
      fullSessionRef.current = fullClient;

      const session = await fullClient.connect();
      setSessionId(session.sessionId);

      const remoteStream = fullClient.getRemoteStream();
      if (audioRef.current && remoteStream) {
        audioRef.current.srcObject = remoteStream;
        audioRef.current.autoplay = true;
      }

      const localStream = fullClient.getLocalStream();
      if (!localStream) throw new Error("Local media stream not available");

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      vadRef.current = new VadLoop(audioContext, localStream, {
        onVolumeChange: (level) => setMicLevel(level),
        onSpeechStart: () => setPhase("capturing"),
        onSpeechEnd: () => {
          setPhase("processing");
          fetch(`/api/media-service/trigger-turn?sessionId=${session.sessionId}`, {
            method: "POST",
          })
            .then((r) => r.json())
            .then((data) => {
              console.log("[live-session-panel] trigger-turn", data);
            })
            .catch(console.warn)
            .finally(() => {
              // Return to listening unless audio is already playing
              setPhase((prev) => prev === "processing" ? "connected" : prev);
            });
        },
      });
      vadRef.current.start();

      setPhase("connected");
      await refreshSnapshot();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      onError?.(message);
      setPhase("error");
    }
  }

  async function stop() {
    vadRef.current?.stop();
    vadRef.current = null;
    setMicLevel(0);
    setVadMuted(false);
    lastEventCountRef.current = 0;
    await audioContextRef.current?.close().catch(() => undefined);
    audioContextRef.current = null;
    await fullSessionRef.current?.stop();
    fullSessionRef.current = null;
    setSessionId("");
    setTelemetry(null);
    setPlayingTurn(null);
    lastPlayedTurnRef.current = null;
    if (audioRef.current) audioRef.current.srcObject = null;
    setPhase("idle");
  }

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      vadRef.current?.stop();
      void audioContextRef.current?.close().catch(() => undefined);
      void fullSessionRef.current?.stop();
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const isActive = phase !== "idle" && phase !== "error";

  return (
    <div className="w-full flex flex-col gap-3">
      {/* ── Header row ── */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Live Conversation</p>
          {sessionId ? (
            <p className="text-[10px] text-muted-foreground font-mono truncate max-w-[220px]">
              {sessionId}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <PhaseLabel phase={phase} />
          {isActive ? (
            <Button size="sm" variant="destructive" onClick={stop}>
              Stop
            </Button>
          ) : (
            <Button size="sm" onClick={start}>
              Start Conversation
            </Button>
          )}
        </div>
      </div>

      {/* ── Mic level meter (only when active) ── */}
      {isActive ? (
        <MicLevelBar level={micLevel} active={isActive} muted={vadMuted} />
      ) : null}

      {/* ── Chat transcript ── */}
      {messages.length > 0 ? (
        <div className="flex flex-col gap-2 max-h-80 overflow-y-auto rounded-xl border bg-card p-3">
          {messages.map((msg) => (
            <ChatBubble key={msg.id} msg={msg} />
          ))}
          {/* Show a "processing" placeholder while waiting */}
          {phase === "processing" ? (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-sm bg-muted border px-3.5 py-2 text-sm text-muted-foreground animate-pulse">
                Thinking…
              </div>
            </div>
          ) : null}
          {playingTurn ? (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-sm bg-purple-100 dark:bg-purple-900/30 border px-3.5 py-2 text-xs text-purple-700 dark:text-purple-300">
                🔊 Speaking (turn {playingTurn})…
              </div>
            </div>
          ) : null}
          <div ref={chatEndRef} />
        </div>
      ) : isActive ? (
        <div className="rounded-xl border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
          Speak clearly into your microphone.<br />
          <span className="text-xs">The mic bar above should move when you speak.</span>
        </div>
      ) : null}

      {/* ── Hidden audio elements ── */}
      <audio ref={audioRef} hidden />
      <audio ref={ttsAudioRef} hidden />

      {/* ── Debug section (collapsed) ── */}
      {isActive || messages.length > 0 ? (
        <div>
          <button
            type="button"
            className="text-[10px] text-muted-foreground underline underline-offset-2"
            onClick={() => setShowDebug((v) => !v)}
          >
            {showDebug ? "Hide debug" : "Show debug"}
          </button>
          {showDebug && telemetry ? (
            <div className="mt-2 rounded-md border bg-muted/20 p-2 text-[10px] text-muted-foreground space-y-0.5 font-mono">
              <p>Track: {telemetry.hasInboundTrack ? "✅" : "❌"} | RTP: {telemetry.inboundTrack?.receivedRtpPackets ?? 0} pkts</p>
              <p>Turns completed: {telemetry.segmentation?.completedTurns ?? 0} | Processed: {telemetry.processing?.processedTurns ?? 0}</p>
              <p>Processing: {telemetry.processing?.processing ? "yes" : "no"} | Queued: {telemetry.processing?.queued ? "yes" : "no"}</p>
              {telemetry.latestResult ? (
                <>
                  <p>Last STT: &quot;{telemetry.latestResult.transcript.slice(0, 60)}&quot;</p>
                  <p>Last reply ({telemetry.latestResult.replyLanguage}): &quot;{telemetry.latestResult.replyText.slice(0, 60)}&quot;</p>
                </>
              ) : null}
              {telemetry.outboundAudio?.ready ? (
                <p>Audio: turn {telemetry.outboundAudio.turnNumber} · {telemetry.outboundAudio.rtcMode ? "🔵 WebRTC" : "🟡 HTTP"}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
