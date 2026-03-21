import { NextResponse } from "next/server";

import {
  finalizeTurnIfReady,
  handleSpeechStopHint,
} from "@/media-service/turnDetector";
import { pushMediaSessionEvent } from "@/media-service/sessionManager";

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

  handleSpeechStopHint(sessionId);

  const finalizedTurn = finalizeTurnIfReady({
    sessionId,
    reason: "vad_trigger",
  });

  if (!finalizedTurn.ok) {
    console.log("[media-service/trigger-turn] skipped", {
      sessionId,
      reason: finalizedTurn.reason,
      endpointDecision: finalizedTurn.endpointDecision,
    });
    return NextResponse.json({
      triggered: false,
      reason: finalizedTurn.reason,
      endpointDecision: finalizedTurn.endpointDecision,
    });
  }

  console.log("[media-service/trigger-turn] VAD-triggered finalize", {
    sessionId,
    packetCount: finalizedTurn.finalized.packetCount,
    frameCount: finalizedTurn.finalized.frames.length,
    completedTurns: finalizedTurn.finalized.completedTurns,
    endpointDecision: finalizedTurn.endpointDecision,
  });

  pushMediaSessionEvent(sessionId, "vad_triggered_turn", {
    packetCount: finalizedTurn.finalized.packetCount,
    frameCount: finalizedTurn.finalized.frames.length,
  });

  return NextResponse.json({
    triggered: true,
    turnNumber: finalizedTurn.finalized.completedTurns,
    packetCount: finalizedTurn.finalized.packetCount,
    frameCount: finalizedTurn.finalized.frames.length,
  });
}
