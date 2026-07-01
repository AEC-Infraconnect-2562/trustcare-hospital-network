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

## PR Merges
- [x] PR #1 merged: Patient Data Portability Layer (FHIR canonicalization, VC issuance/verification, sync-back planning, Portability Workbench UI)
  - server/portability/ module (fhir.ts, vc.ts, syncBack.ts, policy.ts, clinicalDocuments.ts, types.ts, utils.ts)
  - PortabilityWorkbench.tsx UI with 4 tabs (Canonical, VC Documents, Verify, Sync Back)
  - Extended credential enums: medical_certificate, prescription, claim_package, sync_receipt
  - E2E test + unit tests (12 tests passing)
  - GitHub Actions CI (advisory, non-blocking)
- [x] PR #2 merged: Finish portability sync-back hardening
  - executeSyncBackPlan deterministic execution (accepted/rejected/queued_for_review)
  - SyncReceiptCredential issuance with ACK/readback/checksum evidence
  - tRPC portability.executeSyncBack endpoint
  - Workbench "Execute Sync and Issue Receipt VC" button
  - CI fix (pnpm version from packageManager), analytics script conditional injection
  - Unit + E2E tests updated (13 tests total)
- [x] PR #3 merged: Add production trust hardening
  - Asymmetric JWK signing (ES256/EdDSA) with JWKS endpoint
  - Trust registry verification mode (off/advisory/required)
  - Credential status events + revocation checking (BitstringStatusListEntry)
  - Sync reconciliation jobs (read_back/ack_replay/manual_review)
  - Sync adapter manifest
  - Production tab in Portability Workbench
  - Production hardening runbook
  - credential_status_events + sync_reconciliation_jobs tables

## Future Enhancements (Backlog)
- [ ] Demo Seed Data — สร้าง script เพิ่มโรงพยาบาลตัวอย่าง 3-5 แห่ง พร้อมผู้ป่วย, VC, Consent, Referral ตัวอย่างเพื่อทดสอบ flow ข้ามโรงพยาบาลได้ทันที
- [ ] Real-time Notification Center — หน้า Notification รวมการแจ้งเตือนทั้งหมด (referral ใหม่, VC หมดอายุ, claim ถูกปฏิเสธ) แบบ role-based
- [ ] Camera QR Scanner — ใช้ WebRTC เปิดกล้องใน Verifier Portal ให้แพทย์สแกน QR จาก Wallet ของผู้ป่วยได้จริงโดยไม่ต้องพิมพ์ token
- [ ] Biometric Confirmation (WebAuthn) — เพิ่ม fingerprint/face unlock ก่อนแสดง QR ใน Patient Wallet
- [ ] Offline-first Patient Wallet — เก็บ Health Cards ใน IndexedDB ให้ผู้ป่วยแสดง QR ได้แม้ไม่มี internet
- [ ] Multi-language Support (EN/TH toggle) — เพิ่ม i18n สำหรับ Medical Tourist ที่ไม่อ่านภาษาไทย
- [ ] PDF Export สำหรับ Clinical Summary — ให้ผู้ป่วยดาวน์โหลด Patient Summary เป็น PDF ได้
- [ ] Integration Adapter SDK — สร้าง SDK/template สำหรับเชื่อมต่อ HIS ที่ใช้ HL7v2, FHIR REST, หรือ Legacy DB
- [ ] Automated Data Quality Scoring — คำนวณ DQI score อัตโนมัติจาก FHIR validation rules
- [ ] Consent Expiry Reminder — แจ้งเตือนผู้ป่วยก่อน consent หมดอายุ 7 วัน
- [ ] Claim Analytics Dashboard — กราฟวิเคราะห์ claim approval rate, average processing time, top rejection reasons
- [ ] Cross-border Partner Onboarding Wizard — Wizard สำหรับเพิ่ม partner hospital ต่างประเทศพร้อม trust credential exchange

## v2.1 Upgrade - RU_VC Patterns + Test Users + UX Improvements
- [ ] Remove Manus OAuth, create test users for all 6 roles with demo login page
- [ ] Enhance Issuer with Checker/Maker workflow (batch create → approve/reject → issue)
- [ ] Enhance Wallet with Selective Disclosure/ZKP, QR presentation, access history
- [ ] Enhance Verifier with camera QR scanning (html5-qrcode)
- [ ] Add persistent sidebar with breadcrumb navigation and back button on all pages
- [ ] Move statistics boxes to bottom of pages, reduce size of action boxes at top
- [ ] Ensure menu visibility matches role permissions correctly

## v2.1.1 - Menu Visibility & Role-Based Access Fix (Current Task)
- [x] Add missing icons (BarChart3, Fingerprint) to DashboardLayout iconMap
- [x] Wrap ExecutiveDashboard with DashboardLayout
- [x] Wrap PatientIdentity with DashboardLayout
- [x] Add demo login system (seed users, express route, Home.tsx demo login UI)
- [ ] Add role-based route guard to prevent unauthorized page access
- [x] Verify menu items match each role's functional permissions in backend
- [x] Write tests for role-based menu filtering and demo login

## v2.1.2 - Multi-Role Support (Issuer Maker/Checker)
- [x] Create user_roles table for additional role assignments (issuer_maker, issuer_checker, etc.)
- [x] Add db helpers: assignUserRole, removeUserRole, getUserAdditionalRoles
- [x] Update auth.me to return additionalRoles array alongside systemRole
- [x] Update DashboardLayout menu visibility to check combined roles (systemRole + additionalRoles)
- [x] Issuer menu visible when user has systemRole in [system_admin, hospital_admin, doctor] OR additionalRoles includes issuer_maker/issuer_checker
- [x] Update clinicalProcedure/issuer access to check additionalRoles
- [x] Seed demo users with Maker/Checker assignments (nurse as maker, doctor as checker)
- [x] Write tests for multi-role menu visibility

## v2.1.3 - Gap Fixes
- [x] Add automated tests for demo login flow (seed, getDemoUsers, demoLogin route, token/session)
- [x] Unify menu role definitions: sync shared/menuConfig.ts with DashboardLayout allMenuItems

## v2.1.4 - Role Selection Login (Everyone Can Be Patient)
- [x] Update Demo Login: show all available roles per user (systemRole + patient for all staff)
- [x] Add "activeRole" concept in session/context (stored in cookie or localStorage)
- [x] Add role switcher dropdown in DashboardLayout sidebar footer
- [x] Update menu visibility to use activeRole (not just systemRole)
- [x] Backend: add switchRole mutation that validates user can assume the role
- [x] Update tests for role switching
