# Current System

This document describes the repository at the F000 harness baseline. It is
descriptive, not an endorsement of production readiness.

## Runtime topology

```text
Browser / Next.js UI
  |-- legacy HTTP: /api/stt -> /api/agent -> /api/tts
  `-- live WebRTC signalling: /api/media-service/*
          |
          v
     in-process media service
       capture / VAD / endpointing / queue / turn state
          |
          +-- Google Speech-to-Text
          +-- OpenAI conversation model
          `-- Google Text-to-Speech
```

Next.js route handlers, the WebRTC peer, session state, provider orchestration,
and media processing currently run in the same application process. Session and
conversation state are memory-resident. There is no production persistence,
distributed coordination, identity boundary, durable audit store, or deployed
observability stack in this repository.

## Main code boundaries

| Boundary | Current location |
|---|---|
| Browser UI and client session | `app/`, `components/echo/`, `lib/webrtc/` |
| HTTP and signalling routes | `app/api/` |
| Provider access | `lib/services/`, `lib/openai.ts`, `lib/googleAuth.ts` |
| Media/turn orchestration | `media-service/` |
| VAD browser assets | `public/vad/` |

## Known production gaps

- Provider-specific behavior is not fully isolated behind stable project
  interfaces.
- Current session state cannot survive process loss or scale across workers.
- Authentication, authorization, consent, durable privacy controls, spend
  controls, and deletion workflows are not implemented as production controls.
- Quality claims are not backed by a versioned Sinhala-English evaluation set.
- Automated unit, integration, browser, bilingual-evaluation, resilience, and
  release test suites are incomplete.
- The 2026-07-30 audit of the locked production dependency tree reported 26
  unresolved findings, including one critical and sixteen high; remediation
  requires a separately scoped upgrade and full regression stage.
- Production environment, CI release gates, monitoring, backup, and rollback
  evidence remain delivery work.

Historical checkpoint claims are preserved in `docs/archive/legacy/` and do not
close these gaps.
