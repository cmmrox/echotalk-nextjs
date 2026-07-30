import { NextResponse } from "next/server";

import {
  guardInternalProviderRequest,
  readInternalSessionKey,
} from "@/lib/http/internalApiGuard";
import { readBoundedBytes } from "@/lib/http/mediaSessionGuard";
import { LIMITS } from "@/lib/limits";
import { consumeProviderOperation } from "@/lib/security/providerBudget";
import { getProviderBundle } from "@/lib/services/providerBundle";

export const runtime = "nodejs";

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

    const bounded = await readBoundedBytes(req, LIMITS.maxAudioBytes + 64 * 1024);
    if (!bounded.ok) return bounded.response;
    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
      return NextResponse.json(
        { error: "bad_request", message: "Expected multipart audio payload" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }
    const boundedRequest = new Request(req.url, {
      method: "POST",
      headers: { "content-type": contentType },
      body: new Uint8Array(bounded.value),
    });
    const formData = await boundedRequest.formData();
    const file = formData.get("audio");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "bad_request", message: "Missing 'audio' file field" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length > LIMITS.maxAudioBytes) {
      return NextResponse.json(
        { error: "payload_too_large", message: "Audio payload exceeds limit" },
        { status: 413, headers: { "Cache-Control": "no-store" } }
      );
    }

    consumeProviderOperation(sessionKey, "recognize");
    const providers = getProviderBundle();
    const result = await providers.recognizer.recognize({
      audio: buffer,
      inputMimeType: file.type,
    });
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const errorClass = error instanceof Error ? error.name : "unknown";
    console.error("[api/stt] failed", { errorClass });
    return NextResponse.json(
      {
        error: errorClass === "ProviderBudgetExceeded"
          ? "provider_budget_exceeded"
          : "stt_failed",
        message: "Recognition service failed",
      },
      {
        status: errorClass === "ProviderBudgetExceeded" ? 429 : 502,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}
