# Prepare for Service Core Workbench Handoff

**Version:** v1.0  
**Date:** 2026-07-03  
**Scope:** Contract-driven Prepare for Service for patient wallet readiness, hospital workbench, Contract Hub, Data Mapping v2, and public mock API.

## Product Boundary

TrustCare should not become a generic central health super-app. Prepare for Service is the core function that helps a patient or hospital assemble the minimum necessary, case-specific, portable and verifiable packet before, during, and after a care service.

The patient-facing side prepares documents the patient will carry or present. The hospital-facing side verifies incoming packets, receives partner documents, connects walk-in wallets, and issues hospital-created documents into target wallets.

## Research Anchors

- NHS App validates patient-facing functions such as identity proofing, appointments, repeat prescriptions, GP records, allergies, medicines, test results, and care plans.
- HealthHub validates patient e-services such as appointments, lab reports, immunisation records, payments, and medication refill.
- Cleveland Clinic Global Patient Services shows that inbound international patient workflows are hospital/international-desk workflows with medical history, insurance/payment, appointments, financial estimate, and post-treatment support.
- HL7 FHIR Questionnaire/QuestionnaireResponse is the right model for dynamic intake forms and responses.
- HL7 FHIR DocumentReference plus IHE MHD is the right model for legacy PDFs, scans, partner files, and metadata-rich document exchange.
- HL7 FHIR Bundle is the right canonical container for grouped resources with clinical integrity.
- SMART Health Links should transport manifest/files for larger or mixed packets; VC/VP stays the trust layer.
- W3C VC/VP is the trust layer for issuer, holder, verifier, consent receipt, manifest integrity, and selective presentation.
- OpenAPI should publish partner-facing HTTP contracts.
- Thailand PDPA treats health data as sensitive data requiring explicit consent unless a healthcare/legal exception applies; TrustCare must implement purpose limitation, data minimization, audit, and safeguards.

## Audience Separation

### Patient-Facing Bundle Use Cases

These appear in the patient Prepare for Service menu:

| Patient use case | Context | Bundle | Why patient sees it |
|---|---|---|---|
| Prepare OPD visit | `opd_visit` | `OPDReadinessBundle` | Patient prepares registration and clinical intake documents. |
| Emergency wallet card | `emergency` | `EmergencyReadinessBundle` | Patient keeps critical allergy/medication/condition data ready. |
| Prepare referral or continuing care | `referral` | `ReferralReadinessBundle` | Patient carries referral packet to a receiving provider. |
| Cross-network or overseas care | `cross_border` | `CrossNetworkCareBundle` | Patient prepares documents to share across network or border. |
| Prepare care abroad | `medical_tourist` | `OutboundInternationalCareBundle` | Thai/local patient prepares to seek care overseas or second opinion abroad. |
| Prepare claim or coverage packet | `insurance_claim` | `InsuranceClaimReadinessBundle` | Patient prepares eligibility/receipt/claim evidence. |
| Medication pickup or refill | `pharmacy_dispense` | `PharmacyDispenseReadinessBundle` | Patient prepares prescription, medication, allergy, dispense history. |
| Pre-admission or procedure readiness | extended `opd_visit` | `PreAdmissionReadinessBundle` | Planned admission/procedure needs consent, coverage, instructions. |
| After-care and follow-up packet | extended `referral` | `DischargeWalletBundle` | Patient keeps discharge, prescription, appointment, receipt for next care. |
| Caregiver/proxy preparation | extended `opd_visit` | `ProxyCareReadinessBundle` | Linked profile requires delegated authority and consent. |

### Hospital-Facing Bundle Use Cases

These appear only in the hospital workbench:

| Hospital use case | Context | Bundle | Why patient should not see it as a patient menu item |
|---|---|---|---|
| OPD intake readiness | `opd_visit` | `HospitalOPDIntakeBundle` | Hospital verifies incoming packet and creates/updates encounter. |
| Emergency break-glass intake | `emergency` | `EmergencyIntakeBundle` | Staff-only break-glass workflow needs reason, audit, short expiry. |
| Referral send/receive workbench | `referral` | `ReferralHandoffBundle` | Hospital sends/refers or accepts partner referral tasks. |
| Cross-network/cross-border referral | `cross_border` | `CrossBorderReferralBundle` | Hospital manages partner trust, translation, receiving/sending packets. |
| Inbound international patient | `medical_tourist` | `InboundMedicalTouristBundle` | This is hospital international-desk intake, not a Thai patient's own menu. |
| Payer readiness and claim intake | `insurance_claim` | `VerifiedClaimPackageBundle` | Claim center/payer submission is operational staff workflow. |
| Pharmacy dispense readiness | `pharmacy_dispense` | `PharmacyDispenseBundle` | Pharmacy verifies and dispenses against clinical/coverage policy. |
| Walk-in wallet onboarding | `opd_visit` | `WalkInWalletOnboardingBundle` | Staff binds a wallet/DID or creates invitation for walk-in patient. |
| Partner portal document intake | `cross_border` | `PartnerIntakeSubmissionBundle` | Partner submits legacy files, FHIR, SHL, VC, or VP for review. |
| Issue or deploy documents to wallet | `opd_visit` | `WalletDeploymentBundle` | Maker/Checker or trusted auto-issue deploys hospital outputs to wallets. |

## Implemented in This PR

- `server/prepareService.ts`
  - Builds service readiness contracts from existing `shared/readiness.ts`.
  - Adds patient/hospital label separation for every context.
  - Adds audience-separated bundle use cases.
  - Adds simulated Contract Hub, Data Mapping v2, bundle envelopes, import jobs, deployment envelopes, and walk-in wallet connection.
  - Uses FHIR `Questionnaire`, `QuestionnaireResponse`, `DocumentReference`, and `Bundle` shapes in responses.

- `server/_core/prepareServiceRoutes.ts`
  - Adds public mock endpoints under `/api/public/prepare-service/v1`.
  - Responses are explicitly marked `simulationMode: true` and `notForProduction`.

- `server/routers.ts`
  - Adds tRPC wallet endpoints:
    - `wallet.prepareWorkbench`
    - `wallet.prepareContracts`
    - `wallet.contractHub`
    - `wallet.dataMappingV2`
    - `wallet.prepareApiExamples`
    - `wallet.buildServiceBundle`
    - `wallet.deployBundleToWallet`
    - `wallet.connectWalkInWallet`
    - `wallet.importForService`

- `client/src/pages/PrepareForService.tsx`
  - Replaces the old patient-only checklist page with:
    - Patient view
    - Hospital Workbench
    - Contract Hub
    - Data Mapping v2
    - API examples
  - Patient view intentionally uses "Prepare care abroad" for `medical_tourist`.
  - "Inbound international patient / รับผู้ป่วยต่างชาติ" is shown only in Hospital Workbench.

- `server/prepareService.test.ts`
  - Validates patient/hospital bundle separation.
  - Validates medical tourist label split.
  - Validates Contract Hub contracts, bundle envelope, deployment, walk-in wallet, import, mapping, and API examples.

## DB Work for Manus

This PR avoids adding migrations because the Manus workspace owns the deployed DB state. Manus should add persistent tables after validating against current migrations and live data.

### Suggested Tables

#### `service_readiness_contracts`

```sql
id bigint primary key auto_increment,
contract_id varchar(255) unique not null,
context varchar(64) not null,
version varchar(64) not null,
status varchar(32) not null,
patient_label varchar(255) not null,
patient_label_en varchar(255) not null,
hospital_label varchar(255) not null,
hospital_label_en varchar(255) not null,
patient_visible boolean not null default true,
hospital_visible boolean not null default true,
patient_bundle_type varchar(128) not null,
hospital_bundle_type varchar(128) not null,
requirements_json json not null,
questionnaire_json json not null,
consent_policy_json json not null,
created_at timestamp default current_timestamp,
updated_at timestamp default current_timestamp on update current_timestamp
```

#### `service_bundle_templates`

```sql
id bigint primary key auto_increment,
template_id varchar(255) unique not null,
contract_id varchar(255) not null,
audience varchar(64) not null,
bundle_type varchar(128) not null,
direction varchar(64) not null,
transport_policy_json json not null,
items_json json not null,
status varchar(32) not null default 'active',
created_at timestamp default current_timestamp
```

#### `service_bundle_instances`

```sql
id bigint primary key auto_increment,
bundle_id varchar(255) unique not null,
template_id varchar(255) not null,
patient_id bigint not null,
holder_did varchar(255),
context varchar(64) not null,
audience varchar(64) not null,
direction varchar(64) not null,
status varchar(64) not null,
readiness_score int not null default 0,
required_missing_json json,
fhir_bundle_json json,
trust_layer_json json,
presentation_id varchar(255),
shl_id varchar(255),
consent_credential_id varchar(255),
created_by bigint,
created_at timestamp default current_timestamp,
expires_at timestamp null
```

#### `wallet_import_jobs`

```sql
id bigint primary key auto_increment,
import_id varchar(255) unique not null,
patient_id bigint not null,
context varchar(64) not null,
source_type varchar(64) not null,
document_type varchar(128) not null,
consent_ref varchar(255),
status varchar(64) not null,
dqi_score int,
document_reference_json json,
hash varchar(128),
review_policy varchar(128),
created_by bigint,
created_at timestamp default current_timestamp
```

#### `walk_in_wallet_connections`

```sql
id bigint primary key auto_increment,
connection_id varchar(255) unique not null,
patient_id bigint,
patient_name varchar(255),
holder_did varchar(255) not null,
wallet_status varchar(64) not null,
identity_confidence varchar(64),
consent_ref varchar(255),
hn_mapping_json json,
created_by bigint,
created_at timestamp default current_timestamp
```

#### `contract_hub_artifacts`

```sql
id bigint primary key auto_increment,
artifact_id varchar(255) unique not null,
contract_id varchar(255),
artifact_type varchar(128) not null,
artifact_version varchar(64) not null,
artifact_json json not null,
hash varchar(128) not null,
status varchar(32) not null default 'active',
published_by bigint,
published_at timestamp default current_timestamp
```

### Reuse Existing Tables

Use existing tables where possible:

- `service_readiness_checks` for packet/check history.
- `wallet_document_requests` for missing document request lifecycle.
- `issued_presentations` for VP packets.
- `document_bundles`, `case_documents`, `care_packages`, `care_package_items` for bundle/file linking where compatible.
- `partner_source_connectors` and `partner_source_attestations` for source trust.
- `mapping_versions`, `fhir_field_mappings`, `terminology_mappings`, `vc_schema_registry` for Data Mapping v2.
- `audit_events` for every import, bundle, deploy, verify, issue, revoke, and break-glass event.

## Seed/Reseed Requirements

Seed at least:

- 7 service readiness contracts from `server/prepareService.ts`.
- 10 patient-visible use cases.
- 10 hospital-visible use cases.
- Bundle templates for all patient/hospital bundles listed above.
- 3 hospitals:
  - TrustCare Central Hospital
  - TrustCare North Hospital
  - TrustCare South Hospital
- Target wallets:
  - Somchai Jaidee as patient, not admin Somchai Rabobdee.
  - At least one external wallet.
  - At least one walk-in wallet invitation.
- Import jobs:
  - patient upload PDF needing review.
  - FHIR-native import auto-ready.
  - VC/VP verification import.
  - SHL manifest import.
  - partner portal referral.
- Contract Hub artifacts:
  - Questionnaire
  - QuestionnaireResponse example
  - DocumentReference profile
  - VC schema
  - SHL manifest schema
  - OpenAPI document
  - trust policy

Every reseed must be idempotent by `contract_id`, `template_id`, `bundle_id`, `import_id`, and `artifact_id`.

## Acceptance Criteria for Manus

- Patient `/prepare-service` does not show "ผู้ป่วยต่างชาติ" as a patient menu card.
- Patient `medical_tourist` label is "เตรียมไปรักษาต่างประเทศ" / "Prepare care abroad".
- Hospital Workbench shows "รับผู้ป่วยต่างชาติ" / "Inbound international patient".
- Patient can queue simulated import and build a bundle preview.
- Hospital can simulate deploy-to-wallet and walk-in wallet connection.
- Public mock endpoints return contract-shaped responses.
- DB seed creates persistent contract/bundle/import data and UI reads from DB when available.
- Existing VP issuance flow remains available through `ServiceReadinessPanel`.
- Audit events are written for tRPC simulated mutations now; production persistence should keep the same event names or migrate them with a mapping.

## Prompt for Manus

```text
You are working in the Manus WebDev workspace for:
https://github.com/AEC-Infraconnect-2562/trustcare-hospital-network

Read the latest attached spec:
TRUSTCARE_PREPARE_FOR_SERVICE_DEEP_RESEARCH_IMPLEMENTATION_SPEC.md

Also read the new Codex handoff:
docs/PREPARE_FOR_SERVICE_CORE_HANDOFF.md

Goal:
Persist and productionize the new Prepare for Service core workbench that Codex added. Do not turn TrustCare into a generic health super-app. The goal is wallet-first patient service readiness and hospital friction reduction.

Must verify before changes:
1. Pull latest GitHub main and compare with deployed Manus checkpoint.
2. Read docs/ARCHITECTURE.md and docs/CONTRIBUTING.md.
3. Check current DB migrations and live schema before creating any new migration.
4. Verify existing tables: service_readiness_checks, wallet_document_requests, issued_presentations, document_bundles, case_documents, care_packages, care_package_items, partner_source_connectors, mapping_versions, fhir_field_mappings, terminology_mappings, vc_schema_registry, audit_events.

Implement:
1. Add persistent DB support for Contract Hub readiness contracts, bundle templates, bundle instances, import jobs, walk-in wallet connections, and contract artifacts. Prefer extending/reusing existing tables when compatible.
2. Seed/reseed Contract Hub data from the current contract definitions in server/prepareService.ts.
3. Make seed idempotent and safe to rerun.
4. Persist patient/hospital bundle use cases separately:
   - Patient menu must show Prepare care abroad, not Inbound foreign patient.
   - Hospital Workbench must show Inbound international patient / รับผู้ป่วยต่างชาติ.
5. Connect wallet.prepareWorkbench to DB-backed contracts when available; keep static fallback.
6. Connect wallet.importForService to wallet_import_jobs and DocumentReference storage.
7. Connect wallet.buildServiceBundle to service_bundle_instances.
8. Connect wallet.deployBundleToWallet to bundle instance/deployment records and Maker/Checker issuance flow where VC issuance is required.
9. Connect wallet.connectWalkInWallet to a persistent DID/wallet binding flow.
10. Add OpenAPI artifact export under the Contract Hub.
11. Add audit events for import, bundle build, wallet deploy, walk-in connection, verify, issue, revoke, and emergency break-glass.

Validation:
- Run TypeScript check, server tests, e2e tests, and build.
- Add DB validation script that checks contract counts, patient/hospital visibility, bundle templates, import jobs, and target wallets.
- Confirm `/prepare-service` on production:
  - Patient tab does not show "ผู้ป่วยต่างชาติ".
  - Hospital tab shows "รับผู้ป่วยต่างชาติ".
  - Simulated import, bundle preview, deploy wallet, and walk-in wallet buttons work.
  - Real VP flow remains available below the patient workbench.

Important:
- Patients must not become Maker/Checker.
- Use activeRole and entitlement checks.
- Clinical data access must be consented and audited.
- Legacy documents enter as FHIR DocumentReference before optional VC issuance.
- SHL is transport; VC/VP is trust layer.
- Do not edit old migrations. Add a new migration only after validating current DB state.
```
