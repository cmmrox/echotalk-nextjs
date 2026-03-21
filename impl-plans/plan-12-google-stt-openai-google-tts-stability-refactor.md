# Plan 12 — EchoTalk Stability Refactor (Keep Google STT + OpenAI Text + Google TTS)

## Goal

Improve EchoTalk live conversation accuracy and stability while preserving the current provider stack:

- Google STT
- OpenAI text model
- Google TTS

The target is to make the app behave more like polished realtime WebRTC voice apps without replacing the core provider structure.

---

## Current problems

### Short phrases are missed
Examples:
- yes
- no
- okay
- wait
- hello

Likely causes:
- minimum speech duration too high
- VAD threshold too aggressive
- browser-side turn finalization too authoritative
- not enough prefix padding before speech
- short valid turns being discarded as noise/silence

### Long phrases are cut in the middle
Examples:
- long requests
- sentences with brief pauses
- thinking pauses
- list-style utterances

Likely causes:
- endpointing too eager
- VAD-only end detection
- silence timeout too short
- overlapping browser/server turn ownership
- segment reset/finalize race conditions

### Reply voice / turn handoff is unstable
Likely causes:
- mixed playback modes
- timing-based listening toggles
- no single authoritative conversation state machine

---

## Target architecture

### Browser responsibilities
- capture microphone audio
- maintain WebRTC session
- render session UI and telemetry
- play assistant audio
- optionally send lightweight speech hints

### Server responsibilities
- receive continuous live audio
- maintain authoritative conversation state
- own turn detection and finalization
- run Google STT → OpenAI → Google TTS
- manage interruption, playback, and listening transitions

### Core principle
VAD should be treated as a signal, not the final judge of turn completion.

---

## Architecture decisions

### Keep
- Next.js app and current project structure
- WebRTC live session model
- Google STT for transcription
- OpenAI text generation
- Google TTS for reply audio

### Change
- stop relying on browser-finalized WAV uploads as the primary live path
- make the server the authoritative owner of turn completion
- unify assistant speaking/listening transitions under one state machine
- keep HTTP playback only as an emergency fallback, not a routine path

---

## Phase 1 — Freeze the live architecture and remove ambiguity

### Goal
Make one live path authoritative.

### Actions
1. Mark browser-upload `speech-turn` flow as fallback/debug path only.
2. Make continuous live media ingestion + server-owned turn processing the primary path.
3. Ensure only one path owns:
   - turn numbering
   - transcript creation
   - STT trigger
   - agent trigger
   - TTS trigger

### Deliverables
- updated architecture note in repo
- route comments clarified
- deprecated hybrid flows clearly labeled

---

## Phase 2 — Build a proper server-side conversation state machine

### Goal
Replace scattered flags with explicit state transitions.

### Proposed states
- `idle`
- `connecting`
- `listening`
- `user_speaking`
- `user_pause_candidate`
- `finalizing_user_turn`
- `processing_stt`
- `processing_agent`
- `processing_tts`
- `assistant_speaking`
- `interruption_candidate`
- `recovering`
- `error`

### Key rule examples
- speech while listening → `user_speaking`
- silence after speech → `user_pause_candidate`
- enough evidence user is done → `finalizing_user_turn`
- TTS playback begins → `assistant_speaking`
- user speaks during assistant speech → `interruption_candidate`

### Likely files affected
- `media-service/sessionManager.ts`
- `media-service/store.ts`
- `media-service/listeningState.ts`
- `media-service/processingQueue.ts`
- `media-service/peerManager.ts`
- `components/echo/live-session-panel.tsx`

---

## Phase 3 — Redesign turn detection: VAD becomes advisory

### Goal
Do not let browser silence alone decide final turn boundaries.

### New turn model
Three layers:

1. **Speech presence**
   - speech started
   - speech may have paused

2. **Audio duration rules**
   - total speech duration
   - silence after last speech
   - rolling turn duration
   - short-utterance protection

3. **Transcript-aware endpointing**
   - whether transcript appears complete
   - whether to wait longer
   - whether hard timeout should finalize

### New configuration parameters
- `speechStartThreshold`
- `minSpeechMs`
- `shortUtteranceMinSpeechMs`
- `prefixPaddingMs`
- `minEndpointDelayMs`
- `maxEndpointDelayMs`
- `pauseExtendMs`
- `hardTurnMaxMs`

### Suggested starting values
- `minSpeechMs`: 180–250ms
- `prefixPaddingMs`: 250–400ms
- `minEndpointDelayMs`: 500–700ms
- `maxEndpointDelayMs`: 1500–2200ms
- `hardTurnMaxMs`: 12000–18000ms

---

## Phase 4 — Add rolling audio buffer with prefix padding and safe finalization

### Goal
Never lose the beginning of short phrases and avoid slicing long phrases badly.

### Design
Maintain a rolling per-session buffer that contains:
- pre-speech audio window
- active speech frames
- trailing silence window

### Behavior
- on speech start: include recent prefix padding
- on speech stop: do not finalize immediately
- on finalize: cut one clean segment for STT

### Recommendation
Create a new module:
- `media-service/turnDetector.ts`

This module should own:
- speech start
- speech continuation
- pause candidate
- endpoint decisions
- final segment extraction

### Likely files affected
- `media-service/segmentationBuffer.ts`
- `media-service/inboundTrack.ts`
- `media-service/turnAudioStore.ts`
- new `media-service/turnDetector.ts`

---

## Phase 5 — Upgrade Google STT usage toward streaming / near-streaming turn support

### Goal
Keep Google STT, but reduce blind turn-finalization mistakes.

### Preferred path
Use Google STT in a more streaming-oriented way if feasible for the chosen languages and latency profile.

### Fallback path
If true streaming is too heavy initially:
- keep turn-based transcription
- but let the server fully own segmentation
- reduce delay from finalized turn → STT submission
- use transcript feedback to improve endpointing behavior over time

### Deliverables
- upgraded `lib/services/stt.ts`
- optional STT session manager for streaming mode
- transcript progress events available to UI/debug layer

---

## Phase 6 — Add transcript-aware endpointing heuristics

### Goal
Prevent long speech from being cut just because the user paused briefly.

### Heuristic examples
If transcript ends with:
- conjunctions (`and`, `but`, `because`, `then`, `so`)
- hesitation markers (`uh`, `umm`)
- incomplete numeric/address-like fragments
- clause fragments without closure

Then wait longer before finalizing.

If transcript looks complete:
- short answer
- command
- clear question
- closed statement

Then finalize faster.

### Recommendation
Create a new module:
- `media-service/endpointingHeuristics.ts`

Inputs:
- transcript text
- time since last speech
- utterance duration
- transcript stability
- recent transcript changes

Outputs:
- finalize now
- wait longer
- hard finalize

---

## Phase 7 — Add explicit short-utterance protection

### Goal
Ensure very short valid speech is processed.

### Rules
If speech start was confidently detected and any of the following is true:
- speech duration exceeds very small minimum
- audio energy exceeds speech floor
- STT returns short but valid transcript

Then keep and process the turn.

### Must support
- one-word turns
- one-syllable confirmations
- short commands

---

## Phase 8 — Rebuild interruption / barge-in handling as first-class logic

### Goal
Allow natural user interruption while assistant is speaking.

### Behavior
When assistant is speaking and user starts talking:
1. detect interruption candidate
2. pause/stop assistant playback
3. classify real interruption vs false positive
4. resume playback if false interruption and configured to do so
5. truncate unheard assistant output if true interruption
6. switch fully back to listening and capture the new user turn

### New parameters
- `interruptMinSpeechMs`
- `interruptMinEnergy`
- `interruptMinWords`
- `falseInterruptionTimeoutMs`
- `resumeFalseInterruption`
- `assistantTruncateOnInterrupt`

### Likely files affected
- `media-service/listeningState.ts`
- `media-service/outboundAudioTrack.ts`
- `media-service/processingQueue.ts`
- `components/echo/live-session-panel.tsx`

---

## Phase 9 — Stabilize assistant audio output path

### Goal
Make reply voice delivery predictable.

### Short-term rules
- WebRTC playback is primary
- HTTP playback is emergency fallback only
- one playback decision per turn
- one playback completion event per turn

### Add telemetry
- fallback usage count
- browser/track failures
- TTS conversion duration
- playback start latency
- whether RTC track became audible

### Mid-term goal
Reduce routine dependence on mixed playback behavior.

---

## Phase 10 — Improve client capture quality

### Goal
Give STT and turn detection cleaner input.

### Actions
Verify and tune microphone constraints:
- `echoCancellation: true`
- `noiseSuppression: true`
- `autoGainControl: true`
- mono input
- stable sample-rate handling where feasible

### Optional diagnostics
- mic energy floor
- clipping detection
- input device info
- average speech level

---

## Phase 11 — Instrument every turn for debugging and tuning

### Goal
Make tuning evidence-based.

### Log per turn
- session id
- turn id
- speech start time
- speech end time
- finalization reason
- speech duration
- silence duration
- total turn duration
- transcript preview
- short-utterance protection trigger
- interruption data
- playback path used
- latency breakdown:
  - speech end → transcript final
  - transcript final → agent reply
  - agent reply → TTS ready
  - TTS ready → playback start

### Suggested event types
- `turn_speech_started`
- `turn_pause_candidate`
- `turn_endpoint_extended`
- `turn_finalized`
- `turn_short_phrase_protected`
- `turn_interrupted`
- `turn_false_interruption`
- `turn_playback_started`
- `turn_playback_finished`

---

## Phase 12 — Add a formal test matrix

### Goal
Verify improvements for short speech, long speech, interruption, and noise.

### Test categories
#### Short phrase tests
- yes
- no
- okay
- hi
- hello
- sure
- stop
- wait
- continue

#### Long phrase tests
- 10–20 second requests
- list-style requests
- pauses while thinking
- mixed English/Sinhala/Tamil utterances

#### Interruption tests
- user interrupts assistant early
- user interrupts assistant late
- false interruption noise
- background click/cough while assistant speaks

#### Noisy environment tests
- fan noise
- laptop speaker bleed
- low-volume speech
- distance-from-mic variations

### Acceptance targets
- short phrases: >95% capture success in clean conditions
- long phrases: no premature cutoff for normal pauses
- interruption: assistant stops quickly and avoids self-transcription loops

---

## Recommended new modules

- `media-service/turnDetector.ts`
- `media-service/endpointingHeuristics.ts`
- `media-service/conversationState.ts`
- `media-service/metrics.ts`

---

## Refactor guidance for existing modules

### `media-service/inboundTrack.ts`
Should focus on audio ingestion and forwarding into turn detection.

### `media-service/segmentationBuffer.ts`
Should focus on rolling buffer storage and safe extraction.

### `media-service/processingQueue.ts`
Should focus on finalized-turn pipeline execution only.

### `components/echo/live-session-panel.tsx`
Should focus on UI, telemetry, and control flow — not authoritative turn ownership.

---

## Rollout order

1. Create state machine and turn detector modules
2. Make one live path authoritative
3. Add rolling buffer + short-utterance protection
4. Tune endpointing delays for long phrases
5. Improve interruption handling
6. Stabilize playback path and fallback usage
7. Add telemetry + formal test matrix
8. Optionally upgrade STT integration to fuller streaming behavior

---

## What not to do

- do not keep tuning two competing live pipelines at once
- do not let browser silence directly finalize every turn
- do not discard short speech only because duration is small
- do not mix WebRTC and HTTP playback casually for the same turn
- do not spread turn logic across many files without a state machine
- do not assume VAD alone can determine conversational completeness

---

## Expected outcome

If implemented well, EchoTalk should improve in these ways:

### Short phrases
- better capture reliability for brief user speech

### Long phrases
- fewer mid-sentence cutoffs
- better handling of natural pauses

### Conversation quality
- smoother turn handoff
- fewer false activations
- fewer missed turns
- more stable assistant voice playback

### Debuggability
- clear evidence for why a turn succeeded or failed
