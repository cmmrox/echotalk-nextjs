# PRD — EchoTalk (Voice Conversational AI, v0)

## 1) Overview

**Product name:** EchoTalk  
**Goal:** A minimal web app that lets a user talk to an AI using their microphone. The system transcribes speech (Google STT), sends it to an OpenAI agent, receives a text reply in the same language, converts reply to audio (Google TTS), and plays it back.  
**Initial scope:** Single view, one centered toggle button: **Start** / **Stop**.

## 2) Problem Statement

Typing is slower and less natural than speaking for many use cases. Users want a seamless “push-to-talk” conversational experience in the browser.

## 3) Target Users

- Anyone who wants voice-based chat with an AI (demo / internal tool / prototype)
- Multilingual users (language detected automatically)

## 4) Key User Experience (MVP)

### Primary user story

1. User opens the app.
2. User clicks the center button → browser asks for microphone permission (if not granted).
3. User speaks.
4. App transcribes speech to text.
5. App sends text to OpenAI agent.
6. Agent responds **in the same language**.
7. App converts response text to speech and plays audio.
8. User clicks the button again → stops/disconnects.

### Button behavior (single button, toggle)

- **Idle state:** “Tap to Talk”
- **Listening state:** “Listening… Tap to Stop”
- **Processing state (optional):** “Thinking… Tap to Stop”
- **Speaking state (optional):** “Speaking… Tap to Stop”
- If user taps **Stop** at any time: stop recording, cancel pending playback, and reset to Idle.

## 5) Functional Requirements

### FR-1 Microphone access

- Must request mic permission via browser APIs.
- Must show clear error state if permission denied.

### FR-2 Audio capture

- Must capture user speech audio from mic.
- MVP can record until user presses stop (no auto VAD required for v0).

### FR-3 Speech-to-Text (Google STT)

- Send recorded audio to backend endpoint.
- Must return:
  - `transcript` (string)
  - `detectedLanguage` (BCP-47 or Google language code)
  - `confidence` (optional)

**Language detection requirement:**

- Detect language automatically (or with a provided shortlist like `en-US`, `si-LK`, `ta-LK`).

### FR-4 OpenAI processing

- Send transcript + detectedLanguage to OpenAI.
- Must instruct the agent to respond in the same language as the user.
- Return:
  - `replyText`

### FR-5 Text-to-Speech (Google TTS)

- Convert `replyText` to audio bytes using Google TTS.
- Use a voice matching detected language when possible.
- Return:
  - audio (mp3 or wav) + mime type

### FR-6 Playback

- The client must play the returned audio automatically.
- Must allow stopping playback immediately on toggle stop.

## 6) Non-Functional Requirements

- **Security:** Never expose Google/OpenAI keys in the browser. Server routes only.
- **Privacy:** Don’t log raw audio; avoid storing transcripts by default.
- **Latency:** MVP target <5s for short utterances.
- **Cost controls:** max recording duration + reasonable transcript limits.

## 7) Proposed Architecture (MVP)

Mic → audio blob → `/api/stt` → transcript → `/api/agent` → reply text → `/api/tts` → audio → playback

## 8) Acceptance Criteria (MVP)

1. App loads with a single centered button.
2. Clicking button requests mic permission and begins recording.
3. Clicking button again stops recording and triggers STT → AI → TTS → playback.
4. User can stop at any time and the app returns to Idle.
5. No secrets are shipped to the browser.
