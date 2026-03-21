"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { FullWebRtcClientSession } from "@/lib/webrtc/fullClientSession";
import type { MicVAD } from "@ricky0123/vad-web";
import { encodeWav } from "@/lib/audio/encodeWav";

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
  | "pausing"     // user paused — waiting 2.5s before finalising turn
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
    idle:       { label: "Idle",                    color: "text-muted-foreground" },
    starting:   { label: "Connecting…",             color: "text-yellow-600 dark:text-yellow-400" },
    connected:  { label: "Listening",               color: "text-green-600 dark:text-green-400" },
    capturing:  { label: "🎙 Speaking…",            color: "text-blue-600 dark:text-blue-400" },
    pausing:    { label: "⏸ Continue or wait…",    color: "text-blue-400 dark:text-blue-300" },
    processing: { label: "⏳ Thinking…",            color: "text-orange-500" },
    speaking:   { label: "🔊 Speaking…",            color: "text-purple-600 dark:text-purple-400" },
    error:      { label: "Error",                   color: "text-destructive" },
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
  const vadRef               = React.useRef<MicVAD | null>(null);
  /** True while AI audio is playing — Silero VAD callbacks should be ignored. */
  const aiSpeakingRef        = React.useRef<boolean>(false);
  const audioContextRef      = React.useRef<AudioContext | null>(null);
  /** Dedicated playback context for the remote WebRTC stream — kept separate
   *  from audioContextRef (VAD mic context) to prevent Chrome suppressing
   *  output when both mic and remote stream share the same AudioContext. */
  const playbackContextRef   = React.useRef<AudioContext | null>(null);
  const audioRef             = React.useRef<HTMLAudioElement | null>(null);
  const ttsAudioRef          = React.useRef<HTMLAudioElement | null>(null);
  const lastPlayedTurnRef    = React.useRef<number | null>(null);
  const rtcFallbackTriedRef  = React.useRef<Set<number>>(new Set());
  const rtcStartedTurnsRef   = React.useRef<Set<number>>(new Set());
  const rtcRemoteLiveRef     = React.useRef<boolean>(false);
  const chatEndRef           = React.useRef<HTMLDivElement | null>(null);
  /** Track how many session events we have already scanned for RTC events */
  const lastEventCountRef    = React.useRef<number>(0);
  // (triggerTimerRef and isContinuationRef removed — Silero VAD handles segmentation natively)

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
            const startedTurn = Number(
              (ev as { data?: { turnNumber?: number } }).data?.turnNumber ??
              (t as TelemetrySnapshot | null)?.outboundAudio?.turnNumber ??
              -1
            );
            if (startedTurn > 0 && rtcRemoteLiveRef.current) {
              rtcStartedTurnsRef.current.add(startedTurn);
            }
            aiSpeakingRef.current = true;
            vadRef.current?.pause();
            setVadMuted(true);
            setPhase("speaking");
            fetch(
              `/api/media-service/set-listening?sessionId=${client.id}&listening=0`,
              { method: "POST" }
            ).catch(() => {});
          } else if (ev.type === "outbound_rtc_ended") {
            aiSpeakingRef.current = false;
            vadRef.current?.start();
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
    // In practice this path is still flaky in some browsers/environments.
    // So we give RTC a short head start, then automatically fall back to the
    // stored HTTP audio once per turn if the user still isn't hearing anything.
    if (snap.outboundAudio.rtcMode) {
      // Once the remote RTC track is alive for this session, trust it and do
      // not trigger HTTP fallback at all — otherwise we can double-play the
      // first reply while the browser is still attaching/unmuting the track.
      if (rtcRemoteLiveRef.current) {
        console.log("[live-session-panel] RTC remote track live; suppressing HTTP fallback", {
          sessionId: client.id,
          turnNumber,
        });
        return;
      }

      if (!rtcFallbackTriedRef.current.has(turnNumber)) {
        rtcFallbackTriedRef.current.add(turnNumber);
        console.log("[live-session-panel] RTC audio delivery detected; monitoring before fallback", {
          sessionId: client.id,
          turnNumber,
        });
        const fallbackDelayMs = 2800;
        window.setTimeout(() => {
          const latestTurn = fullSessionRef.current?.id === client.id
            ? telemetry?.outboundAudio?.turnNumber ?? null
            : null;
          if (latestTurn !== turnNumber) return;

          if (rtcRemoteLiveRef.current || rtcStartedTurnsRef.current.has(turnNumber)) {
            console.log("[live-session-panel] RTC became live in time; skipping HTTP fallback", {
              sessionId: client.id,
              turnNumber,
            });
            return;
          }

          console.log("[live-session-panel] RTC still not live → fetching HTTP audio", {
            sessionId: client.id,
            turnNumber,
          });
          lastPlayedTurnRef.current = turnNumber - 1;
          void playLatestOutboundAudio();
        }, fallbackDelayMs);
      }
      return;
    }

    // ── HTTP fallback mode: fetch MP3 and play via AudioContext / <audio>. ──
    setPhase("speaking");
    setPlayingTurn(turnNumber);
    aiSpeakingRef.current = true;
    vadRef.current?.pause();
    setVadMuted(true);
    setServerListening(false);

    const onPlaybackDone = () => {
      setPhase("connected");
      setPlayingTurn(null);
      aiSpeakingRef.current = false;
      vadRef.current?.start();
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
    rtcFallbackTriedRef.current.clear();
    rtcStartedTurnsRef.current.clear();
    rtcRemoteLiveRef.current = false;
    lastEventCountRef.current = 0;

    try {
      // ── Create AudioContexts FIRST, inside user-gesture context. ──
      // Two separate contexts: one for VAD (mic analysis), one for remote
      // stream playback. Keeping them separate prevents Chrome from treating
      // the remote audio as "echo" and suppressing it.
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const playbackContext = new AudioContext();
      playbackContextRef.current = playbackContext;

      const fullClient = new FullWebRtcClientSession();
      fullSessionRef.current = fullClient;

      const session = await fullClient.connect();
      setSessionId(session.sessionId);

      // ── Pipe remote WebRTC stream through AudioContext (not <audio> element). ──
      const remoteStream = fullClient.getRemoteStream();

      /** Report browser-side events back to the server log for diagnostics. */
      const reportBrowserEvent = (type: string, data: Record<string, unknown> = {}) => {
        fetch("/api/media-service/client-event", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId: session.sessionId, type, ...data }),
        }).catch(() => {});
      };

      reportBrowserEvent("start", {
        vadContextState: audioContext.state,
        playbackContextState: playbackContext.state,
        hasRemoteStream: !!remoteStream,
        remoteAudioTracks: remoteStream?.getAudioTracks().length ?? 0,
      });

      if (remoteStream) {
        let audioSourceNode: MediaStreamAudioSourceNode | null = null;

        const connectRemoteToAudioContext = (reason: string) => {
          // Use the dedicated playback context (not the VAD/mic context).
          const ctx = playbackContextRef.current;
          if (!ctx) return;
          if (ctx.state === "suspended") ctx.resume().catch(() => {});

          const tracks = remoteStream.getAudioTracks();
          reportBrowserEvent("connect-attempt", {
            reason,
            playbackCtxState: ctx.state,
            audioTracks: tracks.length,
            trackStates: tracks.map((t) => ({ id: t.id, enabled: t.enabled, muted: t.muted, readyState: t.readyState })),
          });

          if (tracks.length === 0) {
            reportBrowserEvent("connect-skip", { reason: "no audio tracks yet" });
            return;
          }

          // Attach mute/unmute watchers to each track (first time only).
          tracks.forEach((t) => {
            if (!(t as MediaStreamTrack & { _echoWatched?: boolean })._echoWatched) {
              (t as MediaStreamTrack & { _echoWatched?: boolean })._echoWatched = true;
              t.onunmute = () => {
                rtcRemoteLiveRef.current = true;
                const currentTurn = fullSessionRef.current
                  ? (telemetry?.outboundAudio?.turnNumber ?? null)
                  : null;
                if (currentTurn) {
                  rtcStartedTurnsRef.current.add(currentTurn);
                }
                reportBrowserEvent("track-unmuted", { kind: t.kind, id: t.id, currentTurn });
                // Reconnect playback AudioContext with now-live track.
                connectRemoteToAudioContext("unmute");
              };
              t.onmute = () => reportBrowserEvent("track-muted", { kind: t.kind });
            }
          });

          // Disconnect old source if any before reconnecting
          try { audioSourceNode?.disconnect(); } catch { /* ignore */ }

          try {
            audioSourceNode = ctx.createMediaStreamSource(remoteStream);
            // GainNode at 1.0 ensures volume is never zeroed by the context graph.
            const gain = ctx.createGain();
            gain.gain.value = 1.0;
            audioSourceNode.connect(gain);
            gain.connect(ctx.destination);
            reportBrowserEvent("connect-ok", { playbackCtxState: ctx.state });
          } catch (err) {
            reportBrowserEvent("connect-error", { error: String(err) });
          }
        };

        // Connect now (may be empty, addtrack listener handles late arrivals).
        connectRemoteToAudioContext("initial");

        // Reconnect when server's audio track arrives via WebRTC ontrack.
        remoteStream.addEventListener("addtrack", (ev) => {
          const track = (ev as MediaStreamTrackEvent).track;
          reportBrowserEvent("addtrack", { kind: track?.kind, id: track?.id, muted: track?.muted });
          connectRemoteToAudioContext("addtrack");

          // Watch for the track to unmute (= RTP packets arriving from server).
          if (track) {
            track.onunmute = () => {
              rtcRemoteLiveRef.current = true;
              const currentTurn = fullSessionRef.current
                ? (telemetry?.outboundAudio?.turnNumber ?? null)
                : null;
              if (currentTurn) {
                rtcStartedTurnsRef.current.add(currentTurn);
              }
              reportBrowserEvent("track-unmuted", { kind: track.kind, id: track.id, currentTurn });
              connectRemoteToAudioContext("unmute");
            };
            track.onmute = () => {
              reportBrowserEvent("track-muted", { kind: track.kind, id: track.id });
            };
          }
        });

        // Keep the hidden <audio> element detached for RTC playback.
        // We use only the AudioContext graph as the single playback path to
        // avoid double-playing the same remote stream through two outputs.
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.srcObject = null;
          audioRef.current.muted = true;
          reportBrowserEvent("audio-el-detached-for-rtc", {});
        }
      }

      const localStream = fullClient.getLocalStream();
      if (!localStream) throw new Error("Local media stream not available");

      // ── Silero VAD (ML-based, replaces energy-based VadLoop) ──────────────
      // Loads ONNX model + worklet from /public/vad/ (self-hosted, no CDN).
      // onSpeechEnd receives the COMPLETE speech segment as Float32Array at
      // 16 kHz mono — no manual segmentation or debounce timers needed.
      const { MicVAD } = await import("@ricky0123/vad-web");

      vadRef.current = await MicVAD.new({
        // Self-hosted assets in /public/vad/ (no CDN dependency)
        baseAssetPath: "/vad/",
        onnxWASMBasePath: "/vad/",
        model: "v5",

        // Share the playback AudioContext to avoid Chrome's 2-context limit
        audioContext: audioContextRef.current ?? undefined,

        // ── Tuning (all times in ms; 1 Silero v5 frame = 96ms) ──────────────
        // positiveSpeechThreshold: probability to consider a frame as speech
        positiveSpeechThreshold: 0.5,
        // negativeSpeechThreshold: probability to consider a frame as silence
        negativeSpeechThreshold: 0.35,
        // minSpeechMs: minimum speech duration before onSpeechEnd fires
        // 192ms (~2 frames) — catches short words like "ඔව්" or "yes"
        minSpeechMs: 192,
        // preSpeechPadMs: extra audio prepended before speech starts
        // 960ms — ensures fast starters don't lose the first phoneme
        preSpeechPadMs: 960,
        // redemptionMs: pause tolerance within a single utterance
        // 2400ms (~2.4s) — natural mid-sentence pauses don't split the turn;
        // covers the "pause and continue" pattern without timer hacks
        redemptionMs: 2400,
        // Don't fire onSpeechEnd when VAD is paused (e.g. AI is speaking)
        submitUserSpeechOnPause: false,

        onSpeechStart: () => {
          if (aiSpeakingRef.current) return; // ignore mic pickup during AI playback
          setPhase("capturing");
          setMicLevel(80); // show mic as active
        },

        onVADMisfire: () => {
          // Too short to be real speech — reset to listening
          setPhase("connected");
          setMicLevel(0);
        },

        onSpeechEnd: async (audio: Float32Array) => {
          if (aiSpeakingRef.current) return; // discard echo from AI speakers

          setPhase("processing");
          setMicLevel(0);

          // Silero gives us a clean Float32Array of just the speech at 16 kHz.
          // Encode as WAV and POST directly to the pipeline.
          const wavBuffer = encodeWav(audio, 16000);

          console.log("[live-session-panel] speech-turn →", {
            samples: audio.length,
            durationMs: Math.round(audio.length / 16000 * 1000),
            wavBytes: wavBuffer.byteLength,
          });

          try {
            const res = await fetch(
              `/api/media-service/speech-turn?sessionId=${session.sessionId}`,
              {
                method: "POST",
                headers: { "content-type": "audio/wav" },
                body: wavBuffer,
              }
            );
            const data = await res.json();
            console.log("[live-session-panel] speech-turn result", data);
          } catch (err) {
            console.error("[live-session-panel] speech-turn failed", err);
          } finally {
            setPhase((prev) => prev === "processing" ? "connected" : prev);
          }
        },

        onFrameProcessed: (probs, _frame) => {
          // Drive mic level indicator with real speech probability (0-127 scale)
          if (!aiSpeakingRef.current) {
            setMicLevel(Math.round(probs.isSpeech * 127));
          }
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
    vadRef.current?.pause();
    vadRef.current?.destroy?.();
    vadRef.current = null;
    aiSpeakingRef.current = false;
    setMicLevel(0);
    setVadMuted(false);
    lastEventCountRef.current = 0;
    await audioContextRef.current?.close().catch(() => undefined);
    audioContextRef.current = null;
    await playbackContextRef.current?.close().catch(() => undefined);
    playbackContextRef.current = null;
    await fullSessionRef.current?.stop();
    fullSessionRef.current = null;
    setSessionId("");
    setTelemetry(null);
    setPlayingTurn(null);
    lastPlayedTurnRef.current = null;
    rtcFallbackTriedRef.current.clear();
    rtcStartedTurnsRef.current.clear();
    rtcRemoteLiveRef.current = false;
    if (audioRef.current) audioRef.current.srcObject = null;
    setPhase("idle");
  }

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      vadRef.current?.pause();
      vadRef.current?.destroy?.();
      void audioContextRef.current?.close().catch(() => undefined);
      void playbackContextRef.current?.close().catch(() => undefined);
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

      {/* ── Hidden audio elements (use CSS not the hidden attr — hidden blocks play()) ── */}
      <audio ref={audioRef} style={{ display: "none" }} playsInline />
      <audio ref={ttsAudioRef} style={{ display: "none" }} playsInline />

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
