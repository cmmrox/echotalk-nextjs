# Archived Plan 04 — Google Speech-to-Text (STT) API route

## Goal
Upload the recorded audio Blob to the server and get back a transcript + detected language using Google Cloud Speech-to-Text.

## Tasks
1. Add dependency: `@google-cloud/speech`.
2. Implement `POST /api/stt` in `app/api/stt/route.ts`:
   - accept `multipart/form-data` with `audio` file
   - map MIME type to Google encoding (prefer WEBM_OPUS / OGG_OPUS)
   - enable language detection using a configured shortlist (`ECHOTALK_LANGUAGES`)
   - return `{ transcript, detectedLanguage, confidence }`
3. Update client so that when recording stops it:
   - sets state to `processing`
   - uploads audio to `/api/stt`
   - displays transcript and detected language
   - supports cancel via AbortController
4. Add `.env.example` entry for `ECHOTALK_LANGUAGES` and mention `GOOGLE_APPLICATION_CREDENTIALS`.

## Verification
- Record speech and stop.
- Server returns transcript JSON.
- UI shows transcript and detected language.
- `npm run build` succeeds.
