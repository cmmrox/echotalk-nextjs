# EchoTalk Security and Privacy

## Data classes

- Restricted: raw audio, transcripts tied to a person, credentials, auth tokens.
- Confidential: conversation metadata, prompts/responses, user settings, audit.
- Internal: aggregate quality/cost metrics without personal content.
- Public: approved documentation and non-sensitive product assets.

Default audio and transcript handling is transient. Durable retention needs a
documented purpose, explicit consent where required, expiry, access policy,
deletion path, and audit trail.

Before sending restricted data to a new provider, record contract/DPA owner,
processing purpose, regions/residency, subprocessors, training use, default and
configured retention, deletion evidence, incident terms, access controls,
credential scope, quotas, exit/export plan, and human legal/procurement review.
Shadow traffic is still data disclosure and follows the same gate.

## Required controls

- Authenticate users and authorize every session/resource server-side.
- Use TLS in transit and managed encryption at rest.
- Keep secrets in environment-specific secret management; rotate and scope them.
- Restrict provider credentials to necessary APIs, projects, and quotas.
- Apply per-user/session/IP rate and spend limits with abuse monitoring.
- Validate media type, size, duration, codecs, and payload schemas.
- Isolate untrusted content from tools and system instructions.
- Redact sensitive content from logs, traces, analytics, and error reporting.
- Define retention jobs and prove deletion, including derived artifacts.
- Keep administrative actions in an immutable, access-controlled audit record.

## Voice and model threats

Treat transcripts and retrieved content as untrusted input. They cannot change
system policy, authorize tools, reveal secrets, or approve transactions. Apply
tool allowlists, argument validation, least privilege, confirmation for
consequential actions, and output filtering.

Defend against replay, session fixation, cross-session audio leakage, IDOR,
oversized streams, resource exhaustion, prompt injection, unsafe generated
speech, provider outage, and billing abuse.

## Consent

Explain recording/processing purpose in Sinhala and English before optional
quality sampling. Consent must be specific, revocable, versioned, and separate
from essential processing. Declining optional retention must not block the core
service.

## Security gate

For each stage, record changed assets, trust boundaries, threats, mitigations,
tests, residual risk, and owner. Perform a deeper threat model before exposing
public media endpoints, storing conversations, enabling tools/actions, or
processing production traffic.

Never claim legal compliance from this file. Confirm applicable Sri Lankan and
customer-jurisdiction obligations with qualified counsel before launch.
