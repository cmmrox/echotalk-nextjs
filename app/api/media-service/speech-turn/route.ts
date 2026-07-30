import { NextResponse } from "next/server";

import {
  guardMediaSessionRequest,
  readBoundedBytes,
} from "@/lib/http/mediaSessionGuard";
import { LIMITS } from "@/lib/limits";
import { consumeProviderOperation } from "@/lib/security/providerBudget";
import { getProviderBundle } from "@/lib/services/providerBundle";
import { setSessionListening } from "@/media-service/listeningState";
import { audioBufferToOpusFrames } from "@/media-service/opusFromMp3";
import { prepareOutboundDelivery } from "@/media-service/outboundDelivery";
import { getOutboundSender, scheduleOutboundAudio } from "@/media-service/outboundAudioTrack";
import { appendMediaResult } from "@/media-service/resultStore";
import {
  appendMediaTurn,
  getMediaSession,
  pushMediaSessionEvent,
  updateMediaSession,
} from "@/media-service/sessionManager";
import {
  getSessionAbortSignal,
  isSessionWorkCancelled,
  scheduleSessionTimer,
  tryAcquireTurnLease,
} from "@/media-service/sessionWork";
import { appendStoredTtsAudio } from "@/media-service/ttsStore";
import {
  allocateTurnNumber,
  createTurnRecord,
  updateTurnRecord,
} from "@/media-service/turnRecords";

export const runtime = "nodejs";

/**
 * Bounded fallback/debug turn path. The primary live path remains the
 * continuous media-service session and server-owned processing queue.
 */
export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId")?.trim() ?? "";
  const rejected = guardMediaSessionRequest(req, sessionId);
  if (rejected) return rejected;

  if (!getMediaSession(sessionId)) {
    return NextResponse.json(
      { error: "not_found", message: "Session not found" },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }

  const contentType = req.headers.get("content-type")?.split(";")[0]?.trim();
  if (contentType !== "audio/wav") {
    return NextResponse.json(
      { error: "bad_request", message: "Audio must be a bounded WAV payload" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const boundedBody = await readBoundedBytes(req, LIMITS.maxAudioBytes);
  if (!boundedBody.ok) return boundedBody.response;
  const wavBuffer = boundedBody.value;
  if (wavBuffer.length < 100) {
    return NextResponse.json(
      { ok: true, skipped: true, reason: "audio_too_short" },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const releaseLease = tryAcquireTurnLease(sessionId);
  if (!releaseLease) {
    return NextResponse.json(
      { error: "turn_in_progress", message: "Another turn is already processing" },
      { status: 409, headers: { "Cache-Control": "no-store" } }
    );
  }

  const turnNumber = allocateTurnNumber(sessionId);
  const turnRecord = createTurnRecord(sessionId, turnNumber);
  const providers = getProviderBundle();
  const signal = getSessionAbortSignal(sessionId);

  try {
    updateTurnRecord(sessionId, turnNumber, (record) => {
      record.state = "recognizing";
      record.timing.recognitionStartedAt = new Date().toISOString();
      record.route.transcriptPolicyVersion = providers.transcriptPolicy.version;
    });
    pushMediaSessionEvent(sessionId, "speech_turn_received", {
      bytes: wavBuffer.length,
      routeMode: "fallback_debug",
    });
    updateMediaSession(sessionId, { status: "processing" });

    const recognitionBudget = consumeProviderOperation(sessionId, "recognize");
    const stt = await providers.recognizer.recognize({
      audio: wavBuffer,
      inputMimeType: "audio/wav",
      signal,
    });
    const transcriptForms = providers.transcriptPolicy.apply(stt);
    const acceptedTranscript =
      transcriptForms.corrected ??
      transcriptForms.normalized ??
      transcriptForms.verbatim;
    updateTurnRecord(sessionId, turnNumber, (record) => {
      record.state = acceptedTranscript.trim() ? "recognized" : "no_speech";
      record.transcript = transcriptForms;
      record.providers.push(stt.identity);
      record.route.recognizer = stt.identity;
      record.quality.recognitionConfidence = stt.confidence;
      record.quality.segmentCount = stt.segments.length;
      record.quality.hasUsableSpeech = Boolean(acceptedTranscript.trim());
      record.timing.recognizedAt = new Date().toISOString();
      record.cost.reservedCostUsd = recognitionBudget.reservedCostUsd;
    });

    if (!acceptedTranscript.trim()) {
      updateMediaSession(sessionId, { status: "connected" });
      return NextResponse.json(
        { ok: true, skipped: true, reason: "empty_transcript" },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const recentTurns = (getMediaSession(sessionId)?.turns ?? []).map((turn) => ({
      role: turn.role as "user" | "assistant",
      text: turn.text,
      language: turn.language,
    }));
    appendMediaTurn(sessionId, {
      role: "user",
      text: acceptedTranscript,
      language: stt.detectedLanguage,
      turnNumber,
      turnId: turnRecord.turnId,
    });

    updateTurnRecord(sessionId, turnNumber, (record) => {
      record.state = "responding";
      record.timing.responseStartedAt = new Date().toISOString();
    });
    const agent = await providers.conversationModel.respond({
      currentTurn: acceptedTranscript,
      detectedLanguage: stt.detectedLanguage,
      permittedHistory: recentTurns,
      idempotencyKey: turnRecord.idempotencyKey,
      signal,
      onProviderAttempt: () => {
        const budget = consumeProviderOperation(sessionId, "respond");
        updateTurnRecord(sessionId, turnNumber, (record) => {
          record.cost.reservedCostUsd = budget.reservedCostUsd;
        });
      },
    });
    updateTurnRecord(sessionId, turnNumber, (record) => {
      record.state = "responded";
      record.response.displayText = agent.displayText;
      record.response.ttsText = agent.ttsText;
      record.response.replyLanguage = agent.replyLanguage;
      record.providers.push(agent.identity);
      record.route.conversationModel = agent.identity;
      record.timing.respondedAt = new Date().toISOString();
      if (agent.usage) record.usage.push(agent.usage);
    });

    const result = appendMediaResult(sessionId, {
      turnNumber,
      transcript: acceptedTranscript,
      detectedLanguage: stt.detectedLanguage,
      replyText: agent.displayText,
      replyLanguage: agent.replyLanguage,
    });
    appendMediaTurn(sessionId, {
      role: "assistant",
      text: agent.displayText,
      language: agent.replyLanguage,
      turnNumber,
      turnId: turnRecord.turnId,
    });
    updateMediaSession(sessionId, { latestResult: result, status: "speaking" });

    updateTurnRecord(sessionId, turnNumber, (record) => {
      record.state = "synthesizing";
      record.timing.synthesisStartedAt = new Date().toISOString();
    });
    const synthesisBudget = consumeProviderOperation(sessionId, "synthesize");
    const tts = await providers.synthesizer.synthesize({
      text: agent.ttsText,
      languageCode: agent.replyLanguage,
      signal,
    });
    const storedTts = appendStoredTtsAudio(sessionId, {
      turnNumber,
      contentType: tts.contentType,
      audioBase64: tts.audio.toString("base64"),
    });
    prepareOutboundDelivery(sessionId);
    setSessionListening(sessionId, false);
    updateMediaSession(sessionId, {
      latestTts: {
        turnNumber,
        contentType: storedTts.contentType,
        createdAt: storedTts.createdAt,
      },
      outboundAudio: {
        ready: true,
        turnNumber,
        contentType: storedTts.contentType,
        createdAt: storedTts.createdAt,
      },
    });
    updateTurnRecord(sessionId, turnNumber, (record) => {
      record.state = "completed";
      record.providers.push(tts.identity);
      record.route.synthesizer = tts.identity;
      if (tts.usage) record.usage.push(tts.usage);
      record.cost.reservedCostUsd = synthesisBudget.reservedCostUsd;
      record.cost.reportedCostUsd = record.usage.some(
        (usage) => typeof usage.estimatedCostUsd === "number"
      )
        ? Number(record.usage.reduce(
            (sum, usage) => sum + (usage.estimatedCostUsd ?? 0),
            0
          ).toFixed(6))
        : null;
      record.timing.completedAt = new Date().toISOString();
    });

    const rtcSender = getOutboundSender(sessionId);
    if (rtcSender) {
      audioBufferToOpusFrames(tts.audio)
        .then((frames) => scheduleOutboundAudio(sessionId, frames))
        .then(() => {
          if (isSessionWorkCancelled(sessionId)) return;
          setSessionListening(sessionId, true);
          updateMediaSession(sessionId, { status: "connected" });
        })
        .catch((error) => {
          if (isSessionWorkCancelled(sessionId)) return;
          console.warn("[speech-turn] WebRTC delivery failed", {
            sessionId,
            errorClass: error instanceof Error ? error.name : "unknown",
          });
          setSessionListening(sessionId, true);
          updateMediaSession(sessionId, { status: "connected" });
        });
    } else {
      scheduleSessionTimer(sessionId, () => {
        setSessionListening(sessionId, true);
        updateMediaSession(sessionId, { status: "connected" });
      }, 8000);
    }

    return NextResponse.json(
      {
        ok: true,
        transcript: acceptedTranscript,
        replyText: agent.displayText,
        replyLanguage: agent.replyLanguage,
        turnNumber,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const errorClass = error instanceof Error ? error.name : "unknown";
    console.error("[speech-turn] processing failed", {
      sessionId,
      turnNumber,
      errorClass,
    });
    if (!isSessionWorkCancelled(sessionId)) {
      pushMediaSessionEvent(sessionId, "speech_turn_failed", { errorClass });
      updateTurnRecord(sessionId, turnNumber, (record) => {
        record.state = "failed";
        record.failureCode = errorClass;
      });
      setSessionListening(sessionId, true);
      updateMediaSession(sessionId, { status: "connected" });
    }
    const budgetExceeded = errorClass === "ProviderBudgetExceeded";
    return NextResponse.json(
      {
        ok: false,
        error: budgetExceeded ? "provider_budget_exceeded" : "provider_failed",
        message: budgetExceeded
          ? "Session provider budget exceeded"
          : "Speech processing service failed",
      },
      {
        status: budgetExceeded ? 429 : 502,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } finally {
    releaseLease();
  }
}
