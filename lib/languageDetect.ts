export type EchoTalkLanguageCode = "en-US" | "si-LK" | "ta-LK";

// Very small, deterministic heuristic.
// We can expand later with a proper language detector (franc/cld3) if needed.
export function detectLanguageFromText(text: string): EchoTalkLanguageCode {
  const t = text ?? "";

  // Sinhala block: U+0D80–U+0DFF
  if (/[\u0D80-\u0DFF]/.test(t)) return "si-LK";

  // Tamil block: U+0B80–U+0BFF
  if (/[\u0B80-\u0BFF]/.test(t)) return "ta-LK";

  return "en-US";
}
