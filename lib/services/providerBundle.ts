import {
  ProviderFailure,
  type ConversationModel,
  type ProviderFailureCode,
  type Recognizer,
  type Synthesizer,
  type TranscriptPolicy,
} from "@/lib/contracts/providers";
import { ProviderRegistry } from "@/lib/contracts/providerRegistry";
import { generateAgentReply } from "@/lib/services/agent";
import { transcribeAudioBuffer } from "@/lib/services/stt";
import { synthesizeSpeechBuffer } from "@/lib/services/tts";
import { assertF001Enabled } from "@/lib/config/featureFlags";

export type ProviderBundle = {
  recognizer: Recognizer;
  transcriptPolicy: TranscriptPolicy;
  conversationModel: ConversationModel;
  synthesizer: Synthesizer;
};

function failureCode(error: unknown): ProviderFailureCode {
  const status = (error as { status?: number })?.status;
  const name = error instanceof Error ? error.name : "";
  if (name === "AbortError") return "cancelled";
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 429) return "rate_limited";
  if (status === 408 || name === "TimeoutError") return "timeout";
  if (status === 502 || status === 503 || status === 504) return "unavailable";
  return "unknown";
}

function normalizeFailure(error: unknown) {
  if (error instanceof ProviderFailure) return error;
  const code = failureCode(error);
  const status = (error as { status?: number })?.status;
  return new ProviderFailure({
    code,
    message: `Provider ${code}`,
    retryable: ["rate_limited", "timeout", "unavailable"].includes(code),
    providerStatus: status,
  });
}

async function withDeadline<T>(params: {
  signal?: AbortSignal;
  timeoutMs: number;
  operation: (signal: AbortSignal) => Promise<T>;
}) {
  const controller = new AbortController();
  const abort = () => controller.abort(params.signal?.reason);
  params.signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(
    () => controller.abort(new DOMException("Provider deadline", "TimeoutError")),
    params.timeoutMs
  );
  const cancelled = new Promise<never>((_, reject) => {
    controller.signal.addEventListener(
      "abort",
      () => reject(
        controller.signal.reason ??
          new DOMException("Provider cancelled", "AbortError")
      ),
      { once: true }
    );
  });
  try {
    if (params.signal?.aborted) abort();
    return await Promise.race([
      params.operation(controller.signal),
      cancelled,
    ]);
  } catch (error) {
    throw normalizeFailure(error);
  } finally {
    clearTimeout(timeout);
    params.signal?.removeEventListener("abort", abort);
  }
}

const recognizer: Recognizer = {
  capabilities: {
    streaming: false,
    interimResults: false,
    confidence: true,
    wordTiming: false,
    languageTags: true,
    customVocabulary: false,
    cancellation: false,
    requiredFormats: ["audio/ogg; codecs=opus", "audio/wav"],
    regionalProcessing: true,
    configuredRetention: false,
    usageReporting: false,
  },
  recognize: ({ audio, inputMimeType, signal }) => {
    assertF001Enabled();
    return withDeadline({
      signal,
      timeoutMs: 20_000,
      operation: async () => transcribeAudioBuffer({
        buffer: audio,
        inputMimeType,
      }),
    });
  },
};

const transcriptPolicy: TranscriptPolicy = {
  version: "verbatim-v1",
  apply: (result) => ({
    raw: result.transcript,
    verbatim: result.transcript,
    corrected: null,
    normalized: null,
    detectedLanguage: result.detectedLanguage,
    segments: result.segments,
  }),
};

const conversationModel: ConversationModel = {
  capabilities: {
    streaming: false,
    interimResults: false,
    confidence: false,
    wordTiming: false,
    languageTags: true,
    customVocabulary: false,
    cancellation: true,
    requiredFormats: ["text/plain"],
    regionalProcessing: false,
    configuredRetention: false,
    usageReporting: true,
  },
  respond: ({
    currentTurn,
    detectedLanguage,
    permittedHistory,
    idempotencyKey,
    signal,
    onProviderAttempt,
  }) => {
    assertF001Enabled();
    return withDeadline({
      signal,
      timeoutMs: 25_000,
      operation: async (deadlineSignal) => {
        const result = await generateAgentReply({
          transcript: currentTurn,
          detectedLanguage,
          recentTurns: permittedHistory,
          idempotencyKey,
          signal: deadlineSignal,
          beforeProviderAttempt: onProviderAttempt,
        });
        return {
          displayText: result.replyText,
          ttsText: result.replyText,
          replyLanguage: result.replyLanguage,
          identity: result.identity,
          usage: result.usage,
        };
      },
    });
  },
};

const synthesizer: Synthesizer = {
  capabilities: {
    streaming: false,
    interimResults: false,
    confidence: false,
    wordTiming: false,
    languageTags: true,
    customVocabulary: false,
    cancellation: false,
    requiredFormats: ["audio/mpeg"],
    regionalProcessing: false,
    configuredRetention: false,
    usageReporting: true,
  },
  synthesize: ({ text, languageCode, signal }) => {
    assertF001Enabled();
    return withDeadline({
      signal,
      timeoutMs: 20_000,
      operation: async () => {
        const result = await synthesizeSpeechBuffer({ text, languageCode });
        return {
          audio: result.buffer,
          contentType: result.contentType,
          languageCode: result.languageCode,
          identity: result.identity,
          usage: result.usage,
        };
      },
    });
  },
};

const defaultBundle: ProviderBundle = {
  recognizer,
  transcriptPolicy,
  conversationModel,
  synthesizer,
};

const registry = new ProviderRegistry(defaultBundle);

export function getProviderBundle() {
  return registry.get();
}

export function replaceProviderBundleForTests(bundle: ProviderBundle) {
  return registry.replace(bundle);
}

export function restoreDefaultProviderBundle() {
  registry.replace(defaultBundle);
}
