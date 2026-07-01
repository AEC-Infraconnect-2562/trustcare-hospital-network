# Trustcare Production Hardening Runbook

This runbook turns the sandbox Patient Data Portability Layer into a production-ready deployment baseline.

## Standards Anchors

- W3C Verifiable Credentials Data Model v2.0: issuer/holder/verifier roles, verifier policy, securing mechanisms, status, and privacy/security considerations.
- W3C Bitstring Status List v1.0: revocation and suspension status-list model used by `BitstringStatusListEntry`.
- HL7 FHIR R4 AuditEvent and Provenance: audit trail and source evidence model for canonicalization, issuance, verification, and sync-back.
- SMART Health Links: portable, expiring, manifest-based sharing pattern for clinical packages.

## Cryptographic Signing

Configure asymmetric VC/VP signing before production:

- `TRUSTCARE_VC_SIGNING_PRIVATE_JWK`: private JSON Web Key used by the issuer service.
- `TRUSTCARE_VC_SIGNING_PUBLIC_JWK`: public JSON Web Key published to verifiers.
- `TRUSTCARE_VC_SIGNING_ALG`: recommended `ES256` or another verifier-approved asymmetric algorithm.
- `TRUSTCARE_VC_KEY_ID`: stable key identifier, for example `did:web:trustcare.network#2026-07-vc`.
- `TRUSTCARE_STATUS_LIST_URL`: public revocation/suspension status-list credential URL.

If no asymmetric key is configured, the system falls back to development HMAC signing and verification returns a warning. Do not run cross-border, payer, or medical tourist verification in production with development HMAC keys.

## JWKS And Trust Registry

Production verifiers should read:

- `portability.jwks` for the local issuer public JWKS.
- `trustRegistry.create` / `trustRegistry.update` with `publicKeyJwk`, `x509Certificate`, `credentialTypes`, and `metadata`.
- `portability.verify` with `trustRegistryMode: "required"` for cross-organization verification.

Only active trust registry entries with `trustLevel: "verified"` are treated as trusted issuers in required mode.

## Revocation And Status

Each issued VC includes a `BitstringStatusListEntry` with `statusPurpose: "revocation"` and a deterministic `statusListIndex`.

Operational flow:

1. Revoke or suspend a credential in the credential lifecycle store.
2. Record a status event through `portability.recordCredentialStatus`.
3. Publish or rebuild the external status-list credential referenced by `TRUSTCARE_STATUS_LIST_URL`.
4. Verify with `trustRegistryMode: "required"` and current revoked credential IDs/status indexes.

## HIS Sync Back

Each sync-back write must produce:

- A deterministic sync plan with idempotency and consistency keys.
- A target adapter ACK/readback execution result.
- A `SyncReceiptCredential`.
- A reconciliation job unless the write was transactional and readback matched.

Adapter workers should preserve the `executeSyncBack` contract and replace only the deterministic adapter body with site-specific transport code for FHIR REST, HL7 v2, REST, CSV/SFTP, or legacy DB outbox targets.

## Deployment Checklist

- Seed verified issuer/verifier DIDs and public JWKs in the trust registry.
- Configure production signing keys and rotate them with stable `kid` values.
- Run database migration `0004_production_portability_hardening`.
- Enable `trustRegistryMode: "required"` for payer, cross-border, partner hospital, and medical tourist verifiers.
- Monitor `sync_reconciliation_jobs` for scheduled/manual review work.
- Keep Advisory CI non-blocking until multi-agent churn settles, then make typecheck/unit/E2E/build required checks.
