import { detectLanguageFromText } from "@/lib/languageDetect";
import { LIMITS } from "@/lib/limits";
import { getOpenAIClient, getOpenAIModel } from "@/lib/openai";
import {
  PROVIDER_CONTRACT_VERSION,
  type ProviderIdentity,
  type ProviderUsage,
} from "@/lib/contracts/providers";
import { buildAgentInput } from "@/lib/contracts/agentInput";

export type ConversationTurn = {
  role: "user" | "assistant";
  text: string;
  language?: string;
};

export type AgentReply = {
  replyText: string;
  replyLanguage: string;
  identity: ProviderIdentity;
  usage?: ProviderUsage;
};

export async function generateAgentReply(params: {
  transcript: string;
  detectedLanguage?: string;
  recentTurns?: ConversationTurn[];
  idempotencyKey?: string;
}): Promise<AgentReply> {
  const transcript = params.transcript.trim();
  const detectedLanguage = params.detectedLanguage?.trim() ?? "";
  const recentTurns = params.recentTurns ?? [];
  const replyLanguage = detectLanguageFromText(transcript);

  if (!transcript) {
    throw new Error("Missing transcript");
  }

  if (transcript.length > LIMITS.maxTranscriptChars) {
    throw new Error(
      `Transcript too long (max ${LIMITS.maxTranscriptChars} chars).`
    );
  }

  const client = getOpenAIClient();
  const model = getOpenAIModel();

  const input = buildAgentInput({
    currentTurn: transcript,
    detectedLanguage,
    replyLanguage,
    permittedHistory: recentTurns,
  });

  // Retry up to 3 times on 429 (rate limit) or 503 (overloaded) with backoff.
  const MAX_RETRIES = 3;
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delayMs = 1000 * Math.pow(2, attempt - 1); // 1s, 2s
      console.warn(`[agent] retrying after ${delayMs}ms (attempt ${attempt + 1})`);
      await new Promise((r) => setTimeout(r, delayMs));
    }

    try {
      const response = await client.responses.create(
        {
          model,
          input,
          max_output_tokens: 250,
        },
        params.idempotencyKey
          ? { idempotencyKey: params.idempotencyKey }
          : undefined
      );

      let replyText = (response.output_text ?? "").trim();
      if (replyText.length > LIMITS.maxAgentReplyChars) {
        replyText = replyText.slice(0, LIMITS.maxAgentReplyChars);
      }

      const usage = response.usage
        ? {
            inputUnits: response.usage.input_tokens,
            outputUnits: response.usage.output_tokens,
          }
        : undefined;

      return {
        replyText,
        replyLanguage,
        identity: {
          provider: "openai",
          operation: "respond",
          model,
          configurationVersion: "prompt-v1",
          contractVersion: PROVIDER_CONTRACT_VERSION,
        },
        usage,
      };
    } catch (err) {
      lastError = err;
      const status = (err as { status?: number })?.status;
      const message = (err as { message?: string })?.message ?? "";
      const isRetryable =
        status === 429 ||
        status === 503 ||
        message.toLowerCase().includes("overloaded") ||
        message.toLowerCase().includes("rate limit");

      if (!isRetryable || attempt === MAX_RETRIES - 1) throw err;
      console.warn("[agent] retryable provider failure", {
        status: status ?? null,
        errorClass: err instanceof Error ? err.name : "unknown",
      });
    }
  }

  throw lastError;
}
