export type AgentInputTurn = {
  role: "user" | "assistant";
  text: string;
};

export function buildAgentInput(params: {
  currentTurn: string;
  detectedLanguage?: string;
  replyLanguage: string;
  permittedHistory: AgentInputTurn[];
}) {
  const languageHint =
    `Reply language: ${params.replyLanguage}.` +
    (params.detectedLanguage
      ? ` (STT hint: ${params.detectedLanguage})`
      : "");
  return [
    {
      role: "system" as const,
      content:
        "You are EchoTalk, a voice assistant. Reply in the same language as the user's message. Keep it concise and natural.",
    },
    ...params.permittedHistory.map((turn) => ({
      role: turn.role,
      content: turn.text,
    })),
    {
      role: "user" as const,
      content: `${languageHint}\nUser said: ${params.currentTurn}`,
    },
  ];
}
