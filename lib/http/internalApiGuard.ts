import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { readBearerToken } from "@/lib/security/sessionAuthorization";

function constantTimeEqual(left: string, right: string) {
  const leftHash = createHash("sha256").update(left).digest();
  const rightHash = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}

export function guardInternalProviderRequest(request: Request) {
  const configured = process.env.ECHOTALK_INTERNAL_API_TOKEN?.trim() ?? "";
  const supplied = readBearerToken(request) ?? "";
  if (!configured) {
    return NextResponse.json(
      {
        error: "service_unavailable",
        message: "Legacy provider route is disabled",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
  if (!supplied || !constantTimeEqual(supplied, configured)) {
    return NextResponse.json(
      { error: "unauthorized", message: "Invalid internal authorization" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }
  return null;
}
