import { NextResponse } from "next/server";

import { synthesizeSpeechBuffer } from "@/lib/services/tts";

export const runtime = "nodejs";

type TtsRequest = {
  text: string;
  languageCode?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as TtsRequest | null;
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
    const message = err instanceof Error ? err.message : "Unknown error";

    const status =
      message.startsWith("Missing text") || message.startsWith("TTS text too long")
        ? 400
        : 500;

    return NextResponse.json(
      { error: "tts_failed", message },
      { status }
    );
  }
}
