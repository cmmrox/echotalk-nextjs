import { NextResponse } from "next/server";

import {
  guardInternalProviderRequest,
  readInternalSessionKey,
} from "@/lib/http/internalApiGuard";
import { readBoundedJson } from "@/lib/http/mediaSessionGuard";
import { consumeProviderOperation } from "@/lib/security/providerBudget";
import { getProviderBundle } from "@/lib/services/providerBundle";

export const runtime = "nodejs";

type TtsRequest = {
  text: string;
  languageCode?: string;
};

export async function POST(req: Request) {
  try {
    const rejected = guardInternalProviderRequest(req);
    if (rejected) return rejected;
    const sessionKey = readInternalSessionKey(req);
    if (!sessionKey) {
      return NextResponse.json(
        { error: "bad_request", message: "Missing internal session identity" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }
    const parsed = await readBoundedJson<TtsRequest>(req);
    if (!parsed.ok) return parsed.response;
    const body = parsed.value;
    const text = body?.text?.trim() ?? "";
    const languageCode = body?.languageCode;

    consumeProviderOperation(sessionKey, "synthesize");
    const result = await getProviderBundle().synthesizer.synthesize({
      text,
      languageCode,
    });

    return new Response(new Uint8Array(result.audio), {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const errorClass = err instanceof Error ? err.name : "unknown";
    console.error("[api/tts] failed", { errorClass });

    const budgetExceeded = errorClass === "ProviderBudgetExceeded";
    return NextResponse.json(
      {
        error: budgetExceeded ? "provider_budget_exceeded" : "tts_failed",
        message: "Synthesis service failed",
      },
      {
        status: budgetExceeded ? 429 : 502,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}
