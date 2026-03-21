/**
 * Browser → Server diagnostic event logger.
 * The client calls this to report events (ontrack, play state, errors) so we
 * can see what the browser is doing without needing the DevTools console open.
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    console.log("[CLIENT-EVENT]", JSON.stringify(body ?? {}));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
