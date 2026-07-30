type SessionWork = {
  controller: AbortController;
  timers: Set<ReturnType<typeof setTimeout>>;
  turnLease: boolean;
};

declare global {
  var __echotalkSessionWork: Map<string, SessionWork> | undefined;
}

function getStore() {
  if (!globalThis.__echotalkSessionWork) {
    globalThis.__echotalkSessionWork = new Map();
  }
  return globalThis.__echotalkSessionWork;
}

function getWork(sessionId: string) {
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

export function getSessionAbortSignal(sessionId: string) {
  return getWork(sessionId).controller.signal;
}

export function tryAcquireTurnLease(sessionId: string) {
  const work = getWork(sessionId);
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
  if (!work) return;
  work.controller.abort(new DOMException("Session closed", "AbortError"));
  for (const timer of work.timers) clearTimeout(timer);
  work.timers.clear();
  work.turnLease = false;
  getStore().delete(sessionId);
}

export function isSessionWorkCancelled(sessionId: string) {
  return getStore().get(sessionId)?.controller.signal.aborted ?? true;
}
