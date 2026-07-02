export const readinessContextValues = [
  "opd_visit",
  "emergency",
  "referral",
  "cross_border",
  "medical_tourist",
  "insurance_claim",
  "pharmacy_dispense",
] as const;

export type ReadinessContext = typeof readinessContextValues[number];

export type ReadinessRequirementStatus = "ready" | "missing";

export interface ReadinessRequirement {
  key: string;
  label: string;
  labelEn: string;
  category: string;
  required: boolean;
  cardTypes: string[];
  action: string;
  sourceHint: string;
}

export interface ReadinessCardLike {
  id?: number;
  credentialId?: number | string | null;
  cardType?: string | null;
  documentCategory?: string | null;
  displayName?: string | null;
  credentialStatus?: string | null;
  createdAt?: string | Date | null;
}

export interface ReadinessResult {
  context: ReadinessContext;
  label: string;
  labelEn: string;
  score: number;
  criticalReady: boolean;
  requiredTotal: number;
  requiredReady: number;
  recommendedTotal: number;
  recommendedReady: number;
  ready: Array<ReadinessRequirement & { status: "ready"; matchedCards: ReadinessCardLike[] }>;
  missing: Array<ReadinessRequirement & { status: "missing" }>;
  selectedCardIds: number[];
  recommendedActions: string[];
}

export const readinessContextLabels: Record<ReadinessContext, { label: string; labelEn: string; purpose: string }> = {
  opd_visit: {
    label: "เตรียมเข้ารับบริการ OPD",
    labelEn: "OPD visit readiness",
    purpose: "Prepare a minimum verified packet for registration and clinical intake.",
  },
  emergency: {
    label: "เหตุฉุกเฉิน",
    labelEn: "Emergency readiness",
    purpose: "Make critical identity, allergy, medication, and condition data available fast.",
  },
  referral: {
    label: "ส่งต่อผู้ป่วย",
    labelEn: "Referral readiness",
    purpose: "Package the referral and supporting clinical summary for the receiving hospital.",
  },
  cross_border: {
    label: "ส่งต่อข้ามเครือข่าย/ข้ามแดน",
    labelEn: "Cross-network readiness",
    purpose: "Prepare multilingual and partner-verifiable documents for cross-network care.",
  },
  medical_tourist: {
    label: "ผู้ป่วยต่างชาติ",
    labelEn: "Medical tourist readiness",
    purpose: "Prepare identity, travel, financial, and clinical pre-review documents.",
  },
  insurance_claim: {
    label: "เคลม/ประกัน",
    labelEn: "Insurance claim readiness",
    purpose: "Prepare eligibility, clinical, and claim documents for payer review.",
  },
  pharmacy_dispense: {
    label: "รับยา/ต่อยา",
    labelEn: "Pharmacy dispense readiness",
    purpose: "Prepare prescription, medication summary, allergy, and identity documents.",
  },
};

export const readinessRequirements: Record<ReadinessContext, ReadinessRequirement[]> = {
  opd_visit: [
    req("identity", "ยืนยันตัวตน", "Patient identity", "identity_and_access", true, ["identity", "patient_identity"], "request_identity", "Hospital registration/HIS"),
    req("allergy", "ข้อมูลแพ้ยา/แพ้อาหาร", "Allergy alerts", "clinical_summary", true, ["allergy", "allergy_alert"], "request_allergy", "HIS/EMR or patient upload"),
    req("medication", "รายการยาปัจจุบัน", "Current medications", "medication_and_pharmacy", true, ["medication", "medication_summary", "prescription"], "request_medication", "HIS/pharmacy"),
    req("summary", "สรุปสุขภาพล่าสุด", "Recent patient summary", "clinical_summary", false, ["patient_summary"], "request_patient_summary", "HIS/EMR"),
    req("coverage", "สิทธิรักษา/ประกัน", "Coverage or eligibility", "claims_and_finance", false, ["coverage", "insurance_eligibility"], "request_coverage", "Payer/HIS"),
  ],
  emergency: [
    req("identity", "ยืนยันตัวตน", "Patient identity", "identity_and_access", true, ["identity", "patient_identity"], "request_identity", "Hospital registration/HIS"),
    req("allergy", "ข้อมูลแพ้ยา/แพ้อาหาร", "Allergy alerts", "clinical_summary", true, ["allergy", "allergy_alert"], "request_allergy", "HIS/EMR or patient upload"),
    req("medication", "รายการยาปัจจุบัน", "Current medications", "medication_and_pharmacy", true, ["medication", "medication_summary", "prescription"], "request_medication", "HIS/pharmacy"),
    req("conditions", "โรคประจำตัว/วินิจฉัยสำคัญ", "Active conditions", "clinical_summary", true, ["patient_summary", "medical_certificate"], "request_patient_summary", "HIS/EMR"),
  ],
  referral: [
    req("identity", "ยืนยันตัวตน", "Patient identity", "identity_and_access", true, ["identity", "patient_identity"], "request_identity", "Hospital registration/HIS"),
    req("referral", "ใบส่งต่อ", "Referral document", "care_transition", true, ["referral", "referral_vc"], "request_referral", "Referring hospital"),
    req("summary", "สรุปสุขภาพล่าสุด", "Patient summary", "clinical_summary", true, ["patient_summary"], "request_patient_summary", "HIS/EMR"),
    req("labs", "ผลตรวจที่เกี่ยวข้อง", "Relevant labs/results", "diagnostics_and_results", false, ["lab_result", "diagnostic_report"], "request_labs", "LIS/RIS/PACS"),
    req("coverage", "สิทธิรักษา/ประกัน", "Coverage or eligibility", "claims_and_finance", false, ["coverage", "insurance_eligibility"], "request_coverage", "Payer/HIS"),
  ],
  cross_border: [
    req("identity", "ยืนยันตัวตน", "Patient identity", "identity_and_access", true, ["identity", "patient_identity"], "request_identity", "Hospital registration/HIS"),
    req("referral", "ใบส่งต่อ/เอกสารรับส่งต่อ", "Referral document", "care_transition", true, ["referral", "referral_vc"], "request_referral", "Referring partner"),
    req("summary", "สรุปสุขภาพสองภาษา", "Clinical summary", "clinical_summary", true, ["patient_summary"], "request_patient_summary", "HIS/EMR"),
    req("labs", "ผลตรวจประกอบ", "Supporting results", "diagnostics_and_results", false, ["lab_result", "diagnostic_report"], "request_labs", "LIS/RIS/PACS"),
    req("consent", "หลักฐานความยินยอม", "Consent receipt", "identity_and_access", true, ["consent", "consent_receipt"], "request_consent", "Contextual consent"),
  ],
  medical_tourist: [
    req("identity", "ยืนยันตัวตน/พาสปอร์ต", "Identity/passport", "identity_and_access", true, ["identity", "patient_identity", "travel_document"], "request_identity", "Passport/registration"),
    req("summary", "สรุปสุขภาพเพื่อ pre-review", "Clinical summary", "clinical_summary", true, ["patient_summary"], "request_patient_summary", "HIS/EMR"),
    req("quotation", "ใบเสนอราคา/แผนค่าใช้จ่าย", "Quotation", "medical_tourism", true, ["quotation"], "request_quotation", "International desk"),
    req("guarantee", "หนังสือรับรองค่าใช้จ่าย", "Guarantee letter", "medical_tourism", false, ["guarantee_letter"], "request_guarantee", "Payer/facilitator"),
    req("visa", "เอกสารประกอบวีซ่า", "Visa support", "medical_tourism", false, ["visa_support_letter", "travel_document"], "request_visa", "International desk"),
  ],
  insurance_claim: [
    req("identity", "ยืนยันตัวตน", "Patient identity", "identity_and_access", true, ["identity", "patient_identity"], "request_identity", "Hospital registration/HIS"),
    req("coverage", "สิทธิประกัน", "Coverage eligibility", "claims_and_finance", true, ["coverage", "insurance_eligibility"], "request_coverage", "Payer"),
    req("claim", "ชุดเอกสารเคลม", "Claim package", "claims_and_finance", true, ["claim", "claim_package"], "request_claim_package", "Claim center"),
    req("summary", "สรุปการรักษา", "Clinical summary", "clinical_summary", false, ["patient_summary", "medical_certificate"], "request_patient_summary", "HIS/EMR"),
    req("receipt", "ใบเสร็จ/หลักฐานค่าใช้จ่าย", "Receipt", "claims_and_finance", false, ["claim_receipt"], "request_receipt", "Finance"),
  ],
  pharmacy_dispense: [
    req("identity", "ยืนยันตัวตน", "Patient identity", "identity_and_access", true, ["identity", "patient_identity"], "request_identity", "Hospital registration/HIS"),
    req("prescription", "ใบสั่งยา", "Prescription", "medication_and_pharmacy", true, ["prescription"], "request_prescription", "Doctor/pharmacy"),
    req("medication", "รายการยาปัจจุบัน", "Medication summary", "medication_and_pharmacy", true, ["medication", "medication_summary"], "request_medication", "Pharmacy"),
    req("allergy", "ข้อมูลแพ้ยา", "Allergy alerts", "clinical_summary", true, ["allergy", "allergy_alert"], "request_allergy", "HIS/EMR"),
    req("dispense", "ประวัติจ่ายยา", "Dispense history", "medication_and_pharmacy", false, ["pharmacy_dispense"], "request_dispense", "Pharmacy"),
  ],
};

export function assessReadiness(cards: ReadinessCardLike[], context: ReadinessContext): ReadinessResult {
  const requirements = readinessRequirements[context];
  const activeCards = cards.filter((card) => {
    const status = String(card.credentialStatus ?? "active");
    return status === "active";
  });
  const ready: ReadinessResult["ready"] = [];
  const missing: ReadinessResult["missing"] = [];
  const selectedCardIds = new Set<number>();

  for (const requirement of requirements) {
    const matchedCards = activeCards.filter((card) => {
      const type = String(card.cardType ?? "");
      return requirement.cardTypes.includes(type);
    });
    if (matchedCards.length) {
      matchedCards.forEach((card) => {
        if (typeof card.id === "number") selectedCardIds.add(card.id);
      });
      ready.push({ ...requirement, status: "ready", matchedCards });
    } else {
      missing.push({ ...requirement, status: "missing" });
    }
  }

  const requiredTotal = requirements.filter((item) => item.required).length;
  const requiredReady = ready.filter((item) => item.required).length;
  const recommendedTotal = requirements.filter((item) => !item.required).length;
  const recommendedReady = ready.filter((item) => !item.required).length;
  const requiredScore = requiredTotal ? requiredReady / requiredTotal : 1;
  const recommendedScore = recommendedTotal ? recommendedReady / recommendedTotal : 1;
  const score = Math.round((requiredScore * 0.8 + recommendedScore * 0.2) * 100);
  const label = readinessContextLabels[context];

  return {
    context,
    label: label.label,
    labelEn: label.labelEn,
    score,
    criticalReady: requiredReady === requiredTotal,
    requiredTotal,
    requiredReady,
    recommendedTotal,
    recommendedReady,
    ready,
    missing,
    selectedCardIds: Array.from(selectedCardIds),
    recommendedActions: missing.map((item) => item.action),
  };
}

function req(
  key: string,
  label: string,
  labelEn: string,
  category: string,
  required: boolean,
  cardTypes: string[],
  action: string,
  sourceHint: string,
): ReadinessRequirement {
  return { key, label, labelEn, category, required, cardTypes, action, sourceHint };
}
