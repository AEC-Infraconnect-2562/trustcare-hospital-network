# Verifier Clinical Display Bug Analysis

## Problem
When scanning different VP/VC QR codes, the verifier shows the same clinical context (Allergies, Medications) for all credentials, regardless of the actual VC type.

## Root Cause
In `client/src/pages/Verifier.tsx` lines 44-47:

```tsx
const subjects = credentials.map((credential: any) => credential?.credentialSubject ?? credential?.vc?.credentialSubject ?? {});
const patient = subjects.find((subject: any) => subject.patient)?.patient ?? subjects[0]?.patient ?? {};
const allergies = flatten(subjects.map((subject: any) => subject.critical?.allergies ?? subject.clinical?.allergies ?? []));
const medications = flatten(subjects.map((subject: any) => subject.critical?.medications ?? subject.clinical?.medications ?? []));
```

The code extracts `critical.allergies` and `clinical.medications` from ALL credentials in the VP. Since VPs bundle multiple credentials (including PatientSummary), the same allergies/medications always appear.

## Fix Needed
1. **Show credential-type-specific content** instead of generic allergies/medications for all VCs
2. For each credential type, display relevant fields:
   - PatientSummaryCredential → allergies, medications, conditions
   - QuotationCredential → quotation items, total cost, validity
   - ReferralCredential → referral reason, target hospital, urgency
   - MedicalCertificateCredential → diagnosis, fitness status
   - GuaranteeLetterCredential → coverage amount, insurer
   - ConsentReceiptCredential → consent purpose, scopes, expiry
   - InsuranceEligibilityCredential → coverage details
   - PrescriptionCredential → medications prescribed
   - LabResultCredential → lab results, observations
3. Show a **Credential Type badge** prominently
4. Only show allergies/medications when a PatientSummary credential is present

## Backend
- `verifyPresentation()` in `server/portability/vc.ts` returns the full credential object from `payload.vc`
- `verifyCredential()` returns `credential` (the vc payload) and `credentialType`
- The credential type is in `credential.type` array (e.g., ["VerifiableCredential", "QuotationCredential"])
- credentialSubject contains type-specific data

## Key Files
- Frontend: `client/src/pages/Verifier.tsx` (lines 44-47, 161-194)
- Backend: `server/portability/vc.ts` (verifyPresentation, verifyCredential)
- Seed: `server/portability/reseed.ts` (credential types and their claims)
