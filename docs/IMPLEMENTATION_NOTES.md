# Implementation Notes for v3.42.2

## Key Architecture Understanding

### How claims flow into the VC:
1. `claimsForDocument()` returns a JsonRecord
2. This is passed as `claims` to `issueCredential()`
3. In `buildCredentialEnvelope()` (vc.ts line 554-561), claims are spread into `credentialSubject`:
   ```
   credentialSubject: {
     id: subjectDid,
     trustcareSubjectId: subjectId,
     ...input.claims,          // <-- claims from claimsForDocument go here
     patient: patientBlock,    // <-- overrides patient in claims if present
     documentReference: ...,   // <-- auto-built from docDef
     humanDocument: ...,       // <-- auto-built from docDef + patient
   }
   ```
4. `humanDocument.patient.photoUrl` comes from `patient.avatarUrl` (vc.ts line 630)

### What CredentialRenderer.tsx reads:
- `extractRenderData(credentialData)` reads `credentialSubject.humanDocument.renderData` (hospital, patient, document, issuer)
- `extractClinicalInfo(credentialData)` reads `credentialSubject.clinical` (conditions, allergies, medications), `credentialSubject.practitioner`, `credentialSubject.diagnosisText`, etc.
- Type-specific cards read from `credentialSubject` directly (e.g., `subject.scopes` for consent)

### What needs to change in reseed.ts:

1. **buildPatientBlock** (line 976-988): Add `avatarUrl` field
   ```ts
   import { defaultPatientImage, type PersonGender } from "../../shared/personImages";
   // In buildPatientBlock:
   avatarUrl: defaultPatientImage(String(patient.gender) as PersonGender),
   ```

2. **claimsForDocument** (line 1238-1288): Replace the generic default with type-specific handlers

### Deterministic randomization:
```ts
const hash = sha256(String(patient.seedId) + String(document.hospitalCode) + type);
const pick = <T>(arr: T[]): T => arr[parseInt(hash.slice(0, 4), 16) % arr.length];
const pickN = <T>(arr: T[], n: number): T[] => {
  const shuffled = [...arr].sort((a, b) => parseInt(sha256(hash + a + String(arr.indexOf(a))).slice(0, 4), 16) - parseInt(sha256(hash + b + String(arr.indexOf(b))).slice(0, 4), 16));
  return shuffled.slice(0, n);
};
```

### Types that need claims (going through claimsForDocument default):
All types except: patient_summary, consent_receipt (handled specifically), and medical_certificate, prescription, sync_receipt (handled before claimsForDocument is called)

### Existing helper functions available:
- `seedPractitioner(hospitalCode)` → { id, name, nameEn, licenseNo }
- `seedOrganization(patient)` → { id, name, nameEn, did }
- `clinicalFactsForPatient(patient)` → { conditions, allergies, medications }
- `diagnosisForPatient(patient)` → string (English)
- `diagnosisText(code)` → string (English)
- `medicationCodeForPatient(patient)` → string
- `medicationNameForPatient(patient)` → string
- `sha256(input)` → string
- `SEED_ISSUED_AT` = new Date("2026-07-01T02:00:00.000Z")
- `primaryFhirResource(type)` → string

### Hospital data:
- TCC: โรงพยาบาลทรัสต์แคร์ เซ็นทรัล (Bangkok) - code TCC, hcode HCODE-TCC-99991
- TCP: โรงพยาบาลทรัสต์แคร์ ภูเก็ต อินเตอร์เนชันแนล (Phuket) - code TCP, hcode HCODE-TCP-99992
- TCM: โรงพยาบาลทรัสต์แคร์ เชียงใหม่ ครอสบอร์เดอร์ (Chiang Mai) - code TCM, hcode HCODE-TCM-99993

### Patient data (BASE_PATIENTS):
- P001: นายสมชาย ใจดี / Mr. Somchai Jaidee (male, THA, E11+I10, Penicillin severe) - tags: opd, referral, claim, pharmacy, medical_certificate
- P002: นางสาวมาลี วัฒนา / Ms. Malee Wattana (female, THA, J45, Sulfonamide rash) - tags: opd, emergency, lab
- P003: Mr. John Williams (male, USA, M17.1, No known allergy, passport X12345678) - tags: medical_tourist, insurance, travel_document
- P004: Ms. Haruka Tanaka (female, JPN, N18.2, Iodinated contrast medium moderate, passport TZ9988123) - tags: cross_border, imaging, lab

### EXTRA_NAMES patients:
- David Chen (male, M16, No known allergy) - medical_tourist, quotation, guarantee_letter
- Sofia Garcia (female, Z23, Latex rash) - travel_document, immunization
- ปกรณ์ แสงทอง (male, E11+N18.2, Penicillin rash) - claim, lab, discharge_summary
- พิมพ์ชนก แก้วมณี (female, A09, No known allergy) - medical_certificate, appointment
- Ahmed Khan (male, I10, Iodinated contrast) - cross_border, insurance

### Realistic data pools for claims:
- Thai departments: อายุรกรรม, ศัลยกรรม, กุมารเวชกรรม, สูติ-นรีเวชกรรม, จักษุ, หู คอ จมูก, ออร์โธปิดิกส์, รังสีวิทยา, เวชศาสตร์ฟื้นฟู
- Insurance: AXA, Cigna, Pacific Cross, BUPA, Allianz, Tokio Marine, Muang Thai Life, Bangkok Insurance
- Treatment packages: ผ่าตัดไส้ติ่ง, ตรวจสุขภาพประจำปี, ผ่าตัดเปลี่ยนข้อเข่า, ผ่าตัดต้อกระจก, คลอดบุตร, ผ่าตัดหมอนรองกระดูก
- Lab tests: CBC, BUN/Cr, LFT, Lipid Profile, HbA1c, UA, FBS, Electrolyte, Thyroid Function, PT/INR
- Imaging modalities: X-ray, CT Scan, MRI, Ultrasound, Mammogram, Bone Density, Echocardiogram
- Vaccines: COVID-19 (Pfizer), Influenza, Hepatitis B, Tetanus, HPV, Pneumococcal, MMR

### Financial workflow (from InternationalWorkflowPanels.tsx):
Quotation → Patient approval → Insurance review → Guarantee Letter → Deposit → Receipt
Fields: insuranceProvider, quotationAmount, quotationCurrency, serviceLine

### Claim center fields (from claimCenter.ts):
- eligibility: { status, checkedAt, validUntil, preAuthorizationRequired, coverageCredentialId, benefits: { opd, ipd, dental, directBilling } }
- serviceItems: Array<{ code, description, amount }>
- totalAmount, approvedAmount, currency, memberId, encounterRef, diagnosisCodes, procedureCodes

### SHL manifest structure (from shlDocumentManifest.ts):
- documents: Array<{ documentType, title, category, sourceRole, fhirResource, status, vcBinding, accessBinding }>
- bundleId, manifestVersion, source, bindingModel, standards, status
