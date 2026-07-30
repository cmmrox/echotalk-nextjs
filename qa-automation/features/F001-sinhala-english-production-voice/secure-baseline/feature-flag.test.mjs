import assert from "node:assert/strict";
import test from "node:test";

import { isF001Enabled } from "../../../../lib/config/featureFlags.ts";

test("F001 fails closed unless explicitly enabled", () => {
  const previous = process.env.ECHOTALK_F001_ENABLED;
  try {
    delete process.env.ECHOTALK_F001_ENABLED;
    assert.equal(isF001Enabled(), false);
    process.env.ECHOTALK_F001_ENABLED = "false";
    assert.equal(isF001Enabled(), false);
    process.env.ECHOTALK_F001_ENABLED = " TRUE ";
    assert.equal(isF001Enabled(), true);
  } finally {
    if (previous === undefined) delete process.env.ECHOTALK_F001_ENABLED;
    else process.env.ECHOTALK_F001_ENABLED = previous;
  }
});
