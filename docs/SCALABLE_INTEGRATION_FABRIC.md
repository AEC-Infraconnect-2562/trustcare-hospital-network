# TrustCare Scalable Integration Fabric

**Status:** Architecture target for stacked implementation PRs  
**Last updated:** 2026-07-04  
**Scope:** Contract-first integrations, async jobs, worker execution, hospital edge connector, SHL hot path, sync-back, reconciliation, and observability.

## 1. North Star

TrustCare is a Wallet-first interoperability bridge for portable, verifiable, secure, patient-controlled health documents. It is not a health super app, central health data lake, HIS/EMR replacement, or app aggregator.

The Integration Fabric exists to reduce service friction:

1. A real service readiness contract defines what the hospital or patient needs.
2. Source systems and legacy documents are imported under that contract.
3. Payloads are canonicalized into FHIR R4 and DocumentReference artifacts.
4. Data quality and consent policy decide whether review is needed.
5. Maker/Checker or trusted issuance creates VC/VP artifacts.
6. The Patient Wallet receives portable documents.
7. A direct VP or SHL packet is presented to a verifier.
8. Sync-back and reconciliation update the hospital system of record where appropriate.

## 2. Design Principles

- **Contract-first:** every integration is scoped by readiness context, contract version, consent policy, mapping profile, and expected output artifacts.
- **Stateless API:** API calls enqueue work and return `jobId` quickly; long-running work runs in the worker plane.
- **DB-backed local fallback:** initial PRs use a DB-backed queue so Manus Workspace can run without external queue infrastructure.
- **Swappable queue abstraction:** Redis Streams, RabbitMQ, Kafka, or cloud queues can replace the DB-backed runner later.
- **Tenant-aware isolation:** all jobs carry hospital/tenant, context, contract version, correlation ID, and idempotency key.
- **SHL as transport:** SHL carries manifest/files/access policy; VC/VP proves issuer, holder consent, manifest integrity, and auditability.
- **No PHI in logs:** events contain identifiers, status, hashes, and redacted summaries only.

## 3. Planes

### 3.1 Control Plane

The control plane owns service readiness contracts, mapping profiles, consent policies, trusted sources, adapter capabilities, and rollout state.

Current foundations:

- `server/prepareService.ts`
- `service_readiness_contracts`
- `bundle_templates`
- `integration_adapters`
- `mapping_versions`
- `trust_registry`

Target additions:

- version-aware contract resolver
- tenant/hospital override policy
- mapping profile resolver
- adapter capability policy
- rollout and deprecation state for contracts

### 3.2 API Plane

The API plane accepts user or system requests, validates role/effective-role access, records audit events, and enqueues jobs. It should not run heavy imports, canonicalization, SHL packet generation, or sync-back in the request path.

Target API behavior:

- `202`-style response semantics through tRPC/HTTP wrappers
- `jobId`, `correlationId`, and current status in responses
- patient users can view only their relevant jobs
- hospital staff can view hospital-scoped jobs
- integration engineers and system admins can inspect adapter/system jobs

### 3.3 Worker Plane

The worker plane claims jobs, runs handlers, records attempts/events/artifacts, retries safely, and routes failures to review or dead letter state.

Initial worker families:

- import source payload
- canonical mapping and DQI
- DocumentReference creation
- Maker/Checker routing and VC issuance
- VP builder and SHL packet builder
- sync-back and reconciliation
- adapter health and backpressure

### 3.4 Data Plane

The data plane stores job state, artifacts, SHL state, wallet credentials, FHIR/DocumentReference metadata, object references, audit events, and reconciliation state.

Target rules:

- do not store large binary payloads in job tables
- store object references, hashes, MIME type, size, provenance, and retention metadata
- use idempotency keys for retry-safe writes
- preserve patient/hospital/contract context for every artifact

### 3.5 Hospital Edge Connector Plane

The edge connector plane represents hospital-side adapter runtimes. The first implementation is a simulator/contract, not an on-prem deployment.

Target responsibilities:

- adapter capability profile
- max concurrency and throttle policy
- circuit breaker state
- health checks
- local buffer metadata
- outbound-only future connector pattern
- source-system rate limiting and backpressure

## 4. Job Model Target

Every job should carry:

- `jobId`
- `type`
- `status`
- `tenantId` or network tenant placeholder
- `hospitalId`
- `patientId` when relevant
- `context`
- `contractId`
- `contractVersion`
- `correlationId`
- `idempotencyKey`
- `priority`
- `attemptCount`
- `maxAttempts`
- `nextRunAt`
- `lockedBy`
- `lockedUntil`
- redacted `input`
- redacted `result`

Related tables should record attempts, events, artifacts, and dead-letter metadata. The DB-backed queue must be deterministic and safe for multiple workers to poll.

## 5. Contract-Scoped Pipeline

```text
request
  -> resolve contract + mapping profile
  -> enqueue import job
  -> normalize source payload
  -> canonicalize to FHIR / DocumentReference candidate
  -> evaluate DQI + consent/trusted source policy
  -> route to Maker/Checker or trusted issuance
  -> issue VC or build VP/SHL packet
  -> present from Patient Wallet
  -> verify at service point
  -> sync back to HIS/legacy target
  -> reconcile and issue sync receipt where appropriate
```

## 6. SHL Hot Path

SHL manifest and access state must be safe for load-balanced API pods:

- passcode failure count is shared and atomic
- access count is shared and atomic
- max access and expiry are enforced from shared state
- raw SHL key, passcode, and plaintext payload are never logged
- large encrypted files use object references or short-lived URLs
- manifest output remains SMART Health Links compatible
- TrustCare-specific VC/VP metadata stays in extensions or verifier APIs

## 7. Sync-Back and Reconciliation

Sync-back should run through jobs rather than blocking API requests. Supported target kinds are:

- FHIR REST
- HL7v2
- DB view/outbox
- CSV batch
- manual queue

Every sync-back write needs idempotency and reconciliation state. Failed or uncertain writes should create reconciliation jobs instead of silently passing.

## 8. Observability

Every fabric flow should be traceable by `correlationId` and `jobId`.

Events should include:

- job type/status
- hospital/context/contract identifiers
- adapter ID and mapping version where relevant
- SHL ID and manifest version where relevant
- credential/presentation/sync/reconciliation IDs where relevant
- redacted error code and safe message

Events must not include PHI, raw SHL keys, passcodes, plaintext clinical payloads, JWT payloads, or production secrets.

## 9. Stacked Implementation Sequence

This architecture is implemented as stacked draft PRs:

1. Agent collaboration rules
2. Architecture documentation
3. Job model schema and DB-backed queue
4. Worker runtime skeleton
5. Job API and monitor foundation
6. Contract resolver and mapping profile foundation
7. Import jobs
8. Canonical mapping and DQI worker
9. DocumentReference pipeline
10. VC issuance jobs
11. VP/SHL packet jobs
12. SHL shared-state hardening
13. Sync-back and reconciliation worker
14. Edge connector simulator and backpressure
15. Integration engineer workbench UX
16. Observability and troubleshooting
17. End-to-end demo smoke tests

Each PR must remain independently reviewable by Manus and must document migration, role/menu, SHL/VC/VP, tests, and manual verification impact.

## 10. PR-02 Job Model Foundation

PR-02 establishes the durable queue schema without introducing an external queue dependency. The DB-backed model is the local/dev fallback for Manus Workspace and the contract boundary for later worker/runtime PRs.

Migration `0020_nasty_mongoose` adds the first job foundation tables on top of the latest SHL manifest document bundle schema.

The foundation is composed of:

- `integration_jobs` for tenant/hospital/context/contract-scoped queue state
- `integration_job_attempts` for worker retry/audit attempts
- `integration_job_events` for PHI-safe timeline events
- `integration_job_artifacts` for object, FHIR, VC, VP, SHL, and sync references
- `integration_dead_letter_jobs` for exhausted retries and operator review

Only safe control metadata belongs in job rows. Large files, source payloads, clinical documents, and derived artifacts should be stored behind object references or artifact rows, then connected to Patient Wallet, VC/VP, SHL, or sync-back flows by later jobs.

## 11. PR-03 Worker Runtime Skeleton

PR-03 adds an in-process worker abstraction that can execute the DB-backed jobs from PR-02 without requiring external queue infrastructure. The skeleton includes:

- handler registry keyed by `jobType`
- bounded retry policy and dead-letter decision path
- `correlationId` propagation through handler context and events
- PHI-safe event/result redaction
- one-shot DB-backed dev runner for Manus Workspace validation

This PR does not introduce a daemon, API endpoint, UI monitor, Kubernetes/KEDA deployment, or production queue dependency. Production deployment can wrap the same handler registry later while preserving the DB-backed local/dev fallback.

## 12. PR-04 Job API and Monitor Foundation

PR-04 exposes the job foundation through the existing integration router and integration engineer/admin workspace:

- API enqueue returns `jobId` quickly and does not run heavy processing inline
- list/detail endpoints apply patient, hospital staff, integration engineer, and system admin visibility rules
- monitor responses hide raw payload/result bodies and show only safe status/hash/reference metadata
- the `/integration` page includes a lightweight Jobs tab and synthetic no-op enqueue smoke action

This is not the final troubleshooting workbench. Retry/dead-letter operations, adapter backpressure, richer timelines, and non-engineer language are handled by later stacked PRs.

## 13. PR-05 Contract Resolver Foundation

PR-05 adds a reusable contract resolver around the existing Prepare for Service Contract Hub simulation. The resolver is the common entry point for later import, mapping, DQI, VC issuance, VP/SHL packet, and sync-back workers.

Resolver output includes:

- selected service readiness contract and version
- tenant/hospital scope
- mapping profile
- consent policy
- recommended transport policy
- output artifacts such as FHIR resources, DocumentReference, credential types, VP package, SHL packet, and OperationOutcome
- explicit fallback warnings when a requested contract/version is unavailable

This keeps integrations contract-scoped to service readiness use cases rather than generic source-system ingestion.

## 14. PR-06 Import Source Payload Handler

PR-06 registers the first worker handler, `import.source_payload`. It converts supported source envelopes into safe intermediate import results:

- HIS DB-view rows
- HL7v2 messages
- CSV text with review summaries
- FHIR-native resources/bundles
- legacy document metadata with hash/content type
- future SHL and native VC/VP sources routed to review

The handler resolves the contract first, emits PHI-safe events, and does not issue VC or build canonical FHIR output. Canonical mapping and DQI remain PR-07 responsibilities.

## 15. PR-07 Canonical Mapping and DQI Worker

PR-07 registers the `mapping.canonicalize_fhir` worker handler. It consumes the import output from PR-06 and emits:

- canonical FHIR bundle summaries for DB-view, CSV, HL7v2, and FHIR-native source envelopes
- DocumentReference candidates for legacy document metadata
- DQI score and issue list
- OperationOutcome-like metadata
- `ready` or `needs_review` routing

The worker does not issue VC or create VP/SHL packets. Errors and low DQI route to review so downstream Maker/Checker and credential issuance cannot silently bypass quality gates.

## 16. PR-08 DocumentReference and Legacy File Pipeline

PR-08 registers the `document.create_reference` worker handler for legacy PDF, scan, image, and file metadata. It converts metadata-only inputs or PR-07 DocumentReference candidates into:

- FHIR `DocumentReference`
- FHIR `Provenance`
- object reference metadata
- `document_reference`, `object_reference`, and `operation_outcome` artifact descriptors
- review state for later Maker/Checker routing

The handler rejects inline binary content in job payloads. Files stay in object storage, external references, or mock references for local/dev tests; job rows and events carry hashes, references, and safe metadata only.

PR-08 does not issue VC, create wallet cards, or build VP/SHL packets. Later PRs decide whether a DocumentReference is ready for Maker/Checker or trusted-source issuance.

## 17. PR-09 VC Issuance Routing Job

PR-09 registers the `vc.issue` worker handler as a Maker/Checker routing layer, not as a direct signer. It evaluates:

- requested or inferred existing credential type
- canonical FHIR or DocumentReference readiness
- DQI threshold
- trusted source policy
- actor Maker/Checker role and entitlement eligibility

Trusted, high-DQI inputs from an eligible Maker actor become a submitted request draft for Checker review. Low-DQI or untrusted inputs become Maker review drafts. Patient actors, unsupported credential types, or source artifacts that are not ready are blocked and returned as `needs_review`.

The handler does not call the VC signing helper, create an issued credential, create wallet cards, change credential enums, or bypass Maker/Checker. It returns safe audit-event descriptors and request draft metadata for later persistence.

## 18. PR-10 VP Builder and SHL Packet Job

PR-10 registers the `vp.build` and `shl.build_packet` worker handlers. `docs/SHL_CONTEXT_VERSIONING.md` was reviewed for this PR because the handler creates VP/SHL trust-layer metadata.

The builder reuses `classifyPacketTransport` so small simple payloads become direct VP metadata, while large FHIR bundles, legacy DocumentReference bundles, many credentials, or cross-organization contexts become SHL packet metadata. `shl.build_packet` can force SHL output.

SHL packet output includes:

- standards-compatible manifest shape
- encrypted file descriptors with hashes and mock object references
- FHIR bundle and DocumentReference bundle hashes
- `ShlManifestCredential` metadata
- holder VP metadata
- next action for persistence and Checker review

The worker does not return raw SHL keys, QR payloads, passcodes, plaintext clinical payloads, or signed VP/VC JWTs in events. API callers should enqueue these jobs and return `jobId` instead of building large packets synchronously.

## 19. PR-11 SHL Shared-State Hardening

PR-11 hardens the SHL manifest access path for horizontally scaled API pods. `docs/SHL_CONTEXT_VERSIONING.md` was reviewed because the change touches SHL passcode/access state and manifest trust metadata.

The resolver now uses persisted shared state for:

- atomic access grant reservation against `currentAccessCount` and `maxAccessCount`
- passcode failure counting against `passcodeFailedAttempts` and `passcodeMaxAttempts`
- lockout through shared `status` and `disabledReason`
- successful-passcode failure reset

TrustCare-specific manifest metadata exposes shared-state, rate-limit hook, and short-lived object URL policy hints under the `trustcare` extension while keeping the generic SHL manifest standards-compatible.

This PR does not introduce a new migration. It reuses existing `smart_health_links` columns and does not implement a production object URL signer or per-IP rate-limit store yet.

## 20. PR-12 Sync-back and Reconciliation Worker

PR-12 registers worker handlers around the existing `server/portability/syncBack.ts` plan/execution model:

- `sync_back.plan`
- `sync_back.execute`
- `reconciliation.run`

Supported targets are `fhir_rest`, `hl7v2`, `db_view`/outbox, `csv_batch`, and `manual_queue`. The worker preserves idempotency and consistency keys, prepares SyncReceipt-compatible metadata, and persists reconciliation jobs when a DB connection is available. Local/dev tests can disable persistence while still returning reconciliation metadata for Manus verification.

This PR does not add a new migration. It reuses the existing `sync_reconciliation_jobs` table and does not directly issue signed SyncReceipt VCs or bypass Maker/Checker.

## 21. PR-13 Hospital Edge Connector Simulator and Adapter Backpressure

PR-13 adds an executable simulator contract for hospital edge connector runtime behavior. The simulator uses existing `integration_adapters` rows and safe `connectionConfig.runtime` metadata rather than introducing a new deployment dependency.

The contract reports:

- adapter capability by connector pattern
- max concurrency and throttle metadata
- adapter-scoped backpressure
- circuit breaker state
- health-check result
- simulated local-buffer depth and limit
- hospital/adapter capacity scope

`adapter.health_check` jobs and the existing adapter test-connection API share the same evaluator, so integration engineers see the same health/backpressure contract that workers use. A saturated adapter pauses only its own work; it does not globally stop all hospital or tenant jobs.

This PR does not add a migration, does not store large payloads or local buffer contents, and does not deploy a real on-prem connector.

## 22. PR-14 Integration Engineer Job and Adapter Workbench UX

PR-14 turns the existing `/integration` page into the first operator-facing workbench for the fabric stack. It stays scoped to integration engineers/admins and does not add patient-facing technical details.

The workbench now surfaces:

- adapter readiness and blocked/watch summary
- selected adapter health, mapping version, backpressure, circuit breaker, and local-buffer metadata
- health log and mapping-version inspection
- job backlog and jobs needing review
- correlation ID, job ID, adapter ID, contract context, and attempt count
- retry/dead-letter next-action language
- safe event timeline and artifact references

Raw job payloads, job results, adapter connection targets, credentials, tokens, SHL keys, passcodes, and plaintext clinical payloads stay hidden from the UI. This PR does not add a migration or role/menu changes.

## 23. PR-15 Observability, Correlation IDs, and Troubleshooting Playbook

PR-15 adds fabric observability helpers and a troubleshooting playbook without adding external logging infrastructure.

The helper module provides:

- fabric trace stages across job creation, import, mapping, DocumentReference, VC issuance, VP/SHL packet, SHL access, sync-back, reconciliation, and adapter health
- `buildFabricTraceContext()` for PHI-safe trace metadata keyed by `correlationId`
- `buildFabricTroubleshootingIndex()` for grouping events, inferring stages, counting levels, identifying latest status, and emitting root-cause hints
- `findSensitiveMetadata()` to catch unredacted sensitive metadata keys before logs/events become unsafe

The playbook is in [`docs/SCALABLE_FABRIC_TROUBLESHOOTING_PLAYBOOK.md`](./SCALABLE_FABRIC_TROUBLESHOOTING_PLAYBOOK.md). It tells Codex/Manus to start with `correlationId`, then narrow by `jobId`, `adapterId`, contract context, SHL/VC/VP identifiers, sync IDs, and reconciliation IDs.

This PR does not add a migration, logging vendor, OpenTelemetry collector, or production dashboard.

## 24. Non-Goals

- Replacing hospital HIS/EMR/LIS/RIS/PACS systems
- Creating a central clinical data lake
- Building a generic app marketplace
- Storing production PHI in logs, screenshots, fixtures, or PR comments
- Requiring Kubernetes, KEDA, Redis, RabbitMQ, or Kafka for Manus Workspace validation in the initial PRs
