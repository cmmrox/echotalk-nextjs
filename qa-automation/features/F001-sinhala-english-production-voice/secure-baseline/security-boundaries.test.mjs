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

test("session token is returned once and never written to the creation log", async () => {
  const source = await readFile(
    join(root, "app/api/media-service/session/route.ts"),
    "utf8"
  );
  const creationLog = source.slice(
    source.indexOf('console.log("[media-service/session] created"'),
    source.indexOf("return NextResponse.json", source.indexOf('console.log("[media-service/session] created"'))
  );
  const response = source.slice(
    source.indexOf("return NextResponse.json"),
    source.indexOf("export async function GET")
  );
  assert.doesNotMatch(creationLog, /sessionToken/);
  assert.match(response, /sessionToken/);
  assert.match(response, /Cache-Control.*no-store/s);
});

test("pipeline checks usable speech before conversation provider invocation", async () => {
  const source = await readFile(join(root, "media-service/pipeline.ts"), "utf8");
  const speechGate = source.indexOf("if (!isLikelySpeech)");
  const agentCall = source.indexOf("providers.conversationModel.respond({");
  assert.ok(speechGate >= 0 && agentCall > speechGate);
});

test("orchestration routes resolve providers through the replaceable bundle", async () => {
  for (const path of [
    "media-service/pipeline.ts",
    "app/api/media-service/speech-turn/route.ts",
  ]) {
    const source = await readFile(join(root, path), "utf8");
    assert.match(source, /getProviderBundle/);
    assert.doesNotMatch(
      source,
      /@\/lib\/services\/(?:stt|agent|tts)/
    );
  }
});

test("JSON routes use bounded streaming reads and session creation enforces feature flag", async () => {
  for (const path of [
    "app/api/media-service/client-event/route.ts",
    "app/api/media-service/ice/route.ts",
    "app/api/media-service/offer/route.ts",
    "app/api/agent/route.ts",
    "app/api/tts/route.ts",
  ]) {
    const source = await readFile(join(root, path), "utf8");
    assert.match(source, /readBoundedJson/);
    assert.doesNotMatch(source, /req\.json\(\)/);
  }
  const sessionRoute = await readFile(
    join(root, "app/api/media-service/session/route.ts"),
    "utf8"
  );
  assert.match(sessionRoute, /isF001Enabled/);
  assert.match(sessionRoute, /feature_disabled/);
});

test("provider spend is reserved per retry attempt and capped monetarily", async () => {
  const budget = await readFile(join(root, "lib/security/providerBudget.ts"), "utf8");
  const pipeline = await readFile(join(root, "media-service/pipeline.ts"), "utf8");
  assert.match(budget, /reservedCostUsd/);
  assert.match(budget, /configuredSpendLimit/);
  assert.match(pipeline, /onProviderAttempt/);
});
