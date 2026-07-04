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

## 13. Non-Goals

- Replacing hospital HIS/EMR/LIS/RIS/PACS systems
- Creating a central clinical data lake
- Building a generic app marketplace
- Storing production PHI in logs, screenshots, fixtures, or PR comments
- Requiring Kubernetes, KEDA, Redis, RabbitMQ, or Kafka for Manus Workspace validation in the initial PRs
