# EchoTalk Vision

EchoTalk lets a person hold a natural, low-latency voice conversation with an
AI in Sinhala, English, or ordinary Sinhala-English code-switching. Every turn
remains available as text, and uncertainty is handled visibly instead of being
hidden behind fluent but incorrect output.

## Production outcome

The production service must:

- preserve the speaker's meaning, language, names, numbers, and critical terms;
- provide synchronized, accessible transcript and spoken response;
- support correction, clarification, interruption, recovery, and text fallback;
- measure quality, latency, reliability, privacy, and cost by language slice;
- keep providers replaceable behind project-owned interfaces; and
- release only through independent QA, human client UAT, and operational approval.

“Full accuracy” is not a defensible release promise. EchoTalk instead publishes
measured thresholds per approved evaluation-set version and falls back or asks
for confirmation when uncertainty is material.
