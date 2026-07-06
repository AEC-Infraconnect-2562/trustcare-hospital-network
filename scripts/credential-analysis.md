# Credential Data Analysis

## Key Finding: No null credentialData records!

All 400 issued_credentials have non-null credentialData and non-null sdJwtVc.
The issue is NOT about null values — it's about **schema mismatch**.

## Current Portal credentialData vs Wallet expected format

### Wallet expects (from completeSeedData.ts):
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
    // type-specific data (e.g. summary, labReport, prescription, etc.)
    "documentReference": { FHIR DocumentReference },
    "humanDocument": { renderer metadata }
  },
  "credentialStatus": { "id": "...", "type": "TrustCareStatusList2026", ... },
  "evidence": [{ "type": "FHIRR4DocumentReferenceEvidence", ... }],
  "trustcare": {
    "schemaVersion": "...",
    "documentType": "...",
    "credentialType": "...",
    "documentCategory": "...",
    "sensitivity": "...",
    "shareDefault": "...",
    "tags": [...],
    "issuerHospitalCode": "...",
    "holderDid": "...",
    "sourceSystem": "...",
    "selectiveDisclosureRecommendedFields": [...],
    "display": { ... }
  }
}
```

### What Portal currently stores (from reseed.ts upsertIssuedCredential):
The full signed VC payload from `buildCredentialEnvelope()` + `trustcareSeed` + `humanDocument`

## Next Steps:
1. Check what the current credentialData actually looks like in the DB
2. Compare with Wallet's expected format
3. Align the Portal's VC envelope builder to match Wallet expectations
