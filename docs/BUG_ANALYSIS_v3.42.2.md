# Bug Analysis: Credential Data Context Issue (v3.42.2)

## Problem
All wallet cards (appointment, quotation, guarantee_letter, visa_support_letter, etc.) display the same generic patient data (HN, CarePass, conditions, allergies, medications) regardless of credential type.

## Root Cause
In `server/portability/reseed.ts`, the `claimsForDocument()` function (line 1238) only has specific handlers for:
- `patient_summary` → calls `patientSummaryClaims(canonical)`
- `consent_receipt` → calls `consentReceiptClaims({...})`
- `medical_certificate` → handled earlier in the flow (line 1012)
- `prescription` → handled earlier in the flow (line 1049)

**All other types** (appointment, quotation, guarantee_letter, visa_support_letter, etc.) fall through to a **generic default** that returns:
```json
{
  "documentType": "...",
  "documentNo": "...",
  "patient": { "hn": "...", "carepassId": "...", "nameTh": "...", ... },
  "organization": { ... },
  "clinical": { "conditions": [...], "allergies": [...], "medications": [...] },
  "fhir": { ... },
  "humanDocument": { ... }
}
```

This means the credentialData stored in the DB is identical for all these types — just generic patient info.

## Frontend Rendering
In `client/src/components/CredentialRenderer.tsx`:
- The switch at line 1225 routes appointment, quotation, guarantee_letter, visa_support_letter to `GenericDocumentCard` (default case)
- `GenericDocumentCard` (line 1150) renders:
  1. DocumentHeader (with correct type-specific icon/color)
  2. PatientInfoSection (HN, CarePass)
  3. ClinicalSummarySection (conditions, allergies, medications)
  4. Generic "verified" status card

## Fix Required

### 1. Backend (reseed.ts) — Add type-specific claims builders
Add cases in `claimsForDocument()` for:
- `appointment` → { appointmentDate, service, location, practitioner, requiredDocuments }
- `quotation` → { packageName, lineItems, estimatedTotal, exclusions, validUntil }
- `guarantee_letter` → { payer, preAuthNumber, coveredServices, limit, conditions }
- `visa_support_letter` → { purpose, visitPeriod, receivingDepartment, responsiblePhysician }

### 2. Frontend (CredentialRenderer.tsx) — Add type-specific card components
Replace `GenericDocumentCard` with dedicated renderers:
- `AppointmentCard` — shows date/time, service, location, doctor
- `QuotationCard` — shows package, line items, total, exclusions
- `GuaranteeLetterCard` — shows payer, pre-auth, covered services, limit
- `VisaSupportLetterCard` — shows purpose, period, department, physician

### 3. Re-run seed to update existing credentials in DB

## Files to Modify
- `server/portability/reseed.ts` — claimsForDocument() function
- `client/src/components/CredentialRenderer.tsx` — add dedicated card components
- Run reseed to update DB data
