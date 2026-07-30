import { clearOutboundDelivery } from "@/media-service/outboundDelivery";
import { removeInterruptionState } from "@/media-service/interruptions";
import { removeListeningState } from "@/media-service/listeningState";
import { removeTurnMetrics } from "@/media-service/metrics";
import { removeProcessingState } from "@/media-service/processingQueue";
import { clearMediaPeerEphemera } from "@/media-service/peerManager";
import { removeMediaResults } from "@/media-service/resultStore";
import { removeSegmentationState } from "@/media-service/segmentationBuffer";
import { closeMediaSession } from "@/media-service/sessionManager";
import { removeSpeechStart } from "@/media-service/speechStartTracker";
import { removeStoredTtsAudio } from "@/media-service/ttsStore";
import { removeTurnAudio } from "@/media-service/turnAudioStore";
import { removeTurnRecords } from "@/media-service/turnRecords";
import { removeTurnState } from "@/media-service/turnState";
import { revokeSessionToken } from "@/lib/security/sessionAuthorization";
import { removeProviderBudget } from "@/lib/security/providerBudget";
import { cancelSessionWork } from "@/media-service/sessionWork";

export function cleanupMediaSession(sessionId: string) {
  cancelSessionWork(sessionId);
  clearMediaPeerEphemera(sessionId);
  removeListeningState(sessionId);
  removeInterruptionState(sessionId);
  removeSpeechStart(sessionId);
  removeSegmentationState(sessionId);
  removeTurnState(sessionId);
  removeProcessingState(sessionId);
  removeTurnAudio(sessionId);
  removeTurnRecords(sessionId);
  removeMediaResults(sessionId);
  removeStoredTtsAudio(sessionId);
  removeTurnMetrics(sessionId);
  clearOutboundDelivery(sessionId);
  revokeSessionToken(sessionId);
  removeProviderBudget(sessionId);
  closeMediaSession(sessionId);
}
