import { NextResponse } from "next/server";

import { getWebRtcSession } from "@/lib/webrtc/sessionRegistry";
import {
  guardInternalProviderRequest,
  readInternalSessionKey,
} from "@/lib/http/internalApiGuard";
import { readBoundedJson } from "@/lib/http/mediaSessionGuard";
import { consumeProviderOperation } from "@/lib/security/providerBudget";
import { getProviderBundle } from "@/lib/services/providerBundle";

export const runtime = "nodejs";

type AgentRequest = {
  transcript: string;
  detectedLanguage?: string;
  sessionId?: string;
};

export async function POST(req: Request) {
  try {
    const rejected = guardInternalProviderRequest(req);
    if (rejected) return rejected;
    const internalSessionKey = readInternalSessionKey(req);
    if (!internalSessionKey) {
      return NextResponse.json(
        { error: "bad_request", message: "Missing internal session identity" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }
    const parsed = await readBoundedJson<AgentRequest>(req);
    if (!parsed.ok) return parsed.response;
    const body = parsed.value;
    const transcript = body?.transcript?.trim() ?? "";
    const detectedLanguage = body?.detectedLanguage?.trim() ?? "";
    const sessionId = body?.sessionId?.trim() ?? "";

    if (!transcript) {
      return NextResponse.json(
        { error: "bad_request", message: "Missing transcript" },
        { status: 400 }
      );
    }

    const session = sessionId ? getWebRtcSession(sessionId) : undefined;
    const recentTurns =
      session?.turns.map((turn) => ({
        role: turn.role,
        text: turn.text,
        language: turn.language,
      })) ?? [];

    const result = await getProviderBundle().conversationModel.respond({
      currentTurn: transcript,
      detectedLanguage,
      permittedHistory: recentTurns,
      idempotencyKey: `legacy:${internalSessionKey}:${Date.now()}`,
      onProviderAttempt: () => {
        consumeProviderOperation(internalSessionKey, "respond");
      },
    });

    return NextResponse.json({
      replyText: result.displayText,
      replyLanguage: result.replyLanguage,
      identity: result.identity,
      usage: result.usage,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const errorClass = err instanceof Error ? err.name : "unknown";
    console.error("[api/agent] failed", { errorClass });
    const budgetExceeded = errorClass === "ProviderBudgetExceeded";
    return NextResponse.json(
      {
        error: budgetExceeded ? "provider_budget_exceeded" : "agent_failed",
        message: "Conversation service failed",
      },
      {
        status: budgetExceeded ? 429 : 502,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}
