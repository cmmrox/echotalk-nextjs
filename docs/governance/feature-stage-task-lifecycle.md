# Feature, Stage, and Task Lifecycle

EchoTalk uses one delivery hierarchy:

```text
Feature (durable capability)
  -> Stage (one production-releasable increment)
      -> Task (one owner, one bounded output)
```

Do not introduce a second iteration hierarchy. Historical checkpoint
labels are not current stages.

## States

| Artifact | States |
|---|---|
| Feature | `draft`, `approved`, `superseded`, `retired` |
| Task | `draft`, `ready`, `in-progress`, `in-review`, `done`, `blocked`, `deferred`, `superseded` |
| Stage | `proposed`, `ready`, `in-progress`, `candidate-frozen`, `qa-passed`, `uat-ready`, `accepted`, `release-authorized`, `released` |

Never use `completed` or composite values such as “implemented, QA pending” for
a stage.

## Definition of Ready

A feature is approved by a named human product owner. A stage is ready only
when its approved feature/acceptance subset, dependencies, task DAG, path
ownership, security/privacy impact, observability, deployment, rollback, final
QA task, UAT scenarios, and authorities are defined.

A task is ready only when it has one owner role, independent reviewer,
base commit, dependencies, scope, exclusions, writable/prohibited paths,
requirement and acceptance references, development work, tests, security and
privacy impact, rollout/rollback, and next handoff.

Before approval, the feature document itself is the durable BA/PM intake
artifact; it does not need a release stage or implementation task. Use the
feature template, resolve client questions, and record the human approval before
scaffolding ready work.

## Execution and gates

Tasks may run in parallel only in isolated branches/worktrees with disjoint
writable paths. Serialize shared contracts, package/lockfiles, migrations,
status records, integration, QA execution, UAT, and release.

Every stage has exactly one final `T90` task of type `stage-qa`. It depends
transitively on all other stage tasks, freezes the exact candidate, creates or
updates independent automation, executes the applicable matrix, and records an
independent verdict. QA opens defects rather than editing product code while
certifying the candidate.

QA may advance only to `qa-passed`. The UAT coordinator prepares evidence but
only the named human client may set `accepted` and grant production permission.
The release owner separately sets the operational go/no-go. `released` is
recorded only after deployment and post-deployment verification.
