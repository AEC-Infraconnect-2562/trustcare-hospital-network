import {
  createIntegrationJobAttempt,
  createIntegrationJobEvent,
  getIntegrationJobByJobId,
  listIntegrationJobs,
  updateIntegrationJobAttempt,
  updateIntegrationJobStatus,
} from "../db";
import { IntegrationJobWorkerRuntime, type IntegrationJobHandlerRegistry } from "./runtime";
import { DEFAULT_MAX_ATTEMPTS } from "./dbQueue";
import type { QueuedIntegrationJobRecord } from "./types";

export interface DbBackedWorkerRunOptions {
  registry: IntegrationJobHandlerRegistry;
  workerId?: string;
  tenantId?: string;
  hospitalId?: number;
}

export interface DbBackedWorkerRunResult {
  status: "idle" | "processed";
  jobId?: string;
  finalStatus?: string;
  correlationId?: string;
}

export async function runDbBackedWorkerOnce(options: DbBackedWorkerRunOptions): Promise<DbBackedWorkerRunResult> {
  const [row] = await listIntegrationJobs({
    tenantId: options.tenantId,
    hospitalId: options.hospitalId,
    status: "queued",
    limit: 1,
  });

  if (!row) return { status: "idle" };

  const workerId = options.workerId ?? "local-dev-worker";
  const job = mapDbJobRowToQueuedJob(row);
  const attemptNo = job.attempts + 1;
  const attemptId = await createIntegrationJobAttempt({
    jobId: job.jobId,
    attemptNo,
    status: "running",
    workerId,
    correlationId: job.correlationId,
    startedAt: new Date(),
  });

  await updateIntegrationJobStatus(job.jobId, "running", {
    attempts: attemptNo,
    lockedBy: workerId,
    lockedAt: new Date(),
    startedAt: row.startedAt ?? new Date(),
  });

  const runtime = new IntegrationJobWorkerRuntime({ registry: options.registry });
  const result = await runtime.process({ ...job, attempts: attemptNo - 1 });

  await updateIntegrationJobStatus(job.jobId, result.status as any, {
    attempts: result.attempts,
    result: result.result as any,
    errorCode: result.errorCode,
    errorMessage: result.errorMessage,
    availableAt: result.retryAt,
    lockedBy: null as any,
    lockedAt: null as any,
    completedAt: result.status === "queued" ? null as any : new Date(),
  });

  await updateIntegrationJobAttempt(attemptId, {
    status: result.status === "succeeded" ? "succeeded" : result.status === "dead_lettered" ? "dead_lettered" : "failed",
    finishedAt: new Date(),
    retryAt: result.retryAt,
    errorCode: result.errorCode,
    errorMessage: result.errorMessage,
    metadata: { finalStatus: result.status } as any,
  });

  for (const event of result.events) {
    await createIntegrationJobEvent({
      jobId: event.jobId,
      eventType: event.eventType,
      level: event.level,
      status: event.status,
      message: event.message,
      correlationId: event.correlationId,
      metadata: event.metadata as any,
    });
  }

  return {
    status: "processed",
    jobId: result.jobId,
    finalStatus: result.status,
    correlationId: result.correlationId,
  };
}

export async function getQueuedJobForDevRunner(jobId: string): Promise<QueuedIntegrationJobRecord | null> {
  const row = await getIntegrationJobByJobId(jobId);
  return row ? mapDbJobRowToQueuedJob(row) : null;
}

function mapDbJobRowToQueuedJob(row: any): QueuedIntegrationJobRecord {
  return {
    jobId: row.jobId,
    tenantId: row.tenantId ?? "trustcare-network",
    jobType: row.jobType,
    sourceType: row.sourceType,
    status: row.status,
    priority: row.priority ?? "normal",
    correlationId: row.correlationId,
    idempotencyKey: row.idempotencyKey,
    hospitalId: row.hospitalId ?? undefined,
    patientId: row.patientId ?? undefined,
    adapterId: row.adapterId ?? undefined,
    context: row.context ?? undefined,
    contractId: row.contractId ?? undefined,
    contractVersion: row.contractVersion ?? undefined,
    payloadHash: row.payloadHash ?? undefined,
    payload: row.payload ?? undefined,
    createdBy: row.createdBy ?? undefined,
    attempts: row.attempts ?? 0,
    maxAttempts: row.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
    availableAt: row.availableAt ?? new Date(),
  };
}
