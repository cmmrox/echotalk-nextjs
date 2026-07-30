# Archived Plan 11 — Full End-to-End WebRTC Media Service

## Goal

Replace the current hybrid live-conversation prototype with a true end-to-end WebRTC architecture where:

- browser microphone audio is consumed directly from the WebRTC media track
- server processes the live inbound media stream without HTTP turn-audio uploads
- server performs turn segmentation / VAD from the live stream
- server runs Google STT → OpenAI → Google TTS for each turn
- assistant audio is injected back into the active WebRTC session as remote media
- browser receives assistant voice over the same WebRTC session
- the conversation stays live until the user presses Stop

## Why a new plan is needed

The existing implementation established useful groundwork (signaling, session state, VAD experiments, live loop logic), but it remains hybrid because turn audio is still uploaded over HTTP and assistant audio is still played from a fetched response. That does not satisfy the end-to-end WebRTC requirement.

This plan defines the new major implementation phase required to fully replace the hybrid transport.

## Architecture target

### Client responsibilities
- Request mic permission
- Establish WebRTC session via signaling
- Add microphone track to RTCPeerConnection
- Play remote assistant audio track from the same session
- Show connection/session state and transcript timeline
- Send only signaling/control messages (not turn-audio blobs)

### Server responsibilities
- Maintain a long-lived WebRTC media service/process
- Terminate peer connections
- Receive inbound audio from browser tracks
- Extract/process live audio frames
- Run VAD / utterance segmentation from inbound track data
- Transcribe utterances with Google STT
- Maintain session conversation memory
- Generate responses with OpenAI
- Synthesize audio with Google TTS
- Inject assistant audio back into the outbound WebRTC track
- Handle cleanup/reconnect/stop lifecycle

## Major design decision

Implement a **dedicated long-lived media service** inside the project rather than relying only on per-request Next.js route handlers for live media state.

### Rationale
- Next.js API routes are fine for signaling/bootstrap and non-realtime operations
- direct media handling needs long-lived session state and peer objects
- end-to-end WebRTC requires stable process memory for active peer/media pipelines

## Stage breakdown

### Stage 23 — Full WebRTC architecture update
- Replace prior hybrid destination assumptions
- Document final media-service architecture and boundaries
- Mark hybrid flow as interim/legacy path
- Update progress tracking

### Stage 24 — Dedicated media service scaffold
- Create a long-lived Node service/module inside the repo
- Define startup, shutdown, and local dev run strategy
- Expose signaling hooks / control surface for session create/offer/ICE/stop
- Maintain in-memory peer/session registry in the media service

### Stage 25 — Signaling integration with media service
- Rewire Next.js signaling endpoints to delegate to the media service
- Ensure session creation, offer handling, ICE handling, and teardown all pass through the dedicated service
- Validate browser ↔ media-service handshake end to end

### Stage 26 — Direct inbound track ingest
- Consume browser audio directly from the WebRTC track inside the media service
- Extract usable audio frame data from the inbound track
- Normalize to a format suitable for segmentation and STT pipeline handoff
- Add logging/metrics for frame flow and session health

### Stage 27 — Server-side VAD / utterance segmentation from live track
- Implement turn detection from direct inbound media
- Preserve pre-roll and silence windows
- Ignore noise/empty turns
- Produce turn buffers without HTTP upload path

### Stage 28 — STT integration from direct media buffers
- Feed segmented audio buffers from the media service directly into Google STT
- Preserve language detection and transcription metadata
- Correlate transcripts with session/turn ids

### Stage 29 — Conversation memory + agent turn generation
- Maintain recent conversation turns in the media service session store
- Generate assistant replies with OpenAI using bounded history
- Emit live session events for transcript/thinking/reply state

### Stage 30 — Outbound assistant audio over WebRTC
- Convert Google TTS output into a streamable format for outbound WebRTC media
- Inject synthesized audio into a remote track/source attached to the active peer connection
- Ensure browser receives and plays assistant audio as remote media

### Stage 31 — Turn-taking / duplex control
- Gate user-turn detection while assistant audio is being sent
- Reduce self-trigger and speaker echo effects
- Support return to listening after assistant playback completes
- Keep Stop responsive during all phases

### Stage 32 — Client/UI alignment with pure WebRTC flow
- Remove dependency on HTTP turn-audio upload in the live session UI
- Remove browser-side fetched TTS playback from the live mode
- Keep session state and transcript feed aligned with media-service events
- Preserve Start/Stop conversation model

### Stage 33 — Cleanup of hybrid path
- Retire hybrid live-session code paths once full WebRTC is verified
- Keep old push-to-talk only if intentionally retained as fallback mode
- Remove redundant routes/helpers if they are no longer needed

### Stage 34 — Reliability hardening and docs
- Add clearer logging and failure recovery around the media service
- Document local run/startup instructions for the media service
- Update README, PROGRESS.md, and implementation logs
- Verify end-to-end conversation behavior manually

## Proof checkpoints

### Checkpoint A — Handshake only
- Browser establishes session with dedicated media service
- No 500s in offer/ICE
- Session lifecycle is stable

### Checkpoint B — Direct inbound audio
- Media service can observe/process audio from the real inbound track
- No HTTP audio upload route required for live mode

### Checkpoint C — Assistant remote audio
- Assistant TTS audio returns to browser as remote WebRTC media
- Browser no longer relies on fetched reply audio for live mode

### Checkpoint D — Full conversation loop
- User speaks
- server detects end of turn from track audio
- STT → agent → TTS runs
- assistant replies over remote media
- session returns to listening
- repeats until Stop

## Definition of done

The feature is done only when:
- live mode no longer depends on HTTP turn-audio uploads
- live mode no longer depends on browser-fetched TTS playback
- inbound user audio is processed directly from the WebRTC track
- outbound assistant audio is delivered over the WebRTC session
- a multi-turn voice conversation works continuously until Stop is clicked
- logs/docs/progress are updated
