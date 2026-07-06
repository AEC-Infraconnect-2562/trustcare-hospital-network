# v3.39 Progress - Phase 5 Complete

## What's Done:
1. ✅ `did.ts` — Per-hospital ES256 key pairs (TCC, TCP, TCM)
2. ✅ `labels.ts` — WALLET_DOCUMENT_CATALOG with 26 entries (WalletDocumentDefinition interface)
3. ✅ `types.ts` — IssuerProfile has `nameTh` + `hospitalCode`
4. ✅ `vc.ts` — buildCredentialEnvelope produces wallet-compatible envelope:
   - `trustcare` block (schemaVersion, documentType, credentialType, sensitivity, shareDefault, tags, display with Thai/English titles)
   - `credentialSubject.documentReference` (FHIR DocumentReference)
   - `credentialSubject.humanDocument` (renderer metadata with sections)
   - `credentialStatus.type = "TrustCareStatusList2026"`
   - `issuer.nameTh` included
   - Per-hospital signing via resolveSigningMaterial
5. ✅ `vc.ts` — createPresentation produces wallet-compatible VP:
   - `trustcare` block with context, hospitalCode, documentTypes, branding
   - VP branding: Thai name line 1, English name line 2
6. ✅ `reseed.ts` — issuerProfile returns nameTh + hospitalCode
7. ✅ `reseed.ts` — issueSeedCredential passes documentType, patient, hospitalCode to ALL issueCredential calls
8. ✅ `reseed.ts` — upsertIssuedCredential stores `vc.credential` directly (no trustcareSeed/humanDocument wrapping)
9. ✅ `reseed.ts` — upsertWalletCard uses Thai name as primary + issuerDid
10. ✅ `reseed.ts` — VP loop passes hospitalCode, context, documentTypes to createPresentation
11. ✅ `schema.ts` — wallet_cards table has issuerDid column (migration applied)
12. ✅ All 352 tests passing, 0 TypeScript errors

## What's Next:
- Phase 6: Run reseed to regenerate all 400+ credentials with the new schema
- Phase 7: Verify all records match Wallet schema, push to GitHub, save checkpoint

## Key Wallet Expectations (from wallet-core/canonicalDocuments.ts):
- `credentialSubject.documentReference` — wallet looks here first
- `issuer.id` = DID, `issuer.name` = English, `issuer.nameTh` = Thai
- `trustcare.display.patientFacingTitleTh` = Thai title (line 1)
- `trustcare.display.patientFacingTitleEn` = English title (line 2)
- `credentialStatus.type = "TrustCareStatusList2026"`
- WalletCard.issuerHospitalName = Thai hospital name
- WalletCard.issuerDid = hospital DID

## Hospital DIDs:
- TCC: did:web:trustcare.network:hospital:tcc
- TCP: did:web:trustcare.network:hospital:tcp
- TCM: did:web:trustcare.network:hospital:tcm
