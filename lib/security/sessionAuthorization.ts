import {
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

type SessionAuthorizationRecord = {
  tokenHash: Buffer;
  issuedAt: string;
};

declare global {
  var __echotalkSessionAuthorization:
    | Map<string, SessionAuthorizationRecord>
    | undefined;
}

function getAuthorizationStore() {
  if (!globalThis.__echotalkSessionAuthorization) {
    globalThis.__echotalkSessionAuthorization = new Map();
  }
  return globalThis.__echotalkSessionAuthorization;
}

function hashToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest();
}

export function issueSessionToken(sessionId: string) {
  const token = randomBytes(32).toString("base64url");
  getAuthorizationStore().set(sessionId, {
    tokenHash: hashToken(token),
    issuedAt: new Date().toISOString(),
  });
  return token;
}

export function revokeSessionToken(sessionId: string) {
  getAuthorizationStore().delete(sessionId);
}

export function readBearerToken(request: Request) {
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  const match = authorization.match(/^Bearer\s+([A-Za-z0-9_-]{32,128})$/);
  return match?.[1] ?? null;
}

export function isSessionRequestAuthorized(
  request: Request,
  sessionId: string
) {
  const supplied = readBearerToken(request);
  const record = getAuthorizationStore().get(sessionId);
  if (!supplied || !record) return false;

  const suppliedHash = hashToken(supplied);
  return (
    suppliedHash.length === record.tokenHash.length &&
    timingSafeEqual(suppliedHash, record.tokenHash)
  );
}

export function clearAllSessionTokensForTests() {
  getAuthorizationStore().clear();
}
