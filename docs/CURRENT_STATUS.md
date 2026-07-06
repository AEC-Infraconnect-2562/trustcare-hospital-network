# Current Status - v3.44.0 VP Redesign

## What's Done
1. ✅ DocumentRenderer.tsx created with A4 printer-friendly format for all 17+ document types
2. ✅ Field mismatches fixed (14 edits applied) - ClaimDoc, DiagnosticReportDoc, PharmacyDispenseDoc, VisaSupportLetterDoc, GuaranteeLetterDoc, AllergyAlertDoc, MedicationSummaryDoc, PatientSummaryDoc
3. ✅ Sarabun font added to index.html
4. ✅ vp-document CSS classes added to index.css (print-friendly styles)
5. ✅ Wallet dialog widened to max-w-3xl
6. ✅ Claims data in reseed.ts is already RICH - 6 lab panels, full discharge data, immunization CVX codes, insurance benefits, quotation line items, etc.
7. ✅ CredentialRenderer.tsx switch routes A4 types to DocumentRenderer

## What's Left
1. Need to add `str()` helper fix for `referringTo` in ReferralDoc - it renders `[object Object]` because `referringTo` is `{code, nameTh, nameEn, hcode}` but `str()` just does String()
2. Need to fix `payer` field in GuaranteeLetterDoc - it's `{name, payerType, contactRef}` object
3. Need to verify the `str()` helper handles objects correctly - currently it does `typeof v === 'object' ? JSON.stringify(v) : String(v)` which is ugly
4. Need to add insurance_eligibility as a DOCUMENT type (currently only in card format)
5. Need to test all types render without crash

## Key Architecture
- `CredentialRenderer.tsx` - main switch, routes to DocumentRenderer for A4 types, keeps card format for patient_identity, staff_identity, mpi_link
- `DocumentRenderer.tsx` - A4 printer-friendly renderer with DocumentShell, PatientBlock, SignatureBlock
- `reseed.ts` claimsForDocument() - type-specific claims builders (line 1380+)
- `vc.ts` - special claim builders for medical_certificate, prescription, patient_summary, consent_receipt (these DON'T go through claimsForDocument)

## str() helper in DocumentRenderer.tsx (line ~30)
```tsx
function str(v: any): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (v.nameTh) return v.nameTh;
  if (v.name) return typeof v.name === "string" ? v.name : v.name.nameTh || v.name.nameEn || JSON.stringify(v.name);
  return JSON.stringify(v);
}
```

## Insurance Eligibility Doc
Currently the `insurance_eligibility` type is in the CredentialRenderer card format, NOT routed to DocumentRenderer.
The seeded data has: payer{name,payerType,payerId}, memberId, planName, status, validFrom, validUntil, benefits{opd,ipd,dental,maternity,directBilling,annualLimit,remainingLimit}, copay{percentage,maxPerVisit}

## Remaining field issues to fix:
- GuaranteeLetterDoc line 901: `{s?.payer && <><span>ผู้ค้ำประกัน</span><span>{str(s.payer)}</span></>}` - payer is object {name, payerType, contactRef}
- ReferralDoc line 534: `{str(referringTo)}` - referringTo is {code, nameTh, nameEn, hcode}
- TravelDocumentDoc line 674: `s?.passportNumber` but seed uses `passportNumber` directly (OK)
- VisaSupportLetterDoc: `treatmentPlan.estimatedCost` is {amount, currency} - need to render as "฿150,000"
