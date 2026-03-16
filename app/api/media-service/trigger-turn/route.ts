import { NextResponse } from "next/server";

import { queueTurnIfReady } from "@/media-service/processingQueue";
import { finalizeSegmentIfPending } from "@/media-service/segmentationBuffer";
import { appendTurnAudio } from "@/media-service/turnAudioStore";
import { markTurnReady } from "@/media-service/turnState";
import {
  pushMediaSessionEvent,
  updateMediaSession,
} from "@/media-service/sessionManager";

export const runtime = "nodejs";

/**
 * POST /api/media-service/trigger-turn?sessionId=…
 *
 * Called by the browser VAD when the user stops speaking.
 * Finalizes the current audio segment immediately (instead of waiting for
 * the fixed 300-packet window) and queues STT processing.
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

  const finalized = finalizeSegmentIfPending(sessionId);
  if (!finalized) {
    console.log("[media-service/trigger-turn] no pending audio", { sessionId });
    return NextResponse.json({ triggered: false, reason: "no_pending_audio" });
  }

  console.log("[media-service/trigger-turn] VAD-triggered finalize", {
    sessionId,
    packetCount: finalized.packetCount,
    frameCount: finalized.frames.length,
    completedTurns: finalized.completedTurns,
  });

  appendTurnAudio(sessionId, {
    turnNumber: finalized.completedTurns,
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
    turnWindow: { ...turnWindow },
    processing: { ...processing },
  });

  pushMediaSessionEvent(sessionId, "vad_triggered_turn", {
    packetCount: finalized.packetCount,
    frameCount: finalized.frames.length,
  });

  return NextResponse.json({
    triggered: true,
    turnNumber: finalized.completedTurns,
    packetCount: finalized.packetCount,
    frameCount: finalized.frames.length,
  });
}
