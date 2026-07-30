export type ProviderRecognitionResult = {
  languageCode?: string | null;
  alternatives?: Array<{
    transcript?: string | null;
    confidence?: number | null;
  }> | null;
};

export type AssembledRecognitionSegment = {
  index: number;
  transcript: string;
  languageCode?: string;
  confidence: number | null;
  final: true;
};

export function assembleRecognitionResults(
  results: ProviderRecognitionResult[]
) {
  const segments: AssembledRecognitionSegment[] = results.flatMap(
    (result, index) => {
      const alternative = result.alternatives?.[0];
      const transcript = alternative?.transcript?.trim() ?? "";
      if (!transcript) return [];
      return [{
        index,
        transcript,
        languageCode: result.languageCode?.trim() || undefined,
        confidence:
          typeof alternative?.confidence === "number"
            ? alternative.confidence
            : null,
        final: true as const,
      }];
    }
  );
  const confidences = segments.flatMap((segment) =>
    segment.confidence === null ? [] : [segment.confidence]
  );
  return {
    transcript: segments.map((segment) => segment.transcript).join(" ").trim(),
    segments,
    confidence: confidences.length
      ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length
      : null,
    labeledLanguage:
      segments.find((segment) => segment.languageCode)?.languageCode,
  };
}
