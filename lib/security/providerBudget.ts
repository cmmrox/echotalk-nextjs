import { LIMITS } from "@/lib/limits";

type ProviderBudget = {
  operations: number;
  byOperation: Record<string, number>;
  reservedCostUsd: number;
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

function configuredSpendLimit() {
  const parsed = Number(process.env.ECHOTALK_MAX_ESTIMATED_COST_USD_PER_SESSION);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 10_000
    ? parsed
    : LIMITS.maxEstimatedCostUsdPerSession;
}

function configuredReservation(
  operation: "recognize" | "respond" | "synthesize"
) {
  const defaults = { recognize: 0.02, respond: 0.03, synthesize: 0.02 };
  const name = `ECHOTALK_${operation.toUpperCase()}_RESERVATION_USD`;
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 100
    ? parsed
    : defaults[operation];
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
    reservedCostUsd: 0,
  };
  const reservation = configuredReservation(operation);
  if (
    budget.operations >= configuredLimit() ||
    budget.reservedCostUsd + reservation > configuredSpendLimit()
  ) {
    throw new ProviderBudgetExceeded();
  }
  budget.operations += 1;
  budget.reservedCostUsd = Number(
    (budget.reservedCostUsd + reservation).toFixed(6)
  );
  budget.byOperation[operation] = (budget.byOperation[operation] ?? 0) + 1;
  store.set(sessionId, budget);
  return {
    operations: budget.operations,
    remaining: configuredLimit() - budget.operations,
    reservedCostUsd: budget.reservedCostUsd,
    remainingCostUsd: Number(
      (configuredSpendLimit() - budget.reservedCostUsd).toFixed(6)
    ),
  };
}

export function getProviderBudgetSnapshot(sessionId: string) {
  const budget = getStore().get(sessionId);
  return budget
    ? {
        operations: budget.operations,
        byOperation: { ...budget.byOperation },
        reservedCostUsd: budget.reservedCostUsd,
        limitCostUsd: configuredSpendLimit(),
      }
    : {
        operations: 0,
        byOperation: {},
        reservedCostUsd: 0,
        limitCostUsd: configuredSpendLimit(),
      };
}

export function removeProviderBudget(sessionId: string) {
  getStore().delete(sessionId);
}
