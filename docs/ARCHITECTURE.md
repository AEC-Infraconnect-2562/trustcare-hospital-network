# TrustCare Hospital Network — Architecture Documentation

**Version:** 3.1 (QR Scanner for VC/VP Verification)
**Last updated:** 2026-07-01
**Maintainers:** AEC-Infraconnect-2562

---

## 1. Architecture Overview

TrustCare Hospital Network is a **Verifiable Credential (VC) and Verifiable Presentation (VP) issuance platform** designed for Thai hospital networks. It implements the W3C VC Data Model v2.0 with SD-JWT-VC format, FHIR R4 clinical data canonicalization, and a Maker/Checker authorization workflow for credential governance.

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React 19 + Tailwind 4)             │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ ┌───────────────────┐  │
│  │Dashboard │ │Portability│ │Maker/Checker │ │Executive Dashboard│  │
│  │  Layout  │ │ Workbench │ │   Queues     │ │   & Analytics     │  │
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
│  │  portability · executiveDashboard                            │   │
│  └──────────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              server/portability/ (VC/VP Engine)               │   │
│  │  vc.ts · did.ts · fhir.ts · policy.ts · presentation.ts ·   │   │
│  │  syncBack.ts · sourceTruth.ts · seedData.ts · reseed.ts ·   │   │
│  │  labels.ts · trust.ts · clinicalDocuments.ts · types.ts      │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                              │ Drizzle ORM
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        DATABASE (MySQL/TiDB)                         │
│  35 tables · 9 migrations (0000–0008)                               │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 19, Tailwind CSS 4, shadcn/ui | UI framework |
| Routing | Wouter | Client-side routing |
| API Layer | tRPC 11 + Superjson | End-to-end type-safe RPC |
| Backend | Express 4, Node.js 22 | HTTP server |
| ORM | Drizzle ORM | Type-safe database queries |
| Database | MySQL (TiDB-compatible) | Persistent storage |
| Crypto | jose (JWT), HMAC-SHA256 | VC signing and verification |
| Auth | Manus OAuth + Demo Login | Session management |
| Storage | S3-compatible | File/credential storage |

### 1.3 Module Dependency Graph

```
routers.ts
  ├── db.ts (query helpers)
  │     └── drizzle/schema.ts (table definitions)
  └── portability/
        ├── index.ts (re-exports all public APIs)
        ├── vc.ts (issue/verify VC, create/verify VP)
        ├── did.ts (DID generation: did:web, did:key)
        ├── fhir.ts (HIS → FHIR R4 canonicalization)
        ├── policy.ts (consent-based access control)
        ├── presentation.ts (JSON VP verification)
        ├── syncBack.ts (HIS/Legacy sync-back plans)
        ├── sourceTruth.ts (CSV/DB import + review)
        ├── seedData.ts (demo hospital/patient generation)
        ├── reseed.ts (DB reseed orchestrator)
        ├── labels.ts (document taxonomy + storage metadata)
        ├── trust.ts (trust registry policy builder)
        ├── clinicalDocuments.ts (FHIR Composition builders)
        ├── types.ts (shared type definitions)
        └── utils.ts (sha256, nanoid, date helpers)
```

---

## 2. VC/VP Issuance Lifecycle

### 2.1 Credential Types (24 Document Types)

The system supports 24 verifiable credential types organized into 9 document categories:

| Category | Document Types | VC Type |
|----------|---------------|---------|
| Identity & Access | patient_identity, consent_receipt, mpi_link_certificate | PatientIdentityCredential, ConsentReceiptCredential, MpiLinkCertificateCredential |
| Clinical Summary | patient_summary, allergy_alert, immunization, medical_certificate | PatientSummaryCredential, AllergyAlertCredential, ImmunizationCredential, MedicalCertificateCredential |
| Medication & Pharmacy | medication_summary, prescription, pharmacy_dispense | MedicationSummaryCredential, PrescriptionCredential, PharmacyDispenseCredential |
| Diagnostics & Results | lab_result, diagnostic_report | LabResultCredential, DiagnosticReportCredential |
| Care Transition | referral_vc, discharge_summary | ReferralCredential, DischargeSummaryCredential |
| Claims & Finance | insurance_eligibility, claim_package, claim_receipt | CoverageEligibilityCredential, ClaimPackageCredential, ClaimReceiptCredential |
| Medical Tourism | travel_document_verification, visa_support_letter, quotation, guarantee_letter | TravelDocumentVerificationCredential, VisaSupportLetterCredential, QuotationCredential, GuaranteeLetterCredential |
| Sharing & Sync | shl_manifest, sync_receipt | ShlManifestCredential, SyncReceiptCredential |
| Operations | appointment | AppointmentCredential |

### 2.2 Issuance Flow (Maker/Checker)

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

1. **Source Ingestion** — Clinical data arrives from HIS (REST API, Legacy DB View, CSV, HL7v2) and is canonicalized into FHIR R4 IPS Bundle via `canonicalizeHisPayload()`.

2. **Maker Submission** — A user with `systemRole = "maker"` and appropriate `credentialEntitlements.makerTypes` submits a credential issuance request. The request is stored in `credential_issuance_requests` with status `submitted`.

3. **Checker Approval** — A user with `systemRole = "checker"` and appropriate `credentialEntitlements.checkerTypes` reviews the request. On approval, the system:
   - Calls `issueCredentialFromRequest()` which selects the appropriate VC builder
   - Signs the credential as SD-JWT-VC using HMAC-SHA256 (dev) or asymmetric key
   - Stores the issued credential in `issued_credentials`
   - Creates a wallet card in `wallet_cards`
   - Updates the request status to `issued`
   - Logs an audit event

4. **Wallet Delivery** — The credential appears in the patient's digital wallet with appropriate card type and display metadata.

### 2.3 Direct Issuance (Admin/Seed)

For automated or administrative issuance (bypassing Maker/Checker):

```
portability.createPacket → issueCredential() → issued_credentials + wallet_cards
portability.issueMedicalCertificate → issueMedicalCertificateVc() → issued_credentials
portability.issuePrescription → issuePrescriptionVc() → issued_credentials
```

### 2.4 Verification Flow

```
Verifier receives JWT → portability.verify (single VC)
                       → portability.verifyJsonPresentation (VP bundle)
Checks performed:
  1. JWT signature verification (HMAC or asymmetric)
  2. Trusted issuer check (Trust Registry)
  3. Revocation status check (credential_status_events)
  4. Expiration check
  5. Required credential type check
  6. Clinical priority findings extraction
```

### 2.4.1 QR Code Scanner Verification (v3.1)

The Verifier Portal supports two input methods via a tabbed interface:

| Input Method | Description | Backend Endpoint |
|---|---|---|
| **Paste Token/JSON** | Manual paste of JWT or JSON VP | `verifier.verify` |
| **Camera QR Scan** | WebRTC camera scans QR code | `verifier.verifyQrScan` |

The QR Scanner pipeline handles multiple QR payload formats:

```
QR Code Scanned
  │
  ├─ URL format (https://...?token=xxx) → extract token param
  ├─ Base64-encoded payload → decode to JWT/JSON
  ├─ Raw JSON VP (starts with '{') → parse & verify
  └─ Raw JWT (starts with 'eyJ') → verify as VP or VC
  │
  ▼
Same verification pipeline as manual verify
  │
  ▼
Audit event logged: verifier.qr_scan.{camera|file_upload}
```

**Component:** `client/src/components/QRScanner.tsx` (reusable, uses `html5-qrcode` library)

**Key features:**
- Real-time camera preview with start/stop controls
- Supports rear and front cameras (mobile)
- Auto-verification on successful scan
- Audit trail distinguishes camera vs file-upload source
- Graceful fallback for browsers without camera access

### 2.5 VP (Verifiable Presentation) Creation

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

## 3. Maker/Checker Authorization Matrix

### 3.1 System Roles

| Role | Code | Description |
|------|------|-------------|
| System Admin | `system_admin` | Full system access, user management, trust registry |
| Hospital Admin | `hospital_admin` | Hospital-scoped administration |
| Maker | `maker` | Create and submit credential issuance requests |
| Checker | `checker` | Review, approve/reject, and issue credentials |
| Doctor | `doctor` | Clinical data access, referrals |
| Nurse | `nurse` | Patient care, limited credential view |
| Integration Engineer | `integration_engineer` | Adapter configuration, sync management |
| Patient | `patient` | Wallet access, consent management |

### 3.2 Credential Entitlements

Each user has a `credentialEntitlements` JSON field with the structure:

```json
{
  "makerTypes": ["medical_certificate", "prescription", "lab_result"],
  "checkerTypes": ["medical_certificate", "prescription", "lab_result"]
}
```

- `"*"` in either array grants access to all 24 document types.
- Entitlements are checked by `hasCredentialEntitlement(user, key, credentialType)`.

### 3.3 Authorization Enforcement

| Action | Required Role | Additional Check |
|--------|--------------|-----------------|
| Submit issuance request | `maker` | `credentialEntitlements.makerTypes` includes the credential type |
| Approve/Issue credential | `checker` | `credentialEntitlements.checkerTypes` includes the credential type |
| Reject request | `checker` | Same as approve |
| Request changes | `checker` | Same as approve |
| Reseed database | `admin` | Admin-only procedure |
| Manage trust registry | `system_admin` | Admin procedure |
| View executive dashboard | Any authenticated | Protected procedure |

### 3.4 Multi-Role Support

The `user_roles` table allows users to hold multiple roles simultaneously:

```sql
CREATE TABLE user_roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  role VARCHAR(50) NOT NULL,
  hospitalId INT,
  scope JSON,
  createdAt TIMESTAMP DEFAULT NOW()
);
```

Users can switch active roles via `auth.switchRole` mutation, which sets the `trustcare_active_role` cookie.

---

## 4. Database Schema / ERD

### 4.1 Table Inventory (35 Tables)

| # | Table | Purpose | Key Relations |
|---|-------|---------|---------------|
| 1 | `users` | User accounts with systemRole and credentialEntitlements | — |
| 2 | `user_roles` | Multi-role assignments per user | → users |
| 3 | `hospitals` | Hospital registry with DID | — |
| 4 | `departments` | Hospital departments | → hospitals |
| 5 | `credential_templates` | VC template definitions per hospital | → hospitals |
| 6 | `credential_issuance_requests` | Maker/Checker workflow queue | → users, hospitals |
| 7 | `issued_credentials` | Issued VCs with SD-JWT payload | → users, hospitals, templates |
| 8 | `credential_requests` | Legacy credential request tracking | → users, hospitals |
| 9 | `wallet_cards` | Patient wallet card entries | → issued_credentials |
| 10 | `presentation_history` | VP verification logs | — |
| 11 | `issued_presentations` | Stored VP packages | → users |
| 12 | `consent_policies` | Consent policy definitions | → hospitals |
| 13 | `consent_records` | Patient consent grants | → users, hospitals |
| 14 | `referrals` | Inter-hospital referrals | → hospitals |
| 15 | `fhir_field_mappings` | FHIR field mapping rules | → hospitals |
| 16 | `terminology_mappings` | Code system mappings | → hospitals |
| 17 | `audit_events` | Full audit trail | → users, hospitals |
| 18 | `vc_vp_seed_batches` | Seed/reseed batch tracking | — |
| 19 | `notifications` | User notifications | → users, hospitals |
| 20 | `patient_identifiers` | MPI patient identity records | → hospitals |
| 21 | `mpi_matches` | MPI matching results | → patient_identifiers |
| 22 | `integration_adapters` | External system adapters | → hospitals |
| 23 | `adapter_health_logs` | Adapter health monitoring | → integration_adapters |
| 24 | `mapping_versions` | Mapping version history | → hospitals |
| 25 | `integration_event_logs` | Integration event tracking | → integration_adapters |
| 26 | `credential_status_events` | VC revocation/suspension log | — |
| 27 | `sync_reconciliation_jobs` | Sync-back reconciliation tracking | — |
| 28 | `trust_registry` | Trusted issuer registry | — |
| 29 | `smart_health_links` | SHL link management | → users, hospitals |
| 30 | `shl_access_logs` | SHL access audit | → smart_health_links |
| 31 | `payer_adapters` | Insurance payer configurations | → hospitals |
| 32 | `coverage_eligibility` | Coverage check results | → users, payer_adapters |
| 33 | `claim_cases` | Insurance claim cases | → users, hospitals, payer_adapters |
| 34 | `international_cases` | Medical tourism cases | → hospitals |
| 35 | `travel_documents` | International patient documents | → international_cases |
| 36 | `cross_border_referrals` | Cross-border referral tracking | → hospitals |

### 4.2 Core VC/VP Tables (ERD)

```
┌──────────────────────┐       ┌───────────────────────────┐
│   hospitals          │       │   users                   │
│ ──────────────────── │       │ ───────────────────────── │
│ id (PK)              │       │ id (PK)                   │
│ code, name, did      │       │ openId, name, email       │
│ status               │       │ systemRole, role          │
└──────────┬───────────┘       │ credentialEntitlements    │
           │                   │ hospitalId (FK)           │
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
│ storageKey, searchTags (JSON)                            │
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

---

## 5. Migration Order

Migrations must be applied sequentially. Each migration builds on the previous state.

| # | Tag | Description | Key Changes |
|---|-----|-------------|-------------|
| 0 | `0000_massive_shadow_king` | Initial schema | users, hospitals, departments, credential_templates, issued_credentials, wallet_cards, presentation_history, consent_policies, consent_records, referrals, fhir_field_mappings, terminology_mappings |
| 1 | `0001_groovy_owl` | Audit and notifications | audit_events, notifications, patient_identifiers, mpi_matches |
| 2 | `0002_equal_stellaris` | Integration layer | integration_adapters, adapter_health_logs, mapping_versions, integration_event_logs |
| 3 | `0003_patient_portability_vc_documents` | Extended VC types (11→24) | ALTER credential_templates, issued_credentials, wallet_cards type enums |
| 4 | `0004_production_portability_hardening` | Production hardening | credential_status_events, sync_reconciliation_jobs, trust_registry, smart_health_links, shl_access_logs, payer_adapters, coverage_eligibility, claim_cases, international_cases, travel_documents, cross_border_referrals |
| 5 | `0005_seed_vc_vp_extended_documents` | Full 24-type enum expansion | ALTER all type enums to include all 24 document types |
| 6 | `0006_vc_vp_reseed_persistence` | Seed batch tracking | issued_presentations, vc_vp_seed_batches |
| 7 | `0007_maker_checker_issuance_requests` | Maker/Checker workflow | ALTER users ADD credentialEntitlements, systemRole enum expansion (+ maker, checker), CREATE credential_issuance_requests |
| 8 | `0008_vc_document_storage_taxonomy` | Document taxonomy | ADD documentCategory, documentSubcategory, storageKey, searchTags to credential_templates and issued_credentials |

**Important:** Migrations 0005 and 0005_bent_rachel_grey are duplicates from different branches. The canonical sequence uses `0005_seed_vc_vp_extended_documents`. Similarly for 0006.

---

## 6. Seed/Reseed Strategy

### 6.1 Demo Hospitals

| Code | Name (TH) | Name (EN) | Focus |
|------|-----------|-----------|-------|
| TCC | โรงพยาบาลทรัสต์แคร์ เซ็นทรัล | TrustCare Central Hospital | General/referral hub |
| TCP | โรงพยาบาลทรัสต์แคร์ ภูเก็ต อินเตอร์เนชันแนล | TrustCare Phuket International Hospital | Medical tourism |
| TCM | โรงพยาบาลทรัสต์แคร์ เชียงใหม่ ครอสบอร์เดอร์ | TrustCare Chiang Mai Cross-Border Hospital | Cross-border care |

### 6.2 Seed Data Generation

The `generateTrustcareDemoSeed()` function creates:

- **12 patients per hospital** (configurable via `patientsPerHospital`)
- 4 base patients (Thai nationals + international) + 8 extended patients
- Each patient gets conditions, allergies, and document tags
- Patients are assigned to hospitals with DID keys

### 6.3 Reseed Orchestration (`reseedTrustcareVcVpDatabase`)

The reseed process:

1. **Batch tracking** — Creates a `vc_vp_seed_batches` record with `batchId = urn:trustcare:seed:batch:{hash}`
2. **Hospital upsert** — Inserts/updates hospitals with DID, code, and metadata
3. **Template creation** — Creates credential templates for each document type per hospital
4. **Patient creation** — Creates user records with patient role and DID keys
5. **Credential issuance** — Issues VCs for each patient based on their tags:
   - `patient_identity` → PatientIdentityCredential
   - `consent_receipt` → ConsentReceiptCredential
   - `patient_summary` → PatientSummaryCredential (with full FHIR IPS)
   - `medical_certificate` → MedicalCertificateCredential
   - `prescription` → PrescriptionCredential
   - And more based on patient tags
6. **Wallet cards** — Creates wallet entries for each issued credential
7. **Trust registry** — Registers hospital DIDs as trusted issuers
8. **Audit trail** — Logs all seed operations

### 6.4 Reseed Idempotency

- Reseeding checks for existing `batchId` in `vc_vp_seed_batches`
- If `resetExistingSeed = true`, deletes credentials with `urn:trustcare:seed` prefix before reseeding
- Batch hash is computed from `{patientsPerHospital, hospitals, documents, version}` for deterministic identification

---

## 7. DID Policy

### 7.1 DID Methods

| Method | Usage | Format | Example |
|--------|-------|--------|---------|
| `did:web` | Hospital/Organization issuers | `did:web:{domain}:hospital:{code}` | `did:web:trustcare.network:hospital:tcc` |
| `did:key` | Patient holders | `did:key:z{base58(ed25519-multicodec)}` | `did:key:z6Mk...` |

### 7.2 DID Document Structure

**Hospital DID Document (`did:web`):**

```json
{
  "@context": ["https://www.w3.org/ns/did/v1", "https://w3id.org/security/jwk/v1"],
  "id": "did:web:trustcare.network:hospital:tcc",
  "verificationMethod": [{
    "id": "did:web:trustcare.network:hospital:tcc#vc-signing-key",
    "type": "JsonWebKey2020",
    "controller": "did:web:trustcare.network:hospital:tcc",
    "publicKeyJwk": { "kty": "EC", "crv": "P-256", ... }
  }],
  "assertionMethod": ["...#vc-signing-key"],
  "authentication": ["...#vc-signing-key"],
  "service": [{
    "id": "...#trustcare-portability",
    "type": "TrustCarePortabilityEndpoint",
    "serviceEndpoint": "https://trustcare.network/api/portability/tcc"
  }]
}
```

**Patient DID Document (`did:key`):**

```json
{
  "@context": ["https://www.w3.org/ns/did/v1"],
  "id": "did:key:z6Mk...",
  "verificationMethod": [{
    "id": "did:key:z6Mk...#key-1",
    "type": "Ed25519VerificationKey2020",
    "controller": "did:key:z6Mk...",
    "publicKeyMultibase": "z6Mk..."
  }],
  "authentication": ["...#key-1"],
  "assertionMethod": ["...#key-1"]
}
```

### 7.3 Key Management

| Environment | Algorithm | Key Source |
|-------------|-----------|-----------|
| Development | HMAC-SHA256 | `TRUSTCARE_VC_SIGNING_SECRET` or `JWT_SECRET` |
| Production | ES256 (P-256) | Per-hospital key pair in trust registry |

### 7.4 Trust Domain

- Default domain: `trustcare.network`
- Hospital DID resolution: `https://{domain}/hospital/{code}/.well-known/did.json`
- Portability endpoint: `https://{domain}/api/portability/{code}`

---

## 8. Source of Truth / HIS / Legacy Sync-Back

### 8.1 Source of Truth Connectors

Each hospital has two standard connectors:

| Connector | Kind | Supported Inputs |
|-----------|------|-----------------|
| `{code}-his-rest` | HIS REST API | patient, encounter, diagnosis, allergy, medication, lab, document |
| `{code}-legacy-db` | Legacy DB View | patient_master, opd_visit, dx, rx, lis_result |

### 8.2 Data Ingestion Pipeline

```
Source System → HisIngestionInput → canonicalizeHisPayload() → CanonicalFhirResult
                                                                    │
                                                                    ├── bundle (FHIR R4 IPS)
                                                                    ├── patient (FHIR Patient)
                                                                    ├── clinicalResources[]
                                                                    ├── provenanceResources[]
                                                                    ├── issues[] (DataQualityIssue)
                                                                    └── summary
```

**Supported source formats:**

| Format | Parser | Notes |
|--------|--------|-------|
| `db_view` | `legacyDbViewToHisPayload()` | Maps patient_master, opd_visit tables |
| `csv` | `parseCsv()` + `reviewCsvForCanonicalMapping()` | Requires: hospital_code, hn, full_name_th, birth_date, visit_no |
| `hl7v2` | Direct mapping | HL7 v2 message segments |
| `rest_api` | Direct FHIR-like JSON | HIS REST API response |
| `fhir_native` | Pass-through | Already FHIR R4 |
| `document` | Document extraction | Scanned/uploaded documents |

### 8.3 Sync-Back Architecture

After VC issuance, the system can sync data back to legacy systems:

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ SyncBack     │     │ SyncBack     │     │ SyncBack     │     │ Reconciliation│
│ Request      │────▶│ Plan         │────▶│ Execution    │────▶│ Job          │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

### 8.4 Sync Targets

| Target ID | Kind | Write Mode | Idempotency |
|-----------|------|-----------|-------------|
| `fhir-rest-primary` | FHIR REST | system_of_record | source_event_id |
| `hl7v2-legacy` | HL7 v2 broker | system_of_record | business_key |
| `legacy-db-outbox` | Database outbox | mirror_only | content_hash |
| `manual-queue` | Human review queue | system_of_reference | source_event_id |

### 8.5 Sync-Back Plan

A `SyncBackPlan` contains:

- **idempotencyKey** — Deterministic key based on target strategy
- **consistencyKey** — Content hash for optimistic locking
- **outboundPayload** — Formatted for target system (FHIR Bundle, HL7 message, DB row, CSV row)
- **preconditions** — Checks before execution
- **rollbackHint** — Recovery instructions on failure

### 8.6 Execution & Reconciliation

Execution results include:

- **readBack** — Post-write verification read
- **consistency check** — Compares idempotency/consistency keys
- **reconciliation job** — Scheduled if consistency check fails or target requires manual review

### 8.7 Sync Receipt VC

After successful sync-back, a `SyncReceiptCredential` is issued as proof:

```
issueSyncReceiptVc({
  plan, execution, issuer, holderDid
}) → SyncReceiptCredential (365-day validity)
```

---

## 9. Document Taxonomy

### 9.1 Document Categories

| Category Key | Thai | English | Retention Class |
|-------------|------|---------|-----------------|
| `identity_and_access` | ตัวตนและสิทธิ์เข้าถึง | Identity and Access | long_lived |
| `clinical_summary` | สรุปและความเสี่ยงทางคลินิก | Clinical Summary and Risk | clinical |
| `medication_and_pharmacy` | ยาและเภสัชกรรม | Medication and Pharmacy | clinical |
| `diagnostics_and_results` | ผลตรวจและวินิจฉัย | Diagnostics and Results | clinical |
| `care_transition` | ส่งต่อและเปลี่ยนผ่านการดูแล | Care Transition | clinical |
| `claims_and_finance` | เคลมและการเงิน | Claims and Finance | financial |
| `medical_tourism` | ผู้ป่วยต่างชาติและการเดินทาง | Medical Tourism | administrative |
| `sharing_and_sync` | การแชร์และซิงก์ข้อมูล | Sharing and Synchronization | audit |
| `operations` | ปฏิบัติการและนัดหมาย | Operations | operational |

### 9.2 Document Type → Category Mapping

| Document Type | Category | Subcategory | FHIR Class Code | VC Type |
|--------------|----------|-------------|-----------------|---------|
| `patient_identity` | identity_and_access | identity | 51851-4 | PatientIdentityCredential |
| `consent_receipt` | identity_and_access | consent | 59284-0 | ConsentReceiptCredential |
| `mpi_link_certificate` | identity_and_access | mpi | 51851-4 | MpiLinkCertificateCredential |
| `patient_summary` | clinical_summary | summary | 34133-9 | PatientSummaryCredential |
| `allergy_alert` | clinical_summary | risk | 48765-2 | AllergyAlertCredential |
| `immunization` | clinical_summary | immunization | 11369-6 | ImmunizationCredential |
| `medical_certificate` | clinical_summary | certificate | 34109-9 | MedicalCertificateCredential |
| `prescription` | medication_and_pharmacy | prescription | 57833-6 | PrescriptionCredential |
| `pharmacy_dispense` | medication_and_pharmacy | dispense | 60593-1 | PharmacyDispenseCredential |
| `medication_summary` | medication_and_pharmacy | summary | 10160-0 | MedicationSummaryCredential |
| `lab_result` | diagnostics_and_results | laboratory | 11502-2 | LabResultCredential |
| `diagnostic_report` | diagnostics_and_results | imaging | 18748-4 | DiagnosticReportCredential |
| `referral_vc` | care_transition | referral | 57133-1 | ReferralCredential |
| `discharge_summary` | care_transition | discharge | 18842-5 | DischargeSummaryCredential |
| `insurance_eligibility` | claims_and_finance | eligibility | 48768-6 | CoverageEligibilityCredential |
| `claim_package` | claims_and_finance | claim | 34133-9 | ClaimPackageCredential |
| `claim_receipt` | claims_and_finance | receipt | 34133-9 | ClaimReceiptCredential |
| `travel_document_verification` | medical_tourism | travel | 11488-4 | TravelDocumentVerificationCredential |
| `visa_support_letter` | medical_tourism | visa | 34109-9 | VisaSupportLetterCredential |
| `quotation` | medical_tourism | quotation | 34133-9 | QuotationCredential |
| `guarantee_letter` | medical_tourism | guarantee | 34133-9 | GuaranteeLetterCredential |
| `shl_manifest` | sharing_and_sync | shl | 34133-9 | ShlManifestCredential |
| `sync_receipt` | sharing_and_sync | sync | 34133-9 | SyncReceiptCredential |
| `appointment` | operations | appointment | 39289-4 | AppointmentCredential |

### 9.3 Storage Path Pattern

All credentials follow a deterministic storage path:

```
vc/{hospital}/{patient}/{category}/{subcategory}/{documentType}/{credentialId}.jwt
```

Example: `vc/tcc/patient-001/clinical_summary/certificate/medical_certificate/urn-trustcare-vc-abc123.jwt`

### 9.4 Credential Validity Periods

| Document Type | Validity (Days) |
|--------------|----------------|
| prescription, pharmacy_dispense | 30 |
| medical_certificate, lab_result, diagnostic_report | 90 |
| consent_receipt, insurance_eligibility, claim_package, claim_receipt | 180 |
| All others | 365 |

### 9.5 Context-Based Validity Override

When issuing via `createPacket` (portability context), validity is determined by context:

| Context | Validity (Days) |
|---------|----------------|
| `emergency` | 1 |
| `treatment` / `self_share` / `cross_branch_referral` | 14 |
| `cross_border` / `medical_tourist` | 30 |
| `e_claim` | 90 |

---

## 10. Consent & Access Policy

### 10.1 Portability Contexts

| Context | Purpose | Allowed Scopes |
|---------|---------|---------------|
| `treatment` | Direct patient care | Patient.read, Condition.read, AllergyIntolerance.read, Medication.read, Observation.read, DocumentReference.read |
| `cross_branch_referral` | Inter-branch referral | Same as treatment + ServiceRequest.read |
| `cross_border` | International referral | Same as referral |
| `e_claim` | Insurance claim | Patient.read, Coverage.read, Claim.read, Condition.read, Procedure.read, Encounter.read |
| `medical_tourist` | Medical tourism | Treatment scopes + Coverage.read |
| `emergency` | Emergency access | Patient.read, AllergyIntolerance.read, Medication.read, Condition.read |
| `self_share` | Patient self-sharing | Same as treatment |

### 10.2 Break-Glass Emergency Access

When `context = "emergency"` and a `breakGlassReason` is provided, the system grants full emergency scopes regardless of consent status, but logs the access with the reason for audit.

---

## 11. File Structure Reference

```
trustcare-hospital-network/
├── docs/                          ← Architecture documentation (this file)
├── drizzle/
│   ├── schema.ts                  ← 35 table definitions + types
│   ├── relations.ts               ← Drizzle relation definitions
│   ├── meta/_journal.json         ← Migration ordering metadata
│   └── 0000–0008_*.sql            ← Migration SQL files
├── server/
│   ├── _core/                     ← Framework plumbing (DO NOT EDIT)
│   ├── portability/               ← VC/VP engine (15 modules)
│   ├── routers.ts                 ← tRPC procedures (2391 lines, 25 routers)
│   ├── db.ts                      ← Database query helpers
│   └── storage.ts                 ← S3 storage helpers
├── client/
│   ├── src/pages/                 ← 26 page components
│   ├── src/components/
│   │   ├── QRScanner.tsx          ← Camera QR scanner (html5-qrcode)
│   │   ├── DashboardLayout.tsx    ← Sidebar layout with role switcher
│   │   └── ui/                    ← shadcn/ui components
│   └── src/lib/trpc.ts            ← tRPC client binding
├── shared/
│   ├── const.ts                   ← Shared constants
│   └── types.ts                   ← Shared type definitions
└── package.json                   ← Dependencies and scripts
```

---

## 12. Development Workflow

### 12.1 Adding a New Credential Type

1. Add the type to the enum in `drizzle/schema.ts` (credential_templates.type, issued_credentials.type, wallet_cards.cardType, credential_issuance_requests.type)
2. Generate migration: `pnpm drizzle-kit generate`
3. Apply migration via `webdev_execute_sql`
4. Add type to `TrustcareCredentialType` union in `server/portability/types.ts`
5. Add label entry in `DOCUMENT_TYPE_LABELS` in `server/portability/labels.ts`
6. Add storage mapping in `DOCUMENT_STORAGE_MAP` in `server/portability/labels.ts`
7. Add VC builder function if custom FHIR composition is needed
8. Update `trustcareVcTypeForDbType()` mapping in `server/routers.ts`
9. Update `validityDaysForCredentialType()` if non-default validity
10. Update `getCardDisplayName()` and `cardTypeForCredential()` in `server/routers.ts`

### 12.2 Running Tests
```bash
pnpm test          # Unit tests (vitest) — includes qrScanner.test.ts
pnpm test:e2e      # End-to-end tests
pnpm build         # Production build
npx tsc --noEmit   # TypeScript check
```

### 12.4 QR Scanner Component Usage

The `QRScanner` component (`client/src/components/QRScanner.tsx`) is reusable across any page that needs QR scanning:

```tsx
import QRScanner from "@/components/QRScanner";

<QRScanner
  onScanSuccess={(decodedText) => { /* handle decoded QR data */ }}
  onScanError={(error) => { /* handle camera/decode errors */ }}
  fps={10}          // Scan frequency (frames per second)
  aspectRatio={1.0} // Camera preview aspect ratio
/>
```

**Dependencies:** `html5-qrcode` (installed via pnpm)
**Browser requirements:** WebRTC camera access (HTTPS required in production)

### 12.3 Reseeding the Database

```
POST /api/trpc/portability.reseedDb
Body: { patientsPerHospital: 12, resetExistingSeed: true }
Requires: admin role
```

---

## 13. Security Considerations

- All VC signing uses cryptographic algorithms (HMAC-SHA256 in dev, ES256 in production)
- Consent is enforced at the policy layer before any credential issuance
- Break-glass access is logged with mandatory reason
- Credential revocation is tracked via `credential_status_events`
- Trust registry verification can be set to `off`, `advisory`, or `required` mode
- All mutations are logged in `audit_events` with actor, action, and resource details

---

## References

- [W3C Verifiable Credentials Data Model v2.0](https://www.w3.org/TR/vc-data-model-2.0/)
- [SD-JWT-VC (IETF Draft)](https://datatracker.ietf.org/doc/draft-ietf-oauth-sd-jwt-vc/)
- [HL7 FHIR R4 International Patient Summary](http://hl7.org/fhir/uv/ips/)
- [DID Core Specification](https://www.w3.org/TR/did-core/)
- [did:web Method](https://w3c-ccg.github.io/did-method-web/)
- [did:key Method](https://w3c-ccg.github.io/did-method-key/)
