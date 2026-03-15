# Log 03 — Microphone capture (MediaRecorder)

## What was built
- Implemented real microphone capture using `navigator.mediaDevices.getUserMedia({ audio: true })`.
- Implemented recording using `MediaRecorder` with best-effort mime type selection (prefers opus/webm when supported).
- Collected audio chunks and assembled a final `Blob` when recording stops.
- Updated Stop behavior to release resources:
  - stops MediaRecorder
  - stops media tracks (releases mic)
  - clears timers
- Added a max record duration (60s) with auto-stop.
- Added minimal debug info on the single view:
  - recording seconds
  - last recording mime type + size

## Files changed
- `app/page.tsx`
- `impl-plans/plan-03-microphone-capture.md`
- `PROGRESS.md`

## Verification
- `npm run build` succeeded.

## Follow-ups
- Stage 04: create `/api/stt` to upload the Blob and get transcript + detected language.
