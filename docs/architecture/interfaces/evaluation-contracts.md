# Evaluation Contract Boundaries

S02 owns provider-neutral metadata and aggregate contracts:

- `CorpusManifestMetadata`: versions, immutable split, approved slices, policy
  references, artifact digest, expiry, deletion state. Real manifests stay
  outside Git.
- `EvaluationRunSpec`: source/corpus/evaluator/provider/config/catalog versions.
- `EvaluationObservation`: ephemeral sample-level judgments; never gate evidence.
- `SliceAggregate`: counts, denominators, latency, usage, and micro-USD cost.
- `AggregateScorecard`: content-free ordered aggregates, limitations, failures,
  skips, and report digest.
- `ShadowDecision`: enabled/approval/consent/sample/cap decision and bounded
  reason without content.

Schema validation rejects unknown fields at Git-safe boundaries. Artifact
access/deletion is an external interface requiring human-approved storage; the
synthetic runner does not implement real storage.
