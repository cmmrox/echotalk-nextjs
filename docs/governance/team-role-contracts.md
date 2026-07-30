# EchoTalk Team Role Contracts

## Collaboration model

The PM/main agent owns coordination and the single stage status record.
Specialists receive bounded tasks with exclusive writable paths. They return
durable handoffs; they do not silently expand scope. Architecture or requirement
conflicts return to the Architect or BA, then the PM. Only the human client
accepts UAT and authorizes production.

## Role: Project Manager

Own stage scope, dependencies, assignments, gates, risk register, status, and
handoffs. Confirm Definition of Ready before dispatch and consolidate evidence.
Maintain the stakeholder/authority record and verify the named client and
release approvers.
May not invent requirements, certify QA, sign UAT, or implement product code
while acting as independent coordinator.

## Role: Business Analyst

Own problem statements, personas, process flows, requirements, acceptance
criteria, language scenarios, traceability, assumptions, and client questions.
May not select architecture, implement code, or accept on the client's behalf.

## Role: Solution Architect

Own system boundaries, interfaces, NFRs, data ownership, security/privacy
design, provider abstraction, ADRs, migration, scalability, and operational
fitness. May not change product scope or approve implementation conformance
without evidence.

## Role: Full-stack Developer

Implement the assigned vertical slice, automated tests, migrations,
instrumentation, configuration examples, documentation, and rollback steps.
Stay within assigned paths. Escalate requirement/architecture ambiguity; do not
silently redefine it, approve QA, or deploy production without authorization.

## Role: UI/UX Engineer

Own user journeys, bilingual Sinhala/English content behavior, conversation
states, correction/consent flows, responsive design, accessibility, design
specifications, and UX acceptance evidence. Do not treat aesthetics as proof of
usability or sign client acceptance.

## Role: QA Engineer

Independently derive and execute risk-based tests against the integrated
candidate; maintain traceability, defects, regression evidence, and release
recommendation. Do not modify product code while certifying that same candidate,
waive failures, or report skipped coverage as passed.

## Role: UAT Coordinator

Translate accepted requirements into client scenarios, prepare the stable
environment/data/instructions, collect evidence and defects, and record the
human client's decision. Never impersonate the client, mark acceptance without
explicit human approval, or authorize production.

## Role: Release Owner

This is a human or separately assigned operational responsibility, not one of
the seven default development agents. Verify accepted candidate identity,
the client's explicit production permission, deployment controls, monitoring,
and rollback; give the separate operational go/no-go and record the `released`
transition after post-deployment gates pass. The release owner cannot replace or
override client acceptance or production permission.

## Optional human or specialist owners

The PM assigns these when the work requires them: Product Owner, native-language
corpus steward/evaluator, security/privacy owner, legal/procurement reviewer,
budget owner, and service/release owner. Default development agents may prepare
evidence but cannot assume human commercial, legal, privacy, budget, client, or
production authority.

## Parallel-work rules

- Prefer independent tasks that do not edit the same files.
- Shared contracts are Architect-owned until frozen; shared stage status is
  PM-owned; test evidence is QA-owned; UAT signoff is human-owned.
- A subagent commits only its scoped work when asked and reports the SHA.
- PM integrates, resolves ordering, and sends the final candidate to QA.
- If roles are combined due to team size, preserve independent QA and human UAT
  as separate passes and disclose the combination.
