# Log 09 — STT migrated to Speech-to-Text V2 (auto language)

## Why
Speech-to-Text V1 often biases toward the primary language and doesn’t reliably label the predicted language code in responses. Speech-to-Text V2 supports multi-language recognition via `languageCodes` and labels results with the predicted language code.

## What changed
- Updated `POST /api/stt` to use `@google-cloud/speech` **v2** client.
- Request now uses:
  - `recognizer: projects/<projectId>/locations/global/recognizers/_`
  - `config.autoDecodingConfig: {}`
  - `config.languageCodes`: from `ECHOTALK_LANGUAGES` (first 3)
  - `config.model`: from `ECHOTALK_STT_MODEL` (default `chirp_3`)
- Response now returns `detectedLanguage` from the v2 `result.languageCode` (fallback to transcript-based heuristic).
- Updated `.env.example` to document `ECHOTALK_STT_MODEL`.

## Verification
- `npm run lint` passed.
- `npm run build` passed.

## Notes
- Best results require a clean audio input and keeping the language shortlist tight (<= 3).
