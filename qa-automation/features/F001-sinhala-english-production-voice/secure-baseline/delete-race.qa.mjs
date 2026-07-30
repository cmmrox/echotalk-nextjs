import assert from "node:assert/strict";
import test from "node:test";

import {
  replaceProviderBundleForTests,
  restoreDefaultProviderBundle,
} from "../../../../lib/services/providerBundle.ts";
import {
  queueTurnIfReady,
} from "../../../../media-service/processingQueue.ts";
import { cleanupMediaSession } from "../../../../media-service/sessionCleanup.ts";
import {
  createMediaSession,
  getMediaSession,
} from "../../../../media-service/sessionManager.ts";
import {
  initializeSessionWork,
  isSessionWorkCancelled,
} from "../../../../media-service/sessionWork.ts";
import {
  appendTurnAudio,
  getTurnAudio,
} from "../../../../media-service/turnAudioStore.ts";
import { getTurnRecord } from "../../../../media-service/turnRecords.ts";
import { markTurnReady } from "../../../../media-service/turnState.ts";

const capabilities = {
  streaming: false,
  interimResults: false,
  confidence: false,
  wordTiming: false,
  languageTags: false,
  customVocabulary: false,
  cancellation: true,
  requiredFormats: ["audio/ogg"],
  regionalProcessing: false,
  configuredRetention: false,
  usageReporting: false,
};

async function waitFor(predicate, timeoutMs = 1_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.fail("timed out waiting for deletion race");
}

test("session deletion aborts an active turn without recreating restricted state", async () => {
  let recognitionStarted = false;
  const fakeBundle = {
    recognizer: {
      capabilities,
      recognize({ signal }) {
        recognitionStarted = true;
        return new Promise((_, reject) => {
          signal?.addEventListener(
            "abort",
            () => reject(signal.reason ?? new DOMException("cancelled", "AbortError")),
            { once: true }
          );
        });
      },
    },
    transcriptPolicy: {
      version: "qa-v1",
      apply() {
        assert.fail("transcript policy must not run after deletion");
      },
    },
    conversationModel: {
      capabilities,
      async respond() {
        assert.fail("conversation model must not run after deletion");
      },
    },
    synthesizer: {
      capabilities,
      async synthesize() {
        assert.fail("synthesizer must not run after deletion");
      },
    },
  };

  const session = createMediaSession();
  initializeSessionWork(session.id);
  appendTurnAudio(session.id, {
    turnNumber: 1,
    mimeType: "audio/ogg",
    frames: Array.from({ length: 20 }, () => Buffer.alloc(24, 1)),
  });
  replaceProviderBundleForTests(fakeBundle);

  try {
    markTurnReady(session.id, {
      packetCount: 20,
      totalBytes: 480,
      completedTurns: 1,
    });
    queueTurnIfReady(session.id);
    await waitFor(() => recognitionStarted);

    cleanupMediaSession(session.id);
    await new Promise((resolve) => setTimeout(resolve, 25));

    assert.equal(isSessionWorkCancelled(session.id), true);
    assert.equal(getMediaSession(session.id), undefined);
    assert.equal(getTurnAudio(session.id, 1), null);
    assert.equal(getTurnRecord(session.id, 1), undefined);
    assert.equal(
      globalThis.__echotalkProcessingQueue?.bySession.has(session.id),
      false
    );
  } finally {
    cleanupMediaSession(session.id);
    restoreDefaultProviderBundle();
  }
});
