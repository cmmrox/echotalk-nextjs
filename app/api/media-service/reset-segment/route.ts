import { NextResponse } from "next/server";

import { resetSegment } from "@/media-service/segmentationBuffer";
import { pushMediaSessionEvent } from "@/media-service/sessionManager";
import { isSessionListening } from "@/media-service/listeningState";
import { guardMediaSessionRequest } from "@/lib/http/mediaSessionGuard";

export const runtime = "nodejs";

/**
 * POST /api/media-service/reset-segment?sessionId=…
 *
 * Called by the browser VAD when the user STARTS speaking.
 * Discards any background-noise frames accumulated before speech began,
 * so that the next trigger-turn only contains clean speech audio.
 */
export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId")?.trim() ?? "";

  const rejected = guardMediaSessionRequest(req, sessionId);
  if (rejected) return rejected;

  // Don't reset while AI is speaking — could cause race conditions.
  if (!isSessionListening(sessionId)) {
    return NextResponse.json({ reset: false, reason: "ai_speaking" });
  }

  const result = resetSegment(sessionId);

  console.log("[media-service/reset-segment] buffer cleared on speech start", {
    sessionId,
    discardedFrames: result.discarded,
  });

  pushMediaSessionEvent(sessionId, "segment_reset_on_speech_start", {
    discardedFrames: result.discarded,
  });

  return NextResponse.json({ reset: true, discardedFrames: result.discarded });
}
