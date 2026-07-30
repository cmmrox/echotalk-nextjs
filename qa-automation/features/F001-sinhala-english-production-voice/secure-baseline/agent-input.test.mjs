import assert from "node:assert/strict";
import test from "node:test";

import { buildAgentInput } from "../../../../lib/contracts/agentInput.ts";

test("keeps permitted history chronological and adds current turn exactly once", () => {
  const currentTurn = "current unique turn";
  const input = buildAgentInput({
    currentTurn,
    detectedLanguage: "en-US",
    replyLanguage: "English",
    permittedHistory: [
      { role: "user", text: "first" },
      { role: "assistant", text: "second" },
    ],
  });

  assert.deepEqual(
    input.slice(1, 3).map((item) => [item.role, item.content]),
    [
      ["user", "first"],
      ["assistant", "second"],
    ]
  );
  assert.equal(
    input.filter((item) => item.content.includes(currentTurn)).length,
    1
  );
  assert.equal(input.at(-1)?.role, "user");
});
