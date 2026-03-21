import { NextResponse } from "next/server";

import { getLatestStoredTtsAudio } from "@/media-service/ttsStore";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId")?.trim() ?? "";

  if (!sessionId) {
    return NextResponse.json(
      { error: "bad_request", message: "Missing sessionId" },
      { status: 400 }
    );
  }

  const latest = getLatestStoredTtsAudio(sessionId);
  if (!latest) {
    return NextResponse.json(
      { error: "not_found", message: "No TTS audio found for session" },
      { status: 404 }
    );
  }

  return new Response(Buffer.from(latest.audioBase64, "base64"), {
    status: 200,
    headers: {
      "Content-Type": latest.contentType,
      "Cache-Control": "no-store",
      "X-EchoTalk-Turn": String(latest.turnNumber),
    },
  });
}
