import { LIMITS } from "@/lib/limits";

type Counter = {
  count: number;
  resetAt: number;
};

declare global {
  var __echotalkRequestCounters: Map<string, Counter> | undefined;
}

function getCounters() {
  if (!globalThis.__echotalkRequestCounters) {
    globalThis.__echotalkRequestCounters = new Map();
  }
  return globalThis.__echotalkRequestCounters;
}

export function clientAddress(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const first = forwarded.split(",")[0]?.trim();
  return (first || request.headers.get("x-real-ip") || "unknown").slice(0, 128);
}

export function consumeRequestBudget(params: {
  key: string;
  limit?: number;
  windowMs?: number;
}) {
  const now = Date.now();
  const limit = params.limit ?? LIMITS.maxRequestsPerMinute;
  const windowMs = params.windowMs ?? 60_000;
  const counters = getCounters();
  const current = counters.get(params.key);

  if (!current || current.resetAt <= now) {
    counters.set(params.key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: Math.max(0, limit - 1) };
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  current.count += 1;
  return { allowed: true, remaining: Math.max(0, limit - current.count) };
}

export function clearRequestBudgetsForTests() {
  getCounters().clear();
}
