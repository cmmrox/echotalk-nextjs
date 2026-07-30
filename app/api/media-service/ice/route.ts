import { NextResponse } from "next/server";

import { mediaAddIce } from "@/media-service/peerManager";
import { getMediaSession, pushMediaSessionEvent } from "@/media-service/sessionManager";
import {
  guardMediaSessionRequest,
  readBoundedJson,
} from "@/lib/http/mediaSessionGuard";
import { LIMITS } from "@/lib/limits";

export const runtime = "nodejs";

type IceRequest = {
  sessionId?: string;
  candidate?: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
};

export async function POST(req: Request) {
  try {
    const parsed = await readBoundedJson<IceRequest>(req);
    if (!parsed.ok) return parsed.response;
    const body = parsed.value;
    const sessionId = body?.sessionId?.trim() ?? "";
    const candidate = body?.candidate?.trim() ?? "";
    const rejected = guardMediaSessionRequest(req, sessionId);
    if (rejected) return rejected;
    if (!candidate || candidate.length > LIMITS.maxIceCandidateChars) {
      return NextResponse.json(
        { error: "bad_request", message: "Invalid ICE candidate" },
        { status: 400 }
      );
    }

    console.log("[media-service/ice] incoming", {
      sessionId,
      hasCandidate: Boolean(candidate),
      candidateLength: candidate.length,
      sdpMid: body?.sdpMid ?? null,
      sdpMLineIndex: body?.sdpMLineIndex ?? null,
    });

    const session = getMediaSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: "not_found", message: "Media session not found" },
        { status: 404 }
      );
    }

    pushMediaSessionEvent(sessionId, "ice_received", {
      candidateLength: candidate.length,
      sdpMid: body?.sdpMid ?? null,
      sdpMLineIndex: body?.sdpMLineIndex ?? null,
    });

    await mediaAddIce({
      sessionId,
      candidate,
      sdpMid: body?.sdpMid,
      sdpMLineIndex: body?.sdpMLineIndex,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const errorClass = err instanceof Error ? err.name : "unknown";
    console.error("[media-service/ice] failed", { errorClass });
    return NextResponse.json(
      { error: "ice_failed", message: "ICE candidate processing failed" },
      { status: 502 }
    );
  }
}
