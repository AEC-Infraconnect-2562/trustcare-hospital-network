# VP Redesign Plan - Printer-Friendly Hospital Documents

## Key Decisions Made
1. Added Sarabun font to index.html (Google Fonts)
2. Added `.vp-document` CSS class system in index.css with:
   - A4 max-width (210mm), Sarabun font, proper line-height
   - doc-header, doc-title, doc-section, doc-field-grid, doc-table
   - doc-footer, doc-signature, doc-watermark
   - @media print rules
3. Widened Wallet.tsx dialog from max-w-lg to max-w-3xl
4. TypeScript compiles with 0 errors

## CredentialRenderer Redesign Strategy
- Replace Card/CardContent wrapper with `<div className="vp-document">`
- Replace gradient DocumentHeader with `.doc-header` (hospital name, address, document number)
- Replace PatientInfoSection with `.doc-patient-row` (photo + field grid)
- Replace colored rounded boxes with `.doc-section` + `.doc-field-grid`
- Replace inline lists with `.doc-table` for medications, lab results, line items
- Add `.doc-signature` block for practitioner
- Add `.doc-footer` with issue date, document number, DID
- Keep CopyWatermark but use `.doc-watermark` class

## Types by Format Category

### CARD FORMAT (keep card metaphor, no A4)
- patient_identity - Patient ID card
- staff_identity - Staff ID card  
- insurance_eligibility - Insurance card
- mpi_link_certificate - Link certificate card

### SLIP/TICKET FORMAT (compact)
- appointment - Appointment slip
- sync_receipt - Sync receipt

### A4 DOCUMENT FORMAT (printer-friendly, Sarabun font, letterhead)
- medical_certificate - Formal letter
- prescription - Prescription with drug table
- lab_result - Lab report with results table
- immunization - Vaccination record table
- patient_summary - Multi-section clinical summary
- allergy_alert - Alert document
- medication_summary - Drug list table
- referral_vc - Formal referral letter
- discharge_summary - Multi-section discharge document
- consent_receipt - Consent form
- travel_document_verification - Passport verification
- claim_package / claim_receipt - Financial document with table
- diagnostic_report - Radiology/pathology report
- pharmacy_dispense - Dispensing record with drug table
- visa_support_letter - Formal support letter
- quotation - Cost estimate with line items table
- guarantee_letter - Formal guarantee letter

## Current File Structure
- CredentialRenderer.tsx: ~2100 lines
- Main switch at line 2021-2044
- Shared helpers: extractRenderData (60-114), DocumentHeader (168-196), PatientInfoSection (199-231), DocumentFooter (234-253), PractitionerSection (256-293), ClinicalSummarySection (296-348)
- Type-specific cards: lines 350-1997
- CopyWatermark: 2000-2018
- CredentialCompactCard: 2055+ (DO NOT TOUCH - this is the list card)

## Important: Do NOT break
- CredentialCompactCard (wallet list view)
- The main switch routing
- extractRenderData function (it works correctly now)
- The CopyWatermark (keep it)
- Any field extraction logic that was fixed for object-as-child issues
