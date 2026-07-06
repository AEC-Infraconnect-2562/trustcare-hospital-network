# Reseed.ts Changes Needed for v3.39

## 1. issuerProfile (line 1270-1278)
Current: returns only { id, name, did, country, trustDomain }
Change to: add nameTh and hospitalCode

```ts
function issuerProfile(document: JsonRecord, hospitalId: number): IssuerProfile {
  return {
    id: String(hospitalId),
    name: String(document.humanDocument?.renderData?.hospital?.nameEn ?? `TrustCare ${document.hospitalCode}`),
    nameTh: String(document.humanDocument?.renderData?.hospital?.nameTh ?? document.hospitalNameTh ?? document.hospitalCode),
    did: String(document.issuerDid),
    hospitalCode: String(document.hospitalCode),
    country: "TH",
    trustDomain: "trustcare-network",
  };
}
```

## 2. issueSeedCredential (lines 989-1129)
Add these params to ALL issueCredential calls:
- documentType: String(input.document.credentialType)
- hospitalCode: String(input.document.hospitalCode)
- patient: build PatientBlock from input.patient

PatientBlock builder:
```ts
function buildPatientBlock(patient: JsonRecord): PatientBlock {
  return {
    fullNameTh: String(patient.nameTh),
    fullNameEn: String(patient.nameEn),
    birthDate: String(patient.birthDate),
    gender: String(patient.gender),
    nationality: String(patient.nationality ?? "THA"),
    carepassId: String(patient.carepassId ?? ""),
    hn: String(patient.hn ?? ""),
    phone: String(patient.phone ?? ""),
    email: String(patient.email ?? ""),
  };
}
```

## 3. upsertIssuedCredential (lines 1132-1246)
Change credentialData to store ONLY the vc.credential (which now includes trustcare block, humanDocument, documentReference inside credentialSubject):
```ts
credentialData: input.vc.credential,
```
Remove the old trustcareSeed and top-level humanDocument wrapping.

## 4. upsertWalletCard (lines 1248-1268)
Change issuerHospitalName to use Thai name first (user requirement: Thai line 1, English line 2):
```ts
issuerHospitalName: String(document.humanDocument?.renderData?.hospital?.nameTh ?? document.hospitalNameTh ?? document.hospitalCode),
```
Also add issuerDid field if available in walletCards table.

## 5. VP issuance loop (lines 157-206)
Add to createPresentation call:
- hospitalCode: String(patient.hospitalCode)
- context: String(scenario.context)
- documentTypes: selected.map(item => String(item.document.credentialType))
- documentReferences: [] (or build from selected items)

## Key Wallet Expectations (from completeSeedData.ts):
- issuer.id = "did:web:trustcare.network:hospital:tcc"
- issuer.name = English name
- issuer.nameTh = Thai name
- credentialSubject contains documentReference and humanDocument
- credentialStatus.type = "TrustCareStatusList2026"
- Top-level trustcare block with schemaVersion, documentType, credentialType, etc.
- trustcare.display.patientFacingTitleTh = Thai title (line 1)
- trustcare.display.patientFacingTitleEn = English title (line 2)
- WalletCard.issuerHospitalName = Thai hospital name (for Thai-first display)
- WalletCard.issuerDid = hospital DID

## Hospital DIDs (must match Wallet):
- TCC: did:web:trustcare.network:hospital:tcc
- TCP: did:web:trustcare.network:hospital:tcp
- TCM: did:web:trustcare.network:hospital:tcm (Portal has this, Wallet doesn't yet)
