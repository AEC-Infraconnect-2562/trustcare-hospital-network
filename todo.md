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
- [ ] Push to GitHub repository (AEC-Infraconnect-2562/tdc-reserve-prototype)
