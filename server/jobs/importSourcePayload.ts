import { resolveIntegrationContract } from "../contractResolver";
import { legacyDbViewToHisPayload, reviewCsvForCanonicalMapping } from "../portability/sourceTruth";
import { sha256 } from "../portability/utils";
import type { IntegrationJobHandler, IntegrationJobHandlerRegistry } from "./runtime";

export interface NormalizedImportResult {
  sourceType: string;
  contractId: string;
  contractVersion: string;
  context: string;
  status: "ready" | "needs_review";
  normalizedSource?: unknown;
  reviewReason?: string;
  payloadHash?: string;
}

export function registerImportSourcePayloadHandler(registry: IntegrationJobHandlerRegistry): void {
  registry.register("import.source_payload", buildImportSourcePayloadHandler());
}

export function buildImportSourcePayloadHandler(): IntegrationJobHandler {
  return ({ job, emitEvent }) => {
    const resolved = resolveIntegrationContract({
      context: job.context,
      contractId: job.contractId,
      contractVersion: job.contractVersion,
      tenantId: job.tenantId,
      hospitalId: job.hospitalId,
    });

    emitEvent({
      eventType: "import_contract_resolved",
      level: resolved.fallbackUsed ? "warning" : "info",
      status: "running",
      message: "Import contract resolved",
      metadata: {
        contractId: resolved.contractId,
        contractVersion: resolved.contractVersion,
        context: resolved.context,
        warnings: resolved.warnings,
      },
    });

    const result = normalizeSourcePayload(job.sourceType, job.payload, resolved.contractId, resolved.contractVersion, resolved.context);
    emitEvent({
      eventType: result.status === "ready" ? "source_payload_imported" : "source_payload_needs_review",
      level: result.status === "ready" ? "info" : "warning",
      status: result.status === "ready" ? "running" : "needs_review",
      message: result.status === "ready" ? "Source payload imported" : "Source payload requires review",
      metadata: {
        sourceType: result.sourceType,
        payloadHash: result.payloadHash,
        reviewReason: result.reviewReason,
      },
    });

    return {
      status: result.status === "ready" ? "succeeded" : "needs_review",
      result,
      metadata: {
        sourceType: result.sourceType,
        contractId: resolved.contractId,
      },
    };
  };
}

export function normalizeSourcePayload(
  sourceType: string,
  payload: unknown,
  contractId: string,
  contractVersion: string,
  context: string,
): NormalizedImportResult {
  const payloadHash = payload === undefined ? undefined : sha256(payload);
  if (!payload || (typeof payload !== "object" && typeof payload !== "string")) {
    return needsReview(sourceType, contractId, contractVersion, context, "Import payload is empty or unsupported.", payloadHash);
  }

  if (sourceType === "his_db_view") {
    return {
      sourceType,
      contractId,
      contractVersion,
      context,
      status: "ready",
      payloadHash,
      normalizedSource: {
        sourceFormat: "db_view",
        payload: legacyDbViewToHisPayload(asRecord(payload)),
      },
    };
  }

  if (sourceType === "hl7v2") {
    if (typeof payload !== "string" || !payload.startsWith("MSH|")) {
      return needsReview(sourceType, contractId, contractVersion, context, "HL7 v2 payload must start with an MSH segment.", payloadHash);
    }
    return {
      sourceType,
      contractId,
      contractVersion,
      context,
      status: "ready",
      payloadHash,
      normalizedSource: {
        sourceFormat: "hl7v2",
        payload,
      },
    };
  }

  if (sourceType === "csv") {
    if (typeof payload !== "string") {
      return needsReview(sourceType, contractId, contractVersion, context, "CSV import payload must be text.", payloadHash);
    }
    const review = reviewCsvForCanonicalMapping({
      csvText: payload,
      sourceSystem: "csv-import",
      sourceOrganizationId: "trustcare-demo",
    });
    return {
      sourceType,
      contractId,
      contractVersion,
      context,
      status: Number(review.needsReview ?? 0) > 0 ? "needs_review" : "ready",
      payloadHash,
      normalizedSource: review,
      reviewReason: Number(review.needsReview ?? 0) > 0 ? "One or more CSV rows need mapping review." : undefined,
    };
  }

  if (sourceType === "fhir_native") {
    const record = asRecord(payload);
    if (!record.resourceType) {
      return needsReview(sourceType, contractId, contractVersion, context, "FHIR native payload must include resourceType.", payloadHash);
    }
    return {
      sourceType,
      contractId,
      contractVersion,
      context,
      status: "ready",
      payloadHash,
      normalizedSource: {
        sourceFormat: "fhir_native",
        payload: record,
      },
    };
  }

  if (sourceType === "patient_upload" || sourceType === "document_metadata") {
    const record = asRecord(payload);
    if (!record.hash || !record.contentType) {
      return needsReview(sourceType, contractId, contractVersion, context, "Document metadata must include hash and contentType.", payloadHash);
    }
    return {
      sourceType,
      contractId,
      contractVersion,
      context,
      status: "ready",
      payloadHash,
      normalizedSource: {
        sourceFormat: "document_metadata",
        documentReferenceCandidate: record,
      },
    };
  }

  if (sourceType === "smart_health_link" || sourceType === "native_vc_vp") {
    return needsReview(sourceType, contractId, contractVersion, context, "Source type is reserved for a later trust-layer import handler.", payloadHash);
  }

  return needsReview(sourceType, contractId, contractVersion, context, "Source type is not supported by the import handler.", payloadHash);
}

function needsReview(
  sourceType: string,
  contractId: string,
  contractVersion: string,
  context: string,
  reviewReason: string,
  payloadHash?: string,
): NormalizedImportResult {
  return {
    sourceType,
    contractId,
    contractVersion,
    context,
    status: "needs_review",
    reviewReason,
    payloadHash,
  };
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
}
