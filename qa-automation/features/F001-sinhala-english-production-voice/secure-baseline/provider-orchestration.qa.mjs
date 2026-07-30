import assert from "node:assert/strict";
import test from "node:test";

import { PROVIDER_CONTRACT_VERSION } from "../../../../lib/contracts/providers.ts";
import {
  replaceProviderBundleForTests,
  restoreDefaultProviderBundle,
} from "../../../../lib/services/providerBundle.ts";
import { runProcessingPipeline } from "../../../../media-service/pipeline.ts";
import {
  createMediaSession,
  getMediaSession,
} from "../../../../media-service/sessionManager.ts";
import { cleanupMediaSession } from "../../../../media-service/sessionCleanup.ts";
import { appendTurnAudio } from "../../../../media-service/turnAudioStore.ts";
import { getTurnRecord } from "../../../../media-service/turnRecords.ts";
import { initializeSessionWork } from "../../../../media-service/sessionWork.ts";

const capabilities = {
  streaming: false,
  interimResults: false,
  confidence: true,
  wordTiming: false,
  languageTags: true,
  customVocabulary: false,
  cancellation: true,
  requiredFormats: ["audio/ogg"],
  regionalProcessing: false,
  configuredRetention: false,
  usageReporting: true,
};

function identity(operation) {
  return {
    provider: "fake",
    operation,
    model: `qa-${operation}`,
    configurationVersion: "qa-v1",
    contractVersion: PROVIDER_CONTRACT_VERSION,
  };
}

test("the real pipeline runs entirely through an injected provider bundle", async () => {
  const calls = [];
  const fakeBundle = {
    recognizer: {
      capabilities,
      async recognize({ audio, inputMimeType, signal }) {
        calls.push(["recognize", inputMimeType, audio.length, signal?.aborted]);
        return {
          transcript: "synthetic current turn",
          detectedLanguage: "en-US",
          confidence: 0.75,
          segments: [{
            index: 0,
            transcript: "synthetic current turn",
            languageCode: "en-US",
            confidence: 0.75,
            final: true,
          }],
          identity: identity("recognize"),
          capabilities,
          usage: { audioSeconds: 0.4, estimatedCostUsd: 0.001 },
        };
      },
    },
    transcriptPolicy: {
      version: "qa-verbatim-v1",
      apply(result) {
        calls.push(["policy", result.transcript]);
        return {
          raw: result.transcript,
          verbatim: result.transcript,
          corrected: null,
          normalized: null,
          detectedLanguage: result.detectedLanguage,
          segments: result.segments,
        };
      },
    },
    conversationModel: {
      capabilities,
      async respond({ currentTurn, permittedHistory, onProviderAttempt, signal }) {
        onProviderAttempt?.();
        calls.push([
          "respond",
          currentTurn,
          permittedHistory.length,
          signal?.aborted,
        ]);
        return {
          displayText: "synthetic reply",
          ttsText: "synthetic reply",
          replyLanguage: "en-US",
          identity: identity("respond"),
          usage: { inputUnits: 4, outputUnits: 2, estimatedCostUsd: 0.002 },
        };
      },
    },
    synthesizer: {
      capabilities,
      async synthesize({ text, languageCode, signal }) {
        calls.push(["synthesize", text, languageCode, signal?.aborted]);
        return {
          audio: Buffer.from("synthetic audio"),
          contentType: "audio/mpeg",
          languageCode,
          identity: identity("synthesize"),
          usage: { characters: text.length, estimatedCostUsd: 0.003 },
        };
      },
    },
  };

  const previousFlag = process.env.ECHOTALK_F001_ENABLED;
  const session = createMediaSession();
  initializeSessionWork(session.id);
  appendTurnAudio(session.id, {
    turnNumber: 1,
    mimeType: "audio/ogg",
    frames: Array.from({ length: 20 }, () => Buffer.alloc(24, 1)),
  });
  replaceProviderBundleForTests(fakeBundle);
  process.env.ECHOTALK_F001_ENABLED = "true";

  try {
    const outcome = await runProcessingPipeline({
      sessionId: session.id,
      turnNumber: 1,
    });
    assert.equal(outcome.transcript, "synthetic current turn");
    assert.equal(outcome.replyText, "synthetic reply");
    assert.deepEqual(
      calls.map(([operation]) => operation),
      ["recognize", "policy", "respond", "synthesize"]
    );

    const record = getTurnRecord(session.id, 1);
    assert.equal(record?.state, "completed");
    assert.equal(record?.route.transcriptPolicyVersion, "qa-verbatim-v1");
    assert.equal(record?.route.recognizer?.provider, "fake");
    assert.equal(record?.route.conversationModel?.provider, "fake");
    assert.equal(record?.route.synthesizer?.provider, "fake");
    assert.equal(record?.quality.recognitionConfidence, 0.75);
    assert.equal(record?.quality.segmentCount, 1);
    assert.equal(record?.usage.length, 3);
    assert.equal(record?.cost.reportedCostUsd, 0.006);
    assert.ok(record?.timing.recognitionStartedAt);
    assert.ok(record?.timing.recognizedAt);
    assert.ok(record?.timing.responseStartedAt);
    assert.ok(record?.timing.respondedAt);
    assert.ok(record?.timing.synthesisStartedAt);
    assert.ok(record?.timing.completedAt);

    const turns = getMediaSession(session.id)?.turns ?? [];
    assert.deepEqual(
      turns.map(({ role, text }) => [role, text]),
      [
        ["user", "synthetic current turn"],
        ["assistant", "synthetic reply"],
      ]
    );
  } finally {
    cleanupMediaSession(session.id);
    restoreDefaultProviderBundle();
    if (previousFlag === undefined) delete process.env.ECHOTALK_F001_ENABLED;
    else process.env.ECHOTALK_F001_ENABLED = previousFlag;
  }
});
