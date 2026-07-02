# Care Transition and Partner Portal Reference

**Status:** Implementation reference  
**Last updated:** 2026-07-02  
**Version:** 2.0 (File Bundle System + Inline Preview)  
**Scope:** Patient referral, cross-network/cross-border referral, medical tourist intake, partner API layer, document exchange, file bundles, inline preview, care packages, VC/VP/SHL transport.

## Decision Summary

TrustCare now models the three clinical-service menus as one care-transition capability:

- `/referral` for internal closed-loop referral.
- `/cross-border` for cross-branch, cross-network, inbound/outbound cross-border, and external partner referral.
- `/international` for medical tourist inquiry through discharge and follow-up.
- `/partner-portal` for partner system integration, inbound/outbound document exchange, and delegated VC/VP care packages.

The system does not treat uploaded PDFs/scans as verified clinical truth. Legacy files become FHIR `DocumentReference` records with hash, source, provenance, and review state. Clinical or administrative VCs are requested only after Maker review and Checker issuance through the existing Maker/Checker path.

## Standards Mapping

| Need | Standard model | TrustCare implementation |
|---|---|---|
| Referral/request for care | FHIR `ServiceRequest` | Built in care package bundle for referral and transfer-of-care requests. |
| Worklist and workflow state | FHIR `Task` | `case_tasks` stores MPI, consent, document review, triage, finance, translation, dispatch, discharge, and sync-back tasks. |
| Legacy/scanned documents | FHIR `DocumentReference` / IHE MHD pattern | `case_documents` stores metadata, source hash, FHIR DocumentReference JSON, verification status, and VC request linkage. |
| Link/QR transport | SMART Health Links | Care packages call the SHL engine to transport encrypted FHIR bundles and manifest metadata. |
| Trust layer | W3C VC/VP | VC/VP proves issuer/source/evidence/holder and is not used as the sole clinical acceptance decision. |
| Claims and payment | FHIR `Claim` style evidence + TrustCare claim center | Care packages can include invoices, receipts, claim refs, guarantee letters, and cost estimates. |

## Legal and Governance Baseline

This is an engineering reference, not legal advice. Production deployment must be checked by hospital counsel and compliance officers.

Minimum design controls:

- Health, identity, passport, payer, and cross-border referral data is sensitive personal data. Require purpose-bound consent or a documented healthcare/legal basis before disclosure.
- Store immutable hash/provenance for every inbound and outbound document.
- Separate clinical acceptance from trust verification. A valid VC proves source/authenticity; it does not mean the receiving hospital accepts the patient.
- Use named recipient policy for high-risk SHL packages, passcode by default, expiry by risk class, and audit every access.
- For cross-border transfer, record jurisdiction, language, translation status, legal disclaimer, and recipient policy.
- For medical tourist flows, capture passport-aligned identity, payer/guarantee/self-pay state, quotation, visa support, appointment/admission, discharge packet, prescription, and follow-up.

## Partner Capability Tiers

| Tier | Partner capability | Flow |
|---|---|---|
| A | Native DID + VC issuer + FHIR API | Verify partner VC/VP via Trust Registry, ingest FHIR, create receiving case. |
| B | FHIR/REST/HL7/DB/CDC/SFTP but no VC | Ingest structured data, canonical map to FHIR, create source attestation, request delegated VC after review. |
| C | PDFs/scans/manual upload only | Portal upload, DocumentReference, manual/AI-assisted extraction draft, Maker/Checker review. |
| D | Facilitator/payer/embassy | Administrative documents only unless clinical evidence comes from a provider source. |

Supported connector types:

- `fhir_rest`
- `hl7v2_mllp`
- `db_view`
- `cdc`
- `sftp_csv`
- `smart_health_link`
- `native_vc_vp`
- `manual_portal`

## Workflow

1. Partner configures an API/source connector or uses manual portal.
2. Partner submits case and documents.
3. TrustCare creates the operational case in `cross_border_referrals` or `international_cases`.
4. TrustCare initializes `case_tasks`.
5. Every uploaded document becomes `case_documents.fhirDocumentReference`.
6. Staff verifies documents and can submit a VC request through Maker flow.
7. Staff records clinical/document/financial/legal decisions.
8. Staff generates a care package containing FHIR bundle, DocumentReferences, cost/claim metadata, and optional SHL/VP.
9. Receiving party accesses package through SHL or portal inbox.
10. On discharge/counter-referral, TrustCare prepares outbound documents and sync-back receipt.

## New Tables

- `care_transition_case_events`
- `case_documents`
- `case_tasks`
- `partner_source_connectors`
- `partner_source_attestations`
- `care_packages`
- `care_package_items`
- `case_decisions`
- `document_bundles` (v3.7)
- `bundle_files` (v3.7)

Migration: `drizzle/0012_care_transition_partner_portal.sql` + direct SQL for bundle tables

## Backend APIs

`careTransition`

- `overview`
- `workspace`
- `initializeCase`
- `addDocument`
- `verifyDocument`
- `updateTask`
- `recordDecision`
- `generatePackage`
- `createBundle` (v3.7)
- `getBundles` (v3.7)
- `getBundleWithFiles` (v3.7)
- `addFileToBundle` (v3.7)
- `updateBundleStatus` (v3.7)
- `removeBundleFile` (v3.7)
- `linkVcToFile` (v3.7)
- `verifyBundleVc` (v3.7)
- `generateBundleHash` (v3.7)
- `generateShlFromBundle` (v3.7)

`partnerPortal`

- `dashboard`
- `listConnectors`
- `createConnector`
- `validateConnector`
- `activateConnector`
- `submitCase`
- `sendDocument`

**Express Routes**

- `POST /api/bundles/:bundleId/upload` — Multipart file upload (multer, up to 10 files, 50MB each)

## File Bundle Workflow

The File Bundle system extends the document exchange capability with structured multi-file grouping:

```
1. Staff creates a bundle (type: clinical, administrative, imaging, etc.)
2. Staff uploads files via drag-drop or file picker
   → Files stored in S3, metadata in bundle_files table
3. Staff can link VC/VP credentials to specific files
4. Staff can verify VC files against trust registry
5. Staff generates integrity hash (SHA-256) for the entire bundle
6. Staff generates SHL from selected bundle files for external sharing
```

### Bundle Status Lifecycle

```
draft → submitted → under_review → accepted
                                   → rejected
                                   → archived
```

### Inline Document Preview

Staff can preview documents directly within the BundleManager without downloading:

| Format | Method | Controls |
|--------|--------|----------|
| PDF | iframe embed | Full-page render, fallback download |
| Images (PNG, JPEG, GIF, WebP, SVG, BMP) | `<img>` with controls | Zoom 25%–400%, rotation, fit-to-screen |
| VC/VP | Badge with status | Trust verification, issuer DID |
| Other | Download link | Graceful fallback |

## Frontend Wizard Components

Multi-step wizard flows replace simple forms for complex case creation:

| Wizard | Steps | Integration |
|--------|-------|-------------|
| ReferralCreationWizard | Patient → Destination → Reason → Documents → Consent → Review | Referral page |
| CrossBorderCreateWizard | Direction → Partner → Patient → Documents → Translation → Consent → Package | CrossBorder page |
| PartnerWizard (upgraded) | Organization → Connector → DID Trust → File Upload → Review | Partner onboarding |
| InternationalWorkflowPanels | Document Intake → Clinical Pre-review → Financial → Discharge | International page |

### CareTransitionWorkspace Tabs

The shared workspace component provides 6 tabs per case:

1. **Documents** — Individual document management with FHIR DocumentReference
2. **Bundles** — Multi-file bundle management with BundleManager component
3. **Tasks** — Case task tracking (MPI, consent, triage, finance, translation, dispatch)
4. **Decisions** — Clinical/administrative/financial decision recording
5. **Packages** — Care package generation (FHIR Bundle + SHL + VP)
6. **Timeline** — Chronological event history

## Acceptance Criteria

- No SHL package generation path hardcodes `patientId = 1`.
- Partner API connectors can be configured and validated before activation.
- Partner inbound documents become DocumentReference with hashes.
- Verified documents can submit Maker VC requests without bypassing Checker.
- Care packages include FHIR bundle hash, manifest hash, package items, and optional SHL/VP references.
- Medical tourist workflow supports identity, insurance/guarantee/quotation, appointment, discharge, and follow-up documents.
- Cross-border workflow supports partner, country, language, jurisdiction, translation, legal, and trust metadata.
- File bundles support multiple bundles per case with mixed file types (v3.7).
- Bundle files can be linked to issued VC/VP credentials for trust verification (v3.7).
- Bundle integrity hash (SHA-256) can be generated and verified (v3.7).
- SHL can be generated from selected bundle files for secure external sharing (v3.7).
- Inline preview works for PDF and image files without download (v3.7.1).
- Multi-step wizards guide staff through complex case creation workflows (v3.7).

## References

- HL7 FHIR R4 ServiceRequest: https://hl7.org/fhir/R4/servicerequest.html
- HL7 FHIR R4 Task: https://hl7.org/fhir/R4/task.html
- HL7 FHIR R4 DocumentReference: https://hl7.org/fhir/R4/documentreference.html
- IHE XDS.b Cross-Enterprise Document Sharing: https://profiles.ihe.net/ITI/TF/Volume1/ch-10.html
- IHE MHD: https://profiles.ihe.net/ITI/MHD/
- SMART Health Links: https://docs.smarthealthit.org/smart-health-links/spec/
- W3C VC Data Model 2.0: https://www.w3.org/TR/vc-data-model-2.0/
- File Bundle Standards Research: ./FILE_BUNDLE_STANDARDS.md
