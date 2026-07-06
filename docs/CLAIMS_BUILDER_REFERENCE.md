# Claims Builder Reference for v3.42.2

## Key Facts

### buildPatientBlock() at line 976 in reseed.ts
- Currently returns: fullNameTh, fullNameEn, birthDate, gender, nationality, carepassId, hn, phone, email
- NEEDS: `avatarUrl` field added using `defaultPatientImage(patient.gender as PersonGender)`
- Import needed: `import { defaultPatientImage, type PersonGender } from "../../shared/personImages";`

### claimsForDocument() at line 1238 in reseed.ts
- Currently handles: patient_summary, consent_receipt (all others fall to generic default)
- medical_certificate, prescription, sync_receipt handled BEFORE claimsForDocument (in issueSeedCredential)
- The generic default (line 1255-1288) returns: documentType, documentNo, documentHash, brand, label, fontPolicy, patient, organization, clinical, fhir, sourceOfTruth, humanDocument

### Types that need specific claims builders (go through claimsForDocument default):
1. patient_identity - identity card (noPortrait: false, needs photo)
2. allergy_alert - allergy info
3. medication_summary - medication list
4. referral_vc - referral details
5. lab_result - lab observations
6. diagnostic_report - imaging results
7. discharge_summary - discharge info
8. immunization - vaccine record
9. insurance_eligibility - coverage info
10. claim_package - claim submission
11. claim_receipt - claim response
12. travel_document_verification - passport verification (noPortrait: false)
13. pharmacy_dispense - dispensing record
14. appointment - scheduling
15. visa_support_letter - visa support
16. quotation - treatment cost estimate
17. guarantee_letter - insurance guarantee
18. mpi_link_certificate - identity linkage
19. shl_manifest - SHL package

### Deterministic randomization pattern:
```ts
const hash = sha256(String(patient.seedId) + String(document.hospitalCode) + type);
const pick = (arr: any[]) => arr[parseInt(hash.slice(0, 4), 16) % arr.length];
```

### Available helpers in reseed.ts:
- `seedPractitioner(hospitalCode)` → { id, name: "พญ. อริสา กลิ่นใจ", nameEn: "Dr. Arisa Klinjai", licenseNo: "MD-TH-12345" }
- `seedOrganization(patient)` → { id, name, nameEn, did }
- `clinicalFactsForPatient(patient)` → { conditions, allergies, medications }
- `diagnosisForPatient(patient)` → string
- `diagnosisText(code)` → string
- `medicationCodeForPatient(patient)` → string
- `medicationNameForPatient(patient)` → string
- `sha256(input)` → string
- `SEED_ISSUED_AT` = new Date("2026-07-01T02:00:00.000Z")
- `SEED_PREFIX` = "urn:trustcare:seed"

### CredentialRenderer.tsx switch cases needed:
- appointment → AppointmentCard (NEW)
- visa_support_letter → VisaSupportLetterCard (NEW)
- quotation → QuotationCard (NEW)
- guarantee_letter → GuaranteeLetterCard (NEW)
- pharmacy_dispense → PharmacyDispenseCard (NEW)
- diagnostic_report → DiagnosticReportCard (NEW)
- shl_manifest → ShlManifestCard (NEW)

### Existing card patterns (from CredentialRenderer.tsx):
- Extract credentialSubject fields: `const subject = props.credentialData?.credentialSubject || props.credentialData;`
- Use extractRenderData for hospital/patient/document info
- Use extractClinicalInfo for clinical data
- Each card: Card > DocumentHeader > CardContent > PatientInfoSection > type-specific section > DocumentFooter

### Labels sections (from labels.ts WALLET_DOCUMENT_CATALOG):
- appointment: sections: ["service", "time", "location", "practitioner", "required_documents"]
- quotation: sections: ["package", "line_items", "estimated_total", "exclusions"]
- guarantee_letter: sections: ["payer", "pre_auth", "covered_services", "limit", "conditions"]
- visa_support_letter: sections: ["purpose", "visit_period", "receiving_department", "responsible_physician"]
- pharmacy_dispense: sections: ["dispensed_items", "dispenser", "lot", "counseling"]
- diagnostic_report: sections: ["modality", "findings", "conclusion", "reporting_practitioner"]
- lab_result: sections: ["specimen", "observations", "reference_range", "interpretation"]
- insurance_eligibility: sections: ["payer", "policy", "benefits", "remaining_limit", "last_checked"]
- claim_package: sections: ["claim", "diagnosis_codes", "service_lines", "attachments", "total"]
- claim_receipt: sections: ["receipt", "invoice", "items", "payment", "payer_responsibility"]

### Financial workflow (from InternationalWorkflowPanels.tsx):
1. Quotation → Patient approval → Insurance review → Guarantee Letter → Deposit → Receipt
- Fields: insuranceProvider, quotationAmount, quotationCurrency, serviceLine

### Realistic Thai hospital data pools:
- Departments: อายุรกรรม, ศัลยกรรม, กุมารเวชกรรม, สูติ-นรีเวชกรรม, จักษุ, หู คอ จมูก, ออร์โธปิดิกส์, วิสัญญี, รังสีวิทยา, เวชศาสตร์ฟื้นฟู, จิตเวช, ทันตกรรม
- Insurance: AXA, Cigna, Pacific Cross, BUPA, Allianz, Tokio Marine, Muang Thai Life, Bangkok Insurance, Thai Health Insurance
- Treatment packages: ผ่าตัดไส้ติ่ง, ตรวจสุขภาพประจำปี, ผ่าตัดเปลี่ยนข้อเข่า, ผ่าตัดต้อกระจก, คลอดบุตร, ทำฟัน, ผ่าตัดหมอนรองกระดูก
- Lab tests: CBC, BUN/Cr, LFT, Lipid Profile, HbA1c, UA, FBS, Electrolyte, Thyroid Function, PT/INR
- Imaging: X-ray, CT Scan, MRI, Ultrasound, Mammogram, Bone Density, Echocardiogram
