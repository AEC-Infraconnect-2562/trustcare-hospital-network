import type { JsonRecord } from "./types";

export const TRUSTCARE_DOCUMENT_BRAND = {
  brand: "TrustCare",
  label: "TrustCare Verified Health Document",
  networkName: "TrustCare Hospital Network",
  syntheticTestData: true,
};

export const THAI_GOVERNMENT_DOCUMENT_FONT_POLICY = {
  primary: {
    family: "TH Sarabun New",
    webFamily: "Sarabun",
    fallback: ["Sarabun", "TH SarabunPSK", "Noto Sans Thai", "Tahoma", "sans-serif"],
    source: "Thai national/government document font practice",
    license: "TH Sarabun New: GPL-2.0 with font exception; Sarabun web font: SIL Open Font License 1.1",
    usage: "Printable Thai government-style documents, medical certificates, prescriptions, claims, and consent forms.",
  },
  uiFallback: {
    family: "Noto Sans Thai",
    fallback: ["Sarabun", "Tahoma", "sans-serif"],
    usage: "Dense clinical UI tables and browser fallback when Sarabun is unavailable.",
  },
  css: {
    printFontFamily: "\"TH Sarabun New\", \"Sarabun\", \"TH SarabunPSK\", \"Noto Sans Thai\", Tahoma, sans-serif",
    uiFontFamily: "\"Sarabun\", \"Noto Sans Thai\", Tahoma, sans-serif",
  },
  researchedSources: [
    "https://www.f0nt.com/release/th-sarabun-new/",
    "https://github.com/cadsondemak/Sarabun",
    "https://raw.githubusercontent.com/cadsondemak/Sarabun/master/OFL.txt",
  ],
};

export const FHIR_RESOURCE_LABELS: Record<string, JsonRecord> = {
  Patient: { th: "ผู้ป่วย", en: "Patient", icon: "UserRound", category: "Base" },
  Organization: { th: "องค์กรผู้ให้บริการ", en: "Organization", icon: "Building2", category: "Base" },
  Practitioner: { th: "บุคลากรทางการแพทย์", en: "Practitioner", icon: "Stethoscope", category: "Base" },
  Encounter: { th: "การเข้ารับบริการ", en: "Encounter", icon: "CalendarClock", category: "Base" },
  Consent: { th: "ความยินยอม", en: "Consent", icon: "ClipboardCheck", category: "Foundation" },
  Provenance: { th: "หลักฐานแหล่งที่มา", en: "Provenance", icon: "GitBranch", category: "Foundation" },
  AuditEvent: { th: "บันทึกตรวจสอบ", en: "AuditEvent", icon: "FileSearch", category: "Foundation" },
  Composition: { th: "ชุดเอกสารทางคลินิก", en: "Composition", icon: "Files", category: "Foundation" },
  DocumentReference: { th: "เอกสารอ้างอิง", en: "DocumentReference", icon: "FileText", category: "Foundation" },
  Bundle: { th: "ชุดข้อมูล FHIR", en: "Bundle", icon: "Package", category: "Foundation" },
  AllergyIntolerance: { th: "ประวัติแพ้ยา/แพ้สาร", en: "AllergyIntolerance", icon: "TriangleAlert", category: "Clinical" },
  Condition: { th: "ปัญหา/การวินิจฉัย", en: "Condition", icon: "Activity", category: "Clinical" },
  Observation: { th: "ผลตรวจ/ค่าสังเกต", en: "Observation", icon: "ChartNoAxesCombined", category: "Clinical" },
  DiagnosticReport: { th: "รายงานผลตรวจ", en: "DiagnosticReport", icon: "Microscope", category: "Clinical" },
  MedicationRequest: { th: "คำสั่งยา", en: "MedicationRequest", icon: "Pill", category: "Clinical" },
  MedicationStatement: { th: "ยาที่ใช้อยู่", en: "MedicationStatement", icon: "ClipboardList", category: "Clinical" },
  MedicationDispense: { th: "บันทึกจ่ายยา", en: "MedicationDispense", icon: "PackageCheck", category: "Clinical" },
  Immunization: { th: "ประวัติวัคซีน", en: "Immunization", icon: "Syringe", category: "Clinical" },
  ServiceRequest: { th: "คำขอบริการ/ส่งต่อ", en: "ServiceRequest", icon: "Send", category: "Clinical" },
  Coverage: { th: "สิทธิ์/กรมธรรม์", en: "Coverage", icon: "ShieldCheck", category: "Financial" },
  Claim: { th: "เคลม", en: "Claim", icon: "ReceiptText", category: "Financial" },
  ClaimResponse: { th: "ผลตอบรับเคลม", en: "ClaimResponse", icon: "BadgeCheck", category: "Financial" },
  ExplanationOfBenefit: { th: "รายละเอียดสิทธิประโยชน์", en: "ExplanationOfBenefit", icon: "FileCheck2", category: "Financial" },
};

export const DOCUMENT_CATEGORY_LABELS: Record<string, JsonRecord> = {
  identity_and_access: { th: "ตัวตนและสิทธิ์เข้าถึง", en: "Identity and Access", icon: "BadgeCheck", retentionClass: "long_lived" },
  clinical_summary: { th: "สรุปและความเสี่ยงทางคลินิก", en: "Clinical Summary and Risk", icon: "FileHeart", retentionClass: "clinical" },
  medication_and_pharmacy: { th: "ยาและเภสัชกรรม", en: "Medication and Pharmacy", icon: "Pill", retentionClass: "clinical" },
  diagnostics_and_results: { th: "ผลตรวจและวินิจฉัย", en: "Diagnostics and Results", icon: "Microscope", retentionClass: "clinical" },
  care_transition: { th: "ส่งต่อและเปลี่ยนผ่านการดูแล", en: "Care Transition", icon: "ArrowRightLeft", retentionClass: "clinical" },
  claims_and_finance: { th: "เคลมและการเงิน", en: "Claims and Finance", icon: "ReceiptText", retentionClass: "financial" },
  medical_tourism: { th: "ผู้ป่วยต่างชาติและการเดินทาง", en: "Medical Tourism", icon: "Globe2", retentionClass: "administrative" },
  sharing_and_sync: { th: "การแชร์และซิงก์ข้อมูล", en: "Sharing and Synchronization", icon: "RefreshCcw", retentionClass: "audit" },
  operations: { th: "ปฏิบัติการและนัดหมาย", en: "Operations", icon: "CalendarDays", retentionClass: "operational" },
};

const DOCUMENT_STORAGE_MAP: Record<string, JsonRecord> = {
  patient_identity: { category: "identity_and_access", subcategory: "identity", fhirClassCode: "51851-4", fhirClassDisplay: "Administrative note" },
  staff_identity: { category: "identity_and_access", subcategory: "identity", fhirClassCode: "51851-4", fhirClassDisplay: "Administrative note" },
  consent_receipt: { category: "identity_and_access", subcategory: "consent", fhirClassCode: "59284-0", fhirClassDisplay: "Patient Consent" },
  mpi_link_certificate: { category: "identity_and_access", subcategory: "mpi", fhirClassCode: "51851-4", fhirClassDisplay: "Administrative note" },
  patient_summary: { category: "clinical_summary", subcategory: "summary", fhirClassCode: "34133-9", fhirClassDisplay: "Summarization of episode note" },
  allergy_alert: { category: "clinical_summary", subcategory: "risk", fhirClassCode: "48765-2", fhirClassDisplay: "Allergies and adverse reactions Document" },
  immunization: { category: "clinical_summary", subcategory: "immunization", fhirClassCode: "11369-6", fhirClassDisplay: "History of Immunization" },
  medical_certificate: { category: "clinical_summary", subcategory: "certificate", fhirClassCode: "34109-9", fhirClassDisplay: "Evaluation and management note" },
  medication_summary: { category: "medication_and_pharmacy", subcategory: "summary", fhirClassCode: "56445-0", fhirClassDisplay: "Medication Summary Document" },
  prescription: { category: "medication_and_pharmacy", subcategory: "order", fhirClassCode: "57828-6", fhirClassDisplay: "Prescription list" },
  pharmacy_dispense: { category: "medication_and_pharmacy", subcategory: "dispense", fhirClassCode: "56445-0", fhirClassDisplay: "Medication Summary Document" },
  lab_result: { category: "diagnostics_and_results", subcategory: "laboratory", fhirClassCode: "26436-6", fhirClassDisplay: "Laboratory Studies (set)" },
  diagnostic_report: { category: "diagnostics_and_results", subcategory: "imaging", fhirClassCode: "18726-0", fhirClassDisplay: "Radiology studies (set)" },
  referral_vc: { category: "care_transition", subcategory: "referral", fhirClassCode: "57133-1", fhirClassDisplay: "Referral note" },
  discharge_summary: { category: "care_transition", subcategory: "discharge", fhirClassCode: "18842-5", fhirClassDisplay: "Discharge summary" },
  appointment: { category: "operations", subcategory: "scheduling", fhirClassCode: "56446-8", fhirClassDisplay: "Appointment summary Document" },
  insurance_eligibility: { category: "claims_and_finance", subcategory: "eligibility", fhirClassCode: "64291-8", fhirClassDisplay: "Health insurance-related form" },
  claim_package: { category: "claims_and_finance", subcategory: "claim_package", fhirClassCode: "64291-8", fhirClassDisplay: "Health insurance-related form" },
  claim_receipt: { category: "claims_and_finance", subcategory: "claim_receipt", fhirClassCode: "64291-8", fhirClassDisplay: "Health insurance-related form" },
  travel_document_verification: { category: "medical_tourism", subcategory: "travel_document", fhirClassCode: "51851-4", fhirClassDisplay: "Administrative note" },
  visa_support_letter: { category: "medical_tourism", subcategory: "visa", fhirClassCode: "51851-4", fhirClassDisplay: "Administrative note" },
  quotation: { category: "medical_tourism", subcategory: "quotation", fhirClassCode: "51851-4", fhirClassDisplay: "Administrative note" },
  guarantee_letter: { category: "medical_tourism", subcategory: "guarantee", fhirClassCode: "51851-4", fhirClassDisplay: "Administrative note" },
  shl_manifest: { category: "sharing_and_sync", subcategory: "shl", fhirClassCode: "34133-9", fhirClassDisplay: "Summarization of episode note" },
  sync_receipt: { category: "sharing_and_sync", subcategory: "sync_receipt", fhirClassCode: "51851-4", fhirClassDisplay: "Administrative note" },
};

export const DOCUMENT_TYPE_LABELS: Record<string, JsonRecord> = {
  patient_identity: { th: "บัตรประจำตัวผู้ป่วย", en: "Patient Identity", icon: "BadgeCheck", vcType: "PatientIdentityCredential" },
  staff_identity: { th: "บัตรประจำตัวเจ้าหน้าที่โรงพยาบาล", en: "Hospital Staff Identity", icon: "IdCard", vcType: "HospitalStaffIdentityCredential" },
  consent_receipt: { th: "ใบรับรองความยินยอม", en: "Consent Receipt", icon: "ClipboardCheck", vcType: "ConsentReceiptCredential" },
  patient_summary: { th: "สรุปข้อมูลผู้ป่วยพกพา", en: "Portable Patient Summary", icon: "FileHeart", vcType: "PatientSummaryCredential" },
  allergy_alert: { th: "บัตรแจ้งเตือนการแพ้ยา", en: "Allergy Alert", icon: "TriangleAlert", vcType: "AllergyAlertCredential" },
  medication_summary: { th: "สรุปรายการยา", en: "Medication Summary", icon: "Pill", vcType: "MedicationSummaryCredential" },
  referral_vc: { th: "ใบส่งต่อผู้ป่วย", en: "Referral", icon: "Send", vcType: "ReferralCredential" },
  immunization: { th: "ประวัติวัคซีน", en: "Immunization", icon: "Syringe", vcType: "ImmunizationCredential" },
  medical_certificate: { th: "ใบรับรองแพทย์", en: "Medical Certificate", icon: "FileBadge", vcType: "MedicalCertificateCredential" },
  prescription: { th: "ใบสั่งยา", en: "Prescription", icon: "Pill", vcType: "PrescriptionCredential" },
  lab_result: { th: "รายงานผลตรวจทางห้องปฏิบัติการ", en: "Lab Result", icon: "Microscope", vcType: "LabResultCredential" },
  diagnostic_report: { th: "รายงานผลภาพวินิจฉัย", en: "Diagnostic Report", icon: "ScanLine", vcType: "DiagnosticReportCredential" },
  discharge_summary: { th: "สรุปจำหน่ายผู้ป่วย", en: "Discharge Summary", icon: "FileCheck2", vcType: "DischargeSummaryCredential" },
  insurance_eligibility: { th: "ใบยืนยันสิทธิ์รักษา", en: "Coverage Eligibility", icon: "ShieldCheck", vcType: "CoverageEligibilityCredential" },
  claim_package: { th: "ชุดเอกสารเคลม", en: "Claim Package", icon: "FolderCheck", vcType: "ClaimPackageCredential" },
  claim_receipt: { th: "ใบรับเคลม/ผลตอบรับเคลม", en: "Claim Receipt", icon: "ReceiptText", vcType: "ClaimReceiptCredential" },
  travel_document_verification: { th: "ตรวจเอกสารผู้ป่วยต่างชาติ", en: "Travel Document Verification", icon: "Globe2", vcType: "TravelDocumentVerificationCredential" },
  shl_manifest: { th: "เอกสารกำกับ Smart Health Link", en: "SHL Manifest", icon: "QrCode", vcType: "ShlManifestCredential" },
  pharmacy_dispense: { th: "บันทึกจ่ายยา", en: "Pharmacy Dispense", icon: "PackageCheck", vcType: "PharmacyDispenseCredential" },
  appointment: { th: "ใบนัดหมาย", en: "Appointment", icon: "CalendarDays", vcType: "AppointmentCredential" },
  visa_support_letter: { th: "หนังสือประกอบวีซ่ารักษาพยาบาล", en: "Visa Support Letter", icon: "FileSignature", vcType: "VisaSupportLetterCredential" },
  quotation: { th: "ใบเสนอราคาค่ารักษา", en: "Treatment Quotation", icon: "FileDigit", vcType: "QuotationCredential" },
  guarantee_letter: { th: "หนังสือรับรองการชำระเงิน", en: "Guarantee Letter", icon: "Landmark", vcType: "GuaranteeLetterCredential" },
  mpi_link_certificate: { th: "ใบรับรองการเชื่อมโยงตัวตนผู้ป่วย", en: "MPI Link Certificate", icon: "Link2", vcType: "MpiLinkCertificateCredential" },
  sync_receipt: { th: "หลักฐาน Sync กลับ HIS", en: "Sync Receipt", icon: "RefreshCcw", vcType: "SyncReceiptCredential" },
};

export function documentStorageMetadata(input: {
  documentType: string;
  hospitalCode?: string;
  patientKey?: string;
  credentialId?: string;
}): JsonRecord {
  const meta = DOCUMENT_STORAGE_MAP[input.documentType] ?? { category: "clinical_summary", subcategory: "document", fhirClassCode: "34133-9", fhirClassDisplay: "Summarization of episode note" };
  const category = String(meta.category);
  const subcategory = String(meta.subcategory);
  const hospital = (input.hospitalCode ?? "network").toLowerCase();
  const patient = String(input.patientKey ?? "shared").toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  const credential = String(input.credentialId ?? input.documentType).replace(/^urn:/, "").replace(/[^a-zA-Z0-9-]+/g, "-");
  return {
    ...meta,
    category,
    subcategory,
    fhirCategoryCoding: {
      system: "http://loinc.org",
      code: meta.fhirClassCode,
      display: meta.fhirClassDisplay,
    },
    storagePath: `vc/${hospital}/${patient}/${category}/${subcategory}/${input.documentType}/${credential}.jwt`,
    indexTags: [
      category,
      subcategory,
      input.documentType,
      hospital,
      meta.fhirClassCode,
    ].filter(Boolean),
  };
}

export function standardLabelCatalog(): JsonRecord {
  return {
    ...TRUSTCARE_DOCUMENT_BRAND,
    sources: [
      "HL7 FHIR R4 Resource Index",
      "Lucide icon catalog and ISC/MIT license",
      "TrustCare Portable VC/VP seed kit label spec",
    ],
    fhirResources: FHIR_RESOURCE_LABELS,
    documentCategories: DOCUMENT_CATEGORY_LABELS,
    documentTypes: DOCUMENT_TYPE_LABELS,
    storageModel: {
      basis: "FHIR DocumentReference category/type metadata and IHE MHD document sharing retrieval patterns",
      pathPattern: "vc/{hospital}/{patient}/{category}/{subcategory}/{documentType}/{credentialId}.jwt",
      indexedFields: ["documentCategory", "documentSubcategory", "type", "subjectId", "issuerHospitalId", "storageKey", "searchTags"],
    },
    fontPolicy: THAI_GOVERNMENT_DOCUMENT_FONT_POLICY,
  };
}
