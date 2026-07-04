# Scalable Fabric Troubleshooting Playbook

**Scope:** PR-15 observability, correlation IDs, and PHI-safe troubleshooting for TrustCare integration jobs.

TrustCare integrations must be traceable without turning logs into a clinical data store. Use `correlationId` first, then narrow by `jobId`, `adapterId`, contract context, and artifact hashes.

## Trace Fields

| Field | Use |
|-------|-----|
| `correlationId` | Primary trace key across API enqueue, worker events, SHL/VC/VP metadata, sync-back, and reconciliation |
| `jobId` | Durable queue record and worker timeline |
| `adapterId` | Adapter-scoped health, backpressure, circuit breaker, and mapping version |
| `contractId` / `contractVersion` | Service readiness contract and mapping profile boundary |
| `manifestToken` / `credentialId` / `presentationId` | SHL/VC/VP trust artifact lookup keys |
| `syncId` / `reconciliationId` | Sync-back consistency and reconciliation lookup keys |

## Root Cause Workflow

1. Start from the failing `correlationId`.
2. Open `/integration` and find the job timeline by `jobId` or `correlationId`.
3. Check latest event status and level.
4. If the event is `handler_missing`, register the worker handler before retrying.
5. If adapter health is degraded/down, inspect adapter health, backpressure, circuit breaker, local buffer, and mapping version.
6. If import or mapping needs review, inspect source type, contract context, DQI summary, and OperationOutcome metadata.
7. If VC issuance needs review, inspect DQI threshold, trusted source policy, and Maker/Checker route.
8. If VP/SHL packet build fails, inspect manifest/file hashes, DocumentReference bundle references, and `docs/SHL_CONTEXT_VERSIONING.md` expectations.
9. If sync-back or reconciliation fails, compare idempotency key, source event ID, target kind, and reconciliation checks.
10. Create a new idempotent job only after the source input or adapter condition has been corrected.

## PHI-Safe Logging Rules

Events and logs may include IDs, statuses, hashes, metadata keys, issue codes, and operator-safe messages.

Events and logs must not include:

- patient names, phone numbers, addresses, Thai IDs, passport numbers, HNs, or raw clinical payloads
- adapter secrets, credentials, access tokens, private keys, or connection strings
- raw SHL keys, passcodes, QR payloads, plaintext files, JWTs, or SD-JWT payloads
- production screenshots containing real patient or clinical data

## Common Hints

| Symptom | First checks |
|---------|--------------|
| Job is stuck queued | Worker is running, adapter is accepting work, available time has passed |
| Job is dead-lettered | Latest error event, attempts, idempotency key, adapter state, source input validity |
| Mapping needs review | Missing identifiers, DQI threshold, DocumentReference hash, contract mapping profile |
| Adapter down | Circuit breaker state, backpressure, local buffer, mapping version, target configured |
| SHL access fails | Expiry, revocation, passcode lockout, access count, manifest hash, object reference |
| Sync-back rejected | Target kind, outbound payload summary, consistency key, reconciliation status |

## Manus Verification

Manus should validate this playbook against workspace data by:

1. Creating one successful demo job and one needs-review or dead-letter job.
2. Confirming both can be found by `correlationId` in `/integration`.
3. Confirming event metadata is redacted and does not show raw PHI or secrets.
4. Confirming adapter health and reconciliation issues produce actionable next steps.
