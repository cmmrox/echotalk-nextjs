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

### Push-to-talk (legacy / simple)
- `POST /api/stt` — multipart `audio` → `{ transcript, detectedLanguage, confidence }`
- `POST /api/agent` — `{ transcript, detectedLanguage? }` → `{ replyText, replyLanguage }`
- `POST /api/tts` — `{ text, languageCode? }` → `audio/mpeg`

### Live WebRTC conversation (media-service)
| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/media-service/session` | Create a new media session → `{ sessionId }` |
| `GET` | `/api/media-service/session?sessionId=…` | Poll session state + telemetry |
| `DELETE` | `/api/media-service/session?sessionId=…` | End session and clean up peer |
| `POST` | `/api/media-service/offer` | SDP offer → returns SDP answer |
| `POST` | `/api/media-service/ice` | Trickle ICE candidate from browser |
| `POST` | `/api/media-service/trigger-turn` | VAD speech-end → finalize current segment |
| `POST` | `/api/media-service/set-listening?listening=0\|1` | Echo gate: pause/resume inbound processing |
| `GET` | `/api/media-service/outbound/latest?sessionId=…` | Fetch latest TTS audio (HTTP fallback) |
| `POST` | `/api/media-service/client-event` | Browser diagnostic events (logging only) |

## Architecture

```
Browser mic  →  WebRTC (werift)  →  inboundTrack.ts
                                       ↓ VAD / 300-packet window
                                  segmentationBuffer.ts
                                       ↓
                                  processingQueue.ts
                                   ↙         ↘
                           Google STT      (empty → skip)
                                ↓
                           OpenAI agent (with conversation history)
                                ↓
                           Google TTS  →  outboundAudioTrack.ts
                                              ↓ RTP via werift
                                         Browser plays remote track
                                         (HTTP fallback if DTLS not ready)
```

## Troubleshooting
- **Mic permission**: ensure your browser allows microphone access.
- **Google auth**: verify `ECHOTALK_GOOGLE_APPLICATION_CREDENTIALS` points to a readable service-account JSON file.
- **OpenAI**: verify `OPENAI_API_KEY` is set in `.env.local`.
- **WebRTC**: for corporate/strict-NAT networks add TURN server URLs to `iceServers` in `media-service/peerManager.ts`.
