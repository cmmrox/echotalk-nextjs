import { NextResponse } from "next/server";

import { generateAgentReply } from "@/lib/services/agent";
import { getWebRtcSession } from "@/lib/webrtc/sessionRegistry";

export const runtime = "nodejs";

type AgentRequest = {
  transcript: string;
  detectedLanguage?: string;
  sessionId?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as AgentRequest | null;
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

    const result = await generateAgentReply({
      transcript,
      detectedLanguage,
      recentTurns,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "agent_failed", message },
      { status: 500 }
    );
  }
}
