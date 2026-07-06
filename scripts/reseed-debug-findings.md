# Reseed Debug Findings

## Problem
The reseed hangs after "hospital TCM id=9, creating issuer..." — specifically after the upsertSeedUser for TCM issuer returns, it hangs on the NEXT operation which is `seedStaffForHospital(hospital, hospitalId)` for TCM.

## Key Finding
- All seed staff users already exist in DB (TCC: 680-684, TCP: 732-736, TCM: 737+)
- The upsertSeedUser uses INSERT...ON DUPLICATE KEY UPDATE
- TCC issuer takes ~7s, TCP issuer takes ~7s, then TCM issuer starts but NEVER completes seedStaffForHospital
- The DB has only 2 connections visible in SHOW PROCESSLIST
- The dev server uses drizzle-orm/mysql2 with `drizzle(process.env.DATABASE_URL)` (no pool config)

## Root Cause Hypothesis
The issue is likely that drizzle's mysql2 driver creates a connection pool with a default limit (usually 10). After creating the TCM issuer (which works), the next call to `seedStaffForHospital` calls `upsertSeedUser` which calls `getDb()` again. 

But wait - getDb() returns a singleton `_db`. So it's the same connection. The issue might be that the previous INSERT...ON DUPLICATE KEY UPDATE for TCM issuer left a transaction open or a lock that blocks the next INSERT.

## Alternative Hypothesis
TiDB's pessimistic locking: the INSERT...ON DUPLICATE KEY UPDATE acquires a row lock on the unique index. If the connection doesn't commit (auto-commit might be off), subsequent operations on the same table will deadlock.

## Solution
1. Try adding explicit transaction handling
2. Or try using a separate connection for each operation
3. Or try using `INSERT IGNORE` + separate UPDATE instead of ON DUPLICATE KEY UPDATE
4. Or check if drizzle's mysql2 adapter has auto-commit issues

## Quick Fix Approach
Change upsertSeedUser to use a simpler pattern:
1. SELECT first to check if exists
2. If exists, UPDATE
3. If not, INSERT

This avoids the ON DUPLICATE KEY UPDATE locking issue.

## Files Modified So Far (v3.39):
- server/portability/did.ts - Per-hospital ES256 key pairs
- server/portability/labels.ts - WALLET_DOCUMENT_CATALOG (26 entries)
- server/portability/types.ts - IssuerProfile has nameTh + hospitalCode
- server/portability/vc.ts - Wallet-compatible buildCredentialEnvelope + createPresentation
- server/portability/reseed.ts - issuerProfile sends nameTh/hospitalCode, all issueCredential calls pass documentType/patient/hospitalCode, credentialData stores vc.credential directly, walletCard uses Thai name primary
- drizzle/schema.ts - wallet_cards has issuerDid column
- server/_core/index.ts - Added /api/reseed-vc endpoint

## Next Steps
1. Fix the upsertSeedUser to avoid ON DUPLICATE KEY UPDATE deadlock
2. Run reseed successfully
3. Verify all credentials have wallet-compatible schema
4. Remove debug logging
5. Push to GitHub, save checkpoint
