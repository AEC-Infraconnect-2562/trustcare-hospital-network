# Scalable Fabric Demo Smoke Tests

**Scope:** PR-16 end-to-end demo scenario for the stacked Scalable Integration Fabric PR series.

The demo validates a synthetic, contract-scoped service-readiness path:

1. Import a HIS DB-view source payload.
2. Map it to canonical FHIR and DQI metadata.
3. Convert legacy file metadata into a FHIR DocumentReference package.
4. Route a PatientSummary VC request through Maker/Checker readiness.
5. Build an SHL packet with manifest/file metadata.
6. Simulate verifier intake checks.
7. Execute sync-back and reconciliation metadata.
8. Build a PHI-safe troubleshooting index by `correlationId`.

The scenario is intentionally local and metadata-only. It does not store binaries in DB, issue signed credentials, call an external queue, or return raw SHL keys, passcodes, QR payloads, JWTs, plaintext clinical payloads, or real patient identifiers.

## Manus Workspace Checklist

Run these after applying the stacked PRs through PR-16 in order:

```bash
corepack pnpm@10.4.1 check
corepack pnpm@10.4.1 test -- scalableFabricDemoScenario
corepack pnpm@10.4.1 test
corepack pnpm@10.4.1 build
```

If the workspace has a configured database, also run the normal seed/reseed flow required by the earlier PRs before manual UI smoke tests. PR-16 itself does not add a migration or seed requirement.

## Expected Demo Assertions

- The demo returns `scenarioId=scalable-fabric-demo-opd-readiness-v1`.
- Every trace event has `correlationId=corr-scalable-fabric-demo-001`.
- Import, mapping, DocumentReference, VC routing, SHL packet, verifier intake, sync-back, and reconciliation stages complete with ready/verified/passed status.
- The troubleshooting index includes fabric stages from job creation through adapter health.
- The serialized demo result does not include raw synthetic patient name, raw synthetic HN/VN, `shlink:/`, raw SHL key/passcode strings, or JWT material.

## Manual UI Smoke

After PR-16 is merged and deployed with the preceding stack:

- `/integration`: confirm integration engineers can inspect adapter health, job backlog, correlation IDs, job timeline, retry/dead-letter hints, and contract context.
- `/prepare-service`: confirm hospital service-readiness context remains contract-scoped and patient-facing language stays simple.
- `/wallet`: confirm patient wallet remains focused on portable documents and SHL packages, without exposing integration job internals.
- `/shl`: confirm SHL packages expose manifest/document metadata without raw key/passcode/plaintext.
- `/verifier`: confirm verifier/intake validates packet metadata and trust checks without requiring synchronous large-packet generation.

Do not paste real PHI, real Thai IDs, raw SHL keys, passcodes, plaintext clinical payloads, production object credentials, or JWTs into PR comments, screenshots, logs, or test fixtures.
