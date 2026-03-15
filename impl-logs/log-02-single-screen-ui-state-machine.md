# Log 02 — Single-screen UI + state machine

## What was built
- Replaced the default Next.js landing page with the EchoTalk MVP single-screen UI.
- Centered layout using shadcn/ui:
  - `Card` for container
  - `Button` as the single toggle control
- Implemented a simple client-side state machine:
  - `idle | requesting_permission | listening | processing | speaking | error`
- Implemented a `Stop` path (`stopAll`) designed to later cancel:
  - in-flight network requests (AbortController)
  - audio playback (HTMLAudioElement)
  - (placeholder) MediaRecorder/mic tracks

## Files changed
- `app/page.tsx`
- `impl-plans/plan-02-single-screen-ui-state-machine.md`
- `PROGRESS.md`

## Verification
- `npm run build` succeeded.

## Follow-ups
- Stage 03: implement actual microphone capture via `MediaRecorder` and upload audio for STT.
