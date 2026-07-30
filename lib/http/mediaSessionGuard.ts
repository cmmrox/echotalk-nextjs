import { NextResponse } from "next/server";

import { isSessionRequestAuthorized } from "@/lib/security/sessionAuthorization";
import { consumeRequestBudget } from "@/lib/security/requestLimits";
import { LIMITS } from "@/lib/limits";
import { isF001Enabled } from "@/lib/config/featureFlags";
import { cancelSessionWork } from "@/media-service/sessionWork";

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

export async function readBoundedJson<T>(
  request: Request,
  maxBytes = LIMITS.maxJsonBytes
): Promise<
  | { ok: true; value: T | null }
  | { ok: false; response: NextResponse }
> {
  const oversized = guardContentLength(request, maxBytes);
  if (oversized) return { ok: false, response: oversized };
  if (!request.body) return { ok: true, value: null };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel("payload limit exceeded").catch(() => undefined);
      return {
        ok: false,
        response: NextResponse.json(
          { error: "payload_too_large", message: "Request payload exceeds limit" },
          { status: 413 }
        ),
      };
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const text = new TextDecoder().decode(bytes);
    return { ok: true, value: text ? JSON.parse(text) as T : null };
  } catch {
    return { ok: true, value: null };
  }
}

export async function readBoundedBytes(
  request: Request,
  maxBytes: number
): Promise<
  | { ok: true; value: Buffer }
  | { ok: false; response: NextResponse }
> {
  const oversized = guardContentLength(request, maxBytes);
  if (oversized) return { ok: false, response: oversized };
  if (!request.body) return { ok: true, value: Buffer.alloc(0) };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel("payload limit exceeded").catch(() => undefined);
      return {
        ok: false,
        response: NextResponse.json(
          { error: "payload_too_large", message: "Request payload exceeds limit" },
          { status: 413 }
        ),
      };
    }
    chunks.push(value);
  }

  return {
    ok: true,
    value: Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), total),
  };
}

export function guardMediaSessionRequest(
  request: Request,
  sessionId: string,
  options: { allowWhenDisabled?: boolean } = {}
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

  if (!isF001Enabled() && !options.allowWhenDisabled) {
    cancelSessionWork(sessionId);
    return NextResponse.json(
      { error: "feature_disabled", message: "Voice sessions are disabled" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
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
