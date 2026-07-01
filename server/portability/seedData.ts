import { hospitalDidWeb, patientDidKey, didWebDocument, didKeyDocument } from "./did";
import { DOCUMENT_TYPE_LABELS, documentStorageMetadata, TRUSTCARE_DOCUMENT_BRAND } from "./labels";
import type { JsonRecord, PortabilityContext } from "./types";
import { sha256 } from "./utils";

export const TRUSTCARE_DEMO_HOSPITALS = [
  {
    code: "TCC",
    hcode: "HCODE-TCC-99991",
    nameTh: "โรงพยาบาลทรัสต์แคร์ เซ็นทรัล",
    nameEn: "TrustCare Central Hospital",
    phone: "02-555-0101",
    addressTh: "999 ถนนสุขภาพ เขตปทุมวัน กรุงเทพมหานคร",
    color: "#0f766e",
    accent: "#f59e0b",
  },
  {
    code: "TCP",
    hcode: "HCODE-TCP-99992",
    nameTh: "โรงพยาบาลทรัสต์แคร์ ภูเก็ต อินเตอร์เนชันแนล",
    nameEn: "TrustCare Phuket International Hospital",
    phone: "076-555-0202",
    addressTh: "88 ถนนเจ้าฟ้า อำเภอเมืองภูเก็ต จังหวัดภูเก็ต",
    color: "#1d4ed8",
    accent: "#06b6d4",
  },
  {
    code: "TCM",
    hcode: "HCODE-TCM-99993",
    nameTh: "โรงพยาบาลทรัสต์แคร์ เชียงใหม่ ครอสบอร์เดอร์",
    nameEn: "TrustCare Chiang Mai Cross-Border Hospital",
    phone: "053-555-0303",
    addressTh: "45 ถนนนิมมานเหมินท์ อำเภอเมืองเชียงใหม่ จังหวัดเชียงใหม่",
    color: "#7c3aed",
    accent: "#22c55e",
  },
] as const;

const BASE_PATIENTS = [
  { seedId: "P001", nameTh: "นายสมชาย ใจดี", nameEn: "Mr. Somchai Jaidee", gender: "male", birthDate: "1978-03-15", nationality: "THA", carepassId: "CP-TH-2026-000001", conditions: ["E11", "I10"], allergies: ["Penicillin severe"], tags: ["opd", "referral", "claim", "pharmacy", "medical_certificate"] },
  { seedId: "P002", nameTh: "นางสาวมาลี วัฒนา", nameEn: "Ms. Malee Wattana", gender: "female", birthDate: "1986-09-24", nationality: "THA", carepassId: "CP-TH-2026-000002", conditions: ["J45"], allergies: ["Sulfonamide rash"], tags: ["opd", "emergency", "lab"] },
  { seedId: "P003", nameTh: "Mr. John Williams", nameEn: "Mr. John Williams", gender: "male", birthDate: "1969-12-02", nationality: "USA", passport: "X12345678", carepassId: "CP-INT-2026-000003", conditions: ["M17.1"], allergies: ["No known drug allergy"], tags: ["medical_tourist", "insurance", "travel_document"] },
  { seedId: "P004", nameTh: "Ms. Haruka Tanaka", nameEn: "Ms. Haruka Tanaka", gender: "female", birthDate: "1992-04-18", nationality: "JPN", passport: "TZ9988123", carepassId: "CP-INT-2026-000004", conditions: ["N18.2"], allergies: ["Iodinated contrast medium moderate"], tags: ["cross_border", "imaging", "lab"] },
] as const;

const EXTRA_NAMES = [
  ["นางกมลวรรณ ศรีสุข", "Ms. Kamonwan Srisuk", "female", "1990-02-11", ["Z34"], ["No known drug allergy"], ["opd", "lab"]],
  ["นายธนกฤต พูนทรัพย์", "Mr. Thanakrit Poonsap", "male", "1975-07-09", ["R07.9", "I10"], ["Aspirin mild"], ["referral", "lab", "imaging"]],
  ["นางสาวอริสา จันทร์ดี", "Ms. Arisa Chandee", "female", "2001-11-30", ["J45"], ["NSAID bronchospasm"], ["emergency", "prescription"]],
  ["Mr. David Chen", "Mr. David Chen", "male", "1981-01-18", ["M16"], ["No known drug allergy"], ["medical_tourist", "quotation", "guarantee_letter"]],
  ["Ms. Sofia Garcia", "Ms. Sofia Garcia", "female", "1988-05-05", ["Z23"], ["Latex rash"], ["travel_document", "immunization"]],
  ["นายปกรณ์ แสงทอง", "Mr. Pakorn Saengthong", "male", "1966-12-22", ["E11", "N18.2"], ["Penicillin rash"], ["claim", "lab", "discharge_summary"]],
  ["นางสาวพิมพ์ชนก แก้วมณี", "Ms. Pimchanok Kaewmanee", "female", "1997-08-14", ["A09"], ["No known drug allergy"], ["medical_certificate", "appointment"]],
  ["Mr. Ahmed Khan", "Mr. Ahmed Khan", "male", "1972-10-19", ["I10"], ["Iodinated contrast medium moderate"], ["cross_border", "insurance"]],
] as const;

export function generateTrustcareDemoSeed(input: { patientsPerHospital?: number } = {}): JsonRecord {
  const patientsPerHospital = input.patientsPerHospital ?? 12;
  const hospitals = TRUSTCARE_DEMO_HOSPITALS.map((hospital) => ({
    ...hospital,
    did: hospitalDidWeb(hospital.code),
    branding: {
      ...TRUSTCARE_DOCUMENT_BRAND,
      issuerDisplay: hospital.nameEn,
      color: hospital.color,
      accent: hospital.accent,
      hcode: hospital.hcode,
    },
    didDocument: didWebDocument({
      hospitalCode: hospital.code,
      name: hospital.nameTh,
      nameEn: hospital.nameEn,
    }),
  }));

  const patients = hospitals.flatMap((hospital, hospitalIndex) =>
    Array.from({ length: patientsPerHospital }, (_, index) => buildPatient(index, hospital, hospitalIndex))
  );
  const documents = patients.flatMap((patient) => documentSeedsForPatient(patient));
  const vpScenarios = buildVpScenarios(patients, documents);
  const csv = buildCsvRows(patients);

  return {
    generatedAt: "2026-07-01T09:00:00+07:00",
    syntheticTestData: true,
    sourceKit: "trustcare-portable-vc-vp-seed-kit.zip",
    counts: {
      hospitals: hospitals.length,
      patients: patients.length,
      documents: documents.length,
      vpScenarios: vpScenarios.length,
      csvRows: csv.rows.length,
    },
    hospitals,
    patients,
    documents,
    vpScenarios,
    sourceTruth: {
      connectors: sourceTruthConnectors(),
      csv,
      legacyDbViews: legacyDbRows(patients),
    },
    standardLabels: DOCUMENT_TYPE_LABELS,
  };
}

export function sourceTruthConnectors(): JsonRecord[] {
  return TRUSTCARE_DEMO_HOSPITALS.flatMap((hospital) => [
    {
      id: `${hospital.code.toLowerCase()}-his-rest`,
      hospitalCode: hospital.code,
      kind: "his_rest",
      name: `${hospital.nameEn} HIS REST`,
      sourceOfTruth: true,
      canonicalMappingVersion: `${hospital.code}-HIS-FHIR-R4-v1.0.0`,
      supportedInputs: ["patient", "encounter", "diagnosis", "allergy", "medication", "lab", "document"],
      reviewRequiredBeforeVc: true,
    },
    {
      id: `${hospital.code.toLowerCase()}-legacy-db`,
      hospitalCode: hospital.code,
      kind: "legacy_db_view",
      name: `${hospital.nameEn} Legacy DB View`,
      sourceOfTruth: true,
      canonicalMappingVersion: `${hospital.code}-LEGACY-FHIR-R4-v1.0.0`,
      supportedInputs: ["patient_master", "opd_visit", "dx", "rx", "lis_result"],
      reviewRequiredBeforeVc: true,
    },
  ]);
}

function buildPatient(index: number, hospital: (typeof TRUSTCARE_DEMO_HOSPITALS)[number], hospitalIndex: number): JsonRecord {
  const base = index < BASE_PATIENTS.length
    ? BASE_PATIENTS[index]
    : (() => {
        const extra = EXTRA_NAMES[(index - BASE_PATIENTS.length) % EXTRA_NAMES.length];
        return {
          seedId: `P${String(hospitalIndex * 100 + index + 1).padStart(3, "0")}`,
          nameTh: extra[0],
          nameEn: extra[1],
          gender: extra[2],
          birthDate: extra[3],
          nationality: extra[1].startsWith("Mr.") || extra[1].startsWith("Ms.") ? "THA" : "THA",
          carepassId: `CP-TH-2026-${String(hospitalIndex * 1000 + index + 1).padStart(6, "0")}`,
          conditions: extra[4],
          allergies: extra[5],
          tags: extra[6],
        };
      })();
  const sequence = hospitalIndex * 10_000 + index + 1;
  const patientRef = `Patient/patient-${hospital.code.toLowerCase()}-${String(index + 1).padStart(4, "0")}`;
  const hn = `HN-${hospital.code}-${String(100000 + sequence).padStart(8, "0")}`;
  return {
    ...base,
    hospitalCode: hospital.code,
    hcode: hospital.hcode,
    hospitalNameTh: hospital.nameTh,
    hospitalNameEn: hospital.nameEn,
    issuerDid: hospitalDidWeb(hospital.code),
    holderDid: patientDidKey(`${hospital.code}:${base.seedId}:${base.carepassId}`),
    didDocument: didKeyDocument({ seed: `${hospital.code}:${base.seedId}:${base.carepassId}`, patientRef, carepassId: base.carepassId }),
    patientRef,
    hn,
    mrn: `MRN-${hospital.code}-2026-${String(100000 + sequence).padStart(8, "0")}`,
    thaiIdHash: `sha256:${sha256(`${base.seedId}:${base.birthDate}:thai-id`).slice(0, 48)}`,
    passport: "passport" in base ? base.passport : undefined,
    sourceSystem: `${hospital.code}-HIS`,
    mappingVersion: `${hospital.code}-HIS-FHIR-R4-v1.0.0`,
  };
}

function documentSeedsForPatient(patient: JsonRecord): JsonRecord[] {
  const common = ["patient_identity", "consent_receipt", "patient_summary", "medication_summary", "mpi_link_certificate"];
  const conditional = [
    patient.allergies?.some((item: string) => !item.toLowerCase().includes("no known")) && "allergy_alert",
    patient.tags?.includes("pharmacy") && "prescription",
    patient.tags?.includes("pharmacy") && "pharmacy_dispense",
    patient.tags?.includes("prescription") && "prescription",
    patient.tags?.includes("prescription") && "pharmacy_dispense",
    patient.tags?.includes("medical_certificate") && "medical_certificate",
    patient.tags?.includes("referral") && "referral_vc",
    patient.tags?.includes("referral") && "shl_manifest",
    patient.tags?.includes("cross_border") && "referral_vc",
    patient.tags?.includes("cross_border") && "shl_manifest",
    patient.tags?.includes("lab") && "lab_result",
    patient.tags?.includes("imaging") && "diagnostic_report",
    patient.tags?.includes("claim") && "claim_package",
    patient.tags?.includes("claim") && "claim_receipt",
    patient.tags?.includes("claim") && "sync_receipt",
    patient.tags?.includes("claim") && "insurance_eligibility",
    patient.tags?.includes("insurance") && "insurance_eligibility",
    patient.tags?.includes("insurance") && "guarantee_letter",
    patient.tags?.includes("medical_tourist") && "travel_document_verification",
    patient.tags?.includes("medical_tourist") && "visa_support_letter",
    patient.tags?.includes("medical_tourist") && "quotation",
    patient.tags?.includes("medical_tourist") && "guarantee_letter",
    patient.tags?.includes("medical_tourist") && "appointment",
    patient.tags?.includes("travel_document") && "travel_document_verification",
    patient.tags?.includes("travel_document") && "visa_support_letter",
    patient.tags?.includes("quotation") && "quotation",
    patient.tags?.includes("guarantee_letter") && "guarantee_letter",
    patient.tags?.includes("immunization") && "immunization",
    patient.tags?.includes("appointment") && "appointment",
    patient.tags?.includes("discharge_summary") && "discharge_summary",
  ].filter(Boolean) as string[];
  return Array.from(new Set([...common, ...conditional])).map((type, index) => {
    const label = DOCUMENT_TYPE_LABELS[type] ?? { th: type, en: type, icon: "FileText", vcType: "PatientSummaryCredential" };
    const documentNo = `${documentPrefix(type)}-${patient.hospitalCode}-20260701-${String(index + 1).padStart(6, "0")}`;
    const storage = documentStorageMetadata({ documentType: type, hospitalCode: patient.hospitalCode, patientKey: patient.hn, credentialId: documentNo });
    return {
      id: `doc-${patient.hospitalCode.toLowerCase()}-${patient.seedId.toLowerCase()}-${type}`,
      patientSeedId: patient.seedId,
      hospitalCode: patient.hospitalCode,
      credentialType: type,
      vcType: label.vcType,
      titleTh: label.th,
      titleEn: label.en,
      icon: label.icon,
      category: storage.category,
      subcategory: storage.subcategory,
      storageKey: storage.storagePath,
      searchTags: storage.indexTags,
      issuerDid: patient.issuerDid,
      holderDid: patient.holderDid,
      documentNo,
      documentHash: `sha256:${sha256({ patient: patient.seedId, type, documentNo })}`,
      humanDocument: {
        brand: "TrustCare",
        label: TRUSTCARE_DOCUMENT_BRAND.label,
        templateId: `${type}_v1`,
        printableFileKey: `${patient.patientRef}/documents/${documentNo}.html`,
        renderData: {
          hospital: { code: patient.hospitalCode, nameTh: patient.hospitalNameTh, nameEn: patient.hospitalNameEn, hcode: patient.hcode },
          patient: { fullNameTh: patient.nameTh, fullNameEn: patient.nameEn, hn: patient.hn, carepassId: patient.carepassId },
          document: { no: documentNo, hashShort: sha256(documentNo).slice(0, 12), qrLabel: "Scan to verify VP" },
          issuer: { did: patient.issuerDid },
        },
      },
      evidence: {
        sourceSystem: patient.sourceSystem,
        mappingVersion: patient.mappingVersion,
        fhirCategoryCoding: storage.fhirCategoryCoding,
        fhirRefs: fhirRefsForType(type),
      },
    };
  });
}

function buildVpScenarios(patients: JsonRecord[], documents: JsonRecord[]): JsonRecord[] {
  const scenarioDefs: Array<[string, string, PortabilityContext, string[]]> = [
    ["vp-opd-checkin", "OPD frictionless check-in", "treatment", ["patient_identity", "consent_receipt", "insurance_eligibility"]],
    ["vp-emergency-triage", "Emergency triage", "emergency", ["patient_identity", "allergy_alert", "medication_summary", "patient_summary"]],
    ["vp-pharmacy-prescription", "Pharmacy dispense from prescription", "treatment", ["patient_identity", "allergy_alert", "prescription"]],
    ["vp-referral-packet", "Closed-loop referral packet", "cross_branch_referral", ["referral_vc", "consent_receipt", "patient_summary", "allergy_alert", "lab_result"]],
    ["vp-insurance-claim", "Insurance e-claim", "e_claim", ["insurance_eligibility", "claim_receipt", "prescription", "lab_result", "patient_summary"]],
    ["vp-medical-tourist-intake", "Medical tourist intake", "medical_tourist", ["patient_identity", "consent_receipt", "travel_document_verification", "insurance_eligibility"]],
  ];
  return scenarioDefs.map(([id, name, context, types], index) => {
    const patient = patients[index % patients.length];
    return {
      id,
      name,
      context,
      holderDid: patient.holderDid,
      verifier: verifierForContext(context),
      credentialRefs: documents.filter((doc) => doc.patientSeedId === patient.seedId && types.includes(doc.credentialType)).map((doc) => doc.id),
      selectiveDisclosure: types,
      expectedTrustLevel: "green",
    };
  });
}

function buildCsvRows(patients: JsonRecord[]): JsonRecord {
  const rows = patients.map((patient, index) => ({
    hospital_code: patient.hospitalCode,
    hn: patient.hn,
    carepass_id: patient.carepassId,
    full_name_th: patient.nameTh,
    full_name_en: patient.nameEn,
    birth_date: patient.birthDate,
    sex: patient.gender === "female" ? "F" : "M",
    visit_no: `VN-${patient.hospitalCode}-20260701-${String(index + 1).padStart(4, "0")}`,
    diagnosis_code: patient.conditions?.[0] ?? "Z00.0",
    diagnosis_text: diagnosisText(patient.conditions?.[0]),
    allergy: patient.allergies?.[0] ?? "No known drug allergy",
    medication: medicationForCondition(patient.conditions?.[0]),
    lab_code: patient.tags?.includes("lab") ? "4548-4" : "",
    lab_name: patient.tags?.includes("lab") ? "HbA1c" : "",
    lab_value: patient.tags?.includes("lab") ? "7.4" : "",
    lab_unit: patient.tags?.includes("lab") ? "%" : "",
  }));
  return {
    header: Object.keys(rows[0] ?? {}),
    rows,
    csvText: [Object.keys(rows[0] ?? {}).join(","), ...rows.map((row) => Object.values(row).map(csvEscape).join(","))].join("\n"),
  };
}

function legacyDbRows(patients: JsonRecord[]): JsonRecord[] {
  return patients.map((patient) => ({
    patient_master: { hn: patient.hn, carepass_id: patient.carepassId, cid_hash: patient.thaiIdHash, name_th: patient.nameTh, birth_date: patient.birthDate },
    opd_visit: { vn: `VN-${patient.hospitalCode}-20260701-${patient.seedId}`, hn: patient.hn, visit_date: "2026-07-01T09:00:00+07:00" },
    dx: patient.conditions?.map((code: string) => ({ hn: patient.hn, icd10: code, display: diagnosisText(code) })) ?? [],
    allergy: patient.allergies?.map((item: string) => ({ hn: patient.hn, agent_name: item, severity: item.toLowerCase().includes("severe") ? "high" : "low" })) ?? [],
  }));
}

function fhirRefsForType(type: string): string[] {
  if (type === "prescription") return ["MedicationRequest", "MedicationDispense", "DocumentReference"];
  if (type === "pharmacy_dispense") return ["MedicationDispense", "MedicationRequest", "DocumentReference"];
  if (type === "lab_result") return ["DiagnosticReport", "Observation", "DocumentReference"];
  if (type === "diagnostic_report") return ["DiagnosticReport", "ImagingStudy", "DocumentReference"];
  if (type === "medical_certificate") return ["Composition", "Encounter", "DocumentReference"];
  if (type === "claim_package" || type === "claim_receipt") return ["Claim", "ClaimResponse", "ExplanationOfBenefit"];
  if (type === "insurance_eligibility") return ["Coverage", "Patient", "DocumentReference"];
  if (type === "immunization") return ["Immunization", "Patient", "DocumentReference"];
  if (type === "shl_manifest") return ["Bundle", "DocumentReference", "Provenance"];
  return ["Patient", "Provenance", "DocumentReference"];
}

function documentPrefix(type: string): string {
  const prefixes: Record<string, string> = {
    patient_identity: "CARD",
    consent_receipt: "CNS",
    patient_summary: "SUM",
    allergy_alert: "ALG",
    prescription: "RX",
    medical_certificate: "MC",
    referral_vc: "REF",
    lab_result: "LAB",
    diagnostic_report: "IMG",
    insurance_eligibility: "ELG",
    claim_package: "CPK",
    claim_receipt: "CLM",
    travel_document_verification: "TRV",
    shl_manifest: "SHL",
    pharmacy_dispense: "DSP",
    immunization: "IMM",
    appointment: "APT",
    discharge_summary: "DSC",
    visa_support_letter: "VSL",
    quotation: "QTN",
    guarantee_letter: "GNT",
    mpi_link_certificate: "MPI",
    sync_receipt: "SYN",
  };
  return prefixes[type] ?? "DOC";
}

function verifierForContext(context: PortabilityContext): string {
  if (context === "e_claim") return "payer_adapter";
  if (context === "medical_tourist") return "international_patient_center";
  if (context === "emergency") return "er_triage";
  if (context === "cross_branch_referral") return "receiving_hospital";
  return "registration_or_clinician";
}

function diagnosisText(code: string | undefined): string {
  const map: Record<string, string> = {
    E11: "Type 2 diabetes mellitus",
    I10: "Essential hypertension",
    J45: "Asthma",
    "R07.9": "Chest pain",
    Z34: "Supervision of normal pregnancy",
    M17: "Knee osteoarthritis",
    M16: "Hip osteoarthritis",
    "N18.2": "Chronic kidney disease stage 2",
  };
  return map[code ?? ""] ?? "General examination";
}

function medicationForCondition(code: string | undefined): string {
  if (code === "E11") return "Metformin 500mg";
  if (code === "I10") return "Amlodipine 5mg";
  if (code === "J45") return "Salbutamol inhaler";
  return "Paracetamol 500mg";
}

function csvEscape(value: unknown): string {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
