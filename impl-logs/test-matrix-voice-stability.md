# EchoTalk Voice Stability Test Matrix

## Goal

Validate turn detection, interruption handling, and playback reliability using repeatable manual tests.

---

## 1. Short phrase capture

Test phrases:
- yes
- no
- okay
- hi
- hello
- stop
- wait
- continue
- sure

Expected:
- phrase captured as a full user turn
- assistant responds once
- no missing transcript
- no duplicate reply playback

Record:
- captured? (Y/N)
- transcript correct? (Y/N)
- reply played? (Y/N)
- playback mode (`rtc`/`http`)
- notes

---

## 2. Long phrase / natural pause handling

Test utterances:
- 10–20 second explanation with one short pause
- list of 4–5 items with brief pauses
- sentence with hesitation: “I need you to… um… explain…”
- mixed English + Sinhala/Tamil phrase if applicable

Expected:
- no premature cutoff during natural pause
- one coherent user turn where appropriate
- assistant reply matches full request context

Record:
- cut off early? (Y/N)
- split into multiple turns? (Y/N)
- transcript complete? (Y/N)
- notes

---

## 3. Interruption / barge-in

Scenarios:
- interrupt assistant early with “wait”
- interrupt assistant mid-reply with a new question
- accidental tiny noise during assistant speech
- cough / click while assistant is speaking

Expected:
- real interruption stops or recovers cleanly
- false interruption does not break playback permanently
- no assistant self-transcription loop

Record:
- candidate created? (Y/N)
- committed? (Y/N)
- playback stopped? (Y/N)
- recovered correctly? (Y/N)
- notes

---

## 4. Playback reliability

Scenarios:
- WebRTC reply playback in normal conditions
- forced/observed HTTP fallback playback
- repeated back-to-back turns
- fast consecutive short turns

Expected:
- no duplicated playback
- no stale playback from previous turn
- correct turn number delivered
- listening resumes after playback

Record:
- playback mode
- duplicated? (Y/N)
- missing? (Y/N)
- listening restored? (Y/N)
- notes

---

## 5. Metrics/events to inspect

For each failed or suspicious run, inspect:
- `turn_finalized`
- `turn_endpoint_deferred`
- `turn_metrics_updated`
- `processing_stt_*`
- `processing_agent_*`
- `processing_tts_*`
- `outbound_delivery_*`
- `interruption_*`

Important fields:
- `finalizeReason`
- `endpointReason`
- `playbackMode`
- duration metrics:
  - `detectToFinalizeMs`
  - `sttMs`
  - `agentMs`
  - `ttsMs`
  - `endToPlaybackMs`

---

## Suggested pass criteria

### Short phrases
- >= 95% captured in clean conditions

### Long phrases
- no premature cutoff in normal speech with brief pauses

### Interruption
- true interruption works consistently
- false interruption does not permanently break playback/listening state

### Playback
- no duplicate playback for a single turn
- fallback does not mark stale turn delivery
