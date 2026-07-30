import { NextResponse } from "next/server";

import { resetSegmentBuffer } from "@/media-service/segmentationBuffer";
import { pushMediaSessionEvent } from "@/media-service/sessionManager";
import { isSessionListening } from "@/media-service/listeningState";
import { markSpeechStarted } from "@/media-service/speechStartTracker";
import { handleSpeechStartHint } from "@/media-service/turnDetector";
import { guardMediaSessionRequest } from "@/lib/http/mediaSessionGuard";

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

  const rejected = guardMediaSessionRequest(req, sessionId);
  if (rejected) return rejected;

  // During assistant playback, treat speech-start as a barge-in signal instead
  // of hard-rejecting it. Still avoid resetting the segment buffer here.
  if (!isSessionListening(sessionId)) {
    markSpeechStarted(sessionId);
    handleSpeechStartHint(sessionId);
    return NextResponse.json({ reset: false, reason: "ai_speaking_interrupt_candidate" });
  }

  resetSegmentBuffer(sessionId);
  markSpeechStarted(sessionId);
  handleSpeechStartHint(sessionId);

  console.log("[media-service/speech-start] buffer reset + speech flagged", { sessionId });
  pushMediaSessionEvent(sessionId, "speech_start_buffer_reset", {});

  return NextResponse.json({ reset: true });
}
