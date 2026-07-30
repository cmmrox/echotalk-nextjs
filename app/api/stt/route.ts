import { NextResponse } from "next/server";

import { transcribeAudioBuffer } from "@/lib/services/stt";
import { guardInternalProviderRequest } from "@/lib/http/internalApiGuard";
import { LIMITS } from "@/lib/limits";
import { guardContentLength } from "@/lib/http/mediaSessionGuard";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const rejected = guardInternalProviderRequest(req);
    if (rejected) return rejected;
    const oversized = guardContentLength(req, LIMITS.maxAudioBytes + 64 * 1024);
    if (oversized) return oversized;
    const formData = await req.formData();
    const file = formData.get("audio");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          error: "bad_request",
          message: "Missing 'audio' file field in multipart/form-data.",
        },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.length > LIMITS.maxAudioBytes) {
      return NextResponse.json(
        { error: "payload_too_large", message: "Audio payload exceeds limit" },
        { status: 413 }
      );
    }

    const result = await transcribeAudioBuffer({
      buffer,
      inputMimeType: file.type,
    });

    return NextResponse.json(result);
  } catch (err) {
    const errorClass = err instanceof Error ? err.name : "unknown";
    console.error("[api/stt] failed", { errorClass });
    return NextResponse.json(
      { error: "stt_failed", message: "Recognition service failed" },
      { status: 502 }
    );
  }
}
