# Trustcare Hospital Network - TODO

## Database & Schema
- [x] Hospital network management tables (hospitals, departments, staff)
- [x] Patient wallet & credential tables (credentials, wallet_cards)
- [x] VC issuer tables (credential_templates, issued_credentials, revocations)
- [x] Consent management tables (consent_records, consent_policies, purposes)
- [x] Referral management tables (referrals with state machine)
- [x] FHIR mapping tables (field_mappings, terminology_mappings)
- [x] Audit event tables (audit_events, access_logs)
- [x] Notification tables (notifications)

## Backend API (tRPC Routers)
- [x] Hospital management router (CRUD hospitals, departments, staff)
- [x] Patient wallet router (list cards, present credential, access history)
- [x] VC issuer router (issue, revoke, list templates, credential history)
- [x] VC verifier router (verify presentation, trust badge, clinical display)
- [x] Consent engine router (grant, revoke, query consent, policy management)
- [x] Referral router (create, accept, progress, complete, reject)
- [x] FHIR mapping router (field mappings, data preview, sync status)
- [x] Terminology mapping router (search codes, LLM suggest, accept/reject)
- [x] Audit router (query events, export, statistics)
- [x] Dashboard router (statistics, charts, recent activity)
- [x] Notification router (critical events, owner notifications)

## Frontend Pages
- [x] Landing page with login
- [x] Dashboard (role-based statistics, charts, recent activity)
- [x] Hospital Management (จัดการเครือข่าย) - list, add, edit hospitals
- [x] Patient Wallet (กระเป๋าสุขภาพ) - card metaphor, QR present
- [x] VC Issuer Portal (ออกใบรับรอง) - template select, issue, revoke
- [x] VC Verifier Portal (ตรวจสอบใบรับรอง) - scan QR, trust badge, clinical view
- [x] Consent Management (จัดการความยินยอม) - anti-dark-pattern UI
- [x] Referral Management (ส่งต่อผู้ป่วย) - state machine workflow
- [x] FHIR Mapping Studio (แผนที่ข้อมูล FHIR) - field mapping, preview
- [x] Terminology Mapping (จับคู่รหัสมาตรฐาน) - LLM-assisted mapping
- [x] Audit Trail (บันทึกการเข้าถึง) - searchable log, export
- [x] Settings & Profile (ตั้งค่าระบบ)

## UX/UI Requirements
- [x] Thai language interface (no crypto jargon)
- [x] DashboardLayout with compact grouped sidebar menu
- [x] Dark/Light theme toggle
- [x] Role-based menu visibility (SystemAdmin, HospitalAdmin, Doctor, Nurse, IntegrationEngineer, Patient)
- [x] Card metaphor for patient wallet
- [x] Trust badge (green/yellow/red) for verifier
- [x] Clinical risk-ordered display (allergy → medications → conditions → labs)
- [x] Anti-dark-pattern consent screens
- [x] Referral state machine (Requested → Accepted → InProgress → Completed → Replied / Rejected)

## Integration & Services
- [x] SD-JWT VC signing and verification service
- [x] FHIR R4 resource handling (IPS, AllergyIntolerance, MedicationStatement)
- [x] QR code generation and scanning
- [x] LLM-assisted terminology mapping (ICD-10, SNOMED CT, LOINC, TMT)
- [x] Owner notification on critical events
- [x] Paper QR fallback for elderly patients

## Testing & Quality
- [x] Vitest tests passing (7 tests - auth, hospital, credential routers)
- [x] TypeScript compilation clean (no errors)
- [x] All pages rendering correctly verified via screenshots

## Deployment
- [x] Push to GitHub repository (AEC-Infraconnect-2562/trustcare-hospital-network)

## CarePass Network v2.0 Upgrade - New Modules

### Database Schema Additions
- [x] Claims/E-Claim tables (claim_cases, payer_adapters, coverage_eligibility, claim_packages, claim_validations)
- [x] Medical Tourist tables (international_cases, travel_documents, quotations, interpreter_assignments)
- [x] Integration Layer tables (integration_adapters, adapter_health_logs, mapping_versions, event_logs)
- [x] Trust Registry tables (trust_entries, provider_credentials, partner_hospitals)
- [x] SHL tables (smart_health_links, shl_access_logs)
- [x] Patient Identity Link tables (patient_identifiers, mpi_matches)
- [x] Cross-border referral extensions (referral type, partner org, language, jurisdiction)

### Backend Routers
- [x] Claim router (eligibility check, pre-auth, claim package, submit, status, rejection/resubmit)
- [x] Medical Tourist router (inquiry, documents, clinical review, quotation, insurance guarantee, discharge packet)
- [x] Integration router (adapter registry, health check, test, mapping versions, event trace)
- [x] Trust Registry router (register/verify issuers, verifiers, partner hospitals, schema versions)
- [x] SHL router (create, manifest, revoke, access log)
- [x] Enhanced Referral router (cross-branch packet, cross-border, consent-gated, counter-referral, closed-loop)
- [x] Patient Identity router (link identifiers, MPI match, branch HN links)

### Navigation & Menu
- [x] Add Claim Center menu group (ศูนย์เคลม)
- [x] Add International Patient Center menu (ศูนย์ผู้ป่วยต่างชาติ)
- [x] Add Integration Console menu (คอนโซลเชื่อมต่อ)
- [x] Add Trust Registry menu (ทะเบียนความน่าเชื่อถือ)
- [x] Enhance Referral menu with cross-branch/cross-border sub-items
- [x] Add Executive Dashboard (แดชบอร์ดผู้บริหาร)

### Frontend Pages
- [x] Claim Center page (work queue, eligibility, pre-auth, claim package, submission, rejection, payment)
- [x] Medical Tourist page (inquiry, document intake, clinical review, quotation, appointment, discharge packet, follow-up)
- [x] Integration Console page (adapter registry, connections, health monitoring, event trace, sandbox)
- [x] Trust Registry page (issuers, verifiers, partners, schema versions, credential status)
- [x] SHL Management page (create links, manage expiry, access logs)
- [x] Enhanced Referral page (cross-branch workflow, cross-border workflow, packet generation, counter-referral)
- [x] Executive Dashboard page (adoption, referral KPIs, claim metrics, medical tourist metrics, integration health)
- [x] Patient Identity page (linked identifiers, branch HN/MRN, MPI status)
