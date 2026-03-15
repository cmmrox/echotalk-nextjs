# Plan 05 — OpenAI agent API route

## Goal
Take `{ transcript, detectedLanguage }` from the STT step, send it to OpenAI on the server, and return `{ replyText }` in the same language as the user.

## Tasks
1. Add dependency: `openai` (official SDK).
2. Add env vars:
   - `OPENAI_API_KEY` (server-only; stored in `.env.local`, documented in `.env.example`)
   - Optional: `OPENAI_MODEL` (defaults to a sensible small model)
3. Implement `POST /api/agent` in `app/api/agent/route.ts`:
   - Accept JSON `{ transcript: string, detectedLanguage?: string }`
   - Validate input and return 400 on missing/empty transcript
   - Call OpenAI **Responses API** with instructions:
     - reply in the same language as the user
     - if `detectedLanguage` is present, prefer it
     - keep responses concise (MVP)
   - Return JSON `{ replyText }`
   - Robust error handling (no key leakage)
4. Client wiring in `app/page.tsx`:
   - After `/api/stt` succeeds, call `/api/agent`
   - Display `replyText` in the UI
   - Respect AbortController cancellation via the existing stop flow

## Verification
- `npm run build` passes.
- Manual test: record speech → stop → transcript appears → reply text appears.
- Stop during processing cancels in-flight requests.
