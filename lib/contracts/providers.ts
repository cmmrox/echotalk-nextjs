export const PROVIDER_CONTRACT_VERSION = "f001-s01-v1" as const;

export type ProviderCapability = {
  streaming: boolean;
  interimResults: boolean;
  confidence: boolean;
  wordTiming: boolean;
  languageTags: boolean;
  customVocabulary: boolean;
  cancellation: boolean;
  regionalProcessing: boolean;
  usageReporting: boolean;
};

export type ProviderUsage = {
  inputUnits?: number;
  outputUnits?: number;
  audioSeconds?: number;
  characters?: number;
  estimatedCostUsd?: number;
};

export type ProviderIdentity = {
  provider: "google" | "openai" | "fake";
  operation: "recognize" | "respond" | "synthesize";
  model: string;
  region?: string;
  configurationVersion: string;
  contractVersion: typeof PROVIDER_CONTRACT_VERSION;
};

export type ProviderFailureCode =
  | "invalid_input"
  | "unauthorized"
  | "rate_limited"
  | "timeout"
  | "unavailable"
  | "malformed_response"
  | "cancelled"
  | "unknown";

export class ProviderFailure extends Error {
  readonly code: ProviderFailureCode;
  readonly retryable: boolean;
  readonly providerStatus?: number;

  constructor(params: {
    code: ProviderFailureCode;
    message: string;
    retryable: boolean;
    providerStatus?: number;
  }) {
    super(params.message);
    this.name = "ProviderFailure";
    this.code = params.code;
    this.retryable = params.retryable;
    this.providerStatus = params.providerStatus;
  }
}

export type RecognitionSegment = {
  index: number;
  transcript: string;
  languageCode?: string;
  confidence: number | null;
  final: true;
};

export type RecognitionResult = {
  transcript: string;
  detectedLanguage: string;
  confidence: number | null;
  segments: RecognitionSegment[];
  identity: ProviderIdentity;
  capabilities: ProviderCapability;
  usage?: ProviderUsage;
};

export type TranscriptForms = {
  raw: string;
  verbatim: string;
  corrected: string | null;
  normalized: string | null;
  detectedLanguage: string;
  segments: RecognitionSegment[];
};

export type ConversationInputTurn = {
  role: "user" | "assistant";
  text: string;
  language?: string;
};

export type ConversationResult = {
  displayText: string;
  ttsText: string;
  replyLanguage: string;
  identity: ProviderIdentity;
  usage?: ProviderUsage;
};

export type SynthesisResult = {
  audio: Buffer;
  contentType: string;
  languageCode: string;
  identity: ProviderIdentity;
  usage?: ProviderUsage;
};

export interface Recognizer {
  readonly capabilities: ProviderCapability;
  recognize(params: {
    audio: Buffer;
    inputMimeType?: string;
    signal?: AbortSignal;
  }): Promise<RecognitionResult>;
}

export interface TranscriptPolicy {
  readonly version: string;
  apply(result: RecognitionResult): TranscriptForms;
}

export interface ConversationModel {
  readonly capabilities: ProviderCapability;
  respond(params: {
    currentTurn: string;
    detectedLanguage?: string;
    permittedHistory: ConversationInputTurn[];
    idempotencyKey: string;
    signal?: AbortSignal;
    onProviderAttempt?: () => void;
  }): Promise<ConversationResult>;
}

export interface Synthesizer {
  readonly capabilities: ProviderCapability;
  synthesize(params: {
    text: string;
    languageCode?: string;
    signal?: AbortSignal;
  }): Promise<SynthesisResult>;
}
