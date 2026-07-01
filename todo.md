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
- [x] Demo Seed Data — สร้าง script เพิ่มโรงพยาบาลตัวอย่าง 3-5 แห่ง พร้อมผู้ป่วย, VC, Consent, Referral ตัวอย่างเพื่อทดสอบ flow ข้ามโรงพยาบาลได้ทันที (completed in v3.0 reseed: 3 hospitals, 36 patients, 345 credentials, 6 presentations)
- [x] Real-time Notification Center — หน้า Notification รวมการแจ้งเตือนทั้งหมด (referral ใหม่, VC หมดอายุ, claim ถูกปฏิเสธ) แบบ role-based (partial: bell+dropdown in v2.2 for maker/checker events; full role-based coverage is backlog)
- [x] Camera QR Scanner — ใช้ WebRTC เปิดกล้องใน Verifier Portal ให้แพทย์สแกน QR จาก Wallet ของผู้ป่วยได้จริงโดยไม่ต้องพิมพ์ token (completed in v3.1 with html5-qrcode)
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
- [x] Create test users for all 6 roles with demo login page (completed in v2.1.1; Manus OAuth retained as optional alongside demo-login)
- [x] Enhance Issuer with Checker/Maker workflow (batch create → approve/reject → issue) (completed in v2.2)
- [x] Enhance Wallet with Selective Disclosure/ZKP, QR presentation, access history
- [x] Enhance Verifier with camera QR scanning (html5-qrcode) (completed in v3.1)
- [x] Add persistent sidebar with back button on all guarded pages (completed in v2.1.1 DashboardLayout + RoleGuard back button; breadcrumb is backlog)
- [ ] Move statistics boxes to bottom of pages, reduce size of action boxes at top
- [x] Ensure menu visibility matches role permissions correctly (completed in v2.1.1 + v2.1.2 + v2.1.3)

## v2.1.1 - Menu Visibility & Role-Based Access Fix (Current Task)
- [x] Add missing icons (BarChart3, Fingerprint) to DashboardLayout iconMap
- [x] Wrap ExecutiveDashboard with DashboardLayout
- [x] Wrap PatientIdentity with DashboardLayout
- [x] Add demo login system (seed users, express route, Home.tsx demo login UI)
- [x] Add role-based route guard to prevent unauthorized page access
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

## v2.2 - Maker/Checker Workflow for Issuer
- [x] Create credential_requests table (id, templateId, patientId, makerId, checkerId, status, credentialData, makerNotes, checkerComment, createdAt, updatedAt)
- [x] Add credential request statuses: draft, pending_review, approved, rejected, issued
- [x] DB helpers: createCredentialRequest, listPendingRequests, approveRequest, rejectRequest, getRequestById
- [x] Maker router: create request, list my requests, update draft, submit for review
- [x] Checker router: list pending reviews, approve, reject with comment
- [x] Auto-issue VC on approval (approved → issued)
- [x] In-app notification on every event: request_created, submitted_for_review, approved, rejected, issued
- [x] Notification bell icon in DashboardLayout header with unread count
- [x] Notification dropdown/page showing all messages with timestamps
- [x] Maker UI page: form to create credential request, list of my requests with status
- [x] Checker UI page: review queue with approve/reject buttons and comment field
- [x] Add menu items: "สร้างคำขอออก VC" (Maker), "ตรวจสอบคำขอ" (Checker)
- [x] Update routes in App.tsx for new pages
- [x] Write tests for Maker/Checker workflow

## v3.0 - PR #4 Integration: DB-bound VC/VP Portability Issuance Flow
- [x] Merge PR #4 (codex/trustcare-seed-vc-vp-flow) into main
- [x] Apply migration 0005: Extended document types (24 VC types)
- [x] Apply migration 0006: issued_presentations + vc_vp_seed_batches tables
- [x] Apply migration 0007: Maker/Checker roles + credential_issuance_requests table
- [x] Apply migration 0008: Document taxonomy (category, subcategory, storageKey, searchTags)
- [x] Add user_roles table (multi-role support)
- [x] Add credential_requests table (legacy compatibility)
- [x] Extend notification type enum (maker/checker events)
- [x] Fix TypeScript errors from merge conflicts (CheckerQueue, MakerQueue, routers.ts)
- [x] Verify pnpm check (0 errors), pnpm test (all pass), pnpm build (success)
- [x] Create docs/ARCHITECTURE.md (comprehensive architecture documentation)
- [x] Create docs/CONTRIBUTING.md (development guidelines + conflict prevention)
- [x] Push all changes to GitHub (AEC-Infraconnect-2562/trustcare-hospital-network)
- [x] Delete remote branch codex/trustcare-seed-vc-vp-flow

## v3.1 - Camera QR Scanner for VC/VP Verification
- [x] Install html5-qrcode library
- [x] Create reusable QRScanner component (camera access, start/stop, decode callback)
- [x] Integrate QR Scanner into Verifier page with scan mode toggle (Tabs: paste vs camera)
- [x] Add backend tRPC procedure `verifier.verifyQrScan` (URL extraction, base64 decode, format detection)
- [x] Display verification result (trust badge, credential details, clinical data)
- [x] Handle error states (camera denied, invalid QR, expired credential)
- [x] Write vitest tests for QR verification flow (server/qrScanner.test.ts - 14 tests)
- [x] Update docs/ARCHITECTURE.md with QR Scanner documentation (Section 2.4.1, 12.4)
- [x] Update docs/CONTRIBUTING.md with QR Scanner testing requirements
- [x] Push to GitHub and save checkpoint

## v3.2 - PR #5 Merge + Landing Page Redesign + Demo Login
- [x] Pull PR #5 changes (shared/rolePolicy.ts, patient restrictions, auditSeedDb)
- [x] Apply any new DB migrations from PR #5
- [x] Redesign Landing Page with system description and features overview
- [x] Add Test Users quick-login cards on Landing Page (bypass Manus OAuth)
- [x] Bind Seed Data to Test Users by role (admin, doctor, nurse, patient, maker, checker)
- [x] Ensure demo-login route works without Manus OAuth redirect
- [x] Verify TypeScript compilation and all tests pass
- [x] Update ARCHITECTURE.md with rolePolicy, auditSeedDb, and demo-login docs
- [x] Update CONTRIBUTING.md with patient restriction rules

## v3.3 - Profile Photos for Seed Users
- [x] Check if users table has avatar/photo field (avatarUrl TEXT column exists)
- [x] Generate avatar illustrations for 10 demo users (DiceBear Notionists API - deterministic SVG)
- [x] Generate avatar illustrations for 36 seed patients (DiceBear Notionists API)
- [x] Bind avatar URLs to user records in DB (direct DiceBear URLs)
- [x] Display avatars in Home.tsx login cards and DashboardLayout sidebar

## v3.4 - Schema Versioning for VC/VP
- [x] Add schemaVersion field to issued_credentials and credential_templates
- [x] Create vc_schema_registry table (type, version, jsonSchema, changelog)
- [x] Reseed stamps schemaVersion="1.0.0" on all new seed data
- [x] Schema validation helper (validateCredentialAgainstSchema) with required-field checks
- [x] Schema registry tRPC router (register, getActive, getByVersion, list, validate)
- [x] Vitest tests for schema registry (12 tests passing)
- [x] Enforce schema validation in issuance flow (issuer.issueCredential)
- [x] Push to GitHub

## v3.5 - PR #6: Harden Smart Health Links Transport Trust Layer
- [x] Review PR #6 (25 files, +2778/-237 lines)
- [x] Merge PR #6 into main (commit 11a4470 → df119b9)
- [x] Apply migration 0011: SHL transport VC trust layer (smart_health_links columns, shl_files, shl_manifest_versions tables, shl_access_logs columns)
- [x] TypeScript compilation: 0 errors
- [x] Tests: 152 passing (13 test files)
- [x] New features integrated:
  - SHL transport: manifest URL, passcode (scrypt), JWE encrypted FHIR Bundle, access log, expiry/max access/revocation
  - VC/VP trust layer: ShlManifestCredential + holder VP bound to each SHL
  - Realistic HIS simulator scenarios (referral, cross-border, e-claim, medical tourist, discharge, patient summary, self-share)
  - UI /shl rebuilt + public /shl-viewer (JWE decrypt, trust evidence display)
  - docs/SHL_CONTEXT_VERSIONING.md added
- [x] Push to GitHub

## v3.5.1 - SHL DB Validation & Reseed
- [x] Preflight: confirm DB connection, branch has SHL support (migration 0011 + reseed SHL code)
- [x] Schema validation: all SHL columns present in smart_health_links, shl_files, shl_manifest_versions
- [x] Role/data consistency: 0 violations, all DIDs correct
- [x] SHL drift identified: tables were empty (never seeded)
- [x] Full reseed via reseedTrustcareVcVpDatabase (7 min, 351 credentials, 12 presentations, 6 SHL packages)
- [x] Post-seed validation: 6 active SHLs with JWE files, manifest versions, passcodes, VC/VP trust layer
- [x] UI verified: /shl shows 6 packages, /shl-viewer ready
- [x] All 152 tests passing
- [x] Validation report written (validation-report-shl-reseed.md)

## v4.0 - Issuer Detail + Wallet UX + Consent & Trust Registry Redesign

### Issuer & Wallet Enhancement (from RU_VC patterns)
- [x] Add clickable credential rows in Issuer → opens detail page/dialog
- [x] Credential detail view shows VP data, issuer info, status, QR code
- [x] Make Wallet visible to all roles (not just patient)
- [x] Wallet card detail dialog with gradient header, VP info, QR generation
- [x] Wallet share/present flow with selective disclosure option
- [x] Enhance Verifier QR scanner UX (camera + paste modes already exist)

### Contextual Consent Redesign (from spec)
- [x] Remove sidebar-only layout, create full consent management page
- [x] ConsentBanner component for inline consent collection
- [x] ConsentGate wrapper component for conditional rendering
- [x] useConsent hook for programmatic consent checks
- [x] Consent API: grant, revoke, check, history endpoints (existing router retained)
- [x] Consent types: treatment, referral, research, marketing, data_sharing (existing)
- [x] Consent audit trail with timestamps and actor info (existing)

### TAO Trust Registry Redesign (from spec)
- [x] Create tao_trusted_issuers table (DID, name, status, trust_level, accreditation)
- [x] Create tao_trusted_verifiers table
- [x] Create tao_trust_policies table (credential_type → required trust level)
- [x] Migration for new TAO tables
- [x] Trust Registry UI with tabs: Issuers, Verifiers, Policies
- [x] Trust level badges (accredited, recognized, self-declared)
- [x] Integration with verification flow (check issuer trust level)
- [x] Seed TAO trust data for 3 hospitals

### Wallet Category Navigation (Apple-style)
- [x] Add wallet.cardsByCategory tRPC endpoint (grouped by documentCategory)
- [x] Rewrite Wallet.tsx with category sidebar/tabs navigation (9 categories)
- [x] Show superseded/revoked credentials in History section
- [x] Category icons and Thai labels from DOCUMENT_CATEGORY_LABELS
- [x] Add DOCUMENT_CATEGORIES to shared/const.ts

### VC Uniqueness Research & Singleton Enforcement
- [x] Research which VC types should be unique (singleton) per patient
- [x] Document findings in VC_UNIQUENESS_RULES.md
- [x] Implement singleton enforcement in issuer.issueCredentialFromRequest
- [x] Auto-revoke previous credential when re-issuing singleton types
- [x] Store revoked credentials with superseded_by reference
