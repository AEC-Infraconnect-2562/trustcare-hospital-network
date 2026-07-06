# VC/VP Schema Alignment Refactoring Plan

## Current State
- 400 issued_credentials, all have non-null credentialData
- ALL 25 types missing: `documentReference` in credentialSubject, `trustcare` metadata block
- 6 types missing `humanDocument`: staff_identity, consent_receipt, patient_summary, medical_certificate, prescription, sync_receipt
- VP JWT structure is mostly OK but missing `trustcare` metadata block and `validUntil`

## Target State (from Wallet completeSeedData.ts)

### VC credentialData envelope:
```json
{
  "@context": ["https://www.w3.org/ns/credentials/v2", "https://trustcare.network/contexts/wallet-medical-document/v1"],
  "id": "urn:...",
  "type": ["VerifiableCredential", "<CredentialType>"],
  "issuer": { "id": "did:web:...", "name": "...", "nameTh": "..." },
  "validFrom": "...",
  "validUntil": "...",
  "credentialSubject": {
    "id": "did:key:...",
    "patient": { fullNameTh, fullNameEn, birthDate, gender, nationality, carepassId, hn, phone, email, address, avatarUrl },
    // type-specific data key (e.g. summary, labReport, prescription, etc.)
    "documentReference": { FHIR DocumentReference with resourceType, id, status, docStatus, type, category, subject, date, author, content, context },
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

### VP JWT payload (inside `vp` claim):
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

## Files to Modify:

### 1. server/portability/vc.ts
- `buildCredentialEnvelope()` (line 419-456): 
  - Change @context[1] to `wallet-medical-document/v1`
  - Add `nameTh` to issuer
  - Change credentialStatus type to `TrustCareStatusList2026` with `status: "active"`
  - NOTE: Don't add documentReference/humanDocument/trustcare here - those are added in reseed storage

- `createPresentation()` (line 216-259):
  - Add `trustcare` metadata block to VP payload
  - Add `validUntil` field
  - Add `context` field

### 2. server/portability/reseed.ts
- `upsertIssuedCredential()` (line 1132-1230):
  - Move `humanDocument` into `credentialSubject`
  - Add `documentReference` into `credentialSubject`
  - Replace `trustcareSeed` with `trustcare` metadata block
  - Add enriched `evidence` with fhirResources and resource

### 3. server/portability/labels.ts (or new file)
- Add document type definitions matching Wallet's `completeSeedDocumentDefinitions`
- Include: sourceSystem, fhirResources, defaultValidityDays, sensitivity, shareDefault, tags

### 4. Seed data enrichment
- Enrich credentialSubject claims for all types with realistic clinical data
- Match Wallet's expected nested keys (e.g. `summary`, `labReport`, `prescription`, etc.)

## Document Type Definitions (from Wallet):
| cardType | credentialType | category | sourceSystem | sensitivity |
|----------|---------------|----------|--------------|-------------|
| patient_identity | PatientIdentityCredential | identity_and_access | Registration/MPI | restricted |
| staff_identity | StaffIdentityCredential | identity_and_access | HR/IAM | restricted |
| consent_receipt | ConsentReceiptCredential | identity_and_access | Consent Management | high |
| mpi_link_certificate | MpiLinkCertificateCredential | identity_and_access | Master Patient Index | high |
| patient_summary | PatientSummaryCredential | clinical_summary | EMR/IPS Summary | high |
| allergy_alert | AllergyAlertCredential | clinical_summary | EMR Allergy List | critical |
| immunization | ImmunizationCredential | clinical_summary | Immunization Registry | normal |
| medical_certificate | MedicalCertificateCredential | clinical_summary | Doctor Certificate Desk | restricted |
| medication_summary | MedicationSummaryCredential | medication_and_pharmacy | Pharmacy/EMR | critical |
| prescription | PrescriptionCredential | medication_and_pharmacy | CPOE/e-Prescription | restricted |
| pharmacy_dispense | PharmacyDispenseCredential | medication_and_pharmacy | Pharmacy Dispensing | restricted |
| lab_result | LabResultCredential | diagnostics_and_results | LIS | high |
| diagnostic_report | DiagnosticReportCredential | diagnostics_and_results | RIS/PACS | high |
| referral_vc | ReferralCredential | care_transition | Referral Center | high |
| discharge_summary | DischargeSummaryCredential | care_transition | Inpatient EMR | high |
| insurance_eligibility | CoverageEligibilityCredential | claims_and_finance | Payer | restricted |
| claim_package | ClaimPackageCredential | claims_and_finance | Claim Center | restricted |
| claim_receipt | ClaimReceiptCredential | claims_and_finance | Finance/Billing | restricted |
| travel_document_verification | TravelDocumentVerificationCredential | medical_tourism | International Patient Center | high |
| visa_support_letter | VisaSupportLetterCredential | medical_tourism | International Patient Center | restricted |
| quotation | QuotationCredential | medical_tourism | International Finance Desk | restricted |
| guarantee_letter | GuaranteeLetterCredential | medical_tourism | Payer/International Desk | restricted |
| shl_manifest | ShlManifestCredential | sharing_and_sync | Smart Health Links | high |
| sync_receipt | SyncReceiptCredential | sharing_and_sync | Integration Adapter | normal |
| appointment | AppointmentCredential | operations | Appointment Scheduling | normal |

## Wallet credentialSubject expected keys per type:
- patient_identity: patient, identifiers, emergencyContact, registration
- staff_identity: staff, organization, privileges, accessLevel
- consent_receipt: patient, consent (consentId, status, scope, purpose, grantedTo, legalBasis, pdpaControls, grantedAt, expiresAt)
- mpi_link_certificate: patient, mpi (goldenRecordId, confidence, matchingPolicy, linkedIdentifiers)
- patient_summary: patient, summary (compositionId, title, date, author, conditions, allergies, medications, vitalSigns, carePlan)
- allergy_alert: patient, allergyIntolerances, emergencyInstruction, lastReviewedAt, reviewedBy
- immunization: patient, immunizations[], registryStatus
- medical_certificate: patient, certificate (certificateNo, type, diagnosis, examinationDate, result, restrictions, validUntil, certifyingPractitioner)
- medication_summary: patient, medicationSummary (currentAsOf, medications[], medicationReconciliation)
- prescription: patient, prescription (prescriptionNo, encounterId, authoredOn, prescriber, items[], note)
- pharmacy_dispense: patient, medicationDispense (dispenseNo, basedOnPrescription, dispensedAt, dispenser, items[], counseling)
- lab_result: patient, labReport (reportNo, specimenCollectedAt, reportedAt, laboratory, status, observations[])
- diagnostic_report: patient, diagnosticReport (reportNo, category, effectiveDateTime, status, modality, conclusion, observations[], imagingStudy, reportingPractitioner)
- referral_vc: patient, referral (referralNo, status, priority, fromHospital, toHospital, requestedService, reason, clinicalNotes, attachments, requestedBy, authoredOn)
- discharge_summary: patient, dischargeSummary (admissionNo, admissionDate, dischargeDate, dischargeDisposition, principalDiagnosis, secondaryDiagnoses, hospitalCourse, procedures, dischargeMedications, followUp)
- insurance_eligibility: patient, coverage (payer, status, coveragePeriod, network, benefitSummary, lastCheckedAt)
- claim_package: patient, claimPackage (claimNo, payer, policyNo, encounterId, claimType, diagnosisCodes, serviceLines, totalAmount, currency, attachments, status)
- claim_receipt: patient, receipt (receiptNo, invoiceNo, paidAt, cashier, items, grossAmount, discount, netAmount, paymentMethod, payerResponsibility, insurerResponsibility)
- travel_document_verification: patient, travelDocument (passportNoMasked, issuingCountry, nationality, verifiedAgainst, verifiedAt, verifiedBy, intendedTreatmentCountry, travelWindow)
- visa_support_letter: patient, visaSupportLetter (letterNo, issuingOrganization, purpose, proposedVisitPeriod, receivingDepartment, responsiblePhysician, note)
- quotation: patient, quotation (quotationNo, issuingOrganization, packageName, currency, validUntil, lineItems, estimatedTotal, exclusions)
- guarantee_letter: patient, guaranteeLetter (guaranteeNo, payer, policyNo, preAuthNo, coveredProvider, coveredServices, guaranteeLimit, validFrom, validUntil, conditions)
- shl_manifest: patient, shlManifest (shlId, purpose, label, passcodeRequired, maxAccessCount, currentAccessCount, expiresAt, manifestHash, sourceBundleHash, files[])
- sync_receipt: patient, syncReceipt (syncId, sourceSystem, targetSystem, syncDirection, startedAt, completedAt, status, objectCounts, checksum, adapterVersion)
- appointment: patient, appointment (appointmentId, status, serviceType, start, end, timezone, location, practitioner, checkinInstruction, requiredDocuments)
