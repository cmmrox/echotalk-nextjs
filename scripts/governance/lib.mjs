import { access, readFile, readdir, stat } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

export function defaultRepoRoot(metaUrl) {
  return resolve(dirname(fileURLToPath(metaUrl)), "../..");
}

export function rootFromArgs(defaultRoot, args = process.argv.slice(2)) {
  const index = args.indexOf("--root");
  return index === -1 ? defaultRoot : resolve(args[index + 1] ?? "");
}

export function withoutRootArgs(args = process.argv.slice(2)) {
  const result = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--root") {
      index += 1;
    } else {
      result.push(args[index]);
    }
  }
  return result;
}

export async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function readText(path) {
  return readFile(path, "utf8");
}

export async function readJson(path) {
  return JSON.parse(await readText(path));
}

export function repoPath(repoRoot, path) {
  return relative(repoRoot, path).split(sep).join("/");
}

export async function walkFiles(root, options = {}) {
  const files = [];
  const skip = new Set(options.skip ?? []);

  async function visit(current) {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const path = resolve(current, entry.name);
      const rel = repoPath(root, path);
      if (skip.has(entry.name) || [...skip].some((value) => rel.startsWith(`${value}/`))) {
        continue;
      }
      if (entry.isDirectory()) {
        await visit(path);
      } else if (entry.isFile() || entry.isSymbolicLink()) {
        if (!options.extension || entry.name.endsWith(options.extension)) files.push(path);
      }
    }
  }

  await visit(root);
  return files.sort();
}

function scalar(value) {
  const trimmed = value.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "null") return null;
  if (/^-?\d+$/.test(trimmed)) return Number(trimmed);
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function inlineArray(value) {
  const inner = value.trim().slice(1, -1).trim();
  if (!inner) return [];
  try {
    return JSON.parse(value);
  } catch {
    return inner.split(",").map((item) => scalar(item));
  }
}

export function parseFrontmatter(text, label = "document") {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) throw new Error(`${label}: missing YAML frontmatter`);
  const data = {};
  for (const [index, rawLine] of match[1].split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf(":");
    if (separator < 1) {
      throw new Error(`${label}: unsupported frontmatter at line ${index + 2}`);
    }
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    data[key] = value.startsWith("[") && value.endsWith("]")
      ? inlineArray(value)
      : scalar(value);
  }
  return { data, body: text.slice(match[0].length), raw: match[1] };
}

export function markdownLinks(text) {
  const links = [];
  for (const match of text.matchAll(/\[[^\]]*]\(([^)]+)\)/g)) {
    const target = match[1].trim().replace(/^<|>$/g, "");
    if (
      !target ||
      target.startsWith("#") ||
      /^[a-z][a-z0-9+.-]*:/i.test(target)
    ) {
      continue;
    }
    links.push(target.split("#", 1)[0].split("?", 1)[0]);
  }
  return links;
}

export function collectIds(text, pattern) {
  return [...new Set([...text.matchAll(pattern)].map((match) => match[0]))];
}

export function isCommit(value) {
  return typeof value === "string" && /^[0-9a-f]{40}$/i.test(value);
}

export function gitCommitExists(repoRoot, value) {
  if (!isCommit(value)) return false;
  const result = spawnSync("git", ["cat-file", "-e", `${value}^{commit}`], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  return result.status === 0;
}

export function requireFields(data, fields, label, errors) {
  for (const field of fields) {
    if (!(field in data) || data[field] === "" || data[field] === null) {
      errors.push(`${label}: missing frontmatter field "${field}"`);
    }
  }
}

export async function assertPath(path, repoRoot, errors, label = "Missing") {
  if (!(await exists(path))) errors.push(`${label}: ${repoPath(repoRoot, path)}`);
}

export async function isDirectory(path) {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

export function report(errors, successMessage) {
  if (errors.length) {
    console.error(`Validation failed (${errors.length}):`);
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return false;
  }
  console.log(successMessage);
  return true;
}
