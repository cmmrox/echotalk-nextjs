import { detectLanguageFromText } from "@/lib/languageDetect";
import { LIMITS } from "@/lib/limits";
import { getOpenAIClient, getOpenAIModel } from "@/lib/openai";

export type ConversationTurn = {
  role: "user" | "assistant";
  text: string;
  language?: string;
};

export type AgentReply = {
  replyText: string;
  replyLanguage: string;
};

export async function generateAgentReply(params: {
  transcript: string;
  detectedLanguage?: string;
  recentTurns?: ConversationTurn[];
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

  const languageHint = `Reply language: ${replyLanguage}.` +
    (detectedLanguage ? ` (STT hint: ${detectedLanguage})` : "");

  const input = [
    {
      role: "system" as const,
      content:
        "You are EchoTalk, a voice assistant. Reply in the same language as the user's message. Keep it concise and natural.",
    },
    ...recentTurns.map((turn) => ({
      role: turn.role,
      content: turn.text,
    })),
    {
      role: "user" as const,
      content: `${languageHint}\nUser said: ${transcript}`,
    },
  ];

  const response = await client.responses.create({
    model,
    input,
    max_output_tokens: 250,
  });

  let replyText = (response.output_text ?? "").trim();
  if (replyText.length > LIMITS.maxAgentReplyChars) {
    replyText = replyText.slice(0, LIMITS.maxAgentReplyChars);
  }

  return { replyText, replyLanguage };
}
