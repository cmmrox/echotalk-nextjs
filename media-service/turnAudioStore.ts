type StoredTurnAudio = {
  turnNumber: number;
  mimeType: string;
  // Individual Opus frames (one per original RTP packet) for OGG container building.
  // Each Buffer is a raw Opus-encoded audio frame (~20ms at 48 kHz).
  frames: Buffer[];
  createdAt: string;
};

declare global {
  var __echotalkTurnAudioStore:
    | {
        bySession: Map<string, StoredTurnAudio[]>;
      }
    | undefined;
}

function getAudioStore() {
  if (!globalThis.__echotalkTurnAudioStore) {
    globalThis.__echotalkTurnAudioStore = {
      bySession: new Map(),
    };
  }

  return globalThis.__echotalkTurnAudioStore;
}

export function appendTurnAudio(
  sessionId: string,
  audio: Omit<StoredTurnAudio, "createdAt">
) {
  const store = getAudioStore();
  const existing = store.bySession.get(sessionId) ?? [];
  existing.push({ ...audio, createdAt: new Date().toISOString() });
  store.bySession.set(sessionId, existing);
  return existing[existing.length - 1];
}

export function getLatestTurnAudio(sessionId: string) {
  const existing = getAudioStore().bySession.get(sessionId) ?? [];
  return existing[existing.length - 1] ?? null;
}
