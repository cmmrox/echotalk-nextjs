# EchoTalk — PROGRESS

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

---

## Known Issues

| # | Area | Description | Workaround |
|---|------|-------------|------------|
| 1 | AEC | Chrome's Acoustic Echo Cancellation only partially removes AI speech from mic input at low volumes. AEC-processed residue can still reach STT if it passes the 30-frame threshold. | Turn up speaker volume so AEC suppression is stronger, or use headphones. |
| 2 | Turn-taking | 300-packet time window (~6s) is the primary segmentation trigger; VAD is a best-effort overlay. Long pauses mid-sentence may split turns. | Speak at a natural pace; avoid very long pauses. |
| 3 | WebRTC DTLS | DTLS connection may not be ready even after the 3s polling window on very high-latency networks. Outbound audio is silently dropped in that case. | Re-connect the session. |
| 4 | HTTP fallback | 8s safety-net timeout to re-open the listening gate may be too short for very long AI responses over the HTTP path. | Session will recover on next STT turn. |
