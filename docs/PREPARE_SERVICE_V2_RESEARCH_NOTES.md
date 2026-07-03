# Prepare for Service v2 — Research Notes & Implementation Plan

## Source Documents
- `/home/ubuntu/upload/Pasted_content_08.txt` — Task instructions from user
- `/home/ubuntu/upload/TRUSTCARE_PREPARE_FOR_SERVICE_DEEP_RESEARCH_IMPLEMENTATION_SPEC.md` — Full spec (1826 lines)
- PR #12: `codex/prepare-service-core-workbench` branch on GitHub

## Key Architecture Decisions

### 1. Contract Hub (New Tables Needed)
- `contract_hub_contracts` — versioned service readiness contracts, bundle templates, VC schemas, etc.
- `contract_hub_artifacts` — linked artifacts (OpenAPI, JSON Schema, FHIR Questionnaire, etc.)
- Replaces static TypeScript readiness definitions in `shared/readiness.ts`
- 7 service contexts: opd_visit, emergency, referral, cross_border, medical_tourist, insurance_claim, pharmacy_dispense

### 2. Service Bundle System (New Tables Needed)
- `service_bundle_templates` — reusable bundle templates by context
- `service_bundle_instances` — actual bundle instances for a patient+context
- `service_bundle_items` — items within a bundle instance
- Status machine: Draft → MissingDocuments → Ready → ConsentRequired → Shared → Accepted → Closed

### 3. Wallet Import Jobs (New Tables Needed)
- `wallet_import_jobs` — tracks import operations from various sources
- Sources: HIS, LIS, RIS, PACS, partner_portal, payer, patient_upload, national_app, personal_health_app

### 4. Walk-in Wallet Connections
- DID/wallet binding flow for walk-in patients without pre-existing wallet

### 5. Existing Tables to Reuse
- `service_readiness_checks` — already tracks readiness assessments
- `wallet_document_requests` — already tracks document requests
- `issued_presentations` — already stores VPs
- `document_bundles` / `case_documents` — existing bundle infrastructure
- `care_packages` / `care_package_items` — existing care package system
- `partner_source_connectors` / `partner_source_attestations` — partner integration
- `mapping_versions` / `fhir_field_mappings` / `terminology_mappings` — data mapping
- `vc_schema_registry` — VC schema registry
- `audit_events` — audit trail

### 6. Role-Specific Views
- **Patient**: Select context → view readiness → import/upload → questionnaire → consent → create VP/SHL packet
- **Hospital**: Search patient → resolve contract → verify packet → request docs → import from HIS → issue to wallet → deploy bundle
- Patient CANNOT be Maker/Checker
- Hospital staff uses activeRole for access control

### 7. PDPA Requirements
- Contextual consent before packet creation
- Purpose limitation and data minimization
- Audit events for all operations
- Break-glass with reason for emergencies
- Consent receipt VC

### 8. Public API Endpoints
- `GET /api/prepare-service/contexts` — available contexts
- `POST /api/prepare-service/assess` — readiness assessment
- `POST /api/prepare-service/document-requests` — request documents
- `POST /api/prepare-service/import` — import/upload documents
- `POST /api/prepare-service/packets` — build VP/SHL packet
- `POST /api/prepare-service/verify-packet` — hospital verify
- `POST /api/hospital/wallet-deployments` — deploy to wallet
- `GET /api/contracts` — contract hub discovery
- `POST /api/contracts/resolve` — resolve applicable contract
- `POST /api/contracts/validate-packet` — validate against contract

### 9. Patient Use Cases (Tab Labels)
- เตรียมเข้ารับบริการ OPD
- ฉุกเฉิน
- ส่งต่อ/Referral
- ส่งต่อข้ามเครือข่าย
- เตรียมไปรักษาต่างประเทศ (NOT "ผู้ป่วยต่างชาติ")
- เคลมประกัน
- รับยา/เภสัชกรรม

### 10. Hospital Use Cases (Tab Labels)
- เตรียมรับบริการ OPD
- ฉุกเฉิน
- ส่งต่อ/Referral
- ส่งต่อข้ามเครือข่าย
- รับผู้ป่วยต่างชาติ (Hospital-only)
- เคลมประกัน
- รับยา/เภสัชกรรม
- Walk-in Wallet Onboarding (Hospital-only)
- Deploy/Issue to Wallet (Hospital-only)
- Partner Portal Intake (Hospital-only)

## Implementation Phases
1. Contract Hub Foundation (tables, seed, resolve API)
2. Patient Prepare for Service v2 (contract-driven readiness, import, questionnaire, packet)
3. Hospital Service Readiness Workbench (search, verify, deploy, issue)
4. Data Mapping v2 (contract-driven mapping, DQI, review queue)
5. Production Hardening (audit, consent, revocation, tests)

## External Research References
- NHS App: Patient-controlled pre-service access (identity, appointments, medicines, allergies, test results)
- Singapore HealthHub: Unified patient e-services (appointments, lab reports, immunization, payments)
- FHIR Questionnaire/SDC: Dynamic form generation from contracts
- FHIR DocumentReference/IHE MHD: Legacy document metadata standards
- SMART Health Links: Controlled sharing of health records via QR/URL
- W3C VC/VP: Verifiable credential issuance and presentation
- Thailand PDPA B.E. 2562: Sensitive health data requires explicit consent

## Deep Research Findings (July 2026)

### WHO GDHCN & Digital Health Wallets
- WHO GDHCN connects 82 countries, nearly 2 billion people (2025)
- 250,000 Hajj pilgrims carried verifiable health credentials in 2024
- Key principles: verifiable, portable, sovereign, privacy-respecting, under individual control
- Kenya "Afya Yangu": 31M enrolled, 30K new registrations/day
- Brazil "Meu SUS Digital": 200M+ users, 2.8B service interactions/year
- Thailand: Bureau of Digital Health, Ministry of Public Health involved
- Partnership: Indonesia, Thailand, Lao PDR for digital health wallet pilots
- Source: https://ahpsr.who.int/newsroom/news/item/21-05-2026-digital-health-wallets-must-be-owned-and-trusted-by-people

### EU Digital Identity Wallet (EUDI) Healthcare
- eIDAS 2.0 published April 2024, establishes EDIW framework
- Healthcare use cases: access health data, share health data, cross-border care, ePrescription
- 17 EU Member States enable eID for health record access
- POTENTIAL pilot project testing ePrescription use case
- European Health Data Space (EHDS) mandates EU-wide availability of: patient summaries, ePrescriptions, images/reports, lab results, discharge reports
- Source: https://pmc.ncbi.nlm.nih.gov/articles/PMC11624493/

### Epic MyChart eCheck-in Pattern
- Pre-visit digital check-in: verify personal info, sign forms, pay copay
- Pre-visit questionnaires pull responses into physician workflows
- Paperless workflow: forms sent directly to PAS inbox
- Source: Multiple Epic/healthcare sites

### International Patient Summary (IPS)
- HL7 FHIR Implementation Guide for standardized patient summary exchange
- Minimal dataset: allergies, medications, conditions, procedures, immunizations
- Cross-border interoperability standard
- Source: https://build.fhir.org/ig/HL7/fhir-ips/

### SMART Health Links (SHL)
- QR/URL-based sharing of health records
- Supports FHIR JSON, SMART Health Cards, API access
- Manifest + files architecture
- Passcode protection and expiry
- Source: https://docs.smarthealthit.org/smart-health-links/spec/

### IHE MHD (Mobile access to Health Documents)
- FHIR-based document sharing profile
- Replaces XDS for mobile/constrained devices
- DocumentReference + Bundle submission
- Source: https://profiles.ihe.net/ITI/MHD/

### Key Implementation Patterns from Research
1. **Contract-driven readiness** (not hardcoded forms) - FHIR Questionnaire/SDC
2. **Patient-controlled sharing** - WHO principle, EUDI pattern
3. **Pre-visit workflow** - Epic eCheck-in pattern (context → questionnaire → consent → packet)
4. **Document provenance** - IHE MHD DocumentReference with hash, author, custodian
5. **Verifiable packets** - W3C VP for credentials, SHL for larger bundles
6. **Cross-border interoperability** - IPS minimal dataset, EHDS standards
7. **Consent-first access** - PDPA explicit consent, EUDI user control
8. **Trust framework** - WHO GDHCN trust network, TAO for TrustCare
