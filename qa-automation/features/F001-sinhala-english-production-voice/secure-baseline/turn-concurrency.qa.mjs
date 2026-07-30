import assert from "node:assert/strict";
import test from "node:test";

import { PROVIDER_CONTRACT_VERSION } from "../../../../lib/contracts/providers.ts";
import {
  replaceProviderBundleForTests,
  restoreDefaultProviderBundle,
} from "../../../../lib/services/providerBundle.ts";
import {
  getProcessingSnapshot,
  queueTurnIfReady,
} from "../../../../media-service/processingQueue.ts";
import { cleanupMediaSession } from "../../../../media-service/sessionCleanup.ts";
import {
  createMediaSession,
  getMediaSession,
} from "../../../../media-service/sessionManager.ts";
import { initializeSessionWork } from "../../../../media-service/sessionWork.ts";
import { appendTurnAudio } from "../../../../media-service/turnAudioStore.ts";
import { getTurnRecord } from "../../../../media-service/turnRecords.ts";
import { markTurnReady } from "../../../../media-service/turnState.ts";

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
  usageReporting: false,
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

async function waitFor(predicate, timeoutMs = 2_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.fail("timed out waiting for queued turns");
}

test("queued turns remain FIFO, use their own audio, and complete once", async () => {
  const recognizedMarkers = [];
  const fakeBundle = {
    recognizer: {
      capabilities,
      async recognize({ audio }) {
        const marker = audio.includes(Buffer.alloc(8, 65)) ? "A" : "B";
        recognizedMarkers.push(marker);
        if (marker === "A") {
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
        return {
          transcript: `turn-${marker}`,
          detectedLanguage: "en-US",
          confidence: 1,
          segments: [{
            index: 0,
            transcript: `turn-${marker}`,
            languageCode: "en-US",
            confidence: 1,
            final: true,
          }],
          identity: identity("recognize"),
          capabilities,
        };
      },
    },
    transcriptPolicy: {
      version: "qa-verbatim-v1",
      apply(result) {
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
      async respond({ currentTurn, onProviderAttempt }) {
        onProviderAttempt?.();
        return {
          displayText: `reply-${currentTurn}`,
          ttsText: `reply-${currentTurn}`,
          replyLanguage: "en-US",
          identity: identity("respond"),
        };
      },
    },
    synthesizer: {
      capabilities,
      async synthesize({ text, languageCode }) {
        return {
          audio: Buffer.from(text),
          contentType: "audio/mpeg",
          languageCode,
          identity: identity("synthesize"),
        };
      },
    },
  };

  const session = createMediaSession();
  initializeSessionWork(session.id);
  const frameA = Buffer.concat([Buffer.from([1]), Buffer.alloc(23, 65)]);
  const frameB = Buffer.concat([Buffer.from([1]), Buffer.alloc(23, 66)]);
  appendTurnAudio(session.id, {
    turnNumber: 1,
    mimeType: "audio/ogg",
    frames: Array.from({ length: 20 }, () => frameA),
  });
  appendTurnAudio(session.id, {
    turnNumber: 2,
    mimeType: "audio/ogg",
    frames: Array.from({ length: 20 }, () => frameB),
  });
  replaceProviderBundleForTests(fakeBundle);

  try {
    markTurnReady(session.id, {
      packetCount: 20,
      totalBytes: 480,
      completedTurns: 1,
    });
    queueTurnIfReady(session.id);
    markTurnReady(session.id, {
      packetCount: 20,
      totalBytes: 480,
      completedTurns: 2,
    });
    queueTurnIfReady(session.id);
    queueTurnIfReady(session.id);

    await waitFor(() => {
      const completed = getProcessingSnapshot(session.id).completedTurnNumbers;
      return completed.includes(1) && completed.includes(2);
    });

    assert.deepEqual(recognizedMarkers, ["A", "B"]);
    assert.equal(
      getProcessingSnapshot(session.id).completedTurnNumbers.filter(
        (turn) => turn === 1
      ).length,
      1
    );
    assert.equal(
      getProcessingSnapshot(session.id).completedTurnNumbers.filter(
        (turn) => turn === 2
      ).length,
      1
    );
    assert.equal(getTurnRecord(session.id, 1)?.state, "completed");
    assert.equal(getTurnRecord(session.id, 2)?.state, "completed");
    assert.deepEqual(
      (getMediaSession(session.id)?.turns ?? [])
        .filter(({ role }) => role === "user")
        .map(({ text }) => text),
      ["turn-A", "turn-B"]
    );
  } finally {
    cleanupMediaSession(session.id);
    restoreDefaultProviderBundle();
  }
});
