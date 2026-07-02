# TrustCare System Realignment — UX/UI + Function Strategy Spec

**Version:** 1.0  
**Date:** 2026-07-02  
**Audience:** Codex / Manus / TrustCare product team  
**Primary context:** Thai public hospitals, private hospital groups, MOPH-related agencies, referral networks, and medical tourism services

---

## 0. Executive Summary

TrustCare should be realigned from a collection of technical modules into a **hospital-enabled, patient-controlled portability ecosystem**. The system should not try to become a generic health application platform or central health data warehouse. Its purpose is narrower and more valuable:

> **Reduce friction before, during, and after hospital service by helping patients collect, hold, verify, and present the minimum trusted health information needed to start care efficiently.**

The current TrustCare repository already has many of the necessary technical building blocks: VC/VP issuance, FHIR canonicalization, SHL transport, wallet cards, trust registry, TAO framework, schema registry, source-of-truth connectors, care transition flows, and partner portal concepts. The next step is to redesign UX/UI and product functions so the system speaks the language of hospital service readiness rather than the language of isolated technical tools.

This specification recommends a system-wide reframe around four product loops:

```text
1. Collect        ผู้ป่วย/โรงพยาบาลดึงข้อมูลจากแหล่งเดิม
2. Verify         ระบบแปลง ตรวจคุณภาพ และออก VC/VP หรือเอกสารอ้างอิง
3. Present        ผู้ป่วยใช้ Wallet / QR / SHL แสดงข้อมูลต่อโรงพยาบาล
4. Update         หลังรับบริการ โรงพยาบาลออกเอกสารใหม่กลับเข้า Wallet หรือ sync-back ไป HIS
```

---

## 1. North Star: What TrustCare Is and Is Not

### 1.1 What TrustCare Is

TrustCare is a **bridge between legacy healthcare data silos and a new patient-controlled portable health wallet ecosystem**.

It helps hospitals and patients answer one practical question:

> “Can this patient start receiving care faster because the hospital already has trusted, sufficient, portable information?”

### 1.2 What TrustCare Is Not

TrustCare is not:

- A replacement for HIS/EMR.
- A national health super app.
- A central warehouse for every clinical event.
- A general app aggregator.
- A platform that connects every health app without a clear patient-service use case.

### 1.3 Strategic Implication

Every feature should be justified by one or more of these outcomes:

| Outcome | Meaning |
|---|---|
| ลดเวลารับบริการ | Less time at registration, triage, referral, admission, or claims desk |
| ลดเอกสารซ้ำ | Less repeated form filling and fewer paper/scanned document requests |
| เพิ่มความน่าเชื่อถือของข้อมูล | Verifiable issuer, status, schema, and provenance |
| เพิ่มการควบคุมของผู้ป่วย | Patient can hold, present, revoke, or share by context |
| ไม่รื้อระบบเดิม | HIS/legacy systems remain source of truth where appropriate |
| สร้าง momentum | Each hospital adoption adds more useful documents into Wallets |

---

## 2. Current GitHub Findings

### 2.1 Architecture Baseline

The latest architecture documentation states that TrustCare is a VC/VP issuance platform for Thai hospital networks using W3C VC Data Model 2.0, SD-JWT-VC, FHIR R4 canonicalization, Smart Health Links, TAO Trust Framework, and Maker/Checker governance.

Current architecture version observed:

```text
Version: 5.2 (Care Transition + Partner Portal)
Last updated: 2026-07-02
```

The current system includes:

- React 19 + Tailwind + shadcn UI frontend
- Express + tRPC backend
- Drizzle ORM + MySQL/TiDB
- 50 tables and 13 migrations
- 29 routers
- 24 credential/document types
- Wallet cards
- SHL transport and viewer
- Trust Registry and TAO
- Partner Portal and Care Transition logic
- Schema registry and document taxonomy
- DQI scoring for FHIR canonicalization

### 2.2 Current Menu Structure

The current side menu is still module-centric:

```text
Overview
Patient Services
Clinical Services
Digital Credentials
Claims & Finance
Interoperability
Administration
```

Important menu items already exist:

- Wallet
- Consent
- SHL
- Referral
- Cross-border Referral
- International Patients
- Partner Portal
- Issuer
- Verifier
- Trust Registry
- Claim Center
- HIS Integration
- Portability Layer
- FHIR Mapping
- Terminology
- MPI
- Audit
- Users
- Settings

### 2.3 UX/Product Gaps

| Current Pattern | Problem | Recommended Direction |
|---|---|---|
| Technical menu names | Users see system modules instead of service journey | Reframe into patient service readiness journey |
| Consent as side menu | Consent is not a destination; it is a contextual decision | Use contextual consent dialogs in each flow |
| Portability Workbench is technical | Useful for admin/engineer but not clinical users | Hide under admin/interop; create patient-facing readiness UI |
| Wallet still looks like card inventory | Good start, but needs “prepare for service” workflows | Wallet should become pre-service document cockpit |
| Referral and international flows are separate | They share care transition logic | Use unified Care Transition Platform + multiple views |
| Trust Registry is too visible | It is governance/admin infrastructure | Move to Administration / TAO governance |
| External app integration risk | Could become unfocused app aggregator | Treat external apps as sources feeding Wallet only |
| Dashboard is network statistics | Does not show friction reduction/readiness | Add KPIs: readiness score, pending document requests, verification success |

---

## 3. External Research Summary

### 3.1 W3C Verifiable Credentials

W3C VC Data Model supports a trust relationship where issuers make claims, holders store credentials, and holders present verifiable presentations to verifiers. VCs can represent the same information as physical credentials, while digital signatures make them more tamper-evident and trustworthy. The spec also defines `credentialStatus` for revocation/suspension and `credentialSchema` for verifiers to validate credential structure.

**Implication for TrustCare:** VC/VP should be the trust layer around patient-held documents, not merely a database export format.

### 3.2 FHIR R4 and DocumentReference

FHIR `DocumentReference` can represent metadata for many document types, including CDA documents, FHIR documents stored elsewhere, PDFs, scanned paper, image files, clinical notes, prescription records, and immunization records.

**Implication for TrustCare:** Legacy paper/PDF/scanned documents can enter the Wallet ecosystem as `DocumentReference + hash + provenance + review`, then become VC-backed only after appropriate issuer attestation.

### 3.3 SMART Health Links

SMART Health Links provide a QR/link transport pattern for encrypted health files and manifests. They are suitable for time-limited sharing of FHIR JSON, SMART Health Cards, and related files.

**Implication for TrustCare:** SHL is the transport/share mechanism; VC/VP is the trust and presentation mechanism.

### 3.4 NHS App / HealthHub / Health Connect Lessons

NHS App and Singapore HealthHub show that patient-facing health applications become valuable when they focus on practical service tasks: appointments, prescriptions, record access, test results, immunizations, and trusted health services. Android Health Connect shows a user-permissioned model for reading/writing health and medical data, including FHIR-based medical records.

**Implication for TrustCare:** TrustCare should not copy all health app features. It should adopt the common principle: **patient-controlled access to useful records that reduce friction at service entry.**

### 3.5 MorProm / Thailand Context

Public information about MorProm shows a broad MOPH platform with LINE OA services, immunization center, certificate, digital health pass, and privacy terms recognizing health data, entitlement data, and data subject portability rights. Public developer API capability is not clearly documented.

**Implication for TrustCare:** Treat MorProm and national apps as possible patient-authorized sources or destinations when official integration is available, not as the center of TrustCare architecture.

---

## 4. Product Reframe: From Modules to Service Readiness

### 4.1 Proposed Product Promise

> **TrustCare prepares the patient before they reach the hospital.**

### 4.2 Four UX Loops

```text
Before visit:   Collect documents → Build readiness packet
At check-in:    Present QR/VP/SHL → Verify identity and clinical minimum
During care:    Use trusted summary → Add encounter documents
After care:     Issue new VC/Document → Return to Wallet + sync-back if needed
```

### 4.3 New Mental Model

| Old mental model | New mental model |
|---|---|
| “ออกใบรับรอง” | “สร้างเอกสารที่ผู้ป่วยนำไปใช้ได้” |
| “FHIR Mapping” | “แปลงข้อมูลเดิมให้เข้ากระเป๋าผู้ป่วย” |
| “Trust Registry” | “ใครออกเอกสารแล้วโรงพยาบาลควรเชื่อถือ” |
| “SHL” | “แชร์ข้อมูลสำหรับเหตุการณ์นี้” |
| “Consent” | “ผู้ป่วยอนุญาตให้ใช้ข้อมูลนี้ในบริบทนี้” |
| “Integration” | “ดึงข้อมูลจากแหล่งเดิมมาเติม Wallet” |
| “Referral” | “ส่งต่อพร้อมข้อมูลที่ตรวจสอบได้” |

---

## 5. Proposed UX/UI System-Wide Redesign

### 5.1 Navigation Redesign

The side menu should prioritize real operational journeys. Technical modules should be hidden under Admin/Interop unless the active role needs them.

#### Recommended Menu Groups

```text
1. Service Readiness
   - Patient Intake / เตรียมเข้ารับบริการ
   - Health Wallet / กระเป๋าสุขภาพ
   - Document Requests / ขอเอกสารเข้ากระเป๋า
   - Smart Share / แชร์ข้อมูลสุขภาพ

2. Care Transition
   - Referral / ส่งต่อผู้ป่วย
   - Cross-Network / ส่งต่อข้ามเครือข่าย
   - International Patient / ผู้ป่วยต่างชาติ
   - Partner Portal / พันธมิตรและเอกสารเดิม

3. Verified Documents
   - Issue Documents / ออกเอกสาร
   - Review Requests / Maker/Checker
   - Verify Documents / ตรวจสอบเอกสาร

4. Hospital Operations
   - Dashboard
   - Claim Center
   - Audit

5. Integration & Governance
   - HIS Connectors
   - FHIR Mapping
   - Terminology Mapping
   - MPI
   - Trust Registry / TAO
   - Schema Registry
   - Settings
```

### 5.2 Remove Standalone Consent Menu

Consent should not be a default side menu destination. It should appear contextually in flows:

- Before creating SHL
- Before creating referral package
- Before pulling external documents
- Before showing clinical data to staff
- Before insurance claim sharing
- Before medical tourist document packet
- During emergency break-glass

Keep a small **Consent History** tab inside Wallet or Profile for patient review/revocation.

### 5.3 Wallet as the Center of the Product

Wallet must become the user’s document cockpit, not just a card gallery.

Recommended Wallet sections:

1. **Ready for Care Score**  
   Shows whether patient has minimum documents for a selected service context.

2. **Quick Access / Critical**  
   Patient identity, allergy alert, patient summary, medication summary, active referral/SHL.

3. **Document Categories**  
   9-category taxonomy: identity, clinical summary, medication, diagnostics, care transition, claims, medical tourism, sharing/sync, operations.

4. **Request Documents**  
   Pull/import from hospital, partner, MorProm/HealthLink if official integration exists, PDF upload, manual review.

5. **Present / Share**  
   Create VP QR, SHL link, or care package.

6. **After Visit Updates**  
   New prescriptions, medical certificates, lab results, discharge summary, sync receipt.

### 5.4 Patient Intake / Pre-Service Readiness

New page or dashboard panel:

```text
Choose service context:
- OPD visit
- Emergency
- Referral
- Cross-border care
- Medical tourist
- Insurance claim
- Pharmacy dispense

System checks:
- Identity present?
- Consent needed?
- Allergy known?
- Active medication list?
- Patient summary updated?
- Relevant referral/lab/imaging documents?
- Insurance/eligibility documents?

Output:
- Readiness score
- Missing documents
- Request/import actions
- Generate VP/SHL package
```

---

## 6. System Function Improvements by Module

### 6.1 Dashboard

Current dashboard is network statistics and recent activity. It should become role/context-aware.

#### Patient Dashboard

- Wallet completeness score
- Upcoming appointments
- Pending document requests
- Recent documents added
- Active shares/SHLs
- Missing documents for chosen service

#### Doctor/Nurse Dashboard

- Patients awaiting verification
- Referral packets awaiting triage
- Incoming VP/SHL scan queue
- Critical alerts from presented wallets
- Missing information alerts

#### Hospital Admin Dashboard

- Average intake time reduction
- Wallet document coverage
- Verification success rate
- Partner import quality
- DQI score trend
- Pending Maker/Checker queues
- SHL access/audit risk

#### System Admin Dashboard

- Trust framework health
- Schema version adoption
- Connector health
- Seed/reseed audit
- Revocation/status list health
- TAO/policy deployment status

### 6.2 Wallet

Already strong in current code: category grouping, offline cache, QR generation, biometric confirmation, PDF export, CredentialRenderer. Needed improvements:

- Add service-context readiness mode.
- Make Request Document action prominent.
- Add “Use for hospital visit” flow.
- Add external source import status.
- Add hospital-facing view mode that is consent-limited.
- Show provenance and trust level in simple language.

### 6.3 Consent

- Remove from main patient menu.
- Add `ConsentDialogProvider` and `useContextualConsent()`.
- Consent dialog should show: purpose, recipient, data categories, expiry, revocation rights, issuer, and output VC.
- Consent record should produce ConsentReceiptCredential when needed.
- Consent history can remain accessible from Wallet/Profile.

### 6.4 Smart Health Links

- Present as “แชร์ข้อมูลสำหรับเหตุการณ์นี้” rather than technical SHL.
- Only show advanced SHL fields to staff/admin.
- Patient sees: purpose, receiver, expiry, passcode, access count, revoke.
- Use `ShlManifestCredential` as trust wrapper for SHL manifest.

### 6.5 Referrals / Cross-Border / International

Unify these into **Care Transition Platform**:

```text
Referral Request → Consent → Document Package → Triage → Accept/Reject → Appointment/Admission → Treatment → Reply/Discharge → Wallet Update
```

Add:

- Partner Portal intake for external referrals
- Legacy document upload + DocumentReference
- CP / Care Package builder
- ReferralCredential issuance
- SHL/VP package generation
- Acceptance and intake decision outputs
- Counter-referral and discharge summary outputs

### 6.6 Partner Portal

Partner Portal is essential for bootstrapping the ecosystem because many partners do not have VC/VP capability yet.

Partner modes:

| Partner mode | Capability | TrustCare role |
|---|---|---|
| Legacy-only | Upload PDF/scan/HL7/CSV/FHIR | Create DocumentReference + review queue |
| Delegated issuance | Partner source-of-truth but no VC engine | TrustCare issues VC with partner attestation |
| Native VC/VP | Partner has DID/signing capability | TrustCare verifies and accepts VP/SHL |

### 6.7 Issue / Maker / Checker

Rename patient-facing concept from “Issue Credential” to “ออกเอกสารเข้ากระเป๋าผู้ป่วย”.

Improve:

- Guided document type selection by service context
- Show source data and DQI before Maker submit
- Checker sees risks, missing fields, schema version, trust level
- Add “issue to wallet” confirmation

### 6.8 Verifier

Verifier should be the hospital intake tool:

- Scan VP QR or SHL QR
- Verify issuer, holder, expiration, revocation, schema, trust registry
- Display minimum clinical facts first: identity, allergy, medication, diagnosis, recent labs
- Show “usable for intake” score
- Trigger contextual consent if more data needed

### 6.9 Trust Registry / TAO

Keep in Administration only.

Must support:

- TrustCare network hospitals
- TAO trusted issuers/verifiers
- MOPH/Root TAO policy anchor future path
- Schema bundle deployment without mass reissue
- Policy overlay at verification time

### 6.10 HIS Integration / FHIR Mapping / Terminology

Reframe as “Data feeders into Wallet.”

Add UX:

- Source capability matrix
- Data quality score
- Last successful import
- Patient import request logs
- “Can this source produce wallet-ready documents?” indicator

### 6.11 MPI

MPI should support “same patient across sources” and be exposed in document request/import flows.

- Patient can link HN/MRN/passport/Thai ID hash
- Staff can resolve matches
- Wallet shows which identifiers are verified
- Cross-hospital requests use MPI resolution with consent

---

## 7. Data and Document Architecture

### 7.1 Wallet Document Taxonomy

TrustCare already defines 9 document categories. Keep them, but surface them in user-friendly language:

| Category | Patient label | Key documents |
|---|---|---|
| identity_and_access | ตัวตนและสิทธิ์ | Patient Identity, Consent, MPI |
| clinical_summary | สรุปสุขภาพ | Patient Summary, Allergy, Certificate |
| medication_and_pharmacy | ยาและเภสัชกรรม | Medication, Prescription, Dispense |
| diagnostics_and_results | ผลตรวจ | Lab, Imaging |
| care_transition | ส่งต่อ/จำหน่าย | Referral, Discharge |
| claims_and_finance | สิทธิ์และเคลม | Eligibility, Claim Package, Receipt |
| medical_tourism | ผู้ป่วยต่างชาติ | Visa, Quotation, Guarantee |
| sharing_and_sync | แชร์และซิงก์ | SHL Manifest, Sync Receipt |
| operations | นัดหมาย | Appointment |

### 7.2 Minimum Care Readiness Dataset

For most hospital intake contexts, the minimum wallet-ready dataset should be:

```text
Patient identity
Emergency contact
Allergies / adverse reactions
Current medications
Active conditions / key diagnoses
Recent encounter summary
Relevant lab/imaging summaries
Insurance/eligibility where needed
Referral/discharge documents where relevant
Consent receipt / presentation purpose
```

### 7.3 Data Storage Principle

TrustCare should avoid becoming a full central EHR. Recommended storage pattern:

| Data type | Preferred storage |
|---|---|
| VC metadata and signed JWT | TrustCare + Wallet |
| Wallet card display metadata | TrustCare + Wallet cache |
| Full FHIR bundle | Wallet, SHL encrypted files, or source reference depending on context |
| Legacy PDF/scan | Object storage + DocumentReference hash/provenance |
| Source-of-truth clinical record | Original HIS/EMR unless patient imports/export requires copy |
| Audit/consent/status | TrustCare |
| Sync-back receipt | TrustCare + Wallet |

---

## 8. Integration Strategy: Sources Feed Wallet, Not Platform Aggregation

### 8.1 Connector Purpose

Every connector must answer:

> “What wallet-ready information can this source provide for a patient service context?”

### 8.2 Source Categories

| Source | Role |
|---|---|
| HIS/EMR | Encounter, diagnosis, medication, allergy, documents |
| LIS/RIS/PACS | Lab/imaging results |
| Hospital app | Appointments, patient documents, visit history |
| MorProm / national app | Possible patient-authorized documents, certificates, immunization, entitlement when official capability exists |
| Health Link/HIE | Possible source of clinical summaries via authorized exchange |
| Partner portal | Referral and legacy document intake |
| Payer | Eligibility and claim documents |
| Patient upload | Scanned documents and legacy records |
| Health Connect / personal app | Optional wellness/vitals and, where supported, FHIR medical records |

### 8.3 Connector Design

```typescript
interface WalletSourceConnector {
  id: string;
  sourceType: 'his' | 'lis' | 'ris' | 'pacs' | 'hospital_app' | 'national_app' | 'partner_portal' | 'payer' | 'patient_upload' | 'personal_health_app';
  capabilities: WalletSourceCapability[];
  authMode: 'oauth2' | 'api_key' | 'mtls' | 'portal_adapter' | 'manual_upload' | 'user_mediated';
  supportedOutput: ('FHIR' | 'DocumentReference' | 'VC' | 'SHL' | 'PDF')[];
  requiresPatientConsent: boolean;
  canSyncBack: boolean;
}
```

---

## 9. Proposed New / Improved User Flows

### 9.1 Patient: Prepare for Hospital Visit

```text
Open Wallet → Choose “Prepare for visit” → Select hospital/service → System checks missing documents → Request/import documents → Consent popup → Documents enter wallet → Generate VP/SHL → Hospital scans at arrival
```

### 9.2 Hospital Staff: Intake Verification

```text
Scan QR/SHL → Verify issuer/status/schema → View minimum dataset → Request additional data if needed → Contextual consent → Start service → Record audit → Issue new documents after visit
```

### 9.3 External Partner: Referral Into TrustCare

```text
Login Partner Portal → Select patient/referral type → Upload legacy docs or connect source → TrustCare creates DocumentReference + DQI → Maker/Checker review → Care Package generated → Receiving hospital triages → Accept/reject → Wallet updated
```

### 9.4 After Visit: Wallet Update

```text
Encounter completed → Hospital issues prescription/lab/certificate/discharge/appointment → VC added to Wallet → Optional sync-back to HIS → Sync Receipt VC issued
```

---

## 10. UX/UI Recommendations

### 10.1 Visual Design Principles

- Use Thai-first labels with English technical terms where necessary.
- Show patient journey states, not just database states.
- Always show “who issued”, “who can verify”, “when expires”, and “what it is for”.
- Use progressive disclosure: simple summary for patients, technical metadata for staff/admin.
- Replace flat lists with journey boards and readiness panels.
- Use badges consistently: Verified, Expiring, Revoked, Needs Review, Critical, Shared, Source Pending.

### 10.2 Role-Specific UI

| Role | Primary UX |
|---|---|
| Patient | Wallet, prepare for visit, request documents, share/revoke |
| Doctor | Intake verification, clinical minimum view, referrals |
| Nurse | Assisted intake, QR/SHL scan, missing document checklist |
| Maker | Prepare document issuance requests |
| Checker | Review/approve wallet documents |
| Hospital admin | KPIs, audit, connector adoption, queues |
| Integration engineer | Source mapping, DQI, connector health |
| System admin | Trust, TAO, schema, seed, security |

### 10.3 Menu Visibility Recommendation

| Menu | Patient | Doctor/Nurse | Maker/Checker | Hospital Admin | System Admin | Integration Engineer |
|---|---:|---:|---:|---:|---:|---:|
| Wallet | ✓ own | context | context | metadata | all metadata | no default |
| Prepare for Service | ✓ | ✓ | context | ✓ | ✓ | no |
| Document Requests | ✓ | assist | ✓ | ✓ | ✓ | technical only |
| Consent History | in Wallet | context | context | audit | audit | no |
| SHL / Smart Share | ✓ | ✓ | ✓ | ✓ | ✓ | diagnostics only |
| Referrals | view own | ✓ | ✓ | ✓ | ✓ | no |
| Partner Portal | no | ✓ | ✓ | ✓ | ✓ | ✓ setup |
| Trust Registry / TAO | no | no | no | ✓ | ✓ | no default |
| HIS Integration | no | no | no | ✓ | ✓ | ✓ |
| FHIR/Terminology | no | no | no | ✓ | ✓ | ✓ |

---

## 11. Technical Architecture Improvements

### 11.1 Backend

Add or improve:

```text
wallet.readiness
wallet.requestDocument
wallet.importDocument
wallet.buildServicePacket
wallet.shareForContext
wallet.sourceStatus
intake.verifyPresentation
intake.requestMoreData
careTransition.buildPackage
externalSource.requestPull
externalSource.importLegacyDocument
```

### 11.2 Frontend Components

Add reusable components:

```text
ServiceReadinessPanel
WalletDocumentGrid
DocumentRequestWizard
ContextualConsentDialog
SourceConnectorCard
DQIBadge
TrustBadge
CarePackageBuilder
VerificationSummaryPanel
PostVisitWalletUpdatePanel
```

### 11.3 Schema / Data

Avoid large schema changes unless required. Prefer enriching API responses from existing data.

Potential new tables if needed:

```text
wallet_document_requests
wallet_import_jobs
service_readiness_checks
intake_sessions
external_source_authorizations
```

### 11.4 API Response Example

```json
{
  "readinessContext": "opd_visit",
  "patientId": 414,
  "score": 82,
  "missing": ["recent_lab_result"],
  "criticalReady": true,
  "documents": [
    {
      "type": "patient_identity",
      "status": "active",
      "issuer": "TrustCare Central Hospital",
      "trustLevel": "verified",
      "source": "wallet",
      "presentableAsVp": true
    }
  ],
  "recommendedActions": [
    "request_recent_lab_from_source",
    "create_vp_for_checkin"
  ]
}
```

---

## 12. Proposed Roadmap

### Phase 1: Realign UX Around Wallet and Readiness

- Rename/reorganize menus.
- Create Prepare for Service page.
- Move consent into contextual dialogs.
- Add readiness score to Wallet.
- Improve dashboard KPIs.
- Clarify Trust Registry as Admin/TAO.

### Phase 2: Document Request and Source Import

- Add document request wizard.
- Support patient-uploaded legacy documents.
- Build DocumentReference + DQI review pipeline.
- Add external source connector capability registry.
- Add Partner Portal upload/review flow.

### Phase 3: Hospital Intake and Care Transition

- Add intake verifier workspace.
- Unify referral/cross-border/international into Care Transition Platform.
- Create Care Package builder.
- Add after-visit wallet update loop.

### Phase 4: Ecosystem Momentum

- Pilot with 1 hospital group + 1 public hospital + 1 private hospital partner.
- Add MorProm/HealthLink integration only when official API or lawful data path is confirmed.
- Extend source connectors based on actual hospital demand.
- Build metrics for friction reduction.

---

## 13. KPIs for Hospitals and MOPH Context

| KPI | Definition |
|---|---|
| Intake readiness rate | % patients arriving with sufficient wallet packet |
| Registration time reduction | Average minutes saved at front desk |
| Missing document rate | % encounters delayed by missing records |
| Verified document rate | % documents verified successfully at intake |
| External import success | % document requests successfully pulled/imported |
| DQI score | Average data quality score of imported records |
| Referral acceptance cycle time | Time from referral request to accept/reject |
| Patient control metric | % shares initiated/approved by patient |
| Reuse rate | Number of repeat uses of existing wallet documents |
| Hospital adoption momentum | Active issuers/verifiers/partners in network |

---

## 14. Opportunities

### For Public Hospitals and MOPH Agencies

- Reduce repeated paperwork and fragmented patient history requests.
- Improve referral continuity between levels of care.
- Support policy direction toward interoperability without forcing replacement of HIS.
- Create a practical bridge to MorProm/HealthLink where official data exchange exists.
- Improve auditability and consent management.

### For Private Hospitals

- Faster onboarding for new patients and medical tourists.
- Better patient experience and concierge readiness.
- Referral and partner document intake.
- Insurance/pre-authorization readiness.
- International care packages with verifiable documents.

### For Patients

- Own portable health documents.
- Reduce repeated requests for medical history.
- Use the same verified packet across hospitals.
- Control sharing and revoke access.

---

## 15. Challenges and Mitigation

| Challenge | Risk | Mitigation |
|---|---|---|
| No existing wallet ecosystem | Low initial document density | Start with hospital-issued wallet documents and patient upload/import |
| Legacy systems vary greatly | Integration cost | Use connector patterns + DocumentReference + DQI review |
| Trust policy complexity | Verifiers may not trust documents | Trust Registry + TAO + schema/status validation |
| Consent fatigue | Users blindly approve | Contextual, purpose-specific, short consent dialogs |
| Over-centralization concern | TrustCare seen as central data platform | Store minimum metadata; keep source-of-truth in HIS where appropriate |
| Digital divide | Some patients cannot use app | Printable QR, assisted wallet, guardian/proxy flows |
| Policy/API uncertainty | MorProm/HealthLink APIs may not be public | Use official integration only; support manual/user-mediated import |

---

## 16. Codex / Manus Implementation Prompt

```text
You are developing TrustCare Hospital Network.

Before coding, read:
- docs/ARCHITECTURE.md
- docs/CONTRIBUTING.md
- docs/SHL_CONTEXT_VERSIONING.md if SHL is touched

North Star:
TrustCare is not a generic health-app aggregator or central data warehouse. It is a hospital-enabled, patient-controlled portability ecosystem. Its purpose is to reduce friction at hospital service entry by helping patients collect, hold, verify, and present minimum trusted health information through Wallet, VC/VP, FHIR, SHL, consent, and trust registry mechanisms.

Task:
Realign UX/UI and functions across the system to make Wallet and Service Readiness the center of the product.

Key product changes:
1. Add or redesign a “Prepare for Service / Patient Intake Readiness” experience.
2. Make Wallet the main patient document cockpit.
3. Move consent out of primary side menu into contextual consent dialogs.
4. Treat SHL as Smart Share for a service context.
5. Reframe Integration/FHIR/Terminology as source feeders into Wallet.
6. Unify referral, cross-border, international, and partner portal under Care Transition workflows.
7. Move Trust Registry/TAO to Administration/Governance.
8. Add readiness score, DQI score, trust badges, missing document actions, and service-context packet generation.
9. Use activeRole from rolePolicy for menu visibility.
10. Keep legacy systems as source-of-truth where appropriate; do not make TrustCare a central EHR.

Do not overwrite server/routers.ts or drizzle/schema.ts entirely. Merge incrementally.

Recommended new components:
- ServiceReadinessPanel
- WalletDocumentGrid
- DocumentRequestWizard
- ContextualConsentDialog
- SourceConnectorCard
- DQIBadge
- TrustBadge
- CarePackageBuilder
- VerificationSummaryPanel
- PostVisitWalletUpdatePanel

Recommended new or improved procedures:
- wallet.readiness
- wallet.requestDocument
- wallet.importDocument
- wallet.buildServicePacket
- intake.verifyPresentation
- intake.requestMoreData
- careTransition.buildPackage
- externalSource.requestPull
- externalSource.importLegacyDocument

Acceptance criteria:
- Patients can prepare a service packet from Wallet.
- Hospitals can scan and verify enough data to start care faster.
- Consent appears in context, not as a generic menu destination.
- Legacy documents can enter as DocumentReference + hash + provenance.
- Wallet does not become a full central EHR.
- External app/source integrations are scoped to feeding Wallet documents only.
- Public/private hospital needs are both supported.
- pnpm check, pnpm test, and pnpm build pass.
```

---

## 17. References

- W3C Verifiable Credentials Data Model v2.0 — https://www.w3.org/TR/vc-data-model-2.0/
- HL7 FHIR R4 DocumentReference — https://hl7.org/fhir/R4/documentreference.html
- HL7 FHIR R4 Consent — https://www.hl7.org/fhir/R4/consent.html
- HL7 FHIR IPS — https://hl7.org/fhir/uv/ips/
- SMART Health Links — https://docs.smarthealthit.org/smart-health-links/spec/
- NHS App — https://www.nhs.uk/nhs-app/about-the-nhs-app/
- Singapore HealthHub — https://www.healthhub.sg/
- Android Health Connect — https://developer.android.com/health-and-fitness/health-connect
- MorProm privacy notice / platform information — https://mohpromt.moph.go.th/EN/termapplication/

