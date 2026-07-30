import assert from "node:assert/strict";
import test from "node:test";

import {
  PROVIDER_CONTRACT_VERSION,
  ProviderFailure,
} from "../../../../lib/contracts/providers.ts";

test("orchestration-facing fake can implement the recognizer contract shape", async () => {
  const fakeRecognizer = {
    capabilities: {
      streaming: false,
      interimResults: false,
      confidence: true,
      wordTiming: false,
      languageTags: true,
      customVocabulary: false,
      cancellation: false,
      regionalProcessing: false,
      usageReporting: true,
    },
    async recognize() {
      return {
        transcript: "synthetic",
        detectedLanguage: "en-US",
        confidence: 1,
        segments: [{
          index: 0,
          transcript: "synthetic",
          languageCode: "en-US",
          confidence: 1,
          final: true,
        }],
        identity: {
          provider: "fake",
          operation: "recognize",
          model: "fixture",
          configurationVersion: "fixture-v1",
          contractVersion: PROVIDER_CONTRACT_VERSION,
        },
        capabilities: fakeRecognizer.capabilities,
      };
    },
  };

  const result = await fakeRecognizer.recognize();
  assert.equal(result.transcript, "synthetic");
  assert.equal(result.identity.contractVersion, "f001-s01-v1");
});

test("normalized provider failures expose bounded classification", () => {
  const failure = new ProviderFailure({
    code: "rate_limited",
    message: "synthetic provider limit",
    retryable: true,
    providerStatus: 429,
  });
  assert.equal(failure.code, "rate_limited");
  assert.equal(failure.retryable, true);
});
