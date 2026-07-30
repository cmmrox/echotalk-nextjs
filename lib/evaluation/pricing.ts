import type { PriceCatalog, PriceCatalogEntry } from "./contracts.ts";

const catalogKeys = new Set(["schemaVersion", "catalogVersion", "entries"]);
const entryKeys = new Set([
  "provider",
  "model",
  "region",
  "billingUnit",
  "microUsdPerUnit",
  "effectiveAt",
  "retrievedAt",
  "source",
  "classification",
]);
const tokenPattern = /^[a-z0-9][a-z0-9._:-]{0,127}$/i;

function assertKnownKeys(record: Record<string, unknown>, allowed: Set<string>, label: string) {
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) throw new Error(`${label} contains an unknown field`);
  }
}

function isCanonicalIsoTimestamp(value: unknown) {
  if (typeof value !== "string") return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

export function validatePriceCatalog(value: unknown, options: { syntheticOnly?: boolean } = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Price catalog must be an object");
  }
  const catalog = value as Record<string, unknown>;
  assertKnownKeys(catalog, catalogKeys, "Price catalog");
  if (
    catalog.schemaVersion !== "price-catalog-v1" ||
    typeof catalog.catalogVersion !== "string" ||
    !tokenPattern.test(catalog.catalogVersion) ||
    !Array.isArray(catalog.entries) ||
    !catalog.entries.length
  ) {
    throw new Error("Invalid price catalog");
  }
  const identities = new Set<string>();
  for (const rawEntry of catalog.entries) {
    if (!rawEntry || typeof rawEntry !== "object" || Array.isArray(rawEntry)) {
      throw new Error("Invalid price entry");
    }
    const entry = rawEntry as Record<string, unknown>;
    assertKnownKeys(entry, entryKeys, "Price entry");
    if (!Number.isSafeInteger(entry.microUsdPerUnit) || Number(entry.microUsdPerUnit) < 0) {
      throw new Error("Price must be a non-negative integer micro-USD value");
    }
    if (entry.billingUnit !== "observation") throw new Error("Unsupported billing unit");
    for (const field of ["provider", "model", "region"] as const) {
      if (typeof entry[field] !== "string" || !tokenPattern.test(entry[field])) {
        throw new Error(`Invalid price identity: ${field}`);
      }
    }
    if (typeof entry.source !== "string" || !tokenPattern.test(entry.source)) {
      throw new Error("Invalid price source");
    }
    if (!isCanonicalIsoTimestamp(entry.effectiveAt) || !isCanonicalIsoTimestamp(entry.retrievedAt)) {
      throw new Error("Invalid price timestamp");
    }
    if (!["synthetic-example", "estimate", "invoice"].includes(String(entry.classification))) {
      throw new Error("Invalid price classification");
    }
    if (options.syntheticOnly && entry.classification !== "synthetic-example") {
      throw new Error("Synthetic runner permits synthetic-example prices only");
    }
    const identity = `${entry.provider}\0${entry.model}\0${entry.region}`;
    if (identities.has(identity)) throw new Error("Ambiguous duplicate price entry");
    identities.add(identity);
  }
  return value as PriceCatalog;
}

export function findPrice(
  catalog: PriceCatalog,
  identity: Pick<PriceCatalogEntry, "provider" | "model" | "region">
) {
  const matches = catalog.entries.filter((entry) =>
    entry.provider === identity.provider &&
    entry.model === identity.model &&
    entry.region === identity.region
  );
  if (matches.length !== 1) throw new Error("Missing or ambiguous price entry");
  return matches[0];
}

export function estimateMicroUsd(units: number, entry: PriceCatalogEntry) {
  if (!Number.isSafeInteger(units) || units < 0) throw new Error("Invalid billing units");
  const amount = BigInt(units) * BigInt(entry.microUsdPerUnit);
  if (amount > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Estimated cost overflow");
  return Number(amount);
}
