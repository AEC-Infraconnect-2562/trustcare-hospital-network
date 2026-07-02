# TrustCare System Realignment Handoff

**Version:** 1.0  
**Date:** 2026-07-02  
**Scope:** UX/UI realignment around patient-controlled readiness, Wallet portability, contextual consent, and VC/VP service packets.

---

## 1. Product Direction

TrustCare is not being positioned as a generic national health platform or a central EHR. The product goal is to reduce hospital service friction by helping a patient collect, verify, present, and update the minimum trustworthy documents needed before and during care.

The hospital receives enough verified data to start service efficiently. The patient's Wallet remains the portability layer. HIS, LIS, RIS, PACS, payer systems, partner portals, and legacy databases remain sources of truth for their own operational domains and feed verified documents into the Wallet through canonical mapping and Maker/Checker or trusted issuance flows.

---

## 2. UX/UI Realignment Implemented

### Navigation Groups

The sidebar now uses five product-oriented groups:

| Group | Purpose |
|---|---|
| Service Readiness | Prepare for service, Wallet, Smart Share |
| Care Transition | Referral, cross-border, international patient, Partner Portal |
| Verified Documents | Issue to Wallet, Maker queue, Checker queue, Verifier |
| Hospital Operations | Dashboard, executive, claims, audit |
| Integration & Governance | HIS integration, portability, FHIR, terminology, adapter SDK, MPI, hospitals, trust, users, settings |

Standalone consent is intentionally hidden from the default sidebar. Consent is now contextual inside the flow that creates a share packet or document request.

### New Page

`/prepare-service` is the new Service Readiness cockpit.

Supported readiness contexts:

| Context | Meaning |
|---|---|
| `opd_visit` | Routine OPD/intake readiness |
| `emergency` | Critical identity, allergy, medication, condition readiness |
| `referral` | Referral packet readiness |
| `cross_border` | Cross-network/cross-border referral readiness |
| `medical_tourist` | International patient and medical tourist readiness |
| `insurance_claim` | Payer, eligibility, and claim readiness |
| `pharmacy_dispense` | Prescription and pharmacy dispense readiness |

### New Components

| Component | Purpose |
|---|---|
| `ServiceReadinessPanel` | Calculates readiness, lists ready/missing documents, creates VP service packets |
| `DocumentRequestWizard` | Records document requests from HIS/legacy/partner/payer/patient-upload sources |
| `ContextualConsentDialog` | Explicit in-flow consent before building a VP packet |
| `PrepareForService` page | Context selector and readiness cockpit |

Wallet now has a direct call-to-action to `/prepare-service` so the Wallet works as a readiness center, not only a card list.

---

## 3. Backend/API Changes

New shared model:

- `shared/readiness.ts`
  - `readinessContextValues`
  - `readinessContextLabels`
  - `readinessRequirements`
  - `assessReadiness(cards, context)`

New `wallet` tRPC procedures:

| Procedure | Description |
|---|---|
| `wallet.readiness` | Loads wallet cards, evaluates readiness, returns active requests and prior checks |
| `wallet.documentRequests` | Lists wallet document requests by patient/context/status |
| `wallet.requestDocument` | Creates a real DB document request record for external/source-of-truth retrieval |
| `wallet.buildServicePacket` | Creates a real VP from active signed VCs in Wallet and stores the service readiness check |

Important behavior:

- `wallet.buildServicePacket` does not create fake VCs.
- It only packages active `issued_credentials` rows that have `sdJwtVc`.
- It creates a real VP via the portability `createPresentation()` path.
- It writes the VP to `issued_presentations`.
- It writes readiness history to `service_readiness_checks`.
- Patients can prepare only their own Wallet data.
- Staff can prepare for a patient only when they pass `patientId`.

---

## 4. Database Changes

Migration added:

```text
drizzle/0013_service_readiness_wallet_requests.sql
```

New tables:

### `service_readiness_checks`

Stores each readiness evaluation/service packet event.

Key fields:

- `patientId`
- `context`
- `hospitalId`
- `serviceName`
- `score`
- `criticalReady`
- `requiredMissing`
- `recommendedMissing`
- `selectedCredentialIds`
- `packetPresentationId`
- `shlId`
- `status`
- `metadata`
- `createdBy`
- `createdAt`
- `updatedAt`

### `wallet_document_requests`

Stores document retrieval/import requests before Make VC.

Key fields:

- `requestId`
- `patientId`
- `context`
- `documentType`
- `documentCategory`
- `sourceType`
- `sourceName`
- `targetHospitalId`
- `status`
- `requestedBy`
- `consentRecordId`
- `caseDocumentId`
- `credentialRequestId`
- `notes`
- `metadata`
- `createdAt`
- `updatedAt`

Allowed `sourceType` values:

```text
his, lis, ris, pacs, hospital_app, national_app, partner_portal, payer,
patient_upload, personal_health_app, other
```

---

## 5. Manus Workspace Validation Plan

Before seeding or demo validation, Manus should run these checks in its own Workspace DB:

1. Confirm current code is the PR branch after merge.
2. Apply migration `0013_service_readiness_wallet_requests.sql`.
3. Verify tables exist:
   - `service_readiness_checks`
   - `wallet_document_requests`
4. Verify indexes exist:
   - `idx_service_readiness_patient_context`
   - `idx_service_readiness_packet`
   - `idx_wallet_doc_requests_patient_context`
   - `idx_wallet_doc_requests_status`
5. Confirm at least one demo patient has active Wallet cards with signed VC rows:
   - `wallet_cards.credentialId` links to `issued_credentials.id`
   - `issued_credentials.status = 'active'`
   - `issued_credentials.sdJwtVc IS NOT NULL`
6. If signed Wallet data is missing or stale, run the existing VC/VP reseed path before testing readiness.
7. Validate `/prepare-service` as the patient demo user and as staff.
8. Create one VP service packet for:
   - OPD visit
   - referral
   - medical tourist
   - insurance claim
9. Confirm `issued_presentations` and `service_readiness_checks` receive rows.
10. Create at least one missing document request and confirm `wallet_document_requests` receives a row.

---

## 6. Recommended Seed/Reseed Scenarios

Use existing real issuance/reseed paths. Do not insert fake signed credentials by hand.

Minimum demo state:

| Patient/Hospital Scenario | Required Wallet VC examples |
|---|---|
| OPD visit | identity, allergy, medication summary, patient summary |
| Emergency | identity, allergy alert, medication summary, patient summary |
| Referral | identity, referral VC, patient summary, labs |
| Cross-border | identity/travel document, referral, patient summary, consent, labs |
| Medical tourist | identity/travel document, coverage/guarantee, quotation, patient summary |
| Insurance claim | identity, coverage eligibility, claim package, claim receipt, consent |
| Pharmacy dispense | identity, prescription, medication summary, allergy, dispense record |

For each scenario, create enough missing-document cases to exercise `wallet.requestDocument`.

---

## 7. Suggested Prompt For Manus

Use this prompt after the PR is merged into the Manus Workspace:

```text
Please update the Manus Workspace DB and deployed TrustCare app for the merged TrustCare Service Readiness realignment PR.

1. Pull the latest code from GitHub main after merge.
2. Review docs/ARCHITECTURE.md, docs/CONTRIBUTING.md, and docs/TRUSTCARE_SYSTEM_REALIGNMENT_HANDOFF.md before making DB changes.
3. Apply drizzle/0013_service_readiness_wallet_requests.sql to the Workspace DB.
4. Validate that service_readiness_checks and wallet_document_requests exist with the expected indexes.
5. Audit demo Wallet data:
   - wallet_cards must link to active issued_credentials
   - issued_credentials.sdJwtVc must be present for all cards used in VP packets
   - patients must not have Maker/Checker issuer privileges
6. If demo Wallet VCs are missing, stale, revoked, or not signed, run the existing VC/VP reseed path, not manual fake inserts.
7. Seed realistic wallet_document_requests for OPD, referral, cross-border, medical tourist, insurance claim, and pharmacy dispense contexts.
8. Test /prepare-service as:
   - patient demo user
   - doctor
   - nurse
   - integration engineer
   - hospital admin
9. For each context, verify readiness score, missing docs, request document wizard, contextual consent dialog, and VP service packet QR.
10. Confirm that creating a VP packet writes to issued_presentations and service_readiness_checks.
11. Confirm that document request wizard writes to wallet_document_requests.
12. Run pnpm check, targeted readiness/menu tests, and production build.
13. Deploy using Manus checkpoint only after all validation is complete.

Do not solve missing data by hardcoding UI fallback data. Do not create unsigned placeholder VCs. The readiness flow must be DB-bound and VC/VP-bound.
```

---

## 8. Acceptance Criteria

- `/prepare-service` is visible from the sidebar and Wallet CTA.
- Patients see readiness, Wallet, and SHL share flows but no issuer operations.
- Staff Maker/Checker queues appear in Verified Documents for appropriate roles.
- Integration engineers can access readiness and Wallet for import/source support without issuer queue access.
- Contextual consent appears before VP service packet creation.
- VP service packets are real VPs built from active signed VCs.
- Missing document requests persist to DB.
- Manus can reseed VC/VP data and retest without modifying UI code.

