# TrustCare Hospital Network — Architecture Documentation

**Version:** 5.6 (Prepare for Service Core Workbench)
**Last updated:** 2026-07-03
**Maintainers:** AEC-Infraconnect-2562

---

## 1. Architecture Overview

TrustCare Hospital Network is a **Verifiable Credential (VC) and Verifiable Presentation (VP) issuance platform** designed for Thai hospital networks. It implements the W3C VC Data Model v2.0 with SD-JWT-VC format, FHIR R4 clinical data canonicalization, Smart Health Links (SHL) transport, TAO Trust Framework, and a Maker/Checker authorization workflow for credential governance.

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React 19 + Tailwind 4)             │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ ┌───────────────────┐  │
│  │Dashboard │ │Portability│ │Maker/Checker │ │Executive Dashboard│  │
│  │  Layout  │ │ Workbench │ │   Queues     │ │   & Analytics     │  │
│  └──────────┘ └──────────┘ └──────────────┘ └───────────────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ ┌───────────────────┐  │
│  │  Wallet  │ │   SHL    │ │Trust Registry│ │  Cross-Border     │  │
│  │  & Cards │ │  Viewer  │ │   & TAO      │ │  & International  │  │
│  └──────────┘ └──────────┘ └──────────────┘ └───────────────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ ┌───────────────────┐  │
│  │  Bundle  │ │  Wizard  │ │  Inline      │ │  Partner Trust    │  │
│  │  Manager │ │  Flows   │ │  Preview     │ │  Verification     │  │
│  └──────────┘ └──────────┘ └──────────────┘ └───────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                              │ tRPC (superjson)
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        BACKEND (Express 4 + tRPC 11)                │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    server/routers.ts (appRouter)              │   │
│  │  auth · seed · makerChecker · hospital · credential ·        │   │
│  │  wallet · verifier · consent · referral · fhir ·             │   │
│  │  terminology · audit · notification · dashboard · users ·    │   │
│  │  patientIdentity · integration · trustRegistry · shl ·       │   │
│  │  claim · international · crossBorderReferral ·               │   │
│  │  careTransition · partnerPortal · portability ·              │   │
│  │  executiveDashboard · tao · schemaRegistry                   │   │
│  └──────────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              server/portability/ (VC/VP Engine)               │   │
│  │  vc.ts · did.ts · fhir.ts · policy.ts · presentation.ts ·   │   │
│  │  syncBack.ts · sourceTruth.ts · seedData.ts · reseed.ts ·   │   │
│  │  labels.ts · trust.ts · clinicalDocuments.ts · types.ts ·   │   │
│  │  shl.ts · shlSimulator.ts · utils.ts                        │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                              │ Drizzle ORM
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        DATABASE (MySQL/TiDB)                         │
│  53 tables · migrations through 0013 + document_bundles/files       │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 Technology Stack

| Layer     | Technology                          | Purpose                     |
| --------- | ----------------------------------- | --------------------------- |
| Frontend  | React 19, Tailwind CSS 4, shadcn/ui | UI framework                |
| Routing   | Wouter                              | Client-side routing         |
| API Layer | tRPC 11 + Superjson                 | End-to-end type-safe RPC    |
| Backend   | Express 4, Node.js 22               | HTTP server                 |
| ORM       | Drizzle ORM 0.44                    | Type-safe database queries  |
| Database  | MySQL (TiDB-compatible)             | Persistent storage          |
| Crypto    | jose (JWT), HMAC-SHA256             | VC signing and verification |
| Auth      | Manus OAuth + Demo Login            | Session management          |
| Storage   | S3-compatible                       | File/credential storage     |
| Testing   | Vitest 2                            | Unit + E2E testing          |
| Build     | Vite 7                              | Frontend bundling           |

### 1.3 Module Dependency Graph

```
routers.ts (care transition release, 29 routers)
  ├── db.ts (query helpers)
  │     └── drizzle/schema.ts (59 table definitions + 2 DB-only tables)
  ├── shared/rolePolicy.ts (role authorization logic)
  ├── shared/menuConfig.ts (menu visibility per role)
  ├── scheduledHandlers/ (periodic task handlers)
  │     └── consentExpiry.ts (consent expiry reminder notifications)
  └── portability/ (17 modules)
        ├── index.ts (re-exports all public APIs)
        ├── vc.ts (issue/verify VC, create/verify VP)
        ├── did.ts (DID generation: did:web, did:key)
        ├── fhir.ts (HIS → FHIR R4 canonicalization + DQI scoring)
        ├── policy.ts (consent-based access control)
        ├── presentation.ts (JSON VP verification)
        ├── syncBack.ts (HIS/Legacy sync-back plans)
        ├── sourceTruth.ts (CSV/DB import + review)
        ├── seedData.ts (demo hospital/patient generation)
        ├── reseed.ts (DB reseed orchestrator)
        ├── labels.ts (document taxonomy + storage metadata)
        ├── trust.ts (trust registry policy builder)
        ├── clinicalDocuments.ts (FHIR Composition builders)
        ├── types.ts (shared type definitions + DataQualityScore)
        ├── shl.ts (SHL payload, passcode hash, JWE manifest helpers)
        ├── shlSimulator.ts (realistic HIS/legacy source scenarios for SHL QA)
        └── utils.ts (sha256, nanoid, date helpers)
```

---

## 2. Hospital Network (Canonical Source of Truth)

### 2.1 Network Hospitals (3 Hospitals)

| ID  | Code | Name (TH)                                   | Name (EN)                                  | DID                                      | Focus                |
| --- | ---- | ------------------------------------------- | ------------------------------------------ | ---------------------------------------- | -------------------- |
| 4   | TCC  | โรงพยาบาลทรัสต์แคร์ เซ็นทรัล                | TrustCare Central Hospital                 | `did:web:trustcare.network:hospital:tcc` | General/referral hub |
| 8   | TCP  | โรงพยาบาลทรัสต์แคร์ ภูเก็ต อินเตอร์เนชันแนล | TrustCare Phuket International Hospital    | `did:web:trustcare.network:hospital:tcp` | Medical tourism      |
| 9   | TCM  | โรงพยาบาลทรัสต์แคร์ เชียงใหม่ ครอสบอร์เดอร์ | TrustCare Chiang Mai Cross-Border Hospital | `did:web:trustcare.network:hospital:tcm` | Cross-border care    |

> **Important:** The canonical hospital source is `server/portability/seedData.ts` (`TRUSTCARE_DEMO_HOSPITALS`). The `server/seed.ts` file references this same array. Hospital codes TCC/TCP/TCM are the single source of truth — never create duplicate codes.

### 2.2 Network-Level Issuer

| Entity                       | DID                         | Trust Level | Purpose                          |
| ---------------------------- | --------------------------- | ----------- | -------------------------------- |
| เครือข่ายโรงพยาบาลทรัสต์แคร์ | `did:web:trustcare.network` | verified    | Network-level credential signing |

### 2.3 Trust Registry (Internal)

| #   | Entity Type | Name                                        | DID                                      | Trust Level |
| --- | ----------- | ------------------------------------------- | ---------------------------------------- | ----------- |
| 1   | issuer      | โรงพยาบาลทรัสต์แคร์ เซ็นทรัล                | `did:web:trustcare.network:hospital:tcc` | verified    |
| 2   | issuer      | โรงพยาบาลทรัสต์แคร์ ภูเก็ต อินเตอร์เนชันแนล | `did:web:trustcare.network:hospital:tcp` | verified    |
| 3   | issuer      | โรงพยาบาลทรัสต์แคร์ เชียงใหม่ ครอสบอร์เดอร์ | `did:web:trustcare.network:hospital:tcm` | verified    |
| 4   | issuer      | เครือข่ายโรงพยาบาลทรัสต์แคร์                | `did:web:trustcare.network`              | verified    |

### 2.4 TAO Trust Framework (External Organizations)

**Trusted Issuers (External):**

| #   | DID                             | Name                 | Type     | Trust Level | Anchor |
| --- | ------------------------------- | -------------------- | -------- | ----------- | ------ |
| 1   | `did:web:siriraj.mahidol.ac.th` | โรงพยาบาลศิริราช     | hospital | accredited  | moph   |
| 2   | `did:web:rama.mahidol.ac.th`    | โรงพยาบาลรามาธิบดี   | hospital | accredited  | moph   |
| 3   | `did:web:bumrungrad.com`        | โรงพยาบาลบำรุงราษฎร์ | hospital | recognized  | self   |

**Trusted Verifiers (External):**

| #   | DID                             | Name                                     | Type       | Trust Level |
| --- | ------------------------------- | ---------------------------------------- | ---------- | ----------- |
| 1   | `did:web:siriraj.mahidol.ac.th` | โรงพยาบาลศิริราช                         | hospital   | accredited  |
| 2   | `did:web:rama.mahidol.ac.th`    | โรงพยาบาลรามาธิบดี                       | hospital   | accredited  |
| 3   | `did:web:bumrungrad.com`        | โรงพยาบาลบำรุงราษฎร์                     | hospital   | recognized  |
| 4   | `did:web:nhso.go.th`            | สำนักงานหลักประกันสุขภาพแห่งชาติ (สปสช.) | government | accredited  |

> **Note:** TAO external organizations have `hospitalId = NULL` — they are NOT part of the TrustCare network but are recognized trust anchors for cross-network verification.

---

## 3. VC/VP Issuance Lifecycle

### 3.1 Credential Types (24 Document Types)

The system supports 24 verifiable credential types organized into 9 document categories:

| Category              | Document Types                                                                 | VC Type                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Identity & Access     | patient_identity, consent_receipt, mpi_link_certificate                        | PatientIdentityCredential, ConsentReceiptCredential, MpiLinkCertificateCredential                                 |
| Clinical Summary      | patient_summary, allergy_alert, immunization, medical_certificate              | PatientSummaryCredential, AllergyAlertCredential, ImmunizationCredential, MedicalCertificateCredential            |
| Medication & Pharmacy | medication_summary, prescription, pharmacy_dispense                            | MedicationSummaryCredential, PrescriptionCredential, PharmacyDispenseCredential                                   |
| Diagnostics & Results | lab_result, diagnostic_report                                                  | LabResultCredential, DiagnosticReportCredential                                                                   |
| Care Transition       | referral_vc, discharge_summary                                                 | ReferralCredential, DischargeSummaryCredential                                                                    |
| Claims & Finance      | insurance_eligibility, claim_package, claim_receipt                            | CoverageEligibilityCredential, ClaimPackageCredential, ClaimReceiptCredential                                     |
| Medical Tourism       | travel_document_verification, visa_support_letter, quotation, guarantee_letter | TravelDocumentVerificationCredential, VisaSupportLetterCredential, QuotationCredential, GuaranteeLetterCredential |
| Sharing & Sync        | shl_manifest, sync_receipt                                                     | ShlManifestCredential, SyncReceiptCredential                                                                      |
| Operations            | appointment                                                                    | AppointmentCredential                                                                                             |

### 3.2 Issuance Flow (Maker/Checker)

```
┌─────────┐      ┌─────────┐      ┌──────────┐      ┌──────────┐
│  Source  │      │  Maker  │      │  Checker │      │  Wallet  │
│  of      │─────▶│  Queue  │─────▶│  Queue   │─────▶│  Card    │
│  Truth   │      │         │      │          │      │          │
└─────────┘      └─────────┘      └──────────┘      └──────────┘
     │                 │                 │                 │
     │  1. Ingest      │  2. Submit      │  3. Approve    │  4. Issue
     │  HIS data       │  request        │  & sign VC     │  to wallet
     ▼                 ▼                 ▼                 ▼
 FHIR R4         credential_       issued_            wallet_cards
 canonical       issuance_         credentials        (patient view)
 bundle          requests
```

**Step-by-step:**

1. **Source Ingestion** — Clinical data arrives from HIS (REST API, Legacy DB View, CSV, HL7v2) and is canonicalized into FHIR R4 IPS Bundle via `canonicalizeHisPayload()`. The canonicalization also produces an automated **Data Quality Index (DQI) score** via `calculateDqiScore()`, grading data completeness, conformance, and consistency on a 0–100 scale (grades A–F).

2. **Maker Submission** — A user with `systemRole = "maker"` and appropriate `credentialEntitlements.makerTypes` submits a credential issuance request. The request is stored in `credential_issuance_requests` with status `submitted`.

3. **Checker Approval** — A user with `systemRole = "checker"` and appropriate `credentialEntitlements.checkerTypes` reviews the request. On approval, the system:
   - Calls `issueCredentialFromRequest()` which selects the appropriate VC builder
   - Signs the credential as SD-JWT-VC using HMAC-SHA256 (dev) or asymmetric key
   - Stores the issued credential in `issued_credentials`
   - Creates a wallet card in `wallet_cards`
   - Updates the request status to `issued`
   - Logs an audit event

4. **Wallet Delivery** — The credential appears in the patient's digital wallet with appropriate card type and display metadata. Credential previews include a **"สำเนา / COPY" watermark overlay** to prevent screenshot misuse. Patient photos are displayed from the user's uploaded avatar (S3) or a role-appropriate AI-generated realistic fallback.

### 3.3 Direct Issuance (Admin/Seed)

For automated or administrative issuance (bypassing Maker/Checker):

```
portability.createPacket → issueCredential() → issued_credentials + wallet_cards
portability.issueMedicalCertificate → issueMedicalCertificateVc() → issued_credentials
portability.issuePrescription → issuePrescriptionVc() → issued_credentials
```

### 3.4 Verification Flow

```
Verifier receives JWT → portability.verify (single VC)
                       → portability.verifyJsonPresentation (VP bundle)

Checks performed:
  1. JWT signature verification (HMAC or asymmetric)
  2. Trusted issuer check (Trust Registry — trustLevel must be "verified")
  3. Revocation status check (credential_status_events)
  4. Expiration check
  5. Required credential type check
  6. Clinical priority findings extraction
```

### 3.5 VP (Verifiable Presentation) Creation

```
createPresentation({
  holderDid,
  credentials: IssuedVc[],
  purpose: ConsentPurpose,
  audience: string,
  validMinutes: number
}) → PresentationPackage (jwt-vp format)
```

Presentations are stored in `issued_presentations` and linked to the patient and context.

---

## 4. Maker/Checker Authorization Matrix

### 4.1 System Roles

| Role                 | Code                   | Description                                         |
| -------------------- | ---------------------- | --------------------------------------------------- |
| System Admin         | `system_admin`         | Full system access, user management, trust registry |
| Hospital Admin       | `hospital_admin`       | Hospital-scoped administration                      |
| Maker                | `maker`                | Create and submit credential issuance requests      |
| Checker              | `checker`              | Review, approve/reject, and issue credentials       |
| Doctor               | `doctor`               | Clinical data access, referrals                     |
| Nurse                | `nurse`                | Patient care, limited credential view               |
| Integration Engineer | `integration_engineer` | Adapter configuration, sync management              |
| Patient              | `patient`              | Wallet access, consent management                   |

### 4.2 Credential Entitlements

Each user has a `credentialEntitlements` JSON field with the structure:

```json
{
  "makerTypes": ["medical_certificate", "prescription", "lab_result"],
  "checkerTypes": ["medical_certificate", "prescription", "lab_result"]
}
```

- `"*"` in either array grants access to all 24 document types.
- Entitlements are checked by `hasCredentialEntitlement(user, key, credentialType)`.
- Users with `systemRole = "patient"` are never eligible for Maker/Checker privileges.

### 4.3 Authorization Enforcement

| Action                   | Required Role     | Additional Check                                                   |
| ------------------------ | ----------------- | ------------------------------------------------------------------ |
| Submit issuance request  | `maker`           | `credentialEntitlements.makerTypes` includes the credential type   |
| Approve/Issue credential | `checker`         | `credentialEntitlements.checkerTypes` includes the credential type |
| Reject request           | `checker`         | Same as approve                                                    |
| Request changes          | `checker`         | Same as approve                                                    |
| Reseed database          | `admin`           | Admin-only procedure                                               |
| Manage trust registry    | `system_admin`    | Admin procedure                                                    |
| View executive dashboard | Any authenticated | Protected procedure                                                |

### 4.4 Multi-Role Support

The `user_roles` table allows users to hold multiple roles simultaneously. Users can switch active roles via `auth.switchRole` mutation, which sets the `trustcare_active_role` cookie.

---

## 5. Database Schema

### 5.1 Table Inventory (53 Tables)

Service readiness release note: migration `0013_service_readiness_wallet_requests` adds `service_readiness_checks` for readiness/VP packet history and `wallet_document_requests` for missing document retrieval/import requests. Use `drizzle/schema.ts` as the canonical full table definition list.

| #   | Table                          | Purpose                                                    | Key Relations                      |
| --- | ------------------------------ | ---------------------------------------------------------- | ---------------------------------- |
| 1   | `users`                        | User accounts with systemRole and credentialEntitlements   | —                                  |
| 2   | `hospitals`                    | Hospital registry with DID and endpoints                   | —                                  |
| 3   | `departments`                  | Hospital departments                                       | → hospitals                        |
| 4   | `credential_templates`         | VC template definitions per hospital                       | → hospitals                        |
| 5   | `issued_credentials`           | Issued VCs with SD-JWT payload                             | → users, hospitals, templates      |
| 6   | `credential_issuance_requests` | Maker/Checker workflow queue                               | → users, hospitals                 |
| 7   | `wallet_cards`                 | Patient wallet card entries                                | → issued_credentials               |
| 8   | `presentation_history`         | VP verification logs                                       | —                                  |
| 9   | `issued_presentations`         | Stored VP packages                                         | → users                            |
| 10  | `consent_policies`             | Consent policy definitions                                 | → hospitals                        |
| 11  | `consent_records`              | Patient consent grants                                     | → users, hospitals                 |
| 12  | `referrals`                    | Inter-hospital referrals                                   | → hospitals, users                 |
| 13  | `fhir_field_mappings`          | FHIR field mapping rules                                   | → hospitals                        |
| 14  | `terminology_mappings`         | Code system mappings                                       | → hospitals                        |
| 15  | `audit_events`                 | Full audit trail                                           | → users, hospitals                 |
| 16  | `vc_vp_seed_batches`           | Seed/reseed batch tracking                                 | —                                  |
| 17  | `notifications`                | User notifications                                         | → users, hospitals                 |
| 18  | `user_roles`                   | Multi-role assignments per user                            | → users                            |
| 19  | `credential_requests`          | Legacy credential request tracking                         | → users, hospitals                 |
| 20  | `patient_identifiers`          | MPI patient identity records                               | → hospitals                        |
| 21  | `mpi_matches`                  | MPI matching results                                       | → patient_identifiers              |
| 22  | `integration_adapters`         | External system adapters                                   | → hospitals                        |
| 23  | `adapter_health_logs`          | Adapter health monitoring                                  | → integration_adapters             |
| 24  | `mapping_versions`             | Mapping version history                                    | → hospitals                        |
| 25  | `integration_event_logs`       | Integration event tracking                                 | → integration_adapters             |
| 26  | `credential_status_events`     | VC revocation/suspension log                               | —                                  |
| 27  | `sync_reconciliation_jobs`     | Sync-back reconciliation tracking                          | —                                  |
| 28  | `trust_registry`               | Internal trusted issuer/verifier registry                  | —                                  |
| 29  | `tao_trusted_issuers`          | TAO framework external issuers (ETSI TL / GDHCN aligned)   | → hospitals (nullable)             |
| 30  | `tao_trusted_verifiers`        | TAO framework external verifiers                           | → hospitals (nullable)             |
| 31  | `tao_trust_policies`           | TAO credential-type enforcement policies                   | —                                  |
| 32  | `smart_health_links`           | SHL link management, manifest, consent/access policy       | → users, hospitals                 |
| 33  | `shl_files`                    | Encrypted SHL manifest file entries                        | → smart_health_links               |
| 34  | `shl_manifest_versions`        | Immutable SHL trust snapshots and supersede/revoke history | → smart_health_links               |
| 35  | `shl_access_logs`              | SHL access audit including passcode failures               | → smart_health_links               |
| 36  | `payer_adapters`               | Insurance payer configurations                             | → hospitals                        |
| 37  | `coverage_eligibility`         | Coverage check results                                     | → users, payer_adapters            |
| 38  | `claim_cases`                  | Insurance claim cases                                      | → users, hospitals, payer_adapters |
| 39  | `international_cases`          | Medical tourism cases                                      | → hospitals                        |
| 40  | `travel_documents`             | International patient documents                            | → international_cases              |
| 41  | `cross_border_referrals`       | Cross-border referral tracking                             | → hospitals                        |
| 42  | `vc_schema_registry`           | VC schema version registry                                 | —                                  |

### 5.2 Core VC/VP Tables (ERD)

```
┌──────────────────────┐       ┌───────────────────────────┐
│   hospitals          │       │   users                   │
│ ──────────────────── │       │ ───────────────────────── │
│ id (PK)              │       │ id (PK)                   │
│ code, name, nameEn   │       │ openId, name, email       │
│ did, status          │       │ systemRole, role          │
│ logoUrl, province    │       │ credentialEntitlements    │
└──────────┬───────────┘       │ hospitalId (FK)           │
           │                   │ avatarUrl, thaiId         │
           │                   └────────────┬──────────────┘
           │                                │
           ▼                                ▼
┌──────────────────────────────────────────────────────────┐
│   credential_issuance_requests                           │
│ ──────────────────────────────────────────────────────── │
│ id (PK), requestId (unique)                              │
│ templateId, issuerHospitalId, subjectId                  │
│ type (24 enum values), status (7 states)                 │
│ makerId, makerRole, checkerId, checkerRole               │
│ holderDid, issuerDid, documentData (JSON)                │
│ canonicalReview (JSON), checkerNotes                      │
│ issuedCredentialId, issuedCredentialRowId                 │
│ submittedAt, checkedAt, issuedAt                         │
└──────────────────────────────┬───────────────────────────┘
                               │ (on approve)
                               ▼
┌──────────────────────────────────────────────────────────┐
│   issued_credentials                                     │
│ ──────────────────────────────────────────────────────── │
│ id (PK), credentialId (unique URN)                       │
│ templateId, issuerId, issuerHospitalId, subjectId        │
│ type (24 enum), status (active/revoked/expired/suspended)│
│ credentialData (JSON), sdJwtVc (signed JWT)              │
│ documentCategory, documentSubcategory                    │
│ storageKey, searchTags (JSON), schemaVersion             │
│ fhirResourceId, issuedAt, expiresAt                      │
└──────────────────────────────┬───────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────┐
│   wallet_cards                                           │
│ ──────────────────────────────────────────────────────── │
│ id (PK), patientId, credentialId (FK)                    │
│ cardType (23 enum values)                                │
│ displayName, displayNameEn, issuerHospitalName           │
│ documentCategory, metadata (JSON)                        │
└──────────────────────────────────────────────────────────┘
```

### 5.3 Trust Layer Tables (ERD)

```
┌────────────────────────────┐
│   trust_registry           │  (Internal TrustCare network)
│ ────────────────────────── │
│ id, entityType, entityName │
│ did, trustLevel            │
│ credentialTypes (JSON)     │
│ isActive                   │
└────────────────────────────┘

┌────────────────────────────┐     ┌────────────────────────────┐
│   tao_trusted_issuers      │     │   tao_trusted_verifiers    │
│ ────────────────────────── │     │ ────────────────────────── │
│ id, did, name, nameEn      │     │ id, did, name, nameEn      │
│ organizationType           │     │ organizationType           │
│ trustLevel, trustAnchor    │     │ trustLevel, trustAnchor    │
│ accreditationBody/Id       │     │ credentialTypesAccepted    │
│ credentialTypesAllowed     │     │ purposesAllowed            │
│ hospitalId (nullable FK)   │     │ hospitalId (nullable FK)   │
└────────────────────────────┘     └────────────────────────────┘

┌────────────────────────────┐
│   tao_trust_policies       │
│ ────────────────────────── │
│ credentialType             │
│ requiredTrustLevel         │
│ requiredTrustAnchor        │
│ enforcementMode            │
└────────────────────────────┘
```

---

## 6. Migration Order

Migrations must be applied sequentially. Each migration builds on the previous state.

| #   | Tag                                      | Description                                    | Key Changes                                                                                                                                                                                                               |
| --- | ---------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | `0000_massive_shadow_king`               | Initial schema                                 | users, hospitals, departments, credential_templates, issued_credentials, wallet_cards, presentation_history, consent_policies, consent_records, referrals, fhir_field_mappings, terminology_mappings                      |
| 1   | `0001_groovy_owl`                        | Audit and notifications                        | audit_events, notifications, patient_identifiers, mpi_matches                                                                                                                                                             |
| 2   | `0002_equal_stellaris`                   | Integration layer                              | integration_adapters, adapter_health_logs, mapping_versions, integration_event_logs                                                                                                                                       |
| 3   | `0003_patient_portability_vc_documents`  | Extended VC types (11→24)                      | ALTER credential_templates, issued_credentials, wallet_cards type enums                                                                                                                                                   |
| 4   | `0004_production_portability_hardening`  | Production hardening                           | credential_status_events, sync_reconciliation_jobs, trust_registry, smart_health_links, shl_access_logs, payer_adapters, coverage_eligibility, claim_cases, international_cases, travel_documents, cross_border_referrals |
| 5   | `0005_seed_vc_vp_extended_documents`     | Full 24-type enum expansion                    | ALTER all type enums to include all 24 document types                                                                                                                                                                     |
| 6   | `0006_vc_vp_reseed_persistence`          | Seed batch tracking                            | issued_presentations, vc_vp_seed_batches                                                                                                                                                                                  |
| 7   | `0007_maker_checker_issuance_requests`   | Maker/Checker workflow                         | ALTER users ADD credentialEntitlements, systemRole enum expansion, CREATE credential_issuance_requests                                                                                                                    |
| 8   | `0008_vc_document_storage_taxonomy`      | Document taxonomy                              | ADD documentCategory, documentSubcategory, storageKey, searchTags to credential_templates and issued_credentials                                                                                                          |
| 9   | `0009_mediumtext_jwt_columns`            | Large JWT storage                              | ALTER sdJwtVc and presentationJwt to MEDIUMTEXT                                                                                                                                                                           |
| 10  | `0010_vc_schema_versioning`              | VC schema registry                             | vc_schema_registry, schemaVersion columns                                                                                                                                                                                 |
| 11  | `0011_shl_transport_vc_trust_layer`      | SHL production transport and trust layer       | smart_health_links manifest/passcode/VC/VP fields, shl_files, shl_manifest_versions, expanded shl_access_logs                                                                                                             |
| 12  | `0012_care_transition_partner_portal`    | Care transition and partner portal             | care transition cases, document bundles/files, partner source connectors, care packages                                                                                                                                   |
| 13  | `0013_service_readiness_wallet_requests` | Service readiness and Wallet document requests | service_readiness_checks, wallet_document_requests                                                                                                                                                                        |

---

## 7. Seed/Reseed Strategy

### 7.1 Canonical Hospital Source

The canonical hospital definitions live in `server/portability/seedData.ts` as `TRUSTCARE_DEMO_HOSPITALS`. Both `server/seed.ts` and `server/portability/reseed.ts` reference this single source.

### 7.2 Seed Data Generation

The `generateTrustcareDemoSeed()` function creates:

- **12 patients per hospital** (configurable via `patientsPerHospital`)
- 4 base patients (Thai nationals + international) + 8 extended patients
- Each patient gets conditions, allergies, and document tags
- Patients are assigned to hospitals with DID keys

### 7.3 Reseed Orchestration (`reseedTrustcareVcVpDatabase`)

The reseed process:

1. **Batch tracking** — Creates a `vc_vp_seed_batches` record with `batchId = urn:trustcare:seed:batch:{hash}`
2. **Hospital upsert** — Inserts/updates hospitals with DID, code, and metadata
3. **Template creation** — Creates credential templates for each document type per hospital
4. **Staff creation** — Creates demo staff users (seed-maker-_, seed-checker-_) with appropriate roles
5. **Patient creation** — Creates user records with patient role and DID keys (seed-patient-\*)
6. **Credential issuance** — Issues VCs for each patient based on their tags
7. **Wallet cards** — Creates wallet entries for each issued credential
8. **Presentations** — Creates VP packages for portability scenarios
9. **SHL packages** — Creates Smart Health Link packages for referral, cross-border, e-claim, medical tourist, discharge, patient summary, and self-share scenarios
10. **Trust registry** — Registers hospital DIDs as trusted issuers
11. **Audit trail** — Logs all seed operations

### 7.4 Demo Login Users

The `server/seed.ts` creates demo login users that can be used without OAuth:

| openId             | Name                 | systemRole           | additionalRoles |
| ------------------ | -------------------- | -------------------- | --------------- |
| demo-sysadmin-001  | นพ.สมชาย ระบบดี      | system_admin         | —               |
| demo-hospadmin-001 | นางวิภา บริหารเก่ง   | hospital_admin       | —               |
| demo-doctor-001    | นพ.ธนวัฒน์ รักษาดี   | doctor               | issuer_checker  |
| demo-doctor-002    | พญ.สุภาพร ใจดี       | doctor               | —               |
| demo-nurse-001     | นางสาวพิมพ์ใจ ดูแลดี | nurse                | issuer_maker    |
| demo-nurse-002     | นายอนุชา ช่วยเหลือ   | nurse                | —               |
| demo-engineer-001  | นายปิยะ เชื่อมต่อดี  | integration_engineer | —               |
| demo-patient-001   | นายสมศักดิ์ สุขภาพดี | patient              | —               |
| demo-patient-002   | นางสาวนภา แข็งแรง    | patient              | —               |
| demo-patient-003   | นายวิชัย ใส่ใจสุขภาพ | patient              | —               |

### 7.5 Patient Data Binding

Demo patients (demo-patient-001/002/003) are bound to seed patient data from TCC/TCP/TCM respectively:

| Demo Patient              | Seed Source           | Hospital | Wallet Cards | Credentials |
| ------------------------- | --------------------- | -------- | ------------ | ----------- |
| demo-patient-001 (id=414) | seed-patient-tcc-p001 | TCC      | 16           | 16          |
| demo-patient-002 (id=415) | seed-patient-tcp-p001 | TCP      | 15           | 15          |
| demo-patient-003 (id=416) | seed-patient-tcm-p001 | TCM      | 15           | 15          |

### 7.6 Reseed Idempotency

- Reseeding checks for existing `batchId` in `vc_vp_seed_batches`
- If `resetExistingSeed = true`, deletes credentials with `urn:trustcare:seed` prefix before reseeding
- Previous seed SHLs with `urn:trustcare:seed:shl:` manifest tokens are revoked before new active SHLs are created
- Batch hash is computed from `{patientsPerHospital, hospitals, documents, version}` for deterministic identification

---

## 8. DID Policy

### 8.1 DID Methods

| Method    | Usage                         | Format                                  | Example                                  |
| --------- | ----------------------------- | --------------------------------------- | ---------------------------------------- |
| `did:web` | Hospital/Organization issuers | `did:web:{domain}:hospital:{code}`      | `did:web:trustcare.network:hospital:tcc` |
| `did:web` | Network-level issuer          | `did:web:{domain}`                      | `did:web:trustcare.network`              |
| `did:key` | Patient holders               | `did:key:z{base58(ed25519-multicodec)}` | `did:key:z6Mk...`                        |

### 8.2 Key Management

| Environment | Algorithm     | Key Source                                    |
| ----------- | ------------- | --------------------------------------------- |
| Development | HMAC-SHA256   | `TRUSTCARE_VC_SIGNING_SECRET` or `JWT_SECRET` |
| Production  | ES256 (P-256) | Per-hospital key pair in trust registry       |

### 8.3 Trust Domain

- Default domain: `trustcare.network`
- Hospital DID resolution: `https://{domain}/hospital/{code}/.well-known/did.json`
- Portability endpoint: `https://{domain}/api/portability/{code}`

---

## 9. Smart Health Links Transport + VC/VP Trust Layer

TrustCare uses SHL as the transport/share-link mechanism and VC/VP as the trust layer around the SHL manifest.

The `shlink:/...` payload contains the manifest URL, content encryption key, expiry, flags, and optional label. The manifest endpoint returns standard SHL file entries such as `application/fhir+json`, with encrypted embedded JWE content. TrustCare-specific proof is carried in the `trustcare` manifest extension through `ShlManifestCredential`, holder VP, manifest hash, source FHIR bundle hash, consent reference, and access policy metadata.

Runtime flow:

1. Maker or holder action creates a `smart_health_links` row, `shl_files` encrypted FHIR bundle, and `shl_manifest_versions` snapshot.
2. Staff-created SHL packages for hospital documents enter Maker/Checker review as `shl_manifest` requests.
3. Checker approval issues `ShlManifestCredential`, creates a holder VP, activates the SHL, and links `manifestCredentialId` plus `presentationId`.
4. Public viewers call `/api/shl/manifest/:manifestToken` with recipient metadata and passcode. The access resolver enforces expiry, revocation, max access, passcode lockout, and consent scope.
5. Successful access returns decrypted FHIR Bundle entries plus optional VC proof for downstream verification.

---

## 10. Source of Truth / HIS / Legacy Sync-Back

### 10.1 Source of Truth Connectors

Each hospital has two standard connectors:

| Connector          | Kind           | Supported Inputs                                                  |
| ------------------ | -------------- | ----------------------------------------------------------------- |
| `{code}-his-rest`  | HIS REST API   | patient, encounter, diagnosis, allergy, medication, lab, document |
| `{code}-legacy-db` | Legacy DB View | patient_master, opd_visit, dx, rx, lis_result                     |

### 10.2 Supported Source Formats

| Format        | Parser                                          | Notes                                                           |
| ------------- | ----------------------------------------------- | --------------------------------------------------------------- |
| `db_view`     | `legacyDbViewToHisPayload()`                    | Maps patient_master, opd_visit tables                           |
| `csv`         | `parseCsv()` + `reviewCsvForCanonicalMapping()` | Requires: hospital_code, hn, full_name_th, birth_date, visit_no |
| `hl7v2`       | Direct mapping                                  | HL7 v2 message segments                                         |
| `rest_api`    | Direct FHIR-like JSON                           | HIS REST API response                                           |
| `fhir_native` | Pass-through                                    | Already FHIR R4                                                 |
| `document`    | Document extraction                             | Scanned/uploaded documents                                      |

### 10.3 Sync-Back Architecture

After VC issuance, the system can sync data back to legacy systems via `SyncBackPlan` with targets: FHIR REST, HL7v2 broker, Database outbox, or Manual review queue.

---

## 11. Document Taxonomy

### 11.1 Document Categories

| Category Key              | Thai                         | English                     | Retention Class |
| ------------------------- | ---------------------------- | --------------------------- | --------------- |
| `identity_and_access`     | ตัวตนและสิทธิ์เข้าถึง        | Identity and Access         | long_lived      |
| `clinical_summary`        | สรุปและความเสี่ยงทางคลินิก   | Clinical Summary and Risk   | clinical        |
| `medication_and_pharmacy` | ยาและเภสัชกรรม               | Medication and Pharmacy     | clinical        |
| `diagnostics_and_results` | ผลตรวจและวินิจฉัย            | Diagnostics and Results     | clinical        |
| `care_transition`         | ส่งต่อและเปลี่ยนผ่านการดูแล  | Care Transition             | clinical        |
| `claims_and_finance`      | เคลมและการเงิน               | Claims and Finance          | financial       |
| `medical_tourism`         | ผู้ป่วยต่างชาติและการเดินทาง | Medical Tourism             | administrative  |
| `sharing_and_sync`        | การแชร์และซิงก์ข้อมูล        | Sharing and Synchronization | audit           |
| `operations`              | ปฏิบัติการและนัดหมาย         | Operations                  | operational     |

### 11.2 Credential Validity Periods

| Document Type                                                        | Validity (Days) |
| -------------------------------------------------------------------- | --------------- |
| prescription, pharmacy_dispense                                      | 30              |
| medical_certificate, lab_result, diagnostic_report                   | 90              |
| consent_receipt, insurance_eligibility, claim_package, claim_receipt | 180             |
| All others                                                           | 365             |

### 11.3 Context-Based Validity Override

| Context                                              | Validity (Days) |
| ---------------------------------------------------- | --------------- |
| `emergency`                                          | 1               |
| `treatment` / `self_share` / `cross_branch_referral` | 14              |
| `cross_border` / `medical_tourist`                   | 30              |
| `e_claim`                                            | 90              |

---

## 12. Consent & Access Policy

### 12.1 Portability Contexts

| Context                 | Purpose                | Allowed Scopes                                                                                                   |
| ----------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `treatment`             | Direct patient care    | Patient.read, Condition.read, AllergyIntolerance.read, Medication.read, Observation.read, DocumentReference.read |
| `cross_branch_referral` | Inter-branch referral  | Same as treatment + ServiceRequest.read                                                                          |
| `cross_border`          | International referral | Same as referral                                                                                                 |
| `e_claim`               | Insurance claim        | Patient.read, Coverage.read, Claim.read, Condition.read, Procedure.read, Encounter.read                          |
| `medical_tourist`       | Medical tourism        | Treatment scopes + Coverage.read                                                                                 |
| `emergency`             | Emergency access       | Patient.read, AllergyIntolerance.read, Medication.read, Condition.read                                           |
| `self_share`            | Patient self-sharing   | Same as treatment                                                                                                |

### 12.2 Break-Glass Emergency Access

When `context = "emergency"` and a `breakGlassReason` is provided, the system grants full emergency scopes regardless of consent status, but logs the access with the reason for audit.

---

## 13. File Structure Reference

```
trustcare-hospital-network/
├── docs/                          ← Architecture documentation
│   ├── ARCHITECTURE.md            ← This file
│   ├── CONTRIBUTING.md            ← Developer contribution guide
│   ├── SHL_CONTEXT_VERSIONING.md  ← SHL versioning spec
│   └── VC_UNIQUENESS_RULES.md     ← VC deduplication rules
├── drizzle/
│   ├── schema.ts                  ← 59 table definitions + types
│   ├── relations.ts               ← Drizzle relation definitions
│   └── meta/_journal.json         ← Migration ordering metadata
├── server/
│   ├── _core/                     ← Framework plumbing (DO NOT EDIT)
│   ├── portability/               ← VC/VP engine (17 modules)
│   ├── scheduledHandlers/         ← Periodic task handlers
│   │   └── consentExpiry.ts       ← Consent expiry reminder notifications
│   ├── routers.ts                 ← tRPC procedures (29 routers)
│   ├── uploadRoute.ts             ← Express multipart file upload for bundles
│   ├── db.ts                      ← Database query helpers
│   ├── seed.ts                    ← Demo user + hospital seeding
│   └── storage.ts                 ← S3 storage helpers
├── client/
│   ├── src/pages/                 ← 36 page components
│   ├── src/components/            ← 22 reusable UI components (shadcn/ui + custom)
│   └── src/lib/trpc.ts            ← tRPC client binding
├── shared/
│   ├── rolePolicy.ts             ← Role authorization logic
│   ├── menuConfig.ts             ← Menu visibility per role
│   ├── const.ts                   ← Shared constants
│   └── types.ts                   ← Shared type definitions
├── e2e/
│   └── portability-flow.e2e.test.ts ← End-to-end portability test
├── references/                    ← Research docs and runbooks
└── package.json                   ← Dependencies and scripts
```

---

## 14. Frontend Pages (34 Pages)

| Page                 | Route               | Purpose                                                                              |
| -------------------- | ------------------- | ------------------------------------------------------------------------------------ |
| Home                 | `/`                 | Landing page with demo login                                                         |
| Dashboard            | `/dashboard`        | Main dashboard overview                                                              |
| Wallet               | `/wallet`           | Patient health card wallet                                                           |
| PrepareForService    | `/prepare-service`  | Service readiness cockpit, document request wizard, contextual consent, VP packet QR |
| SmartHealthLinks     | `/shl`              | SHL management                                                                       |
| ShlViewer            | `/shl-viewer`       | Public SHL viewer                                                                    |
| Consent              | `/consent`          | Consent management (incl. expiry alerts)                                             |
| MakerQueue           | `/maker-queue`      | Credential request submission                                                        |
| CheckerQueue         | `/checker-queue`    | Credential approval queue                                                            |
| Issuer               | `/issuer`           | Credential issuance                                                                  |
| CredentialDetail     | `/issuer/:id`       | Single credential view                                                               |
| Verifier             | `/verifier`         | Credential verification                                                              |
| PortabilityWorkbench | `/portability`      | VC/VP workbench + DQI scoring                                                        |
| Hospitals            | `/hospitals`        | Hospital management                                                                  |
| Users                | `/users`            | User management                                                                      |
| TrustRegistry        | `/trust-registry`   | Trust registry management                                                            |
| CrossBorder          | `/cross-border`     | Cross-border referrals                                                               |
| International        | `/international`    | Medical tourism                                                                      |
| ClaimCenter          | `/claim-center`     | Insurance claims workbench (real DB)                                                 |
| ClaimDetail          | `/claim-center/:id` | Claim detail with timeline, documents, FHIR, payer response, payment tabs            |
| ClaimAnalytics       | `/claim-analytics`  | Claim analytics dashboard                                                            |
| ServiceVerify        | `/service-verify`   | Service verification and check-in                                                    |
| Integration          | `/integration`      | System integration                                                                   |
| Terminology          | `/terminology`      | Terminology mappings                                                                 |
| FhirMapping          | `/fhir-mapping`     | FHIR field mappings                                                                  |
| PatientIdentity      | `/patient-identity` | MPI management                                                                       |
| PatientProfile       | `/profile`          | Patient photo upload & profile                                                       |
| Referral             | `/referral`         | Referral management                                                                  |
| Audit                | `/audit`            | Audit trail                                                                          |
| ExecutiveDashboard   | `/executive`        | Executive analytics                                                                  |
| Settings             | `/settings`         | System settings                                                                      |
| PartnerWizard        | `/partner-wizard`   | Partner onboarding                                                                   |
| PartnerPortal        | `/partner-portal`   | Partner API layer, document exchange, care packages                                  |
| AdapterSdk           | `/adapter-sdk`      | Adapter SDK docs                                                                     |
| ComponentShowcase    | `/components`       | UI component showcase                                                                |
| NotFound             | `*`                 | 404 page                                                                             |

---

## 15. tRPC Routers (29 Routers)

| Router                | Purpose                                    | Key Procedures                                                                                                                                                                                                                                                                              |
| --------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth`                | Authentication, demo login, role switching | me, logout, getDemoUsers, switchRole                                                                                                                                                                                                                                                        |
| `seed`                | Database seeding                           | seedDatabase                                                                                                                                                                                                                                                                                |
| `makerChecker`        | Credential workflow                        | submitRequest, approveRequest, rejectRequest                                                                                                                                                                                                                                                |
| `hospital`            | Hospital CRUD                              | list, create, update                                                                                                                                                                                                                                                                        |
| `credential`          | Credential management                      | list, getById, revoke                                                                                                                                                                                                                                                                       |
| `wallet`              | Patient wallet and service readiness       | listCards, getCard, readiness, documentRequests, requestDocument, buildServicePacket                                                                                                                                                                                                        |
| `verifier`            | Credential verification                    | verify, verifyQrScan                                                                                                                                                                                                                                                                        |
| `consent`             | Consent management                         | listPolicies, grantConsent, revokeConsent, expiringWithinDays                                                                                                                                                                                                                               |
| `referral`            | Referrals                                  | create, list, accept                                                                                                                                                                                                                                                                        |
| `fhir`                | FHIR mappings                              | getMappings, updateMapping                                                                                                                                                                                                                                                                  |
| `terminology`         | Code mappings                              | list, create, update                                                                                                                                                                                                                                                                        |
| `audit`               | Audit trail                                | list, getEvent                                                                                                                                                                                                                                                                              |
| `notification`        | Notifications                              | list, markRead                                                                                                                                                                                                                                                                              |
| `dashboard`           | Dashboard stats                            | getStats, getCharts                                                                                                                                                                                                                                                                         |
| `users`               | User management                            | list, create, update, delete, uploadPhoto, getPhoto                                                                                                                                                                                                                                         |
| `patientIdentity`     | MPI                                        | search, link, unlink                                                                                                                                                                                                                                                                        |
| `integration`         | Adapters                                   | listAdapters, createAdapter, healthCheck                                                                                                                                                                                                                                                    |
| `trustRegistry`       | Trust registry                             | list, create, update, verify                                                                                                                                                                                                                                                                |
| `shl`                 | Smart Health Links                         | create, list, revoke, getManifest                                                                                                                                                                                                                                                           |
| `claim`               | Insurance claims (real DB)                 | listPayers, createPayer, checkEligibility, listEligibility, workbench, listCases, getCase, getClaimDetail, createCase, createReadiness, updateStatus, validate, issueClaimPackageVc, submitToPayer, recordPayerResponse, recordPayment, publicApiExamples, analytics                         |
| `international`       | Medical tourism                            | createCase, listCases                                                                                                                                                                                                                                                                       |
| `crossBorderReferral` | Cross-border                               | create, list, accept                                                                                                                                                                                                                                                                        |
| `careTransition`      | Care transition cases + bundles            | overview, workspace, initializeCase, addDocument, verifyDocument, updateTask, recordDecision, generatePackage, createBundle, getBundles, getBundleWithFiles, addFileToBundle, updateBundleStatus, removeBundleFile, linkVcToFile, verifyBundleVc, generateBundleHash, generateShlFromBundle |
| `partnerPortal`       | Partner API layer                          | dashboard, listConnectors, createConnector, validateConnector, activateConnector, submitCase, sendDocument                                                                                                                                                                                  |
| `portability`         | VC/VP engine                               | createPacket, verify, reseedDb, auditSeedDb, canonicalize (with DQI)                                                                                                                                                                                                                        |
| `executiveDashboard`  | Executive analytics                        | getMetrics, getTrends                                                                                                                                                                                                                                                                       |
| `tao`                 | TAO framework                              | listIssuers, listVerifiers, listPolicies                                                                                                                                                                                                                                                    |
| `schemaRegistry`      | VC schema versions                         | list, getActive, register                                                                                                                                                                                                                                                                   |

---

## 16. Role Policy Engine (`shared/rolePolicy.ts`)

The role policy module centralizes all authorization logic for the multi-role system.

### 16.1 Core Concepts

| Concept                  | Description                                                                |
| ------------------------ | -------------------------------------------------------------------------- |
| `systemRole`             | Primary role assigned at user creation                                     |
| `additionalRoles`        | Supplementary roles from `user_roles` table (issuer_maker, issuer_checker) |
| `activeRole`             | The role the user is currently operating as (stored in cookie)             |
| `credentialEntitlements` | JSON field specifying which VC types they can make/check                   |

### 16.2 Patient Restriction Rules

1. If `systemRole === 'patient'`, `additionalRoles` are filtered to exclude `issuer_maker` and `issuer_checker`.
2. `credentialEntitlements.makerTypes` and `checkerTypes` are forced to empty arrays for patients.
3. Staff users can switch to `patient` activeRole to view the patient wallet.
4. Patients cannot switch to any staff role.

---

## 17. Testing

### 17.1 Test Suite

| Category         | Files                          | Command         |
| ---------------- | ------------------------------ | --------------- |
| Unit tests       | 17 files in `server/*.test.ts` | `pnpm test`     |
| E2E tests        | 1 file in `e2e/*.test.ts`      | `pnpm test:e2e` |
| TypeScript check | —                              | `pnpm check`    |
| Full CI          | —                              | `pnpm ci`       |

### 17.2 Unit Test Files

- `auth.logout.test.ts` — Auth flow
- `bundle-upload.test.ts` — Document bundle CRUD and upload
- `care-transition.test.ts` — Care transition workflow
- `claimAnalytics.test.ts` — Claim analytics aggregation
- `demo-login.test.ts` — Demo login system
- `maker-checker.test.ts` — Credential workflow
- `multi-role.test.ts` — Multi-role switching
- `portability.test.ts` — VC/VP issuance, verification, and DQI scoring
- `qrScanner.test.ts` — QR code scanning
- `role-guard.test.ts` — Role-based access guards
- `role-menu.test.ts` — Menu visibility per role
- `role-policy.test.ts` — Role policy engine
- `role-switch.test.ts` — Role switching
- `schema-registry.test.ts` — Schema versioning
- `shl.test.ts` — Smart Health Links
- `tao-consent.test.ts` — TAO trust + consent
- `trustcare.test.ts` — General system tests

### 17.3 E2E Test

The `portability-flow.e2e.test.ts` tests the full VC/VP lifecycle:

1. Issue a credential via `createPacket`
2. Verify the VP via `portability.verify`
3. Verify individual VC via `portability.verify`
4. Issue clinical VC via `issueMedicalCertificateVc`
5. Verify clinical VC against trust registry

---

## 18. Security Considerations

- All VC signing uses cryptographic algorithms (HMAC-SHA256 in dev, ES256 in production)
- Consent is enforced at the policy layer before any credential issuance
- Break-glass access is logged with mandatory reason
- Credential revocation is tracked via `credential_status_events`
- Trust registry verification requires `trustLevel = "verified"` for internal issuers
- TAO framework uses multi-level trust (accredited, recognized, self_declared)
- All mutations are logged in `audit_events` with actor, action, and resource details
- Credential previews display "สำเนา / COPY" watermark to prevent screenshot-based forgery
- Patient photo uploads are validated (max 5MB, image/\* MIME types only) and stored in S3
- Consent expiry reminders run on a scheduled heartbeat (daily) to notify patients 7 days before expiration
- Claim analytics data is aggregated server-side; no raw claim data is exposed to the frontend

---

## 19. Schema Versioning for VC/VP

Credential schemas evolve over time. The schema versioning system tracks which version of a credential schema was used to issue each VC, enabling forward-compatible verification and migration-aware reseeding.

### 19.1 Schema Registry Table (`vc_schema_registry`)

| Column         | Type         | Description                                 |
| -------------- | ------------ | ------------------------------------------- |
| id             | int (PK)     | Auto-increment                              |
| credentialType | varchar(100) | e.g., `patient_summary`, `prescription`     |
| version        | varchar(20)  | Semantic version, e.g., `1.0.0`, `1.1.0`    |
| jsonSchema     | JSON         | The JSON Schema definition for this version |
| changelog      | text         | Human-readable description of changes       |
| isActive       | boolean      | Whether this is the current active version  |
| createdAt      | timestamp    | When this version was registered            |

### 19.2 Integration Points

1. `issued_credentials.schemaVersion` — Records which schema version was used at issuance time.
2. `credential_templates.schemaVersion` — The current default version for new issuances.
3. Verification checks the credential's `schemaVersion` against the registry.
4. Reseed uses the latest active schema version for each credential type.

---

## 20. Patient Photo & Avatar System

### 20.1 Photo Upload Flow

```
Patient Profile Page → Upload Photo (max 5MB, image/*)
  → Frontend base64 encodes → trpc.users.uploadPhoto
  → Server validates + stores via storagePut()
  → Returns S3 URL → Saved in users.avatarUrl
```

### 20.2 Avatar Fallback Hierarchy

When rendering credentials, the system selects the patient/practitioner photo in this order:

1. **Uploaded photo** — `patientPhotoUrl` from `users.avatarUrl` (S3)
2. **Role-based AI avatar** — Pre-generated realistic photos per role:
   - `patientMale` / `patientFemale` — Thai patients (~40 years old)
   - `doctorMale` / `doctorFemale` — Thai doctors in white coats
   - `nurse` — Thai female nurse in white uniform
   - `pharmacist` — Thai male pharmacist in lab coat
   - `radiologist` — Thai male radiologist with imaging equipment
   - `medTech` — Thai female medical technologist in lab coat
3. **Dicebear fallback** — Generated cartoon avatar (last resort, `onError` handler)

### 20.3 Practitioner Role Detection

The `PractitionerSection` component auto-selects the appropriate avatar based on:

- Name prefix: พญ./นพ. → doctor, พย. → nurse, ภก. → pharmacist
- Title keywords: รังสี → radiologist, เทคนิค → medTech
- Gender detection from prefix for male/female doctor variants

---

## 21. Data Quality Index (DQI) Scoring

### 21.1 Score Calculation

`calculateDqiScore(issues: DataQualityIssue[])` produces:

```typescript
interface DataQualityScore {
  overall: number; // 0–100
  grade: "A" | "B" | "C" | "D" | "F";
  completeness: number; // 0–100
  conformance: number; // 0–100
  consistency: number; // 0–100
  issueCount: { error: number; warning: number; info: number };
}
```

### 21.2 Grading Scale

| Grade | Score Range | Meaning                     |
| ----- | ----------- | --------------------------- |
| A     | 90–100      | Excellent data quality      |
| B     | 75–89       | Good, minor issues          |
| C     | 60–74       | Acceptable, needs attention |
| D     | 40–59       | Poor, significant issues    |
| F     | 0–39        | Failing, critical problems  |

### 21.3 Penalty Weights

- `error` severity: -10 points per issue
- `warning` severity: -5 points per issue
- `info` severity: -1 point per issue

DQI score is returned as part of `canonicalizeHisPayload()` result and displayed in the Portability Workbench.

---

## 22. Consent Expiry Reminder System

### 22.1 Scheduled Handler

Endpoint: `POST /api/scheduled/consent-expiry-check`

Authenticated via `x-manus-heartbeat-token` header (Manus Heartbeat system).

### 22.2 Logic Flow

```
Daily heartbeat trigger
  → Query consent_records WHERE expiresAt BETWEEN now AND now+7days
  → For each expiring consent:
    → Check if reminder already sent (notifications table)
    → If not sent: createNotification(type: 'consent_expiry_reminder')
  → Return { checked, reminded, alreadyNotified }
```

### 22.3 Frontend Display

The Consent page shows a `ConsentExpiryAlert` banner when there are consents expiring within 7 days, with count and link to review.

---

## 23. Claim Analytics Dashboard

### 23.1 Aggregation Procedure

`trpc.claim.analytics` returns:

```typescript
{
  totalClaims: number;
  approvedCount: number;
  rejectedCount: number;
  pendingCount: number;
  approvalRate: number; // percentage
  avgProcessingDays: number;
  byStatus: {
    (status, count);
  }
  [];
  byType: {
    (type, count);
  }
  [];
  monthlyTrend: {
    (month, total, approved, rejected);
  }
  [];
  topRejectionReasons: {
    (reason, count);
  }
  [];
}
```

### 23.2 Dashboard Visualizations

- KPI cards: total claims, approval rate, avg processing time, pending count
- Status breakdown pie chart (CSS-based)
- Monthly trend bar chart
- Type distribution and top rejection reasons tables

---

## 24. Credential Watermark System

All credential previews (in Wallet, CredentialDetail, and Issuer views) display a diagonal watermark overlay:

- Text: "สำเนา / COPY"
- Style: Rotated -30°, semi-transparent (opacity 0.08), repeated pattern
- Purpose: Prevent screenshot-based credential forgery
- Implementation: `WatermarkOverlay` component wraps the credential card with `pointer-events: none`

---

## 25. File Bundle System (v3.7)

The File Bundle system enables structured document exchange per care transition case, supporting multiple bundles per case with mixed file types (PDF, Word, images, medical files, VC/VP credentials).

### 25.1 Database Schema

| Table              | Purpose                          | Key Columns                                                                                         |
| ------------------ | -------------------------------- | --------------------------------------------------------------------------------------------------- |
| `document_bundles` | Bundle metadata                  | id, caseType, caseId, title, description, bundleType, status, integrityHash, createdBy, createdAt   |
| `bundle_files`     | Individual files within a bundle | id, bundleId, fileName, fileKey, mimeType, fileSize, fileType, vcCredentialId, metadata, uploadedAt |

**Bundle Types:** `clinical`, `administrative`, `imaging`, `lab_results`, `consent_forms`, `insurance`, `referral_package`, `discharge_summary`, `mixed`

**File Types:** `pdf`, `word`, `image`, `dicom`, `lab_report`, `prescription`, `vc_credential`, `vp_presentation`, `fhir_bundle`, `other`

**Status Workflow:** `draft` → `submitted` → `under_review` → `accepted` | `rejected` | `archived`

### 25.2 Upload Architecture

```
BundleManager (React)                  Express Upload Route
  │                                      │
  ├─ Drag-drop / file picker              │
  ├─ FormData (multipart/form-data)  ────▶ POST /api/bundles/:bundleId/upload
  │                                      ├─ multer (10 files max, 50MB each)
  │                                      ├─ authenticateRequest (session cookie)
  │                                      ├─ storagePut → S3
  │                                      ├─ addFileToBundle → DB
  │                                      └─ 200 { files: [...] }
  │
  ├─ Progress bar (XHR onUploadProgress)
  └─ Invalidate tRPC cache on success
```

### 25.3 Trust Layer Integration

| Procedure                              | Purpose                                                            |
| -------------------------------------- | ------------------------------------------------------------------ |
| `careTransition.linkVcToFile`          | Link a bundle file to an existing issued_credentials record        |
| `careTransition.verifyBundleVc`        | Verify VC/VP files via trust registry (DID → issuer → trust level) |
| `careTransition.generateBundleHash`    | Compute SHA-256 integrity hash over all file hashes in a bundle    |
| `careTransition.generateShlFromBundle` | Create encrypted FHIR Bundle from selected files → SHL link        |

### 25.4 Inline Preview System

The BundleManager component provides inline document preview without download:

| File Type                               | Preview Method                         | Features                                                |
| --------------------------------------- | -------------------------------------- | ------------------------------------------------------- |
| PDF (`application/pdf`)                 | `<iframe>` embed                       | Full-page rendering, fallback download link             |
| Images (PNG, JPEG, GIF, WebP, SVG, BMP) | `<img>` with zoom controls             | Zoom 25%–400%, rotation (90° increments), fit-to-screen |
| VC/VP credentials                       | Badge display with verification status | Trust registry check, issuer DID resolution             |
| Unsupported types                       | Download link with file info           | Graceful fallback with toast notification               |

### 25.5 Standards Alignment

The File Bundle system aligns with established healthcare interoperability standards:

- **IHE XDS.b** — Bundle = SubmissionSet, S3 = Document Repository, DB = Document Registry
- **FHIR DocumentReference** — Metadata mapping (content.attachment ↔ bundle_files columns)
- **IHE MHD** — Upload endpoint mirrors "Provide Document Bundle" transaction
- **SMART Health Links** — Bundle → SHL generation for secure external sharing
- **W3C VC Data Model** — VC/VP files linked to credential IDs for trust verification

See [FILE_BUNDLE_STANDARDS.md](./FILE_BUNDLE_STANDARDS.md) for detailed standards research.

### 25.6 Frontend Components

| Component                     | Location                                     | Purpose                                                                                   |
| ----------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `BundleManager`               | `components/BundleManager.tsx`               | Full bundle CRUD: create, upload, expand/collapse, preview, status management             |
| `ReferralCreationWizard`      | `components/ReferralCreationWizard.tsx`      | Multi-step referral creation (patient, destination, reason, documents, consent)           |
| `CrossBorderCreateWizard`     | `components/CrossBorderCreateWizard.tsx`     | Cross-border case creation (direction, partner, patient, documents, translation, consent) |
| `PartnerTrustVerification`    | `components/PartnerTrustVerification.tsx`    | DID-based partner trust verification panel                                                |
| `InternationalWorkflowPanels` | `components/InternationalWorkflowPanels.tsx` | Medical tourism workflow (Document Intake, Clinical Pre-review, Financial, Discharge)     |
| `CareTransitionWorkspace`     | `components/CareTransitionWorkspace.tsx`     | Tabbed workspace (Documents, Bundles, Tasks, Decisions, Packages, Timeline)               |

---

## References

- [W3C Verifiable Credentials Data Model v2.0](https://www.w3.org/TR/vc-data-model-2.0/)
- [SMART Health Links Protocol](https://docs.smarthealthit.org/smart-health-links/spec/)
- [TrustCare SHL Context Versioning](./SHL_CONTEXT_VERSIONING.md)
- [TrustCare System Realignment Handoff](./TRUSTCARE_SYSTEM_REALIGNMENT_HANDOFF.md)
- [Care Transition and Partner Portal](./CARE_TRANSITION_PARTNER_PORTAL.md)
- [File Bundle Standards Research](./FILE_BUNDLE_STANDARDS.md)
- [Manus Care Transition Handoff](./MANUS_CARE_TRANSITION_HANDOFF.md)
- [TrustCare VC Uniqueness Rules](./VC_UNIQUENESS_RULES.md)
- [SD-JWT-VC (IETF Draft)](https://datatracker.ietf.org/doc/draft-ietf-oauth-sd-jwt-vc/)
- [HL7 FHIR R4 International Patient Summary](http://hl7.org/fhir/uv/ips/)
- [IHE XDS.b Cross-Enterprise Document Sharing](https://profiles.ihe.net/ITI/TF/Volume1/ch-10.html)
- [IHE MHD Mobile access to Health Documents](https://profiles.ihe.net/ITI/MHD/)
- [FHIR DocumentReference Resource](https://build.fhir.org/documentreference.html)
- [DID Core Specification](https://www.w3.org/TR/did-core/)
- [did:web Method](https://w3c-ccg.github.io/did-method-web/)
- [did:key Method](https://w3c-ccg.github.io/did-method-key/)
- [ETSI Trusted Lists](https://www.etsi.org/deliver/etsi_ts/119600_119699/119612/02.01.01_60/ts_119612v020101p.pdf)
- [GDHCN Trust Network](https://smart.who.int/trust)

---

## 26. Performance Optimization (v2.6)

The application employs multiple strategies to minimize time-to-interactive and reduce bandwidth consumption.

### 25.1 Code Splitting & Lazy Loading

All 31 page-level components are imported via `React.lazy()` with a shared `<Suspense>` boundary in `App.tsx`. This splits the monolithic bundle into per-route chunks that load on demand.

Vite manual chunks further isolate heavy vendor libraries:

| Chunk Name     | Contents                                                          | Approx. Size |
| -------------- | ----------------------------------------------------------------- | ------------ |
| `vendor-react` | react, react-dom, wouter, react-hook-form                         | ~140 KB      |
| `vendor-trpc`  | @trpc/client, @trpc/react-query, @tanstack/react-query, superjson | ~90 KB       |
| `vendor-ui`    | @radix-ui/\*, lucide-react, recharts, sonner                      | ~430 KB      |

Result: initial JS payload reduced from ~2.3 MB (single chunk) to ~660 KB main + lazy chunks.

### 25.2 Image Lazy Loading

All below-the-fold `<img>` elements use the native `loading="lazy"` attribute:

- **CredentialRenderer.tsx** — patient avatar photos, practitioner photos (4 img tags)
- **CredentialDetail.tsx** — QR code image in verification dialog
- **Wallet.tsx** — VP QR code image in presentation dialog

This prevents the browser from fetching avatar images and QR data URLs until they scroll into the viewport.

### 25.3 Service Worker (Production Only)

A lightweight Service Worker (`client/public/sw.js`) is registered in production builds via `main.tsx`. It implements:

- **Cache-first** for `/manus-storage/*` (avatar images, uploaded assets), `/assets/vendor-*` (vendor chunks), and web fonts (`.woff2`)
- **Network-first** (pass-through) for API calls (`/api/`, `/trpc/`), HMR updates, and debug collectors
- **Cache versioning** via `CACHE_NAME` constant — old caches are purged on activation
- **Graceful degradation** — registration failure is non-critical; the app functions without SW

The SW does not intercept navigation requests or app JS chunks, ensuring fresh deployments are always picked up immediately.

### 25.4 Performance Budget

| Metric                   | Target       | Current               |
| ------------------------ | ------------ | --------------------- |
| Initial JS (gzipped)     | < 300 KB     | ~210 KB               |
| Time to Interactive      | < 3s (3G)    | ~2.5s                 |
| Avatar image size        | < 25 KB each | ~18 KB (400×400 JPEG) |
| Largest Contentful Paint | < 2.5s       | ~2s (cached)          |

---

## 26. Service Readiness Module (v3.8.0)

The Service Readiness module implements a **Wallet-first service preparation** paradigm. Before a patient arrives at a service point, the system assesses whether their Patient Wallet contains the minimum verified documents needed for that specific service context. This reduces registration friction, eliminates redundant history requests, and enables pre-built Verifiable Presentations (VP) with QR codes for instant verification.

### 26.1 Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    PREPARE FOR SERVICE (Frontend)                     │
│  ┌──────────────┐  ┌────────────────────┐  ┌─────────────────────┐  │
│  │Context Picker│  │ServiceReadinessPanel│  │DocumentRequestWizard│  │
│  │ (7 contexts) │  │ (score + checklist) │  │ (request missing)   │  │
│  └──────────────┘  └────────────────────┘  └─────────────────────┘  │
│  ┌──────────────┐  ┌────────────────────┐  ┌─────────────────────┐  │
│  │VP Packet     │  │ContextualConsent   │  │ Trust View (partner │  │
│  │Builder + QR  │  │Dialog (pre-share)  │  │  verification)      │  │
│  └──────────────┘  └────────────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                              │ tRPC
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    BACKEND (wallet router)                            │
│  wallet.readiness        → assessReadiness(cards, context)           │
│  wallet.requestDocument  → create document request (status machine)  │
│  wallet.buildServicePacket → create VP + QR for service point        │
│  wallet.documentRequests → list active requests per context          │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    DATABASE (2 tables)                                │
│  service_readiness_checks  → readiness assessment history            │
│  wallet_document_requests  → document retrieval/import requests      │
└─────────────────────────────────────────────────────────────────────┘
```

### 26.2 Service Contexts (7 Contexts)

| Context             | Label (TH)                  | Label (EN)                  | Required Docs                               | Recommended Docs  |
| ------------------- | --------------------------- | --------------------------- | ------------------------------------------- | ----------------- |
| `opd_visit`         | เตรียมเข้ารับบริการ OPD     | OPD visit readiness         | identity, allergy, medication               | summary, coverage |
| `emergency`         | เหตุฉุกเฉิน                 | Emergency readiness         | identity, allergy, medication, conditions   | (none)            |
| `referral`          | ส่งต่อผู้ป่วย               | Referral readiness          | identity, referral, summary                 | labs, coverage    |
| `cross_border`      | ส่งต่อข้ามเครือข่าย/ข้ามแดน | Cross-network readiness     | identity, referral, summary, consent        | labs              |
| `medical_tourist`   | ผู้ป่วยต่างชาติ             | Medical tourist readiness   | identity, summary, quotation                | guarantee, visa   |
| `insurance_claim`   | เคลม/ประกัน                 | Insurance claim readiness   | identity, coverage, claim                   | summary, receipt  |
| `pharmacy_dispense` | รับยา/ต่อยา                 | Pharmacy dispense readiness | identity, prescription, medication, allergy | dispense          |

### 26.3 Score Calculation

The readiness score uses a weighted formula:

```
score = round((requiredReady/requiredTotal * 0.8 + recommendedReady/recommendedTotal * 0.2) * 100)
```

Where `requiredReady/requiredTotal = 1.0` when `requiredTotal = 0`, and similarly for recommended.

Score thresholds for UI badges:

| Score  | Badge           | Color |
| ------ | --------------- | ----- |
| 100%   | Ready           | Green |
| 60-99% | Almost ready    | Amber |
| 1-59%  | Needs documents | Red   |
| 0%     | Not started     | Gray  |

### 26.4 Document Request Status Machine

```
draft → pending_consent → requested → imported → needs_review → converted_to_vc
                                    ↘ rejected
                                    ↘ cancelled
```

| Status            | Description                                  |
| ----------------- | -------------------------------------------- |
| `draft`           | Request created but not yet sent             |
| `pending_consent` | Awaiting patient consent                     |
| `requested`       | Sent to source system (HIS/partner)          |
| `imported`        | Raw document received                        |
| `needs_review`    | Imported but requires clinical review        |
| `converted_to_vc` | Successfully converted to a Wallet card (VC) |
| `rejected`        | Source system rejected the request           |
| `cancelled`       | Patient or staff cancelled                   |

### 26.5 Source Types

| Source Type           | Description                   | Example            |
| --------------------- | ----------------------------- | ------------------ |
| `his`                 | Hospital Information System   | โรงพยาบาลเดิม HIS  |
| `lis`                 | Laboratory Information System | Lab results        |
| `ris`                 | Radiology Information System  | Imaging reports    |
| `pacs`                | Picture Archiving System      | DICOM images       |
| `hospital_app`        | Hospital mobile app           | Patient portal     |
| `national_app`        | National health app           | หมอพร้อม           |
| `partner_portal`      | Partner organization portal   | Referring hospital |
| `payer`               | Insurance/payer system        | ประกันสังคม        |
| `patient_upload`      | Patient self-upload           | Photo of document  |
| `personal_health_app` | Personal health app           | Apple Health       |
| `other`               | Other source                  | Manual entry       |

### 26.6 VP Service Packet

When readiness score is sufficient, the patient can generate a **VP Service Packet** containing:

1. Selected wallet cards (VCs) matching the context requirements
2. Contextual consent receipt (if cross-border or partner sharing)
3. QR code for instant verification at service point
4. Recipient information (hospital/department/service name)

The VP is signed with the patient's `did:key` and can be verified by any party in the Trust Registry.

### 26.7 Database Tables

**`service_readiness_checks`** — Records each readiness assessment:

| Column           | Type         | Description                       |
| ---------------- | ------------ | --------------------------------- |
| id               | serial       | Primary key                       |
| patientId        | int          | FK → users.id                     |
| context          | varchar(50)  | Service context                   |
| score            | int          | Readiness score (0-100)           |
| requiredReady    | int          | Count of ready required items     |
| requiredTotal    | int          | Total required items              |
| recommendedReady | int          | Count of ready recommended items  |
| recommendedTotal | int          | Total recommended items           |
| missingKeys      | text (JSON)  | Array of missing requirement keys |
| selectedCardIds  | text (JSON)  | Array of card IDs used            |
| vpPacketId       | varchar(100) | VP packet ID if generated         |
| checkedAt        | timestamp    | Assessment timestamp              |

**`wallet_document_requests`** — Tracks document retrieval requests:

| Column          | Type         | Description                             |
| --------------- | ------------ | --------------------------------------- |
| id              | serial       | Primary key                             |
| requestId       | varchar(100) | Unique request identifier               |
| patientId       | int          | FK → users.id                           |
| context         | varchar(50)  | Service context                         |
| documentType    | varchar(100) | Type of document requested              |
| sourceType      | varchar(50)  | Source system type                      |
| sourceName      | varchar(255) | Human-readable source name              |
| status          | varchar(50)  | Current status                          |
| priority        | varchar(20)  | Priority level                          |
| notes           | text         | Staff/patient notes                     |
| importedAt      | timestamp    | When document was received              |
| convertedCardId | int          | FK → wallet_cards.id (after conversion) |
| createdAt       | timestamp    | Request creation time                   |
| updatedAt       | timestamp    | Last status change                      |

### 26.8 Test Coverage

| Test File                          | Tests | Coverage                                                      |
| ---------------------------------- | ----- | ------------------------------------------------------------- |
| `server/serviceReadiness.test.ts`  | 53    | All 7 contexts, score calculation, edge cases, demo scenarios |
| `server/readiness.test.ts`         | 3     | Basic readiness module validation                             |
| `e2e/portability-flow.e2e.test.ts` | 2     | Full VP creation and verification flow                        |

### 26.9 Seed Data (Demo Patients with Incomplete Wallets)

| Patient                 | OpenID           | Context           | Score | Missing Documents                  |
| ----------------------- | ---------------- | ----------------- | ----- | ---------------------------------- |
| นางสาวฮารุกะ ทานากะ     | demo-patient-004 | cross_border      | 40%   | referral, summary, labs            |
| นายวิชัย สมบูรณ์        | demo-patient-005 | pharmacy_dispense | 40%   | prescription, medication, dispense |
| นางพรทิพย์ แก้วมณี      | demo-patient-006 | insurance_claim   | 27%   | coverage, claim, summary, receipt  |
| นายอภิชาติ วงศ์ประเสริฐ | demo-patient-007 | referral          | 27%   | referral, summary, labs, coverage  |
| Mr. David Chen          | demo-patient-008 | medical_tourist   | 53%   | quotation, guarantee, visa         |
| นางสุดา รักษ์ธรรม       | demo-patient-009 | emergency         | 40%   | allergy, medication, conditions    |

---

## 27. Changelog

| Version | Date       | Changes                                                                               |
| ------- | ---------- | ------------------------------------------------------------------------------------- |
| 5.4     | 2026-07-02 | Service Readiness module, wallet document requests, 6 new demo patients, 53 E2E tests |
| 5.3     | 2026-07-01 | Care Transition partner portal, bundle management, SHL from bundles                   |
| 5.2     | 2026-06-30 | Executive dashboard, claim analytics, DICOM viewer                                    |
| 5.1     | 2026-06-29 | TAO Trust Framework, schema registry, consent expiry notifications                    |
| 5.0     | 2026-06-28 | System Realignment: multi-role, maker/checker, portability engine                     |
| 5.5     | 2026-07-03 | Document Import Webhook, VP Packet QR Verification at Service Point                   |

---

## 28. Document Request Import Flow (Webhook/API)

### 28.1 Overview

The Document Import Webhook enables external clinical systems (HIS, LIS, RIS, PACS) to push documents back to TrustCare when a patient's wallet has requested them. This closes the loop between the Service Readiness module (which identifies missing documents) and the external systems that hold the source data.

### 28.2 Endpoint

| Method | Path                                  | Security                                   |
| ------ | ------------------------------------- | ------------------------------------------ |
| POST   | `/api/webhook/document-import`        | HMAC-SHA256 (`X-Webhook-Signature` header) |
| GET    | `/api/webhook/document-import/config` | Public (integration documentation)         |

### 28.3 Supported Actions

| Action    | Status Transition                    | Description                                                             |
| --------- | ------------------------------------ | ----------------------------------------------------------------------- |
| `import`  | requested → imported                 | Raw document received from external system                              |
| `convert` | requested/imported → converted_to_vc | Document converted to Verifiable Credential and added to patient wallet |
| `reject`  | requested → rejected                 | External system cannot fulfill the request                              |

### 28.4 Convert Action Flow

```
External System → POST /api/webhook/document-import (action: "convert")
  ├─ Verify HMAC-SHA256 signature
  ├─ Look up walletDocumentRequest by requestId
  ├─ Issue VC via portability/vc.ts issueCredential()
  ├─ Store credential in issued_credentials table
  ├─ Create wallet card in wallet_cards table
  ├─ Update document request status → converted_to_vc
  ├─ Create audit event
  └─ Send notification to patient
```

### 28.5 Security

- All webhook calls require HMAC-SHA256 signature in `X-Webhook-Signature` header
- Secret key configured via `WEBHOOK_DOCUMENT_IMPORT_SECRET` environment variable
- Fallback to `WEBHOOK_SECRET` or default development key
- Source system identified via `X-Source-System` header

### 28.6 Files

| File                                   | Purpose                        |
| -------------------------------------- | ------------------------------ |
| `server/webhookDocumentImport.ts`      | Webhook handler implementation |
| `server/webhookDocumentImport.test.ts` | Unit tests (22 tests)          |
| `server/_core/index.ts`                | Route registration             |

---

## 29. VP Packet QR Verification at Service Point

### 29.1 Overview

The Service Point Verification feature allows clinical staff (nurses, doctors, hospital admins) to scan a patient's VP Service Packet QR code at the point of care. This verifies the patient's identity, displays their readiness score, and shows all included credentials in clinical-risk order.

### 29.2 Backend Procedures

| Procedure                        | Type     | Description                                                    |
| -------------------------------- | -------- | -------------------------------------------------------------- |
| `verifier.verifyServicePacket`   | mutation | Verify VP by presentationId, return patient info + credentials |
| `verifier.confirmServiceCheckin` | mutation | Record service check-in audit event                            |

### 29.3 Verification Flow

```
Staff scans QR → Extract presentationId
  ├─ Look up issued_presentations by presentationId
  ├─ Check expiration and status
  ├─ Verify JWT via portability/verifyPresentation()
  ├─ Load patient info
  ├─ Load all credentials (by credentialRowIds)
  ├─ Sort by clinical priority (allergy → medication → patient_summary → ...)
  ├─ Determine trust level (green/amber/red)
  ├─ Record audit event (service_verification)
  └─ Return verification result
```

### 29.4 Clinical Priority Order

| Priority | Credential Type    | Rationale                |
| -------- | ------------------ | ------------------------ |
| 1        | allergy_alert      | Life-threatening risk    |
| 2        | medication_summary | Drug interaction risk    |
| 3        | patient_summary    | Clinical context         |
| 4        | lab_result         | Diagnostic data          |
| 5        | diagnostic_report  | Imaging/pathology        |
| 6        | discharge_summary  | Recent care history      |
| 7        | immunization       | Preventive care          |
| 8-19     | Other types        | Administrative/financial |

### 29.5 Trust Level Badges

| Level | Color   | Meaning                                              |
| ----- | ------- | ---------------------------------------------------- |
| green | Emerald | VP cryptographically verified, all credentials valid |
| amber | Amber   | Credentials present but VP not fully verified        |
| red   | Red     | Verification failed or no valid credentials          |

### 29.6 Frontend Page

- Route: `/service-verify`
- Menu: "ตรวจสอบจุดบริการ" (Service Point Verify) in service_readiness group
- Roles: system_admin, hospital_admin, doctor, nurse
- Features: Camera QR scanner, manual VP presentation URL/ID verification fallback, auto-verify from URL param, credential preview, service/visit notes, confirm check-in audit event

### 29.7 Files

| File                                 | Purpose                                                |
| ------------------------------------ | ------------------------------------------------------ |
| `server/routers.ts`                  | verifyServicePacket + confirmServiceCheckin procedures |
| `server/serviceVerification.test.ts` | Unit tests (29 tests)                                  |
| `client/src/pages/ServiceVerify.tsx` | Staff scanner UI                                       |
| `shared/menuConfig.ts`               | Menu item definition                                   |

---


## 30. Portrait Generation & Identity Assets (v3.10.0)

### 30.1 Overview

Every demo user in the TrustCare Hospital Network now has a unique, AI-generated realistic portrait photograph. These portraits are used in:

- **User profile avatars** (sidebar, header, settings)
- **Patient identity cards** within the wallet
- **Credential subject photos** embedded in issued VCs
- **Service verification display** when staff scan VP Packet QR codes

### 30.2 Generation Pipeline

```
Prompt Engineering → AI Image Generation → Upload to CDN → DB Update
```

| Step | Tool | Output |
|------|------|--------|
| 1. Prompt crafting | Demographic-aware prompts (age, gender, ethnicity, profession) | Detailed text prompts |
| 2. Image generation | AI portrait generator (1:1 aspect ratio, 1024×1024) | PNG files |
| 3. CDN upload | `manus-upload-file --webdev` | Permanent `/manus-storage/` URLs |
| 4. DB seeding | SQL UPDATE on `users.avatarUrl` | All 16 demo users updated |

### 30.3 Demo User Portrait Mapping

| OpenID | Name | Role | Portrait Style |
|--------|------|------|----------------|
| demo-sysadmin-001 | นพ.สมชาย ระบบดี | system_admin | Thai male, 50s, formal medical attire |
| demo-hospadmin-001 | นางสาวพิมพ์ใจ บริหารดี | hospital_admin | Thai female, 40s, business professional |
| demo-doctor-001 | นพ.วิชัย รักษาดี | doctor | Thai male, 45, white coat |
| demo-doctor-002 | พญ.สุภาพร ใจเย็น | doctor | Thai female, 38, white coat |
| demo-nurse-001 | นางสาวนภา ดูแลดี | nurse | Thai female, 30s, nurse uniform |
| demo-nurse-002 | นายธนกร พยาบาลดี | nurse | Thai male, 35, nurse scrubs |
| demo-engineer-001 | นายเทคนิค ระบบดี | engineer | Thai male, 30s, casual tech |
| demo-patient-001 | นายสมชาย ใจดี | patient | Thai male, 55, casual |
| demo-patient-002 | นางสมหญิง รักสุขภาพ | patient | Thai female, 48, casual |
| demo-patient-003 | นายวิชัย ผู้สูงวัย | patient | Thai male, 72, elderly |
| demo-patient-004 | Haruka Tanaka | patient | Japanese female, 35, professional |
| demo-patient-005 | นายอาทิตย์ เด็กหนุ่ม | patient | Thai male, 22, young casual |
| demo-patient-006 | Mrs. Sarah Johnson | patient | Caucasian female, 45, professional |
| demo-patient-007 | นางสาวมาลี โรคเรื้อรัง | patient | Thai female, 60, elderly |
| demo-patient-008 | Mr. Ahmed Al-Rashid | patient | Middle Eastern male, 50, business |
| demo-patient-009 | นางสาวน้องใหม่ ยังไม่มีข้อมูล | patient | Thai female, 25, young casual |

### 30.4 Storage Architecture

All portrait images are stored outside the project directory at `/home/ubuntu/webdev-static-assets/portraits/` and served via the CDN path `/manus-storage/`. This prevents deployment timeouts from large binary assets in the project tree.

---

## 31. Role Separation & Access Control Enforcement (v3.10.0)

### 31.1 Access Control Layers

The system enforces role-based access control at three distinct layers:

```
Layer 1: tRPC Procedure Guards (server/routers.ts)
  ├── publicProcedure      → Anyone (no auth required)
  ├── protectedProcedure   → Any authenticated user
  ├── staffProcedure       → systemRole !== 'patient'
  ├── adminProcedure       → systemRole === 'system_admin' OR role === 'admin'
  └── requireMakerCheckerRole() → Explicit maker/checker role in userRoles table

Layer 2: Frontend Route Guards (client/src/App.tsx + menuConfig.ts)
  ├── Menu visibility based on systemRole
  ├── Route-level redirects for unauthorized access
  └── Component-level conditional rendering

Layer 3: Database-Level Role Assignment (drizzle/schema.ts)
  ├── users.systemRole enum: system_admin | hospital_admin | doctor | nurse | engineer | patient
  ├── userRoles table: additional role assignments (maker, checker, issuer)
  └── sanitizeAdditionalRolesForSystemRole(): strips invalid role combinations
```

### 31.2 Patient Isolation Verification

Verified that patient users (demo-patient-001 through demo-patient-009) are denied access to all staff/admin operations:

| Route | Guard | Patient Result |
|-------|-------|----------------|
| `verifier.verifyServicePacket` | staffProcedure | FORBIDDEN |
| `verifier.confirmServiceCheckin` | staffProcedure | FORBIDDEN |
| `hospital.create` | adminProcedure | FORBIDDEN |
| `credential.createTemplate` | adminProcedure | FORBIDDEN |
| `makerChecker.pendingReviews` | requireMakerCheckerRole("checker") | FORBIDDEN |
| `makerChecker.submitForReview` | requireMakerCheckerRole("maker") | FORBIDDEN |
| `users.list` | adminProcedure | FORBIDDEN |
| `users.updateRole` | adminProcedure | FORBIDDEN |

### 31.3 Staff Access Verification

Staff users (system_admin, hospital_admin, doctor, nurse) have access to their respective operations:

| Role | Accessible Operations |
|------|----------------------|
| system_admin | All admin + staff + maker/checker operations |
| hospital_admin | Staff operations + hospital-scoped admin |
| doctor | Staff operations + clinical procedures |
| nurse | Staff operations + service verification + clinical procedures |
| patient | Wallet, SHL, consent, prepare-service only |

### 31.4 Key Security Properties

1. **No patient holds maker/checker/issuer roles** — Verified via `SELECT COUNT(*) FROM userRoles WHERE userId IN (patient_ids)` = 0
2. **staffProcedure blocks all patients** — Checks `systemRole !== 'patient'` before proceeding
3. **adminProcedure blocks non-admins** — Only `system_admin` or legacy `admin` role passes
4. **requireMakerCheckerRole() uses sanitized roles** — Even if stale role data exists, `sanitizeAdditionalRolesForSystemRole()` strips invalid combinations for patient users
5. **Frontend menu filtering** — Patient sidebar only shows wallet, SHL, consent, and prepare-service items

---

## 32. System Audit Summary (v3.10.0 — 2026-07-03)

### 32.1 Data Inventory (demo-patient-001 / นายสมชาย ใจดี)

| Metric | Count | Details |
|--------|-------|---------|
| Wallet Cards | 21 | Across 6 categories, 17 distinct types |
| Card Categories | 6 | identity_and_access, clinical_summary, medication_and_pharmacy, care_transition, sharing_and_sync, claims_and_finance |
| Issuing Hospitals | 3 | TrustCare Central, Phuket International, Chiang Mai Cross-Border |
| Issued Credentials | 26 | All status=active |
| SHL Packages | 8 | 6 active, 2 revoked |
| SHL Purposes | 6 | patient_summary, self_share, referral, cross_border, insurance, medical_tourist |
| Manifest Versions | 8 | One per SHL package |
| SHL Files | 8 | Encrypted FHIR bundles |
| SHL Access Logs | 12 | 9 granted, 3 bad_passcode |
| Issued Presentations | 10 | All status=active |
| Demo Users with Portraits | 16/16 | 100% coverage |
| Patient Staff-Route Denials | 6/6 tested | All correctly FORBIDDEN |

### 32.2 Test Coverage

| Test File | Tests | Status |
|-----------|-------|--------|
| server/auth.logout.test.ts | 1 | ✓ |
| server/trustcare.test.ts | 6 | ✓ |
| server/tao-consent.test.ts | 10 | ✓ |
| server/role-policy.test.ts | 4 | ✓ |
| server/serviceReadiness.test.ts | 53 | ✓ |
| server/readiness.test.ts | 3 | ✓ |
| server/webhookDocumentImport.test.ts | 22 | ✓ |
| server/serviceVerification.test.ts | 31 | ✓ |
| server/bundle-upload.test.ts | 6 | ✓ |
| server/care-transition.test.ts | 4 | ✓ |
| server/claimAnalytics.test.ts | 6 | ✓ |
| server/claimCenter.test.ts | 5 | ✓ |
| server/demo-login.test.ts | 15 | ✓ |
| server/dicom-viewer.test.ts | 15 | ✓ |
| server/maker-checker.test.ts | 24 | ✓ |
| server/multi-role.test.ts | 17 | ✓ |
| server/portability.test.ts | 7 | ✓ |
| server/qrScanner.test.ts | 15 | ✓ |
| server/role-guard.test.ts | 20 | ✓ |
| server/role-menu.test.ts | 14 | ✓ |
| server/role-switch.test.ts | 15 | ✓ |
| server/schema-registry.test.ts | 12 | ✓ |
| server/shl.test.ts | 5 | ✓ |
| e2e/portability-flow.e2e.test.ts | 2 | ✓ |
| **Total** | **307** | **All passing** |

### 32.3 TypeScript Compilation

- **0 errors** across all source files
- Strict mode enabled
- All imports resolved correctly

## 33. Claim Center — Real DB Implementation (v3.14.0 - 2026-07-03)

Claim Center is now fully backed by real database tables with 6 seeded realistic scenarios. The workbench reads from `claim_cases` + `claim_packages` + `claim_payments` with patient/hospital name JOINs.

### 33.1 Claim Center Database Tables

| Table | Purpose | Rows (seeded) |
|-------|---------|---------------|
| `claim_cases` | Master claim records with status, amounts, ICD-10 codes | 6 |
| `claim_intake_sessions` | Intake workflow with canonical FHIR summaries | 6 |
| `claim_documents` | Evidence documents per claim (receipts, referrals, prescriptions) | 18 |
| `claim_packages` | FHIR ClaimPackageCredential payloads | 5 |
| `claim_submission_events` | Payer submission records with adjudication results | 4 |
| `claim_payments` | Payment reconciliation records | 1 |
| `payer_rulesets` | Payer-specific validation rules and requirements | 6 |
| `payer_adapters` | Payer connection adapters (NHSO, SSO, AIA, CSMBS, Travel, Self-Pay) | 6 |

### 33.2 Six Seeded Claim Scenarios

| # | Scenario | Payer | Status | Amount |
|---|----------|-------|--------|--------|
| 1 | NHSO OPD Chronic Disease | สปสช. (NHSO) | intake_complete | ฿2,500 |
| 2 | SSO Rehabilitation | ประกันสังคม (SSO) | submitted | ฿45,000 |
| 3 | AIA IPD Direct Billing | AIA ประกันชีวิต | adjudicated | ฿185,000 |
| 4 | Travel Insurance Emergency | Allianz Travel Insurance | submitted | ฿32,000 |
| 5 | CSMBS Dental (Correction Required) | กรมบัญชีกลาง (CSMBS) | correction_required | ฿4,600 |
| 6 | Self-Pay Pharmacy Reimbursement | Self-Pay (Patient) | paid | ฿890 |

### 33.3 Claim Detail Page (`/claim-center/:id`)

New dedicated detail page with 5 tabs:

| Tab | Content |
|-----|---------|
| Timeline | Chronological events: intake → documents added → packaged → submitted → adjudicated → paid |
| Documents | All claim_documents with type badges and verification status |
| FHIR Payload | ClaimPackageCredential JSON viewer with syntax highlighting |
| Payer Response | Submission events, adjudication results, rejection reasons |
| Payment | Payment reconciliation details, amounts, dates |

### 33.4 Canonical Models

- FHIR `CoverageEligibilityRequest/Response` for eligibility
- FHIR `Claim` for canonical payer claim package
- FHIR `ClaimResponse` for payer adjudication
- FHIR `PaymentReconciliation` for remittance and payment posting
- `CoverageEligibilityCredential`, `ClaimPackageCredential`, and `ClaimReceiptCredential` as the VC trust layer
- Patient wallet output is EOB-style and avoids payer-private notes

### 33.5 Workbench Data Flow

```
claim.workbench (tRPC)
  → listClaimCases() with LEFT JOIN users + hospitals
  → mapDbClaimToWorkbenchCase() per row
  → Enrich with claim_packages, claim_payments data
  → Return ClaimWorkbenchPacket[] with patient names, hospital names, readiness scores
```

### 33.6 Checker Notification

When a maker submits a credential request for review (`submitForReview` mutation), the system automatically notifies all users with checker role via the notifications table. Notification includes request ID, maker name, and priority flag.

---

### 32.4 Files Modified in v3.10.0

| File | Change |
|------|--------|
| `server/routers.ts` | Changed `verifyServicePacket` and `confirmServiceCheckin` from `protectedProcedure` to `staffProcedure` |
| `users.avatarUrl` (DB) | Updated all 16 demo users with unique AI-generated portrait URLs |
| `docs/ARCHITECTURE.md` | Added Sections 30–32 |

---


## 34. Seed Data Quality (v3.13.0 - 2026-07-03)

### 34.1 Avatar Photo Coverage

All demo users now have unique AI-generated portrait photos (no generic placeholders):

| Category | Count | Style |
|----------|-------|-------|
| Thai male patients | 5 | Professional headshot, varied ages |
| Thai female patients | 3 | Professional headshot, varied ages |
| International patients | 4 | Caucasian, East Asian, South Asian, Hispanic |
| Staff (makers/checkers) | 4 | Professional medical staff attire |
| **Total unique avatars** | **16** | **100% coverage** |

### 34.2 Credential Request Seed Data

10 credential_requests seeded with realistic clinical data:

| Status | Count | Details |
|--------|-------|---------|
| draft | 2 | Incomplete requests with partial data |
| pending_review | 3 | Awaiting checker approval |
| approved | 2 | Approved by checker with comments |
| rejected | 1 | Rejected with correction notes |
| issued | 1 | Successfully issued as VC |
| cancelled | 1 | Cancelled by maker |

Each request includes: ICD-10 diagnosis codes, attending physician name, department, clinical notes, and priority flags.

### 34.3 Payer Adapter Coverage

| Payer Type | Adapter Name | Submission Mode |
|------------|--------------|-----------------|
| government_nhso | สปสช. (NHSO) | API (e-Claim) |
| social_security | ประกันสังคม (SSO) | Portal |
| private_insurance | AIA ประกันชีวิต | API (Direct Billing) |
| government_csmbs | กรมบัญชีกลาง (CSMBS) | Batch |
| travel_insurance | Allianz Travel Insurance | Email |
| self_pay | Self-Pay (Patient) | Manual |

---

## 35. Prepare for Service Core Workbench (v5.6.0 - 2026-07-03)

Prepare for Service is now modeled as the central wallet-first readiness function for both patients and hospitals.

Core changes:

- Patient view uses patient-owned bundle labels and hides hospital-only operations.
- `medical_tourist` is split by audience:
  - Patient: `เตรียมไปรักษาต่างประเทศ` / `Prepare care abroad`
  - Hospital: `รับผู้ป่วยต่างชาติ` / `Inbound international patient`
- Hospital Workbench handles incoming packet verification, partner intake, walk-in wallet onboarding, and deploy-to-wallet drafts.
- Contract Hub publishes simulated service readiness contracts, FHIR Questionnaire shapes, VC schema references, consent policy, and API contracts.
- Data Mapping v2 binds source connectors and uploads to service contracts before emitting FHIR, DocumentReference, VC, VP, SHL, or review tasks.
- Public mock API is exposed at `/api/public/prepare-service/v1` and is explicitly marked simulation-only.

Persistent DB follow-up for Manus is documented in [`docs/PREPARE_FOR_SERVICE_CORE_HANDOFF.md`](./PREPARE_FOR_SERVICE_CORE_HANDOFF.md).

---

## 36. Version History Summary

| Version | Date | Key Changes |
|---------|------|-------------|
| v3.20.0 | 2026-07-03 | Document Upload Flow (FHIR DocumentReference), QR Check-in via SHL, Contract Admin CRUD, UploadDocButton + CheckinQRPanel UI |
| v5.6.0 | 2026-07-03 | Prepare for Service core workbench, audience-separated patient/hospital bundles, Contract Hub/Data Mapping v2 mock API |
| v3.14.0 | 2026-07-03 | Claim Center real DB binding, patient name JOINs, ClaimDetail page with 5 tabs |
| v3.13.0 | 2026-07-03 | 6 Claim Center DB tables created, 6 realistic scenarios seeded, unique avatar photos for all users |
| v3.12.0 | 2026-07-03 | Maker/Checker workflow improvements, checker notification, credential_requests seed data |
| v3.11.2 | 2026-07-03 | Checker queue schema mismatch fix (makerId/checkerId column alignment) |
| v3.11.1 | 2026-07-03 | SHL page Date rendering fix |
| v3.11.0 | 2026-07-03 | Mobile UI fixes (avatar, duplicate templates, wallet/crossborder/international responsive) |
| v3.10.0 | 2026-07-02 | Service readiness, role enforcement, unique portraits, system audit |
| v3.9.0 | 2026-07-02 | Care transition workspace, file bundles, partner portal |
| v3.8.0 | 2026-07-02 | Cross-border referrals, international cases, medical tourism |
| v3.7.0 | 2026-07-02 | SHL system, credential presentations, consent expiry |

---

## 37. Current System Statistics

| Metric | Value |
|--------|-------|
| Database tables | 67 (in schema.ts) |
| Migration batches | 18 |
| tRPC routers | 30 |
| Frontend pages | 37 |
| Reusable components | 22 |
| Test files | 25 |
| Test cases | 319 (all passing) |
| TypeScript errors | 0 |
| Demo users | 16 (all with unique avatars) |
| Claim scenarios | 6 (fully seeded with FHIR data) |
| Payer adapters | 6 (all payer types covered) |
| Credential requests | 10 (all statuses represented) |

---

## 38. Document Upload, QR Check-in & Contract Admin (v3.20.0 — 2026-07-03)

### 38.1 Document Upload Flow

The patient document upload flow enables patients to upload supporting documents (PDF, JPEG, PNG, WebP) directly from the PrepareForService readiness view. Each upload is stored in S3, hashed (SHA-256), and wrapped in a FHIR R4 `DocumentReference` resource.

**Database table:** `patient_uploaded_documents`

| Column | Type | Description |
|--------|------|-------------|
| id | serial PK | Auto-increment |
| uploadId | varchar | Unique upload identifier (`pud_<nanoid>`) |
| patientId | int FK | References users.id |
| context | enum | Readiness context (opd_visit, emergency, etc.) |
| documentType | varchar | Document type from contract requirements |
| documentCategory | enum | identity, clinical, insurance, consent, legal, imaging, lab, other |
| title | varchar | Human-readable title |
| fileName | varchar | Original file name |
| mimeType | varchar | MIME type |
| fileSize | int | File size in bytes |
| fileKey | varchar | S3 storage key |
| fileUrl | varchar | Accessible URL via /manus-storage/ |
| fileHash | varchar | SHA-256 hash of file content |
| fhirDocumentReference | json | Full FHIR R4 DocumentReference resource |
| status | enum | uploaded → needs_review → verified → converted_to_vc → rejected |
| reviewPolicy | enum | auto_accept / manual_review |
| reviewedBy | int FK | Reviewer user ID |
| reviewedAt | timestamp | Review timestamp |
| reviewComment | text | Reviewer notes |
| walletDocumentRequestId | int FK | Links to wallet_document_requests |
| createdAt | timestamp | Upload timestamp |
| updatedAt | timestamp | Last update |

**tRPC Procedures:**

| Procedure | Access | Description |
|-----------|--------|-------------|
| `wallet.uploadDocument` | protected | Upload file (base64), store in S3, create FHIR DocumentReference |
| `wallet.listUploadedDocuments` | protected | List patient's uploads filtered by context |
| `wallet.reviewUploadedDocument` | protected (staff) | Approve/reject uploaded document |
| `wallet.pendingDocumentReviews` | protected (staff) | List documents needing review |

**FHIR DocumentReference structure:**
```json
{
  "resourceType": "DocumentReference",
  "status": "current",
  "type": { "coding": [{ "system": "http://loinc.org", "code": "document-type" }] },
  "subject": { "reference": "Patient/<patientId>" },
  "content": [{
    "attachment": {
      "contentType": "application/pdf",
      "url": "/manus-storage/<fileKey>",
      "hash": "<sha256>",
      "size": 12345,
      "title": "filename.pdf"
    }
  }],
  "context": { "event": [{ "coding": [{ "code": "opd_visit" }] }] }
}
```

### 38.2 QR Code Check-in via SHL

The `wallet.generateCheckinQR` procedure creates a Smart Health Link (SHL) packet for patient check-in at service points. It combines wallet credentials and uploaded documents into a single scannable QR code.

**Flow:**
1. Patient completes readiness check (critical documents ready)
2. Patient clicks "สร้าง QR Check-in" button
3. System calls `wallet.generateCheckinQR` with context + consent attestation
4. Backend resolves patient ID, gathers wallet cards + uploaded documents
5. Backend calls `createSmartHealthLinkPackage` with:
   - Purpose: mapped from context (e.g., opd_visit → "patient_summary")
   - Credentials: active wallet cards matching the context
   - Documents: verified uploaded documents as DocumentReference bundle
   - Expiry: 24 hours
   - Max access: 3 scans
6. Returns QR payload (shlink:/ URI), expiry, access count, readiness score

**tRPC Input/Output:**
```typescript
// Input
{ context: ReadinessContext, consentAttested: boolean }

// Output
{
  qrPayload: string,        // shlink:/... URI for QR code
  shlId: string,            // SHL record ID
  expiresAt: string,        // ISO timestamp
  maxAccessCount: number,   // Max scans allowed
  credentialCount: number,  // Number of credentials in bundle
  readinessScore: number,   // Readiness percentage
}
```

**Frontend Components:**
- `CheckinQRPanel` — Generates and displays QR code in a dialog with expiry info
- Uses `qrcode.react` (QRCodeCanvas) for client-side QR rendering

### 38.3 Inline Document Upload (UploadDocButton)

The `UploadDocButton` component provides inline upload capability next to each missing document item in the readiness checklist. It validates file type and size client-side before encoding to base64 and calling the `wallet.uploadDocument` mutation.

**Constraints:**
- Max file size: 10 MB
- Allowed types: PDF, JPEG, PNG, WebP
- Immediate feedback via toast notifications
- Automatic context and document type binding from readiness requirements

### 38.4 Contract Admin CRUD

The Contract Admin page (`/contract-admin`) provides system administrators with full CRUD capabilities over service readiness contracts without requiring seed scripts.

**tRPC Procedures (admin only):**

| Procedure | Description |
|-----------|-------------|
| `contractAdmin.list` | List all contracts ordered by creation date |
| `contractAdmin.getById` | Get single contract by ID |
| `contractAdmin.create` | Create new contract with all fields |
| `contractAdmin.update` | Update existing contract (version, status, labels, JSON configs) |
| `contractAdmin.delete` | Soft-delete (set status to "deprecated") |
| `contractAdmin.listTemplates` | List bundle templates with optional contractId filter |

**Contract fields managed:**
- Contract ID, context, version, status (draft/active/deprecated)
- Patient/Hospital labels (TH/EN)
- Patient/Hospital visibility flags
- Bundle types (patient_readiness_bundle, hospital_readiness_bundle)
- Requirements JSON (array of requirement definitions)
- Questionnaire JSON (FHIR Questionnaire shape)
- Consent Policy JSON (consent rules and policies)

**Frontend (ContractAdmin.tsx):**
- Tabbed interface: Contracts list + Bundle Templates list
- Create/Edit dialog with full form validation
- JSON editor fields for requirements, questionnaire, consent policy
- Inline status badges with color coding
- Edit and soft-delete actions per row

### 38.5 Files Modified/Created in v3.20.0

| File | Change |
|------|--------|
| `drizzle/schema.ts` | Added `patient_uploaded_documents` table |
| `server/db.ts` | Added CRUD helpers for contracts and uploaded documents |
| `server/routers.ts` | Added `wallet.uploadDocument`, `wallet.listUploadedDocuments`, `wallet.reviewUploadedDocument`, `wallet.pendingDocumentReviews`, `wallet.generateCheckinQR`, `contractAdmin.*` procedures |
| `client/src/pages/PrepareForService.tsx` | Added `UploadDocButton` and `CheckinQRPanel` components |
| `client/src/pages/ContractAdmin.tsx` | New page — full CRUD UI for service contracts |
| `client/src/App.tsx` | Added `/contract-admin` route |
| `client/src/components/DashboardLayout.tsx` | Added FileStack icon, contract-admin menu item |
| `server/contractAdmin.test.ts` | New test file — 7 tests for contract CRUD helpers |
| `docs/V320_PROGRESS.md` | Implementation progress tracking |
| `docs/V320_CURRENT_STATE.md` | Current state analysis |
| `docs/V320_IMPLEMENTATION_NOTES.md` | Implementation notes |
