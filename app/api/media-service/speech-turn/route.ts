import { NextResponse } from "next/server";

import { audioBufferToOpusFrames } from "@/media-service/opusFromMp3";
import { prepareOutboundDelivery } from "@/media-service/outboundDelivery";
import { appendMediaResult } from "@/media-service/resultStore";
import { appendStoredTtsAudio } from "@/media-service/ttsStore";
import { getOutboundSender, scheduleOutboundAudio } from "@/media-service/outboundAudioTrack";
import {
  appendMediaTurn,
  getMediaSession,
  pushMediaSessionEvent,
  updateMediaSession,
} from "@/media-service/sessionManager";
import { setSessionListening } from "@/media-service/listeningState";
import { generateAgentReply } from "@/lib/services/agent";
import { transcribeAudioBuffer } from "@/lib/services/stt";
import { synthesizeSpeechBuffer } from "@/lib/services/tts";

export const runtime = "nodejs";

/**
 * POST /api/media-service/speech-turn?sessionId=…
 * Content-Type: audio/wav
 * Body: raw WAV bytes (16 kHz mono PCM from Silero VAD)
 *
 * Full pipeline: WAV → Google STT → OpenAI Agent → Google TTS → WebRTC push
 * Returns immediately with transcript + reply so the UI updates fast.
 * TTS audio is scheduled asynchronously over WebRTC.
 */
export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId")?.trim() ?? "";

  if (!sessionId) {
    return NextResponse.json(
      { error: "bad_request", message: "Missing sessionId" },
      { status: 400 }
    );
  }

  const session = getMediaSession(sessionId);
  if (!session) {
    return NextResponse.json(
      { error: "not_found", message: "Session not found" },
      { status: 404 }
    );
  }

  // Read WAV bytes from body
  const arrayBuffer = await req.arrayBuffer();
  const wavBuffer = Buffer.from(arrayBuffer);

  if (wavBuffer.length < 100) {
    return NextResponse.json({ ok: true, skipped: true, reason: "audio_too_short" });
  }

  console.log("[speech-turn] received audio", {
    sessionId,
    bytes: wavBuffer.length,
    durationEstimateMs: Math.round((wavBuffer.length - 44) / 2 / 16000 * 1000),
  });

  pushMediaSessionEvent(sessionId, "speech_turn_received", { bytes: wavBuffer.length });
  updateMediaSession(sessionId, { status: "processing" });

  // ── 1. Speech-to-Text ──────────────────────────────────────────────────────
  const stt = await transcribeAudioBuffer({
    buffer: wavBuffer,
    inputMimeType: "audio/wav",
  });

  console.log("[speech-turn] STT result", {
    sessionId,
    transcript: stt.transcript.slice(0, 120) || "(empty)",
    detectedLanguage: stt.detectedLanguage,
  });

  if (!stt.transcript.trim()) {
    updateMediaSession(sessionId, { status: "connected" });
    pushMediaSessionEvent(sessionId, "speech_turn_empty_transcript", {});
    return NextResponse.json({ ok: true, skipped: true, reason: "empty_transcript" });
  }

  // Store user turn in conversation history
  appendMediaTurn(sessionId, {
    role: "user",
    text: stt.transcript,
    language: stt.detectedLanguage,
  });

  pushMediaSessionEvent(sessionId, "speech_turn_stt_done", {
    transcriptLength: stt.transcript.length,
    detectedLanguage: stt.detectedLanguage,
  });

  // ── 2. Agent ───────────────────────────────────────────────────────────────
  const recentTurns = (getMediaSession(sessionId)?.turns ?? []).map((t) => ({
    role: t.role as "user" | "assistant",
    text: t.text,
    language: t.language,
  }));

  let replyText = "";
  let replyLanguage = stt.detectedLanguage;

  try {
    const agent = await generateAgentReply({
      transcript: stt.transcript,
      detectedLanguage: stt.detectedLanguage,
      recentTurns,
    });
    replyText = agent.replyText;
    replyLanguage = agent.replyLanguage;
    pushMediaSessionEvent(sessionId, "speech_turn_agent_done", {
      replyLength: replyText.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[speech-turn] agent error", { sessionId, message });
    pushMediaSessionEvent(sessionId, "speech_turn_agent_failed", { message });
    updateMediaSession(sessionId, { status: "connected" });
    return NextResponse.json({ ok: false, error: "agent_failed", message }, { status: 500 });
  }

  // ── 3. Persist result + assistant turn ────────────────────────────────────
  const currentSession = getMediaSession(sessionId);
  const turnNumber = (currentSession?.turns.length ?? 0) + 1;

  const result = appendMediaResult(sessionId, {
    turnNumber,
    transcript: stt.transcript,
    detectedLanguage: stt.detectedLanguage,
    replyText,
    replyLanguage,
  });

  appendMediaTurn(sessionId, {
    role: "assistant",
    text: replyText,
    language: replyLanguage,
  });

  updateMediaSession(sessionId, { latestResult: result, status: "speaking" });

  // ── 4. TTS ─────────────────────────────────────────────────────────────────
  try {
    const tts = await synthesizeSpeechBuffer({
      text: replyText,
      languageCode: replyLanguage,
    });

    const storedTts = appendStoredTtsAudio(sessionId, {
      turnNumber,
      contentType: tts.contentType,
      audioBase64: tts.buffer.toString("base64"),
    });

    // HTTP fallback delivery always prepared
    prepareOutboundDelivery(sessionId);

    // Block mic listening while AI speaks (echo prevention)
    setSessionListening(sessionId, false);

    updateMediaSession(sessionId, {
      latestTts: {
        turnNumber: storedTts.turnNumber,
        contentType: storedTts.contentType,
        createdAt: storedTts.createdAt,
      },
      outboundAudio: {
        ready: true,
        turnNumber: storedTts.turnNumber,
        contentType: storedTts.contentType,
        createdAt: storedTts.createdAt,
      },
    });

    pushMediaSessionEvent(sessionId, "speech_turn_tts_done", {
      turnNumber,
      bytes: tts.buffer.length,
    });

    // ── 5. WebRTC audio delivery (async — don't block HTTP response) ──────
    const rtcSender = getOutboundSender(sessionId);
    if (rtcSender) {
      audioBufferToOpusFrames(tts.buffer)
        .then((frames) => scheduleOutboundAudio(sessionId, frames))
        .then(() => {
          // Re-open listening gate after WebRTC playback finishes
          setSessionListening(sessionId, true);
          updateMediaSession(sessionId, { status: "connected" });
          console.log("[speech-turn] WebRTC playback finished", { sessionId, turnNumber });
        })
        .catch((err) => {
          console.warn("[speech-turn] WebRTC delivery failed", { sessionId, err: String(err) });
          setSessionListening(sessionId, true);
          updateMediaSession(sessionId, { status: "connected" });
        });
    } else {
      // No WebRTC sender — HTTP fallback only; re-open gate after timeout
      setTimeout(() => {
        setSessionListening(sessionId, true);
        updateMediaSession(sessionId, { status: "connected" });
      }, 8000);
    }

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[speech-turn] TTS error", { sessionId, message });
    pushMediaSessionEvent(sessionId, "speech_turn_tts_failed", { message });
    setSessionListening(sessionId, true);
    updateMediaSession(sessionId, { status: "connected" });
  }

  // Return immediately so the client shows the transcript + reply without
  // waiting for audio delivery to finish.
  return NextResponse.json({
    ok: true,
    transcript: stt.transcript,
    replyText,
    replyLanguage,
    turnNumber,
  });
}
