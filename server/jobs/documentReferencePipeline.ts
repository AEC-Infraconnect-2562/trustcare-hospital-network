import { sha256 } from "../portability/utils";
import type { DataQualityIssue, JsonRecord } from "../portability/types";
import type { IntegrationJobHandler, IntegrationJobHandlerRegistry } from "./runtime";

export type DocumentReferenceReviewState = "ready_for_maker_review" | "needs_source_review";

export interface DocumentReferenceArtifactDescriptor {
  artifactId: string;
  artifactType: "document_reference" | "object_reference" | "operation_outcome";
  objectRef?: string;
  fhirReference?: string;
  hash?: string;
  metadata: JsonRecord;
}

export interface DocumentReferencePipelineResult {
  status: "ready" | "needs_review";
  reviewState: DocumentReferenceReviewState;
  documentReference?: JsonRecord;
  provenance?: JsonRecord;
  objectReference?: JsonRecord;
  artifacts: DocumentReferenceArtifactDescriptor[];
  operationOutcome: JsonRecord;
  issues: DataQualityIssue[];
}

export interface DocumentReferencePipelineOptions {
  patientId?: number;
  hospitalId?: number;
  context?: string;
  contractId?: string;
  contractVersion?: string;
  correlationId?: string;
  now?: () => Date;
}

interface LegacyDocumentMetadata {
  title?: string;
  documentType?: string;
  contentType?: string;
  objectRef?: string;
  url?: string;
  fileName?: string;
  sizeBytes?: number;
  hash?: string;
  hashAlgorithm?: string;
  sourceSystem?: string;
  sourceDocumentId?: string;
  sourceJobId?: string;
  patientId?: number;
  hospitalId?: number;
  receivedAt?: string;
  candidateId?: string;
  hasInlineBinary: boolean;
}

const INLINE_BINARY_KEYS = new Set(["base64", "fileBase64", "fileBytes", "bytes", "buffer", "binary", "blob"]);

export function registerDocumentReferencePipelineHandler(registry: IntegrationJobHandlerRegistry): void {
  registry.register("document.create_reference", buildDocumentReferencePipelineHandler());
}

export function buildDocumentReferencePipelineHandler(): IntegrationJobHandler {
  return ({ job, emitEvent }) => {
    const result = buildLegacyDocumentReferencePackage(job.payload, {
      patientId: job.patientId,
      hospitalId: job.hospitalId,
      context: job.context,
      contractId: job.contractId,
      contractVersion: job.contractVersion,
      correlationId: job.correlationId,
    });

    emitEvent({
      eventType: result.status === "ready" ? "document_reference_ready" : "document_reference_needs_review",
      level: result.status === "ready" ? "info" : "warning",
      status: result.status === "ready" ? "running" : "needs_review",
      message: result.status === "ready" ? "Legacy document metadata converted to DocumentReference" : "Legacy document metadata requires review",
      metadata: {
        reviewState: result.reviewState,
        issueCount: result.issues.length,
        artifactCount: result.artifacts.length,
        fhirReference: result.documentReference ? `DocumentReference/${result.documentReference.id}` : undefined,
        contentHash: result.objectReference?.hash,
      },
    });

    return {
      status: result.status === "ready" ? "succeeded" : "needs_review",
      result,
      metadata: {
        reviewState: result.reviewState,
        artifactCount: result.artifacts.length,
      },
    };
  };
}

export function buildLegacyDocumentReferencePackage(
  payload: unknown,
  options: DocumentReferencePipelineOptions = {},
): DocumentReferencePipelineResult {
  const metadata = extractLegacyDocumentMetadata(payload, options);
  const issues = validateLegacyDocumentMetadata(metadata);
  const operationOutcome = buildOperationOutcome(issues);

  if (issues.some((item) => item.severity === "error")) {
    return {
      status: "needs_review",
      reviewState: "needs_source_review",
      artifacts: [{
        artifactId: `artifact-operation-outcome-${sha256(operationOutcome).slice(0, 16)}`,
        artifactType: "operation_outcome",
        hash: sha256(operationOutcome),
        metadata: { operationOutcome, noBinaryStored: true },
      }],
      operationOutcome,
      issues,
    };
  }

  const now = options.now?.().toISOString() ?? new Date().toISOString();
  const documentReference = buildDocumentReference(metadata, options, now);
  const provenance = buildProvenance(documentReference, metadata, options, now);
  const objectReference = buildObjectReference(metadata);
  const fhirReference = `DocumentReference/${documentReference.id}`;
  const provenanceReference = `Provenance/${provenance.id}`;
  const artifacts: DocumentReferenceArtifactDescriptor[] = [
    {
      artifactId: `artifact-document-reference-${documentReference.id}`,
      artifactType: "document_reference",
      objectRef: metadata.objectRef ?? metadata.url,
      fhirReference,
      hash: metadata.hash,
      metadata: {
        reviewState: "ready_for_maker_review",
        provenanceReference,
        sourceJobId: metadata.sourceJobId,
        contractId: options.contractId,
        contractVersion: options.contractVersion,
        noBinaryStored: true,
        vcIssuance: "not_started",
      },
    },
    {
      artifactId: `artifact-object-reference-${sha256({ hash: metadata.hash, objectRef: metadata.objectRef ?? metadata.url }).slice(0, 16)}`,
      artifactType: "object_reference",
      objectRef: metadata.objectRef ?? metadata.url,
      fhirReference,
      hash: metadata.hash,
      metadata: objectReference,
    },
    {
      artifactId: `artifact-operation-outcome-${sha256(operationOutcome).slice(0, 16)}`,
      artifactType: "operation_outcome",
      fhirReference,
      hash: sha256(operationOutcome),
      metadata: { operationOutcome, noBinaryStored: true },
    },
  ];

  return {
    status: "ready",
    reviewState: "ready_for_maker_review",
    documentReference,
    provenance,
    objectReference,
    artifacts,
    operationOutcome,
    issues,
  };
}

function extractLegacyDocumentMetadata(payload: unknown, options: DocumentReferencePipelineOptions): LegacyDocumentMetadata {
  const record = asRecord(payload);
  const candidate = extractDocumentReferenceCandidate(record);
  const attachment = firstAttachment(candidate);
  const source = Object.keys(candidate).length > 0 ? candidate : record;
  const contentType = optionalString(source.contentType ?? source.mimeType ?? attachment.contentType);
  const objectRef = optionalString(source.objectRef ?? source.storageKey ?? source.fileKey);
  const url = optionalString(source.url ?? source.fileUrl ?? attachment.url);
  const hash = optionalString(source.hash ?? source.contentHash ?? attachment.hash ?? asRecord(source.masterIdentifier).value);
  const patientId = numberValue(source.patientId) ?? numberValue(asRecord(source.subject).reference?.toString().replace("Patient/", "")) ?? options.patientId;
  const hospitalId = numberValue(source.hospitalId) ?? options.hospitalId;

  return {
    title: optionalString(source.title ?? source.description ?? attachment.title),
    documentType: optionalString(source.documentType ?? asRecord(source.type).text) ?? "legacy_document",
    contentType,
    objectRef,
    url,
    fileName: optionalString(source.fileName ?? attachment.title),
    sizeBytes: numberValue(source.sizeBytes ?? attachment.size),
    hash,
    hashAlgorithm: optionalString(source.hashAlgorithm) ?? "sha-256",
    sourceSystem: optionalString(source.sourceSystem) ?? "legacy-file-pipeline",
    sourceDocumentId: optionalString(source.sourceDocumentId ?? source.id),
    sourceJobId: optionalString(source.sourceJobId),
    patientId,
    hospitalId,
    receivedAt: optionalString(source.receivedAt ?? source.date),
    candidateId: optionalString(source.fhirDocumentReferenceId ?? source.documentReferenceId ?? source.id),
    hasInlineBinary: containsInlineBinary(record) || Boolean(attachment.data),
  };
}

function extractDocumentReferenceCandidate(record: JsonRecord): JsonRecord {
  if (record.documentReferenceCandidate && typeof record.documentReferenceCandidate === "object") {
    return record.documentReferenceCandidate as JsonRecord;
  }
  if (record.mappingResult && typeof record.mappingResult === "object") {
    const mapping = record.mappingResult as JsonRecord;
    if (mapping.documentReferenceCandidate && typeof mapping.documentReferenceCandidate === "object") {
      return mapping.documentReferenceCandidate as JsonRecord;
    }
  }
  if (record.normalizedSource && typeof record.normalizedSource === "object") {
    const source = record.normalizedSource as JsonRecord;
    if (source.documentReferenceCandidate && typeof source.documentReferenceCandidate === "object") {
      return source.documentReferenceCandidate as JsonRecord;
    }
  }
  if (record.fhirDocumentReference && typeof record.fhirDocumentReference === "object") {
    return record.fhirDocumentReference as JsonRecord;
  }
  return {};
}

function firstAttachment(candidate: JsonRecord): JsonRecord {
  const content = Array.isArray(candidate.content) ? asRecord(candidate.content[0]) : {};
  return asRecord(content.attachment);
}

function validateLegacyDocumentMetadata(metadata: LegacyDocumentMetadata): DataQualityIssue[] {
  const issues: DataQualityIssue[] = [];
  if (!metadata.hash) issues.push(issue("DOC-REF-001", "error", "Legacy document metadata must include a content hash."));
  if (!metadata.contentType) issues.push(issue("DOC-REF-002", "error", "Legacy document metadata must include content type."));
  if (!metadata.objectRef && !metadata.url) issues.push(issue("DOC-REF-003", "error", "Legacy document metadata must include an object reference or retrievable URL."));
  if (metadata.hasInlineBinary) issues.push(issue("DOC-REF-004", "error", "Inline binary content is not accepted by the job pipeline."));
  return issues;
}

function buildDocumentReference(metadata: LegacyDocumentMetadata, options: DocumentReferencePipelineOptions, now: string): JsonRecord {
  const id = metadata.candidateId ?? `docref-${sha256({
    hash: metadata.hash,
    objectRef: metadata.objectRef ?? metadata.url,
    sourceDocumentId: metadata.sourceDocumentId,
    sourceJobId: metadata.sourceJobId,
  }).slice(0, 16)}`;
  return stripUndefined({
    resourceType: "DocumentReference",
    id,
    status: "current",
    docStatus: "preliminary",
    meta: {
      profile: ["http://hl7.org/fhir/StructureDefinition/DocumentReference"],
      tag: [{ system: "https://trustcare.network/fhir/review-state", code: "ready_for_maker_review" }],
    },
    masterIdentifier: {
      system: "https://trustcare.network/document-hash",
      value: metadata.hash,
    },
    type: {
      coding: [{ system: "https://trustcare.network/fhir/document-type", code: metadata.documentType }],
      text: metadata.title ?? metadata.documentType,
    },
    subject: metadata.patientId ? { reference: `Patient/${metadata.patientId}` } : undefined,
    date: metadata.receivedAt ?? now,
    author: [{ display: metadata.sourceSystem }],
    custodian: metadata.hospitalId ? { reference: `Organization/${metadata.hospitalId}` } : undefined,
    description: metadata.title,
    securityLabel: options.context ? [{ coding: [{ system: "https://trustcare.network/service-readiness-context", code: options.context }] }] : undefined,
    content: [{
      attachment: {
        contentType: metadata.contentType,
        url: metadata.objectRef ?? metadata.url,
        title: metadata.fileName ?? metadata.title,
        size: metadata.sizeBytes,
        hash: metadata.hash,
      },
      format: {
        system: "https://trustcare.network/document-format",
        code: classifyObjectReference(metadata.objectRef ?? metadata.url),
      },
    }],
    context: {
      related: [
        metadata.sourceJobId ? { reference: `IntegrationJob/${metadata.sourceJobId}` } : undefined,
        options.contractId ? { identifier: { system: "https://trustcare.network/service-readiness-contract", value: options.contractId } } : undefined,
      ].filter(Boolean),
      sourcePatientInfo: metadata.patientId ? { reference: `Patient/${metadata.patientId}` } : undefined,
    },
    extension: [
      { url: "https://trustcare.network/fhir/StructureDefinition/source-system", valueString: metadata.sourceSystem },
      { url: "https://trustcare.network/fhir/StructureDefinition/source-document-id", valueString: metadata.sourceDocumentId },
      { url: "https://trustcare.network/fhir/StructureDefinition/source-job-id", valueString: metadata.sourceJobId },
      { url: "https://trustcare.network/fhir/StructureDefinition/hash-algorithm", valueString: metadata.hashAlgorithm },
      { url: "https://trustcare.network/fhir/StructureDefinition/no-binary-stored", valueBoolean: true },
    ].filter((item) => Object.values(item).some((value) => value !== undefined)),
  });
}

function buildProvenance(documentReference: JsonRecord, metadata: LegacyDocumentMetadata, options: DocumentReferencePipelineOptions, now: string): JsonRecord {
  return stripUndefined({
    resourceType: "Provenance",
    id: `prov-${sha256({ documentReferenceId: documentReference.id, hash: metadata.hash, sourceJobId: metadata.sourceJobId }).slice(0, 16)}`,
    target: [{ reference: `DocumentReference/${documentReference.id}` }],
    recorded: now,
    activity: {
      coding: [{
        system: "https://trustcare.network/fhir/provenance-activity",
        code: "legacy-document-referenced",
        display: "Legacy document metadata converted to FHIR DocumentReference",
      }],
    },
    agent: [{
      type: {
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/provenance-participant-type",
          code: "assembler",
          display: "Assembler",
        }],
      },
      who: {
        identifier: { system: "https://trustcare.network/source-system", value: metadata.sourceSystem },
        display: metadata.sourceSystem,
      },
    }],
    entity: [{
      role: "source",
      what: {
        identifier: {
          system: "https://trustcare.network/source-document",
          value: metadata.sourceDocumentId ?? metadata.hash,
        },
        display: metadata.objectRef ?? metadata.url,
      },
    }],
    reason: options.contractId ? [{
      coding: [{ system: "https://trustcare.network/service-readiness-contract", code: options.contractId }],
    }] : undefined,
  });
}

function buildObjectReference(metadata: LegacyDocumentMetadata): JsonRecord {
  return {
    objectRef: metadata.objectRef ?? metadata.url,
    storageKind: classifyObjectReference(metadata.objectRef ?? metadata.url),
    contentType: metadata.contentType,
    hash: metadata.hash,
    hashAlgorithm: metadata.hashAlgorithm,
    sizeBytes: metadata.sizeBytes,
    noBinaryStored: true,
  };
}

function buildOperationOutcome(issues: DataQualityIssue[]): JsonRecord {
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

function classifyObjectReference(value: unknown): string {
  const ref = optionalString(value) ?? "";
  if (ref.startsWith("mock://")) return "mock_reference";
  if (/^(s3|gs|r2|az|blob|object):\/\//.test(ref)) return "object_reference";
  if (/^https?:\/\//.test(ref)) return "external_url";
  return "object_reference";
}

function containsInlineBinary(value: unknown): boolean {
  if (Array.isArray(value)) return value.some((item) => containsInlineBinary(item));
  if (!value || typeof value !== "object") return false;
  return Object.entries(value as Record<string, unknown>).some(([key, item]) => {
    if (INLINE_BINARY_KEYS.has(key)) return item !== undefined && item !== null && item !== "";
    if (key === "content") return typeof item === "string" && item.trim() !== "";
    if (key === "data") return typeof item === "string" && item.trim() !== "";
    return containsInlineBinary(item);
  });
}

function issue(ruleId: string, severity: "error" | "warning", message: string): DataQualityIssue {
  return { ruleId, severity, resourceType: "DocumentReference", message };
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function optionalString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return undefined;
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => stripUndefined(item)).filter((item) => item !== undefined) as T;
  if (!value || typeof value !== "object") return value;
  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (item === undefined) continue;
    output[key] = stripUndefined(item);
  }
  return output as T;
}
