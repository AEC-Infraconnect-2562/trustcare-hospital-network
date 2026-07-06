# v3.39 Progress Notes

## Completed Steps:
1. ✅ labels.ts - Added WALLET_DOCUMENT_CATALOG with all 25 document types (sourceSystem, fhirResources, sensitivity, shareDefault, layout, sections, accentColor, tags, selectiveDisclosure)
2. ✅ did.ts - Generated real ES256 key pairs for TCC, TCP, TCM using jose generateKeyPair. Added getHospitalKeyPair(), getAllHospitalPublicKeys(), getHospitalPublicJwk() helpers.
3. ✅ types.ts - Added nameTh and hospitalCode to IssuerProfile interface

## Remaining Steps:
3. vc.ts - Refactor buildCredentialEnvelope:
   - Change @context to "wallet-medical-document/v1"
   - Add issuer.nameTh
   - Change credentialStatus.type to "TrustCareStatusList2026" with status: "active"
   - Add trustcare metadata block at top-level
   - Add documentReference and humanDocument inside credentialSubject
   - Add richer evidence format
   - Accept new params: documentType, patient, hospitalCode
   - Use per-hospital key via getHospitalKeyPair

4. vc.ts - Refactor createPresentation:
   - Add "share-package/v1" to @context
   - Add validUntil to vp claim
   - Add trustcare block with mode/context/documentTypes/documentReferences/payloadHash

5. vc.ts - Refactor resolveSigningMaterial:
   - Accept hospitalCode parameter
   - Use getHospitalKeyPair(hospitalCode) for seed/demo mode
   - Fall back to env-based key for production

6. reseed.ts - Fix:
   - Add nameTh and hospitalCode to issuer profiles
   - Store issuedVc.credential as credentialData (not separate trustcareSeed)
   - Remove humanDocument from top-level credentialData

7. wellKnownRoutes.ts - Per-hospital JWKS:
   - Use getAllHospitalPublicKeys() in network JWKS
   - Use getHospitalPublicJwk(code) in hospital DID resolution

8. webhookDocumentImport.ts - Store issuedVc.credential instead of raw claims

9. Run reseed and verify

## Key Schema (from wallet-schema-reference.md):
- VC envelope: @context includes "wallet-medical-document/v1", issuer has nameTh, credentialSubject has documentReference + humanDocument, credentialStatus type is "TrustCareStatusList2026", top-level trustcare block
- VP claim: @context includes "share-package/v1", has validUntil, trustcare block with mode/context/documentTypes/documentReferences/payloadHash
- humanDocument: rendererVersion, layout, audience, titleTh, titleEn, issuer, patient, issuedAt, expiresAt, sections, sourceSystem, fhirResources, noPortrait, visualHints
- documentReference: FHIR DocumentReference with type/category/subject/author/content/context

## issueCredential needs new params:
- documentType (cardType like "prescription")
- patient (for humanDocument patient block)
- hospitalCode (for per-hospital signing)

## createPresentation needs new params:
- context (ConsentPurpose maps to context)
- documentTypes (array of cardTypes in the VP)
- documentReferences (array of DocumentReference objects)
