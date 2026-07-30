import assert from "node:assert/strict";
import test from "node:test";

import {
  appendTurnAudio,
  getTurnAudio,
  removeTurnAudio,
} from "../../../../media-service/turnAudioStore.ts";

test("retrieves audio by session and exact turn rather than latest arrival", () => {
  const sessionA = "session-a";
  const sessionB = "session-b";
  removeTurnAudio(sessionA);
  removeTurnAudio(sessionB);

  appendTurnAudio(sessionA, {
    turnNumber: 1,
    mimeType: "audio/ogg",
    frames: [Buffer.from("a1")],
  });
  appendTurnAudio(sessionA, {
    turnNumber: 2,
    mimeType: "audio/ogg",
    frames: [Buffer.from("a2")],
  });
  appendTurnAudio(sessionB, {
    turnNumber: 1,
    mimeType: "audio/ogg",
    frames: [Buffer.from("b1")],
  });

  assert.equal(getTurnAudio(sessionA, 1)?.frames[0].toString(), "a1");
  assert.equal(getTurnAudio(sessionA, 2)?.frames[0].toString(), "a2");
  assert.equal(getTurnAudio(sessionB, 1)?.frames[0].toString(), "b1");
  assert.equal(getTurnAudio(sessionB, 2), null);

  removeTurnAudio(sessionA);
  removeTurnAudio(sessionB);
});
