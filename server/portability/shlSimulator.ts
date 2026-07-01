import type { JsonRecord } from "./types";
import { sha256 } from "./utils";

export const SHL_SIMULATOR_SCENARIOS = [
  "cross_branch_referral",
  "cross_border",
  "e_claim",
  "medical_tourist",
  "discharge",
  "patient_summary",
  "self_share",
] as const;

export type ShlSimulatorScenarioId = (typeof SHL_SIMULATOR_SCENARIOS)[number];

const scenarioProfiles: Record<ShlSimulatorScenarioId, JsonRecord> = {
  cross_branch_referral: {
    encounterClass: "AMB",
    conditions: [{ code: "M17", display: "Knee osteoarthritis", status: "active" }],
    medications: [{ code: "PARA500", display: "Paracetamol 500mg", dosageText: "1 tab every 6 hours as needed" }],
    observations: [{ loinc: "8302-2", display: "Body height", value: "168", unit: "cm" }],
    documents: ["referral_note", "recent_lab_summary", "imaging_report"],
  },
  cross_border: {
    encounterClass: "AMB",
    conditions: [{ code: "I10", display: "Essential hypertension", status: "active" }],
    medications: [{ code: "AMLO5", display: "Amlodipine 5mg", dosageText: "1 tab once daily" }],
    observations: [{ loinc: "85354-9", display: "Blood pressure panel", value: "136/82", unit: "mmHg" }],
    documents: ["international_patient_summary", "travel_clearance", "translated_referral"],
  },
  e_claim: {
    encounterClass: "IMP",
    conditions: [{ code: "E11", display: "Type 2 diabetes mellitus", status: "active" }],
    medications: [{ code: "MET500", display: "Metformin 500mg", dosageText: "1 tab twice daily after meals" }],
    observations: [{ loinc: "4548-4", display: "Hemoglobin A1c", value: "7.4", unit: "%" }],
    documents: ["claim_package", "coverage_eligibility", "invoice_summary"],
  },
  medical_tourist: {
    encounterClass: "AMB",
    conditions: [{ code: "M16", display: "Hip osteoarthritis", status: "active" }],
    medications: [{ code: "CELE200", display: "Celecoxib 200mg", dosageText: "1 cap once daily after food" }],
    observations: [{ loinc: "29463-7", display: "Body weight", value: "72", unit: "kg" }],
    documents: ["quotation", "visa_support_letter", "guarantee_letter", "travel_document_verification"],
  },
  discharge: {
    encounterClass: "IMP",
    conditions: [{ code: "J18.9", display: "Pneumonia, unspecified organism", status: "resolved" }],
    medications: [{ code: "AMOX875", display: "Amoxicillin/clavulanate 875/125mg", dosageText: "1 tab twice daily for 5 days" }],
    observations: [{ loinc: "8310-5", display: "Body temperature", value: "36.8", unit: "Cel" }],
    documents: ["discharge_summary", "medication_reconciliation", "follow_up_plan"],
  },
  patient_summary: {
    encounterClass: "AMB",
    conditions: [{ code: "Z00.0", display: "General medical examination", status: "active" }],
    medications: [{ code: "VITD", display: "Vitamin D3", dosageText: "1 tab once daily" }],
    observations: [{ loinc: "8867-4", display: "Heart rate", value: "72", unit: "/min" }],
    documents: ["ips_bundle", "patient_summary"],
  },
  self_share: {
    encounterClass: "AMB",
    conditions: [{ code: "Z71.9", display: "Counseling, unspecified", status: "active" }],
    medications: [{ code: "PRN-PARA", display: "Paracetamol 500mg", dosageText: "As needed" }],
    observations: [{ loinc: "8480-6", display: "Systolic blood pressure", value: "120", unit: "mmHg" }],
    documents: ["wallet_snapshot", "consent_receipt"],
  },
};

export function scenarioForShlPurpose(purpose: string, context?: string | null): ShlSimulatorScenarioId {
  if (context === "cross_branch_referral" || purpose === "referral") return "cross_branch_referral";
  if (context === "cross_border" || purpose === "cross_border") return "cross_border";
  if (context === "e_claim" || purpose === "insurance") return "e_claim";
  if (context === "medical_tourist" || purpose === "medical_tourist") return "medical_tourist";
  if (purpose === "discharge") return "discharge";
  if (purpose === "self_share" || context === "self_share") return "self_share";
  return "patient_summary";
}

export function buildSimulatedHisPayload(input: {
  patient?: JsonRecord | null;
  hospital?: JsonRecord | null;
  purpose: string;
  context?: string | null;
  credentials?: JsonRecord[];
  now?: Date;
}): JsonRecord {
  const now = input.now ?? new Date();
  const scenario = scenarioForShlPurpose(input.purpose, input.context);
  const profile = scenarioProfiles[scenario];
  const patient = input.patient ?? {};
  const hospital = input.hospital ?? {};
  const patientId = Number(patient.id ?? 0) || Math.abs(hashCode(String(patient.openId ?? patient.email ?? "patient"))) % 100000;
  const hn = String(patient.hn ?? `HN-SIM-${String(patientId).padStart(6, "0")}`);
  const name = String(patient.name ?? patient.nameEn ?? `Trustcare Patient ${patientId}`);
  const seed = `${scenario}:${patientId}:${now.toISOString().slice(0, 10)}`;
  const credentialDocuments = (input.credentials ?? []).slice(0, 8).map((credential, index) => ({
    type: String(credential.type ?? "issued_credential"),
    title: String(credential.credentialId ?? credential.id ?? `Credential ${index + 1}`),
    contentType: "application/vc+jwt",
    hash: sha256(credential.sdJwtVc ?? credential.credentialData ?? credential),
    date: credential.issuedAt ?? now.toISOString(),
    url: `urn:trustcare:credential:${credential.credentialId ?? credential.id ?? index}`,
  }));
  const scenarioDocuments = (profile.documents as string[]).map((type, index) => ({
    type,
    title: titleForDocument(type),
    contentType: "application/json",
    content: { scenario, type, hn, generatedAt: now.toISOString() },
    date: now.toISOString(),
    url: `urn:trustcare:simulated-document:${sha256({ seed, type, index }).slice(0, 24)}`,
  }));

  return {
    patient: {
      hn,
      name,
      patientId: String(patientId),
      birthDate: patient.birthDate ?? "1984-02-14",
      gender: patient.gender ?? "unknown",
      phone: patient.phone ?? "080-000-0000",
      healthId: patient.healthId ?? `THC-SIM-${String(patientId).padStart(8, "0")}`,
    },
    encounter: {
      class: profile.encounterClass,
      visitNumber: `VN-SHL-${String(patientId).padStart(6, "0")}-${now.toISOString().slice(0, 10).replace(/-/g, "")}`,
      visitDate: now.toISOString(),
      location: hospital.nameEn ?? hospital.name ?? "Trustcare Simulated HIS",
    },
    allergies: [
      { code: "NKDA", substance: "No known drug allergy", severity: "low", recordedDate: now.toISOString() },
    ],
    medications: profile.medications,
    conditions: profile.conditions,
    observations: profile.observations,
    documents: [...scenarioDocuments, ...credentialDocuments],
    sourceMetadata: {
      mode: "realistic_simulator",
      scenario,
      purpose: input.purpose,
      context: input.context,
      generatedAt: now.toISOString(),
    },
  };
}

function titleForDocument(type: string): string {
  return type.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function hashCode(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash |= 0;
  }
  return hash;
}
