# TrustCare System Realignment — Task Instructions

## Source: Pasted_content_06.txt

**PR:** https://github.com/AEC-Infraconnect-2562/trustcare-hospital-network/pull/9
**Branch:** codex/system-realignment-wallet-readiness
**Commit:** da61cb6 Add service readiness wallet flow

## Steps Required:

1. Review & merge PR #9
2. Pull latest from GitHub
3. Read docs: ARCHITECTURE.md, CONTRIBUTING.md, TRUSTCARE_SYSTEM_REALIGNMENT_HANDOFF.md
4. Apply migration: `drizzle/0013_service_readiness_wallet_requests.sql`
5. Validate DB: `service_readiness_checks`, `wallet_document_requests` tables exist with indexes
6. Validate: `wallet_cards.credentialId` links to `issued_credentials.id`, VC for VP must be `status=active`, VC for readiness must have `sdJwtVc IS NOT NULL`
7. Seed data for 7 contexts: OPD, Emergency, Referral, Cross-border, Medical tourist, Insurance claim, Pharmacy
8. Each context needs: ready docs in Wallet + missing docs + real VC for VP + audit history
9. Test UX: `/prepare-service`, readiness score, missing docs, document request wizard, contextual consent, VP service packet QR, DB writes to `issued_presentations`, `service_readiness_checks`, `wallet_document_requests`
10. Test roles: Patient, Doctor/Nurse, Maker, Checker, Integration engineer, Hospital admin, System admin
11. Run: `pnpm check`, `pnpm test`, `pnpm build`
12. Deploy via checkpoint after validation

## Acceptance Criteria:
- `/prepare-service` works from sidebar and Wallet CTA
- Readiness reads from DB/Wallet/issued VC (not mock)
- Document request saved to DB
- VP service packet from signed VC
- Contextual consent in flow before VP
- No hardcoded patientId or placeholder
- DB production-ready

## Key Spec Points (from TRUSTCARE_SYSTEM_REALIGNMENT_UX_UI_AND_STRATEGY_SPEC.md):

### North Star:
TrustCare = hospital-enabled, patient-controlled portability ecosystem
Purpose: Reduce friction at hospital service entry

### 4 UX Loops:
1. Collect — pull data from legacy sources
2. Verify — canonicalize, DQI, issue VC/VP
3. Present — Wallet/QR/SHL to hospital
4. Update — after care, new VC back to Wallet

### Navigation Redesign:
1. Service Readiness: Patient Intake, Health Wallet, Document Requests, Smart Share
2. Care Transition: Referral, Cross-Network, International Patient, Partner Portal
3. Verified Documents: Issue, Review (Maker/Checker), Verify
4. Hospital Operations: Dashboard, Claim Center, Audit
5. Integration & Governance: HIS Connectors, FHIR, Terminology, MPI, Trust Registry/TAO, Schema, Settings

### New Backend Procedures:
- wallet.readiness
- wallet.requestDocument
- wallet.importDocument
- wallet.buildServicePacket
- wallet.shareForContext
- wallet.sourceStatus
- intake.verifyPresentation
- intake.requestMoreData
- careTransition.buildPackage
- externalSource.requestPull
- externalSource.importLegacyDocument

### New Frontend Components:
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

### New/Potential Tables:
- wallet_document_requests
- wallet_import_jobs
- service_readiness_checks
- intake_sessions
- external_source_authorizations

### Readiness API Response Example:
```json
{
  "readinessContext": "opd_visit",
  "patientId": 414,
  "score": 82,
  "missing": ["recent_lab_result"],
  "criticalReady": true,
  "documents": [...],
  "recommendedActions": ["request_recent_lab_from_source", "create_vp_for_checkin"]
}
```

### KPIs:
- Intake readiness rate
- Registration time reduction
- Missing document rate
- Verified document rate
- External import success
- DQI score
- Referral acceptance cycle time
- Patient control metric
- Reuse rate
- Hospital adoption momentum
