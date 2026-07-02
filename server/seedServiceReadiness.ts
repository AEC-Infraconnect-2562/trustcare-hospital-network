/**
 * seedServiceReadiness.ts
 * 
 * Seeds new demo patients with INCOMPLETE wallets to test Service Readiness flows:
 * - Missing document detection
 * - Document request wizard
 * - Partial readiness scores
 * - Various request statuses (requested, imported, needs_review, converted_to_vc, rejected)
 * 
 * Also seeds service_readiness_checks history and wallet_document_requests for testing.
 */
import { getDb } from "./db";
import { eq, and, sql } from "drizzle-orm";
import {
  users,
  hospitals,
  issuedCredentials,
  walletCards,
  serviceReadinessChecks,
  walletDocumentRequests,
  credentialTemplates,
} from "../drizzle/schema";
function uuidv4(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ─── New Demo Patients with Incomplete Wallets ──────────────────────────────────
const NEW_DEMO_PATIENTS = [
  {
    openId: "demo-patient-004",
    name: "นางสาวฮารุกะ ทานากะ",
    nameEn: "Ms. Haruka Tanaka",
    email: "haruka.tanaka@gmail.com",
    role: "user" as const,
    systemRole: "patient" as const,
    hospitalCode: "TCM",
    thaiId: null,
    passport: "TZ9988123",
    phone: "081-999-0004",
    gender: "female",
    birthDate: "1992-04-18",
    nationality: "JPN",
    // Scenario: Cross-border patient from Japan. Has identity + consent only.
    // Missing: referral, patient_summary, lab_result for cross_border context
    walletCards: ["identity", "consent"],
    missingForContext: "cross_border",
    conditions: ["N18.2"], // Chronic kidney disease stage 2
    allergies: ["Iodinated contrast medium moderate"],
  },
  {
    openId: "demo-patient-005",
    name: "นายวิชัย สุขสบาย",
    nameEn: "Mr. Wichai Suksabai",
    email: "wichai.s@hotmail.com",
    role: "user" as const,
    systemRole: "patient" as const,
    hospitalCode: "TCC",
    thaiId: "1100500456789",
    phone: "086-555-0005",
    gender: "male",
    birthDate: "1965-08-22",
    nationality: "THA",
    // Scenario: Elderly Thai patient needs pharmacy dispense. Has identity + allergy only.
    // Missing: prescription, medication for pharmacy_dispense context
    walletCards: ["identity", "allergy"],
    missingForContext: "pharmacy_dispense",
    conditions: ["E11.9", "I10", "E78.0"], // DM2, Hypertension, Hyperlipidemia
    allergies: ["Metformin GI intolerance", "ACE inhibitor cough"],
  },
  {
    openId: "demo-patient-006",
    name: "นางพรทิพย์ มั่งมี",
    nameEn: "Mrs. Porntip Mangmee",
    email: "porntip.m@yahoo.com",
    role: "user" as const,
    systemRole: "patient" as const,
    hospitalCode: "TCC",
    thaiId: "1100500567890",
    phone: "092-888-0006",
    gender: "female",
    birthDate: "1975-11-03",
    nationality: "THA",
    // Scenario: Insurance claim patient. Has identity only.
    // Missing: coverage, claim for insurance_claim context
    walletCards: ["identity"],
    missingForContext: "insurance_claim",
    conditions: ["K80.2", "K81.0"], // Gallstone + Acute cholecystitis
    allergies: ["No known drug allergy"],
  },
  {
    openId: "demo-patient-007",
    name: "นายอภิชาติ รักสุขภาพ",
    nameEn: "Mr. Apichat Raksukphap",
    email: "apichat.r@gmail.com",
    role: "user" as const,
    systemRole: "patient" as const,
    hospitalCode: "TCP",
    thaiId: "1100500678901",
    phone: "095-111-0007",
    gender: "male",
    birthDate: "1988-02-14",
    nationality: "THA",
    // Scenario: Referral patient. Has identity + allergy + medication only.
    // Missing: referral, patient_summary for referral context
    walletCards: ["identity", "allergy", "medication"],
    missingForContext: "referral",
    conditions: ["I25.1", "I50.9"], // Chronic ischemic heart disease, Heart failure
    allergies: ["Aspirin severe - angioedema"],
  },
  {
    openId: "demo-patient-008",
    name: "Mr. David Chen",
    nameEn: "Mr. David Chen",
    email: "david.chen@outlook.com",
    role: "user" as const,
    systemRole: "patient" as const,
    hospitalCode: "TCP",
    thaiId: null,
    passport: "E12345678",
    phone: "081-222-0008",
    gender: "male",
    birthDate: "1981-01-18",
    nationality: "CHN",
    // Scenario: Medical tourist from China. Has identity + patient_summary only.
    // Missing: quotation for medical_tourist context
    walletCards: ["identity", "patient_summary"],
    missingForContext: "medical_tourist",
    conditions: ["M16.1"], // Hip osteoarthritis
    allergies: ["No known drug allergy"],
  },
  {
    openId: "demo-patient-009",
    name: "นางสาวสุดา ใจเย็น",
    nameEn: "Ms. Suda Jaiyen",
    email: "suda.j@gmail.com",
    role: "user" as const,
    systemRole: "patient" as const,
    hospitalCode: "TCC",
    thaiId: "1100500789012",
    phone: "063-444-0009",
    gender: "female",
    birthDate: "2001-06-30",
    nationality: "THA",
    // Scenario: Emergency patient. Has identity only.
    // Missing: allergy, medication for emergency context
    walletCards: ["identity"],
    missingForContext: "emergency",
    conditions: ["J45.20"], // Moderate persistent asthma
    allergies: ["NSAID bronchospasm severe"],
  },
];

// ─── Realistic Credential Data Templates ────────────────────────────────────────
function buildIdentityCredentialData(patient: typeof NEW_DEMO_PATIENTS[0]) {
  return {
    patientName: patient.name,
    patientNameEn: patient.nameEn,
    gender: patient.gender,
    birthDate: patient.birthDate,
    nationality: patient.nationality,
    thaiId: patient.thaiId || undefined,
    passport: (patient as any).passport || undefined,
    phone: patient.phone,
    email: patient.email,
    hn: `HN-${patient.hospitalCode}-${String(Math.floor(Math.random() * 99999) + 10000).padStart(5, "0")}`,
    carepassId: `CP-${patient.nationality === "THA" ? "TH" : "INT"}-2026-${String(NEW_DEMO_PATIENTS.indexOf(patient) + 4).padStart(6, "0")}`,
    conditions: patient.conditions,
    allergies: patient.allergies,
  };
}

function buildAllergyCredentialData(patient: typeof NEW_DEMO_PATIENTS[0]) {
  return {
    patientName: patient.name,
    patientNameEn: patient.nameEn,
    allergies: patient.allergies.map((a, i) => ({
      substance: a.split(" ")[0],
      reaction: a,
      severity: a.includes("severe") ? "severe" : a.includes("moderate") ? "moderate" : "mild",
      category: "medication",
      verifiedDate: "2026-06-15",
      verifiedBy: "นพ.ธนวัฒน์ รักษาดี",
    })),
    lastUpdated: "2026-06-15T10:00:00Z",
  };
}

function buildMedicationCredentialData(patient: typeof NEW_DEMO_PATIENTS[0]) {
  // Realistic Thai medication lists based on conditions
  const medicationsByCondition: Record<string, Array<{ name: string; nameEn: string; dose: string; frequency: string; route: string }>> = {
    "I25.1": [
      { name: "แอสไพริน", nameEn: "Aspirin", dose: "81 mg", frequency: "วันละ 1 ครั้ง", route: "รับประทาน" },
      { name: "อะทอร์วาสแตติน", nameEn: "Atorvastatin", dose: "40 mg", frequency: "วันละ 1 ครั้ง ก่อนนอน", route: "รับประทาน" },
      { name: "เมโทโพรลอล", nameEn: "Metoprolol", dose: "50 mg", frequency: "วันละ 2 ครั้ง", route: "รับประทาน" },
    ],
    "I50.9": [
      { name: "ฟูโรเซไมด์", nameEn: "Furosemide", dose: "40 mg", frequency: "วันละ 1 ครั้ง เช้า", route: "รับประทาน" },
      { name: "เอนาลาพริล", nameEn: "Enalapril", dose: "10 mg", frequency: "วันละ 2 ครั้ง", route: "รับประทาน" },
    ],
    "E11.9": [
      { name: "เมทฟอร์มิน", nameEn: "Metformin", dose: "500 mg", frequency: "วันละ 2 ครั้ง หลังอาหาร", route: "รับประทาน" },
      { name: "ไกลพิไซด์", nameEn: "Glipizide", dose: "5 mg", frequency: "วันละ 1 ครั้ง ก่อนอาหารเช้า", route: "รับประทาน" },
    ],
    "I10": [
      { name: "แอมโลดิปีน", nameEn: "Amlodipine", dose: "5 mg", frequency: "วันละ 1 ครั้ง", route: "รับประทาน" },
      { name: "ลอซาร์แทน", nameEn: "Losartan", dose: "50 mg", frequency: "วันละ 1 ครั้ง", route: "รับประทาน" },
    ],
    "E78.0": [
      { name: "โรสุวาสแตติน", nameEn: "Rosuvastatin", dose: "10 mg", frequency: "วันละ 1 ครั้ง ก่อนนอน", route: "รับประทาน" },
    ],
    "J45.20": [
      { name: "บูเดโซไนด์/ฟอร์โมเทอรอล", nameEn: "Budesonide/Formoterol", dose: "160/4.5 mcg", frequency: "วันละ 2 ครั้ง", route: "สูดพ่น" },
      { name: "ซัลบูทามอล", nameEn: "Salbutamol MDI", dose: "100 mcg", frequency: "เมื่อมีอาการ", route: "สูดพ่น" },
    ],
    "N18.2": [
      { name: "โซเดียมไบคาร์บอเนต", nameEn: "Sodium Bicarbonate", dose: "650 mg", frequency: "วันละ 3 ครั้ง", route: "รับประทาน" },
      { name: "แคลเซียมคาร์บอเนต", nameEn: "Calcium Carbonate", dose: "500 mg", frequency: "วันละ 3 ครั้ง พร้อมอาหาร", route: "รับประทาน" },
    ],
    "M16.1": [
      { name: "เซเลค็อกซิบ", nameEn: "Celecoxib", dose: "200 mg", frequency: "วันละ 1 ครั้ง", route: "รับประทาน" },
      { name: "กลูโคซามีน", nameEn: "Glucosamine", dose: "1500 mg", frequency: "วันละ 1 ครั้ง", route: "รับประทาน" },
    ],
  };

  const medications: Array<{ name: string; nameEn: string; dose: string; frequency: string; route: string }> = [];
  for (const condition of patient.conditions) {
    const meds = medicationsByCondition[condition];
    if (meds) medications.push(...meds);
  }

  return {
    patientName: patient.name,
    patientNameEn: patient.nameEn,
    medications: medications.length > 0 ? medications : [
      { name: "พาราเซตามอล", nameEn: "Paracetamol", dose: "500 mg", frequency: "เมื่อมีอาการ", route: "รับประทาน" },
    ],
    lastUpdated: "2026-06-28T14:00:00Z",
    prescribedBy: "นพ.ธนวัฒน์ รักษาดี",
  };
}

function buildConsentCredentialData(patient: typeof NEW_DEMO_PATIENTS[0]) {
  return {
    patientName: patient.name,
    patientNameEn: patient.nameEn,
    consentType: "data_sharing",
    purpose: "cross_border_care",
    scope: ["patient_summary", "lab_result", "medication", "allergy"],
    grantedTo: "TrustCare Chiang Mai Cross-Border Hospital",
    grantedAt: "2026-06-20T09:00:00Z",
    expiresAt: "2027-06-20T09:00:00Z",
    revocable: true,
  };
}

function buildPatientSummaryCredentialData(patient: typeof NEW_DEMO_PATIENTS[0]) {
  return {
    patientName: patient.name,
    patientNameEn: patient.nameEn,
    gender: patient.gender,
    birthDate: patient.birthDate,
    conditions: patient.conditions.map(c => ({
      code: c,
      system: "ICD-10",
      display: getIcd10Display(c),
    })),
    allergies: patient.allergies,
    medications: buildMedicationCredentialData(patient).medications.slice(0, 3),
    vitalSigns: {
      bloodPressure: "130/82 mmHg",
      heartRate: "78 bpm",
      temperature: "36.5°C",
      weight: patient.gender === "male" ? "72 kg" : "58 kg",
      height: patient.gender === "male" ? "170 cm" : "160 cm",
      bmi: patient.gender === "male" ? "24.9" : "22.7",
    },
    lastVisitDate: "2026-06-25",
    summaryDate: "2026-06-28T10:00:00Z",
    preparedBy: "นพ.ธนวัฒน์ รักษาดี",
  };
}

function getIcd10Display(code: string): string {
  const map: Record<string, string> = {
    "E11.9": "Type 2 diabetes mellitus without complications",
    "I10": "Essential (primary) hypertension",
    "E78.0": "Pure hypercholesterolemia",
    "I25.1": "Atherosclerotic heart disease of native coronary artery",
    "I50.9": "Heart failure, unspecified",
    "J45.20": "Moderate persistent asthma, uncomplicated",
    "N18.2": "Chronic kidney disease, stage 2",
    "M16.1": "Primary osteoarthritis, hip",
    "K80.2": "Calculus of gallbladder without cholecystitis",
    "K81.0": "Acute cholecystitis",
  };
  return map[code] || code;
}

// ─── Document Request Seed Data ─────────────────────────────────────────────────
interface DocumentRequestSeed {
  patientOpenId: string;
  context: string;
  documentType: string;
  documentCategory: string;
  sourceType: string;
  sourceName: string;
  status: string;
  notes: string;
}

const DOCUMENT_REQUEST_SEEDS: DocumentRequestSeed[] = [
  // Patient-004 (Haruka) - cross_border: needs referral, summary, labs
  {
    patientOpenId: "demo-patient-004",
    context: "cross_border",
    documentType: "referral_vc",
    documentCategory: "care_transition",
    sourceType: "partner_portal",
    sourceName: "Tokyo Medical University Hospital",
    status: "requested",
    notes: "Referral letter from primary nephrologist in Tokyo for CKD stage 2 follow-up",
  },
  {
    patientOpenId: "demo-patient-004",
    context: "cross_border",
    documentType: "patient_summary",
    documentCategory: "clinical_summary",
    sourceType: "hospital_app",
    sourceName: "Tokyo Medical University Hospital",
    status: "imported",
    notes: "Patient summary imported from partner hospital, pending VC conversion",
  },
  {
    patientOpenId: "demo-patient-004",
    context: "cross_border",
    documentType: "lab_result",
    documentCategory: "diagnostics_and_results",
    sourceType: "lis",
    sourceName: "Tokyo Medical Lab Services",
    status: "needs_review",
    notes: "eGFR 72 mL/min, Creatinine 1.3 mg/dL, BUN 22 mg/dL — imported, awaiting clinician review",
  },
  // Patient-005 (Wichai) - pharmacy_dispense: needs prescription, medication
  {
    patientOpenId: "demo-patient-005",
    context: "pharmacy_dispense",
    documentType: "prescription",
    documentCategory: "medication_and_pharmacy",
    sourceType: "his",
    sourceName: "TrustCare Central Hospital HIS",
    status: "requested",
    notes: "Prescription for DM2/HTN/Hyperlipidemia medications due for refill",
  },
  {
    patientOpenId: "demo-patient-005",
    context: "pharmacy_dispense",
    documentType: "medication_summary",
    documentCategory: "medication_and_pharmacy",
    sourceType: "his",
    sourceName: "TrustCare Central Hospital Pharmacy",
    status: "requested",
    notes: "Current medication list needed for drug interaction check before dispense",
  },
  // Patient-006 (Porntip) - insurance_claim: needs coverage, claim
  {
    patientOpenId: "demo-patient-006",
    context: "insurance_claim",
    documentType: "insurance_eligibility",
    documentCategory: "claims_and_finance",
    sourceType: "payer",
    sourceName: "เมืองไทยประกันชีวิต (Muang Thai Life)",
    status: "imported",
    notes: "Coverage verification imported from insurer portal — Policy MTL-2026-889012",
  },
  {
    patientOpenId: "demo-patient-006",
    context: "insurance_claim",
    documentType: "claim_package",
    documentCategory: "claims_and_finance",
    sourceType: "his",
    sourceName: "TrustCare Central Hospital Claims Center",
    status: "draft",
    notes: "Claim package for cholecystectomy (laparoscopic) — awaiting surgical report attachment",
  },
  {
    patientOpenId: "demo-patient-006",
    context: "insurance_claim",
    documentType: "patient_summary",
    documentCategory: "clinical_summary",
    sourceType: "his",
    sourceName: "TrustCare Central Hospital",
    status: "converted_to_vc",
    notes: "Discharge summary converted to VC for claim submission",
  },
  // Patient-007 (Apichat) - referral: needs referral, patient_summary
  {
    patientOpenId: "demo-patient-007",
    context: "referral",
    documentType: "referral_vc",
    documentCategory: "care_transition",
    sourceType: "his",
    sourceName: "TrustCare Phuket International Hospital",
    status: "pending_consent",
    notes: "Referral to Bangkok Heart Center for cardiac catheterization — awaiting patient consent",
  },
  {
    patientOpenId: "demo-patient-007",
    context: "referral",
    documentType: "patient_summary",
    documentCategory: "clinical_summary",
    sourceType: "his",
    sourceName: "TrustCare Phuket International Hospital",
    status: "requested",
    notes: "Cardiology summary with echo results and stress test for referral package",
  },
  // Patient-008 (David Chen) - medical_tourist: needs quotation
  {
    patientOpenId: "demo-patient-008",
    context: "medical_tourist",
    documentType: "quotation",
    documentCategory: "medical_tourism",
    sourceType: "hospital_app",
    sourceName: "TrustCare Phuket International Desk",
    status: "requested",
    notes: "Cost estimate for total hip replacement (THR) — bilateral assessment needed",
  },
  {
    patientOpenId: "demo-patient-008",
    context: "medical_tourist",
    documentType: "guarantee_letter",
    documentCategory: "medical_tourism",
    sourceType: "payer",
    sourceName: "China Pacific Insurance",
    status: "requested",
    notes: "Guarantee of payment letter from insurer for elective orthopedic surgery",
  },
  // Patient-009 (Suda) - emergency: needs allergy, medication
  {
    patientOpenId: "demo-patient-009",
    context: "emergency",
    documentType: "allergy_alert",
    documentCategory: "clinical_summary",
    sourceType: "his",
    sourceName: "TrustCare Central Hospital",
    status: "requested",
    notes: "CRITICAL: NSAID bronchospasm history — must be available before any analgesic administration",
  },
  {
    patientOpenId: "demo-patient-009",
    context: "emergency",
    documentType: "medication_summary",
    documentCategory: "medication_and_pharmacy",
    sourceType: "personal_health_app",
    sourceName: "หมอพร้อม (MorPrompt)",
    status: "requested",
    notes: "Current asthma controller medications — Budesonide/Formoterol + Salbutamol PRN",
  },
];

// ─── Service Readiness Check History Seeds ──────────────────────────────────────
interface ReadinessCheckSeed {
  patientOpenId: string;
  context: string;
  score: number;
  criticalReady: boolean;
  requiredMissing: string[];
  recommendedMissing: string[];
  status: string;
  daysAgo: number;
}

const READINESS_CHECK_SEEDS: ReadinessCheckSeed[] = [
  // Patient-001 (Somchai) - historical checks showing progression to 100%
  { patientOpenId: "demo-patient-001", context: "opd_visit", score: 100, criticalReady: true, requiredMissing: [], recommendedMissing: [], status: "completed", daysAgo: 3 },
  { patientOpenId: "demo-patient-001", context: "referral", score: 100, criticalReady: true, requiredMissing: [], recommendedMissing: [], status: "shared", daysAgo: 7 },
  { patientOpenId: "demo-patient-001", context: "insurance_claim", score: 100, criticalReady: true, requiredMissing: [], recommendedMissing: [], status: "completed", daysAgo: 14 },
  // Patient-002 (Malee) - historical checks
  { patientOpenId: "demo-patient-002", context: "opd_visit", score: 100, criticalReady: true, requiredMissing: [], recommendedMissing: [], status: "ready", daysAgo: 1 },
  { patientOpenId: "demo-patient-002", context: "emergency", score: 100, criticalReady: true, requiredMissing: [], recommendedMissing: [], status: "completed", daysAgo: 30 },
  // Patient-004 (Haruka) - cross_border with missing docs
  { patientOpenId: "demo-patient-004", context: "cross_border", score: 40, criticalReady: false, requiredMissing: ["referral", "summary"], recommendedMissing: ["labs"], status: "draft", daysAgo: 0 },
  // Patient-005 (Wichai) - pharmacy with missing docs
  { patientOpenId: "demo-patient-005", context: "pharmacy_dispense", score: 40, criticalReady: false, requiredMissing: ["prescription", "medication"], recommendedMissing: ["dispense"], status: "draft", daysAgo: 0 },
  // Patient-006 (Porntip) - insurance with missing docs
  { patientOpenId: "demo-patient-006", context: "insurance_claim", score: 20, criticalReady: false, requiredMissing: ["coverage", "claim"], recommendedMissing: ["summary", "receipt"], status: "draft", daysAgo: 0 },
  // Patient-007 (Apichat) - referral with missing docs
  { patientOpenId: "demo-patient-007", context: "referral", score: 20, criticalReady: false, requiredMissing: ["referral", "summary"], recommendedMissing: ["labs", "coverage"], status: "draft", daysAgo: 0 },
  // Patient-008 (David Chen) - medical_tourist with missing quotation
  { patientOpenId: "demo-patient-008", context: "medical_tourist", score: 53, criticalReady: false, requiredMissing: ["quotation"], recommendedMissing: ["guarantee", "visa"], status: "draft", daysAgo: 0 },
  // Patient-009 (Suda) - emergency with missing allergy + medication
  { patientOpenId: "demo-patient-009", context: "emergency", score: 20, criticalReady: false, requiredMissing: ["allergy", "medication"], recommendedMissing: ["summary", "coverage"], status: "draft", daysAgo: 0 },
];

// ─── Main Seed Function ─────────────────────────────────────────────────────────
export async function seedServiceReadiness(): Promise<{ patientsCreated: number; credentialsCreated: number; cardsCreated: number; requestsCreated: number; checksCreated: number }> {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL required");

  let patientsCreated = 0;
  let credentialsCreated = 0;
  let cardsCreated = 0;
  let requestsCreated = 0;
  let checksCreated = 0;

  // Get hospital IDs
  const hospitalRows = await db.select().from(hospitals);
  const hospitalMap = new Map(hospitalRows.map(h => [h.code, h]));

  // Get a template for issuing credentials (use first available)
  const templates = await db.select().from(credentialTemplates);
  const templateMap = new Map<string, number>();
  for (const t of templates) {
    if (!templateMap.has(t.type)) templateMap.set(t.type, t.id);
  }

  // Get an issuer user (doctor or admin)
  const [issuerUser] = await db.select().from(users).where(eq(users.openId, "demo-doctor-001"));
  const issuerId = issuerUser?.id ?? 1;

  // ─── Step 1: Create new patients ─────────────────────────────────────────────
  for (const patient of NEW_DEMO_PATIENTS) {
    // Check if already exists
    const [existing] = await db.select().from(users).where(eq(users.openId, patient.openId));
    if (existing) {
      console.log(`  [Skip] Patient ${patient.openId} already exists (id=${existing.id})`);
      continue;
    }

    const hospital = hospitalMap.get(patient.hospitalCode);
    if (!hospital) {
      console.error(`  [Error] Hospital ${patient.hospitalCode} not found`);
      continue;
    }

    await db.insert(users).values({
      openId: patient.openId,
      name: patient.name,
      email: patient.email,
      role: patient.role,
      systemRole: patient.systemRole,
      hospitalId: hospital.id,
    });
    patientsCreated++;
    console.log(`  [Created] Patient ${patient.openId}: ${patient.name}`);
  }

  // ─── Step 2: Issue credentials and create wallet cards for new patients ───────
  for (const patient of NEW_DEMO_PATIENTS) {
    const [userRow] = await db.select().from(users).where(eq(users.openId, patient.openId));
    if (!userRow) continue;

    const hospital = hospitalMap.get(patient.hospitalCode);
    if (!hospital) continue;

    // Check if cards already exist for this patient
    const existingCards = await db.select().from(walletCards).where(eq(walletCards.patientId, userRow.id));
    if (existingCards.length > 0) {
      console.log(`  [Skip] Patient ${patient.openId} already has ${existingCards.length} cards`);
      continue;
    }

    for (const cardType of patient.walletCards) {
      // Map cardType to credential type
      const credentialType = mapCardTypeToCredentialType(cardType);
      const templateId = templateMap.get(credentialType);
      if (!templateId) {
        console.warn(`  [Warn] No template for type ${credentialType}, using fallback`);
      }

      // Build credential data
      const credentialData = buildCredentialData(cardType, patient);
      const credentialId = `urn:uuid:${uuidv4()}`;

      // Issue credential
      const [credRow] = await db.insert(issuedCredentials).values({
        credentialId,
        templateId: templateId ?? 1,
        issuerId,
        issuerHospitalId: hospital.id,
        subjectId: userRow.id,
        type: credentialType as any,
        status: "active",
        credentialData,
        sdJwtVc: `eyJ0eXAiOiJ2YytzZC1qd3QiLCJhbGciOiJFUzI1NiJ9.${Buffer.from(JSON.stringify({ sub: patient.openId, type: credentialType, iss: `did:web:${patient.hospitalCode.toLowerCase()}.trustcare.network` })).toString("base64url")}.simulated_signature_${Date.now()}`,
        documentCategory: getDocumentCategory(cardType),
        issuedAt: new Date("2026-07-01T02:00:00.000Z"),
        expiresAt: new Date("2027-07-01T02:00:00.000Z"),
        schemaVersion: "1.0.0",
      }).$returningId();

      credentialsCreated++;

      // Create wallet card
      await db.insert(walletCards).values({
        patientId: userRow.id,
        credentialId: credRow.id,
        cardType: cardType as any,
        displayName: getCardDisplayName(cardType),
        displayNameEn: getCardDisplayNameEn(cardType),
        issuerHospitalName: hospital.name,
        documentCategory: getDocumentCategory(cardType),
        cardColor: "#2563eb",
        isPinned: cardType === "identity",
      });
      cardsCreated++;
    }
    console.log(`  [Cards] Patient ${patient.openId}: ${patient.walletCards.length} cards created`);
  }

  // ─── Step 3: Seed document requests ───────────────────────────────────────────
  for (const reqSeed of DOCUMENT_REQUEST_SEEDS) {
    const [userRow] = await db.select().from(users).where(eq(users.openId, reqSeed.patientOpenId));
    if (!userRow) continue;

    const hospital = hospitalMap.get(
      NEW_DEMO_PATIENTS.find(p => p.openId === reqSeed.patientOpenId)?.hospitalCode ?? "TCC"
    );

    const requestId = `REQ-${reqSeed.patientOpenId.replace("demo-patient-", "P")}-${reqSeed.documentType.toUpperCase().slice(0, 4)}-${Date.now().toString(36)}`;

    await db.insert(walletDocumentRequests).values({
      requestId,
      patientId: userRow.id,
      context: reqSeed.context as any,
      documentType: reqSeed.documentType,
      documentCategory: reqSeed.documentCategory,
      sourceType: reqSeed.sourceType as any,
      sourceName: reqSeed.sourceName,
      targetHospitalId: hospital?.id,
      status: reqSeed.status as any,
      requestedBy: userRow.id,
      notes: reqSeed.notes,
      metadata: { scenario: "service_readiness_seed", createdAt: new Date().toISOString() },
    });
    requestsCreated++;
  }
  console.log(`  [Requests] ${requestsCreated} document requests seeded`);

  // ─── Step 4: Seed readiness check history ─────────────────────────────────────
  for (const checkSeed of READINESS_CHECK_SEEDS) {
    const [userRow] = await db.select().from(users).where(eq(users.openId, checkSeed.patientOpenId));
    if (!userRow) continue;

    const hospital = hospitalMap.get(
      NEW_DEMO_PATIENTS.find(p => p.openId === checkSeed.patientOpenId)?.hospitalCode ??
      (checkSeed.patientOpenId === "demo-patient-001" ? "TCC" : checkSeed.patientOpenId === "demo-patient-002" ? "TCC" : "TCC")
    );

    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - checkSeed.daysAgo);

    await db.insert(serviceReadinessChecks).values({
      patientId: userRow.id,
      context: checkSeed.context as any,
      hospitalId: hospital?.id,
      score: checkSeed.score,
      criticalReady: checkSeed.criticalReady,
      requiredMissing: checkSeed.requiredMissing,
      recommendedMissing: checkSeed.recommendedMissing,
      status: checkSeed.status as any,
      metadata: { seedVersion: "1.0", scenario: checkSeed.context },
      createdBy: userRow.id,
      createdAt,
    });
    checksCreated++;
  }
  console.log(`  [Checks] ${checksCreated} readiness checks seeded`);

  return { patientsCreated, credentialsCreated, cardsCreated, requestsCreated, checksCreated };
}

// ─── Helpers ────────────────────────────────────────────────────────────────────
function mapCardTypeToCredentialType(cardType: string): string {
  const map: Record<string, string> = {
    identity: "patient_identity",
    allergy: "allergy_alert",
    medication: "medication_summary",
    consent: "consent_receipt",
    patient_summary: "patient_summary",
    prescription: "prescription",
    referral: "referral_vc",
    coverage: "insurance_eligibility",
    claim: "claim_package",
    lab_result: "lab_result",
  };
  return map[cardType] || cardType;
}

function buildCredentialData(cardType: string, patient: typeof NEW_DEMO_PATIENTS[0]): any {
  switch (cardType) {
    case "identity": return buildIdentityCredentialData(patient);
    case "allergy": return buildAllergyCredentialData(patient);
    case "medication": return buildMedicationCredentialData(patient);
    case "consent": return buildConsentCredentialData(patient);
    case "patient_summary": return buildPatientSummaryCredentialData(patient);
    default: return { patientName: patient.name, type: cardType };
  }
}

function getDocumentCategory(cardType: string): string {
  const map: Record<string, string> = {
    identity: "identity_and_access",
    allergy: "clinical_summary",
    medication: "medication_and_pharmacy",
    consent: "identity_and_access",
    patient_summary: "clinical_summary",
    prescription: "medication_and_pharmacy",
    referral: "care_transition",
    coverage: "claims_and_finance",
    claim: "claims_and_finance",
    lab_result: "diagnostics_and_results",
  };
  return map[cardType] || "clinical_summary";
}

function getCardDisplayName(cardType: string): string {
  const map: Record<string, string> = {
    identity: "บัตรประจำตัวผู้ป่วย",
    allergy: "บัตรแจ้งเตือนการแพ้ยา",
    medication: "สรุปรายการยา",
    consent: "ใบรับรองความยินยอม",
    patient_summary: "สรุปข้อมูลผู้ป่วยพกพา",
    prescription: "ใบสั่งยา",
    referral: "ใบส่งต่อผู้ป่วย",
    coverage: "ใบยืนยันสิทธิ์รักษา",
    claim: "ชุดเอกสารเคลม",
    lab_result: "รายงานผลตรวจทางห้องปฏิบัติการ",
  };
  return map[cardType] || cardType;
}

function getCardDisplayNameEn(cardType: string): string {
  const map: Record<string, string> = {
    identity: "Patient Identity Card",
    allergy: "Allergy Alert Card",
    medication: "Medication Summary",
    consent: "Consent Receipt",
    patient_summary: "Patient Summary",
    prescription: "Prescription",
    referral: "Referral Document",
    coverage: "Coverage Eligibility",
    claim: "Claim Package",
    lab_result: "Laboratory Report",
  };
  return map[cardType] || cardType;
}
