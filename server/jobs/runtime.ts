import { redactSensitiveJobPayload } from "./dbQueue";
import { DEFAULT_RETRY_POLICY, nextRetryAt, shouldRetryIntegrationJob, type IntegrationJobRetryPolicy } from "./retryPolicy";
import type {
  IntegrationJobEventLevel,
  IntegrationJobStatus,
  IntegrationJobType,
  QueuedIntegrationJobRecord,
} from "./types";

export interface IntegrationJobRuntimeEvent {
  jobId: string;
  eventType: string;
  level: IntegrationJobEventLevel;
  status?: IntegrationJobStatus;
  message?: string;
  correlationId: string;
  metadata?: unknown;
}

export interface IntegrationJobHandlerContext {
  job: QueuedIntegrationJobRecord;
  correlationId: string;
  emitEvent: (event: Omit<IntegrationJobRuntimeEvent, "jobId" | "correlationId">) => void;
}

export interface IntegrationJobHandlerResult {
  status?: Extract<IntegrationJobStatus, "succeeded" | "needs_review">;
  result?: unknown;
  metadata?: unknown;
}

export type IntegrationJobHandler = (context: IntegrationJobHandlerContext) => Promise<IntegrationJobHandlerResult> | IntegrationJobHandlerResult;

export interface IntegrationJobProcessResult {
  jobId: string;
  correlationId: string;
  status: IntegrationJobStatus;
  attempts: number;
  retryAt?: Date;
  result?: unknown;
  errorCode?: string;
  errorMessage?: string;
  events: IntegrationJobRuntimeEvent[];
}

export class IntegrationJobHandlerRegistry {
  private readonly handlers = new Map<IntegrationJobType, IntegrationJobHandler>();

  register(jobType: IntegrationJobType, handler: IntegrationJobHandler): void {
    if (this.handlers.has(jobType)) {
      throw new Error(`Handler already registered for job type: ${jobType}`);
    }
    this.handlers.set(jobType, handler);
  }

  get(jobType: IntegrationJobType): IntegrationJobHandler | undefined {
    return this.handlers.get(jobType);
  }

  has(jobType: IntegrationJobType): boolean {
    return this.handlers.has(jobType);
  }

  listJobTypes(): IntegrationJobType[] {
    return Array.from(this.handlers.keys()).sort();
  }
}

export interface IntegrationJobWorkerRuntimeOptions {
  registry: IntegrationJobHandlerRegistry;
  retryPolicy?: IntegrationJobRetryPolicy;
  now?: () => Date;
}

export class IntegrationJobWorkerRuntime {
  private readonly registry: IntegrationJobHandlerRegistry;
  private readonly retryPolicy: IntegrationJobRetryPolicy;
  private readonly now: () => Date;

  constructor(options: IntegrationJobWorkerRuntimeOptions) {
    this.registry = options.registry;
    this.retryPolicy = options.retryPolicy ?? DEFAULT_RETRY_POLICY;
    this.now = options.now ?? (() => new Date());
  }

  async process(job: QueuedIntegrationJobRecord): Promise<IntegrationJobProcessResult> {
    const events: IntegrationJobRuntimeEvent[] = [];
    const emitEvent: IntegrationJobHandlerContext["emitEvent"] = (event) => {
      events.push(createSafeJobEvent(job, event));
    };

    const handler = this.registry.get(job.jobType);
    if (!handler) {
      emitEvent({
        eventType: "handler_missing",
        level: "warning",
        status: "needs_review",
        message: "No handler registered for job type",
        metadata: { jobType: job.jobType },
      });
      return {
        jobId: job.jobId,
        correlationId: job.correlationId,
        status: "needs_review",
        attempts: job.attempts,
        errorCode: "HANDLER_NOT_REGISTERED",
        errorMessage: "No handler registered for job type",
        events,
      };
    }

    emitEvent({
      eventType: "job_started",
      level: "info",
      status: "running",
      message: "Job handler started",
      metadata: { jobType: job.jobType, attempt: job.attempts + 1 },
    });

    try {
      const handlerResult = await handler({ job, correlationId: job.correlationId, emitEvent });
      const status = handlerResult.status ?? "succeeded";
      emitEvent({
        eventType: "job_completed",
        level: status === "needs_review" ? "warning" : "info",
        status,
        message: status === "needs_review" ? "Job completed with review needed" : "Job completed",
        metadata: handlerResult.metadata,
      });
      return {
        jobId: job.jobId,
        correlationId: job.correlationId,
        status,
        attempts: job.attempts + 1,
        result: redactSensitiveJobPayload(handlerResult.result),
        events,
      };
    } catch (error) {
      const attemptsAfterFailure = job.attempts + 1;
      const retry = shouldRetryIntegrationJob(attemptsAfterFailure, {
        ...this.retryPolicy,
        maxAttempts: Math.min(this.retryPolicy.maxAttempts, job.maxAttempts),
      });
      const status: IntegrationJobStatus = retry ? "queued" : "dead_lettered";
      const retryAt = retry ? nextRetryAt(attemptsAfterFailure, this.now(), this.retryPolicy) : undefined;
      emitEvent({
        eventType: retry ? "job_retry_scheduled" : "job_dead_lettered",
        level: "error",
        status,
        message: retry ? "Job failed and was scheduled for retry" : "Job failed and moved to dead letter",
        metadata: { errorName: error instanceof Error ? error.name : "UnknownError", attemptsAfterFailure },
      });
      return {
        jobId: job.jobId,
        correlationId: job.correlationId,
        status,
        attempts: attemptsAfterFailure,
        retryAt,
        errorCode: error instanceof Error ? error.name : "UNKNOWN_ERROR",
        errorMessage: retry ? "Job failed and was scheduled for retry" : "Job failed and moved to dead letter",
        events,
      };
    }
  }
}

export function createSafeJobEvent(
  job: Pick<QueuedIntegrationJobRecord, "jobId" | "correlationId">,
  event: Omit<IntegrationJobRuntimeEvent, "jobId" | "correlationId">,
): IntegrationJobRuntimeEvent {
  return {
    jobId: job.jobId,
    correlationId: job.correlationId,
    eventType: event.eventType,
    level: event.level,
    status: event.status,
    message: event.message,
    metadata: redactSensitiveJobPayload(event.metadata),
  };
}
