import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import test from "node:test";

import {
  DELETE as deleteSession,
  GET as getSession,
  POST as createSession,
} from "../../../../app/api/media-service/session/route.ts";
import {
  readBoundedBytes,
  readBoundedJson,
} from "../../../../lib/http/mediaSessionGuard.ts";
import {
  consumeProviderOperation,
  getProviderBudgetSnapshot,
  removeProviderBudget,
} from "../../../../lib/security/providerBudget.ts";
import {
  clearAllSessionTokensForTests,
  isSessionRequestAuthorized,
} from "../../../../lib/security/sessionAuthorization.ts";
import { clearRequestBudgetsForTests } from "../../../../lib/security/requestLimits.ts";
import { getMediaSession } from "../../../../media-service/sessionManager.ts";
import {
  cancelSessionWork,
  getSessionAbortSignal,
  initializeSessionWork,
  isSessionWorkCancelled,
} from "../../../../media-service/sessionWork.ts";

function authorizedRequest(url, token, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${token}`);
  return new Request(url, { ...init, headers });
}

function restoreEnv(name, value) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

test("dynamic session authorization and kill-switch rollback fail closed", async () => {
  const previousFlag = process.env.ECHOTALK_F001_ENABLED;
  clearAllSessionTokensForTests();
  clearRequestBudgetsForTests();
  process.env.ECHOTALK_F001_ENABLED = "false";

  try {
    const disabledCreate = await createSession(
      new Request("https://example.test/api/media-service/session", {
        method: "POST",
      })
    );
    assert.equal(disabledCreate.status, 503);
    assert.equal((await disabledCreate.json()).error, "feature_disabled");

    process.env.ECHOTALK_F001_ENABLED = "true";
    const logs = [];
    const originalLog = console.log;
    console.log = (...args) => logs.push(args);
    let created;
    try {
      const response = await createSession(
        new Request("https://example.test/api/media-service/session", {
          method: "POST",
          headers: { "x-real-ip": "192.0.2.10" },
        })
      );
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "no-store");
      created = await response.json();
    } finally {
      console.log = originalLog;
    }

    assert.match(created.sessionId, /^[0-9a-f-]{36}$/i);
    assert.match(created.sessionToken, /^[A-Za-z0-9_-]{32,128}$/);
    assert.equal(
      logs.some((entry) => JSON.stringify(entry).includes(created.sessionToken)),
      false
    );

    const allowed = await getSession(
      authorizedRequest(
        `https://example.test/api/media-service/session?sessionId=${created.sessionId}`,
        created.sessionToken
      )
    );
    assert.equal(allowed.status, 200);

    const denied = await getSession(
      authorizedRequest(
        `https://example.test/api/media-service/session?sessionId=${created.sessionId}`,
        "A".repeat(43)
      )
    );
    assert.equal(denied.status, 401);

    const preDisableSignal = getSessionAbortSignal(created.sessionId);
    process.env.ECHOTALK_F001_ENABLED = "false";
    const killed = await getSession(
      authorizedRequest(
        `https://example.test/api/media-service/session?sessionId=${created.sessionId}`,
        created.sessionToken
      )
    );
    assert.equal(killed.status, 503);
    assert.equal(preDisableSignal.aborted, true);
    assert.equal(isSessionWorkCancelled(created.sessionId), true);

    const deleted = await deleteSession(
      authorizedRequest(
        `https://example.test/api/media-service/session?sessionId=${created.sessionId}`,
        created.sessionToken,
        { method: "DELETE" }
      )
    );
    assert.equal(deleted.status, 200);
    assert.equal(getMediaSession(created.sessionId), undefined);
    assert.equal(
      isSessionRequestAuthorized(
        authorizedRequest("https://example.test", created.sessionToken),
        created.sessionId
      ),
      false
    );
  } finally {
    restoreEnv("ECHOTALK_F001_ENABLED", previousFlag);
    clearAllSessionTokensForTests();
    clearRequestBudgetsForTests();
  }
});

test("streaming readers reject missing-length bodies after the byte limit", async () => {
  const oversizedJson = new Request("https://example.test/json", {
    method: "POST",
    body: JSON.stringify({ value: "x".repeat(80) }),
  });
  oversizedJson.headers.delete("content-length");
  const jsonResult = await readBoundedJson(oversizedJson, 32);
  assert.equal(jsonResult.ok, false);
  assert.equal(jsonResult.response.status, 413);

  const oversizedBytes = new Request("https://example.test/bytes", {
    method: "POST",
    body: Buffer.alloc(65, 1),
  });
  oversizedBytes.headers.delete("content-length");
  const bytesResult = await readBoundedBytes(oversizedBytes, 64);
  assert.equal(bytesResult.ok, false);
  assert.equal(bytesResult.response.status, 413);
});

test("provider operations stop before the configured monetary cap", () => {
  const names = [
    "ECHOTALK_MAX_PROVIDER_OPERATIONS_PER_SESSION",
    "ECHOTALK_MAX_ESTIMATED_COST_USD_PER_SESSION",
    "ECHOTALK_RESPOND_RESERVATION_USD",
  ];
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  const sessionId = "qa-spend-cap";
  try {
    process.env.ECHOTALK_MAX_PROVIDER_OPERATIONS_PER_SESSION = "10";
    process.env.ECHOTALK_MAX_ESTIMATED_COST_USD_PER_SESSION = "0.05";
    process.env.ECHOTALK_RESPOND_RESERVATION_USD = "0.03";
    const first = consumeProviderOperation(sessionId, "respond");
    assert.equal(first.reservationCostUsd, 0.03);
    assert.equal(first.reservedCostUsd, 0.03);
    assert.throws(
      () => consumeProviderOperation(sessionId, "respond"),
      { name: "ProviderBudgetExceeded" }
    );
    assert.equal(getProviderBudgetSnapshot(sessionId).operations, 1);
    assert.equal(getProviderBudgetSnapshot(sessionId).reservedCostUsd, 0.03);
  } finally {
    removeProviderBudget(sessionId);
    for (const name of names) restoreEnv(name, previous[name]);
  }
});

test("closed-session tombstones remain bounded under stress", () => {
  const prefix = `qa-tombstone-${Date.now()}-`;
  try {
    for (let index = 0; index < 1_050; index += 1) {
      const sessionId = `${prefix}${index}`;
      initializeSessionWork(sessionId);
      const signal = getSessionAbortSignal(sessionId);
      cancelSessionWork(sessionId);
      assert.equal(signal.aborted, true);
    }
    assert.ok(globalThis.__echotalkClosedSessions.size <= 1_000);
  } finally {
    for (const key of [...(globalThis.__echotalkClosedSessions?.keys() ?? [])]) {
      if (key.startsWith(prefix)) globalThis.__echotalkClosedSessions.delete(key);
    }
    for (const key of [...(globalThis.__echotalkSessionWork?.keys() ?? [])]) {
      if (key.startsWith(prefix)) globalThis.__echotalkSessionWork.delete(key);
    }
  }
});

test("tracked source contains no credential-shaped values", async () => {
  const listed = spawnSync("git", ["ls-files", "-z"], {
    cwd: process.cwd(),
    encoding: "buffer",
  });
  assert.equal(listed.status, 0);
  const paths = listed.stdout
    .toString("utf8")
    .split("\0")
    .filter(Boolean);
  const secretPatterns = [
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    /\bsk-[A-Za-z0-9_-]{20,}\b/,
    /"private_key"\s*:\s*"-----BEGIN/,
  ];
  const offendingPaths = [];
  for (const path of paths) {
    let text;
    try {
      text = await readFile(path, "utf8");
    } catch {
      continue;
    }
    if (secretPatterns.some((pattern) => pattern.test(text))) {
      offendingPaths.push(path);
    }
  }
  assert.deepEqual(offendingPaths, []);
});
