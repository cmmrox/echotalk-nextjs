# Log 06 — Google TTS + playback

## What shipped
- Added Google Cloud Text-to-Speech integration.
- Implemented `POST /api/tts` (`app/api/tts/route.ts`):
  - Input: `{ text, languageCode? }`
  - Output: MP3 audio bytes (`Content-Type: audio/mpeg`)
  - Uses `GOOGLE_APPLICATION_CREDENTIALS` for server-side auth.
- Client now completes the full chain:
  - Record → `/api/stt` → `/api/agent` → `/api/tts` → playback
  - Playback is cancellable via the existing Stop flow (AbortController + audio stop).
  - Object URLs are revoked to avoid leaks.

## Verification
- `npm run build` succeeded.

## Notes / follow-ups
- Voice selection is currently “best effort” by passing `languageCode` to Google and letting it choose.
- Next hardening stage can improve:
  - better language fallback for unsupported codes
  - tighter error UX
  - rate limits / max text length
