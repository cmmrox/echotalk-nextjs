import { protos, TextToSpeechClient } from "@google-cloud/text-to-speech";

import { loadGoogleServiceAccount } from "@/lib/googleAuth";
import { LIMITS } from "@/lib/limits";

function normalizeLanguageCode(languageCode: string | undefined): string {
  const raw = (languageCode ?? "").trim();
  return raw || "en-US";
}

// Cached singleton — avoids re-creating the gRPC connection on every call.
let _ttsClient: TextToSpeechClient | null = null;

async function getTtsClient(): Promise<TextToSpeechClient> {
  if (_ttsClient) return _ttsClient;
  const sa = await loadGoogleServiceAccount();
  _ttsClient = new TextToSpeechClient({
    projectId: sa.project_id,
    credentials: {
      client_email: sa.client_email,
      private_key: sa.private_key,
    },
  });
  return _ttsClient;
}

export async function synthesizeSpeechBuffer(params: {
  text: string;
  languageCode?: string;
}): Promise<{ buffer: Buffer; languageCode: string; contentType: string }> {
  const text = params.text.trim();
  const languageCode = normalizeLanguageCode(params.languageCode);

  if (!text) {
    throw new Error("Missing text");
  }

  if (text.length > LIMITS.maxTtsTextChars) {
    throw new Error(`TTS text too long (max ${LIMITS.maxTtsTextChars} chars).`);
  }

  const client = await getTtsClient();
  const [response] = await client.synthesizeSpeech({
    input: { text },
    voice: {
      languageCode,
      ssmlGender: protos.google.cloud.texttospeech.v1.SsmlVoiceGender.NEUTRAL,
    },
    audioConfig: {
      audioEncoding: protos.google.cloud.texttospeech.v1.AudioEncoding.MP3,
    },
  });

  const audioContent = response.audioContent;
  if (!audioContent) {
    throw new Error("No audioContent returned from Google TTS");
  }

  const buffer =
    typeof audioContent === "string"
      ? Buffer.from(audioContent, "base64")
      : Buffer.from(audioContent as Uint8Array);

  return {
    buffer,
    languageCode,
    contentType: "audio/mpeg",
  };
}
