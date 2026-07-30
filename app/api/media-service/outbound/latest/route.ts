import { NextResponse } from "next/server";

import {
  getOutboundDeliveryState,
  markOutboundDelivered,
} from "@/media-service/outboundDelivery";
import { getLatestStoredTtsAudio } from "@/media-service/ttsStore";
import { guardMediaSessionRequest } from "@/lib/http/mediaSessionGuard";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId")?.trim() ?? "";
  const markDelivered = searchParams.get("markDelivered") === "1";
  const expectedTurnNumber = Number(searchParams.get("turnNumber"));

  const rejected = guardMediaSessionRequest(req, sessionId);
  if (rejected) return rejected;

  const delivery = getOutboundDeliveryState(sessionId);
  const latestTts = getLatestStoredTtsAudio(sessionId);

  console.log("[media-service/outbound/latest] request", {
    sessionId,
    markDelivered,
    expectedTurnNumber: Number.isFinite(expectedTurnNumber) ? expectedTurnNumber : null,
    hasDelivery: Boolean(delivery),
    hasLatestTts: Boolean(latestTts),
  });

  if (!delivery || !latestTts) {
    return NextResponse.json(
      { error: "not_found", message: "No outbound audio prepared for session" },
      { status: 404 }
    );
  }

  if (markDelivered) {
    markOutboundDelivered(
      sessionId,
      Number.isFinite(expectedTurnNumber) ? expectedTurnNumber : undefined
    );
  }

  return new Response(Buffer.from(latestTts.audioBase64, "base64"), {
    status: 200,
    headers: {
      "Content-Type": latestTts.contentType,
      "Cache-Control": "no-store",
      "X-EchoTalk-Turn": String(latestTts.turnNumber),
    },
  });
}
