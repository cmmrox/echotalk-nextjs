import assert from "node:assert/strict";
import test from "node:test";

import {
  cancelSessionWork,
  getSessionAbortSignal,
  scheduleSessionTimer,
  tryAcquireTurnLease,
} from "../../../../media-service/sessionWork.ts";

test("session turn lease serializes primary and fallback orchestration", () => {
  const sessionId = "lease-fixture";
  const release = tryAcquireTurnLease(sessionId);
  assert.equal(typeof release, "function");
  assert.equal(tryAcquireTurnLease(sessionId), null);
  release();
  const reacquired = tryAcquireTurnLease(sessionId);
  assert.equal(typeof reacquired, "function");
  reacquired();
  cancelSessionWork(sessionId);
});

test("session cleanup aborts work and cancels tracked timers", async () => {
  const sessionId = "cleanup-fixture";
  const signal = getSessionAbortSignal(sessionId);
  let called = false;
  scheduleSessionTimer(sessionId, () => {
    called = true;
  }, 5);
  cancelSessionWork(sessionId);
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.equal(signal.aborted, true);
  assert.equal(called, false);
});
