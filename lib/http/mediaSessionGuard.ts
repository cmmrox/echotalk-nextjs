import { NextResponse } from "next/server";

import { isSessionRequestAuthorized } from "@/lib/security/sessionAuthorization";
import { consumeRequestBudget } from "@/lib/security/requestLimits";
import { LIMITS } from "@/lib/limits";

export function guardContentLength(request: Request, maxBytes = LIMITS.maxJsonBytes) {
  const raw = request.headers.get("content-length");
  if (!raw) return null;
  const length = Number(raw);
  if (!Number.isSafeInteger(length) || length < 0 || length > maxBytes) {
    return NextResponse.json(
      { error: "payload_too_large", message: "Request payload exceeds limit" },
      { status: 413 }
    );
  }
  return null;
}

export function guardMediaSessionRequest(
  request: Request,
  sessionId: string
): NextResponse | null {
  if (!sessionId) {
    return NextResponse.json(
      { error: "bad_request", message: "Missing sessionId" },
      { status: 400 }
    );
  }

  if (!isSessionRequestAuthorized(request, sessionId)) {
    return NextResponse.json(
      { error: "unauthorized", message: "Invalid session authorization" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  const budget = consumeRequestBudget({ key: `session:${sessionId}` });
  if (!budget.allowed) {
    return NextResponse.json(
      { error: "rate_limited", message: "Session request limit exceeded" },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(budget.retryAfterSeconds),
        },
      }
    );
  }

  return null;
}
