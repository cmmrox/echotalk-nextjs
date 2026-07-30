import assert from "node:assert/strict";
import test from "node:test";

import {
  clearAllSessionTokensForTests,
  isSessionRequestAuthorized,
  issueSessionToken,
  revokeSessionToken,
} from "../../../../lib/security/sessionAuthorization.ts";

test("session capability authorizes only the matching session", () => {
  clearAllSessionTokensForTests();
  const token = issueSessionToken("session-a");
  issueSessionToken("session-b");
  const authorized = new Request("https://example.test", {
    headers: { authorization: `Bearer ${token}` },
  });

  assert.equal(isSessionRequestAuthorized(authorized, "session-a"), true);
  assert.equal(isSessionRequestAuthorized(authorized, "session-b"), false);
  assert.equal(
    isSessionRequestAuthorized(new Request("https://example.test"), "session-a"),
    false
  );

  revokeSessionToken("session-a");
  assert.equal(isSessionRequestAuthorized(authorized, "session-a"), false);
  clearAllSessionTokensForTests();
});
