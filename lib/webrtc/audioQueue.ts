export type QueuedAudioTurn = {
  id: string;
  createdAt: string;
  source: "webrtc";
  sessionId: string;
  blobBase64: string;
  mimeType: string;
};

type GlobalAudioQueue = {
  turns: QueuedAudioTurn[];
};

declare global {
  var __echotalkAudioQueue: GlobalAudioQueue | undefined;
}

function getQueueStore(): GlobalAudioQueue {
  if (!globalThis.__echotalkAudioQueue) {
    globalThis.__echotalkAudioQueue = { turns: [] };
  }

  return globalThis.__echotalkAudioQueue;
}

export function enqueueAudioTurn(turn: QueuedAudioTurn) {
  getQueueStore().turns.push(turn);
}

export function dequeueAudioTurn(sessionId: string): QueuedAudioTurn | undefined {
  const queue = getQueueStore().turns;
  const index = queue.findIndex((turn) => turn.sessionId === sessionId);
  if (index === -1) return undefined;
  return queue.splice(index, 1)[0];
}

export function listQueuedAudioTurns(sessionId: string): QueuedAudioTurn[] {
  return getQueueStore().turns.filter((turn) => turn.sessionId === sessionId);
}
