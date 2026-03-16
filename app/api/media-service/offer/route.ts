import { NextResponse } from "next/server";

import { mediaAcceptOffer } from "@/media-service/peerManager";
import { getMediaSession, pushMediaSessionEvent } from "@/media-service/sessionManager";

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

    console.log("[media-service/offer] incoming", {
      sessionId,
      hasSdp: Boolean(sdp),
      sdpLength: sdp.length,
      type,
    });

    const session = getMediaSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: "not_found", message: "Media session not found" },
        { status: 404 }
      );
    }

    pushMediaSessionEvent(sessionId, "offer_received", {
      type,
      sdpLength: sdp.length,
    });

    const answer = await mediaAcceptOffer({
      sessionId,
      sdp,
      type: "offer",
    });

    return NextResponse.json({
      sessionId,
      answer,
      accepted: true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[media-service/offer] failed", err);
    return NextResponse.json(
      { error: "offer_failed", message },
      { status: 500 }
    );
  }
}
