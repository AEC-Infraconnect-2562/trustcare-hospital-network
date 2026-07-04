import * as db from "../db";
import {
  createSyncBackPlan,
  createSyncReceipt,
  executeSyncBackPlan,
  RECOMMENDED_SYNC_TARGETS,
} from "../portability/syncBack";
import { sha256 } from "../portability/utils";
import type {
  JsonRecord,
  LegacySyncTarget,
  SyncBackExecutionOptions,
  SyncBackExecutionResult,
  SyncBackPlan,
  SyncBackRequest,
  SyncOperationType,
  SyncReconciliationJob,
  SyncTargetKind,
} from "../portability/types";
import type { IntegrationJobHandler, IntegrationJobHandlerRegistry } from "./runtime";

export type SyncBackWorkerStatus = "ready" | "needs_review";

export interface SyncBackPlanWorkerResult {
  status: SyncBackWorkerStatus;
  plan: SyncBackPlan;
  artifacts: JsonRecord[];
  operationOutcome: JsonRecord;
}

export interface SyncBackExecuteWorkerResult {
  status: SyncBackWorkerStatus;
  plan: SyncBackPlan;
  execution: SyncBackExecutionResult;
  syncReceipt: JsonRecord;
  reconciliationPersistence?: JsonRecord;
  artifacts: JsonRecord[];
  operationOutcome: JsonRecord;
}

export interface ReconciliationRunWorkerResult {
  status: SyncBackWorkerStatus;
  reconciliation: SyncReconciliationJob;
  result: JsonRecord;
  artifacts: JsonRecord[];
  operationOutcome: JsonRecord;
}

export interface SyncBackWorkerOptions {
  now?: () => Date;
  persistReconciliation?: boolean;
}

const CSV_BATCH_TARGET: LegacySyncTarget = {
  id: "csv-batch-export",
  name: "CSV batch export",
  kind: "csv_batch",
  writeMode: "mirror_only",
  supportedResources: ["Patient", "Encounter", "Observation", "MedicationRequest", "MedicationDispense", "DocumentReference", "Composition", "Claim"],
  supportsTransactions: false,
  supportsVersionCheck: false,
  idempotencyStrategy: "content_hash",
};

const DEFAULT_SYNC_TARGETS = [...RECOMMENDED_SYNC_TARGETS, CSV_BATCH_TARGET];

export function registerSyncBackWorkerHandlers(
  registry: IntegrationJobHandlerRegistry,
  options: SyncBackWorkerOptions = {},
): void {
  registry.register("sync_back.plan", buildSyncBackPlanHandler(options));
  registry.register("sync_back.execute", buildSyncBackExecuteHandler(options));
  registry.register("reconciliation.run", buildReconciliationRunHandler(options));
}

export function buildSyncBackPlanHandler(options: SyncBackWorkerOptions = {}): IntegrationJobHandler {
  return ({ job, emitEvent }) => {
    const result = buildSyncBackPlanResult(job.payload, {
      ...options,
      jobId: job.jobId,
      actorId: String(job.createdBy ?? "integration-worker"),
      occurredAt: options.now?.().toISOString(),
    });

    emitEvent({
      eventType: result.status === "ready" ? "sync_back_plan_ready" : "sync_back_plan_needs_review",
      level: result.status === "ready" ? "info" : "warning",
      status: result.status === "ready" ? "running" : "needs_review",
      message: result.status === "ready" ? "Sync-back plan prepared" : "Sync-back plan requires review",
      metadata: {
        planId: result.plan.id,
        targetId: result.plan.targetId,
        targetKind: result.plan.targetKind,
        issueCount: result.plan.issues.length,
      },
    });

    return {
      status: result.status === "ready" ? "succeeded" : "needs_review",
      result,
      metadata: {
        planId: result.plan.id,
        targetKind: result.plan.targetKind,
        issueCount: result.plan.issues.length,
      },
    };
  };
}

export function buildSyncBackExecuteHandler(options: SyncBackWorkerOptions = {}): IntegrationJobHandler {
  return async ({ job, emitEvent }) => {
    const result = await buildSyncBackExecuteResult(job.payload, {
      ...options,
      jobId: job.jobId,
      actorId: String(job.createdBy ?? "integration-worker"),
      executedAt: options.now?.().toISOString(),
    });

    emitEvent({
      eventType: result.status === "ready" ? "sync_back_executed" : "sync_back_needs_review",
      level: result.status === "ready" ? "info" : "warning",
      status: result.status === "ready" ? "running" : "needs_review",
      message: result.status === "ready" ? "Sync-back execution result prepared" : "Sync-back execution requires review",
      metadata: {
        planId: result.plan.id,
        executionId: result.execution.id,
        targetKind: result.execution.targetKind,
        executionStatus: result.execution.status,
        reconciliationJobId: result.execution.reconciliation?.id,
        syncReceiptId: result.syncReceipt.id,
      },
    });

    return {
      status: result.status === "ready" ? "succeeded" : "needs_review",
      result,
      metadata: {
        planId: result.plan.id,
        executionId: result.execution.id,
        reconciliationStatus: result.execution.reconciliation?.status,
      },
    };
  };
}

export function buildReconciliationRunHandler(options: SyncBackWorkerOptions = {}): IntegrationJobHandler {
  return async ({ job, emitEvent }) => {
    const result = await runSyncReconciliation(job.payload, {
      persistReconciliation: options.persistReconciliation,
      jobId: job.jobId,
      now: options.now?.().toISOString(),
    });

    emitEvent({
      eventType: result.status === "ready" ? "reconciliation_completed" : "reconciliation_needs_review",
      level: result.status === "ready" ? "info" : "warning",
      status: result.status === "ready" ? "running" : "needs_review",
      message: result.status === "ready" ? "Reconciliation job completed" : "Reconciliation job still requires review",
      metadata: {
        reconciliationJobId: result.reconciliation.id,
        reconciliationStatus: result.result.status,
        targetKind: result.reconciliation.targetKind,
        attempts: result.reconciliation.attempts + 1,
      },
    });

    return {
      status: result.status === "ready" ? "succeeded" : "needs_review",
      result,
      metadata: {
        reconciliationJobId: result.reconciliation.id,
        reconciliationStatus: result.result.status,
      },
    };
  };
}

export function buildSyncBackPlanResult(payload: unknown, options: SyncBackWorkerOptions & {
  jobId?: string;
  actorId?: string;
  occurredAt?: string;
} = {}): SyncBackPlanWorkerResult {
  const request = normalizeSyncBackRequest(payload, options);
  const plan = createSyncBackPlan(request);
  const status = plan.status === "ready" ? "ready" : "needs_review";
  const operationOutcome = buildSyncOperationOutcome(plan.issues, status);
  return {
    status,
    plan,
    operationOutcome,
    artifacts: [
      syncArtifact("sync_plan", plan.id, plan, { targetKind: plan.targetKind }),
      syncArtifact("operation_outcome", `operation-outcome-${sha256(operationOutcome).slice(0, 16)}`, operationOutcome),
    ],
  };
}

export async function buildSyncBackExecuteResult(payload: unknown, options: SyncBackWorkerOptions & {
  jobId?: string;
  actorId?: string;
  executedAt?: string;
} = {}): Promise<SyncBackExecuteWorkerResult> {
  const record = asRecord(payload);
  const plan = normalizeSyncBackPlan(record, options);
  const execution = executeSyncBackPlan(plan, normalizeExecutionOptions(record, options));
  const syncReceipt = createSyncReceipt(plan, execution);
  const status = execution.accepted && execution.status === "accepted" ? "ready" : "needs_review";
  const operationOutcome = buildSyncOperationOutcome(plan.issues, status, execution.message);
  const reconciliationPersistence = await persistReconciliationIfNeeded(execution.reconciliation, options);

  const artifacts = [
    syncArtifact("sync_plan", plan.id, plan, { targetKind: plan.targetKind }),
    syncArtifact("sync_receipt", String(syncReceipt.id), syncReceipt, { credentialType: "sync_receipt", preparedCredential: true }),
    syncArtifact("operation_outcome", `operation-outcome-${sha256(operationOutcome).slice(0, 16)}`, operationOutcome),
  ];
  if (execution.reconciliation && execution.reconciliation.status !== "not_required") {
    artifacts.push(syncArtifact("object_reference", execution.reconciliation.id, execution.reconciliation, { kind: "sync_reconciliation_job" }));
  }

  return {
    status,
    plan,
    execution,
    syncReceipt,
    reconciliationPersistence,
    artifacts,
    operationOutcome,
  };
}

export async function runSyncReconciliation(payload: unknown, options: Omit<SyncBackWorkerOptions, "now"> & {
  jobId?: string;
  now?: string;
} = {}): Promise<ReconciliationRunWorkerResult> {
  const reconciliation = normalizeReconciliationJob(payload, options);
  const nextAttempts = reconciliation.attempts + 1;
  const manual = reconciliation.runMode === "manual_review" || reconciliation.status === "manual_review";
  const passed = !manual && reconciliation.checks.every((check) => Boolean(check.expected));
  const nextStatus = passed ? "passed" : manual ? "manual_review" : "failed";
  const result = {
    status: nextStatus,
    checkedAt: options.now ?? new Date().toISOString(),
    attempts: nextAttempts,
    checkCount: reconciliation.checks.length,
    failedChecks: passed ? [] : reconciliation.checks.filter((check) => !check.expected).map((check) => check.type ?? "unknown"),
    manualReviewRequired: manual,
  };

  if (options.persistReconciliation !== false) {
    await db.updateSyncReconciliationJob(reconciliation.id, {
      status: nextStatus as any,
      attempts: nextAttempts,
      completedAt: nextStatus === "passed" || nextStatus === "failed" ? new Date(result.checkedAt) : undefined,
      result,
    } as any);
  }

  const status = nextStatus === "passed" ? "ready" : "needs_review";
  const operationOutcome = buildSyncOperationOutcome([], status, manual ? "Manual reconciliation remains required." : undefined);
  return {
    status,
    reconciliation: { ...reconciliation, attempts: nextAttempts, status: nextStatus as any },
    result,
    operationOutcome,
    artifacts: [
      syncArtifact("object_reference", reconciliation.id, result, { kind: "sync_reconciliation_result" }),
      syncArtifact("operation_outcome", `operation-outcome-${sha256(operationOutcome).slice(0, 16)}`, operationOutcome),
    ],
  };
}

function normalizeSyncBackRequest(payload: unknown, options: { actorId?: string; occurredAt?: string; jobId?: string }): SyncBackRequest {
  const record = asRecord(payload);
  const payloadRecord = asRecord(record.payload);
  const target = normalizeTarget(record);
  const resource = asRecord(record.resource ?? record.fhirResource ?? record.documentReference ?? payloadRecord.resource);
  const operation = normalizeOperation(record.operation);
  return {
    target,
    operation,
    resource,
    sourceEventId: stringValue(record.sourceEventId) ?? options.jobId ?? `sync-${sha256(record).slice(0, 16)}`,
    patientBusinessKey: stringValue(record.patientBusinessKey ?? record.patientIdentifier ?? record.patientId) ?? "unknown-patient",
    expectedVersion: stringValue(record.expectedVersion),
    reason: stringValue(record.reason) ?? "service-readiness-sync-back",
    actorId: stringValue(record.actorId) ?? options.actorId ?? "integration-worker",
    occurredAt: stringValue(record.occurredAt) ?? options.occurredAt,
  };
}

function normalizeSyncBackPlan(record: JsonRecord, options: { actorId?: string; executedAt?: string; jobId?: string }): SyncBackPlan {
  if (record.plan && typeof record.plan === "object") return record.plan as SyncBackPlan;
  return createSyncBackPlan(normalizeSyncBackRequest(record, options));
}

function normalizeExecutionOptions(record: JsonRecord, options: { actorId?: string; executedAt?: string }): SyncBackExecutionOptions {
  const execution = asRecord(record.executionOptions ?? record.execution ?? {});
  return {
    actorId: stringValue(execution.actorId ?? record.actorId) ?? options.actorId ?? "integration-worker",
    accepted: booleanValue(execution.accepted ?? record.accepted),
    targetVersion: stringValue(execution.targetVersion ?? record.targetVersion),
    targetReference: stringValue(execution.targetReference ?? record.targetReference),
    message: stringValue(execution.message ?? record.message),
    allowManualReview: booleanValue(execution.allowManualReview ?? record.allowManualReview),
    executedAt: stringValue(execution.executedAt ?? record.executedAt) ?? options.executedAt,
  };
}

function normalizeReconciliationJob(payload: unknown, options: { jobId?: string }): SyncReconciliationJob {
  const record = asRecord(payload);
  const source = asRecord(record.reconciliation ?? record.reconciliationJob ?? record);
  return {
    id: stringValue(source.id ?? source.jobId) ?? options.jobId ?? `sync-reconcile-${sha256(source).slice(0, 16)}`,
    planId: stringValue(source.planId) ?? "unknown-plan",
    executionId: stringValue(source.executionId) ?? "unknown-execution",
    targetId: stringValue(source.targetId) ?? "unknown-target",
    targetKind: normalizeTargetKind(source.targetKind),
    status: (stringValue(source.status) as SyncReconciliationJob["status"]) ?? "scheduled",
    reason: stringValue(source.reason) ?? "Reconciliation run requested.",
    runMode: source.runMode === "ack_replay" || source.runMode === "manual_review" ? source.runMode : "read_back",
    dueAt: stringValue(source.dueAt),
    attempts: Number(source.attempts ?? 0),
    checks: Array.isArray(source.checks) ? source.checks.map((item) => asRecord(item)) : [],
  };
}

function normalizeTarget(record: JsonRecord): LegacySyncTarget {
  if (record.target && typeof record.target === "object") return record.target as LegacySyncTarget;
  const targetId = stringValue(record.targetId);
  const targetKind = normalizeTargetKind(record.targetKind);
  const existing = DEFAULT_SYNC_TARGETS.find((target) => target.id === targetId || target.kind === targetKind);
  if (existing) return existing;
  return {
    id: targetId ?? `${targetKind}-target`,
    name: `${targetKind} target`,
    kind: targetKind,
    writeMode: targetKind === "manual_queue" ? "system_of_reference" : "mirror_only",
    supportedResources: ["Patient", "Encounter", "Observation", "MedicationRequest", "MedicationDispense", "DocumentReference", "Composition", "Claim"],
    supportsTransactions: targetKind === "fhir_rest" || targetKind === "db_view",
    supportsVersionCheck: targetKind === "fhir_rest" || targetKind === "db_view",
    idempotencyStrategy: targetKind === "hl7v2" ? "business_key" : targetKind === "csv_batch" ? "content_hash" : "source_event_id",
  };
}

function normalizeTargetKind(value: unknown): SyncTargetKind {
  if (value === "hl7v2" || value === "db_view" || value === "rest_api" || value === "csv_batch" || value === "manual_queue") return value;
  return "fhir_rest";
}

function normalizeOperation(value: unknown): SyncOperationType {
  if (value === "create" || value === "append") return value;
  return "update";
}

async function persistReconciliationIfNeeded(
  reconciliation: SyncReconciliationJob | undefined,
  options: SyncBackWorkerOptions,
): Promise<JsonRecord | undefined> {
  if (!reconciliation || reconciliation.status === "not_required") return undefined;
  if (options.persistReconciliation === false) {
    return { persisted: false, reason: "disabled_by_worker_options", reconciliationJobId: reconciliation.id };
  }
  const insertedId = await db.createSyncReconciliationJob({
    jobId: reconciliation.id,
    planId: reconciliation.planId,
    executionId: reconciliation.executionId,
    targetId: reconciliation.targetId,
    targetKind: reconciliation.targetKind,
    status: reconciliation.status as any,
    runMode: reconciliation.runMode as any,
    reason: reconciliation.reason,
    checks: reconciliation.checks,
    attempts: reconciliation.attempts,
    dueAt: reconciliation.dueAt ? new Date(reconciliation.dueAt) : undefined,
  } as any);
  return { persisted: Boolean(insertedId), dbId: insertedId, reconciliationJobId: reconciliation.id };
}

function buildSyncOperationOutcome(issues: Array<{ severity?: string; message?: string; ruleId?: string }>, status: SyncBackWorkerStatus, message?: string): JsonRecord {
  return {
    resourceType: "OperationOutcome",
    status,
    issue: issues.length
      ? issues.map((issue) => ({
          severity: issue.severity === "error" ? "error" : "warning",
          code: issue.ruleId ?? "sync-back",
          diagnostics: issue.message ?? "Sync-back review item.",
        }))
      : [{
          severity: status === "ready" ? "information" : "warning",
          code: status === "ready" ? "sync-back-ready" : "sync-back-review",
          diagnostics: message ?? (status === "ready" ? "Sync-back worker completed." : "Sync-back worker requires review."),
        }],
  };
}

function syncArtifact(artifactType: string, artifactId: string, value: unknown, metadata: JsonRecord = {}): JsonRecord {
  return {
    artifactType,
    artifactId,
    hash: sha256(value),
    metadata,
  };
}

function asRecord(value: unknown): JsonRecord {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as JsonRecord;
  return {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : value === undefined || value === null ? undefined : String(value);
}

function booleanValue(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  return undefined;
}
