# EchoTalk (Next.js)

Minimal voice conversational AI web app:

Mic → **Google STT** → **OpenAI** → **Google TTS** → playback

## Prereqs
- Node.js + npm
- Google Cloud service account JSON with access to:
  - Speech-to-Text
  - Text-to-Speech

## Setup

1) Install deps
```bash
npm install
```

2) Create `.env.local`

This repo expects server-side secrets **only** in `.env.local` (gitignored).
Use `.env.example` as reference.

Minimum required:
- `ECHOTALK_GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/google-sa.json`
- `OPENAI_API_KEY=...`

Optional:
- `ECHOTALK_LANGUAGES=en-US,si-LK,ta-LK`
- `OPENAI_MODEL=gpt-4.1-mini`
- `NEXT_PUBLIC_ECHOTALK_MAX_RECORD_SECONDS=60`

## Run
```bash
npm run dev
```
Open http://localhost:3000

## Endpoints
- `POST /api/stt` (multipart/form-data: `audio`)
- `POST /api/agent` (JSON: `{ transcript, detectedLanguage? }`)
- `POST /api/tts` (JSON: `{ text, languageCode? }`) → returns `audio/mpeg`

## Troubleshooting
- **Mic permission**: ensure your browser allows microphone access.
- **Google auth**: verify `GOOGLE_APPLICATION_CREDENTIALS` points to a readable JSON file.
- **OpenAI**: verify `OPENAI_API_KEY` is set in `.env.local`.
