import assert from "node:assert/strict";
import test from "node:test";

import {
  PROVIDER_CONTRACT_VERSION,
  ProviderFailure,
} from "../../../../lib/contracts/providers.ts";
import { ProviderRegistry } from "../../../../lib/contracts/providerRegistry.ts";

test("orchestration can replace its provider bundle with fakes", async () => {
  const fakeRecognizer = {
    capabilities: {
      streaming: false,
      interimResults: false,
      confidence: true,
      wordTiming: false,
      languageTags: true,
      customVocabulary: false,
      cancellation: false,
      requiredFormats: ["audio/wav"],
      regionalProcessing: false,
      configuredRetention: false,
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

  const production = { recognizer: { async recognize() { throw new Error("not used"); } } };
  const fakeBundle = { recognizer: fakeRecognizer };
  const registry = new ProviderRegistry(production);
  const previous = registry.replace(fakeBundle);
  const orchestrationConsumer = async (providers) => providers.recognizer.recognize();
  const result = await orchestrationConsumer(registry.get());
  assert.equal(result.transcript, "synthetic");
  assert.equal(result.identity.contractVersion, "f001-s01-v1");
  assert.equal(previous, production);
});

test("transcript policy explicitly selects accepted text without mutating raw text", () => {
  const recognition = {
    transcript: "raw synthetic",
    detectedLanguage: "en-US",
    segments: [],
  };
  const policy = {
    version: "test-policy-v1",
    apply: (result) => ({
      raw: result.transcript,
      verbatim: result.transcript,
      corrected: "corrected synthetic",
      normalized: null,
      detectedLanguage: result.detectedLanguage,
      segments: result.segments,
    }),
  };
  const forms = policy.apply(recognition);
  const accepted = forms.corrected ?? forms.normalized ?? forms.verbatim;
  assert.equal(forms.raw, "raw synthetic");
  assert.equal(accepted, "corrected synthetic");
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
