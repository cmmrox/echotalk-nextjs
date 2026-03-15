# Plan 07 — Hardening (errors/logging/env docs)

## Goal
Improve reliability, safety, and clarity: consistent errors, sane limits, better cancellation, and clearer setup docs.

## Tasks
1. Add shared limits/constants (max transcript length, max TTS text length).
2. Update API routes (`/api/agent`, `/api/tts`, `/api/stt`) to:
   - validate input sizes
   - return consistent `{ error, message }` JSON for failures
3. Client UX improvements:
   - show clearer processing sub-status (transcribing / thinking / speaking)
   - ensure Stop always aborts + cleans up without hanging
4. Env wiring:
   - wire `ECHOTALK_MAX_RECORD_SECONDS` to client limit (default 60)
   - document all env vars in `.env.example` + `README.md`
5. Verification:
   - `npm run lint` and `npm run build`

## Output
- Update `PROGRESS.md`
- Write `impl-logs/log-07-hardening.md`
