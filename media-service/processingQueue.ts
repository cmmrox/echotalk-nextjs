import { buildPipelineSessionPatch, runProcessingPipeline } from "@/media-service/pipeline";
import { clearTurnReady, getTurnWindow, markTurnPending, markTurnReady } from "@/media-service/turnState";
import {
  pushMediaSessionEvent,
  updateMediaSession,
} from "@/media-service/sessionManager";

type ProcessingState = {
  queued: boolean;
  processing: boolean;
  processedTurns: number;
  lastQueuedAt?: string;
  lastProcessedAt?: string;
  /** A turn arrived while we were busy — process it immediately after current finishes. */
  pendingTurnStored: boolean;
};

declare global {
  var __echotalkProcessingQueue:
    | {
        bySession: Map<string, ProcessingState>;
      }
    | undefined;
}

function getProcessingStore() {
  if (!globalThis.__echotalkProcessingQueue) {
    globalThis.__echotalkProcessingQueue = {
      bySession: new Map(),
    };
  }

  return globalThis.__echotalkProcessingQueue;
}

function getProcessingState(sessionId: string): ProcessingState {
  const store = getProcessingStore();
  const existing = store.bySession.get(sessionId);
  if (existing) return existing;

  const created: ProcessingState = {
    queued: false,
    processing: false,
    processedTurns: 0,
    pendingTurnStored: false,
  };
  store.bySession.set(sessionId, created);
  return created;
}

export function queueTurnIfReady(sessionId: string) {
  const turnWindow = getTurnWindow(sessionId);
  const processing = getProcessingState(sessionId);

  console.log("[media-service/processing] queueTurnIfReady", {
    sessionId,
    turnReady: turnWindow.ready,
    packetCount: turnWindow.packetCount,
    totalBytes: turnWindow.totalBytes,
    processing: processing.processing,
    queued: processing.queued,
  });

  if (!turnWindow.ready) {
    return processing;
  }

  if (processing.processing || processing.queued) {
    if (!processing.pendingTurnStored) {
      processing.pendingTurnStored = true;
      markTurnPending(sessionId, {
        packetCount: turnWindow.packetCount,
        totalBytes: turnWindow.totalBytes,
        completedTurns: turnWindow.completedTurns,
      });
      console.log("[media-service/processing] turn queued as pending (busy)", { sessionId });
      pushMediaSessionEvent(sessionId, "processing_turn_pending_while_busy", {
        packetCount: turnWindow.packetCount,
        totalBytes: turnWindow.totalBytes,
        completedTurns: turnWindow.completedTurns,
      });
    }
    return processing;
  }

  processing.queued = true;
  processing.lastQueuedAt = new Date().toISOString();
  updateMediaSession(sessionId, { status: "processing" });
  pushMediaSessionEvent(sessionId, "processing_queued", {
    packetCount: turnWindow.packetCount,
    totalBytes: turnWindow.totalBytes,
    completedTurns: turnWindow.completedTurns,
  });

  queueMicrotask(async () => {
    console.log("[media-service/processing] microtask start", { sessionId });
    const current = getProcessingState(sessionId);
    current.queued = false;
    current.processing = true;
    pushMediaSessionEvent(sessionId, "processing_started", {
      packetCount: turnWindow.packetCount,
      totalBytes: turnWindow.totalBytes,
      completedTurns: turnWindow.completedTurns,
    });

    current.processedTurns += 1;
    const turnNumber = current.processedTurns;

    try {
      const outcome = await runProcessingPipeline({
        sessionId,
        turnNumber,
      });

      current.lastProcessedAt = new Date().toISOString();
      updateMediaSession(sessionId, {
        status: "connected",
        processing: { ...current, processing: false },
        ...buildPipelineSessionPatch(outcome),
      });
      pushMediaSessionEvent(sessionId, "processing_completed", {
        processedTurns: current.processedTurns,
        turnNumber: outcome.turnNumber,
        transcriptLength: outcome.transcript.length,
        replyLength: outcome.replyText.length,
        hasTts: Boolean(outcome.latestTts),
        hasUsableSpeech: outcome.hasUsableSpeech,
        failureStage: outcome.failureStage,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      current.lastProcessedAt = new Date().toISOString();
      updateMediaSession(sessionId, {
        status: "connected",
        processing: { ...current, processing: false },
      });
      pushMediaSessionEvent(sessionId, "processing_failed", {
        turnNumber,
        message,
      });
      console.error("[media-service/processing] pipeline failed", {
        sessionId,
        turnNumber,
        message,
      });
    } finally {
      current.processing = false;
      clearTurnReady(sessionId);

      if (current.pendingTurnStored) {
        current.pendingTurnStored = false;
        console.log("[media-service/processing] processing pending turn now", { sessionId });
        pushMediaSessionEvent(sessionId, "processing_deferred_turn_start", {});
        const pendingTurnWindow = getTurnWindow(sessionId);
        if (pendingTurnWindow.packetCount > 0) {
          markTurnReady(sessionId, {
            packetCount: pendingTurnWindow.packetCount,
            totalBytes: pendingTurnWindow.totalBytes,
            completedTurns: pendingTurnWindow.completedTurns,
          });
          queueTurnIfReady(sessionId);
        }
      }
    }
  });

  return processing;
}

export function getProcessingSnapshot(sessionId: string) {
  return getProcessingState(sessionId);
}
