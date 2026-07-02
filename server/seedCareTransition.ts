/**
 * Seed Care Transition data for all 4 flow types:
 * 1. Internal Referral (TCC → TCM)
 * 2. Cross-Border Outbound (TCC → Singapore General Hospital)
 * 3. Medical Tourist (Mr. John Williams at TCP)
 * 4. External Partner Inbound (Bangkok Hospital → TCC)
 *
 * This creates: connectors, cases, documents, tasks, decisions, events
 */
import * as db from "./db";
import { defaultTasksForCase } from "./careTransition";
import type { CaseType } from "./careTransition";

// ─── Known IDs from seed ───────────────────────────────────────────────────────
const HOSPITAL_TCC = 4;
const HOSPITAL_TCP = 8;
const HOSPITAL_TCM = 9;

const USER_SYSADMIN = 407;     // นพ.สมชาย ระบบดี
const USER_HOSPADMIN = 408;    // นางวิภา บริหารเก่ง (TCC)
const USER_DOCTOR_TCC = 409;   // นพ.ธนวัฒน์ รักษาดี (TCC)
const USER_DOCTOR_TCM = 410;   // พญ.สุภาพร ใจดี (TCM)
const USER_NURSE_TCC = 411;    // นางสาวพิมพ์ใจ ดูแลดี (TCC)
const USER_NURSE_TCM = 412;    // นายอนุชา ช่วยเหลือ (TCM)
const USER_ENGINEER = 413;     // นายปิยะ เชื่อมต่อดี
const USER_PATIENT_001 = 414;  // นายสมชาย ใจดี (TCC)
const USER_PATIENT_002 = 415;  // นางสาวมาลี วัฒนา (TCC)
const USER_PATIENT_003 = 416;  // Mr. John Williams (TCP)

// ─── Seed Partner Source Connectors ────────────────────────────────────────────
async function seedConnectors() {
  console.log("  → Seeding partner source connectors...");

  // 1. FHIR REST connector for Singapore General Hospital
  const c1 = await db.createPartnerSourceConnector({
    partnerName: "Singapore General Hospital",
    connectorType: "fhir_rest",
    direction: "bidirectional",
    endpointUrl: "https://fhir.sgh.com.sg/R4",
    authType: "oauth2_client_credentials",
    credentialRef: "sgh-client-id-prod",
    mappingProfile: "IPS-SG-to-TrustCare",
    canonicalMapping: {
      patientMapping: "IPS-Patient → TrustCare-Patient",
      documentMapping: "IPS-DocumentReference → case_documents",
      coverageMapping: "Coverage → insurance_eligibility",
    },
    supportedDocumentTypes: ["referral_letter", "patient_summary", "lab_report", "imaging_report", "discharge_summary", "prescription"],
    supportedCredentialTypes: ["patient_summary", "referral_vc", "discharge_summary", "lab_result"],
    status: "active",
    validationStatus: "passed",
    validationReport: { ok: true, issues: [], warnings: [], capabilities: ["Patient", "ServiceRequest", "Task", "DocumentReference", "Bundle", "Coverage", "Claim"] },
    lastValidatedAt: new Date(),
    createdBy: USER_ENGINEER,
    metadata: { country: "SG", region: "ASEAN", tier: "premium" },
  } as any);

  // 2. HL7v2 MLLP connector for Bangkok Hospital (legacy system)
  const c2 = await db.createPartnerSourceConnector({
    partnerName: "โรงพยาบาลกรุงเทพ (Bangkok Hospital)",
    connectorType: "hl7v2_mllp",
    direction: "inbound",
    endpointUrl: "mllp://his.bangkokhospital.com:2575",
    authType: "mutual_tls",
    credentialRef: "bkk-hosp-mtls-cert",
    mappingProfile: "HL7v2-ADT-to-TrustCare",
    canonicalMapping: {
      ADT_A01: "admission → internal_referral",
      ADT_A03: "discharge → discharge_summary",
      ORU_R01: "lab_result → case_document",
      MDM_T02: "document → case_document",
    },
    supportedDocumentTypes: ["referral_letter", "patient_summary", "lab_report", "imaging_report", "discharge_summary"],
    supportedCredentialTypes: ["patient_summary", "lab_result", "discharge_summary"],
    status: "active",
    validationStatus: "warning",
    validationReport: { ok: true, issues: [], warnings: ["Canonical mapping profile is recommended before activating structured ingestion."], capabilities: ["ADT", "ORM", "ORU", "MDM"] },
    lastValidatedAt: new Date(),
    createdBy: USER_ENGINEER,
    metadata: { country: "TH", region: "Bangkok", tier: "standard", legacySystem: "HIS v4.2" },
  } as any);

  // 3. Smart Health Link connector for cross-border sharing
  const c3 = await db.createPartnerSourceConnector({
    partnerName: "ASEAN Health Data Exchange",
    connectorType: "smart_health_link",
    direction: "outbound",
    endpointUrl: "https://shl.asean-hde.org/api/v1",
    authType: "api_key",
    credentialRef: "asean-hde-api-key",
    mappingProfile: "IPS-ASEAN-Standard",
    canonicalMapping: {
      shlManifest: "TrustCare-SHL → ASEAN-SHL-Manifest",
      jweEncryption: "AES-256-GCM",
      passcodePolicy: "required",
    },
    supportedDocumentTypes: ["patient_summary", "referral_letter", "lab_report", "discharge_summary", "prescription"],
    supportedCredentialTypes: ["patient_summary", "referral_vc", "shl_manifest"],
    status: "active",
    validationStatus: "passed",
    validationReport: { ok: true, issues: [], warnings: [], capabilities: ["shlink_manifest", "jwe_files", "passcode"] },
    lastValidatedAt: new Date(),
    createdBy: USER_ENGINEER,
    metadata: { region: "ASEAN", protocol: "SHLink v1.0", countries: ["SG", "MY", "ID", "PH", "VN"] },
  } as any);

  // 4. Manual Portal connector for medical tourism facilitators
  const c4 = await db.createPartnerSourceConnector({
    partnerName: "MedTravel Asia (Facilitator)",
    connectorType: "manual_portal",
    direction: "inbound",
    authType: "basic",
    credentialRef: "medtravel-portal-creds",
    supportedDocumentTypes: ["passport", "insurance_card", "referral_letter", "lab_report", "guarantee_letter", "quotation"],
    supportedCredentialTypes: ["travel_document_verification", "insurance_eligibility"],
    status: "active",
    validationStatus: "passed",
    validationReport: { ok: true, issues: [], warnings: [], capabilities: ["document_upload", "manual_review", "delegated_issuance"] },
    lastValidatedAt: new Date(),
    createdBy: USER_ENGINEER,
    metadata: { country: "TH", type: "facilitator", languages: ["en", "zh", "ja", "ko", "ar"] },
  } as any);

  // 5. Native VC/VP connector for TrustCare internal cross-branch
  const c5 = await db.createPartnerSourceConnector({
    partnerName: "TrustCare Network (Internal)",
    connectorType: "native_vc_vp",
    direction: "bidirectional",
    endpointUrl: "https://api.trustcare.network/vc/v1",
    authType: "signed_vp",
    credentialRef: "did:web:trustcare.network",
    mappingProfile: "TrustCare-Internal-VC",
    canonicalMapping: {
      vcIssuance: "TrustCare-VC → Wallet",
      vpPresentation: "Wallet-VP → Verifier",
      trustRegistry: "TAO-Registry",
    },
    supportedDocumentTypes: ["referral_letter", "patient_summary", "lab_report", "imaging_report", "discharge_summary", "prescription", "medical_certificate"],
    supportedCredentialTypes: ["patient_identity", "patient_summary", "referral_vc", "discharge_summary", "lab_result", "diagnostic_report", "prescription", "medical_certificate", "shl_manifest"],
    status: "active",
    validationStatus: "passed",
    validationReport: { ok: true, issues: [], warnings: [], capabilities: ["issuer_did", "holder_vp", "trust_registry"] },
    lastValidatedAt: new Date(),
    createdBy: USER_ENGINEER,
    metadata: { network: "TrustCare", protocol: "W3C-VC-DI + VP", trustFramework: "TAO" },
  } as any);

  console.log(`    Created ${[c1, c2, c3, c4, c5].filter(Boolean).length} connectors`);
  return { sgh: c1, bkkHosp: c2, aseanHde: c3, medTravel: c4, internal: c5 };
}

// ─── Seed Internal Referral Case ───────────────────────────────────────────────
async function seedInternalReferral() {
  console.log("  → Seeding internal referral case (TCC → TCM)...");

  // Create the referral record
  const referralId = await db.createReferral({
    referralCode: "REF-TCC-TCM-2026-001",
    patientId: USER_PATIENT_001,
    fromHospitalId: HOSPITAL_TCC,
    toHospitalId: HOSPITAL_TCM,
    fromDoctorId: USER_DOCTOR_TCC,
    toDoctorId: USER_DOCTOR_TCM,
    status: "accepted",
    priority: "urgent",
    reason: "ส่งต่อผู้ป่วยเพื่อรับการผ่าตัดหัวใจ (Cardiac surgery referral)",
    clinicalNotes: "ผู้ป่วยชาย อายุ 55 ปี มีอาการเจ็บหน้าอกรุนแรง ตรวจพบ 3-vessel coronary artery disease จำเป็นต้องทำ CABG ส่งต่อไปยัง TCM ซึ่งมีทีมศัลยแพทย์หัวใจพร้อม",
    diagnosis: "Coronary artery disease, triple vessel",
    icdCode: "I25.1",
    acceptedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  });

  // Initialize tasks
  const caseType: CaseType = "internal_referral";
  const tasks = defaultTasksForCase(caseType);
  for (const task of tasks) {
    await db.createCaseTask({
      caseType,
      caseId: referralId!,
      taskType: task.taskType as any,
      title: task.title,
      ownerRole: task.ownerRole,
      priority: task.priority ?? "routine",
      status: "completed",
      completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      input: { source: "internal_referral" },
    } as any);
  }

  // Add documents
  await db.createCaseDocument({
    caseType,
    caseId: referralId!,
    direction: "outbound",
    documentType: "referral_letter",
    title: "หนังสือส่งต่อผู้ป่วย - Cardiac Surgery Referral",
    sourceSystem: "trustcare_tcc",
    fileName: "referral_letter_REF-TCC-TCM-2026-001.pdf",
    mimeType: "application/pdf",
    hash: "sha256:abc123referral001",
    fhirDocumentReferenceId: "docref-internal_referral-ref001",
    fhirDocumentReference: { resourceType: "DocumentReference", id: "docref-internal_referral-ref001", status: "current", type: { coding: [{ system: "https://trustcare.network/fhir/document-type", code: "referral_letter" }] } },
    verificationStatus: "verified",
    verifiedBy: USER_DOCTOR_TCM,
    verifiedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    receivedBy: USER_NURSE_TCM,
    metadata: { vcBacked: true, credentialId: "vc-referral-001" },
  } as any);

  await db.createCaseDocument({
    caseType,
    caseId: referralId!,
    direction: "outbound",
    documentType: "patient_summary",
    title: "สรุปประวัติผู้ป่วย - Patient Summary (IPS)",
    sourceSystem: "trustcare_tcc",
    fileName: "patient_summary_somsak.pdf",
    mimeType: "application/pdf",
    hash: "sha256:abc123summary001",
    fhirDocumentReferenceId: "docref-internal_referral-sum001",
    fhirDocumentReference: { resourceType: "DocumentReference", id: "docref-internal_referral-sum001", status: "current", type: { coding: [{ system: "https://trustcare.network/fhir/document-type", code: "patient_summary" }] } },
    verificationStatus: "verified",
    verifiedBy: USER_DOCTOR_TCM,
    verifiedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    receivedBy: USER_NURSE_TCM,
    metadata: { vcBacked: true, credentialId: "vc-patient-summary-001" },
  } as any);

  await db.createCaseDocument({
    caseType,
    caseId: referralId!,
    direction: "outbound",
    documentType: "lab_report",
    title: "ผลตรวจเลือด CBC + Cardiac Enzymes",
    sourceSystem: "trustcare_tcc",
    fileName: "lab_cardiac_enzymes.pdf",
    mimeType: "application/pdf",
    hash: "sha256:abc123lab001",
    fhirDocumentReferenceId: "docref-internal_referral-lab001",
    fhirDocumentReference: { resourceType: "DocumentReference", id: "docref-internal_referral-lab001", status: "current", type: { coding: [{ system: "https://trustcare.network/fhir/document-type", code: "lab_report" }] } },
    verificationStatus: "verified",
    verifiedBy: USER_DOCTOR_TCM,
    verifiedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    receivedBy: USER_NURSE_TCM,
    metadata: { vcBacked: true },
  } as any);

  await db.createCaseDocument({
    caseType,
    caseId: referralId!,
    direction: "outbound",
    documentType: "imaging_report",
    title: "Coronary Angiography Report",
    sourceSystem: "trustcare_tcc",
    fileName: "angiography_report.pdf",
    mimeType: "application/pdf",
    hash: "sha256:abc123img001",
    fhirDocumentReferenceId: "docref-internal_referral-img001",
    fhirDocumentReference: { resourceType: "DocumentReference", id: "docref-internal_referral-img001", status: "current", type: { coding: [{ system: "https://trustcare.network/fhir/document-type", code: "imaging_report" }] } },
    verificationStatus: "verified",
    verifiedBy: USER_DOCTOR_TCM,
    verifiedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    receivedBy: USER_NURSE_TCM,
    metadata: { vcBacked: true },
  } as any);

  // Record decision
  await db.createCaseDecision({
    caseType,
    caseId: referralId!,
    decisionType: "clinical_acceptance",
    outcome: "accepted",
    reason: "ยอมรับส่งต่อ - ทีมศัลยแพทย์หัวใจพร้อมรับผู้ป่วย นัดผ่าตัด 10 ก.ค. 2569",
    decidedBy: USER_DOCTOR_TCM,
  } as any);

  // Record events
  await db.createCareTransitionEvent({
    caseType,
    caseId: referralId!,
    eventType: "created",
    actorId: USER_DOCTOR_TCC,
    actorRole: "doctor",
    summary: "สร้างใบส่งต่อผู้ป่วย (Internal referral created)",
    metadata: { fromHospital: "TCC", toHospital: "TCM", priority: "urgent" },
  } as any);

  await db.createCareTransitionEvent({
    caseType,
    caseId: referralId!,
    eventType: "document_received",
    actorId: USER_NURSE_TCM,
    actorRole: "nurse",
    summary: "รับเอกสารส่งต่อครบ 4 ฉบับ (4 documents received)",
    metadata: { documentCount: 4 },
  } as any);

  await db.createCareTransitionEvent({
    caseType,
    caseId: referralId!,
    eventType: "decision_recorded",
    actorId: USER_DOCTOR_TCM,
    actorRole: "doctor",
    summary: "ยอมรับส่งต่อ - Clinical acceptance recorded",
    metadata: { decisionType: "clinical_acceptance", outcome: "accepted" },
  } as any);

  console.log(`    Created referral #${referralId} with 4 documents, tasks, and decision`);
  return referralId;
}

// ─── Seed Cross-Border Outbound Case ───────────────────────────────────────────
async function seedCrossBorderOutbound() {
  console.log("  → Seeding cross-border outbound case (TCC → Singapore)...");

  // Create the base referral
  const referralId = await db.createReferral({
    referralCode: "REF-TCC-SGH-2026-001",
    patientId: USER_PATIENT_002,
    fromHospitalId: HOSPITAL_TCC,
    toHospitalId: HOSPITAL_TCC, // placeholder, actual destination is SGH
    fromDoctorId: USER_DOCTOR_TCC,
    status: "in_progress",
    priority: "routine",
    reason: "ส่งต่อข้ามพรมแดนเพื่อรักษา Liver transplant ที่ Singapore General Hospital",
    clinicalNotes: "ผู้ป่วยหญิง อายุ 42 ปี End-stage liver disease (ESLD) จาก Hepatitis B cirrhosis, MELD score 28, ต้องการ living donor liver transplant ที่ SGH",
    diagnosis: "End-stage liver disease, Hepatitis B cirrhosis",
    icdCode: "K74.6",
  });

  // Create cross-border extension
  const crossBorderId = await db.createCrossBorderReferral({
    referralId: referralId!,
    referralType: "cross_border_outbound",
    partnerOrgName: "Singapore General Hospital",
    partnerCountry: "SG",
    language: "en",
    jurisdiction: "Singapore Medical Council",
    translationRequired: true,
    translationStatus: "completed",
    status: "packet_generated",
    legalDisclaimer: "Patient data shared under PDPA (Thailand) and PDPA (Singapore) bilateral agreement. Cross-border transfer authorized under Section 28 of Thailand PDPA.",
  } as any);

  const caseType: CaseType = "cross_border";
  const caseId = crossBorderId!;

  // Initialize tasks
  const tasks = defaultTasksForCase(caseType, { translationRequired: true, payerRequired: true });
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const isCompleted = i < 6; // First 6 tasks completed
    await db.createCaseTask({
      caseType,
      caseId,
      taskType: task.taskType as any,
      title: task.title,
      ownerRole: task.ownerRole,
      priority: task.priority ?? "routine",
      status: isCompleted ? "completed" : (i === 6 ? "in_progress" : "created"),
      completedAt: isCompleted ? new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000) : undefined,
      input: { source: "cross_border_outbound" },
    } as any);
  }

  // Add documents
  await db.createCaseDocument({
    caseType,
    caseId,
    direction: "outbound",
    documentType: "referral_letter",
    title: "Cross-Border Referral Letter to SGH - Liver Transplant",
    sourceSystem: "trustcare_tcc",
    fileName: "referral_letter_SGH_liver.pdf",
    mimeType: "application/pdf",
    hash: "sha256:cb123referral002",
    fhirDocumentReferenceId: "docref-cross_border-ref002",
    fhirDocumentReference: { resourceType: "DocumentReference", id: "docref-cross_border-ref002", status: "current", type: { coding: [{ system: "https://trustcare.network/fhir/document-type", code: "referral_letter" }] } },
    verificationStatus: "verified",
    verifiedBy: USER_DOCTOR_TCC,
    verifiedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    receivedBy: USER_NURSE_TCC,
    metadata: { vcBacked: true, translatedToEnglish: true },
  } as any);

  await db.createCaseDocument({
    caseType,
    caseId,
    direction: "outbound",
    documentType: "patient_summary",
    title: "International Patient Summary (IPS) - English",
    sourceSystem: "trustcare_tcc",
    fileName: "ips_malee_en.pdf",
    mimeType: "application/pdf",
    hash: "sha256:cb123summary002",
    fhirDocumentReferenceId: "docref-cross_border-sum002",
    fhirDocumentReference: { resourceType: "DocumentReference", id: "docref-cross_border-sum002", status: "current", type: { coding: [{ system: "https://trustcare.network/fhir/document-type", code: "patient_summary" }] } },
    verificationStatus: "verified",
    verifiedBy: USER_DOCTOR_TCC,
    verifiedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    receivedBy: USER_NURSE_TCC,
    metadata: { vcBacked: true, ipsCompliant: true },
  } as any);

  await db.createCaseDocument({
    caseType,
    caseId,
    direction: "outbound",
    documentType: "insurance_card",
    title: "ประกันสุขภาพ AIA - Coverage Letter for SGH",
    sourceSystem: "trustcare_tcc",
    fileName: "insurance_coverage_aia.pdf",
    mimeType: "application/pdf",
    hash: "sha256:cb123ins002",
    fhirDocumentReferenceId: "docref-cross_border-ins002",
    fhirDocumentReference: { resourceType: "DocumentReference", id: "docref-cross_border-ins002", status: "current", type: { coding: [{ system: "https://trustcare.network/fhir/document-type", code: "insurance_card" }] } },
    verificationStatus: "verified",
    verifiedBy: USER_HOSPADMIN,
    verifiedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    receivedBy: USER_HOSPADMIN,
    metadata: { insurer: "AIA Thailand", policyNumber: "AIA-TH-2026-789456" },
  } as any);

  await db.createCaseDocument({
    caseType,
    caseId,
    direction: "outbound",
    documentType: "consent",
    title: "Cross-Border Data Transfer Consent (PDPA Section 28)",
    sourceSystem: "trustcare_tcc",
    fileName: "consent_cross_border_pdpa.pdf",
    mimeType: "application/pdf",
    hash: "sha256:cb123consent002",
    fhirDocumentReferenceId: "docref-cross_border-consent002",
    fhirDocumentReference: { resourceType: "DocumentReference", id: "docref-cross_border-consent002", status: "current", type: { coding: [{ system: "https://trustcare.network/fhir/document-type", code: "consent" }] } },
    verificationStatus: "verified",
    verifiedBy: USER_HOSPADMIN,
    verifiedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    receivedBy: USER_HOSPADMIN,
    metadata: { consentType: "cross_border_transfer", jurisdiction: "TH-SG" },
  } as any);

  // Record decisions
  await db.createCaseDecision({
    caseType,
    caseId,
    decisionType: "clinical_acceptance",
    outcome: "accepted",
    reason: "Clinical case accepted by SGH Hepatology team. Scheduled for evaluation visit.",
    decidedBy: USER_DOCTOR_TCC,
  } as any);

  await db.createCaseDecision({
    caseType,
    caseId,
    decisionType: "legal_acceptance",
    outcome: "accepted",
    reason: "Cross-border data transfer approved under PDPA bilateral agreement TH-SG. Patient consent obtained.",
    decidedBy: USER_HOSPADMIN,
  } as any);

  await db.createCaseDecision({
    caseType,
    caseId,
    decisionType: "financial_acceptance",
    outcome: "conditional",
    reason: "AIA Thailand pre-authorized up to 5,000,000 THB. Excess requires additional approval.",
    conditions: { maxCoverage: "5000000 THB", excessPolicy: "patient_responsibility", guaranteeLetter: "pending" },
    decidedBy: USER_HOSPADMIN,
  } as any);

  // Record events
  await db.createCareTransitionEvent({ caseType, caseId, eventType: "created", actorId: USER_DOCTOR_TCC, actorRole: "doctor", summary: "Cross-border referral created to SGH for liver transplant", metadata: { destination: "SGH", country: "SG" } } as any);
  await db.createCareTransitionEvent({ caseType, caseId, eventType: "document_received", actorId: USER_NURSE_TCC, actorRole: "nurse", summary: "4 documents prepared for cross-border transfer", metadata: { documentCount: 4 } } as any);
  await db.createCareTransitionEvent({ caseType, caseId, eventType: "decision_recorded", actorId: USER_DOCTOR_TCC, actorRole: "doctor", summary: "Clinical acceptance from SGH confirmed", metadata: { decisionType: "clinical_acceptance" } } as any);
  await db.createCareTransitionEvent({ caseType, caseId, eventType: "decision_recorded", actorId: USER_HOSPADMIN, actorRole: "hospital_admin", summary: "Legal and financial acceptance recorded", metadata: { decisionTypes: ["legal_acceptance", "financial_acceptance"] } } as any);

  console.log(`    Created cross-border case #${caseId} with 4 documents, tasks, and 3 decisions`);
  return caseId;
}

// ─── Seed Medical Tourist Case ─────────────────────────────────────────────────
async function seedMedicalTourist() {
  console.log("  → Seeding medical tourist case (Mr. John Williams at TCP)...");

  const caseId = await db.createInternationalCase({
    patientId: USER_PATIENT_003,
    status: "treatment_in_progress",
    country: "US",
    language: "en",
    passportNumber: "P12345678",
    passportCountry: "US",
    insuranceProvider: "Blue Cross Blue Shield",
    insurancePolicyNumber: "BCBS-US-2026-456789",
    serviceLine: "Orthopedic Surgery - Total Knee Replacement",
    preferredBranchId: HOSPITAL_TCP,
    assignedCoordinatorId: USER_HOSPADMIN,
    contactEmail: "john.williams@email.com",
    contactPhone: "+1-555-0123",
    contactMessenger: "LINE: johnw_medical",
    clinicalNotes: "Male, 62 years old. Bilateral knee osteoarthritis grade IV. Seeking total knee replacement (TKR) at TrustCare Phuket. Pre-op clearance completed at home hospital (Mayo Clinic). Arriving Thailand July 15, 2026.",
    quotationAmount: "850000",
    quotationCurrency: "THB",
    appointmentDate: new Date("2026-07-18T09:00:00Z"),
    arrivalDate: new Date("2026-07-15T14:00:00Z"),
    metadata: { facilitator: "MedTravel Asia", flightInfo: "UA891 LAX→BKK Jul 15", hotelBooking: "Marriott Phuket", preOpClearance: "Mayo Clinic, Rochester MN" },
  } as any);

  const caseType: CaseType = "medical_tourist";

  // Initialize tasks
  const tasks = defaultTasksForCase(caseType, { translationRequired: false, payerRequired: true });
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const isCompleted = i < 7; // First 7 tasks completed (up to appointment scheduling)
    await db.createCaseTask({
      caseType,
      caseId: caseId!,
      taskType: task.taskType as any,
      title: task.title,
      ownerRole: task.ownerRole,
      priority: task.priority ?? "routine",
      status: isCompleted ? "completed" : (i === 7 ? "in_progress" : "created"),
      completedAt: isCompleted ? new Date(Date.now() - (10 - i) * 24 * 60 * 60 * 1000) : undefined,
      input: { source: "medical_tourist" },
    } as any);
  }

  // Add documents
  await db.createCaseDocument({
    caseType,
    caseId: caseId!,
    direction: "inbound",
    documentType: "passport",
    title: "US Passport - John Williams",
    sourceSystem: "medtravel_asia",
    fileName: "passport_john_williams.pdf",
    mimeType: "application/pdf",
    hash: "sha256:mt123passport003",
    fhirDocumentReferenceId: "docref-medical_tourist-pass003",
    fhirDocumentReference: { resourceType: "DocumentReference", id: "docref-medical_tourist-pass003", status: "current", type: { coding: [{ system: "https://trustcare.network/fhir/document-type", code: "passport" }] } },
    verificationStatus: "verified",
    verifiedBy: USER_HOSPADMIN,
    verifiedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    receivedBy: USER_HOSPADMIN,
    metadata: { passportNumber: "P12345678", country: "US", expiryDate: "2030-05-15" },
  } as any);

  await db.createCaseDocument({
    caseType,
    caseId: caseId!,
    direction: "inbound",
    documentType: "insurance_card",
    title: "BCBS Insurance Coverage Letter",
    sourceSystem: "medtravel_asia",
    fileName: "insurance_bcbs_coverage.pdf",
    mimeType: "application/pdf",
    hash: "sha256:mt123ins003",
    fhirDocumentReferenceId: "docref-medical_tourist-ins003",
    fhirDocumentReference: { resourceType: "DocumentReference", id: "docref-medical_tourist-ins003", status: "current", type: { coding: [{ system: "https://trustcare.network/fhir/document-type", code: "insurance_card" }] } },
    verificationStatus: "verified",
    verifiedBy: USER_HOSPADMIN,
    verifiedAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
    receivedBy: USER_HOSPADMIN,
    metadata: { insurer: "BCBS", policyNumber: "BCBS-US-2026-456789", coverageLimit: "$100,000" },
  } as any);

  await db.createCaseDocument({
    caseType,
    caseId: caseId!,
    direction: "inbound",
    documentType: "referral_letter",
    title: "Pre-Op Clearance from Mayo Clinic",
    sourceSystem: "mayo_clinic",
    fileName: "preop_clearance_mayo.pdf",
    mimeType: "application/pdf",
    hash: "sha256:mt123ref003",
    fhirDocumentReferenceId: "docref-medical_tourist-ref003",
    fhirDocumentReference: { resourceType: "DocumentReference", id: "docref-medical_tourist-ref003", status: "current", type: { coding: [{ system: "https://trustcare.network/fhir/document-type", code: "referral_letter" }] } },
    verificationStatus: "verified",
    verifiedBy: USER_DOCTOR_TCC,
    verifiedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
    receivedBy: USER_NURSE_TCC,
    metadata: { sourceHospital: "Mayo Clinic", clearanceDate: "2026-06-20" },
  } as any);

  await db.createCaseDocument({
    caseType,
    caseId: caseId!,
    direction: "inbound",
    documentType: "lab_report",
    title: "Pre-Op Blood Work (CBC, Coagulation, Metabolic Panel)",
    sourceSystem: "mayo_clinic",
    fileName: "preop_labs_mayo.pdf",
    mimeType: "application/pdf",
    hash: "sha256:mt123lab003",
    fhirDocumentReferenceId: "docref-medical_tourist-lab003",
    fhirDocumentReference: { resourceType: "DocumentReference", id: "docref-medical_tourist-lab003", status: "current", type: { coding: [{ system: "https://trustcare.network/fhir/document-type", code: "lab_report" }] } },
    verificationStatus: "verified",
    verifiedBy: USER_DOCTOR_TCC,
    verifiedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
    receivedBy: USER_NURSE_TCC,
    metadata: { sourceHospital: "Mayo Clinic", labDate: "2026-06-18" },
  } as any);

  await db.createCaseDocument({
    caseType,
    caseId: caseId!,
    direction: "outbound",
    documentType: "quotation",
    title: "Treatment Quotation - Total Knee Replacement (Bilateral)",
    sourceSystem: "trustcare_tcp",
    fileName: "quotation_tkr_bilateral.pdf",
    mimeType: "application/pdf",
    hash: "sha256:mt123quot003",
    fhirDocumentReferenceId: "docref-medical_tourist-quot003",
    fhirDocumentReference: { resourceType: "DocumentReference", id: "docref-medical_tourist-quot003", status: "current", type: { coding: [{ system: "https://trustcare.network/fhir/document-type", code: "quotation" }] } },
    verificationStatus: "verified",
    verifiedBy: USER_HOSPADMIN,
    verifiedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    receivedBy: USER_HOSPADMIN,
    metadata: { amount: "850000 THB", includes: ["surgery", "anesthesia", "implants", "5-night stay", "physiotherapy"] },
  } as any);

  // Record decisions
  await db.createCaseDecision({ caseType, caseId: caseId!, decisionType: "clinical_acceptance", outcome: "accepted", reason: "Pre-op clearance verified. Patient fit for bilateral TKR. Surgery scheduled July 18.", decidedBy: USER_DOCTOR_TCC } as any);
  await db.createCaseDecision({ caseType, caseId: caseId!, decisionType: "document_acceptance", outcome: "accepted", reason: "All required documents received and verified: passport, insurance, pre-op clearance, labs.", decidedBy: USER_HOSPADMIN } as any);
  await db.createCaseDecision({ caseType, caseId: caseId!, decisionType: "financial_acceptance", outcome: "accepted", reason: "BCBS pre-authorization confirmed. Guarantee letter received. Patient deposit paid.", decidedBy: USER_HOSPADMIN } as any);

  // Record events
  await db.createCareTransitionEvent({ caseType, caseId: caseId!, eventType: "created", actorId: USER_HOSPADMIN, actorRole: "hospital_admin", summary: "Medical tourist case created for Mr. John Williams (US) - TKR at TCP", metadata: { country: "US", serviceLine: "Orthopedic Surgery" } } as any);
  await db.createCareTransitionEvent({ caseType, caseId: caseId!, eventType: "document_received", actorId: USER_HOSPADMIN, actorRole: "hospital_admin", summary: "5 documents received and verified (passport, insurance, referral, labs, quotation)", metadata: { documentCount: 5 } } as any);
  await db.createCareTransitionEvent({ caseType, caseId: caseId!, eventType: "decision_recorded", actorId: USER_DOCTOR_TCC, actorRole: "doctor", summary: "Clinical acceptance: patient cleared for surgery", metadata: { decisionType: "clinical_acceptance" } } as any);
  await db.createCareTransitionEvent({ caseType, caseId: caseId!, eventType: "decision_recorded", actorId: USER_HOSPADMIN, actorRole: "hospital_admin", summary: "Financial acceptance: BCBS pre-auth + deposit confirmed", metadata: { decisionType: "financial_acceptance" } } as any);

  console.log(`    Created medical tourist case #${caseId} with 5 documents, tasks, and 3 decisions`);
  return caseId;
}

// ─── Seed External Partner Inbound Case ────────────────────────────────────────
async function seedExternalPartnerInbound() {
  console.log("  → Seeding external partner inbound case (Bangkok Hospital → TCC)...");

  // Create cross-border referral as external partner type
  const caseId = await db.createCrossBorderReferral({
    referralType: "external_partner",
    partnerOrgName: "โรงพยาบาลกรุงเทพ (Bangkok Hospital)",
    partnerCountry: "TH",
    language: "th",
    jurisdiction: "แพทยสภาแห่งประเทศไทย",
    translationRequired: false,
    translationStatus: "not_needed",
    status: "consent_granted",
    legalDisclaimer: "ข้อมูลผู้ป่วยถูกส่งต่อตาม พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 มาตรา 26 โดยได้รับความยินยอมจากผู้ป่วยแล้ว",
  } as any);

  const caseType: CaseType = "external_partner";

  // Initialize tasks
  const tasks = defaultTasksForCase(caseType, { translationRequired: false, payerRequired: false });
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const isCompleted = i < 3; // First 3 tasks completed
    await db.createCaseTask({
      caseType,
      caseId: caseId!,
      taskType: task.taskType as any,
      title: task.title,
      ownerRole: task.ownerRole,
      priority: task.priority ?? "routine",
      status: isCompleted ? "completed" : (i === 3 ? "in_progress" : "created"),
      completedAt: isCompleted ? new Date(Date.now() - (5 - i) * 24 * 60 * 60 * 1000) : undefined,
      input: { source: "external_partner" },
    } as any);
  }

  // Add documents (inbound from Bangkok Hospital)
  await db.createCaseDocument({
    caseType,
    caseId: caseId!,
    direction: "inbound",
    documentType: "referral_letter",
    title: "หนังสือส่งต่อจาก รพ.กรุงเทพ - Neurology Consultation",
    sourceSystem: "bangkok_hospital",
    sourcePartnerId: 2, // connector ID for Bangkok Hospital
    fileName: "referral_bkk_neuro.pdf",
    mimeType: "application/pdf",
    hash: "sha256:ep123ref004",
    fhirDocumentReferenceId: "docref-external_partner-ref004",
    fhirDocumentReference: { resourceType: "DocumentReference", id: "docref-external_partner-ref004", status: "current", type: { coding: [{ system: "https://trustcare.network/fhir/document-type", code: "referral_letter" }] } },
    verificationStatus: "verified",
    verifiedBy: USER_NURSE_TCC,
    verifiedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    receivedBy: USER_NURSE_TCC,
    metadata: { receivedVia: "HL7v2 MLLP", messageType: "MDM_T02" },
  } as any);

  await db.createCaseDocument({
    caseType,
    caseId: caseId!,
    direction: "inbound",
    documentType: "patient_summary",
    title: "สรุปประวัติผู้ป่วย - Patient Summary from Bangkok Hospital",
    sourceSystem: "bangkok_hospital",
    sourcePartnerId: 2,
    fileName: "patient_summary_bkk.pdf",
    mimeType: "application/pdf",
    hash: "sha256:ep123sum004",
    fhirDocumentReferenceId: "docref-external_partner-sum004",
    fhirDocumentReference: { resourceType: "DocumentReference", id: "docref-external_partner-sum004", status: "current", type: { coding: [{ system: "https://trustcare.network/fhir/document-type", code: "patient_summary" }] } },
    verificationStatus: "verified",
    verifiedBy: USER_NURSE_TCC,
    verifiedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    receivedBy: USER_NURSE_TCC,
    metadata: { receivedVia: "HL7v2 MLLP", messageType: "ORU_R01" },
  } as any);

  await db.createCaseDocument({
    caseType,
    caseId: caseId!,
    direction: "inbound",
    documentType: "imaging_report",
    title: "Brain MRI Report - Suspected Glioma",
    sourceSystem: "bangkok_hospital",
    sourcePartnerId: 2,
    fileName: "mri_brain_bkk.pdf",
    mimeType: "application/pdf",
    hash: "sha256:ep123img004",
    fhirDocumentReferenceId: "docref-external_partner-img004",
    fhirDocumentReference: { resourceType: "DocumentReference", id: "docref-external_partner-img004", status: "current", type: { coding: [{ system: "https://trustcare.network/fhir/document-type", code: "imaging_report" }] } },
    verificationStatus: "needs_review",
    receivedBy: USER_NURSE_TCC,
    metadata: { receivedVia: "HL7v2 MLLP", messageType: "ORU_R01", urgency: "high" },
  } as any);

  await db.createCaseDocument({
    caseType,
    caseId: caseId!,
    direction: "inbound",
    documentType: "lab_report",
    title: "ผลตรวจเลือด Tumor Markers (CEA, AFP, CA19-9)",
    sourceSystem: "bangkok_hospital",
    sourcePartnerId: 2,
    fileName: "lab_tumor_markers_bkk.pdf",
    mimeType: "application/pdf",
    hash: "sha256:ep123lab004",
    fhirDocumentReferenceId: "docref-external_partner-lab004",
    fhirDocumentReference: { resourceType: "DocumentReference", id: "docref-external_partner-lab004", status: "current", type: { coding: [{ system: "https://trustcare.network/fhir/document-type", code: "lab_report" }] } },
    verificationStatus: "needs_review",
    receivedBy: USER_NURSE_TCC,
    metadata: { receivedVia: "HL7v2 MLLP", messageType: "ORU_R01" },
  } as any);

  // Record decision (partial - clinical triage in progress)
  await db.createCaseDecision({
    caseType,
    caseId: caseId!,
    decisionType: "document_acceptance",
    outcome: "more_info_requested",
    reason: "ต้องการผล Pathology report เพิ่มเติม และ MRI with contrast ก่อนตัดสินใจรับส่งต่อ",
    conditions: { requiredDocuments: ["pathology_report", "mri_contrast"], deadline: "2026-07-10" },
    decidedBy: USER_DOCTOR_TCC,
  } as any);

  // Record events
  await db.createCareTransitionEvent({ caseType, caseId: caseId!, eventType: "created", actorId: USER_NURSE_TCC, actorRole: "nurse", summary: "รับเคสส่งต่อจาก รพ.กรุงเทพ - Neurology consultation", metadata: { partner: "Bangkok Hospital", receivedVia: "HL7v2" } } as any);
  await db.createCareTransitionEvent({ caseType, caseId: caseId!, eventType: "document_received", actorId: USER_NURSE_TCC, actorRole: "nurse", summary: "รับเอกสาร 4 ฉบับจาก รพ.กรุงเทพ (2 verified, 2 pending review)", metadata: { documentCount: 4, verified: 2, pending: 2 } } as any);
  await db.createCareTransitionEvent({ caseType, caseId: caseId!, eventType: "decision_recorded", actorId: USER_DOCTOR_TCC, actorRole: "doctor", summary: "ขอเอกสารเพิ่มเติม - Pathology report และ MRI contrast", metadata: { decisionType: "document_acceptance", outcome: "more_info_requested" } } as any);

  console.log(`    Created external partner case #${caseId} with 4 documents, tasks, and 1 decision`);
  return caseId;
}

// ─── Main Seed Function ────────────────────────────────────────────────────────
export async function seedCareTransitionData() {
  console.log("\n🏥 Seeding Care Transition Data...\n");

  const connectors = await seedConnectors();
  const internalReferralId = await seedInternalReferral();
  const crossBorderId = await seedCrossBorderOutbound();
  const medicalTouristId = await seedMedicalTourist();
  const externalPartnerId = await seedExternalPartnerInbound();

  console.log("\n✅ Care Transition Seed Complete!");
  console.log(`   Connectors: 5`);
  console.log(`   Internal Referral: #${internalReferralId}`);
  console.log(`   Cross-Border: #${crossBorderId}`);
  console.log(`   Medical Tourist: #${medicalTouristId}`);
  console.log(`   External Partner: #${externalPartnerId}`);
  console.log("");

  return {
    connectors,
    cases: {
      internalReferral: { caseType: "internal_referral" as const, caseId: internalReferralId! },
      crossBorder: { caseType: "cross_border" as const, caseId: crossBorderId! },
      medicalTourist: { caseType: "medical_tourist" as const, caseId: medicalTouristId! },
      externalPartner: { caseType: "external_partner" as const, caseId: externalPartnerId! },
    },
  };
}
