# Care Transition and Partner Portal Reference

**Status:** Implementation reference  
**Last updated:** 2026-07-02  
**Scope:** Patient referral, cross-network/cross-border referral, medical tourist intake, partner API layer, document exchange, care packages, VC/VP/SHL transport.

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

Migration: `drizzle/0012_care_transition_partner_portal.sql`

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

`partnerPortal`

- `dashboard`
- `listConnectors`
- `createConnector`
- `validateConnector`
- `activateConnector`
- `submitCase`
- `sendDocument`

## Acceptance Criteria

- No SHL package generation path hardcodes `patientId = 1`.
- Partner API connectors can be configured and validated before activation.
- Partner inbound documents become DocumentReference with hashes.
- Verified documents can submit Maker VC requests without bypassing Checker.
- Care packages include FHIR bundle hash, manifest hash, package items, and optional SHL/VP references.
- Medical tourist workflow supports identity, insurance/guarantee/quotation, appointment, discharge, and follow-up documents.
- Cross-border workflow supports partner, country, language, jurisdiction, translation, legal, and trust metadata.

## References

- HL7 FHIR R4 ServiceRequest: https://hl7.org/fhir/R4/servicerequest.html
- HL7 FHIR R4 Task: https://hl7.org/fhir/R4/task.html
- HL7 FHIR R4 DocumentReference: https://hl7.org/fhir/R4/documentreference.html
- IHE MHD: https://profiles.ihe.net/ITI/MHD/
- SMART Health Links: https://docs.smarthealthit.org/smart-health-links/spec/
- W3C VC Data Model 2.0: https://www.w3.org/TR/vc-data-model-2.0/
