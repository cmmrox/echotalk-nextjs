type ShadowOutcome = "completed" | "provider_failed" | "timeout" | "cancelled";
type LatencyBucket = "lt_500ms" | "500_1499ms" | "1500_4999ms" | "gte_5000ms";

type Aggregate = {
  routeVersion: string;
  outcome: ShadowOutcome;
  latencyBucket: LatencyBucket;
  observations: number;
  costMicroUsd: number;
};

const allowedKeys = new Set(["routeVersion", "outcome", "latencyMs", "costMicroUsd"]);
const allowedOutcomes = new Set<ShadowOutcome>([
  "completed",
  "provider_failed",
  "timeout",
  "cancelled",
]);

function latencyBucket(latencyMs: number): LatencyBucket {
  if (latencyMs < 500) return "lt_500ms";
  if (latencyMs < 1500) return "500_1499ms";
  if (latencyMs < 5000) return "1500_4999ms";
  return "gte_5000ms";
}

export class ShadowTelemetry {
  private readonly aggregates = new Map<string, Aggregate>();

  record(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("Invalid shadow telemetry");
    }
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      if (!allowedKeys.has(key)) throw new Error("Content or arbitrary telemetry is forbidden");
    }
    const routeVersion = String(record.routeVersion ?? "");
    const outcome = record.outcome as ShadowOutcome;
    const latencyMs = Number(record.latencyMs);
    const costMicroUsd = Number(record.costMicroUsd);
    if (!/^[a-z0-9][a-z0-9._-]{0,63}$/i.test(routeVersion)) {
      throw new Error("Invalid route version");
    }
    if (!allowedOutcomes.has(outcome)) throw new Error("Invalid shadow outcome");
    if (!Number.isSafeInteger(latencyMs) || latencyMs < 0) {
      throw new Error("Invalid shadow latency");
    }
    if (!Number.isSafeInteger(costMicroUsd) || costMicroUsd < 0) {
      throw new Error("Invalid shadow cost");
    }
    const bucket = latencyBucket(latencyMs);
    const key = `${routeVersion}\0${outcome}\0${bucket}`;
    if (!this.aggregates.has(key) && this.aggregates.size >= 100) {
      throw new Error("Shadow telemetry dimension cap reached");
    }
    const aggregate = this.aggregates.get(key) ?? {
      routeVersion,
      outcome,
      latencyBucket: bucket,
      observations: 0,
      costMicroUsd: 0,
    };
    const nextObservations = aggregate.observations + 1;
    const nextCostMicroUsd = aggregate.costMicroUsd + costMicroUsd;
    if (!Number.isSafeInteger(nextObservations) || !Number.isSafeInteger(nextCostMicroUsd)) {
      throw new Error("Shadow telemetry cost overflow");
    }
    this.aggregates.set(key, {
      ...aggregate,
      observations: nextObservations,
      costMicroUsd: nextCostMicroUsd,
    });
  }

  snapshot() {
    return [...this.aggregates.values()]
      .map((aggregate) => ({ ...aggregate }))
      .sort((left, right) =>
        `${left.routeVersion}:${left.outcome}:${left.latencyBucket}`.localeCompare(
          `${right.routeVersion}:${right.outcome}:${right.latencyBucket}`
        )
      );
  }

  clear() {
    this.aggregates.clear();
  }
}
