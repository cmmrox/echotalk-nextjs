import { NextResponse } from "next/server";

import {
  createMediaSession,
  getMediaSession,
  updateMediaSession,
} from "@/media-service/sessionManager";
import { cleanupMediaSession } from "@/media-service/sessionCleanup";
import { getLatestTurnRecord } from "@/media-service/turnRecords";
import { guardMediaSessionRequest } from "@/lib/http/mediaSessionGuard";
import { LIMITS } from "@/lib/limits";
import { issueSessionToken } from "@/lib/security/sessionAuthorization";
import {
  clientAddress,
  consumeRequestBudget,
} from "@/lib/security/requestLimits";
import { isF001Enabled } from "@/lib/config/featureFlags";
import { initializeSessionWork } from "@/media-service/sessionWork";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!isF001Enabled()) {
    return NextResponse.json(
      { error: "feature_disabled", message: "Voice sessions are disabled" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
  const budget = consumeRequestBudget({
    key: `session-create:${clientAddress(req)}`,
    limit: LIMITS.maxSessionCreationsPerMinute,
  });
  if (!budget.allowed) {
    return NextResponse.json(
      { error: "rate_limited", message: "Session creation limit exceeded" },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(budget.retryAfterSeconds),
        },
      }
    );
  }

  const session = createMediaSession();
  initializeSessionWork(session.id);
  const sessionToken = issueSessionToken(session.id);
  updateMediaSession(session.id, { status: "signaling" });
  console.log("[media-service/session] created", {
    sessionId: session.id,
    createdAt: session.createdAt,
  });

  return NextResponse.json({
    sessionId: session.id,
    sessionToken,
    status: "signaling",
    conversationState: "connecting",
    createdAt: session.createdAt,
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId")?.trim() ?? "";

  const rejected = guardMediaSessionRequest(req, sessionId);
  if (rejected) return rejected;

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
      latestTurnRecord: getLatestTurnRecord(sessionId),
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

  const rejected = guardMediaSessionRequest(req, sessionId, {
    allowWhenDisabled: true,
  });
  if (rejected) return rejected;

  const session = getMediaSession(sessionId);
  if (!session) {
    return NextResponse.json(
      { error: "not_found", message: "Session not found" },
      { status: 404 }
    );
  }

  cleanupMediaSession(sessionId);
  return NextResponse.json({ ok: true });
}
