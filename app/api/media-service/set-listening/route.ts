import { NextResponse } from "next/server";

import { finalizeSegment } from "@/media-service/segmentationBuffer";
import {
  isSessionListening,
  setSessionListening,
} from "@/media-service/listeningState";
import {
  pushMediaSessionEvent,
  updateMediaSession,
} from "@/media-service/sessionManager";
import { guardMediaSessionRequest } from "@/lib/http/mediaSessionGuard";

export const runtime = "nodejs";

/**
 * POST /api/media-service/set-listening?sessionId=…&listening=1|0
 *
 * Called by the browser when AI audio playback starts (listening=0) or ends
 * (listening=1). When disabled the server discards any accumulated audio so
 * the AI's own voice (picked up by the mic) is never sent to STT.
 */
export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId  = searchParams.get("sessionId")?.trim() ?? "";
  const listeningParam = searchParams.get("listening");

  const rejected = guardMediaSessionRequest(req, sessionId);
  if (rejected) return rejected;
  if (listeningParam === null || !["0", "1"].includes(listeningParam)) {
    return NextResponse.json(
      { error: "bad_request", message: "Invalid listening param" },
      { status: 400 }
    );
  }

  const listening = listeningParam !== "0";
  const previous  = isSessionListening(sessionId);
  setSessionListening(sessionId, listening);

  let discardedFrames = 0;

  if (!listening && previous) {
    // AI just started speaking — discard any audio accumulated so far in the
    // current segment window so the AI's own voice doesn't get transcribed.
    const discarded = finalizeSegment(sessionId);
    discardedFrames = discarded.frames.length;
    console.log("[media-service/set-listening] AI speech started — segment discarded", {
      sessionId,
      discardedFrames,
    });
    updateMediaSession(sessionId, { status: "speaking" });
    pushMediaSessionEvent(sessionId, "listening_disabled_segment_discarded", {
      discardedFrames,
    });
  } else if (listening && !previous) {
    // AI just finished speaking — resume normal processing.
    console.log("[media-service/set-listening] AI speech ended — listening resumed", {
      sessionId,
    });
    updateMediaSession(sessionId, { status: "connected" });
    pushMediaSessionEvent(sessionId, "listening_resumed", {});
  }

  return NextResponse.json({ ok: true, listening, discardedFrames });
}
