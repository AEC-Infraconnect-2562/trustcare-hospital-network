# DocumentRenderer.tsx Field Mismatches vs Seeded Claims

These are the field name mismatches between what DocumentRenderer.tsx reads and what reseed.ts actually puts in the claims.

## 1. ClaimDoc (lines 689-724)
- Renderer reads: `items|claimItems`, `claimId`, `payer`
- Seed provides: `serviceItems`, `claimRef`, `attachedEvidence`, `breakdown`
- Fix: Update renderer to use `s?.serviceItems`, `s?.claimRef`

## 2. DiagnosticReportDoc (lines 728-760)
- Renderer reads: `indication`, `impression`, `reportingPhysician`
- Seed provides: `clinicalIndication`, `conclusion`/`conclusionTh`, `reportingRadiologist`
- Fix: Update renderer to use `s?.clinicalIndication`, `s?.conclusionTh || s?.conclusion`, `s?.reportingRadiologist`

## 3. PharmacyDispenseDoc (lines 764-798)
- Renderer reads: `item.name|drugName|code`, `dispensingNote`, `dispensedBy|pharmacist`
- Seed provides: `dispensedItems[].medicationName`, `dispensedItems[].medicationNameTh`, `counselingNotes`, `counselingNotesEn`, `dispenser`
- Fix: Update renderer to use `s?.dispensedItems`, `s?.counselingNotes`, `s?.dispenser`

## 4. VisaSupportLetterDoc (lines 802-845)
- Renderer reads: `passportNumber`, `nationality`, `estimatedStayDays`, renders `plannedProcedures`/`estimatedCost` directly
- Seed provides: `patientPassport`, `patientNationality`, `visitPeriod.totalDays`, `treatmentPlan.plannedProcedures` (array), `treatmentPlan.estimatedCost` (object {amount, currency})
- Fix: Update renderer to use `s?.patientPassport`, `s?.patientNationality`, `s?.visitPeriod?.totalDays`, `s?.treatmentPlan?.plannedProcedures`, `s?.treatmentPlan?.estimatedCost?.amount`

## 5. GuaranteeLetterDoc (lines 891-916)
- Renderer reads: `conditions` directly in field grid, `approvedBy|authorizedBy`
- Seed provides: `conditions` as array of strings, `conditionsEn` as array, no signatory object (only `issuedByPayer: true`)
- Fix: Render conditions as list, remove signatory block or use payer.name

## 6. AllergyAlertDoc (line 462)
- Renderer reads: `s?.clinical?.allergies` (string array)
- Seed provides: `s?.allergies` (array of objects with substance, severity, reaction, etc.)
- Fix: Use `s?.allergies` and render substance/severity/reaction from each object

## 7. MedicationSummaryDoc (line 489)
- Renderer reads: `s?.clinical?.medications` (simple array)
- Seed provides: `s?.medications` (array of objects with name, nameTh, dose, frequency, route, etc.)
- Fix: Use `s?.medications` and render full details

## 8. PatientSummaryDoc (line 409)
- Renderer reads: `s?.clinical?.conditions`, `s?.clinical?.allergies`, `s?.clinical?.medications`
- Seed provides: These are from patientSummaryClaims() which uses canonical data - need to verify shape
- Note: This uses a different code path (patientSummaryClaims) so may be correct

## 9. PrescriptionDoc (line 246)
- Renderer reads: `s?.fhir?.medicationRequests || s?.medications`
- Seed provides: prescription type is NOT in claimsForDocument - it goes through a different path
- Note: Need to check what prescription claims look like (likely from canonical/FHIR path)

## 10. MedicalCertificateDoc (line 208)
- Renderer reads: `s?.diagnosisText`, `s?.fitnessForWork`, `s?.recommendations`
- Seed provides: medical_certificate type is NOT in claimsForDocument - goes through different path
- Note: Need to check what medical_certificate claims look like
