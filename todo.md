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
- [x] Biometric Confirmation (WebAuthn) — เพิ่ม fingerprint/face unlock ก่อนแสดง QR ใน Patient Wallet
- [x] Offline-first Patient Wallet — เก็บ Health Cards ใน IndexedDB ให้ผู้ป่วยแสดง QR ได้แม้ไม่มี internet
- [x] Multi-language Support (EN/TH toggle) — เพิ่ม i18n สำหรับ Medical Tourist ที่ไม่อ่านภาษาไทย
- [x] PDF Export สำหรับ Clinical Summary — ให้ผู้ป่วยดาวน์โหลด Patient Summary เป็น PDF ได้
- [x] Integration Adapter SDK — สร้าง SDK/template สำหรับเชื่อมต่อ HIS ที่ใช้ HL7v2, FHIR REST, หรือ Legacy DB
- [x] Automated Data Quality Scoring — คำนวณ DQI score อัตโนมัติจาก FHIR validation rules
- [x] Consent Expiry Reminder — แจ้งเตือนผู้ป่วยก่อน consent หมดอายุ 7 วัน
- [x] Claim Analytics Dashboard — กราฟวิเคราะห์ claim approval rate, average processing time, top rejection reasons
- [x] Cross-border Partner Onboarding Wizard — Wizard สำหรับเพิ่ม partner hospital ต่างประเทศพร้อม trust credential exchange

## v2.1 Upgrade - RU_VC Patterns + Test Users + UX Improvements
- [x] Create test users for all 6 roles with demo login page (completed in v2.1.1; Manus OAuth retained as optional alongside demo-login)
- [x] Enhance Issuer with Checker/Maker workflow (batch create → approve/reject → issue) (completed in v2.2)
- [x] Enhance Wallet with Selective Disclosure/ZKP, QR presentation, access history
- [x] Enhance Verifier with camera QR scanning (html5-qrcode) (completed in v3.1)
- [x] Add persistent sidebar with back button on all guarded pages (completed in v2.1.1 DashboardLayout + RoleGuard back button; breadcrumb is backlog)
- [x] Move statistics boxes to bottom of pages, reduce size of action boxes at top
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

## v4.1 - Credential Display Redesign (Realistic Hospital Documents)
- [x] Create CredentialRenderer component with document-type-specific templates
- [x] Add realistic person photo to patient_identity and medical_certificate credentials
- [x] Redesign CredentialDetail page with hospital branding, formatted fields, photo
- [x] Update Wallet card display to show person photo and formatted credential preview
- [x] Replace raw JSON display with human-readable formatted credential view

## v4.2 - Hospital Consolidation (Fix Duplicate Hospital Data)
- [x] Unify hospital codes: merge TC-BKK/TC-CM/TC-PKT into TCC/TCP/TCM (single source of truth)
- [x] Update seed.ts to use TCC/TCP/TCM codes with proper Thai/English names
- [x] Remove duplicate hospital rows from DB (keep TCC/TCP/TCM, remove TC-BKK/TC-CM/TC-PKT)
- [x] Re-bind users/departments to correct hospital IDs
- [x] Verify Trust Registry binding is correct (only 3 hospitals)
- [x] Verify UI shows exactly 3 hospitals

## v4.3 - System Clean, Optimize, E2E Verification & Architecture Docs Update
- [x] Audit data binding: verify FK references across all tables (users→hospitals, credentials→users, wallet→credentials, etc.)
- [x] Check data missing: identify NULL fields that should have values, orphaned records
- [x] Check data mismatch: verify credential counts match wallet cards, trust registry matches hospitals
- [x] Clean dead code: remove unused imports, deprecated functions, orphaned files
- [x] Optimize: remove consolidate-hospitals.mjs and other one-time migration scripts
- [x] Fix E2E test failure (portability-flow.e2e.test.ts verification) — fixed trust registry DID mismatch
- [x] Run full test suite: all 164 tests passing (15 test files)
- [x] Update docs/ARCHITECTURE.md with current DB schema (42 tables), system structure, hospital codes
- [x] Update docs/CONTRIBUTING.md with current development guidelines (27 routers, 30 pages)
- [x] Push all changes to GitHub

## v4.4 - Bug Fixes & VP Display Redesign
- [x] Fix Logout bug: user clicks logout but gets redirected back to Dashboard
- [x] Fix person photo display: Patient photo and Doctor photo show broken images
- [x] Redesign VP/credential display to show as friendly real documents (not raw fields)
- [x] Improve seed data quality: Single Source of Truth for demo/seed patients, complete clinical data
- [x] Add 'สำเนา' watermark on credential document previews
- [x] Push all changes to GitHub

## v4.5 - HIS Adapter Fix & UI Overflow
- [x] Fix HIS adapter seed: reduce from 6 adapters to 3 (one per hospital, not 2 per hospital)
- [x] Fix UI overflow on mobile: adapter cards "ทดสอบ" button cut off on small screens

## v4.6 - QR Code Fix
- [x] Fix QR Code generation error: VP data too large for QR Code - use URL-based approach instead

## v2.2 - Avatar Image Improvements
- [x] Replace cartoon/illustration avatars in Credentials with realistic photos appropriate for each role (patient, doctor)

## v2.3 - Patient Photo Upload & Additional Role Avatars
- [x] Add patient photo upload feature via patient profile (schema + backend API + S3 storage)
- [x] Add patient photo upload UI in patient profile page
- [x] Integrate uploaded patient photo into credential rendering (fallback to demo avatar if no photo)
- [x] Generate nurse and pharmacist avatar images for credentials
- [x] Integrate nurse and pharmacist avatars into credential rendering

## v2.4 - Additional Role Avatars & Architecture Docs Update
- [x] Generate radiologist avatar (Thai radiologist in white coat)
- [x] Generate medical technologist avatar (Thai med tech in lab coat)
- [x] Integrate radiologist and med tech avatars into credential rendering
- [x] Update docs/ARCHITECTURE.md with all recent changes (avatars, DQI scoring, consent expiry, claim analytics, patient profile)
- [x] Update docs/CONTRIBUTING.md with current development state
- [x] Push all changes to GitHub
- [x] Fix stale audit_logs reference in VC_UNIQUENESS_RULES.md (corrected to audit_events)

## v2.5 - Fix Avatar Images & Page Performance
- [x] Fix avatar images not loading on production (dicebear cartoon showing instead of realistic photos)
- [x] Remove all dicebear/cartoon fallback references completely
- [x] Optimize page hydration speed (currently ~15s before interactive) — reduce bundle size, add lazy loading

## v2.6 - Performance Optimization
- [x] Add loading="lazy" to below-the-fold images across all components (CredentialRenderer, CredentialDetail, Wallet)
- [x] Implement Service Worker for static asset caching (cache-first for /manus-storage/ and vendor chunks, production-only registration)

## v2.7 - Avatar Fix, Identity Priority, Back Navigation
- [x] Fix patient avatar images still showing cartoon/dicebear instead of realistic photos (DB updated, generate-avatars.mjs rewritten)
- [x] Sort Identity credentials (patient_identity) to always appear at top of Wallet and all VC/VP lists (Wallet + Issuer)
- [x] Add Back button to Wallet page, Patient Profile page, and CredentialDetail page

## v2.7.1 - Avatar Image Fix (Production) & VP Back Button
- [x] Fix avatar image not displaying on production (DB updated all patients/staff with /manus-storage/ paths)
- [x] Add Back/Close button to Wallet credential detail (VP) view - both normal view and QR mode have explicit "ปิด" button

## v2.7.2 - Mobile Avatar Fix & VP Scroll Fix
- [x] Fix avatar image not showing on mobile (works on desktop but not mobile)
- [x] Fix VP detail dialog cannot scroll on mobile (content cut off, no overflow scroll)

## v3.6 - Care Transition Platform (PR #8 + Deep Research Enhancement)
### Backend & Data
- [x] Merge PR #8 (codex/referral-partner-portal-care-transition) - 8 new tables, careTransition + partnerPortal routers
- [x] Apply migration 0012_care_transition_partner_portal.sql
- [x] Validate all 8 new tables (care_transition_case_events, case_documents, case_tasks, partner_source_connectors, partner_source_attestations, care_packages, care_package_items, case_decisions)
- [x] Seed connectors: internal_referral, cross_border, medical_tourist, external_partner (5 connectors)
- [x] Seed cases: 1 internal referral, 1 cross-border outbound, 1 medical tourist, 1 partner inbound (4 cases)
- [x] Seed documents: at least 3 per case (referral_letter, lab_report, patient_summary, passport, insurance_card, etc.)
- [x] Seed tasks: initialize default tasks per case type
- [x] Seed decisions: at least 1 clinical acceptance per case
- [x] Generate care package via real backend path (FHIR Bundle + SHL + VP) — wired in CareTransitionWorkspace Packages tab
- [x] CareTransitionWorkspace Timeline tab (event stream view from case_events)
- [x] careTransition.workspace procedure returns unified case data with events/documents/tasks/decisions/packages
- [x] partnerPortal.dashboard procedure returns persistent case list for partner staff

### Frontend - Referral Page Redesign (/referral)
- [x] KPI cards (status flow visualization)
- [x] Referral case list with status badges
- [x] Case detail with CareTransitionWorkspace (Documents, Tasks, Decisions, Packages, Timeline tabs)
- [x] CareTransitionWorkspace integration with decision workflow
- [x] Referral creation wizard (patient select, destination, reason, documents, consent, submit) — ReferralCreationWizard component integrated

### Frontend - Cross-Border Page Redesign (/cross-border)
- [x] KPI cards (เคสทั้งหมด, เอกสาร, งานค้าง, แพ็กเกจ)
- [x] Filter cards (Cross-branch, Cross-border, External Partner)
- [x] Tabs (ทั้งหมด, ข้ามสาขา, ส่งออก, รับเข้า, พันธมิตร)
- [x] CareTransitionWorkspace with package generation
- [x] Partner trust verification panel — PartnerTrustVerification component integrated in CrossBorder page
- [x] Create wizard (direction, partner, patient, documents, translation, consent, package, send) — CrossBorderCreateWizard component integrated

### Frontend - International Page Redesign (/international)
- [x] KPI cards (เคสทั้งหมด, เอกสาร, งานค้าง, แพ็กเกจ)
- [x] Stage-based progress view (สอบถาม → สร้างโปรไฟล์ → อัปโหลดเอกสาร → ยืนยันตัวตน → ตรวจสอบข้อมูลทางการแพทย์ → จัดทำใบเสนอราคา → ตรวจสอบประกัน → ยืนยันนัดหมาย)
- [x] Status tabs (ทั้งหมด, สอบถาม, นัดหมายแล้ว, กำลังรักษา, ปิดเคส)
- [x] CareTransitionWorkspace integration
- [x] Document intake workspace — InternationalWorkflowPanels component (Document Intake panel)
- [x] Clinical pre-review panel — InternationalWorkflowPanels component (Clinical Pre-review panel)
- [x] Financial/quotation workflow — InternationalWorkflowPanels component (Financial panel)
- [x] Discharge packet generation — InternationalWorkflowPanels component (Discharge panel)

### Frontend - Partner Portal (/partner-portal)
- [x] Dashboard with KPI cards (Total cases, Pending review, Active tasks, Connectors, Packages)
- [x] Persistent case list with detail view (from backend)
- [x] Tabs (Cases, Connectors, New Case, Outbound)
- [x] Case creation wizard (type, patient, reason, source method, documents, attestation, submit) — PartnerPortal New Case tab with full form
- [x] Connector management (create, validate, activate) — PartnerPortal Connectors tab + Integration page
- [x] Document workspace (upload, type assignment, hash, preview, submit for review) — CareTransitionWorkspace Documents + Bundles tabs

### Governance & Trust
- [x] Verify Maker/Checker enforcement on VC issuance from case documents (canActAsCredentialMaker/Checker in rolePolicy.ts)
- [x] Verify patient role blocked from Partner Portal and Maker/Checker operations (staffProcedure added to careTransition + partnerPortal)
- [x] Verify outbound documents use VC/VP trust layer (generatePackage → createSmartHealthLinkPackage → createShlTrustArtifacts creates VC/VP)
- [x] Verify SHL used as transport/share package only (SHL = encrypted FHIR bundle delivery, VC = trust proof)

### Tests & Verification
- [x] TypeScript compilation: 0 errors
- [x] All existing tests pass (172 tests, 15 files)
- [x] New care-transition tests pass (4 tests in care-transition.test.ts)
- [x] Smoke test: /referral, /cross-border, /international, /partner-portal - all render correctly
- [x] Push to GitHub

## v3.7 - File Bundle System for Care Transition Cases
### Research & Design
- [x] Deep research healthcare document bundle standards (IHE XDS, FHIR DocumentReference, HL7 attachments)
- [x] Design File Bundle schema: 1 case → many bundles, 1 bundle → many files (PDF, Word, images, medical files, VC/VP, mixed)

### Backend
- [x] Create migration: document_bundles table (id, caseType, caseId, title, description, status, createdBy, createdAt)
- [x] Create migration: bundle_files table (id, bundleId, fileName, fileKey, mimeType, fileSize, fileType enum, vcCredentialId?, metadata JSON)
- [x] DB helpers: createBundle, addFileToBundle, getBundlesByCaseId, getBundleWithFiles
- [x] tRPC procedures: bundle.create, bundle.addFile, bundle.list, bundle.get, bundle.updateStatus

### Frontend
- [x] Bundle upload UI in CareTransitionWorkspace Bundles tab (drag-drop, multi-file, progress)
- [x] Bundle viewer: list bundles per case, expand to see files, preview/download
- [x] File type indicators (PDF icon, Word icon, Image thumbnail, VC/VP badge)
- [x] Integration with creation wizards (attach bundle during case creation, PartnerWizard real file upload + DID trust verification)

### Trust Layer Integration
- [x] VC/VP files in bundle: link to existing credential IDs, verify on display
- [x] Bundle attestation: generate bundle hash for integrity verification
- [x] SHL package generation from bundle (select files → create encrypted FHIR bundle → SHL link)

### Tests & Verification
- [x] TypeScript compilation: 0 errors
- [x] Vitest tests for bundle CRUD operations
- [x] Smoke test: create bundle, upload files, view bundle, generate SHL from bundle
- [x] Push to GitHub

## v3.7.1 - Inline PDF & Image Preview in BundleManager
- [x] Add preview modal/dialog for PDF files (iframe/embed with fallback)
- [x] Add preview modal/dialog for image files (full-size view with zoom & rotate)
- [x] Add preview button/icon to each file row in BundleManager
- [x] Support common MIME types: application/pdf, image/png, image/jpeg, image/gif, image/webp, image/svg+xml, image/bmp
- [x] Graceful fallback for unsupported file types (show download link instead)
- [x] TypeScript compilation: 0 errors
- [x] Tests passing (178/178)

## v3.7.2 - DICOM Viewer Integration

- [x] Install cornerstone-core and dicom-parser npm packages (MIT licensed, lightweight)
- [x] Create DicomViewer React component with windowing (W/L), zoom, pan controls
- [x] Integrate DicomViewer into BundleManager preview dialog for .dcm MIME types
- [x] Add DICOM metadata display panel (patient name, modality, study date, series)
- [x] Support application/dicom and .dcm file extension detection
- [x] TypeScript compilation: 0 errors
- [x] Tests passing (193 tests)

## v3.7.3 - Mobile Avatar Fix & UX/UI Improvements (RU_VC Style)

- [x] Fix patient avatar images not displaying on mobile (showing ? placeholder)
- [x] Improve credential detail dialog layout to match RU_VC style
- [x] Ensure card thumbnails/icons render properly on mobile Safari/Chrome
- [x] Match card list styling with RU_VC wallet card design
- [x] TypeScript compilation: 0 errors
- [x] Tests passing (193 tests)

## v3.8.0 - Service Readiness Seed Data & E2E Tests

- [x] Create seedServiceReadiness.ts script for incomplete wallet patients
- [x] Seed 6 new demo patients (P004-P009) with incomplete wallets
- [x] Seed 11 wallet cards across new patients
- [x] Seed 14 document requests with various statuses
- [x] Seed 11 readiness check history records
- [x] API test: verify readiness scores for all 7 patients
- [x] UX test: verify Prepare for Service page renders correctly
- [x] UX test: context switching works (OPD, emergency, cross_border, etc.)
- [x] UX test: document request panel shows active requests
- [x] Write serviceReadiness.test.ts (53 E2E tests)
- [x] All 7 contexts tested with full/partial/empty wallets
- [x] Score calculation formula verified
- [x] Edge cases: revoked credentials, null cardType, duplicates
- [x] Demo patient scenarios matching seeded data
- [x] Document request status machine validated
- [x] Source types validated
- [x] Role-based access patterns validated
- [x] Update ARCHITECTURE.md (Section 26: Service Readiness Module)
- [x] Update TRUSTCARE_SYSTEM_REALIGNMENT_HANDOFF.md (Sections 9-10)
- [x] Full test suite: 251 tests passing (21 test files)
- [x] TypeScript compilation: 0 errors
- [x] Push to GitHub

## v3.9.0 - Document Request Import Flow & VP Packet QR Verification

### Feature 1: Document Request Import Flow (Webhook/API)
- [x] Create Express webhook endpoint POST /api/webhook/document-import for HIS/LIS systems
- [x] Implement HMAC-SHA256 signature verification for webhook security
- [x] Handle status transitions: requested → imported → converted_to_vc (automatic)
- [x] On import: store raw document payload, update status to 'imported'
- [x] On convert: auto-issue VC from imported document, link to wallet card, update status to 'converted_to_vc'
- [x] Create tRPC procedure for manual import (staff can trigger import from UI)
- [x] Add webhook configuration management (register external systems, API keys)
- [x] Create audit trail entries for each status transition
- [x] Send notification to patient when document is imported/converted
- [x] Handle error cases: invalid document, duplicate import, expired request

### Feature 2: VP Packet QR Verification at Service Point (Staff Scanner)
- [x] Create /service-verify page for staff to scan VP Packet QR codes
- [x] Integrate html5-qrcode camera scanner component
- [x] Parse VP packet from QR (decode JWT, extract VP payload)
- [x] Verify VP signature against patient's DID
- [x] Verify each embedded VC against issuer trust registry
- [x] Display verification results: patient identity, readiness score, document list
- [x] Show trust badges (green/amber/red) for each verified credential
- [x] Display clinical-risk-ordered content (allergy → medication → conditions → labs)
- [x] Add service confirmation button (mark patient as checked-in/verified)
- [x] Record verification event in audit trail
- [x] Add menu item in sidebar for staff roles (nurse, doctor, hospital_admin)

### Shared
- [x] Write vitest tests for webhook endpoint (signature verification, status transitions)
- [x] Write vitest tests for VP verification logic
- [x] Full test suite passing (302 tests, 23 test files)
- [x] TypeScript compilation: 0 errors
- [x] Update ARCHITECTURE.md
- [x] Push to GitHub

## v3.10.0 - Realistic Portrait Photos for All Demo Users

### Portrait Generation (16 unique AI-generated portraits)
- [x] demo-sysadmin-001 (นพ.สมชาย ระบบดี) - Thai male doctor, 50s, authoritative
- [x] demo-hospadmin-001 (นางวิภา บริหารเก่ง) - Thai female admin, 45-50
- [x] demo-doctor-001 (นพ.ธนวัฒน์ รักษาดี) - Thai male doctor, 35-40
- [x] demo-doctor-002 (พญ.สุภาพร ใจดี) - Thai female doctor, 30-35
- [x] demo-nurse-001 (นางสาวพิมพ์ใจ ดูแลดี) - Thai female nurse, 28-32
- [x] demo-nurse-002 (นายอนุชา ช่วยเหลือ) - Thai male nurse, 30-35
- [x] demo-engineer-001 (นายปิยะ เชื่อมต่อดี) - Thai male IT engineer, 30-35
- [x] demo-patient-001 (นายสมชาย ใจดี) - Thai male, 45-50
- [x] demo-patient-002 (นางสาวมาลี วัฒนา) - Thai female, 35-40
- [x] demo-patient-003 (Mr. John Williams) - Caucasian male, 55-60
- [x] demo-patient-004 (นางสาวฮารุกะ ทานากะ) - Japanese female, 30-35
- [x] demo-patient-005 (นายวิชัย สุขสบาย) - Thai male elderly, 60-65
- [x] demo-patient-006 (นางพรทิพย์ มั่งมี) - Thai female, 50-55
- [x] demo-patient-007 (นายอภิชาติ รักสุขภาพ) - Thai male, 40-45
- [x] demo-patient-008 (Mr. David Chen) - Chinese-American male, 45-50
- [x] demo-patient-009 (นางสาวสุดา ใจเย็น) - Thai female young, 25-28

### Upload and Seed
- [x] Upload all portraits via manus-upload-file --webdev
- [x] Update user avatarUrl in database for all 16 demo users
- [x] Verify portraits display correctly in UI
- [x] Run full test suite (302 tests passing)
- [x] Save checkpoint and push to GitHub

## v3.11.0 - Mobile UI Fixes

### Bug Fixes
- [x] Profile page: avatar photo not displaying (shows fallback initial instead of uploaded photo)
- [x] Maker VC Dialog: duplicate template items in dropdown (same template listed 3 times)
- [x] Wallet page: header title/buttons/tabs overlapping on mobile viewport
- [x] Cross-border Referral: action buttons overlapping card content on mobile
- [x] Medical Tourist page: title text cut off and header layout broken on mobile
- [x] Run full test suite (302 tests passing)
- [x] Save checkpoint and push to GitHub

## v3.11.1 - SHL Page Date Rendering Fix

- [x] Fix "Objects are not valid as a React child (found: [object Date])" error on /shl page
- [x] Root cause: version.createdAt is a Date object passed directly to JSX via Row subtitle prop
- [x] Fix: Convert Date to string with new Date(version.createdAt).toLocaleString()
- [x] 302 tests passing, 0 TypeScript errors

## v3.11.2 - Checker Queue Schema Mismatch Fix

- [x] Fix credential_requests table schema mismatch between Drizzle code and actual DB
- [x] Update Drizzle schema: requesterId→makerId, reviewerId→checkerId, credentialType removed, requestData→credentialData, reviewComment→checkerComment
- [x] Add new columns to schema: requestNumber, submittedAt, reviewedAt, issuedAt
- [x] Update db.ts listCredentialRequests filters to use makerId/checkerId
- [x] Update routers.ts maker/checker workflow to use correct column names
- [x] 302 tests passing, 0 TypeScript errors

## v3.12.0 - Maker/Checker Workflow Improvements

- [x] Seed credential_requests with demo data (various statuses: draft, pending_review, approved, rejected, issued)
- [x] Update Issuer (Maker) page to use new field names (credentialData instead of requestData)
- [x] Add checker notification when maker submits request for review
- [x] Run full test suite (302 tests passing)
- [x] Save checkpoint and push to GitHub

## v3.13.0 - Claim Center Real DB + Realistic Seed Data

- [x] Fetch PR #11 (codex/claim-center-real-flows) and merge into main
- [x] Read architecture docs and assess current DB state
- [x] Add Claim Center DB tables (claim_intake_sessions, claim_documents, claim_packages, claim_submission_events, claim_payments, payer_rulesets)
- [x] Bind claim backend APIs to real DB (workbench, createReadiness, issueClaimPackageVc, submitToPayer, recordPayerResponse, recordPayment)
- [x] Seed 6 realistic claim scenarios (NHSO OPD, SSO rehab, Private IPD, Travel insurance, CSMBS dental, Self-pay pharmacy)
- [x] Each scenario: FHIR Claim JSON, evidence docs, ClaimPackageCredential, payer submission, adjudication, payment, audit events
- [x] Generate realistic person avatar photos for all seed users
- [x] Improve existing seed/mock data quality across all entities (patients, doctors, hospitals)
- [x] Verify UX: /claim-center tabs work, buttons functional, wallet displays claims
- [x] Simulated data clearly labeled with simulationFlag in DB and UI
- [x] Run full test suite (307 tests passing)
- [x] Save checkpoint and push to GitHub

## v3.14.0 - Claim Center Real DB Binding + Detail Page

- [x] Refactor buildClaimWorkbench to query from claim_cases + claim_packages + claim_payments tables
- [x] Remove simulated data from claimCenter.ts, use real DB queries
- [x] Join users table to show patient full names in Claim Worklist (not "Patient #743")
- [x] Create Claim Detail page (/claim-center/:id) with:
  - [x] Timeline showing all state changes (intake → packaged → submitted → adjudicated → paid)
  - [x] Documents tab listing all claim_documents with download links
  - [x] FHIR Payload tab showing ClaimPackageCredential JSON
  - [x] Payer Response tab showing adjudication result and payment info
- [x] Add route in App.tsx for /claim-center/:id
- [x] Run full test suite (307 tests passing)
- [x] Save checkpoint and push to GitHub

## v3.15.0 - UX Improvements and Bug Fixes

- [x] Audit all pages for Date object rendering in JSX and fix (createdAt, updatedAt, etc.)
- [x] Add SHL detail panel that shows on click without scrolling (useRef + scrollIntoView)
- [x] Fix Issuer credential type display - removed patient_identity-first sort, now sorts by issuedAt desc
- [x] Show patient/maker names in Checker Queue (JOIN users table instead of showing IDs)
- [x] Show maker/checker names in Issuer requests tab (JOIN users table)
- [x] Add SLA tracking - show waiting time column with red highlight if over 24 hours
- [x] Run full test suite (307 tests passing)
- [x] Save checkpoint and push to GitHub
