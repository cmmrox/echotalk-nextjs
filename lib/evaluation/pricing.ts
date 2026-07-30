import type { PriceCatalog, PriceCatalogEntry } from "./contracts.ts";

export function validatePriceCatalog(catalog: PriceCatalog) {
  if (catalog.schemaVersion !== "price-catalog-v1" || !catalog.catalogVersion) {
    throw new Error("Invalid price catalog");
  }
  for (const entry of catalog.entries) {
    if (!Number.isSafeInteger(entry.microUsdPerUnit) || entry.microUsdPerUnit < 0) {
      throw new Error("Price must be a non-negative integer micro-USD value");
    }
    if (entry.billingUnit !== "observation") throw new Error("Unsupported billing unit");
    if (!entry.provider || !entry.model || !entry.region || !entry.source) {
      throw new Error("Incomplete price entry");
    }
  }
  return catalog;
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
