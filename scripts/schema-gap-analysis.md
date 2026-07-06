# Schema Gap Analysis: Portal VC/VP vs Wallet Expected Format

## VC (issued_credentials.credentialData)

### Current Portal Structure:
```json
{
  "@context": ["https://www.w3.org/ns/credentials/v2", "https://trustcare.network/contexts/health/v1"],
  "id": "urn:trustcare:seed:vc:...",
  "type": ["VerifiableCredential", "PatientSummaryCredential"],
  "issuer": { "id": "did:web:...", "name": "...", "country": "TH", "trustDomain": "..." },
  "validFrom": "...",
  "validUntil": "...",
  "credentialSubject": { /* type-specific FHIR data */ },
  "credentialStatus": { "type": "BitstringStatusListEntry", ... },
  "evidence": [{ "type": "FHIRR4SourceEvidence", "digest": "...", "sourceSystem": "..." }],
  "trustcareSeed": { "batchId": "...", "documentSeedId": "...", ... },
  "humanDocument": { "brand": "...", "label": "...", "templateId": "...", "renderData": {...} }
}
```

### Wallet Expected Structure:
```json
{
  "@context": ["https://www.w3.org/ns/credentials/v2", "https://trustcare.network/contexts/wallet-medical-document/v1"],
  "id": "urn:uuid:...",
  "type": ["VerifiableCredential", "PatientSummaryCredential"],
  "issuer": { "id": "did:web:...", "name": "...", "nameTh": "..." },
  "validFrom": "...",
  "validUntil": "...",
  "credentialSubject": {
    "id": "did:key:...",
    "patient": { ... },
    /* type-specific data (summary, labReport, prescription, etc.) */
    "documentReference": { /* FHIR DocumentReference */ },
    "humanDocument": { /* renderer metadata */ }
  },
  "credentialStatus": { "type": "TrustCareStatusList2026", "statusPurpose": "revocation", "status": "active" },
  "evidence": [{ "type": "FHIRR4DocumentReferenceEvidence", "sourceSystem": "...", "fhirResources": [...], "resource": {...} }],
  "trustcare": {
    "schemaVersion": "2026.07.complete-seed.v1",
    "documentType": "patient_summary",
    "credentialType": "PatientSummaryCredential",
    "documentCategory": "clinical_summary",
    "sensitivity": "high",
    "shareDefault": "ask",
    "tags": [...],
    "issuerHospitalCode": "TCC",
    "holderDid": "did:key:...",
    "sourceSystem": "...",
    "selectiveDisclosureRecommendedFields": [...],
    "display": { "cardAccent": "...", "documentLayout": "...", "watermark": "...", ... }
  }
}
```

## Key Differences to Fix:

### VC:
1. **@context[1]**: Change from `contexts/health/v1` → `contexts/wallet-medical-document/v1`
2. **issuer**: Add `nameTh` field
3. **credentialSubject**: 
   - Add `documentReference` (FHIR DocumentReference)
   - Move `humanDocument` from top-level into `credentialSubject`
4. **credentialStatus**: Change from `BitstringStatusListEntry` → `TrustCareStatusList2026` with `status: "active"`
5. **evidence**: Enrich with `fhirResources`, `documentReferenceId`, `resource`, `attachment`
6. **trustcareSeed** → rename to **trustcare** with full metadata (schemaVersion, documentType, credentialType, documentCategory, sensitivity, shareDefault, tags, display, etc.)

### VP (issued_presentations.presentationJwt):
Current VP structure is already good:
- `@context`, `type: ["VerifiablePresentation", "TrustcarePatientPresentation"]`
- `holder`, `verifiableCredential[]`, `purpose`

VP needs:
- Add `trustcare` metadata block (mode, context, documentTypes, documentReferences, payloadHash)
- Ensure `verifiableCredential[]` contains the updated VC payloads (will happen automatically when VCs are fixed)
- Potentially add `validUntil`, `selectedFields`, `recipient`

## Implementation Plan:
1. Create a `buildWalletCompatibleCredentialData()` function in reseed
2. Create a `buildDocumentReference()` helper matching Wallet format
3. Create a `buildTrustcareMetadata()` helper
4. Move `humanDocument` into `credentialSubject`
5. Update VP builder to include `trustcare` metadata
6. Re-run reseed for all records
