# Archived Plan 09 — Migrate STT to Speech-to-Text V2 (auto language detect)

## Goal
Use Google Speech-to-Text V2 multi-language recognition (`language_codes`) so the service can auto-pick the best language from a shortlist and label results with the predicted language code.

## Tasks
1. Update `/api/stt` to use the **v2** client (`@google-cloud/speech` v2):
   - recognizer: `projects/<projectId>/locations/global/recognizers/_`
   - config:
     - `languageCodes`: from `ECHOTALK_LANGUAGES` (max 3)
     - `autoDecodingConfig: {}`
     - `model`: configurable via `ECHOTALK_STT_MODEL` (default `chirp_3`)
2. Parse response:
   - transcript, confidence
   - detectedLanguage from the v2 result’s labeled language code (fallback to heuristic)
3. Update `.env.example` docs:
   - `ECHOTALK_STT_MODEL=chirp_3`
4. Verify lint/build.

## Verification
- Speak Sinhala → transcript should be Sinhala.
- API should return `detectedLanguage=si-LK` (or similar) when Sinhala is spoken.
