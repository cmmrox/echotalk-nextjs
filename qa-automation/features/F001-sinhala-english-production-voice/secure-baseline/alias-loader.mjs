import { existsSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { pathToFileURL } from "node:url";

function projectPath(specifier) {
  const base = resolvePath(process.cwd(), specifier.slice(2));
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, resolvePath(base, "index.ts")]) {
    if (existsSync(candidate)) return pathToFileURL(candidate).href;
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const url = projectPath(specifier);
    if (url) return { url, shortCircuit: true };
  }
  if (specifier === "next/server") {
    return nextResolve("next/server.js", context);
  }
  return nextResolve(specifier, context);
}
