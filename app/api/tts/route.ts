import { NextResponse } from "next/server";

import { protos, TextToSpeechClient } from "@google-cloud/text-to-speech";

import { loadGoogleServiceAccount } from "@/lib/googleAuth";
import { LIMITS } from "@/lib/limits";

export const runtime = "nodejs";

type TtsRequest = {
  text: string;
  languageCode?: string;
};

function normalizeLanguageCode(languageCode: string | undefined): string {
  const raw = (languageCode ?? "").trim();
  return raw || "en-US";
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as TtsRequest | null;
    const text = body?.text?.trim() ?? "";
    const languageCode = normalizeLanguageCode(body?.languageCode);

    if (!text) {
      return NextResponse.json(
        { error: "bad_request", message: "Missing text" },
        { status: 400 }
      );
    }

    if (text.length > LIMITS.maxTtsTextChars) {
      return NextResponse.json(
        {
          error: "bad_request",
          message: `TTS text too long (max ${LIMITS.maxTtsTextChars} chars).`,
        },
        { status: 400 }
      );
    }

    const sa = await loadGoogleServiceAccount();
    const client = new TextToSpeechClient({
      projectId: sa.project_id,
      credentials: {
        client_email: sa.client_email,
        private_key: sa.private_key,
      },
    });

    const [response] = await client.synthesizeSpeech({
      input: { text },
      voice: {
        languageCode,
        // Let Google pick the best voice for the language.
        ssmlGender:
          protos.google.cloud.texttospeech.v1.SsmlVoiceGender.NEUTRAL,
      },
      audioConfig: {
        audioEncoding: protos.google.cloud.texttospeech.v1.AudioEncoding.MP3,
      },
    });

    const audioContent = response.audioContent;
    if (!audioContent) {
      return NextResponse.json(
        {
          error: "tts_failed",
          message: "No audioContent returned from Google TTS",
        },
        { status: 500 }
      );
    }

    // audioContent may be Buffer | Uint8Array | string (base64) depending on lib.
    const buffer =
      typeof audioContent === "string"
        ? Buffer.from(audioContent, "base64")
        : Buffer.from(audioContent as Uint8Array);

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "tts_failed", message },
      { status: 500 }
    );
  }
}
