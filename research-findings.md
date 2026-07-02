# Research Findings for Trustcare Presentation

## Thai Healthcare Data Challenges (from PMC9635045)
- No standard for data collection and data archiving systems across hospitals
- Unclear guidelines, practices, and procedures for HIE
- Lack of standard practice due to fragmented administration
- Data ownership issues cause constraints in information sharing (complexity and processing time)
- Four main barriers: technical, economic, political, and legal
- Cross-organizational collaboration not fully compliant with evidence-based, patient-centric, timely, and safe practices
- Data redundancy occurs in one hospital database; ad hoc data collection upon visit
- Critical information not available on time → affects continuity of care
- Patients under-supported in their right to access their health data
- Health Link launched 2021 — first HIE nationwide platform, 50+ hospitals
- HSRI research: country's inadequately developed health information standards
- Lack of human resources in health informatics
- Lack of awareness and unfamiliarity with benefits of standards among policymakers

## Key Statistics
- Thailand Healthcare Market: USD 35.8B (2025) → USD 61.38B (2032)
- Global Digital Health Market: $162.1B (2024) → $573.5B (2030), 23.6% CAGR
- สปสช. (NHSO) approved Big Data บัตรทอง - connecting health data across agencies (2026)
- Health Link: 50+ hospitals connected (2021)
- ThaiRefer: Medical referral software developed by Thai hospitals

## Technology Standards
### W3C Verifiable Credentials (VC)
- Standard for creating digitally signed credentials
- Portable from one credential repository to another without reissuing
- Healthcare use cases: medical records, professional licenses, health certifications
- Patient privacy maintained through selective disclosure

### SMART Health Links (SHL)
- Secure URLs using shlink: scheme containing encrypted health information
- Built on HL7 FHIR standard
- Enables sharing complete health summary (medications, allergies, conditions)
- Consumer-mediated SMART on FHIR connection
- Passcode protection, expiry, max access controls

### HL7 FHIR International Patient Summary (IPS)
- Minimal, non-exhaustive set of basic clinical data
- Specialty-agnostic, condition-independent
- Designed for unplanned/emergency care across borders
- Standard for global interoperability

## MOPH Digital Health Strategy (2564-2568 / 2021-2025)
- Goal: ทุกคนบนแผ่นดินไทยสามารถเข้าถึงการบริการที่มีคุณภาพอย่างทั่วถึง
- Efficient use of health resources
- Sustainable health system
- 8 years of digital health foundation building (หมอพร้อม → Health Data Hub)

## Trustcare System Analysis (from Architecture)
### Core Capabilities
- 24 Verifiable Credential types across 9 categories
- 52 database tables, 13 migrations
- 33 frontend pages, 29 tRPC routers
- 17 portability modules (VC/VP engine)
- Maker/Checker workflow for credential issuance
- Trust Registry with DID:web and DID:key
- Smart Health Links (SHL) transport layer
- FHIR R4 canonicalization with DQI scoring
- Source of Truth connectors (HIS REST, Legacy DB View, CSV, HL7v2)
- Sync-Back architecture to legacy systems
- Cross-border referral support
- Medical tourism module
- Insurance claims and eligibility
- Consent management with expiry alerts
- Schema versioning for VC/VP

### Hospital Network
- 4 hospitals in demo: TCC (Central), TCP (Phuket International), TCM (Chiang Mai), Network-level
- Trust framework: TAO (Trust Anchor Organization)
- External trusted issuers: Siriraj, Ramathibodi, Bumrungrad
- External trusted verifiers: NHSO (สปสช.)

### Roles
- system_admin, hospital_admin, maker, checker, doctor, nurse, integration_engineer, patient

### Integration Points
- HIS REST API
- Legacy DB View
- CSV import
- HL7v2 messages
- FHIR native pass-through
- Document extraction
