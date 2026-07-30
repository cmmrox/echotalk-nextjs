# Archived Plan 10 — WebRTC Live Conversation

## Goal

Convert EchoTalk from a push-to-talk, blob-upload voice app into a true WebRTC-based continuous live voice session where the browser keeps one persistent audio session open until the user clicks Stop, while preserving the existing AI stack:

- Google Speech-to-Text
- OpenAI agent
- Google Text-to-Speech

## Target behavior

- User clicks **Start Conversation**
- Browser requests microphone and establishes a WebRTC session to the server
- Mic audio streams continuously until **Stop Conversation** is clicked
- Server receives the live audio stream, detects turn boundaries, transcribes the turn, generates the assistant reply, synthesizes assistant speech, and streams assistant audio back to the browser
- The session remains connected across multiple turns in the same conversation
- User can stop the session at any time

## Architecture overview

### Client
- Next.js app UI
- RTCPeerConnection session manager
- Local microphone track
- Remote audio playback track
- Signaling client (HTTP + optional WebSocket/event polling)
- Conversation status + transcript feed

### Server
- Signaling layer
- Server-side WebRTC peer/session handling
- Audio ingest pipeline
- Turn detection / VAD
- Google STT integration
- OpenAI agent integration with in-memory conversation continuity
- Google TTS integration
- Outbound assistant audio injection into the live session

## Proposed stages

### Stage 10 — WebRTC architecture and contracts
- Finalize lifecycle states and event contracts
- Define session registry and signaling flow
- Add/update plan and progress tracking

### Stage 11 — Signaling layer
- Add session creation/teardown endpoints
- Add SDP offer/answer exchange
- Add ICE candidate exchange transport
- Add basic session registry and cleanup

### Stage 12 — Browser WebRTC client
- Create RTCPeerConnection manager
- Capture mic stream and attach local track
- Handle remote audio playback
- Handle connection lifecycle and teardown

### Stage 13 — Server WebRTC peer and inbound audio handling
- Create server-side peer/session manager
- Receive browser audio track on the server
- Convert inbound audio to a usable processing stream
- Track peer/session resources and cleanup

### Stage 14 — Live audio frame pipeline
- Normalize incoming audio
- Maintain rolling buffers and timestamps
- Provide audio frames to turn detection

### Stage 15 — Server-side VAD / utterance segmentation
- Detect speech start and speech end from continuous audio
- Preserve pre-roll and silence windows
- Produce segmented utterance buffers for STT

### Stage 16 — Google STT integration for segmented turns
- Refactor current STT route logic into reusable service code
- Transcribe each utterance with language detection
- Return transcript metadata into the session pipeline

### Stage 17 — Persistent conversation memory and OpenAI turn handling
- Add ephemeral in-memory session history keyed by session id
- Refactor current agent route logic into reusable service code
- Generate assistant replies using bounded recent history

### Stage 18 — Google TTS synthesis and outbound WebRTC audio
- Refactor current TTS route logic into reusable service code
- Convert TTS output into outbound audio frames
- Stream assistant audio back to the browser through the same live session

### Stage 19 — Turn-taking control and echo prevention
- Avoid self-trigger from assistant playback
- Add playback gating / cooldown logic
- Respect Stop at any phase

### Stage 20 — Live conversation UI redesign
- Replace tap-to-talk with Start/Stop session model
- Show connection/session states
- Show transcript + assistant reply timeline
- Show live indicators for listening/processing/speaking

### Stage 21 — Error handling, teardown, and recovery
- Handle connection failures, mic failure, STT/agent/TTS failures
- Clean up peer connections, tracks, buffers, and session memory safely
- Support clean restart after failure

### Stage 22 — Documentation and polish
- Update README
- Update .env.example if needed
- Document known limitations and local run guidance
- Write implementation logs as stages complete

## Key design decisions

1. **Use actual WebRTC** for the live session transport.
2. **Keep the same AI stack** (Google STT → OpenAI → Google TTS).
3. **Server orchestrates turn-taking**, not the browser.
4. **Session continuity** is maintained with an in-memory conversation store keyed by session id.
5. **Proof-of-concept checkpoint is mandatory** before deep UI polishing: confirm bidirectional audio over WebRTC with server-side handling.

## Risks

### High-risk
- Server-side WebRTC media handling inside/alongside Next.js runtime
- Bridging WebRTC audio frames with STT/TTS processing
- Injecting synthesized assistant audio back into the outbound live session

### Medium-risk
- Echo / self-triggering
- Browser compatibility
- Signaling reliability and cleanup

## Testing plan

- Start/Stop session lifecycle
- Offer/answer exchange
- ICE exchange
- Browser mic to server audio receipt
- Server audio back to browser playback
- Multiple turns in one session
- Stop during listening / processing / speaking
- English / Sinhala / Tamil flows
- Failure scenarios (mic denied, STT failure, TTS failure, disconnect)

## Definition of done

- A user can start one live WebRTC voice session
- The user can speak multiple turns without pressing the talk button again
- The agent responds with synthesized voice inside the same session
- The session continues until Stop is clicked
- Resources are cleaned up correctly on stop/error
- Docs and progress tracking are updated
