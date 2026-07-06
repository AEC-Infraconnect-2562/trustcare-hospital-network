# ES256 Signing Implementation Notes

## Status
- ES256 key pair generated and stored in env vars (TRUSTCARE_VC_SIGNING_PRIVATE_JWK, TRUSTCARE_VC_SIGNING_PUBLIC_JWK)
- `resolveSigningMaterial()` in server/portability/vc.ts correctly picks up the private JWK when env var is set
- Test script (scripts/test-es256-verify.ts) confirms GREEN badge for both VC and VP
- The vitest (server/vc-signing-keys.test.ts) passes all 4 tests

## Problem
- The reseed function uses `resolveSigningMaterial(issuerDid, "vc")` where issuerDid is the hospital-specific DID (e.g., "did:web:trustcare.network:hospital:tcc")
- The env var `TRUSTCARE_VC_SIGNING_PRIVATE_JWK` is a SINGLE key for the network-level issuer
- The `resolveSigningMaterial` function uses the SAME key regardless of issuerDid — it just uses the env var
- After reseed, credentials STILL show HS256 — this means the server process that ran the seed did NOT have the env vars loaded

## Root Cause
- The dev server was restarted AFTER the seed was already running
- The seed.run endpoint is called via HTTP to the running server
- Server restart happened at 06:21:12, but the seed was already queued before that
- The SECOND seed run (after restart) should have picked up the new env vars
- BUT the results still show HS256 — the seed completed with 345 credentials all HS256

## Investigation
- The seed completed successfully (664 bytes result, 345 credentials)
- But credentials still show HS256 — the env vars might not be reaching the server process
- Need to verify env vars are actually in the running server process

## Solution
- Need to verify the server process has the env vars
- If not, need to ensure webdev_request_secrets properly injects into the running server
- Then re-run the seed one more time
