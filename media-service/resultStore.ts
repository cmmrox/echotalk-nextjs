type MediaTurnResult = {
  turnNumber: number;
  transcript: string;
  detectedLanguage: string;
  replyText: string;
  replyLanguage: string;
  createdAt: string;
};

declare global {
  var __echotalkMediaResults:
    | {
        bySession: Map<string, MediaTurnResult[]>;
      }
    | undefined;
}

function getResultStore() {
  if (!globalThis.__echotalkMediaResults) {
    globalThis.__echotalkMediaResults = {
      bySession: new Map(),
    };
  }

  return globalThis.__echotalkMediaResults;
}

export function appendMediaResult(
  sessionId: string,
  result: Omit<MediaTurnResult, "createdAt">
) {
  const store = getResultStore();
  const existing = store.bySession.get(sessionId) ?? [];
  existing.push({ ...result, createdAt: new Date().toISOString() });
  store.bySession.set(sessionId, existing);
  return existing[existing.length - 1];
}

export function getLatestMediaResult(sessionId: string) {
  const existing = getResultStore().bySession.get(sessionId) ?? [];
  return existing[existing.length - 1] ?? null;
}

export function removeMediaResults(sessionId: string) {
  getResultStore().bySession.delete(sessionId);
}
