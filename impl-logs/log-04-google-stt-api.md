# Log 04 — Google Speech-to-Text (STT)

## What was built
- Added server route: `POST /api/stt` (`app/api/stt/route.ts`).
  - Accepts `multipart/form-data` with `audio` file.
  - Maps common MediaRecorder MIME types to Google encodings:
    - `audio/webm` → `WEBM_OPUS`
    - `audio/ogg` → `OGG_OPUS`
  - Uses `ECHOTALK_LANGUAGES` to configure primary + alternative languages.
  - Returns `{ transcript, detectedLanguage, confidence }`.
- Client now uploads the recorded audio Blob to `/api/stt` after stopping and displays:
  - transcript
  - detected language
- Added `.env.example` documenting `GOOGLE_APPLICATION_CREDENTIALS` and `ECHOTALK_LANGUAGES`.

## Dependencies
- Added `@google-cloud/speech`.

## Notes
- TypeScript overloads for `SpeechClient.recognize` required a small cast to avoid build-time type issues.

## Verification
- `npm run build` succeeded.

## Follow-ups
- Stage 05: `/api/agent` (OpenAI) — reply in the same detected language.
