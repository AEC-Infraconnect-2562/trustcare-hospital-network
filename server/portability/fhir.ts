import type { CanonicalFhirResult, DataQualityIssue, HisIngestionInput, JsonRecord, JsonValue } from "./types";
import { asArray, asRecord, compactId, dateOnly, dateTime, isoNow, optionalString, sha256, stringValue } from "./utils";

const FHIR_VERSION = "4.0.1";
const IPS_COMPOSITION_PROFILE = "http://hl7.org/fhir/uv/ips/StructureDefinition/Composition-uv-ips";

const PROFILE_BY_RESOURCE: Record<string, string> = {
  Patient: "http://hl7.org/fhir/uv/ips/StructureDefinition/Patient-uv-ips",
  Encounter: "http://hl7.org/fhir/StructureDefinition/Encounter",
  Condition: "http://hl7.org/fhir/uv/ips/StructureDefinition/Condition-uv-ips",
  AllergyIntolerance: "http://hl7.org/fhir/uv/ips/StructureDefinition/AllergyIntolerance-uv-ips",
  MedicationStatement: "http://hl7.org/fhir/uv/ips/StructureDefinition/MedicationStatement-uv-ips",
  Observation: "http://hl7.org/fhir/uv/ips/StructureDefinition/Observation-results-uv-ips",
  DocumentReference: "http://hl7.org/fhir/StructureDefinition/DocumentReference",
  Provenance: "http://hl7.org/fhir/StructureDefinition/Provenance",
};

type NormalizedHisRecord = {
  patient: JsonRecord;
  encounter?: JsonRecord;
  allergies: JsonRecord[];
  medications: JsonRecord[];
  conditions: JsonRecord[];
  observations: JsonRecord[];
  documents: JsonRecord[];
};

export function canonicalizeHisPayload(input: HisIngestionInput): CanonicalFhirResult {
  const normalized = normalizeHisInput(input);
  const generatedAt = input.receivedAt ?? isoNow();
  const issues: DataQualityIssue[] = [];
  const organizationRef = input.sourceOrganizationId || "unknown";

  const patient = buildPatient(normalized.patient, input);
  if (!patient.identifier || (patient.identifier as JsonValue[]).length === 0) {
    issues.push({
      ruleId: "DQ-001",
      severity: "error",
      resourceType: "Patient",
      resourceId: stringValue(patient.id),
      message: "Patient must have at least one identifier: HN, MRN, CID hash, passport, or Health ID.",
    });
  }

  const clinicalResources: JsonRecord[] = [];
  if (normalized.encounter && Object.keys(normalized.encounter).length > 0) {
    clinicalResources.push(buildEncounter(normalized.encounter, patient, input));
  }
  clinicalResources.push(...normalized.allergies.map((item, index) => buildAllergy(item, patient, input, index)));
  clinicalResources.push(...normalized.medications.map((item, index) => buildMedication(item, patient, input, index)));
  clinicalResources.push(...normalized.conditions.map((item, index) => buildCondition(item, patient, input, index)));
  clinicalResources.push(...normalized.observations.map((item, index) => buildObservation(item, patient, input, index)));
  clinicalResources.push(...normalized.documents.map((item, index) => buildDocumentReference(item, patient, input, index)));

  for (const resource of clinicalResources) {
    if (resource.resourceType === "AllergyIntolerance" && !resource.criticality) {
      issues.push({
        ruleId: "DQ-004",
        severity: "warning",
        resourceType: "AllergyIntolerance",
        resourceId: stringValue(resource.id),
        message: "Allergy severity should be present for high-risk allergy.",
      });
    }
    if (resource.resourceType === "MedicationStatement" && !asRecord(resource.medicationCodeableConcept).coding) {
      issues.push({
        ruleId: "DQ-005",
        severity: "warning",
        resourceType: "MedicationStatement",
        resourceId: stringValue(resource.id),
        message: "Medication should have a local or mapped medication code.",
      });
    }
    if (resource.resourceType === "Observation" && !asRecord(resource.code).coding) {
      issues.push({
        ruleId: "DQ-008",
        severity: "warning",
        resourceType: "Observation",
        resourceId: stringValue(resource.id),
        message: "Local lab code is not mapped to a standard terminology.",
      });
    }
    if (resource.resourceType === "DocumentReference") {
      const content = asArray(resource.content);
      const hasHash = content.some((entry) => optionalString(asRecord(asRecord(entry).attachment).hash));
      if (!hasHash) {
        issues.push({
          ruleId: "DQ-010",
          severity: "error",
          resourceType: "DocumentReference",
          resourceId: stringValue(resource.id),
          message: "DocumentReference must include source, hash, and content type.",
        });
      }
    }
  }

  const resourcesWithPatient = [patient, ...clinicalResources];
  const provenanceResources = resourcesWithPatient.map((resource) =>
    buildProvenance(resource, input, generatedAt, organizationRef)
  );

  const composition = buildIpsComposition(patient, clinicalResources, input, generatedAt);
  const bundleEntries = [composition, ...resourcesWithPatient, ...provenanceResources].map((resource) => ({
    fullUrl: `urn:uuid:${resource.id}`,
    resource,
  }));

  const bundle: JsonRecord = {
    resourceType: "Bundle",
    id: compactId("bundle", { input, generatedAt }),
    type: "document",
    timestamp: generatedAt,
    meta: {
      profile: ["http://hl7.org/fhir/uv/ips/StructureDefinition/Bundle-uv-ips"],
      tag: [{ system: "https://trustcare.network/fhir/tags", code: "trustcare-canonical" }],
    },
    identifier: {
      system: "https://trustcare.network/fhir/bundle",
      value: compactId("ips", { patient: patient.id, generatedAt }),
    },
    entry: bundleEntries,
  };

  const bundleHash = sha256(bundle);
  const resourceCounts = resourcesWithPatient.reduce<Record<string, number>>((counts, resource) => {
    const type = stringValue(resource.resourceType, "Unknown");
    counts[type] = (counts[type] ?? 0) + 1;
    return counts;
  }, {});

  if (provenanceResources.length !== resourcesWithPatient.length) {
    issues.push({
      ruleId: "DQ-006",
      severity: "error",
      message: "Every generated FHIR resource must include Provenance.",
    });
  }

  return {
    bundle,
    patient,
    clinicalResources,
    provenanceResources,
    issues,
    summary: {
      patientId: stringValue(patient.id),
      patientName: patientName(patient),
      resourceCounts,
      bundleHash,
      generatedAt,
    },
  };
}

function normalizeHisInput(input: HisIngestionInput): NormalizedHisRecord {
  if (input.sourceFormat === "hl7v2") return normalizeHl7v2(stringValue(input.payload));
  if (input.sourceFormat === "fhir_native") return normalizeFhirNative(asRecord(input.payload));

  const payload = Array.isArray(input.payload) ? input.payload[0] : input.payload;
  const record = asRecord(payload);
  const patient = asRecord(record.patient && typeof record.patient === "object" ? record.patient : record);

  return {
    patient,
    encounter: asRecord(record.encounter),
    allergies: asArray(record.allergies ?? record.allergy).map(asRecord),
    medications: asArray(record.medications ?? record.medication ?? record.activeMedications).map(asRecord),
    conditions: asArray(record.conditions ?? record.diagnoses ?? record.diagnosis).map(asRecord),
    observations: asArray(record.observations ?? record.labs ?? record.labResults).map(asRecord),
    documents: asArray(record.documents ?? record.documentReferences).map(asRecord),
  };
}

function normalizeFhirNative(bundleOrResource: JsonRecord): NormalizedHisRecord {
  const entries = asArray(bundleOrResource.entry).map((entry) => asRecord(asRecord(entry).resource));
  const resources = entries.length > 0 ? entries : [bundleOrResource];
  const patient = resources.find((resource) => resource.resourceType === "Patient") ?? {};
  return {
    patient,
    encounter: resources.find((resource) => resource.resourceType === "Encounter"),
    allergies: resources.filter((resource) => resource.resourceType === "AllergyIntolerance"),
    medications: resources.filter((resource) => resource.resourceType === "MedicationRequest" || resource.resourceType === "MedicationStatement"),
    conditions: resources.filter((resource) => resource.resourceType === "Condition"),
    observations: resources.filter((resource) => resource.resourceType === "Observation"),
    documents: resources.filter((resource) => resource.resourceType === "DocumentReference"),
  };
}

function normalizeHl7v2(message: string): NormalizedHisRecord {
  const segments = message
    .split(/\r?\n|\r/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split("|"));
  const segment = (name: string) => segments.find((parts) => parts[0] === name) ?? [];
  const segmentsNamed = (name: string) => segments.filter((parts) => parts[0] === name);

  const pid = segment("PID");
  const pv1 = segment("PV1");
  const patientNameParts = stringValue(pid[5]).split("^");
  const patient: JsonRecord = {
    hn: optionalString(pid[3]?.split("^")[0]),
    name: patientNameParts.filter(Boolean).reverse().join(" ") || optionalString(pid[5]),
    family: optionalString(patientNameParts[0]),
    given: optionalString(patientNameParts[1]),
    birthDate: optionalString(pid[7]),
    sex: optionalString(pid[8]),
    address: optionalString(pid[11]),
    phone: optionalString(pid[13]),
  };

  const encounter: JsonRecord = {
    class: optionalString(pv1[2]),
    location: optionalString(pv1[3]),
    attendingDoctor: optionalString(pv1[7]),
    visitNumber: optionalString(pv1[19]),
  };

  const allergies = segmentsNamed("AL1").map((al1) => ({
    code: optionalString(al1[3]?.split("^")[0]),
    substance: optionalString(al1[3]?.split("^")[1] ?? al1[3]),
    severity: optionalString(al1[4]),
    reaction: optionalString(al1[5]),
  }));

  const conditions = segmentsNamed("DG1").map((dg1) => ({
    code: optionalString(dg1[3]?.split("^")[0]),
    display: optionalString(dg1[3]?.split("^")[1] ?? dg1[4]),
    recordedDate: optionalString(dg1[5]),
    status: "active",
  }));

  const observations = segmentsNamed("OBX").map((obx) => ({
    valueType: optionalString(obx[2]),
    code: optionalString(obx[3]?.split("^")[0]),
    display: optionalString(obx[3]?.split("^")[1] ?? obx[3]),
    value: optionalString(obx[5]),
    unit: optionalString(obx[6]),
    referenceRange: optionalString(obx[7]),
    interpretation: optionalString(obx[8]),
    effectiveDateTime: optionalString(obx[14]),
  }));

  const medications = segmentsNamed("RXE").map((rxe) => ({
    code: optionalString(rxe[2]?.split("^")[0]),
    display: optionalString(rxe[2]?.split("^")[1] ?? rxe[2]),
    dosageText: optionalString(rxe[1]),
    status: "active",
  }));

  return { patient, encounter, allergies, medications, conditions, observations, documents: [] };
}

function baseResource(resourceType: string, seed: unknown): JsonRecord {
  return {
    resourceType,
    id: compactId(resourceType.toLowerCase(), seed),
    meta: { profile: [PROFILE_BY_RESOURCE[resourceType]].filter(Boolean) },
  };
}

function buildPatient(record: JsonRecord, input: HisIngestionInput): JsonRecord {
  const hn = optionalString(record.hn ?? record.HN ?? record.mrn ?? record.patientId);
  const cid = optionalString(record.cid ?? record.CID ?? record.thaiId);
  const passport = optionalString(record.passport ?? record.passportNumber);
  const healthId = optionalString(record.healthId ?? record.health_id);
  const gender = normalizeGender(record.gender ?? record.sex);
  const name = optionalString(record.name ?? record.fullName ?? record.patientName) ?? [record.given, record.family].map(optionalString).filter(Boolean).join(" ");
  const seed = { source: input.sourceSystem, hn, cid, passport, healthId, name };
  const identifiers = [
    hn && { system: `https://trustcare.network/id/${input.sourceOrganizationId}/hn`, value: hn, type: codeable("MR", "Medical record number") },
    cid && { system: "https://trustcare.network/id/th/cid-hash", value: sha256(cid), type: codeable("NI", "National identifier") },
    passport && { system: "https://trustcare.network/id/passport", value: passport, type: codeable("PPN", "Passport number") },
    healthId && { system: "https://trustcare.network/id/th/health-id", value: healthId, type: codeable("HC", "Health card number") },
  ].filter(Boolean) as JsonRecord[];

  return {
    ...baseResource("Patient", seed),
    identifier: identifiers,
    name: [
      {
        use: "official",
        text: name || "Unknown Patient",
        family: optionalString(record.family),
        given: optionalString(record.given) ? [optionalString(record.given)] : undefined,
      },
    ],
    gender,
    birthDate: dateOnly(record.birthDate ?? record.dob),
    telecom: optionalString(record.phone) ? [{ system: "phone", value: optionalString(record.phone), use: "mobile" }] : undefined,
    address: optionalString(record.address) ? [{ text: optionalString(record.address) }] : undefined,
  };
}

function buildEncounter(record: JsonRecord, patient: JsonRecord, input: HisIngestionInput): JsonRecord {
  const visitNumber = optionalString(record.visitNumber ?? record.vn ?? record.encounterId);
  return {
    ...baseResource("Encounter", { input, record, patient: patient.id }),
    identifier: visitNumber ? [{ system: `https://trustcare.network/id/${input.sourceOrganizationId}/visit`, value: visitNumber }] : undefined,
    status: "finished",
    class: {
      system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
      code: normalizeEncounterClass(record.class ?? record.type),
    },
    subject: reference(patient),
    period: {
      start: dateTime(record.start ?? record.admitDate ?? record.visitDate),
      end: dateTime(record.end ?? record.dischargeDate),
    },
  };
}

function buildAllergy(record: JsonRecord, patient: JsonRecord, input: HisIngestionInput, index: number): JsonRecord {
  return {
    ...baseResource("AllergyIntolerance", { input, record, index, patient: patient.id }),
    clinicalStatus: terminology("http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical", "active", "Active"),
    verificationStatus: terminology("http://terminology.hl7.org/CodeSystem/allergyintolerance-verification", "confirmed", "Confirmed"),
    type: "allergy",
    criticality: normalizeCriticality(record.severity ?? record.criticality),
    code: {
      coding: optionalString(record.code)
        ? [{ system: "https://trustcare.network/codes/local-allergy", code: optionalString(record.code), display: optionalString(record.substance) }]
        : undefined,
      text: optionalString(record.substance ?? record.display ?? record.name) ?? "Unknown allergy",
    },
    patient: reference(patient),
    reaction: optionalString(record.reaction)
      ? [{ manifestation: [{ text: optionalString(record.reaction) }], severity: normalizeSeverity(record.severity) }]
      : undefined,
    recordedDate: dateTime(record.recordedDate),
  };
}

function buildMedication(record: JsonRecord, patient: JsonRecord, input: HisIngestionInput, index: number): JsonRecord {
  const code = optionalString(record.code ?? record.tmtCode ?? record.localCode);
  return {
    ...baseResource("MedicationStatement", { input, record, index, patient: patient.id }),
    status: optionalString(record.status) ?? "active",
    medicationCodeableConcept: {
      coding: code
        ? [{ system: optionalString(record.codeSystem) ?? "https://trustcare.network/codes/local-drug", code, display: optionalString(record.display ?? record.name) }]
        : undefined,
      text: optionalString(record.display ?? record.name) ?? "Unknown medication",
    },
    subject: reference(patient),
    effectiveDateTime: dateTime(record.effectiveDateTime ?? record.startDate),
    dosage: optionalString(record.dosageText ?? record.frequency)
      ? [{ text: optionalString(record.dosageText ?? record.frequency) }]
      : undefined,
  };
}

function buildCondition(record: JsonRecord, patient: JsonRecord, input: HisIngestionInput, index: number): JsonRecord {
  const code = optionalString(record.code ?? record.icd10 ?? record.icdCode);
  return {
    ...baseResource("Condition", { input, record, index, patient: patient.id }),
    clinicalStatus: terminology("http://terminology.hl7.org/CodeSystem/condition-clinical", optionalString(record.status) ?? "active", optionalString(record.status) ?? "Active"),
    code: {
      coding: code ? [{ system: "http://hl7.org/fhir/sid/icd-10", code, display: optionalString(record.display ?? record.name) }] : undefined,
      text: optionalString(record.display ?? record.name ?? record.diagnosis) ?? "Unknown condition",
    },
    subject: reference(patient),
    recordedDate: dateTime(record.recordedDate),
  };
}

function buildObservation(record: JsonRecord, patient: JsonRecord, input: HisIngestionInput, index: number): JsonRecord {
  const loinc = optionalString(record.loinc ?? record.loincCode);
  const localCode = optionalString(record.code ?? record.localCode);
  const value = record.value ?? record.resultValue;
  const numeric = typeof value === "number" || /^-?\d+(\.\d+)?$/.test(stringValue(value));
  return {
    ...baseResource("Observation", { input, record, index, patient: patient.id }),
    status: "final",
    category: [terminology("http://terminology.hl7.org/CodeSystem/observation-category", "laboratory", "Laboratory")],
    code: {
      coding: loinc
        ? [{ system: "http://loinc.org", code: loinc, display: optionalString(record.display ?? record.name) }]
        : localCode
          ? [{ system: "https://trustcare.network/codes/local-lab", code: localCode, display: optionalString(record.display ?? record.name) }]
          : undefined,
      text: optionalString(record.display ?? record.name) ?? "Unknown observation",
    },
    subject: reference(patient),
    effectiveDateTime: dateTime(record.effectiveDateTime ?? record.specimenDate ?? record.date),
    valueQuantity: numeric
      ? { value: Number(value), unit: optionalString(record.unit), system: "http://unitsofmeasure.org", code: optionalString(record.unit) }
      : undefined,
    valueString: numeric ? undefined : optionalString(value),
    interpretation: optionalString(record.interpretation ?? record.abnormalFlag)
      ? [{ text: optionalString(record.interpretation ?? record.abnormalFlag) }]
      : undefined,
    referenceRange: optionalString(record.referenceRange)
      ? [{ text: optionalString(record.referenceRange) }]
      : undefined,
  };
}

function buildDocumentReference(record: JsonRecord, patient: JsonRecord, input: HisIngestionInput, index: number): JsonRecord {
  const contentType = optionalString(record.contentType) ?? "application/octet-stream";
  const hash = optionalString(record.hash) ?? (record.content ? sha256(record.content) : undefined);
  return {
    ...baseResource("DocumentReference", { input, record, index, patient: patient.id }),
    status: "current",
    type: { text: optionalString(record.type ?? record.documentType) ?? "Clinical document" },
    subject: reference(patient),
    date: dateTime(record.date) ?? isoNow(),
    content: [
      {
        attachment: {
          contentType,
          title: optionalString(record.title ?? record.fileName),
          url: optionalString(record.url ?? record.fileUrl),
          hash,
        },
      },
    ],
  };
}

function buildProvenance(resource: JsonRecord, input: HisIngestionInput, generatedAt: string, organizationRef: string): JsonRecord {
  return {
    ...baseResource("Provenance", { resource: resource.id, input, generatedAt }),
    target: [reference(resource)],
    recorded: generatedAt,
    activity: {
      coding: [{ system: "https://trustcare.network/fhir/provenance-activity", code: "his-canonicalized", display: "HIS canonicalized to FHIR R4" }],
    },
    agent: [
      {
        type: terminology("http://terminology.hl7.org/CodeSystem/provenance-participant-type", "assembler", "Assembler"),
        who: {
          identifier: { system: "https://trustcare.network/source-organization", value: organizationRef },
          display: input.sourceOrganizationName ?? input.sourceOrganizationId,
        },
      },
    ],
    entity: [
      {
        role: "source",
        what: {
          identifier: {
            system: "https://trustcare.network/source-system",
            value: `${input.sourceSystem}:${input.sourceFormat}:${input.mapperVersion ?? "mapper-1"}`,
          },
        },
      },
    ],
  };
}

function buildIpsComposition(patient: JsonRecord, clinicalResources: JsonRecord[], input: HisIngestionInput, generatedAt: string): JsonRecord {
  const byType = (type: string) => clinicalResources.filter((resource) => resource.resourceType === type).map(reference);
  return {
    ...baseResource("Composition", { patient: patient.id, input, generatedAt }),
    meta: { profile: [IPS_COMPOSITION_PROFILE] },
    status: "final",
    type: terminology("http://loinc.org", "60591-5", "Patient summary Document"),
    subject: reference(patient),
    date: generatedAt,
    title: "Trustcare International Patient Summary",
    author: [
      {
        identifier: { system: "https://trustcare.network/source-organization", value: input.sourceOrganizationId },
        display: input.sourceOrganizationName ?? input.sourceOrganizationId,
      },
    ],
    section: [
      { title: "Allergies and Intolerances", code: terminology("http://loinc.org", "48765-2", "Allergies"), entry: byType("AllergyIntolerance") },
      { title: "Medication Summary", code: terminology("http://loinc.org", "10160-0", "History of Medication use"), entry: byType("MedicationStatement") },
      { title: "Problem List", code: terminology("http://loinc.org", "11450-4", "Problem list"), entry: byType("Condition") },
      { title: "Results", code: terminology("http://loinc.org", "30954-2", "Relevant diagnostic tests/laboratory data"), entry: byType("Observation") },
    ].filter((section) => Array.isArray(section.entry) && section.entry.length > 0),
  };
}

function reference(resource: JsonRecord): JsonRecord {
  return {
    reference: `${stringValue(resource.resourceType)}/${stringValue(resource.id)}`,
    display: resource.resourceType === "Patient" ? patientName(resource) : optionalString(resource.id),
  };
}

function patientName(patient: JsonRecord): string {
  const names = asArray(patient.name).map(asRecord);
  return optionalString(names[0]?.text) ?? "Unknown Patient";
}

function codeable(code: string, display: string): JsonRecord {
  return { coding: [{ system: "http://terminology.hl7.org/CodeSystem/v2-0203", code, display }], text: display };
}

function terminology(system: string, code: string, display: string): JsonRecord {
  return { coding: [{ system, code, display }], text: display };
}

function normalizeGender(value: unknown): string | undefined {
  const text = stringValue(value).toLowerCase();
  if (["m", "male", "ชาย"].includes(text)) return "male";
  if (["f", "female", "หญิง"].includes(text)) return "female";
  if (["o", "other"].includes(text)) return "other";
  return text ? "unknown" : undefined;
}

function normalizeEncounterClass(value: unknown): string {
  const text = stringValue(value).toUpperCase();
  if (text.includes("IP") || text === "I") return "IMP";
  if (text.includes("ER") || text === "E") return "EMER";
  return "AMB";
}

function normalizeCriticality(value: unknown): string | undefined {
  const text = stringValue(value).toLowerCase();
  if (["high", "severe", "critical"].includes(text)) return "high";
  if (["low", "mild"].includes(text)) return "low";
  return text ? "unable-to-assess" : undefined;
}

function normalizeSeverity(value: unknown): string | undefined {
  const text = stringValue(value).toLowerCase();
  if (["high", "severe", "critical"].includes(text)) return "severe";
  if (["moderate", "medium"].includes(text)) return "moderate";
  if (["low", "mild"].includes(text)) return "mild";
  return undefined;
}
