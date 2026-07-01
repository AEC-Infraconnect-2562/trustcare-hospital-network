# TrustCare VC Document Storage Taxonomy

This note captures the storage and retrieval model for TrustCare VC-backed documents.

## Research Basis

- HL7 FHIR R4 `DocumentReference` is the closest canonical model for indexing documents. It separates high-level `category`, precise `type`, `subject`, author/authenticator/custodian, security labels, content attachment, and clinical context.
- FHIR's Document Class Value Set uses LOINC to describe macro classes such as immunization history, discharge summary, laboratory studies, radiology studies, medication summary, referral note, and administrative documents.
- FHIR's Document Type value set is broader and is preferred for precise `DocumentReference.type`; TrustCare keeps local document type identifiers while attaching LOINC-oriented class metadata where practical.
- IHE MHD follows the document registry/repository idea for mobile access to health documents, so TrustCare should keep searchable document metadata separate from binary/JWT storage.
- Thai official-style printable documents should use `TH Sarabun New` for print and `Sarabun` as the web-embeddable fallback.

## Storage Rule

Every VC document is stored and indexed with:

- `documentCategory`: high-level browsing group.
- `documentSubcategory`: narrower workflow bucket.
- `type`: TrustCare document type, matching `issued_credentials.type`.
- `storageKey`: deterministic path for the JWT VC object.
- `searchTags`: category, subcategory, type, hospital, and document class code.
- `credentialData.humanDocument`: printable document metadata, template id, render data, and font policy.
- `credentialData.makerChecker`: request, maker, checker, and canonical review evidence when created through the issuer flow.

Path pattern:

```text
vc/{hospital}/{patient}/{category}/{subcategory}/{documentType}/{credentialId}.jwt
```

## Categories

- `identity_and_access`: patient card, consent receipt, MPI link certificate.
- `clinical_summary`: patient summary, allergy alert, immunization, medical certificate.
- `medication_and_pharmacy`: medication summary, prescription, pharmacy dispense.
- `diagnostics_and_results`: lab result and diagnostic/imaging report.
- `care_transition`: referral and discharge summary.
- `claims_and_finance`: coverage eligibility, claim package, claim receipt.
- `medical_tourism`: travel document verification, visa support, quotation, guarantee letter.
- `sharing_and_sync`: SHL manifest and HIS sync receipt.
- `operations`: appointment and operational scheduling documents.

## Implementation Notes

- `server/portability/labels.ts` is the source of truth for category labels, icon labels, storage metadata, and print font policy.
- `issued_credentials` and `wallet_cards` persist category fields directly for fast filtering without parsing JSON VC payloads.
- Reseed writes category metadata into DB rows and can regenerate VC/VP data when new document types are added.
- Maker/Checker entitlements are scoped by the same document type identifiers, so UI browsing, permissions, and VC storage use one vocabulary.
