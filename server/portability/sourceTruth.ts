import { canonicalizeHisPayload } from "./fhir";
import type { DataQualityIssue, HisIngestionInput, JsonRecord } from "./types";
import { compactId, isoNow, sha256 } from "./utils";

const REQUIRED_CSV_FIELDS = ["hospital_code", "hn", "full_name_th", "birth_date", "visit_no"];

export function parseCsv(text: string): JsonRecord[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const header = splitCsvLine(lines[0]).map((item) => item.trim());
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    return Object.fromEntries(header.map((key, index) => [key, values[index] ?? ""]));
  });
}

export function reviewCsvForCanonicalMapping(input: {
  csvText: string;
  sourceSystem: string;
  sourceOrganizationId: string;
  sourceOrganizationName?: string;
  mapperVersion?: string;
}): JsonRecord {
  const rows = parseCsv(input.csvText);
  const drafts = rows.map((row, index) => reviewSourceRow(row, index, input));
  const ready = drafts.filter((draft) => draft.status === "ready").length;
  const needsReview = drafts.filter((draft) => draft.status !== "ready").length;
  return {
    id: compactId("csv-import", { rows, sourceSystem: input.sourceSystem, sourceOrganizationId: input.sourceOrganizationId }),
    importedAt: isoNow(),
    sourceSystem: input.sourceSystem,
    sourceOrganizationId: input.sourceOrganizationId,
    mapperVersion: input.mapperVersion ?? "trustcare-csv-fhir-r4-v1",
    rowCount: rows.length,
    ready,
    needsReview,
    drafts,
  };
}

export function canonicalizeReviewedDraft(draft: JsonRecord): JsonRecord {
  const hisInput = draft.hisInput as HisIngestionInput;
  const canonical = canonicalizeHisPayload(hisInput);
  return {
    draftId: draft.id,
    status: draft.status,
    corrections: draft.corrections,
    canonical,
    makeVcReady: draft.status === "ready" && canonical.issues.every((issue) => issue.severity !== "error"),
  };
}

export function legacyDbViewToHisPayload(row: JsonRecord): JsonRecord {
  const patient = row.patient_master ?? {};
  const visit = row.opd_visit ?? {};
  return {
    patient: {
      hn: patient.hn,
      cidHash: patient.cid_hash,
      carepassId: patient.carepass_id,
      name: patient.name_th ?? patient.full_name_th,
      birthDate: patient.birth_date,
      sex: patient.sex,
    },
    encounter: {
      vn: visit.vn,
      visitDate: visit.visit_date,
      class: visit.class ?? "OPD",
    },
    diagnoses: Array.isArray(row.dx) ? row.dx.map((dx: JsonRecord) => ({ code: dx.icd10, display: dx.display })) : [],
    allergies: Array.isArray(row.allergy) ? row.allergy.map((item: JsonRecord) => ({ substance: item.agent_name, severity: item.severity })) : [],
    medications: Array.isArray(row.rx) ? row.rx.map((rx: JsonRecord) => ({ code: rx.item_code, name: rx.drug_name, frequency: rx.sig_th })) : [],
    labs: Array.isArray(row.lis_result) ? row.lis_result.map((lab: JsonRecord) => ({ loinc: lab.test_code, name: lab.test_name, value: lab.result_value, unit: lab.unit, abnormalFlag: lab.flag })) : [],
  };
}

function reviewSourceRow(row: JsonRecord, index: number, input: {
  sourceSystem: string;
  sourceOrganizationId: string;
  sourceOrganizationName?: string;
  mapperVersion?: string;
}): JsonRecord {
  const issues: DataQualityIssue[] = [];
  const corrections: JsonRecord[] = [];
  const normalized = normalizeCsvRow(row, corrections);

  for (const field of REQUIRED_CSV_FIELDS) {
    if (!normalized[field]) {
      issues.push({
        ruleId: "CSV-REQ-001",
        severity: "error",
        message: `Missing required CSV field ${field}.`,
      });
    }
  }
  if (String(normalized.thai_id ?? "").replace(/\D/g, "").length === 13) {
    issues.push({
      ruleId: "CSV-PRIV-001",
      severity: "warning",
      message: "Full Thai ID was supplied; only a hash/masked identifier will be retained.",
    });
    normalized.cid_hash = `sha256:${sha256(normalized.thai_id)}`;
    delete normalized.thai_id;
    corrections.push({ field: "thai_id", action: "hash_and_remove", value: normalized.cid_hash });
  }
  if (!normalized.carepass_id) {
    normalized.carepass_id = `CP-AUTO-${sha256(`${normalized.hn}:${normalized.full_name_th}`).slice(0, 12).toUpperCase()}`;
    corrections.push({ field: "carepass_id", action: "generated", value: normalized.carepass_id });
  }

  const payload = {
    patient: {
      hn: normalized.hn,
      cidHash: normalized.cid_hash,
      carepassId: normalized.carepass_id,
      name: normalized.full_name_th,
      birthDate: normalized.birth_date,
      sex: normalized.sex,
    },
    encounter: {
      vn: normalized.visit_no,
      visitDate: normalized.visit_date ?? "2026-07-01T09:00:00+07:00",
      class: normalized.visit_class ?? "OPD",
    },
    diagnoses: normalized.diagnosis_code ? [{ code: normalized.diagnosis_code, display: normalized.diagnosis_text }] : [],
    allergies: normalized.allergy ? [{ substance: normalized.allergy, severity: severityFromText(normalized.allergy) }] : [],
    medications: normalized.medication ? [{ name: normalized.medication, frequency: normalized.sig_th ?? "ตามแพทย์สั่ง" }] : [],
    labs: normalized.lab_code ? [{ loinc: normalized.lab_code, name: normalized.lab_name, value: normalized.lab_value, unit: normalized.lab_unit, abnormalFlag: normalized.lab_flag }] : [],
  };

  return {
    id: compactId("canonical-draft", { row: normalized, index }),
    rowIndex: index + 1,
    status: issues.some((issue) => issue.severity === "error") ? "needs_review" : "ready",
    sourceRow: row,
    normalizedRow: normalized,
    corrections,
    issues,
    hisInput: {
      sourceFormat: "csv",
      payload,
      sourceSystem: input.sourceSystem,
      sourceOrganizationId: input.sourceOrganizationId,
      sourceOrganizationName: input.sourceOrganizationName,
      mapperVersion: input.mapperVersion ?? "trustcare-csv-fhir-r4-v1",
    },
  };
}

function normalizeCsvRow(row: JsonRecord, corrections: JsonRecord[]): JsonRecord {
  const normalized: JsonRecord = {};
  for (const [key, value] of Object.entries(row)) {
    normalized[key.trim().toLowerCase()] = typeof value === "string" ? value.trim() : value;
  }
  if (normalized.full_name_en && !normalized.full_name_th) {
    normalized.full_name_th = normalized.full_name_en;
    corrections.push({ field: "full_name_th", action: "copied_from_full_name_en" });
  }
  if (normalized.birth_date && /^\d{8}$/.test(String(normalized.birth_date))) {
    const text = String(normalized.birth_date);
    normalized.birth_date = `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
    corrections.push({ field: "birth_date", action: "normalized_yyyymmdd" });
  }
  return normalized;
}

function severityFromText(value: unknown): string {
  const text = String(value ?? "").toLowerCase();
  if (text.includes("severe") || text.includes("anaphylaxis") || text.includes("high")) return "high";
  if (text.includes("moderate")) return "moderate";
  return "low";
}

function splitCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}
