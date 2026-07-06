# Wallet VC/VP Schema Reference (from trustcare-wallet-apps/packages/wallet-core/src/completeSeedData.ts)

## VC credentialData envelope structure:
```json
{
  "@context": ["https://www.w3.org/ns/credentials/v2", "https://trustcare.network/contexts/wallet-medical-document/v1"],
  "id": "urn:uuid:...",
  "type": ["VerifiableCredential", "<CredentialType>"],
  "issuer": { "id": "did:web:...", "name": "...", "nameTh": "..." },
  "validFrom": "...",
  "validUntil": "...",
  "credentialSubject": {
    "id": "did:key:...",
    "<type-specific-data>": { ... },
    "patient": { fullNameTh, fullNameEn, birthDate, gender, nationality, carepassId, hn, phone, email, address, avatarUrl },
    "documentReference": { FHIR DocumentReference },
    "humanDocument": { rendererVersion, layout, audience, titleTh, titleEn, issuer, patient, issuedAt, expiresAt, sections, sourceSystem, fhirResources, noPortrait, visualHints }
  },
  "credentialStatus": { "id": "...", "type": "TrustCareStatusList2026", "statusPurpose": "revocation", "status": "active" },
  "evidence": [{ "type": "FHIRR4DocumentReferenceEvidence", "sourceSystem": "...", "fhirResources": [...], "documentReferenceId": "...", "resource": {...}, "attachment": {...} }],
  "trustcare": {
    "schemaVersion": "2026.07.complete-seed.v1",
    "documentType": "<cardType>",
    "credentialType": "<CredentialType>",
    "documentCategory": "<category>",
    "sensitivity": "normal|restricted|high|critical",
    "shareDefault": "allow|ask|deny",
    "tags": [...],
    "issuerHospitalCode": "TCC",
    "holderDid": "did:key:...",
    "sourceSystem": "...",
    "selectiveDisclosureRecommendedFields": [...],
    "display": { "cardAccent": "...", "documentLayout": "...", "watermark": "DEMO ONLY", "patientFacingTitleTh": "...", "patientFacingTitleEn": "..." }
  }
}
```

## VP JWT payload (inside `vp` claim):
```json
{
  "@context": ["https://www.w3.org/ns/credentials/v2", "https://trustcare.network/contexts/share-package/v1"],
  "id": "...",
  "type": ["VerifiablePresentation", "TrustcarePatientPresentation"],
  "holder": "did:key:...",
  "purpose": "...",
  "validUntil": "...",
  "verifiableCredential": ["<vc-jwt-1>", "<vc-jwt-2>"],
  "trustcare": {
    "mode": "TrustcarePatientPresentation",
    "context": "treatment|referral|insurance|...",
    "documentTypes": ["patient_identity", "consent_receipt", ...],
    "documentReferences": [{...}, {...}],
    "payloadHash": "sha256:..."
  }
}
```

## buildHumanDocument structure:
```ts
{
  rendererVersion: "trustcare-wallet-document-renderer-2026.07",
  layout: layoutForDocument(def.cardType), // e.g. "prescription_order", "laboratory_report"
  audience: "patient_and_partner_verifier",
  titleTh: def.displayName,
  titleEn: def.displayNameEn,
  issuer: { code, nameTh, nameEn, did },
  patient: { fullNameTh, fullNameEn, birthDate, gender, nationality, hn, carepassId, phone, email, address, photoUrl },
  issuedAt,
  expiresAt,
  sections: documentSectionsFor(def.cardType), // array of section names
  sourceSystem: def.sourceSystem,
  fhirResources: def.fhirResources,
  noPortrait: boolean,
  visualHints: { accent, priority, tableDocument, warningDocument }
}
```

## buildDocumentReference structure:
```ts
{
  resourceType: "DocumentReference",
  id: `${def.cardType}-complete-001`,
  status: "current",
  docStatus: "final",
  type: { coding: [{ system: "https://trustcare.network/fhir/CodeSystem/document-type", code: def.cardType, display: def.displayNameEn }], text: def.displayName },
  category: [{ coding: [{ system: "https://trustcare.network/fhir/CodeSystem/document-category", code: def.documentCategory, display: def.documentCategory }] }],
  subject: { reference: `Patient/${patientId}`, display: fullNameEn },
  date: issuedAt,
  author: [{ reference: `Organization/${issuer.code}`, display: issuer.nameEn }],
  authenticator: { reference: `Organization/${issuer.code}`, display: issuer.nameEn },
  custodian: { reference: `Organization/${issuer.code}`, display: issuer.nameEn },
  content: [{ attachment: { contentType, language: "th-TH", title, creation, hash, url }, format: { system, code: layout, display } }],
  context: { encounter: [...], period: { start, end }, related: [{ reference: `Credential/${credentialId}` }] }
}
```

## Document definitions (from completeSeedDocumentDefinitions):
| cardType | credentialType | category | sourceSystem | sensitivity | shareDefault | fhirResources |
|----------|---------------|----------|--------------|-------------|--------------|---------------|
| patient_identity | PatientIdentityCredential | identity_and_access | Registration/MPI | restricted | ask | ["Patient","RelatedPerson"] |
| staff_identity | StaffIdentityCredential | identity_and_access | HR/IAM | restricted | deny | ["Practitioner","PractitionerRole"] |
| consent_receipt | ConsentReceiptCredential | identity_and_access | Consent Management | high | allow | ["Consent","Provenance"] |
| mpi_link_certificate | MpiLinkCertificateCredential | identity_and_access | Master Patient Index | high | deny | ["Patient","Linkage"] |
| patient_summary | PatientSummaryCredential | clinical_summary | EMR/IPS Summary | high | ask | ["Composition","Condition","AllergyIntolerance","MedicationStatement","Observation"] |
| allergy_alert | AllergyAlertCredential | clinical_summary | EMR Allergy List | critical | allow | ["AllergyIntolerance","Condition"] |
| immunization | ImmunizationCredential | clinical_summary | Immunization Registry | normal | allow | ["Immunization","ImmunizationRecommendation"] |
| medical_certificate | MedicalCertificateCredential | clinical_summary | Doctor Certificate Desk | restricted | ask | ["Composition","Condition","Observation"] |
| medication_summary | MedicationSummaryCredential | medication_and_pharmacy | Pharmacy/EMR | critical | ask | ["MedicationStatement","MedicationRequest"] |
| prescription | PrescriptionCredential | medication_and_pharmacy | CPOE/e-Prescription | restricted | ask | ["MedicationRequest","Medication"] |
| pharmacy_dispense | PharmacyDispenseCredential | medication_and_pharmacy | Pharmacy Dispensing | restricted | ask | ["MedicationDispense","Medication"] |
| lab_result | LabResultCredential | diagnostics_and_results | LIS | high | ask | ["DiagnosticReport","Observation","Specimen"] |
| diagnostic_report | DiagnosticReportCredential | diagnostics_and_results | RIS/PACS | high | ask | ["DiagnosticReport","ImagingStudy","Observation"] |
| referral_vc | ReferralCredential | care_transition | Referral Center | high | allow | ["ServiceRequest","Encounter","DocumentReference"] |
| discharge_summary | DischargeSummaryCredential | care_transition | Inpatient EMR | high | ask | ["Composition","Encounter","Condition","Procedure"] |
| insurance_eligibility | CoverageEligibilityCredential | claims_and_finance | Payer | restricted | ask | ["CoverageEligibilityResponse","Coverage"] |
| claim_package | ClaimPackageCredential | claims_and_finance | Claim Center | restricted | deny | ["Claim","Encounter","Condition","Procedure"] |
| claim_receipt | ClaimReceiptCredential | claims_and_finance | Finance/Billing | restricted | deny | ["ClaimResponse","PaymentReconciliation"] |
| travel_document_verification | TravelDocumentVerificationCredential | medical_tourism | International Patient Center | high | ask | ["DocumentReference","Patient"] |
| visa_support_letter | VisaSupportLetterCredential | medical_tourism | International Patient Center | restricted | ask | ["DocumentReference","Encounter"] |
| quotation | QuotationCredential | medical_tourism | International Finance Desk | restricted | ask | ["ChargeItemDefinition","DocumentReference"] |
| guarantee_letter | GuaranteeLetterCredential | medical_tourism | Payer/International Desk | restricted | ask | ["CoverageEligibilityResponse","DocumentReference"] |
| shl_manifest | ShlManifestCredential | sharing_and_sync | Smart Health Links | high | allow | ["Bundle","DocumentManifest"] |
| sync_receipt | SyncReceiptCredential | sharing_and_sync | Integration Adapter | normal | deny | ["Provenance","AuditEvent"] |
| appointment | AppointmentCredential | operations | Appointment Scheduling | normal | allow | ["Appointment","Slot"] |

## Layout mapping:
- patient_identity → photo_identity_card
- staff_identity → staff_badge
- consent_receipt → consent_receipt
- mpi_link_certificate → identity_link_certificate
- patient_summary → clinical_summary_report
- allergy_alert → critical_alert_sheet
- immunization → immunization_record
- medical_certificate → signed_medical_certificate
- medication_summary → medication_reconciliation_table
- prescription → prescription_order
- pharmacy_dispense → pharmacy_dispense_record
- lab_result → laboratory_report
- diagnostic_report → diagnostic_report
- referral_vc → referral_letter
- discharge_summary → discharge_summary
- insurance_eligibility → coverage_eligibility_response
- claim_package → claim_submission_package
- claim_receipt → billing_receipt
- travel_document_verification → travel_document_verification
- visa_support_letter → visa_support_letter
- quotation → treatment_quotation
- guarantee_letter → letter_of_guarantee
- shl_manifest → shl_manifest
- sync_receipt → wallet_sync_receipt
- appointment → appointment_ticket

## Document sections per type:
- patient_identity: demographics, identifiers, emergency_contact, registration
- staff_identity: staff_profile, license, department, privileges
- consent_receipt: purpose, scope, recipient, expiry, revocation
- mpi_link_certificate: golden_record, linked_identifiers, matching_policy, review
- patient_summary: problems, allergies, medications, vital_signs, care_plan
- allergy_alert: allergen, reaction, severity, emergency_instruction
- immunization: vaccine, occurrence_date, lot, performer
- medical_certificate: diagnosis, examination, result, restrictions, certifying_practitioner
- medication_summary: active_medications, reconciliation, indication
- prescription: prescription_items, prescriber, quantity, refill
- pharmacy_dispense: dispensed_items, dispenser, lot, counseling
- lab_result: specimen, observations, reference_range, interpretation
- diagnostic_report: modality, findings, conclusion, reporting_practitioner
- referral_vc: from, to, reason, attachments, requested_service
- discharge_summary: admission, diagnoses, hospital_course, procedures, follow_up
- insurance_eligibility: payer, policy, benefits, remaining_limit, last_checked
- claim_package: claim, diagnosis_codes, service_lines, attachments, total
- claim_receipt: receipt, invoice, items, payment, payer_responsibility
- travel_document_verification: passport, nationality, verified_against, travel_window
- visa_support_letter: purpose, visit_period, receiving_department, responsible_physician
- quotation: package, line_items, estimated_total, exclusions
- guarantee_letter: payer, pre_auth, covered_services, limit, conditions
- shl_manifest: manifest, files, manifest_vc, holder_vp, access_policy
- sync_receipt: source, target, counts, checksum, adapter
- appointment: service, time, location, practitioner, required_documents

## Accent colors per category:
- identity_and_access → slate
- clinical_summary → emerald
- medication_and_pharmacy → blue
- diagnostics_and_results → indigo
- care_transition → cyan
- claims_and_finance → rose
- medical_tourism → fuchsia
- sharing_and_sync → zinc
- operations → purple

## Selective disclosure recommended fields per type:
Base: credentialSubject.patient.fullNameTh, credentialSubject.patient.birthDate, issuer, validUntil
- patient_identity: + identifiers, registration
- patient_summary: + summary.conditions, summary.medications, summary.allergies
- allergy_alert: + allergyIntolerances
- medication_summary: + medicationSummary.medications
- lab_result: + labReport.observations
- insurance_eligibility: + coverage.status, coverage.benefitSummary
- claim_package: + claimPackage.totalAmount, claimPackage.attachments
- appointment: + appointment.start, appointment.location

## Current Portal issues to fix:
1. `buildCredentialEnvelope` uses wrong @context: "health/v1" → should be "wallet-medical-document/v1"
2. Missing `issuer.nameTh` in envelope
3. `credentialStatus.type` is "BitstringStatusListEntry" → should be "TrustCareStatusList2026"
4. Missing `trustcare` metadata block at top-level of credentialData
5. `trustcareSeed` should be replaced by `trustcare` block
6. `humanDocument` is at top-level of credentialData → should be inside `credentialSubject`
7. Missing `documentReference` in `credentialSubject`
8. Evidence format is too simple → should be FHIRR4DocumentReferenceEvidence with resource/attachment
9. VP missing `trustcare` metadata block with mode/context/documentTypes/documentReferences/payloadHash
10. VP missing `validUntil` in vp claim
11. VP type should include "TrustcarePatientPresentation"

## Per-hospital keys needed:
- TCC (TrustCare Central Hospital) - ES256 key pair
- TCP (TrustCare Phuket International Hospital) - ES256 key pair  
- TCM (TrustCare Chiang Mai Cross-Border Hospital) - ES256 key pair
Each hospital needs its own private key for signing and public key for verification.
Currently all hospitals share the same env-based key (TRUSTCARE_VC_SIGNING_PRIVATE_JWK).

## Files to modify:
1. server/portability/vc.ts - buildCredentialEnvelope, createPresentation
2. server/portability/reseed.ts - upsertIssuedCredential, issueSeedCredential, claimsForDocument
3. server/portability/did.ts - demoPublicJwk (generate real ES256 key pairs per hospital)
4. server/portability/labels.ts - add document definitions catalog with sourceSystem, fhirResources, sensitivity, etc.
5. server/wellKnownRoutes.ts - per-hospital JWKS endpoint
6. server/seedServiceReadiness.ts - uses separate issuance path, needs alignment
7. server/webhookDocumentImport.ts - stores claims instead of full envelope
