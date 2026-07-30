import { NextResponse } from "next/server";

import { mediaAcceptOffer } from "@/media-service/peerManager";
import { getMediaSession, pushMediaSessionEvent } from "@/media-service/sessionManager";
import {
  guardMediaSessionRequest,
  readBoundedJson,
} from "@/lib/http/mediaSessionGuard";
import { LIMITS } from "@/lib/limits";

export const runtime = "nodejs";

type OfferRequest = {
  sessionId?: string;
  sdp?: string;
  type?: string;
};

export async function POST(req: Request) {
  try {
    const parsed = await readBoundedJson<OfferRequest>(
      req,
      LIMITS.maxSdpChars + 4096
    );
    if (!parsed.ok) return parsed.response;
    const body = parsed.value;
    const sessionId = body?.sessionId?.trim() ?? "";
    const sdp = body?.sdp?.trim() ?? "";
    const type = body?.type?.trim() ?? "offer";
    const rejected = guardMediaSessionRequest(req, sessionId);
    if (rejected) return rejected;
    if (!sdp || sdp.length > LIMITS.maxSdpChars || type !== "offer") {
      return NextResponse.json(
        { error: "bad_request", message: "Invalid WebRTC offer" },
        { status: 400 }
      );
    }

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
    const errorClass = err instanceof Error ? err.name : "unknown";
    console.error("[media-service/offer] failed", { errorClass });
    return NextResponse.json(
      { error: "offer_failed", message: "WebRTC offer processing failed" },
      { status: 502 }
    );
  }
}
