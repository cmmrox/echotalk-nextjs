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
- `PriceCatalog`: immutable catalog/version, provider/model/region, billing
  unit, integer micro-USD price, effective/retrieved dates, authoritative source
  reference, and estimate/invoice classification. Missing or ambiguous prices
  fail the run.
- `EvaluationArtifactStore`: authorized ephemeral resolution, expiry checks,
  source/derived deletion, and a content-free deletion receipt containing only
  policy/version, counts, completion time, and receipt digest.
- `ShadowDecision`: enabled/approval/consent/sample/cap decision and bounded
  reason without content.

Schema validation rejects unknown fields at Git-safe boundaries. Artifact
access/deletion is an external interface requiring human-approved storage; the
synthetic runner does not implement real storage. Independent QA reproduces
metric mechanics with synthetic fixtures outside the enclave. For a real
baseline, it executes the approved runner inside the sealed enclave through
ephemeral read-only access and verifies the signed aggregate computation
receipt; restricted observations never leave the enclave or enter Git.
