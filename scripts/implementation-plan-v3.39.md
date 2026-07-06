# v3.39 Implementation Plan - VC/VP Schema Alignment with External Wallet

## Goal
Make all VC/VP records wallet-compatible so External Wallet can sync every credential.

## Changes Needed

### 1. labels.ts - Add WALLET_DOCUMENT_CATALOG
Add a comprehensive catalog per document type with:
- sourceSystem, fhirResources, sensitivity, shareDefault, tags
- layout (for humanDocument), sections (for humanDocument)
- accentColor per category

### 2. vc.ts - Refactor buildCredentialEnvelope
Current:
```ts
{
  "@context": ["https://www.w3.org/ns/credentials/v2", "https://trustcare.network/contexts/health/v1"],
  credentialStatus: { type: "BitstringStatusListEntry", ... },
  issuer: { id, name, trustDomain, country },
  credentialSubject: { id, trustcareSubjectId, ...claims }
}
```
Target:
```ts
{
  "@context": ["https://www.w3.org/ns/credentials/v2", "https://trustcare.network/contexts/wallet-medical-document/v1"],
  issuer: { id, name, nameTh },
  credentialSubject: { id, ...claims, documentReference: {...}, humanDocument: {...} },
  credentialStatus: { id, type: "TrustCareStatusList2026", statusPurpose: "revocation", status: "active" },
  evidence: [{ type: "FHIRR4DocumentReferenceEvidence", sourceSystem, fhirResources, documentReferenceId, resource, attachment }],
  trustcare: { schemaVersion, documentType, credentialType, documentCategory, sensitivity, shareDefault, tags, issuerHospitalCode, holderDid, sourceSystem, selectiveDisclosureRecommendedFields, display: { cardAccent, documentLayout, watermark, patientFacingTitleTh, patientFacingTitleEn } }
}
```

### 3. vc.ts - Refactor createPresentation
Current VP claim:
```ts
{ "@context": ["https://www.w3.org/ns/credentials/v2"], id, type, holder, verifiableCredential, purpose }
```
Target VP claim:
```ts
{
  "@context": ["https://www.w3.org/ns/credentials/v2", "https://trustcare.network/contexts/share-package/v1"],
  id, type: ["VerifiablePresentation", "TrustcarePatientPresentation"],
  holder, purpose, validUntil,
  verifiableCredential: [...],
  trustcare: { mode: "TrustcarePatientPresentation", context, documentTypes, documentReferences, payloadHash }
}
```

### 4. did.ts - Per-hospital ES256 key pairs
Generate deterministic but valid ES256 key pairs for TCC, TCP, TCM using jose library.
Store in a HOSPITAL_KEYS map. Each hospital gets its own private/public key pair.
The `resolveSigningMaterial` in vc.ts needs to accept issuerDid and look up the correct key.

### 5. reseed.ts - Fix upsertIssuedCredential
- Remove `trustcareSeed` from credentialData
- Don't put `humanDocument` at top-level; it's already in credentialSubject via buildCredentialEnvelope
- The `credentialData` stored should just be `input.vc.credential` (which now includes trustcare block)
- Add `trustcare` metadata block to the credential envelope itself

### 6. reseed.ts - Fix issuerProfile
Add `nameTh` and `hospitalCode` to the issuer profile.

### 7. wellKnownRoutes.ts - Per-hospital JWKS
Update hospital DID resolution to use per-hospital public keys.

### 8. webhookDocumentImport.ts - Fix credentialData storage
Store `issuedVc.credential` instead of raw `claims`.

### 9. seedServiceReadiness.ts - Align or retire
Either route through the shared issuance flow or mark records as "readiness-only".

## Key Interfaces

### buildCredentialEnvelope new signature:
```ts
function buildCredentialEnvelope(input: {
  id: string;
  type: TrustcareCredentialType;
  documentType: string; // cardType like "prescription"
  issuer: IssuerProfile;
  subjectId: string;
  subjectDid?: string;
  claims: JsonRecord;
  evidence?: JsonRecord[];
  issuedAt: string;
  expiresAt: string;
  patient?: JsonRecord; // for humanDocument
  hospitalCode?: string;
}): JsonRecord
```

### createPresentation new VP claim:
```ts
{
  vp: {
    "@context": [..., "share-package/v1"],
    id, type: ["VerifiablePresentation", "TrustcarePatientPresentation"],
    holder, purpose, validUntil: expiresAt,
    verifiableCredential: [...jwts],
    trustcare: { mode, context, documentTypes, documentReferences, payloadHash }
  }
}
```

## Hospital Key Generation Strategy
Use jose `generateKeyPair("ES256")` at build time, store as constants.
For seed/demo: generate deterministic keys from hospital code using HKDF or similar.
For production: use env vars (existing TRUSTCARE_VC_SIGNING_PRIVATE_JWK).

## Execution Order
1. labels.ts - Add WALLET_DOCUMENT_CATALOG
2. did.ts - Add per-hospital key generation
3. vc.ts - Refactor buildCredentialEnvelope + createPresentation
4. reseed.ts - Fix issuerProfile, upsertIssuedCredential
5. wellKnownRoutes.ts - Per-hospital JWKS
6. webhookDocumentImport.ts - Fix credentialData storage
7. Run reseed
8. Verify
