import { NextResponse } from "next/server";

import {
  appendConversationTurn,
  getWebRtcSession,
  pushSessionEvent,
  updateWebRtcSession,
} from "@/lib/webrtc/sessionRegistry";
import { dequeueAudioTurn, enqueueAudioTurn } from "@/lib/webrtc/audioQueue";
import { generateAgentReply } from "@/lib/services/agent";
import { transcribeAudioBuffer } from "@/lib/services/stt";
import { synthesizeSpeechBuffer } from "@/lib/services/tts";

export const runtime = "nodejs";

type AudioUploadRequest = {
  sessionId?: string;
  mimeType?: string;
  audioBase64?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as AudioUploadRequest | null;
    const sessionId = body?.sessionId?.trim() ?? "";
    const mimeType = body?.mimeType?.trim() ?? "audio/webm";
    const audioBase64 = body?.audioBase64?.trim() ?? "";

    console.log("[webrtc/audio] incoming", {
      sessionId,
      mimeType,
      audioBase64Length: audioBase64.length,
    });

    if (!sessionId || !audioBase64) {
      return NextResponse.json(
        {
          error: "bad_request",
          message: "Expected sessionId and audioBase64.",
        },
        { status: 400 }
      );
    }

    const session = getWebRtcSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: "not_found", message: "Session not found" },
        { status: 404 }
      );
    }

    if (session.status === "processing" || session.status === "speaking") {
      pushSessionEvent(sessionId, "audio_turn_skipped_busy", {
        status: session.status,
      });
      return NextResponse.json({
        ok: true,
        ignored: true,
        reason: "session_busy",
      });
    }

    enqueueAudioTurn({
      id: `${sessionId}-${Date.now()}`,
      createdAt: new Date().toISOString(),
      source: "webrtc",
      sessionId,
      blobBase64: audioBase64,
      mimeType,
    });

    pushSessionEvent(sessionId, "audio_turn_uploaded", {
      mimeType,
      bytesApprox: Math.round((audioBase64.length * 3) / 4),
    });
    updateWebRtcSession(sessionId, { status: "processing" });

    const queued = dequeueAudioTurn(sessionId);
    if (!queued) {
      throw new Error("Audio queue retrieval failed");
    }

    const buffer = Buffer.from(queued.blobBase64, "base64");
    console.log("[webrtc/audio] transcribe:start", {
      sessionId,
      bytes: buffer.length,
      mimeType,
    });
    const stt = await transcribeAudioBuffer({
      buffer,
      inputMimeType: mimeType,
    });
    console.log("[webrtc/audio] transcribe:done", {
      sessionId,
      transcriptLength: stt.transcript.length,
      detectedLanguage: stt.detectedLanguage,
    });

    if (!stt.transcript.trim()) {
      pushSessionEvent(sessionId, "transcript_empty_ignored", {
        detectedLanguage: stt.detectedLanguage,
      });
      updateWebRtcSession(sessionId, { status: "connected" });
      return NextResponse.json({
        ok: true,
        ignored: true,
        reason: "empty_transcript",
        transcript: "",
        detectedLanguage: stt.detectedLanguage,
        replyText: "",
        replyLanguage: "",
        ttsAudioBase64: "",
        ttsContentType: "audio/mpeg",
      });
    }

    appendConversationTurn(sessionId, {
      role: "user",
      text: stt.transcript,
      language: stt.detectedLanguage,
    });
    pushSessionEvent(sessionId, "transcript_ready", {
      transcript: stt.transcript,
      detectedLanguage: stt.detectedLanguage,
    });

    const sessionTurns = (getWebRtcSession(sessionId)?.turns ?? []).map((turn) => ({
      role: turn.role,
      text: turn.text,
      language: turn.language,
    }));
    console.log("[webrtc/audio] agent:start", {
      sessionId,
      transcriptPreview: stt.transcript.slice(0, 80),
      recentTurnCount: sessionTurns.length,
    });
    const agent = await generateAgentReply({
      transcript: stt.transcript,
      detectedLanguage: stt.detectedLanguage,
      recentTurns: sessionTurns,
    });
    console.log("[webrtc/audio] agent:done", {
      sessionId,
      replyLength: agent.replyText.length,
      replyLanguage: agent.replyLanguage,
    });

    appendConversationTurn(sessionId, {
      role: "assistant",
      text: agent.replyText,
      language: agent.replyLanguage,
    });
    pushSessionEvent(sessionId, "assistant_reply_ready", {
      replyText: agent.replyText,
      replyLanguage: agent.replyLanguage,
    });

    let ttsAudioBase64 = "";
    let ttsContentType = "audio/mpeg";
    if (agent.replyText.trim()) {
      console.log("[webrtc/audio] tts:start", {
        sessionId,
        languageCode: agent.replyLanguage || stt.detectedLanguage,
      });
      const tts = await synthesizeSpeechBuffer({
        text: agent.replyText,
        languageCode: agent.replyLanguage || stt.detectedLanguage,
      });
      ttsAudioBase64 = tts.buffer.toString("base64");
      ttsContentType = tts.contentType;
      updateWebRtcSession(sessionId, { status: "speaking" });
      console.log("[webrtc/audio] tts:done", {
        sessionId,
        contentType: tts.contentType,
        bytes: tts.buffer.length,
      });
      pushSessionEvent(sessionId, "assistant_tts_ready", {
        contentType: tts.contentType,
        bytes: tts.buffer.length,
      });
    }

    updateWebRtcSession(sessionId, { status: "connected" });

    return NextResponse.json({
      ok: true,
      transcript: stt.transcript,
      detectedLanguage: stt.detectedLanguage,
      replyText: agent.replyText,
      replyLanguage: agent.replyLanguage,
      ttsAudioBase64,
      ttsContentType,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "audio_turn_failed", message },
      { status: 500 }
    );
  }
}
