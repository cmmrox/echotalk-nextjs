# EchoTalk

EchoTalk is a prototype Sinhala-English voice conversation application with
visible text parity and an in-process WebRTC media pipeline. The current
implementation uses Google Speech-to-Text, an OpenAI text model, and Google
Text-to-Speech; these are implementation adapters, not permanent product
requirements.

This checkout is not yet production-ready. Current gaps and the controlled
roadmap are documented in:

- [Project knowledge](docs/index.md)
- [Current system and limitations](docs/architecture/current-system.md)
- [Production roadmap](docs/product/roadmap.md)
- [Live delivery state](delivery/roadmap.md)
- [QA automation](qa-automation/README.md)

## Local setup

Prerequisites:

- Node.js 20 or newer
- npm
- Google Cloud credentials with Speech-to-Text and Text-to-Speech access
- OpenAI API credentials

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Put only local secret
values and machine-specific credential paths in `.env.local`; it is ignored.

## Configuration

`.env.example` is the authoritative variable inventory. The minimum current
provider configuration is:

- `ECHOTALK_GOOGLE_APPLICATION_CREDENTIALS` or
  `GOOGLE_APPLICATION_CREDENTIALS`
- `OPENAI_API_KEY`

Optional settings choose the current language shortlist, provider models,
Speech-to-Text location, recording limit, and FFmpeg path.

## Current interfaces

- Legacy HTTP flow: `POST /api/stt`, `POST /api/agent`, `POST /api/tts`
- Live session/signalling: `/api/media-service/*`
- Browser and UI: `app/`, `components/echo/`, `lib/webrtc/`
- Media and turn orchestration: `media-service/`

See the [current architecture](docs/architecture/current-system.md) and
[media-service component](docs/architecture/components/media-service.md) rather
than relying on this quickstart for system design.

## Development harness

Every change follows an approved Feature → Stage → Task path. A stage is the
release increment and ends with independent T90 QA. Human client UAT,
production permission, and release-owner approval remain separate.

```bash
npm run governance:validate
npm run test:governance
npm run lint
npm run typecheck
npm run build
```

Read [AGENTS.md](AGENTS.md) when working with Codex or Claude Code.
