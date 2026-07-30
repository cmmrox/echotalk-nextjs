import { LIMITS } from "@/lib/limits";

type ProviderBudget = {
  operations: number;
  byOperation: Record<string, number>;
};

declare global {
  var __echotalkProviderBudgets: Map<string, ProviderBudget> | undefined;
}

function getStore() {
  if (!globalThis.__echotalkProviderBudgets) {
    globalThis.__echotalkProviderBudgets = new Map();
  }
  return globalThis.__echotalkProviderBudgets;
}

function configuredLimit() {
  const parsed = Number(process.env.ECHOTALK_MAX_PROVIDER_OPERATIONS_PER_SESSION);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 10_000
    ? parsed
    : LIMITS.maxProviderOperationsPerSession;
}

export class ProviderBudgetExceeded extends Error {
  constructor() {
    super("Provider operation budget exceeded");
    this.name = "ProviderBudgetExceeded";
  }
}

export function consumeProviderOperation(
  sessionId: string,
  operation: "recognize" | "respond" | "synthesize"
) {
  const store = getStore();
  const budget = store.get(sessionId) ?? {
    operations: 0,
    byOperation: {},
  };
  if (budget.operations >= configuredLimit()) {
    throw new ProviderBudgetExceeded();
  }
  budget.operations += 1;
  budget.byOperation[operation] = (budget.byOperation[operation] ?? 0) + 1;
  store.set(sessionId, budget);
  return {
    operations: budget.operations,
    remaining: configuredLimit() - budget.operations,
  };
}

export function removeProviderBudget(sessionId: string) {
  getStore().delete(sessionId);
}
