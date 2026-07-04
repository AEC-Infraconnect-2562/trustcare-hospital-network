import { canonicalizeHisPayload } from "../portability/fhir";
import { sha256 } from "../portability/utils";
import type { CanonicalFhirResult, DataQualityIssue, DataQualityScore, HisIngestionInput, HisSourceFormat, JsonRecord } from "../portability/types";
import type { IntegrationJobHandler, IntegrationJobHandlerRegistry } from "./runtime";

export interface MappingDqiResult {
  status: "ready" | "needs_review";
  sourceFormat: string;
  dqiSummary: DataQualityScore;
  operationOutcome: JsonRecord;
  canonicalFhir?: CanonicalFhirResult;
  documentReferenceCandidate?: JsonRecord;
  issues: DataQualityIssue[];
}

export interface MappingDqiOptions {
  dqiThreshold?: number;
}

const DEFAULT_DQI_THRESHOLD = 85;

export function registerMappingDqiHandler(registry: IntegrationJobHandlerRegistry, options: MappingDqiOptions = {}): void {
  registry.register("mapping.canonicalize_fhir", buildMappingDqiHandler(options));
}

export function buildMappingDqiHandler(options: MappingDqiOptions = {}): IntegrationJobHandler {
  const threshold = options.dqiThreshold ?? DEFAULT_DQI_THRESHOLD;
  return ({ job, emitEvent }) => {
    const result = mapImportedPayload(job.payload, { dqiThreshold: threshold });
    emitEvent({
      eventType: result.status === "ready" ? "mapping_dqi_ready" : "mapping_dqi_needs_review",
      level: result.status === "ready" ? "info" : "warning",
      status: result.status === "ready" ? "running" : "needs_review",
      message: result.status === "ready" ? "Canonical mapping passed DQI" : "Canonical mapping requires review",
      metadata: {
        sourceFormat: result.sourceFormat,
        dqi: result.dqiSummary,
        issueCount: result.issues.length,
      },
    });
    return {
      status: result.status === "ready" ? "succeeded" : "needs_review",
      result,
    };
  };
}

export function mapImportedPayload(payload: unknown, options: MappingDqiOptions = {}): MappingDqiResult {
  const threshold = options.dqiThreshold ?? DEFAULT_DQI_THRESHOLD;
  const normalizedSource = extractNormalizedSource(payload);
  const sourceFormat = String(normalizedSource.sourceFormat ?? "unknown");

  if (sourceFormat === "document_metadata") {
    return mapDocumentMetadata(normalizedSource);
  }

  if (!isHisSourceFormat(sourceFormat)) {
    const issues = [issue("DQ-MAP-001", "error", `Unsupported source format ${sourceFormat}.`)];
    return reviewResult(sourceFormat, issues);
  }

  const canonical = canonicalizeHisPayload({
    sourceFormat,
    payload: normalizedSource.payload,
    sourceSystem: String(normalizedSource.sourceSystem ?? "integration-import-job"),
    sourceOrganizationId: String(normalizedSource.sourceOrganizationId ?? "trustcare-demo"),
    sourceOrganizationName: optionalString(normalizedSource.sourceOrganizationName),
    mapperVersion: optionalString(normalizedSource.mapperVersion),
  } satisfies HisIngestionInput);

  const status = canonical.issues.some((item) => item.severity === "error") || canonical.dqiScore.overall < threshold
    ? "needs_review"
    : "ready";

  return {
    status,
    sourceFormat,
    dqiSummary: canonical.dqiScore,
    operationOutcome: operationOutcome(canonical.issues),
    canonicalFhir: canonical,
    issues: canonical.issues,
  };
}

function extractNormalizedSource(payload: unknown): JsonRecord {
  const record = asRecord(payload);
  if (record.normalizedSource && typeof record.normalizedSource === "object") return record.normalizedSource as JsonRecord;
  return record;
}

function mapDocumentMetadata(source: JsonRecord): MappingDqiResult {
  const candidate = asRecord(source.documentReferenceCandidate ?? source.payload);
  const issues: DataQualityIssue[] = [];
  if (!candidate.hash) issues.push(issue("DQ-DOC-001", "error", "DocumentReference candidate must include a content hash."));
  if (!candidate.contentType) issues.push(issue("DQ-DOC-002", "error", "DocumentReference candidate must include contentType."));
  if (!candidate.objectRef && !candidate.url) issues.push(issue("DQ-DOC-003", "warning", "DocumentReference candidate should include objectRef or URL."));

  const dqiSummary = scoreFromIssues(issues);
  return {
    status: issues.some((item) => item.severity === "error") ? "needs_review" : "ready",
    sourceFormat: "document_metadata",
    dqiSummary,
    operationOutcome: operationOutcome(issues),
    documentReferenceCandidate: {
      resourceType: "DocumentReference",
      status: "current",
      content: [{
        attachment: {
          contentType: candidate.contentType,
          hash: candidate.hash,
          url: candidate.objectRef ?? candidate.url,
        },
      }],
      masterIdentifier: {
        system: "https://trustcare.network/document-hash",
        value: candidate.hash ? sha256(String(candidate.hash)) : undefined,
      },
      description: candidate.title,
      metadata: {
        sourceFormat: "document_metadata",
      },
    },
    issues,
  };
}

function reviewResult(sourceFormat: string, issues: DataQualityIssue[]): MappingDqiResult {
  return {
    status: "needs_review",
    sourceFormat,
    dqiSummary: scoreFromIssues(issues),
    operationOutcome: operationOutcome(issues),
    issues,
  };
}

function operationOutcome(issues: DataQualityIssue[]): JsonRecord {
  return {
    resourceType: "OperationOutcome",
    issue: issues.map((item) => ({
      severity: item.severity,
      code: "processing",
      diagnostics: item.message,
      details: { text: item.ruleId },
    })),
  };
}

function scoreFromIssues(issues: DataQualityIssue[]): DataQualityScore {
  const errorCount = issues.filter((item) => item.severity === "error").length;
  const warningCount = issues.filter((item) => item.severity === "warning").length;
  const overall = Math.max(0, 100 - errorCount * 35 - warningCount * 10);
  return {
    overall,
    completeness: errorCount ? 50 : 100,
    conformance: errorCount ? 60 : 100,
    consistency: warningCount ? 85 : 100,
    grade: overall >= 90 ? "A" : overall >= 80 ? "B" : overall >= 70 ? "C" : overall >= 60 ? "D" : "F",
    errorCount,
    warningCount,
    totalRulesEvaluated: Math.max(1, issues.length),
    rulesPassed: issues.length ? 0 : 1,
  };
}

function issue(ruleId: string, severity: "error" | "warning", message: string): DataQualityIssue {
  return { ruleId, severity, message };
}

function isHisSourceFormat(value: string): value is HisSourceFormat {
  return ["db_view", "csv", "hl7v2", "rest_api", "fhir_native", "document"].includes(value);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}
