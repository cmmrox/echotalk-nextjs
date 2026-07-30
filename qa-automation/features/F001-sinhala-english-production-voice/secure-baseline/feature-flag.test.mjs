import assert from "node:assert/strict";
import test from "node:test";

import {
  assertF001Enabled,
  isF001Enabled,
} from "../../../../lib/config/featureFlags.ts";

test("F001 fails closed unless explicitly enabled", () => {
  const previous = process.env.ECHOTALK_F001_ENABLED;
  try {
    delete process.env.ECHOTALK_F001_ENABLED;
    assert.equal(isF001Enabled(), false);
    assert.throws(() => assertF001Enabled(), { name: "FeatureDisabledError" });
    process.env.ECHOTALK_F001_ENABLED = "false";
    assert.equal(isF001Enabled(), false);
    process.env.ECHOTALK_F001_ENABLED = " TRUE ";
    assert.equal(isF001Enabled(), true);
    assert.doesNotThrow(() => assertF001Enabled());
  } finally {
    if (previous === undefined) delete process.env.ECHOTALK_F001_ENABLED;
    else process.env.ECHOTALK_F001_ENABLED = previous;
  }
});
