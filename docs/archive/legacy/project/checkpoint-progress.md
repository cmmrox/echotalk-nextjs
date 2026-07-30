# Archived EchoTalk Checkpoint Progress

## Stage 01 — Scaffold (Next.js + Tailwind v4 + shadcn/ui)
✅ Done
- Next.js app scaffolded in repo root
- shadcn/ui initialized (template: next, base: radix, preset: nova)
- Added shadcn components: button, card
- Plan: impl-plans/plan-01-scaffold-nextjs-tailwind-shadcn.md

## Stage 02 — Single-screen UI + state machine
✅ Done
- Plan: impl-plans/plan-02-single-screen-ui-state-machine.md

## Stage 03 — Microphone capture
✅ Done
- Plan: impl-plans/plan-03-microphone-capture.md

## Stage 04 — Google STT API route
✅ Done
- Plan: impl-plans/plan-04-google-stt-api.md

## Stage 05 — OpenAI agent API route
✅ Done
- Plan: impl-plans/plan-05-openai-agent-api.md
- Log: impl-logs/log-05-openai-agent-api.md

## Stage 06 — Google TTS + playback
✅ Done
- Plan: impl-plans/plan-06-google-tts-playback.md
- Log: impl-logs/log-06-google-tts-playback.md

## Stage 07 — Hardening (errors/logging/env docs)
✅ Done
- Plan: impl-plans/plan-07-hardening.md
- Log: impl-logs/log-07-hardening.md

## Stage 08 — Language detection (Sinhala/Tamil) + propagate to agent/TTS
✅ Done
- Plan: impl-plans/plan-08-language-detection.md
- Log: impl-logs/log-08-language-detection.md

## Stage 09 — Migrate STT to Google Speech-to-Text V2 (auto language detect)
✅ Done
- Plan: impl-plans/plan-09-stt-v2-auto-language.md
- Log: impl-logs/log-09-stt-v2-auto-language.md

## Stage 10 — WebRTC architecture and contracts
✅ Done
- Plan: impl-plans/plan-10-webrtc-live-conversation.md
- Saving approved WebRTC-specific implementation plan
- Starting signaling + proof-of-concept work

## Stage 11 — Signaling layer
✅ Done
- Plan: impl-plans/plan-10-webrtc-live-conversation.md

## Stage 12 — Browser WebRTC client
✅ Done
- Plan: impl-plans/plan-10-webrtc-live-conversation.md

## Stage 13 — Server WebRTC peer and inbound audio handling
✅ Done
- Plan: impl-plans/plan-10-webrtc-live-conversation.md

## Stage 14 — Live audio frame pipeline
✅ Done
- Plan: impl-plans/plan-10-webrtc-live-conversation.md

## Stage 15 — Server-side VAD / utterance segmentation
✅ Done
- Plan: impl-plans/plan-10-webrtc-live-conversation.md

## Stage 16 — Google STT integration for segmented turns
✅ Done
- Plan: impl-plans/plan-10-webrtc-live-conversation.md

## Stage 17 — Persistent conversation memory and OpenAI turn handling
✅ Done
- Plan: impl-plans/plan-10-webrtc-live-conversation.md

## Stage 18 — Google TTS synthesis and outbound WebRTC audio
✅ Done
- Plan: impl-plans/plan-10-webrtc-live-conversation.md

## Stage 19 — Turn-taking control and echo prevention
✅ Done
- Plan: impl-plans/plan-10-webrtc-live-conversation.md

## Stage 20 — Live conversation UI redesign
✅ Done
- Plan: impl-plans/plan-10-webrtc-live-conversation.md

## Stage 21 — Error handling, teardown, and recovery
✅ Done
- Plan: impl-plans/plan-10-webrtc-live-conversation.md

## Stage 22 — Documentation and polish
✅ Done
- Plan: impl-plans/plan-10-webrtc-live-conversation.md

## Stage 23 — Full WebRTC architecture update
✅ Done
- Plan: impl-plans/plan-11-full-webrtc-media-service.md
- New major phase to replace hybrid live mode with true end-to-end WebRTC transport

## Stage 24 — Dedicated media service scaffold
✅ Done
- Plan: impl-plans/plan-11-full-webrtc-media-service.md

## Stage 25 — Signaling integration with media service
✅ Done
- Plan: impl-plans/plan-11-full-webrtc-media-service.md

## Stage 26 — Direct inbound track ingest
✅ Done
- Plan: impl-plans/plan-11-full-webrtc-media-service.md

## Stage 27 — Server-side VAD / utterance segmentation from live track
✅ Done
- Plan: impl-plans/plan-11-full-webrtc-media-service.md

## Stage 28 — STT integration from direct media buffers
✅ Done
- Plan: impl-plans/plan-11-full-webrtc-media-service.md

## Stage 29 — Conversation memory + agent turn generation
✅ Done
- Plan: impl-plans/plan-11-full-webrtc-media-service.md

## Stage 30 — Outbound assistant audio over WebRTC
✅ Done
- Plan: impl-plans/plan-11-full-webrtc-media-service.md

## Stage 31 — Turn-taking / duplex control
✅ Done
- Plan: impl-plans/plan-11-full-webrtc-media-service.md

## Stage 32 — Client/UI alignment with pure WebRTC flow
✅ Done
- Plan: impl-plans/plan-11-full-webrtc-media-service.md

## Stage 33 — Cleanup of hybrid path
✅ Done
- Deleted legacy `/api/webrtc/{audio,ice,offer,session}` route files
- Plan: impl-plans/plan-11-full-webrtc-media-service.md

## Stage 34 — Reliability hardening and docs
✅ Done
- Server-side listening gate now closes immediately when TTS delivery begins
  (no longer dependent on client polling + HTTP round-trip)
- WebRTC playback re-opens listening gate via outboundAudioTrack finish()
- HTTP fallback path has 8s safety-net timeout to re-open gate
- DTLS polling loop replaces fixed 200ms wait (up to 3s, 100ms intervals)
- 300-packet time window uses finalizeSegmentIfPending (no-op if VAD cleared)
- STT skipped when fewer than 30 voice frames (< 0.6s speech)
- Plan: impl-plans/plan-11-full-webrtc-media-service.md

## Stage 35 — Stability refactor Phase 1: architecture lock + conversation state foundation
✅ Done
- Plan: impl-plans/plan-12-google-stt-openai-google-tts-stability-refactor.md
- Added `media-service/conversationState.ts` for fine-grained live session state
- Extended session store with `conversationState` while preserving legacy `status`
- Session updates now sync legacy status ↔ conversation state automatically
- `speech-turn` route explicitly marked as fallback/debug path during refactor
- Live session telemetry now carries conversationState for incremental UI migration

## Stage 36 — Stability refactor Phase 2: server-owned turn detector foundation
✅ Done
- Added `media-service/turnDetector.ts` as the new server-owned turn coordination layer
- Inbound RTP path now feeds turn detector helpers instead of owning finalize logic directly
- `trigger-turn` route now finalizes through turn detector instead of duplicating turn storage/queueing logic
- Speech signal tracking expanded to include stop hints and timestamps
- Segmentation buffer gained explicit segment-start hook for turn-detector integration
- Progress snapshots now include speech-signal state for centralized detector debugging
- Turn detector now exposes structured snapshot/finalize result types for the next refactor pass
- Deferred turn handling now preserves detector-owned turn metadata while processing is busy
- Added Phase 3 hook points for short-utterance threshold tuning inside the detector

## Stage 37 — Stability refactor Phase 3: endpointing + short utterance protection
✅ Done
- Added `media-service/endpointingHeuristics.ts` for detector-side endpoint decisions
- Detector now considers silence timing before finalizing turns
- Added strong short-utterance finalize path for brief user speech
- Trigger-turn and time-window skip events now include endpoint decision metadata
- Added natural-pause extension logic so longer utterances get extra silence budget before finalize
- Detector thresholds now separate short-utterance vs natural-pause behavior
- Added signal-strength gating using average bytes-per-packet to better reject weak/noisy short segments
- Added explicit `turn_endpoint_deferred` telemetry for tuning deferred finalize cases
- Added `turn_detector_progress` telemetry and average-bytes-per-packet visibility in finalize/defer paths
- Detector endpointing path is now ready for real voice testing/tuning

## Stage 38 — Stability refactor Phase 4: processing pipeline cleanup
✅ Done
- Added `media-service/pipeline.ts` to hold the primary finalized-turn processing path
- Moved STT → agent → TTS orchestration out of `processingQueue.ts` into a dedicated pipeline module
- `processingQueue.ts` now focuses on queueing, concurrency, and outcome handling instead of mixed audio/AI logic
- Pipeline now returns authoritative outbound-audio metadata so queue/state updates stop reconstructing it separately
- Pipeline outcomes now explicitly distinguish usable-speech vs skipped/no-speech cases for cleaner session/result handling
- Queue completion now uses pipeline-owned latest-result shaping instead of rebuilding that object inline
- Queue completion now uses a pipeline-owned session patch contract for latest result/TTS/outbound state

## Stage 39 — Stability refactor Phase 5: interruption / barge-in handling
✅ Done
- Added `media-service/interruptions.ts` to track interruption candidate/active state per session
- Speech-start during assistant playback now creates an explicit interruption candidate instead of looking like normal speech
- Speech-stop after interruption candidate now commits interruption state and emits dedicated events
- Outbound WebRTC playback now watches interruption state and stops early when user barge-in is detected
- Listening resume now resolves interruption state explicitly instead of silently clearing it
- Interruption-driven playback stop now differentiates candidate vs committed interruption in conversation state transitions
- `speech-start` route now preserves barge-in intent during assistant playback instead of hard-rejecting it
- Added candidate-age gating to reduce false interruption commits from ultra-short accidental triggers
- Added interruption telemetry helpers so candidate/active age is visible during commit/reject decisions

## Stage 40 — Stability refactor Phase 6: playback stabilization
✅ Done
- Outbound delivery state now records intended playback mode (`rtc` vs `http`)
- Pipeline now decides playback mode before closing the listening gate, instead of treating delivery prep as mode-agnostic
- Playback/listening events now carry playback mode metadata for easier diagnosis of WebRTC vs fallback behavior
- HTTP delivery marking now includes expected turn number to reduce stale/double delivery marking during polling fallback
- Pipeline now clears prior outbound delivery state before publishing a new TTS turn
- Client RTC→HTTP fallback now avoids replay when turn bookkeeping has already advanced

## Stage 41 — Stability refactor Phase 7: telemetry + test matrix
✅ Done
- Added `media-service/metrics.ts` for per-turn timing metrics and latest metric snapshot publishing
- Detector and pipeline now stamp per-turn timing markers across finalize/STT/agent/TTS stages
- Session store now exposes `latestMetrics` for diagnostics
- Session API and client telemetry types now include `latestMetrics`
- RTC playback now stamps playback start/finish timing into per-turn metrics
- Added `impl-logs/test-matrix-voice-stability.md` with manual validation criteria for short speech, long speech, interruption, and playback reliability
- Telemetry typing has been tightened so client/session diagnostics can consume shared metric shapes more safely

---

## Known Issues

| # | Area | Description | Workaround |
|---|------|-------------|------------|
| 1 | AEC | Chrome's Acoustic Echo Cancellation only partially removes AI speech from mic input at low volumes. AEC-processed residue can still reach STT if it passes the 30-frame threshold. | Turn up speaker volume so AEC suppression is stronger, or use headphones. |
| 2 | Turn-taking | 300-packet time window (~6s) is the primary segmentation trigger; VAD is a best-effort overlay. Long pauses mid-sentence may split turns. | Speak at a natural pace; avoid very long pauses. |
| 3 | WebRTC DTLS | DTLS connection may not be ready even after the 3s polling window on very high-latency networks. Outbound audio is silently dropped in that case. | Re-connect the session. |
| 4 | HTTP fallback | 8s safety-net timeout to re-open the listening gate may be too short for very long AI responses over the HTTP path. | Session will recover on next STT turn. |
