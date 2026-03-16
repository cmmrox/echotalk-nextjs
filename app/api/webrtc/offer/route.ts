import { NextResponse } from "next/server";

import { acceptOffer } from "@/lib/webrtc/serverPeer";
import { getWebRtcSession, pushSessionEvent } from "@/lib/webrtc/sessionRegistry";

export const runtime = "nodejs";

type OfferRequest = {
  sessionId?: string;
  sdp?: string;
  type?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as OfferRequest | null;
    const sessionId = body?.sessionId?.trim() ?? "";
    const sdp = body?.sdp?.trim() ?? "";
    const type = body?.type?.trim() ?? "offer";

    console.log("[webrtc/offer] incoming", {
      sessionId,
      hasSdp: Boolean(sdp),
      sdpLength: sdp.length,
      type,
    });

    if (!sessionId || !sdp || type !== "offer") {
      return NextResponse.json(
        {
          error: "bad_request",
          message: "Expected sessionId, sdp, and type='offer'.",
        },
        { status: 400 }
      );
    }

    const session = getWebRtcSession(sessionId);
    console.log("[webrtc/offer] session lookup", {
      sessionId,
      found: Boolean(session),
      status: session?.status,
      eventCount: session?.events.length ?? 0,
    });
    if (!session) {
      return NextResponse.json(
        { error: "not_found", message: "Session not found" },
        { status: 404 }
      );
    }

    pushSessionEvent(sessionId, "offer_received", {
      sdpLength: sdp.length,
      type,
    });

    const answer = await acceptOffer({
      sessionId,
      sdp,
      type: "offer",
    });

    console.log("[webrtc/offer] answer created", {
      sessionId,
      answerType: answer.type,
      answerSdpLength: answer.sdp.length,
    });

    return NextResponse.json({
      sessionId,
      answer,
      accepted: true,
      mode: "answer-generated",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[webrtc/offer] failed", err);
    return NextResponse.json(
      { error: "offer_failed", message },
      { status: 500 }
    );
  }
}
