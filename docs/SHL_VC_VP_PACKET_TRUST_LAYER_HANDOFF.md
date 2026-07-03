# SHL + VC/VP Packet Trust Layer Handoff

Date: 2026-07-03

This handoff records the TrustCare alignment for Smart Health Links, single-document VC/VP, Prepare for Service, Verifier, and Contract Hub. It is intended for Codex, Manus, and future agents working in the Manus workspace.

## Product Direction

TrustCare is not a generic health super app and not a central health data lake. The product goal is to reduce hospital service friction by helping patients prepare portable, verifiable, wallet-held documents before care. HIS/EMR and legacy databases can remain systems of record for encounters, while TrustCare bridges them into patient-held VC/VP, FHIR, SHL, consent, and audit flows.

## Standards and Design Basis

- SMART Health Links define SHL as a sharing link that resolves to a manifest and encrypted files. The sharing user chooses what to share, whether a passcode is required, and whether the link expires. The SHLink payload contains the manifest URL, decryption key, optional expiration, flags, and label. Manifest requests are POST requests that may require passcode and must return remaining attempts on invalid passcode.
- SHL files are encrypted using JWE `alg=dir` and `enc=A256GCM`. TrustCare should keep SHL as the transport and not force the `shlink:/...` string itself to be a VC.
- W3C VC/VP defines issuer, holder, verifier, and data registry roles. Verifiers must evaluate issuer, proof, subject, and claims against verifier policy before relying on claims.
- FHIR DocumentReference is the right canonical wrapper for legacy PDF, scan, image, or external documents because it carries document metadata, attachment location, provenance, custodian, security labels, and relationships.
- IHE MHD is a useful implementation reference for simple document sharing APIs across constrained systems.

References:

- SMART Health Links Protocol: https://docs.smarthealthit.org/smart-health-links/spec/
- W3C Verifiable Credentials Data Model 2.0: https://www.w3.org/TR/vc-data-model-2.0/
- HL7 FHIR DocumentReference: https://hl7.org/fhir/documentreference.html
- IHE Mobile access to Health Documents: https://profiles.ihe.net/ITI/MHD/
- Apple Health data source control reference: https://support.apple.com/en-us/108779
- Epic on FHIR API/sandbox reference: https://fhir.epic.com/

## Transport Decision Rules

TrustCare should classify every share packet before issuing QR/link output.

| Situation | Recommended output | Reason |
| --- | --- | --- |
| One high-value document such as patient card, prescription, medical certificate, appointment, or coverage eligibility | Single-document VP | Small enough for a purpose-bound VP URL/QR and clear verifier policy |
| Small selected set of wallet credentials | VP bundle | Keeps patient selective disclosure simple without SHL overhead |
| Large FHIR Bundle, many credentials, legacy files, PDF/scan/image, referral, cross-border, or medical tourist context | SHL packet with VC/VP trust layer | SHL handles manifest/files/access policy, VC/VP proves issuer/holder/consent/integrity |

Implementation artifact:

- `shared/trustLayer.ts`
  - `classifyPacketTransport`
  - `buildTrustLayerChecklist`
  - `singleDocumentCredentialContracts`

## UX Changes in This PR

- Wallet direct share:
  - `wallet.present` now issues a fresh single-document VP for the selected wallet card instead of reusing the latest active VP for the patient.
  - Selective fields and audience are stored in presentation metadata and audit details.
  - QR payload uses `/verifier?vp=<presentationId>` so verifier can resolve the stored VP.
- Verifier:
  - Paste flow now accepts VP URL, presentation ID, JSON VP, JWT VP, and JWT VC.
  - Result screen shows transport decision and verification checklist.
  - If a user pastes `shlink:/...`, the UI tells them to open SHL Viewer because SHL is transport, not the trust proof itself.
- SHL workbench:
  - Detail panel shows a trust-layer checklist for SHL transport, Manifest VC, Holder VP, file hashes, and access policy.
  - SHL manifest passcode failures return `remainingAttempts`.
- SHL Viewer:
  - Invalid passcode errors display remaining attempts.
  - Manifest result includes a visible checklist covering transport, manifest credential, holder VP, hash integrity, and access policy.
- Prepare for Service:
  - Contract Hub reads `contractHub` and `singleDocumentVcVp` from the current workbench schema.
  - Data Mapping reads `dataMappingV2.profiles` from the current workbench schema.
  - Patient wizard shows when direct VP, VP bundle, or SHL packet should be used.
  - Bundle preview shows share mode and verifier checklist.
  - Query errors now show explicit recovery/error cards instead of silent blank/loading states.
- Role guard:
  - `/contract-admin` is now explicitly restricted to `system_admin` and `hospital_admin`.

## Database and Manus Workspace Validation

No DB schema migration is required by this PR. Manus must validate production workspace data and reseed where necessary.

Required validation before/after merge:

1. Wallet card to issued credential binding
   - For patient demo user `นายสมชาย ใจดี`, verify that every visible profile card has:
     - a row in `wallet_cards`
     - a valid `credentialId`
     - matching active row in `issued_credentials`
     - non-null signed VC (`sdJwtVc` or current signed credential field)
   - If `/wallet` shows `0 cards` while `/profile` shows a patient identity card, reseed wallet cards through the real issuance path, not by UI fallback.

2. Single-document VP path
   - Create VP for patient identity card.
   - Create VP for prescription.
   - Create VP for medical certificate.
   - Verify each through `/verifier?vp=<presentationId>`.
   - Confirm `issued_presentations.metadata.directSingleDocument = true`.

3. SHL seed integrity
   - Confirm at least 6 active SHL packages are present for demo coverage.
   - Each active SHL should have:
     - manifest URL
     - manifest hash
     - source bundle hash
     - encrypted file rows
     - passcode policy where required
     - manifest credential ID
     - holder presentation ID
     - access logs and versions where seeded

4. Prepare for Service seed integrity
   - `prepareWorkbench` must return:
     - `activeContract`
     - `contractHub.contracts`
     - `dataMappingV2.profiles`
     - `singleDocumentVcVp.catalog`
     - patient and hospital visible use cases
   - If `/prepare-service` remains stuck on loading in production, inspect the browser console and tRPC response for `wallet.prepareWorkbench`.
   - Reseed service readiness contracts only through the existing idempotent seed scripts or admin CRUD path.

5. Contract Admin authorization
   - Patient must not access `/contract-admin`.
   - `system_admin` and `hospital_admin` must access it.

6. SHL passcode behavior
   - Wrong passcode returns HTTP 401 and `remainingAttempts`.
   - Exhausted attempts disable the SHL or block future access according to current SHL access policy.

## Manus Prompt

Use this prompt after merging the PR into the Manus workspace:

```text
Please merge the latest GitHub PR for TrustCare SHL + VC/VP Packet Trust Layer.

Scope:
- Do not rewrite server/routers.ts or drizzle/schema.ts wholesale.
- Apply incremental fixes only.
- No schema migration should be required unless your workspace has drift.
- Keep TrustCare focused on patient-wallet portability and hospital friction reduction.

After merge, run:
1. pnpm check
2. pnpm test
3. pnpm build

Then validate production workspace DB and seed data:
1. Patient "นายสมชาย ใจดี" must have wallet_cards bound to active issued_credentials with signed VC payloads. If /wallet shows 0 cards but /profile shows a card, reseed via the real issuance path.
2. Reseed or validate single-document VC/VP examples for patient_identity, prescription, medical_certificate, appointment, and insurance_eligibility.
3. Verify wallet.present creates a new direct single-document VP for each selected card and /verifier?vp=<presentationId> resolves it.
4. Validate 6 active SHL packages with manifest URL, manifest hash, source bundle hash, encrypted file rows, passcode policy, manifestCredentialId, holder presentationId, versions, and access logs.
5. Validate SHL wrong passcode returns remainingAttempts and does not leak files.
6. Validate prepareWorkbench returns activeContract, contractHub.contracts, dataMappingV2.profiles, singleDocumentVcVp.catalog, patient visible use cases, and hospital visible use cases.
7. Validate /contract-admin is forbidden for patient and allowed for system_admin/hospital_admin.

Please save a Manus checkpoint only after tests pass and these DB validations are complete.
```

