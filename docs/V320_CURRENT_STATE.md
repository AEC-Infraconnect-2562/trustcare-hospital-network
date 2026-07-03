# v3.20.0 Current State Analysis

## What Already Exists (DO NOT RECREATE)

### Tables:
- `wallet_cards` - patient wallet cards linked to credentials
- `wallet_document_requests` - requests for documents (patient_upload source type supported)
- `wallet_import_jobs` - import jobs for documents into wallet
- `case_documents` - documents with fileUrl, fileKey, hash, fhirDocumentReference, verificationStatus
- `document_bundles` - bundles of documents for cases
- `service_readiness_checks` - readiness check results with SHL ID
- `issued_presentations` - VP records
- `smart_health_links` - SHL records
- `shl_files` - encrypted files in SHL manifests
- `shl_manifest_versions` - manifest version tracking
- `service_readiness_contracts` - Contract Hub contracts
- `contract_requirements` - requirements per contract
- `contract_questionnaires` - questionnaires per contract

### Procedures:
- `wallet.importForService` - import documents (currently simulated, persists to wallet_import_jobs)
- `wallet.documentRequests` - list document requests
- `wallet.requestDocument` - create document request
- `wallet.buildServicePacket` - builds VP + QR for check-in
- `shl.create` → calls createSmartHealthLinkPackage - full SHL creation with encryption, manifest, trust artifacts
- `wallet.readiness` - check readiness against contract
- `wallet.present` - present single card

### SHL Infrastructure (server/portability/shl.ts):
- buildShlinkPayload - creates shlink:/ QR payload
- encryptShlFile - JWE encryption for manifest files
- decryptShlFile - decryption
- buildManifestResponse - manifest JSON response
- hashPasscode / verifyPasscode - passcode protection
- manifestFileDigest - hash of manifest files

### VC/VP Infrastructure (server/portability/):
- vc.ts - VC issuance with JWT signing
- presentation.ts - VP creation (createPresentation)
- trust.ts - trust artifacts, ShlManifestCredential
- clinicalDocuments.ts - FHIR DocumentReference builders

## What Needs to Be Added

### 1. Document Upload Flow (Patient uploads PDF/image → FHIR DocumentReference → Wallet)

**New table needed:** `patient_uploaded_documents`
- id, patientId, fileName, mimeType, fileSize, fileKey, fileUrl
- hash (sha256 of file content)
- fhirDocumentReference (JSON - the FHIR DocumentReference resource)
- documentType (from caseDocuments enum)
- context (readiness context)
- status: uploaded → needs_review → verified → converted_to_vc
- reviewPolicy: auto_accept | manual_review
- uploadedAt, reviewedAt, reviewedBy

**New tRPC procedures:**
- `wallet.uploadDocument` - accepts base64 file, stores in S3, creates FHIR DocumentReference, creates wallet_import_job
- `wallet.listUploadedDocuments` - list patient's uploaded documents
- `wallet.getUploadedDocument` - get single document with signed URL

**Flow:**
1. Patient selects missing document type from readiness check
2. Patient uploads PDF/image (max 5MB)
3. Server: store in S3, calculate sha256 hash
4. Server: create FHIR DocumentReference with hash, provenance, metadata
5. Server: create patient_uploaded_documents record with status "uploaded"
6. Server: create wallet_import_job with status "queued"
7. If reviewPolicy = "auto_accept" for this document type → mark as "verified"
8. If manual_review → stays in "needs_review" queue for hospital staff
9. Once verified → can be included in SHL DocumentReference Bundle

### 2. QR Code Check-in (SHL-based)

**Extends existing buildServicePacket:**
- Currently builds VP + simple QR URL
- Need to also support SHL pattern for large packets (when DocumentReferences are included)

**New tRPC procedure:**
- `wallet.generateCheckinPacket` - builds SHL packet with:
  - VP (selected VCs from wallet)
  - FHIR Bundle (clinical summary)
  - DocumentReference Bundle (uploaded legacy documents)
  - ShlManifestCredential (integrity proof)
  - Returns: QR payload (shlink:/...), passcode, expiry

**Transport decision logic:**
- If only VCs (no uploaded documents) → use existing buildServicePacket (VP QR)
- If VCs + uploaded documents → use SHL pattern (SHL carries VP + DocumentReference Bundle)

### 3. Contract Admin CRUD

**Extends existing service_readiness_contracts table.**

**New tRPC procedures (admin only):**
- `contract.list` - list all contracts with pagination
- `contract.getById` - get contract with requirements and questionnaires
- `contract.create` - create new contract
- `contract.update` - update contract (creates new version)
- `contract.retire` - retire/deactivate contract
- `contract.addRequirement` - add requirement to contract
- `contract.updateRequirement` - update requirement
- `contract.removeRequirement` - remove requirement

**New frontend page:** ContractAdmin.tsx (admin only)
- List contracts with status filter
- Create/edit contract form
- Manage requirements per contract
- Version history

## Key Principles (from Agent Guide)
- SHL = transport layer (QR/URL → manifest → encrypted files)
- VC = trust layer (issuer, proof, schema, status)
- VP = patient-controlled presentation of multiple VCs
- DocumentReference = FHIR wrapper for legacy PDF/scan/image
- DO NOT store raw PDF in VC credentialSubject
- DO NOT mark legacy files as verified without review
- DO NOT expose raw file URLs without short-lived access control
- Keep existing single VC/VP flows intact, make them composable with new bundle flow
