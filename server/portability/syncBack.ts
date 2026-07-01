import type { DataQualityIssue, JsonRecord, LegacySyncTarget, SyncBackPlan, SyncBackRequest } from "./types";
import { compactId, isoNow, sha256 } from "./utils";

const FHIR_RESOURCE_TO_HL7_EVENT: Record<string, string> = {
  Patient: "ADT^A08",
  Encounter: "ADT^A08",
  Observation: "ORU^R01",
  MedicationRequest: "RDE^O11",
  MedicationDispense: "RDS^O13",
  DocumentReference: "MDM^T02",
  Composition: "MDM^T02",
  Claim: "DFT^P03",
};

export function createSyncBackPlan(request: SyncBackRequest): SyncBackPlan {
  const resourceType = String(request.resource.resourceType ?? "Unknown");
  const issues: DataQualityIssue[] = [];

  if (!request.target.supportedResources.includes(resourceType)) {
    issues.push({
      ruleId: "SYNC-001",
      severity: "error",
      resourceType,
      resourceId: String(request.resource.id ?? ""),
      message: `${request.target.name} does not support writing ${resourceType}.`,
    });
  }
  if (!request.target.supportsVersionCheck && request.operation !== "append") {
    issues.push({
      ruleId: "SYNC-002",
      severity: "warning",
      resourceType,
      resourceId: String(request.resource.id ?? ""),
      message: "Target cannot perform optimistic version checks; consistency will rely on idempotency keys and reconciliation.",
    });
  }
  if (request.target.writeMode === "system_of_reference" && request.operation === "update") {
    issues.push({
      ruleId: "SYNC-003",
      severity: "warning",
      resourceType,
      resourceId: String(request.resource.id ?? ""),
      message: "Target is configured as system-of-reference, not system-of-record; write should be reviewed.",
    });
  }

  const idempotencyKey = buildIdempotencyKey(request);
  const consistencyKey = sha256({
    targetId: request.target.id,
    patientBusinessKey: request.patientBusinessKey,
    resourceType,
    resourceId: request.resource.id,
    payloadHash: sha256(request.resource),
  });

  const outboundPayload = renderPayloadForTarget(request, idempotencyKey, consistencyKey);
  const status = issues.some((issue) => issue.severity === "error")
    ? "blocked"
    : issues.length
      ? "manual_review_required"
      : "ready";

  return {
    id: compactId("sync-plan", { idempotencyKey, consistencyKey }),
    targetId: request.target.id,
    targetKind: request.target.kind,
    operation: request.operation,
    idempotencyKey,
    consistencyKey,
    outboundPayload,
    preconditions: buildPreconditions(request, idempotencyKey),
    rollbackHint: rollbackHint(request.target),
    status,
    issues,
  };
}

export function createSyncReceipt(plan: SyncBackPlan, result: { accepted: boolean; targetVersion?: string; targetReference?: string; message?: string }): JsonRecord {
  return {
    resourceType: "TrustcareSyncReceipt",
    id: compactId("sync-receipt", { plan, result }),
    planId: plan.id,
    targetId: plan.targetId,
    targetKind: plan.targetKind,
    status: result.accepted ? "accepted" : "rejected",
    idempotencyKey: plan.idempotencyKey,
    consistencyKey: plan.consistencyKey,
    targetVersion: result.targetVersion,
    targetReference: result.targetReference,
    message: result.message,
    issuedAt: isoNow(),
  };
}

export const RECOMMENDED_SYNC_TARGETS: LegacySyncTarget[] = [
  {
    id: "fhir-rest-primary",
    name: "FHIR REST endpoint",
    kind: "fhir_rest",
    writeMode: "system_of_record",
    supportedResources: ["Patient", "Encounter", "Observation", "MedicationRequest", "MedicationDispense", "DocumentReference", "Composition", "Claim"],
    supportsTransactions: true,
    supportsVersionCheck: true,
    idempotencyStrategy: "source_event_id",
  },
  {
    id: "hl7v2-legacy",
    name: "HL7 v2 broker",
    kind: "hl7v2",
    writeMode: "system_of_record",
    supportedResources: ["Patient", "Encounter", "Observation", "MedicationRequest", "DocumentReference", "Composition"],
    supportsTransactions: false,
    supportsVersionCheck: false,
    idempotencyStrategy: "business_key",
  },
  {
    id: "legacy-db-outbox",
    name: "Legacy database outbox",
    kind: "db_view",
    writeMode: "mirror_only",
    supportedResources: ["Patient", "Encounter", "Observation", "MedicationRequest", "MedicationDispense", "DocumentReference", "Composition", "Claim"],
    supportsTransactions: true,
    supportsVersionCheck: true,
    idempotencyStrategy: "content_hash",
  },
  {
    id: "manual-queue",
    name: "Human reconciliation queue",
    kind: "manual_queue",
    writeMode: "system_of_reference",
    supportedResources: ["Patient", "Encounter", "Observation", "MedicationRequest", "MedicationDispense", "DocumentReference", "Composition", "Claim"],
    supportsTransactions: false,
    supportsVersionCheck: false,
    idempotencyStrategy: "source_event_id",
  },
];

function buildIdempotencyKey(request: SyncBackRequest): string {
  if (request.target.idempotencyStrategy === "business_key") {
    return sha256(`${request.target.id}:${request.patientBusinessKey}:${request.resource.resourceType}:${request.operation}`);
  }
  if (request.target.idempotencyStrategy === "content_hash") {
    return sha256(`${request.target.id}:${request.patientBusinessKey}:${sha256(request.resource)}`);
  }
  return sha256(`${request.target.id}:${request.sourceEventId}`);
}

function renderPayloadForTarget(request: SyncBackRequest, idempotencyKey: string, consistencyKey: string): JsonRecord {
  const common = {
    idempotencyKey,
    consistencyKey,
    sourceEventId: request.sourceEventId,
    reason: request.reason,
    actorId: request.actorId,
    occurredAt: request.occurredAt ?? isoNow(),
    operation: request.operation,
  };

  if (request.target.kind === "fhir_rest") {
    return {
      protocol: "FHIR REST",
      method: request.operation === "create" ? "POST" : "PUT",
      resourceType: request.resource.resourceType,
      conditionalUrl: `${request.resource.resourceType}?identifier=${encodeURIComponent(request.patientBusinessKey)}`,
      ifMatch: request.expectedVersion,
      body: request.resource,
      ...common,
    };
  }

  if (request.target.kind === "hl7v2") {
    return {
      protocol: "HL7v2",
      messageType: FHIR_RESOURCE_TO_HL7_EVENT[String(request.resource.resourceType)] ?? "MDM^T02",
      msh10: idempotencyKey.slice(0, 20),
      payload: renderHl7LikePayload(request.resource),
      ...common,
    };
  }

  if (request.target.kind === "db_view") {
    return {
      protocol: "legacy-db-outbox",
      table: "trustcare_sync_outbox",
      row: {
        resource_type: request.resource.resourceType,
        business_key: request.patientBusinessKey,
        idempotency_key: idempotencyKey,
        consistency_key: consistencyKey,
        payload_json: request.resource,
        expected_version: request.expectedVersion,
      },
      ...common,
    };
  }

  if (request.target.kind === "csv_batch") {
    return {
      protocol: "csv-batch",
      filePrefix: `trustcare-${request.resource.resourceType}-${new Date().toISOString().slice(0, 10)}`,
      rows: flattenResource(request.resource),
      ...common,
    };
  }

  return {
    protocol: request.target.kind,
    body: request.resource,
    ...common,
  };
}

function buildPreconditions(request: SyncBackRequest, idempotencyKey: string): JsonRecord[] {
  const preconditions: JsonRecord[] = [
    { type: "idempotency", key: idempotencyKey, rule: "Target must reject duplicate accepted writes with the same idempotency key." },
    { type: "audit", rule: "Outbound write must produce AuditEvent and SyncReceipt VC." },
  ];
  if (request.target.supportsVersionCheck && request.expectedVersion) {
    preconditions.push({ type: "optimistic_version", expectedVersion: request.expectedVersion, rule: "Apply only if target version still matches." });
  }
  if (!request.target.supportsTransactions) {
    preconditions.push({ type: "reconciliation", rule: "Schedule post-write readback and checksum reconciliation." });
  }
  return preconditions;
}

function rollbackHint(target: LegacySyncTarget): string | undefined {
  if (target.supportsTransactions) return "Rollback transaction before acknowledging sync plan.";
  if (target.kind === "hl7v2") return "Send compensating update/cancel message and queue manual reconciliation.";
  if (target.kind === "manual_queue") return "Mark manual queue item rejected; no target write occurred.";
  return "Use reconciliation job to compare source and target checksums and emit corrective outbox item.";
}

function renderHl7LikePayload(resource: JsonRecord): JsonRecord {
  return {
    resourceType: resource.resourceType,
    id: resource.id,
    text: resource.text ?? resource.code?.text ?? resource.medicationCodeableConcept?.text ?? resource.type?.text,
    subject: resource.subject ?? resource.patient,
    authoredOn: resource.authoredOn ?? resource.date ?? resource.effectiveDateTime,
  };
}

function flattenResource(resource: JsonRecord): JsonRecord[] {
  return [
    {
      resourceType: resource.resourceType,
      resourceId: resource.id,
      payloadHash: sha256(resource),
      payloadJson: JSON.stringify(resource),
    },
  ];
}
