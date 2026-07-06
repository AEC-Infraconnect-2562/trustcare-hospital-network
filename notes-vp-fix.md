# VP Context & Display Fix Notes

## Problem 1: VP Context Mismatch
- All VPs have context = "single_document" regardless of document type
- Should be: appointment → "appointment", visa_support_letter → "visa_support", etc.
- Location: server/portability/vc.ts → createPresentation() function
- Also: seedData.ts where VPs are created during seeding

## Problem 2: Duplicate Cards in Wallet
- Wallet shows ALL credentials including duplicates of same type
- Need: show only LATEST credential per cardType per issuer
- Older versions should move to "ประวัติ (Superseded)" tab

## Problem 3: Superseded Tab
- Tab already exists in UI ("ประวัติ (Superseded)")
- Need to populate it with older/superseded credentials sorted by date DESC

## Key Files to Modify:
1. server/routers.ts line ~560 - cardsByCategory procedure (wallet display logic)
2. server/portability/vc.ts - createPresentation() for context assignment
3. client/src/pages/Wallet.tsx - frontend display logic for tabs
4. server/portability/seedData.ts - seed VP creation with correct context

## Schema Info:
- walletCards: id, patientId, credentialId(int→issuedCredentials.id), cardType, displayName, isPinned, lastPresentedAt, createdAt
- issuedCredentials: id, credentialId(varchar unique), type, status, credentialData, issuedAt, expiresAt
- issuedPresentations: presentationId, patientId, context, purpose, status, createdAt

## Context Mapping (cardType → VP context):
- appointment → appointment
- prescription → prescription
- lab_result → lab_result
- diagnostic_report → diagnostic_report
- discharge_summary → discharge_summary
- medical_certificate → medical_certificate
- referral → referral
- immunization → immunization
- allergy → allergy_alert
- medication → medication
- patient_summary → patient_summary
- consent → consent
- identity → identity
- coverage → insurance
- claim → claim
- travel_document → travel_document
- shl_manifest → shl_package
- pharmacy_dispense → pharmacy
- visa_support_letter → visa_support
- quotation → quotation
- guarantee_letter → guarantee_letter
- mpi_link_certificate → identity_link
- sync_receipt → sync_receipt

## Deduplication Logic:
- Group cards by cardType
- Within each group, sort by issuedAt DESC
- First (newest) goes to active "Health Cards" tab
- Rest go to "ประวัติ (Superseded)" tab, sorted by date DESC
