import { v2 as speechV2 } from "@google-cloud/speech";

import { loadGoogleServiceAccount } from "@/lib/googleAuth";
import { detectLanguageFromText } from "@/lib/languageDetect";
import {
  PROVIDER_CONTRACT_VERSION,
  type ProviderCapability,
  type ProviderIdentity,
  type RecognitionSegment,
} from "@/lib/contracts/providers";
import { assembleRecognitionResults } from "@/lib/contracts/recognitionAssembly";

export type SttResult = {
  transcript: string;
  detectedLanguage: string;
  confidence: number | null;
  segments: RecognitionSegment[];
  identity: ProviderIdentity;
  capabilities: ProviderCapability;
  notes: {
    sttApi: "v2";
    model: string;
    languageCodes: string[];
    inputMimeType?: string;
  };
};

export const GOOGLE_STT_CAPABILITIES: ProviderCapability = {
  streaming: false,
  interimResults: false,
  confidence: true,
  wordTiming: false,
  languageTags: true,
  customVocabulary: false,
  cancellation: false,
  regionalProcessing: true,
  usageReporting: false,
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

  const assembled = assembleRecognitionResults(response.results ?? []);
  const transcript = assembled.transcript;
  const confidence = assembled.confidence;
  const labeledLanguage = assembled.labeledLanguage;
  const detectedLanguage =
    labeledLanguage?.trim() || detectLanguageFromText(transcript);

  return {
    transcript,
    detectedLanguage,
    confidence,
    segments: assembled.segments,
    identity: {
      provider: "google",
      operation: "recognize",
      model,
      region: location,
      configurationVersion: "env-v1",
      contractVersion: PROVIDER_CONTRACT_VERSION,
    },
    capabilities: GOOGLE_STT_CAPABILITIES,
    notes: {
      sttApi: "v2",
      model,
      languageCodes,
      inputMimeType,
    },
  };
}
