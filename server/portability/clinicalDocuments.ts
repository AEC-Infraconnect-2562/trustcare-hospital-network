import type { JsonRecord } from "./types";
import { compactId, dateTime, isoNow, optionalString, sha256 } from "./utils";

export function buildMedicalCertificateFhir(input: {
  patient: JsonRecord;
  practitioner: JsonRecord;
  organization: JsonRecord;
  diagnosisText?: string;
  fitnessForWork?: "fit" | "unfit" | "restricted";
  recommendations?: string[];
  validFrom?: string;
  validUntil?: string;
  issuedAt?: string;
}): { composition: JsonRecord; documentReference: JsonRecord; documentHash: string } {
  const issuedAt = input.issuedAt ?? isoNow();
  const composition: JsonRecord = {
    resourceType: "Composition",
    id: compactId("medical-certificate", { input, issuedAt }),
    meta: {
      profile: ["https://trustcare.network/fhir/StructureDefinition/TrustcareMedicalCertificateComposition"],
    },
    status: "final",
    type: {
      coding: [{ system: "http://loinc.org", code: "64297-5", display: "Medical certificate" }],
      text: "Medical certificate",
    },
    subject: reference("Patient", input.patient.id, input.patient.name),
    date: issuedAt,
    author: [reference("Practitioner", input.practitioner.id, input.practitioner.name)],
    custodian: reference("Organization", input.organization.id, input.organization.name),
    title: "Trustcare Medical Certificate",
    section: [
      {
        title: "Clinical statement",
        text: {
          status: "generated",
          div: sanitizeNarrative(input.diagnosisText ?? "Medical assessment completed."),
        },
      },
      {
        title: "Fitness for work or travel",
        text: {
          status: "generated",
          div: sanitizeNarrative(input.fitnessForWork ?? "restricted"),
        },
      },
      {
        title: "Recommendations",
        text: {
          status: "generated",
          div: sanitizeNarrative((input.recommendations ?? []).join("; ") || "Follow physician advice."),
        },
      },
    ],
    extension: [
      { url: "https://trustcare.network/fhir/StructureDefinition/valid-from", valueDateTime: dateTime(input.validFrom) ?? issuedAt },
      { url: "https://trustcare.network/fhir/StructureDefinition/valid-until", valueDateTime: dateTime(input.validUntil) },
    ].filter((item) => item.valueDateTime),
  };
  const documentHash = sha256(composition);
  const documentReference: JsonRecord = {
    resourceType: "DocumentReference",
    id: compactId("docref-certificate", { composition, documentHash }),
    status: "current",
    type: composition.type,
    subject: composition.subject,
    date: issuedAt,
    content: [
      {
        attachment: {
          contentType: "application/fhir+json",
          title: "Trustcare Medical Certificate",
          hash: documentHash,
        },
      },
    ],
  };
  return { composition, documentReference, documentHash };
}

export function buildPrescriptionMedicationRequests(input: {
  patient: JsonRecord;
  prescriber: JsonRecord;
  organization: JsonRecord;
  medications: Array<{
    code?: string;
    codeSystem?: string;
    name: string;
    doseText?: string;
    quantity?: string;
    daysSupply?: number;
    instructions?: string;
    repeatsAllowed?: number;
  }>;
  authoredOn?: string;
}): JsonRecord[] {
  const authoredOn = input.authoredOn ?? isoNow();
  return input.medications.map((medication, index) => ({
    resourceType: "MedicationRequest",
    id: compactId("rx", { input, medication, index }),
    meta: {
      profile: ["http://hl7.org/fhir/StructureDefinition/MedicationRequest"],
      tag: [{ system: "https://trustcare.network/fhir/tags", code: "prescription-vc-source" }],
    },
    status: "active",
    intent: "order",
    medicationCodeableConcept: {
      coding: medication.code
        ? [{ system: medication.codeSystem ?? "https://trustcare.network/codes/local-drug", code: medication.code, display: medication.name }]
        : undefined,
      text: medication.name,
    },
    subject: reference("Patient", input.patient.id, input.patient.name),
    authoredOn,
    requester: reference("Practitioner", input.prescriber.id, input.prescriber.name),
    performer: reference("Organization", input.organization.id, input.organization.name),
    dosageInstruction: [
      {
        text: medication.instructions ?? medication.doseText ?? "Use as directed.",
        patientInstruction: medication.instructions,
      },
    ],
    dispenseRequest: {
      quantity: optionalString(medication.quantity) ? { value: Number.parseFloat(String(medication.quantity)) || undefined, unit: medication.quantity } : undefined,
      expectedSupplyDuration: medication.daysSupply ? { value: medication.daysSupply, unit: "days", system: "http://unitsofmeasure.org", code: "d" } : undefined,
      numberOfRepeatsAllowed: medication.repeatsAllowed ?? 0,
    },
  }));
}

function reference(resourceType: string, id: unknown, display: unknown): JsonRecord {
  return {
    reference: `${resourceType}/${optionalString(id) ?? "unknown"}`,
    display: optionalString(display),
  };
}

function sanitizeNarrative(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<div xmlns="http://www.w3.org/1999/xhtml">${escaped}</div>`;
}
