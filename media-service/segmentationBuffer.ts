type BufferedPacket = {
  at: string;
  bytes: number;
  payload?: Buffer;
};

export type SegmentationState = {
  packets: BufferedPacket[];
  startedAt?: string;
  lastPacketAt?: string;
  completedTurns: number;
};

declare global {
  var __echotalkSegmentationState:
    | {
        bySession: Map<string, SegmentationState>;
      }
    | undefined;
}

function getSegmentationStore() {
  if (!globalThis.__echotalkSegmentationState) {
    globalThis.__echotalkSegmentationState = {
      bySession: new Map(),
    };
  }

  return globalThis.__echotalkSegmentationState;
}

export function getSegmentationState(sessionId: string): SegmentationState {
  const store = getSegmentationStore();
  const existing = store.bySession.get(sessionId);
  if (existing) return existing;

  const created: SegmentationState = {
    packets: [],
    completedTurns: 0,
  };
  store.bySession.set(sessionId, created);
  return created;
}

export function appendSegmentPacket(
  sessionId: string,
  bytes: number,
  payload?: Buffer | Uint8Array
) {
  const state = getSegmentationState(sessionId);
  const now = new Date().toISOString();
  if (!state.startedAt) {
    state.startedAt = now;
  }
  state.lastPacketAt = now;
  state.packets.push({
    at: now,
    bytes,
    payload: payload ? Buffer.from(payload) : undefined,
  });
  return state;
}

export function snapshotSegment(sessionId: string) {
  const state = getSegmentationState(sessionId);
  return {
    packetCount: state.packets.length,
    totalBytes: state.packets.reduce((sum, packet) => sum + packet.bytes, 0),
    payloadCount: state.packets.filter((packet) => packet.payload).length,
    startedAt: state.startedAt,
    lastPacketAt: state.lastPacketAt,
    completedTurns: state.completedTurns,
  };
}

/**
 * Explicitly mark the start of a new speech segment without discarding current
 * packet history. Phase 2 uses this as the first server-owned turn-detector
 * hook while the rolling buffer is still evolving.
 */
export function markSegmentStart(sessionId: string) {
  const state = getSegmentationState(sessionId);
  if (!state.startedAt) {
    state.startedAt = new Date().toISOString();
  }
  return state;
}

/**
 * Reset the segmentation buffer without finalizing — called when VAD detects
 * speech START so the buffer only captures frames from that moment onward.
 * Discards any previously accumulated silence / background noise.
 */
export function resetSegmentBuffer(sessionId: string) {
  const state = getSegmentationState(sessionId);
  state.packets = [];
  state.startedAt = undefined;
  state.lastPacketAt = undefined;
  // Note: completedTurns is NOT reset — it's a monotonic counter used for
  // turn numbering and must survive buffer resets.
}

/**
 * Reset the segment buffer without finalizing it.
 * Called when VAD detects speech START — discards background noise that
 * accumulated before the user started speaking so STT only sees clean speech.
 */
export function resetSegment(sessionId: string) {
  const state = getSegmentationState(sessionId);
  const discarded = state.packets.length;
  state.packets = [];
  state.startedAt = undefined;
  state.lastPacketAt = undefined;
  return { discarded };
}

/**
 * Finalize only if there are pending packets (at least 20 = ~0.4s of audio).
 * Used by VAD-triggered turn processing to avoid firing on silence gaps.
 * Returns null if there's not enough audio to bother processing.
 */
export function finalizeSegmentIfPending(sessionId: string) {
  const state = getSegmentationState(sessionId);
  const pendingCount = state.packets.filter((p) => p.payload).length;
  if (pendingCount < 20) return null; // less than ~0.4s of audio — skip
  return finalizeSegment(sessionId);
}

export function finalizeSegment(sessionId: string) {
  const state = getSegmentationState(sessionId);
  const snapshot = snapshotSegment(sessionId);

  // Collect individual Opus frames as separate Buffers (one per RTP packet).
  // These are raw Opus payloads from WebRTC — frame boundaries must be preserved
  // so the OGG Opus container builder can place each frame in its own OGG packet.
  const frames: Buffer[] = state.packets
    .map((packet) => packet.payload)
    .filter((p): p is Buffer => p !== undefined && p.length > 0);

  state.packets = [];
  state.startedAt = undefined;
  state.lastPacketAt = undefined;
  state.completedTurns += 1;

  return {
    ...snapshot,
    completedTurns: state.completedTurns,
    // Legacy field — concatenated binary, kept for snapshot logging only
    payloadBase64: frames.length > 0
      ? Buffer.concat(frames).toString("base64")
      : "",
    // Individual Opus frames for proper OGG container building
    frames,
  };
}
