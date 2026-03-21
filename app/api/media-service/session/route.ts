import { NextResponse } from "next/server";

import {
  closeMediaSession,
  createMediaSession,
  getMediaSession,
  updateMediaSession,
} from "@/media-service/sessionManager";
import { removeOutboundSender } from "@/media-service/outboundAudioTrack";
import { removeListeningState } from "@/media-service/listeningState";

export const runtime = "nodejs";

export async function POST() {
  const session = createMediaSession();
  updateMediaSession(session.id, { status: "signaling" });
  console.log("[media-service/session] created", {
    sessionId: session.id,
    createdAt: session.createdAt,
  });

  return NextResponse.json({
    sessionId: session.id,
    status: "signaling",
    conversationState: "connecting",
    createdAt: session.createdAt,
  });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId")?.trim() ?? "";

  if (!sessionId) {
    return NextResponse.json(
      { error: "bad_request", message: "Missing sessionId" },
      { status: 400 }
    );
  }

  const session = getMediaSession(sessionId);
  if (!session) {
    return NextResponse.json(
      { error: "not_found", message: "Session not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ...session,
    telemetry: {
      hasInboundTrack: Boolean(session.inboundTrack),
      conversationState: session.conversationState,
      inboundTrack: session.inboundTrack ?? null,
      segmentation: session.segmentation ?? null,
      turnWindow: session.turnWindow ?? null,
      processing: session.processing ?? null,
      latestResult: session.latestResult ?? null,
      latestTts: session.latestTts ?? null,
      latestMetrics: session.latestMetrics ?? null,
      outboundAudio: session.outboundAudio ?? null,
      eventCount: session.events.length,
      turnCount: session.turns.length,
      // Full conversation turns for the transcript UI
      turns: session.turns,
    },
  });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId")?.trim() ?? "";

  if (!sessionId) {
    return NextResponse.json(
      { error: "bad_request", message: "Missing sessionId" },
      { status: 400 }
    );
  }

  const session = getMediaSession(sessionId);
  if (!session) {
    return NextResponse.json(
      { error: "not_found", message: "Session not found" },
      { status: 404 }
    );
  }

  removeOutboundSender(sessionId);
  removeListeningState(sessionId);
  closeMediaSession(sessionId);
  return NextResponse.json({ ok: true });
}
