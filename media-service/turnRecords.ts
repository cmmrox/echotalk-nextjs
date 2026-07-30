import type {
  ProviderIdentity,
  ProviderUsage,
  RecognitionSegment,
} from "@/lib/contracts/providers";
import {
  createTurnIdentifiers,
  TURN_CONTRACT_VERSION,
  type TurnIdentifiers,
  type TurnLifecycleState,
} from "@/lib/contracts/turns";

export type TurnRecord = TurnIdentifiers & {
  contractVersion: typeof TURN_CONTRACT_VERSION;
  state: TurnLifecycleState;
  createdAt: string;
  updatedAt: string;
  terminalAt?: string;
  transcript: {
    raw: string;
    verbatim: string;
    corrected: string | null;
    normalized: string | null;
    detectedLanguage?: string;
    segments: RecognitionSegment[];
  };
  response: {
    displayText: string;
    ttsText: string;
    replyLanguage?: string;
  };
  providers: ProviderIdentity[];
  usage: ProviderUsage[];
  route: {
    recognizer?: ProviderIdentity;
    conversationModel?: ProviderIdentity;
    synthesizer?: ProviderIdentity;
    transcriptPolicyVersion: string;
  };
  quality: {
    recognitionConfidence: number | null;
    segmentCount: number;
    hasUsableSpeech: boolean;
  };
  timing: {
    recognitionStartedAt?: string;
    recognizedAt?: string;
    responseStartedAt?: string;
    respondedAt?: string;
    synthesisStartedAt?: string;
    completedAt?: string;
  };
  cost: {
    currency: "USD";
    basis: "conservative-reservation";
    reservedCostUsd: number;
    reportedCostUsd: number | null;
  };
  failureCode?: string;
};

declare global {
  var __echotalkTurnRecords:
    | { bySession: Map<string, Map<number, TurnRecord>> }
    | undefined;
}

function getStore() {
  if (!globalThis.__echotalkTurnRecords) {
    globalThis.__echotalkTurnRecords = { bySession: new Map() };
  }
  return globalThis.__echotalkTurnRecords;
}

export function createTurnRecord(sessionId: string, turnNumber: number) {
  const byTurn = getStore().bySession.get(sessionId) ?? new Map();
  const existing = byTurn.get(turnNumber);
  if (existing) return existing;

  const now = new Date().toISOString();
  const created: TurnRecord = {
    ...createTurnIdentifiers({ sessionId, turnNumber }),
    contractVersion: TURN_CONTRACT_VERSION,
    state: "created",
    createdAt: now,
    updatedAt: now,
    transcript: {
      raw: "",
      verbatim: "",
      corrected: null,
      normalized: null,
      segments: [],
    },
    response: { displayText: "", ttsText: "" },
    providers: [],
    usage: [],
    route: { transcriptPolicyVersion: "unassigned" },
    quality: {
      recognitionConfidence: null,
      segmentCount: 0,
      hasUsableSpeech: false,
    },
    timing: {},
    cost: {
      currency: "USD",
      basis: "conservative-reservation",
      reservedCostUsd: 0,
      reportedCostUsd: null,
    },
  };
  byTurn.set(turnNumber, created);
  getStore().bySession.set(sessionId, byTurn);
  return created;
}

export function getTurnRecord(sessionId: string, turnNumber: number) {
  return getStore().bySession.get(sessionId)?.get(turnNumber);
}

export function getLatestTurnRecord(sessionId: string) {
  const records = [
    ...(getStore().bySession.get(sessionId)?.values() ?? []),
  ];
  return records.sort((a, b) => b.turnNumber - a.turnNumber)[0] ?? null;
}

export function allocateTurnNumber(sessionId: string) {
  const records = getStore().bySession.get(sessionId);
  const current = records ? Math.max(0, ...records.keys()) : 0;
  return current + 1;
}

export function updateTurnRecord(
  sessionId: string,
  turnNumber: number,
  update: (record: TurnRecord) => void
) {
  const record = createTurnRecord(sessionId, turnNumber);
  update(record);
  record.updatedAt = new Date().toISOString();
  if (["completed", "no_speech", "failed", "cancelled"].includes(record.state)) {
    record.terminalAt ??= record.updatedAt;
  }
  return record;
}

export function removeTurnRecords(sessionId: string) {
  getStore().bySession.delete(sessionId);
}
