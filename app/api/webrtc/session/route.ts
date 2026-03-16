import { NextResponse } from "next/server";

import { closeServerPeer } from "@/lib/webrtc/serverPeer";
import {
  createWebRtcSession,
  getWebRtcSession,
  updateWebRtcSession,
} from "@/lib/webrtc/sessionRegistry";

export const runtime = "nodejs";

export async function POST() {
  const session = createWebRtcSession();
  updateWebRtcSession(session.id, { status: "signaling" });
  console.log("[webrtc/session] created", {
    sessionId: session.id,
    createdAt: session.createdAt,
  });

  return NextResponse.json({
    sessionId: session.id,
    status: "signaling",
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

  const session = getWebRtcSession(sessionId);
  if (!session) {
    return NextResponse.json(
      { error: "not_found", message: "Session not found" },
      { status: 404 }
    );
  }

  return NextResponse.json(session);
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

  const session = getWebRtcSession(sessionId);
  if (!session) {
    return NextResponse.json(
      { error: "not_found", message: "Session not found" },
      { status: 404 }
    );
  }

  closeServerPeer(sessionId);

  return NextResponse.json({ ok: true });
}
