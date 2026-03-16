"use client";

import * as React from "react";

import { LiveSessionPanel } from "@/components/echo/live-session-panel";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type EchoTalkState =
  | "idle"
  | "requesting_permission"
  | "listening"
  | "processing"
  | "speaking"
  | "error";

function getMaxRecordSeconds(): number {
  const raw = process.env.NEXT_PUBLIC_ECHOTALK_MAX_RECORD_SECONDS;
  const n = raw ? Number(raw) : NaN;
  if (!Number.isFinite(n) || n <= 0) return 60;
  return Math.floor(n);
}

const MAX_RECORD_SECONDS = getMaxRecordSeconds();

function getButtonLabel(state: EchoTalkState): string {
  switch (state) {
    case "idle":
      return "Tap to Talk";
    case "requesting_permission":
      return "Requesting mic…";
    case "listening":
      return "Listening… Tap to Stop";
    case "processing":
      return "Thinking… Tap to Stop";
    case "speaking":
      return "Speaking… Tap to Stop";
    case "error":
      return "Try again";
    default:
      return "Tap to Talk";
  }
}

function getStatusLine(state: EchoTalkState, processingHint?: string): string {
  switch (state) {
    case "idle":
      return "Press the button and speak. Press again to stop.";
    case "requesting_permission":
      return "Waiting for microphone permission…";
    case "listening":
      return "Listening. Press stop when you’re done.";
    case "processing":
      return processingHint || "Transcribing and thinking…";
    case "speaking":
      return "Playing the assistant response…";
    case "error":
      return "Something went wrong. You can try again.";
    default:
      return "";
  }
}

function pickBestMimeType(): string | undefined {
  const preferred = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];

  if (typeof window === "undefined") return undefined;
  if (typeof MediaRecorder === "undefined") return undefined;

  for (const type of preferred) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }

  return undefined;
}

export default function Home() {
  const [state, setState] = React.useState<EchoTalkState>("idle");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [processingHint, setProcessingHint] = React.useState<string>("");
  const [recordSeconds, setRecordSeconds] = React.useState<number>(0);
  const [lastRecordingInfo, setLastRecordingInfo] = React.useState<
    { mimeType: string; bytes: number } | undefined
  >(undefined);
  const [transcript, setTranscript] = React.useState<string>("");
  const [detectedLanguage, setDetectedLanguage] = React.useState<string>("");
  const [replyText, setReplyText] = React.useState<string>("");
  const [replyLanguage, setReplyLanguage] = React.useState<string>("");

  // Cancellation + resources (Stage 03+)
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = React.useRef<string | null>(null);
  const mediaStreamRef = React.useRef<MediaStream | null>(null);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<BlobPart[]>([]);
  const tickIntervalRef = React.useRef<number | null>(null);

  function clearTick() {
    if (tickIntervalRef.current) {
      window.clearInterval(tickIntervalRef.current);
      tickIntervalRef.current = null;
    }
  }

  function releaseMic() {
    const stream = mediaStreamRef.current;
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
    }
    mediaStreamRef.current = null;
  }

  function stopAll() {
    // Cancel in-flight requests.
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;

    // Stop playback.
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }

    // Stop recording.
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    recorderRef.current = null;

    clearTick();
    releaseMic();

    setRecordSeconds(0);
    setErrorMessage(null);
    setProcessingHint("");
    setTranscript("");
    setDetectedLanguage("");
    setReplyText("");
    setReplyLanguage("");
    setState("idle");
  }

  async function transcribeAudio(blob: Blob) {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setState("processing");
    setProcessingHint("Transcribing…");

    try {
      const form = new FormData();
      form.append("audio", blob, "speech.webm");

      const res = await fetch("/api/stt", {
        method: "POST",
        body: form,
        signal: controller.signal,
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: string; message?: string }
          | null;
        throw new Error(
          data?.message || data?.error || `STT failed (${res.status})`
        );
      }

      const data = (await res.json()) as {
        transcript: string;
        detectedLanguage: string;
        confidence: number | null;
      };

      const nextTranscript = data.transcript ?? "";
      const nextLang = data.detectedLanguage ?? "";

      setTranscript(nextTranscript);
      setDetectedLanguage(nextLang);

      if (nextTranscript.trim()) {
        setProcessingHint("Thinking…");
        const agentRes = await fetch("/api/agent", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            transcript: nextTranscript,
            detectedLanguage: nextLang,
          }),
          signal: controller.signal,
        });

        if (!agentRes.ok) {
          const agentData = (await agentRes.json().catch(() => null)) as
            | { error?: string; message?: string }
            | null;
          throw new Error(
            agentData?.message ||
              agentData?.error ||
              `Agent failed (${agentRes.status})`
          );
        }

        const agentData = (await agentRes.json()) as {
          replyText: string;
          replyLanguage?: string;
        };
        const nextReply = agentData.replyText ?? "";
        const nextReplyLanguage = agentData.replyLanguage ?? "";
        setReplyText(nextReply);
        setReplyLanguage(nextReplyLanguage);

        if (nextReply.trim()) {
          // Fetch TTS audio (Stage 06) and play it.
          setProcessingHint("Generating voice…");
          const ttsRes = await fetch("/api/tts", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              text: nextReply,
              languageCode: nextReplyLanguage || nextLang,
            }),
            signal: controller.signal,
          });

          if (!ttsRes.ok) {
            const ttsData = (await ttsRes.json().catch(() => null)) as
              | { error?: string; message?: string }
              | null;
            throw new Error(
              ttsData?.message ||
                ttsData?.error ||
                `TTS failed (${ttsRes.status})`
            );
          }

          const audioBytes = await ttsRes.arrayBuffer();
          const audioBlob = new Blob([audioBytes], { type: "audio/mpeg" });
          const url = URL.createObjectURL(audioBlob);
          audioUrlRef.current = url;

          setState("speaking");

          const audio = new Audio(url);
          audioRef.current = audio;

          await audio.play();

          await new Promise<void>((resolve) => {
            const onAbort = () => {
              controller.signal.removeEventListener("abort", onAbort);
              resolve();
            };
            const onEnded = () => {
              controller.signal.removeEventListener("abort", onAbort);
              resolve();
            };

            controller.signal.addEventListener("abort", onAbort, { once: true });
            audio.addEventListener("ended", onEnded, { once: true });
          });

          // Clean up after playback.
          if (audioRef.current === audio) {
            audioRef.current = null;
          }
          URL.revokeObjectURL(url);
          if (audioUrlRef.current === url) {
            audioUrlRef.current = null;
          }
        }
      }

      setState("idle");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setProcessingHint("");
        setState("idle");
        return;
      }

      const message = err instanceof Error ? err.message : "Unknown error";
      setErrorMessage(message);
      setState("error");
    } finally {
      abortControllerRef.current = null;
    }
  }

  async function startListening() {
    setErrorMessage(null);
    setProcessingHint("");
    setLastRecordingInfo(undefined);
    setTranscript("");
    setDetectedLanguage("");
    setReplyText("");
    setReplyLanguage("");
    setRecordSeconds(0);
    setState("requesting_permission");

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Microphone capture is not supported in this browser.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const mimeType = pickBestMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.addEventListener("dataavailable", (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      });

      recorder.addEventListener("stop", () => {
        const finalMimeType = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: finalMimeType });

        setLastRecordingInfo({ mimeType: blob.type, bytes: blob.size });

        chunksRef.current = [];
        releaseMic();
        clearTick();

        setRecordSeconds(0);

        // Upload to server for STT (Stage 04).
        void transcribeAudio(blob);
      });

      recorder.start();
      setState("listening");

      tickIntervalRef.current = window.setInterval(() => {
        setRecordSeconds((s) => {
          const next = s + 1;
          if (next >= MAX_RECORD_SECONDS) {
            // Auto-stop at max duration.
            if (recorderRef.current && recorderRef.current.state !== "inactive") {
              recorderRef.current.stop();
            }
          }
          return next;
        });
      }, 1000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setErrorMessage(message);
      clearTick();
      releaseMic();
      setState("error");
    }
  }

  async function onToggle() {
    if (state === "idle" || state === "error") {
      await startListening();
      return;
    }

    // Any non-idle state means “Stop”.
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
      // `stop` event handler will reset state.
      return;
    }

    stopAll();
  }

  const isBusy =
    state === "requesting_permission" ||
    state === "processing" ||
    state === "speaking";

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>EchoTalk</CardTitle>
          <CardDescription>
            Voice in. Voice out. Same language. No typing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-4">
            <Button
              size="lg"
              className="w-full"
              onClick={onToggle}
              disabled={state === "requesting_permission"}
            >
              {getButtonLabel(state)}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              {getStatusLine(state, processingHint)}
            </p>

            {state === "listening" ? (
              <p className="text-center text-xs text-muted-foreground">
                Recording: {recordSeconds}s / {MAX_RECORD_SECONDS}s
              </p>
            ) : null}

            {lastRecordingInfo ? (
              <p className="text-center text-xs text-muted-foreground">
                Last recording: {lastRecordingInfo.mimeType} •{" "}
                {Math.max(1, Math.round(lastRecordingInfo.bytes / 1024))} KB
              </p>
            ) : null}

            {transcript ? (
              <div className="w-full rounded-md border bg-card p-3 text-sm">
                <p className="text-xs text-muted-foreground">Transcript</p>
                <p className="mt-1 whitespace-pre-wrap">{transcript}</p>
                {detectedLanguage ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Detected language: {detectedLanguage}
                  </p>
                ) : null}
              </div>
            ) : null}

            {replyText ? (
              <div className="w-full rounded-md border bg-card p-3 text-sm">
                <p className="text-xs text-muted-foreground">Assistant</p>
                <p className="mt-1 whitespace-pre-wrap">{replyText}</p>
                {replyLanguage ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Reply language: {replyLanguage}
                  </p>
                ) : null}
              </div>
            ) : null}

            <LiveSessionPanel onError={setErrorMessage} />

            {errorMessage ? (
              <p className="text-center text-sm text-destructive">
                {errorMessage}
              </p>
            ) : null}

            {isBusy ? (
              <p className="text-center text-xs text-muted-foreground">
                (You can tap Stop at any time.)
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
