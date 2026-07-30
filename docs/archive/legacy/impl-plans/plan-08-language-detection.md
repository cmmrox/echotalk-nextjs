# Archived Plan 08 — Language detection + propagate through agent/TTS

## Goal
Ensure the app responds in the same language the user speaks, even when Google STT doesn’t return a reliable detected language code.

## Approach
- Detect language from the STT transcript text (Unicode-range heuristic for Sinhala/Tamil; fallback to English).
- Return `replyLanguage` from `/api/agent`.
- Use `replyLanguage` when calling `/api/tts`.

## Tasks
1. Add `lib/languageDetect.ts`:
   - Sinhala range → `si-LK`
   - Tamil range → `ta-LK`
   - default → `en-US`
2. Update `/api/agent`:
   - compute `replyLanguage` from transcript (and/or detectedLanguage)
   - return `{ replyText, replyLanguage }`
3. Update client (`app/page.tsx`):
   - store/display `replyLanguage`
   - call `/api/tts` with `languageCode: replyLanguage`
4. Verify build/lint.

## Verification
- `npm run lint`
- `npm run build`
- Manual test: speak Sinhala → Sinhala transcript → Sinhala reply text → Sinhala TTS voice.
