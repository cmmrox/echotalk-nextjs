import assert from "node:assert/strict";
import test from "node:test";

import { assembleRecognitionResults } from "../../../../lib/contracts/recognitionAssembly.ts";

test("assembles every non-empty final segment once and in provider order", () => {
  const result = assembleRecognitionResults([
    {
      languageCode: "si-LK",
      alternatives: [{ transcript: "ආයුබෝවන්", confidence: 0.8 }],
    },
    {
      languageCode: "si-LK",
      alternatives: [{ transcript: " කොහොමද? ", confidence: 1 }],
    },
    { alternatives: [{ transcript: "   ", confidence: 0.1 }] },
  ]);

  assert.equal(result.transcript, "ආයුබෝවන් කොහොමද?");
  assert.deepEqual(
    result.segments.map((segment) => segment.index),
    [0, 1]
  );
  assert.equal(result.confidence, 0.9);
  assert.equal(result.labeledLanguage, "si-LK");
});

test("preserves an explicit null confidence when provider confidence is absent", () => {
  const result = assembleRecognitionResults([
    { alternatives: [{ transcript: "hello" }] },
  ]);
  assert.equal(result.confidence, null);
});
