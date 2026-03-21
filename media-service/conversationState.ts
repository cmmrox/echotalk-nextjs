export type ConversationState =
  | "idle"
  | "connecting"
  | "listening"
  | "user_speaking"
  | "user_pause_candidate"
  | "finalizing_user_turn"
  | "processing_stt"
  | "processing_agent"
  | "processing_tts"
  | "assistant_speaking"
  | "interruption_candidate"
  | "recovering"
  | "error"
  | "stopped";

export const DEFAULT_CONVERSATION_STATE: ConversationState = "idle";

export function deriveConversationStateFromLegacyStatus(status: string): ConversationState {
  switch (status) {
    case "created":
      return "idle";
    case "signaling":
      return "connecting";
    case "connected":
      return "listening";
    case "processing":
      return "processing_stt";
    case "speaking":
      return "assistant_speaking";
    case "stopped":
      return "stopped";
    case "error":
      return "error";
    default:
      return DEFAULT_CONVERSATION_STATE;
  }
}

export function deriveLegacyStatusFromConversationState(state: ConversationState):
  | "created"
  | "signaling"
  | "connected"
  | "processing"
  | "speaking"
  | "stopped"
  | "error" {
  switch (state) {
    case "idle":
      return "created";
    case "connecting":
      return "signaling";
    case "listening":
    case "user_speaking":
    case "user_pause_candidate":
    case "recovering":
      return "connected";
    case "finalizing_user_turn":
    case "processing_stt":
    case "processing_agent":
    case "processing_tts":
    case "interruption_candidate":
      return "processing";
    case "assistant_speaking":
      return "speaking";
    case "stopped":
      return "stopped";
    case "error":
      return "error";
    default:
      return "created";
  }
}
