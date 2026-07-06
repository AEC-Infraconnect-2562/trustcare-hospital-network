# Fix Plan v3.42.2 - Type-Specific Credential Data

## Problem
All credential types (appointment, quotation, guarantee_letter, visa_support_letter, etc.) 
fall into the `default` case of `claimsForDocument()` in `server/portability/reseed.ts` (line 1237).
This default case returns generic patient data (clinical facts, conditions, allergies, medications)
for ALL types, making every card display the same information.

## Root Cause
`claimsForDocument()` only handles `patient_summary` and `consent_receipt` specifically.
All other types (except medical_certificate, prescription, sync_receipt which are handled earlier)
get the same generic claims object.

## Types That Need Specific Claims (from GenericDocumentCard in CredentialRenderer.tsx)
- appointment → Appointment details (date, time, department, doctor, service)
- quotation → Treatment cost breakdown (items, prices, total, validity)
- guarantee_letter → Insurance guarantee (insurer, policy, coverage amount, validity)
- visa_support_letter → Visa support (treatment plan, dates, doctor, hospital letter)
- diagnostic_report → Already has specific renderer but needs type-specific data
- pharmacy_dispense → Dispensing details (medications dispensed, pharmacist)
- shl_manifest → Smart Health Link details
- sync_receipt → Already handled specifically

## Types with Specific Renderers (already in switch case)
- patient_identity → PatientIdentityCard (needs avatar/photoUrl)
- staff_identity → StaffIdentityCard (needs avatar/photoUrl)
- medical_certificate → MedicalCertificateCard (already has specific claims)
- prescription → PrescriptionCard (already has specific claims)
- lab_result → LabResultCard
- immunization → ImmunizationCard
- patient_summary → PatientSummaryCard (already has specific claims)
- allergy_alert → AllergyAlertCard
- medication_summary → MedicationSummaryCard
- referral_vc → ReferralCard
- discharge_summary → DischargeSummaryCard
- insurance_eligibility → InsuranceEligibilityCard
- consent_receipt → ConsentReceiptCard (already has specific claims)
- travel_document_verification → TravelDocumentCard
- claim_package/claim_receipt → ClaimCard
- mpi_link_certificate → MpiLinkCard

## Avatar/Photo Requirements
- Types with noPortrait: false → patient_identity, staff_identity, travel_document_verification
- Avatar URL comes from `patient.avatarUrl` field in PatientBlock
- Currently `buildPatientBlock()` does NOT include avatarUrl
- Need to add avatarUrl to buildPatientBlock based on patient gender:
  - male → PERSON_IMAGE_URLS.patientMale = "/manus-storage/patient_somsak_a2e00e97.jpg"
  - female → PERSON_IMAGE_URLS.patientFemale = "/manus-storage/patient_malee_74d2ef04.jpg"
- The photoUrl is embedded in humanDocument.renderData.patient.photoUrl via vc.ts line 630

## Randomization Strategy
Use deterministic hash from `patient.seedId + hospitalCode + type` to pick random values from arrays.
This ensures:
1. Same patient+hospital+type always gets same data (reproducible)
2. Different patients get different data
3. Same patient at different hospitals gets different data

## Implementation Plan
1. Add avatarUrl to buildPatientBlock() based on gender
2. Replace the default return in claimsForDocument() with type-specific handlers
3. Each handler uses deterministic random (seeded from patient+hospital) for variety
4. Re-run reseed to regenerate all credentials with correct data
5. Update GenericDocumentCard to render type-specific fields

## Available Person Images
- patientMale: "/manus-storage/patient_somsak_a2e00e97.jpg"
- patientFemale: "/manus-storage/patient_malee_74d2ef04.jpg"
- doctorMale: "/manus-storage/doctor_thanawat_f91f7278.jpg"
- doctorFemale: "/manus-storage/doctor_napa_abd67502.jpg"
- nurseFemale: "/manus-storage/nurse_pimjai_ace1fd06.jpg"
- nurseMale: "/manus-storage/nurse_anucha_e814499a.jpg"
- pharmacistMale: "/manus-storage/engineer_piya_eb6aeff4.jpg"
- radiologist: "/manus-storage/doctor_kriangkrai_b6bcdefb.jpg"
- medTech: "/manus-storage/doctor_prasit_2ed84c26.jpg"

## Hospital Data
- TCC: โรงพยาบาลทรัสต์แคร์ เซ็นทรัล (Central Bangkok)
- TCP: โรงพยาบาลทรัสต์แคร์ ภูเก็ต อินเตอร์เนชันแนล (Phuket)
- TCM: โรงพยาบาลทรัสต์แคร์ เชียงใหม่ ครอสบอร์เดอร์ (Chiang Mai)

## Patient Data (BASE_PATIENTS)
- P001: นายสมชาย ใจดี (male, Thai, E11+I10)
- P002: นางสาวมาลี วัฒนา (female, Thai, J45)
- P003: Mr. John Williams (male, USA, M17.1) - medical tourist
- P004: Ms. Haruka Tanaka (female, JPN, N18.2) - cross border
