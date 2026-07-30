type StoredTtsAudio = {
  turnNumber: number;
  contentType: string;
  audioBase64: string;
  createdAt: string;
};

declare global {
  var __echotalkMediaTtsStore:
    | {
        bySession: Map<string, StoredTtsAudio[]>;
      }
    | undefined;
}

function getTtsStore() {
  if (!globalThis.__echotalkMediaTtsStore) {
    globalThis.__echotalkMediaTtsStore = {
      bySession: new Map(),
    };
  }

  return globalThis.__echotalkMediaTtsStore;
}

export function appendStoredTtsAudio(
  sessionId: string,
  audio: Omit<StoredTtsAudio, "createdAt">
) {
  const store = getTtsStore();
  const existing = store.bySession.get(sessionId) ?? [];
  existing.push({ ...audio, createdAt: new Date().toISOString() });
  store.bySession.set(sessionId, existing);
  return existing[existing.length - 1];
}

export function getLatestStoredTtsAudio(sessionId: string) {
  const existing = getTtsStore().bySession.get(sessionId) ?? [];
  return existing[existing.length - 1] ?? null;
}

export function removeStoredTtsAudio(sessionId: string) {
  getTtsStore().bySession.delete(sessionId);
}
