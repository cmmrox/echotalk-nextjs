# Archived Plan 03 — Microphone capture (MediaRecorder)

## Goal
Implement real microphone capture in the browser so the EchoTalk button actually starts/stops recording and produces an audio Blob we can send to STT in Stage 04.

## Tasks
1. Request mic permission via `navigator.mediaDevices.getUserMedia({ audio: true })`.
2. Record audio using `MediaRecorder`.
   - Prefer `audio/webm;codecs=opus` when supported.
3. Collect chunks and assemble a final `Blob` on stop.
4. Update Stop behavior to:
   - stop the MediaRecorder
   - stop all media tracks
   - clear timers
5. Enforce a max record duration (default 60s).
6. Add minimal debug info (recording seconds, blob size) without adding a second screen.

## Verification
- Clicking the button starts a recording.
- Clicking again stops and yields a non-empty audio Blob.
- Mic is released (no recording indicator remains).
- `npm run build` succeeds.
