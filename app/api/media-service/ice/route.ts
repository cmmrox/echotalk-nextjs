import { NextResponse } from "next/server";

import { mediaAddIce } from "@/media-service/peerManager";
import { getMediaSession, pushMediaSessionEvent } from "@/media-service/sessionManager";

export const runtime = "nodejs";

type IceRequest = {
  sessionId?: string;
  candidate?: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as IceRequest | null;
    const sessionId = body?.sessionId?.trim() ?? "";
    const candidate = body?.candidate?.trim() ?? "";

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
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[media-service/ice] failed", err);
    return NextResponse.json(
      { error: "ice_failed", message },
      { status: 500 }
    );
  }
}
