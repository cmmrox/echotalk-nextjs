import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();

async function mediaRoutes(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const found = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await mediaRoutes(path));
    else if (entry.name === "route.ts") found.push(path);
  }
  return found;
}

test("every media resource route authorizes the session or issues its token", async () => {
  const routes = await mediaRoutes(join(root, "app/api/media-service"));
  for (const route of routes) {
    const source = await readFile(route, "utf8");
    assert.match(
      source,
      /guardMediaSessionRequest|issueSessionToken/,
      `${route} must enforce session authorization`
    );
  }
});

test("legacy provider routes fail closed behind internal authorization", async () => {
  for (const route of ["stt", "agent", "tts"]) {
    const source = await readFile(join(root, `app/api/${route}/route.ts`), "utf8");
    assert.match(source, /guardInternalProviderRequest/);
  }
});

test("pipeline checks usable speech before conversation provider invocation", async () => {
  const source = await readFile(join(root, "media-service/pipeline.ts"), "utf8");
  const speechGate = source.indexOf("if (!isLikelySpeech)");
  const agentCall = source.indexOf("generateAgentReply({");
  assert.ok(speechGate >= 0 && agentCall > speechGate);
});
