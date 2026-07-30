import {
  buildPipelineSessionPatch,
  runProcessingPipeline,
} from "@/media-service/pipeline";
import { getTurnWindow } from "@/media-service/turnState";
import {
  pushMediaSessionEvent,
  updateMediaSession,
} from "@/media-service/sessionManager";
import { updateTurnRecord } from "@/media-service/turnRecords";
import { removeTurnAudio } from "@/media-service/turnAudioStore";
import {
  getSessionAbortSignal,
  isSessionWorkCancelled,
  tryAcquireTurnLease,
} from "@/media-service/sessionWork";

type ProcessingState = {
  queued: boolean;
  processing: boolean;
  processedTurns: number;
  pendingTurnNumbers: number[];
  completedTurnNumbers: number[];
  activeTurnNumber?: number;
  lastQueuedAt?: string;
  lastProcessedAt?: string;
};

declare global {
  var __echotalkProcessingQueue:
    | { bySession: Map<string, ProcessingState> }
    | undefined;
}

function getProcessingStore() {
  if (!globalThis.__echotalkProcessingQueue) {
    globalThis.__echotalkProcessingQueue = { bySession: new Map() };
  }
  return globalThis.__echotalkProcessingQueue;
}

function getProcessingState(sessionId: string): ProcessingState {
  const existing = getProcessingStore().bySession.get(sessionId);
  if (existing) return existing;
  const created: ProcessingState = {
    queued: false,
    processing: false,
    processedTurns: 0,
    pendingTurnNumbers: [],
    completedTurnNumbers: [],
  };
  getProcessingStore().bySession.set(sessionId, created);
  return created;
}

function alreadyOwned(state: ProcessingState, turnNumber: number) {
  return (
    state.activeTurnNumber === turnNumber ||
    state.pendingTurnNumbers.includes(turnNumber) ||
    state.completedTurnNumbers.includes(turnNumber)
  );
}

function scheduleTurn(sessionId: string, turnNumber: number) {
  const state = getProcessingState(sessionId);
  if (alreadyOwned(state, turnNumber)) {
    pushMediaSessionEvent(sessionId, "processing_duplicate_ignored", {
      turnNumber,
    });
    return state;
  }

  if (state.processing || state.queued) {
    state.pendingTurnNumbers.push(turnNumber);
    pushMediaSessionEvent(sessionId, "processing_turn_pending_while_busy", {
      turnNumber,
      queueDepth: state.pendingTurnNumbers.length,
    });
    return state;
  }

  state.queued = true;
  state.activeTurnNumber = turnNumber;
  state.lastQueuedAt = new Date().toISOString();
  updateMediaSession(sessionId, {
    status: "processing",
    processing: { ...state },
  });
  pushMediaSessionEvent(sessionId, "processing_queued", {
    turnNumber,
    queueDepth: state.pendingTurnNumbers.length,
  });

  queueMicrotask(async () => {
    const current = getProcessingState(sessionId);
    current.queued = false;
    current.processing = true;
    current.activeTurnNumber = turnNumber;
    pushMediaSessionEvent(sessionId, "processing_started", { turnNumber });

    try {
      const releaseLease = tryAcquireTurnLease(sessionId);
      if (!releaseLease) {
        throw new DOMException("Session turn already active", "AbortError");
      }
      let outcome: Awaited<ReturnType<typeof runProcessingPipeline>>;
      try {
        outcome = await runProcessingPipeline({
          sessionId,
          turnNumber,
          signal: getSessionAbortSignal(sessionId),
        });
      } finally {
        releaseLease();
      }
      current.lastProcessedAt = new Date().toISOString();
      current.processedTurns += 1;
      current.completedTurnNumbers.push(turnNumber);
      if (current.completedTurnNumbers.length > 100) {
        current.completedTurnNumbers.splice(
          0,
          current.completedTurnNumbers.length - 100
        );
      }
      updateMediaSession(sessionId, {
        status: "connected",
        ...buildPipelineSessionPatch(outcome),
      });
      pushMediaSessionEvent(sessionId, "processing_completed", {
        processedTurns: current.processedTurns,
        turnNumber,
        transcriptLength: outcome.transcript.length,
        replyLength: outcome.replyText.length,
        hasTts: Boolean(outcome.latestTts),
        hasUsableSpeech: outcome.hasUsableSpeech,
        failureStage: outcome.failureStage,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      current.lastProcessedAt = new Date().toISOString();
      current.completedTurnNumbers.push(turnNumber);
      removeTurnAudio(sessionId, turnNumber);
      if (!isSessionWorkCancelled(sessionId)) {
        updateTurnRecord(sessionId, turnNumber, (record) => {
          record.state = "failed";
          record.failureCode =
            error instanceof Error ? error.name : "unknown_failure";
        });
      }
      updateMediaSession(sessionId, { status: "connected" });
      pushMediaSessionEvent(sessionId, "processing_failed", {
        turnNumber,
        errorClass: error instanceof Error ? error.name : "unknown",
      });
      console.error("[media-service/processing] pipeline failed", {
        sessionId,
        turnNumber,
        errorClass: error instanceof Error ? error.name : "unknown",
        messageLength: message.length,
      });
    } finally {
      current.processing = false;
      current.activeTurnNumber = undefined;
      updateMediaSession(sessionId, { processing: { ...current } });
      if (isSessionWorkCancelled(sessionId)) return;
      const nextTurn = current.pendingTurnNumbers.shift();
      if (nextTurn !== undefined) {
        pushMediaSessionEvent(sessionId, "processing_deferred_turn_start", {
          turnNumber: nextTurn,
          queueDepth: current.pendingTurnNumbers.length,
        });
        scheduleTurn(sessionId, nextTurn);
      }
    }
  });

  return state;
}

export function queueTurnIfReady(sessionId: string) {
  const turnWindow = getTurnWindow(sessionId);
  if (!turnWindow.ready || turnWindow.completedTurns < 1) {
    return getProcessingState(sessionId);
  }
  return scheduleTurn(sessionId, turnWindow.completedTurns);
}

export function getProcessingSnapshot(sessionId: string) {
  return getProcessingState(sessionId);
}

export function removeProcessingState(sessionId: string) {
  getProcessingStore().bySession.delete(sessionId);
}
