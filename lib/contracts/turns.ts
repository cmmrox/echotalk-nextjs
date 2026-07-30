import { randomUUID } from "node:crypto";

export const TURN_CONTRACT_VERSION = "f001-s01-v1" as const;

export type TurnLifecycleState =
  | "created"
  | "recognizing"
  | "recognized"
  | "responding"
  | "responded"
  | "synthesizing"
  | "completed"
  | "no_speech"
  | "failed"
  | "cancelled";

export type TurnIdentifiers = {
  traceId: string;
  sessionId: string;
  turnId: string;
  turnNumber: number;
  attemptId: string;
  idempotencyKey: string;
};

export function createTurnIdentifiers(params: {
  sessionId: string;
  turnNumber: number;
}): TurnIdentifiers {
  const turnId = randomUUID();
  return {
    traceId: randomUUID(),
    sessionId: params.sessionId,
    turnId,
    turnNumber: params.turnNumber,
    attemptId: randomUUID(),
    idempotencyKey: `turn:${params.sessionId}:${params.turnNumber}:${turnId}`,
  };
}
