# Log 08 — Language detection + propagate to agent/TTS

## Problem
Google STT (v1 `recognize`) often does not return a reliable detected language code in the response, so our pipeline was falling back to `en-US`, which biased the agent and TTS toward English.

## What changed
- Added `lib/languageDetect.ts` (Unicode-range heuristic):
  - Sinhala script → `si-LK`
  - Tamil script → `ta-LK`
  - fallback → `en-US`
- Updated `/api/agent` to compute and return `replyLanguage` alongside `replyText`.
- Updated client to:
  - store/display `replyLanguage`
  - call `/api/tts` using `replyLanguage` (fallback to STT hint)

## Verification
- `npm run lint` passed.
- `npm run build` passed.

## Follow-ups
- Expand detection beyond Sinhala/Tamil with a proper detector (franc/cld3) if we want broad language coverage.
