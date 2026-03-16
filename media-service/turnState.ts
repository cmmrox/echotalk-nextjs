type TurnWindow = {
  ready: boolean;
  packetCount: number;
  totalBytes: number;
  completedTurns: number;
  lastReadyAt?: string;
};

declare global {
  var __echotalkTurnState:
    | {
        bySession: Map<string, TurnWindow>;
      }
    | undefined;
}

function getTurnStore() {
  if (!globalThis.__echotalkTurnState) {
    globalThis.__echotalkTurnState = {
      bySession: new Map(),
    };
  }

  return globalThis.__echotalkTurnState;
}

export function getTurnWindow(sessionId: string): TurnWindow {
  const store = getTurnStore();
  const existing = store.bySession.get(sessionId);
  if (existing) return existing;

  const created: TurnWindow = {
    ready: false,
    packetCount: 0,
    totalBytes: 0,
    completedTurns: 0,
  };
  store.bySession.set(sessionId, created);
  return created;
}

export function updateTurnWindow(
  sessionId: string,
  patch: Partial<TurnWindow>
): TurnWindow {
  const windowState = getTurnWindow(sessionId);
  Object.assign(windowState, patch);
  return windowState;
}

export function markTurnReady(sessionId: string, params: {
  packetCount: number;
  totalBytes: number;
  completedTurns: number;
}) {
  return updateTurnWindow(sessionId, {
    ready: true,
    packetCount: params.packetCount,
    totalBytes: params.totalBytes,
    completedTurns: params.completedTurns,
    lastReadyAt: new Date().toISOString(),
  });
}

export function clearTurnReady(sessionId: string) {
  return updateTurnWindow(sessionId, {
    ready: false,
    packetCount: 0,
    totalBytes: 0,
  });
}
