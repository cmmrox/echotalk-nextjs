import { NextResponse } from "next/server";

import { addRemoteIceCandidate } from "@/lib/webrtc/serverPeer";
import { getWebRtcSession, pushSessionEvent } from "@/lib/webrtc/sessionRegistry";

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

    console.log("[webrtc/ice] incoming", {
      sessionId,
      hasCandidate: Boolean(candidate),
      candidateLength: candidate.length,
      sdpMid: body?.sdpMid ?? null,
      sdpMLineIndex: body?.sdpMLineIndex ?? null,
    });

    if (!sessionId || !candidate) {
      return NextResponse.json(
        {
          error: "bad_request",
          message: "Expected sessionId and ICE candidate.",
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

    pushSessionEvent(sessionId, "ice_candidate_received", {
      candidateLength: candidate.length,
      sdpMid: body?.sdpMid ?? null,
      sdpMLineIndex: body?.sdpMLineIndex ?? null,
    });

    await addRemoteIceCandidate({
      sessionId,
      candidate,
      sdpMid: body?.sdpMid,
      sdpMLineIndex: body?.sdpMLineIndex,
    });

    return NextResponse.json({ ok: true, mode: "ice-added" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "ice_failed", message },
      { status: 500 }
    );
  }
}
