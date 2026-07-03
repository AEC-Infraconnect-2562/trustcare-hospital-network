# v3.20.0 Implementation Progress

## ALL COMPLETED

1. **patient_uploaded_documents table** - Created with FHIR DocumentReference JSON column, indexes on patientId/status/context
2. **DB helper functions** - createPatientUploadedDocument, listPatientUploadedDocuments, getPatientUploadedDocumentById, getPatientUploadedDocumentByUploadId, updatePatientUploadedDocument, listDocumentsNeedingReview
3. **Upload tRPC procedures** - wallet.uploadDocument, wallet.listUploadedDocuments, wallet.reviewUploadedDocument, wallet.pendingDocumentReviews
4. **QR Code Check-in** - wallet.generateCheckinQR procedure wrapping createSmartHealthLinkPackage with context-based SHL purpose mapping
5. **Contract Admin CRUD** - contractAdmin.list, contractAdmin.getById, contractAdmin.create, contractAdmin.update, contractAdmin.delete, contractAdmin.listTemplates
6. **Contract Admin DB helpers** - listAllContracts, getContractById, getContractByContractId, createServiceContract, updateServiceContract, deleteServiceContract, listBundleTemplates
7. **Frontend: UploadDocButton** - Inline upload component for missing readiness items (PDF/JPEG/PNG/WebP, 10MB max)
8. **Frontend: CheckinQRPanel** - QR code generation dialog using qrcode.react with SHL metadata display
9. **Frontend: ContractAdmin.tsx** - Full CRUD page with tabs (Contracts + Bundle Templates), create/edit dialog, status badges
10. **Route & Menu** - /contract-admin route in App.tsx, FileStack icon + menu item in DashboardLayout
11. **Tests** - contractAdmin.test.ts (7 tests) - all passing
12. **Architecture docs** - ARCHITECTURE.md section 38, README.md updated to v3.20.0
13. **0 TS errors confirmed**
14. **319 tests passing across 25 test files**

## Architecture Decisions

### Document Upload
- Files stored in S3 via `storagePut`, referenced by fileKey/fileUrl
- SHA-256 hash computed for integrity verification
- FHIR R4 DocumentReference created for each upload
- Review policy: auto_accept or manual_review based on document type
- Status flow: uploaded → needs_review → verified → converted_to_vc (or rejected)

### QR Check-in
- Uses existing `createSmartHealthLinkPackage` infrastructure
- Context mapped to SHL purpose via `contextForShlPurpose` helper
- Includes wallet cards + uploaded documents in SHL bundle
- 24-hour expiry, max 3 scans
- Returns shlink:/ URI for QR code rendering

### Contract Admin
- Admin-only procedures (role check via adminProcedure)
- Soft-delete pattern (status → "deprecated")
- JSON fields for requirements, questionnaire, consent policy
- Supports all 7 readiness contexts
