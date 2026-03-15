# Plan 06 — Google Text-to-Speech (TTS) + playback

## Goal
Convert the assistant reply text into audio via Google Cloud Text-to-Speech on the server, then play it back in the browser. User can stop at any time.

## Tasks
1. Add dependency: `@google-cloud/text-to-speech`.
2. Implement `POST /api/tts` in `app/api/tts/route.ts`:
   - Accept JSON `{ text: string, languageCode?: string }`
   - Use Google TTS client with `GOOGLE_APPLICATION_CREDENTIALS` auth.
   - Select voice using `languageCode` when possible (fallback to `en-US`).
   - Return audio bytes (MP3) with `Content-Type: audio/mpeg`.
3. Client wiring in `app/page.tsx`:
   - After `/api/agent` returns, call `/api/tts` with `{ text: replyText, languageCode: detectedLanguage }`.
   - Play audio using an `Audio()` element.
   - Stop button aborts in-flight requests and stops playback immediately.
4. Update `PROGRESS.md` + add `impl-logs/log-06-google-tts-playback.md` once verified.

## Verification
- `npm run build` passes.
- Manual run: record speech → stop → transcript + assistant text appear → audio plays.
- Stop works during processing and during playback.
