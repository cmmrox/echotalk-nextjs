/**
 * Browser → Server diagnostic event logger.
 * The client calls this to report events (ontrack, play state, errors) so we
 * can see what the browser is doing without needing the DevTools console open.
 */
import { NextResponse } from "next/server";
import {
  guardMediaSessionRequest,
  readBoundedJson,
} from "@/lib/http/mediaSessionGuard";
import { LIMITS } from "@/lib/limits";
import { pushMediaSessionEvent } from "@/media-service/sessionManager";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const parsed = await readBoundedJson<Record<string, unknown>>(req);
    if (!parsed.ok) return parsed.response;
    const body = parsed.value;
    const sessionId =
      typeof body?.sessionId === "string" ? body.sessionId.trim() : "";
    const rejected = guardMediaSessionRequest(req, sessionId);
    if (rejected) return rejected;
    const fieldCount = Math.min(
      Object.keys(body ?? {}).length,
      LIMITS.maxClientEventFields
    );
    const event =
      typeof body?.type === "string"
        ? body.type.slice(0, 64)
        : typeof body?.event === "string"
          ? body.event.slice(0, 64)
          : "client_event";
    pushMediaSessionEvent(sessionId, "client_diagnostic", {
      event,
      fieldCount,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
