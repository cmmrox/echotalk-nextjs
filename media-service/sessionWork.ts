type SessionWork = {
  controller: AbortController;
  timers: Set<ReturnType<typeof setTimeout>>;
  turnLease: boolean;
};

declare global {
  var __echotalkSessionWork: Map<string, SessionWork> | undefined;
  var __echotalkClosedSessions: Map<string, number> | undefined;
}

function getStore() {
  if (!globalThis.__echotalkSessionWork) {
    globalThis.__echotalkSessionWork = new Map();
  }
  return globalThis.__echotalkSessionWork;
}

function getClosedStore() {
  if (!globalThis.__echotalkClosedSessions) {
    globalThis.__echotalkClosedSessions = new Map();
  }
  return globalThis.__echotalkClosedSessions;
}

function pruneClosedSessions() {
  const closed = getClosedStore();
  const cutoff = Date.now() - 5 * 60_000;
  for (const [sessionId, closedAt] of closed) {
    if (closedAt < cutoff) closed.delete(sessionId);
  }
  if (closed.size <= 1_000) return;
  const oldest = [...closed.entries()].sort((a, b) => a[1] - b[1]);
  for (const [sessionId] of oldest.slice(0, closed.size - 1_000)) {
    closed.delete(sessionId);
  }
}

function getWork(sessionId: string) {
  pruneClosedSessions();
  if (getClosedStore().has(sessionId)) return null;
  const existing = getStore().get(sessionId);
  if (existing) return existing;
  const created: SessionWork = {
    controller: new AbortController(),
    timers: new Set(),
    turnLease: false,
  };
  getStore().set(sessionId, created);
  return created;
}

export function initializeSessionWork(sessionId: string) {
  getClosedStore().delete(sessionId);
  return getWork(sessionId);
}

export function getSessionAbortSignal(sessionId: string) {
  return getWork(sessionId)?.controller.signal ?? AbortSignal.abort(
    new DOMException("Session closed", "AbortError")
  );
}

export function tryAcquireTurnLease(sessionId: string) {
  const work = getWork(sessionId);
  if (!work) return null;
  if (work.controller.signal.aborted || work.turnLease) return null;
  work.turnLease = true;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    work.turnLease = false;
  };
}

export function scheduleSessionTimer(
  sessionId: string,
  callback: () => void,
  delayMs: number
) {
  const work = getWork(sessionId);
  if (!work) return null;
  if (work.controller.signal.aborted) return null;
  const timer = setTimeout(() => {
    work.timers.delete(timer);
    if (!work.controller.signal.aborted) callback();
  }, delayMs);
  work.timers.add(timer);
  return timer;
}

export function cancelSessionWork(sessionId: string) {
  const work = getStore().get(sessionId);
  getClosedStore().set(sessionId, Date.now());
  pruneClosedSessions();
  if (work) {
    work.controller.abort(new DOMException("Session closed", "AbortError"));
    for (const timer of work.timers) clearTimeout(timer);
    work.timers.clear();
    work.turnLease = false;
  }
  getStore().delete(sessionId);
}

export function isSessionWorkCancelled(sessionId: string) {
  return (
    getClosedStore().has(sessionId) ||
    getStore().get(sessionId)?.controller.signal.aborted === true
  );
}
