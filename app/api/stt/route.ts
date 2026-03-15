import { NextResponse } from "next/server";

import { v2 as speechV2 } from "@google-cloud/speech";

import { loadGoogleServiceAccount } from "@/lib/googleAuth";
import { detectLanguageFromText } from "@/lib/languageDetect";

export const runtime = "nodejs";

function getEnvLanguages(): string[] {
  const raw = process.env.ECHOTALK_LANGUAGES ?? "en-US";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function getSttModel(): string {
  // `chirp_3` is not available in all projects/locations.
  // Default to a widely-available short-audio model.
  return process.env.ECHOTALK_STT_MODEL?.trim() || "latest_short";
}

function getSttLocation(): string {
  return process.env.ECHOTALK_STT_LOCATION?.trim() || "global";
}

export async function POST(req: Request) {
  try {
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

    const languages = getEnvLanguages();
    const languageCodes = languages.slice(0, 3); // v2 auto language rec: recommended up to 3

    const sa = await loadGoogleServiceAccount();

    const location = getSttLocation();

    const client = new speechV2.SpeechClient({
      projectId: sa.project_id,
      credentials: {
        client_email: sa.client_email,
        private_key: sa.private_key,
      },
      ...(location !== "global"
        ? { apiEndpoint: `${location}-speech.googleapis.com` }
        : {}),
    });
    const recognizer = `projects/${sa.project_id}/locations/${location}/recognizers/_`;

    const model = getSttModel();

    const [response] = await client.recognize({
      recognizer,
      config: {
        autoDecodingConfig: {},
        languageCodes,
        model,
      },
      content: buffer,
    });

    const results = response.results ?? [];
    const first = results[0];
    const alt = first?.alternatives?.[0];

    const transcript = alt?.transcript?.trim() ?? "";
    const confidence = alt?.confidence ?? null;

    // V2 labels the result with predicted language code.
    const labeledLanguage = first?.languageCode;
    const detectedLanguage =
      labeledLanguage?.trim() || detectLanguageFromText(transcript);

    return NextResponse.json({
      transcript,
      detectedLanguage,
      confidence,
      notes: {
        sttApi: "v2",
        model,
        languageCodes,
        inputMimeType: file.type,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "stt_failed", message },
      { status: 500 }
    );
  }
}
