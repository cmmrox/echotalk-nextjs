import { v2 as speechV2 } from "@google-cloud/speech";

import { loadGoogleServiceAccount } from "@/lib/googleAuth";
import { detectLanguageFromText } from "@/lib/languageDetect";

export type SttResult = {
  transcript: string;
  detectedLanguage: string;
  confidence: number | null;
  notes: {
    sttApi: "v2";
    model: string;
    languageCodes: string[];
    inputMimeType?: string;
  };
};

function getEnvLanguages(): string[] {
  const raw = process.env.ECHOTALK_LANGUAGES ?? "en-US";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function getSttModel(): string {
  return process.env.ECHOTALK_STT_MODEL?.trim() || "latest_short";
}

function getSttLocation(): string {
  return process.env.ECHOTALK_STT_LOCATION?.trim() || "global";
}

// Cached singleton — avoids re-creating the gRPC connection on every call.
let _sttBundle: { client: speechV2.SpeechClient; projectId: string } | null = null;

async function getSttBundle() {
  if (_sttBundle) return _sttBundle;
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
  _sttBundle = { client, projectId: sa.project_id };
  return _sttBundle;
}

export async function transcribeAudioBuffer(params: {
  buffer: Buffer;
  inputMimeType?: string;
}): Promise<SttResult> {
  const { buffer, inputMimeType } = params;

  const languages = getEnvLanguages();
  const languageCodes = languages.slice(0, 3);
  const location = getSttLocation();
  const { client, projectId } = await getSttBundle();

  const recognizer = `projects/${projectId}/locations/${location}/recognizers/_`;
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
  const labeledLanguage = first?.languageCode;
  const detectedLanguage =
    labeledLanguage?.trim() || detectLanguageFromText(transcript);

  return {
    transcript,
    detectedLanguage,
    confidence,
    notes: {
      sttApi: "v2",
      model,
      languageCodes,
      inputMimeType,
    },
  };
}
