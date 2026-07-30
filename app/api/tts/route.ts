import { NextResponse } from "next/server";

import { synthesizeSpeechBuffer } from "@/lib/services/tts";
import { guardInternalProviderRequest } from "@/lib/http/internalApiGuard";
import { readBoundedJson } from "@/lib/http/mediaSessionGuard";

export const runtime = "nodejs";

type TtsRequest = {
  text: string;
  languageCode?: string;
};

export async function POST(req: Request) {
  try {
    const rejected = guardInternalProviderRequest(req);
    if (rejected) return rejected;
    const parsed = await readBoundedJson<TtsRequest>(req);
    if (!parsed.ok) return parsed.response;
    const body = parsed.value;
    const text = body?.text?.trim() ?? "";
    const languageCode = body?.languageCode;

    const result = await synthesizeSpeechBuffer({ text, languageCode });

    return new Response(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const errorClass = err instanceof Error ? err.name : "unknown";
    console.error("[api/tts] failed", { errorClass });

    return NextResponse.json(
      { error: "tts_failed", message: "Synthesis service failed" },
      { status: 502 }
    );
  }
}
