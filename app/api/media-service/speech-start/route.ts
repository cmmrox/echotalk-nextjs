import { NextResponse } from "next/server";

import { resetSegmentBuffer } from "@/media-service/segmentationBuffer";
import { pushMediaSessionEvent } from "@/media-service/sessionManager";
import { isSessionListening } from "@/media-service/listeningState";
import { markSpeechStarted } from "@/media-service/speechStartTracker";

export const runtime = "nodejs";

/**
 * POST /api/media-service/speech-start?sessionId=…
 *
 * Called by the browser VAD when the user STARTS speaking.
 * Resets the segmentation buffer so it only collects audio from
 * this point forward — preventing silent/idle frames from diluting
 * the STT input when trigger-turn fires later.
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

  // Don't reset while AI is speaking — avoids race with playback gate.
  if (!isSessionListening(sessionId)) {
    return NextResponse.json({ reset: false, reason: "ai_speaking" });
  }

  resetSegmentBuffer(sessionId);
  markSpeechStarted(sessionId);

  console.log("[media-service/speech-start] buffer reset + speech flagged", { sessionId });
  pushMediaSessionEvent(sessionId, "speech_start_buffer_reset", {});

  return NextResponse.json({ reset: true });
}
