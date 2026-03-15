import { NextResponse } from "next/server";

import { detectLanguageFromText } from "@/lib/languageDetect";
import { LIMITS } from "@/lib/limits";
import { getOpenAIClient, getOpenAIModel } from "@/lib/openai";

export const runtime = "nodejs";

type AgentRequest = {
  transcript: string;
  detectedLanguage?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as AgentRequest | null;
    const transcript = body?.transcript?.trim() ?? "";
    const detectedLanguage = body?.detectedLanguage?.trim() ?? "";
    const replyLanguage = detectLanguageFromText(transcript);

    if (!transcript) {
      return NextResponse.json(
        { error: "bad_request", message: "Missing transcript" },
        { status: 400 }
      );
    }

    if (transcript.length > LIMITS.maxTranscriptChars) {
      return NextResponse.json(
        {
          error: "bad_request",
          message: `Transcript too long (max ${LIMITS.maxTranscriptChars} chars).`,
        },
        { status: 400 }
      );
    }

    const client = getOpenAIClient();
    const model = getOpenAIModel();

    // `detectedLanguage` coming from STT may be unreliable (often falls back to primary).
    // Prefer deterministic detection from transcript, and keep `detectedLanguage` only as a hint.
    const languageHint = `Reply language: ${replyLanguage}.` +
      (detectedLanguage ? ` (STT hint: ${detectedLanguage})` : "");

    const response = await client.responses.create({
      model,
      input: [
        {
          role: "system",
          content:
            "You are EchoTalk, a voice assistant. Reply in the same language as the user's message. Keep it concise and natural.",
        },
        {
          role: "user",
          content: `${languageHint}\nUser said: ${transcript}`,
        },
      ],
      // Keep MVP snappy/cheap.
      max_output_tokens: 250,
    });

    let replyText = (response.output_text ?? "").trim();
    if (replyText.length > LIMITS.maxAgentReplyChars) {
      replyText = replyText.slice(0, LIMITS.maxAgentReplyChars);
    }

    return NextResponse.json({ replyText, replyLanguage });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "agent_failed", message },
      { status: 500 }
    );
  }
}
