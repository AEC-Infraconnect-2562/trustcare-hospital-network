# TrustCare DB Validation & SHL Reseed Report

**Date:** 2026-07-01T17:34 UTC  
**Branch:** main (includes PR #6 merge: `codex/shl-transport-vc-trust-layer`)  
**Commit:** df119b9 (merge) → 11a4470 (feat: harden smart health links trust layer)  
**Batch ID:** `urn:trustcare:seed:batch:12:ac6d470acf5c130e`

---

## 1. Preflight

| Check | Result |
|-------|--------|
| DB connection | OK |
| Migration 0011 file exists | YES |
| SHL support in codebase | YES (`server/portability/shl.ts`, `shlSimulator.ts`, `shlAccess.ts`) |
| Branch has `reseedTrustcareVcVpDatabase` with SHL | YES (lines 205-233 call `seedSmartHealthLinkPackages`) |

---

## 2. Schema Validation

All required SHL columns confirmed present:

| Table | Key Columns |
|-------|-------------|
| `smart_health_links` | manifestToken, manifestUrl, qrPayload, viewerUrl, status, passcodeHash, passcodeSalt, manifestCredentialId, presentationId, sourceBundleHash, contextHash, currentManifestVersion, expiresAt, revokedAt, disabledReason |
| `shl_files` | shlId, manifestVersion, fileId, contentType, embeddedJwe, contentHash, plaintextHash, encryptedSizeBytes |
| `shl_manifest_versions` | shlId, manifestVersion, contextHash, scopeHash, sourceBundleHash, manifestHash, manifestCredentialId, presentationId, status |
| `shl_access_logs` | (existing from earlier migration, verified present) |

---

## 3. Role & Data Consistency

| Check | Result |
|-------|--------|
| Patient issuer-role violations | 0 |
| Patient entitlement violations | 0 |
| Hospital DID (did:web:) | All 3 hospitals ✓ |
| Patient identifiers (did:key) | 150 identifiers for 36 patients ✓ |
| Missing hospital codes | 0 |
| Missing source-truth connectors | 0 |

---

## 4. SHL Seed Drift (Before Reseed)

| Table | Count |
|-------|-------|
| smart_health_links | 0 |
| shl_files | 0 |
| shl_manifest_versions | 0 |
| shl_access_logs | 0 |

**Diagnosis:** SHL tables were empty — migration 0011 was applied but `reseedTrustcareVcVpDatabase` had never been run with SHL support.

---

## 5. Repair (Skipped)

No broken SHL rows to revoke (tables were empty).

---

## 6. Reseed Execution

- **Function:** `reseedTrustcareVcVpDatabase({ patientsPerHospital: 12, resetExistingSeed: true })`
- **Duration:** ~7 minutes 20 seconds (heavy crypto: JWE encryption, SD-JWT signing, scrypt passcode hashing)
- **Result:** Batch completed successfully

---

## 7. Post-Seed Validation

### 7.1 Table Counts (After Reseed)

| Table | Count |
|-------|-------|
| hospitals | 3 |
| seed patients | 36 |
| seed staff | 15 |
| credential templates | 72 |
| active seed credentials | 351 |
| wallet cards | 351 |
| active seed presentations | 12 |
| patient identifiers | 150 |
| source-truth connectors | 6 |
| **smart_health_links** | **6 (all active)** |
| **shl_files** | **6** |
| **shl_manifest_versions** | **6** |
| shl_access_logs | 0 (expected: no access yet) |

### 7.2 SHL Package Details

| ID | Label | Purpose | Context | Passcode | Bundle Hash | Manifest VC | VP |
|----|-------|---------|---------|----------|-------------|-------------|-----|
| 1 | OPD frictionless check-in | patient_summary | treatment | ✓ | ✓ | urn:trustcare:seed:vc:shl_manifest:vp-opd-checkin:p001 | urn:trustcare:seed:vp:shl:vp-opd-checkin:p001 |
| 2 | Emergency triage | patient_summary | emergency | ✓ | ✓ | urn:trustcare:seed:vc:shl_manifest:vp-emergency-triage:p002 | urn:trustcare:seed:vp:shl:vp-emergency-triage:p002 |
| 3 | Pharmacy dispense from prescription | patient_summary | treatment | ✓ | ✓ | urn:trustcare:seed:vc:shl_manifest:vp-pharmacy-prescription:p003 | urn:trustcare:seed:vp:shl:vp-pharmacy-prescription:p003 |
| 4 | Closed-loop referral packet | referral | cross_branch_referral | ✓ | ✓ | urn:trustcare:seed:vc:shl_manifest:vp-referral-packet:p004 | urn:trustcare:seed:vp:shl:vp-referral-packet:p004 |
| 5 | Insurance e-claim | insurance | e_claim | ✓ | ✓ | urn:trustcare:seed:vc:shl_manifest:vp-insurance-claim:p005 | urn:trustcare:seed:vp:shl:vp-insurance-claim:p005 |
| 6 | Medical tourist intake | medical_tourist | medical_tourist | ✓ | ✓ | urn:trustcare:seed:vc:shl_manifest:vp-medical-tourist-intake:p006 | urn:trustcare:seed:vp:shl:vp-medical-tourist-intake:p006 |

### 7.3 JWE Encrypted File Sizes

| SHL ID | Content Type | Encrypted Size |
|--------|-------------|----------------|
| 1 | application/fhir+json | 39,959 bytes |
| 2 | application/fhir+json | 40,148 bytes |
| 3 | application/fhir+json | 28,167 bytes |
| 4 | application/fhir+json | 41,761 bytes |
| 5 | application/fhir+json | 28,568 bytes |
| 6 | application/fhir+json | 30,989 bytes |

### 7.4 Audit Discrepancy Note

The built-in `auditTrustcareVcVpSeedDatabase` reports `ok: false` because:
- **Expected credentials:** 345 → **Actual:** 351 (delta = +6 `shl_manifest` VCs)
- **Expected presentations:** 6 → **Actual:** 12 (delta = +6 SHL VPs)

This is **expected behavior** — the audit's `expected.documents` count (from `seedData.ts`) does not include the 6 additional `shl_manifest` credentials and 6 SHL-specific VPs that are generated dynamically during SHL package creation. The audit function's expected count should be updated to `351` and `12` respectively.

### 7.5 UI Verification

- `/shl` page: **6 SHL packages displayed** with correct labels, purposes, contexts, and "active" badges
- `/shl-viewer` page: Public viewer ready with SHLink input, recipient, and passcode fields
- All other pages: No regressions observed

### 7.6 Tests

```
Test Files  13 passed (13)
     Tests  152 passed (152)
  Duration  3.46s
```

---

## 8. Conclusion

The TrustCare Manus workspace database is now fully seeded with SHL transport trust layer data. The `/shl` page shows real persisted Smart Health Link packages from the production database, each with:
- JWE-encrypted FHIR Bundle files
- Scrypt-hashed passcodes
- Manifest VC credentials (ShlManifestCredential)
- Holder VP binding
- Manifest version tracking
- Access logging infrastructure (ready for first access)
