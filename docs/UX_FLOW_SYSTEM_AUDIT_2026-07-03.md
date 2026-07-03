# TrustCare UX Flow System Audit

**Date:** 2026-07-03  
**Scope:** Patient wallet readiness, VC/VP issuance, SHL sharing, service-point verification, referral intake, Maker/Checker forms, route authorization, and Manus DB handoff.

## Product Lens

TrustCare is a hospital-enabled, patient-wallet-first interoperability layer. It should reduce friction before and during hospital service by helping a patient collect, verify, consent to, and present enough portable clinical and administrative evidence from their own wallet.

The system is not trying to become a generic central health platform. It bridges old silo-based HIS/EMR/LIS/PACS/claims/partner systems into a portable and verifiable VC/VP ecosystem, while the hospital remains the source of truth for each local encounter.

## Reference Patterns From Mature Systems

| Reference                                                                                              | Practical pattern to reuse in TrustCare                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [SMART Health Links](https://docs.smarthealthit.org/smart-health-links/spec/)                          | SHL is transport: link/QR points to an encrypted manifest and health files. TrustCare should wrap issuer, holder consent, manifest integrity, and access receipts with VC/VP rather than making `shlink:/...` itself a VC. |
| [SMART Health Cards](https://smarthealth.cards/en/)                                                    | Use compact health credentials for verifiable clinical evidence and QR/mobile presentation.                                                                                                                                |
| [W3C Verifiable Credentials Data Model 2.0](https://www.w3.org/TR/vc-data-model-2.0/)                  | Keep issuer/holder/verifier responsibilities explicit. A VP proves presentation and holder control, not automatic clinical truth.                                                                                          |
| [IHE Mobile access to Health Documents](https://profiles.ihe.net/ITI/MHD/)                             | Partner/document exchange should support document submit/query/retrieve patterns, especially where legacy partners cannot yet support wallet-native VC/VP flows.                                                           |
| [HL7 IPS](https://hl7.org/fhir/uv/ips/)                                                                | Patient summaries should converge toward IPS-like sections for allergies, medications, problems, immunizations, results, and care plan.                                                                                    |
| [NHS App](https://www.nhs.uk/nhs-app/about-the-nhs-app/)                                               | Patient-facing UX should be service-oriented: records, prescriptions, appointments, identity, and preferences are surfaced as actions, not internal system events.                                                         |
| [Apple Health sharing](https://support.apple.com/guide/iphone/share-your-health-data-iph5ede58c3d/ios) | Sharing flows should make recipient, categories, expiry, and revocation understandable before data leaves the patient context.                                                                                             |

## Audit Findings

- Patient and staff route protection had drifted from `App.tsx` and `shared/menuConfig.ts`. Direct URLs such as `/service-verify` and `/issuer/:id` were not covered by the guard, allowing patient users to see staff-only surfaces.
- Demo users named Somchai must remain distinct:
  - `demo-sysadmin-001` / "นพ.สมชาย ระบบดี" = system admin.
  - `demo-patient-001` / "นายสมชาย ใจดี" = patient.
- Patient wallet empty state did not guide the patient toward requesting/importing documents or creating a service packet.
- SHL list empty state was demo-level and did not auto-select the first available package, leaving the detail panel blank.
- Patient SHL creation exposed staff/partner scenarios that the backend would not allow for patient self-service.
- Service-point verification depended on camera scanning only, which is fragile in mobile browsers and hard to test in production.
- Issuer, Maker, and Referral forms accepted raw patient IDs, which is unsafe when demo data contains similar names and when real hospitals have many matching patients.
- Document request source options were behind the backend enum and did not include PACS or personal health apps.
- Service readiness could create a partial VP packet but did not clearly label that state when required documents were missing.

## Implemented In This PR

- Added missing protected routes to RoleGuard: `/profile`, `/service-verify`, `/issuer/:id`, `/claim-analytics`, `/adapter-sdk`, and `/partner-wizard`.
- Added dynamic route matching for protected routes such as `/issuer/:id`.
- Strengthened role guard tests for patient denial, stale patient issuer roles, dynamic credential details, staff verifier access, and integration routes.
- Filtered patient SHL scenarios to patient-appropriate self-share and patient-summary cases.
- Added SHL loading, action-oriented empty state, and auto-select behavior for existing SHLs.
- Added manual VP presentation URL/ID entry to service-point verification and included service/visit notes in check-in audit events.
- Changed Issuer, Maker Queue, and Referral Wizard from raw patient ID input to backend patient selectors.
- Added default issuer/from-hospital selection from the actual hospital list.
- Expanded document request source types to RIS, PACS, personal health app, partner portal, payer, and patient upload.
- Added context-reset behavior for document request selection when readiness context changes.
- Added partial service packet warning and dynamic button label in Service Readiness.
- Added Wallet empty-state actions to prepare service or open Smart Share.

## Manus Workspace Handoff

This PR does not add new database tables or migrations. Manus should still validate and reseed workspace data after merge because the UX now depends more visibly on real wallet, SHL, and patient-option data.

Required validation:

1. Confirm user role integrity:
   - `demo-sysadmin-001` is `system_admin`, name "นพ.สมชาย ระบบดี".
   - `demo-patient-001` is `patient`, name "นายสมชาย ใจดี".
   - No `patient` user has `maker`, `checker`, `issuer_maker`, or `issuer_checker` effective access.
2. Validate patient options API returns only patient users for staff workflows and only the current patient for patient workflows.
3. Validate route access manually:
   - Patient can access `/dashboard`, `/profile`, `/prepare-service`, `/wallet`, `/consent`, `/shl`.
   - Patient cannot access `/service-verify`, `/issuer`, `/issuer/1`, `/maker-queue`, `/checker-queue`, `/verifier`, `/claim-analytics`, `/adapter-sdk`, `/partner-wizard`.
4. Reseed `demo-patient-001` wallet with enough active VC-bound cards for service readiness:
   - patient identity, patient summary, allergy alert, medication summary, lab result, prescription, referral, insurance eligibility or claim package, medical certificate or discharge summary as available.
5. Reseed at least six active SHL packages through the real issuance path:
   - patient summary, self-share, cross-branch referral, cross-border care, e-claim, medical tourist.
   - Each package should have manifest files, JWE payloads, passcode policy where expected, manifest VC, holder VP, access logs, and revocation-ready state.
6. Confirm `/wallet` as "นายสมชาย ใจดี" shows cards and real avatar/photo where credential type expects it.
7. Confirm `/shl` as "นายสมชาย ใจดี" shows active packages, auto-selects the first package, and can create patient-allowed SHLs.
8. Confirm `/service-verify` as doctor/nurse/admin can verify both QR and manual `vp` input, then records check-in audit with service name and notes.
9. Confirm Maker and Issuer forms select "นายสมชาย ใจดี" from a patient list rather than accepting raw IDs.
10. Run Manus workspace tests after reseed. Keep CI non-strict enough for AI PRs, but do not skip role/patient-access tests.

## Prompt For Manus

Use the latest GitHub main after merging the Codex PR for UX flow hardening. Validate DB and reseed production workspace data without adding mock-only shortcuts.

Focus on the patient-wallet-first TrustCare concept: the hospital uses TrustCare to reduce patient service friction, while the patient wallet carries portable and verifiable VC/VP evidence. Keep the two Somchai users distinct: `demo-sysadmin-001` / "นพ.สมชาย ระบบดี" is system admin, and `demo-patient-001` / "นายสมชาย ใจดี" is patient.

Tasks:

1. Apply the merged code, no schema migration expected unless your workspace has drift.
2. Validate patient role cannot act as Maker/Checker or access staff URLs directly.
3. Validate/reseed patient wallet cards for `demo-patient-001` across the three hospitals with real issued VC/VP-bound records.
4. Reseed SHL packages through the real SHL issuance path, not placeholder data.
5. Validate patient `/wallet`, `/prepare-service`, `/shl`, and staff `/service-verify` flows end to end.
6. Confirm Issuer, Maker Queue, and Referral Wizard patient selectors list only patient users and show "นายสมชาย ใจดี" clearly.
7. Report exact counts: active wallet cards, document categories, active SHLs, SHL files/manifests, issued presentations, access logs, and denied patient staff-route checks.
