# Log 07 — Hardening

## What changed
- Added shared limits in `lib/limits.ts`:
  - max transcript chars, max TTS text chars, etc.
- API error shape tightened:
  - `/api/stt` now returns `{ error, message }` on failures.
  - `/api/agent` and `/api/tts` validate input + enforce size limits with clear 400s.
- Client UX polish:
  - Added `processingHint` so the UI shows clearer phases (Transcribing / Thinking / Generating voice).
  - Wired client max record seconds to `NEXT_PUBLIC_ECHOTALK_MAX_RECORD_SECONDS` (default 60).
- Docs:
  - Replaced boilerplate `README.md` with EchoTalk-specific setup/run instructions.
  - Updated `.env.example` accordingly.

## Verification
- `npm run lint` passed.
- `npm run build` passed.

## Follow-ups (optional)
- Add better fallback when a detected language isn’t supported by a TTS voice.
- Add rate-limiting / abuse controls if exposed beyond local dev.
