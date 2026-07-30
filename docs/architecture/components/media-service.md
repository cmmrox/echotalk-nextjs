# Media Service Component

## Current responsibility

`media-service/` manages the in-process WebRTC peer, inbound audio, speech
signals, endpointing, turn queue, STT-model-TTS pipeline, outbound delivery,
interruption state, and timing telemetry.

## Current flow

```text
Inbound RTP
  -> segmentation buffer
  -> turn detector and endpointing
  -> processing queue
  -> STT
  -> conversation model
  -> TTS
  -> RTP playback or controlled HTTP fallback
```

The server-owned conversation state and turn IDs are authoritative for one
process. Client VAD events are hints, not independent turn ownership.

## Extraction boundary

The target architecture may extract this component into a separately scalable
media gateway and turn orchestrator. Before extraction, define provider
contracts, durable/ephemeral state ownership, cancellation, idempotency,
backpressure, authentication, metrics, and rollback through approved ADRs.

## Current limitations

The implementation is a prototype baseline: state is memory-resident, WebRTC
NAT/TURN deployment is not production-proven, provider failure policies are
limited, and voice stability remains manually observed rather than supported by
complete repeatable QA.
