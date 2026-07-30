import assert from "node:assert/strict";
import test from "node:test";

import {
  cancelSessionWork,
  getSessionAbortSignal,
  initializeSessionWork,
  scheduleSessionTimer,
  tryAcquireTurnLease,
} from "../../../../media-service/sessionWork.ts";

test("session turn lease serializes primary and fallback orchestration", () => {
  const sessionId = "lease-fixture";
  initializeSessionWork(sessionId);
  const release = tryAcquireTurnLease(sessionId);
  assert.equal(typeof release, "function");
  assert.equal(tryAcquireTurnLease(sessionId), null);
  release();
  const reacquired = tryAcquireTurnLease(sessionId);
  assert.equal(typeof reacquired, "function");
  reacquired();
  cancelSessionWork(sessionId);
});

test("cleanup tombstone prevents queued work from recreating a lease", () => {
  const sessionId = "queued-cleanup-fixture";
  initializeSessionWork(sessionId);
  cancelSessionWork(sessionId);
  assert.equal(getSessionAbortSignal(sessionId).aborted, true);
  assert.equal(tryAcquireTurnLease(sessionId), null);
  assert.equal(scheduleSessionTimer(sessionId, () => undefined, 1), null);
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
