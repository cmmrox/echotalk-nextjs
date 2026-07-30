# Archived Plan 02 — Single-screen UI + state machine

## Goal
Replace the default Next.js landing page with the EchoTalk MVP UI: a single centered toggle button and minimal status text. Implement a client-side state machine that will later drive microphone recording, backend calls, and audio playback.

## Tasks
1. Replace `app/page.tsx` with an EchoTalk page UI.
2. Use shadcn/ui primitives (`Card`, `Button`) for layout and button styling.
3. Implement a simple, explicit state machine:
   - `idle | requesting_permission | listening | processing | speaking | error`
4. Implement a `Stop` action that resets state and is designed to later cancel:
   - MediaRecorder/stream
   - in-flight fetch (AbortController)
   - audio playback
5. Keep the UI as a single view, centered button, with optional small status line.

## Verification
- `npm run dev` shows the EchoTalk UI.
- Button toggles between Idle and Listening.
- No console errors.
