import { randomUUID } from "node:crypto";
import { sha256, stableStringify } from "../portability/utils";
import type {
  IntegrationJobCreateInput,
  IntegrationJobListFilter,
  IntegrationJobStatus,
  NormalizedIntegrationJobListFilter,
  QueuedIntegrationJobRecord,
} from "./types";

export const DEFAULT_TENANT_ID = "trustcare-network";
export const DEFAULT_MAX_ATTEMPTS = 3;
export const MAX_JOB_LIST_LIMIT = 200;

const TERMINAL_STATUSES = new Set<IntegrationJobStatus>(["succeeded", "dead_lettered", "cancelled"]);

const TRANSITIONS: Record<IntegrationJobStatus, IntegrationJobStatus[]> = {
  queued: ["claimed", "running", "cancelled"],
  claimed: ["running", "queued", "failed", "cancelled"],
  running: ["succeeded", "failed", "needs_review", "dead_lettered", "cancelled"],
  failed: ["queued", "needs_review", "dead_lettered", "cancelled"],
  needs_review: ["queued", "succeeded", "cancelled"],
  succeeded: [],
  dead_lettered: [],
  cancelled: [],
};

const SENSITIVE_KEY_PATTERNS = [
  /passcode/i,
  /shl.*key/i,
  /private.*key/i,
  /access.*token/i,
  /^token$/i,
  /^jwt$/i,
  /sd.*jwt/i,
  /secret/i,
  /plaintext/i,
  /thai.*id/i,
  /national.*id/i,
  /passport/i,
  /^cid$/i,
  /^hn$/i,
  /phone/i,
  /email/i,
  /address/i,
  /^name$/i,
];

export function normalizeTenantId(tenantId?: string): string {
  const normalized = tenantId?.trim();
  return normalized || DEFAULT_TENANT_ID;
}

export function buildIntegrationJobIdempotencyKey(input: IntegrationJobCreateInput): string {
  if (input.idempotencyKey?.trim()) return input.idempotencyKey.trim();
  const payloadHash = input.payload === undefined ? null : sha256(stableStringify(input.payload));
  const material = {
    tenantId: normalizeTenantId(input.tenantId),
    hospitalId: input.hospitalId ?? null,
    patientId: input.patientId ?? null,
    context: input.context ?? null,
    contractId: input.contractId ?? null,
    contractVersion: input.contractVersion ?? null,
    jobType: input.jobType,
    sourceType: input.sourceType,
    sourceRef: input.sourceRef ?? null,
    payloadHash,
  };
  return `idem_${sha256(material).slice(0, 48)}`;
}

export function buildCorrelationId(correlationId?: string): string {
  const normalized = correlationId?.trim();
  return normalized || `corr_${randomUUID()}`;
}

export function buildQueuedIntegrationJob(input: IntegrationJobCreateInput): QueuedIntegrationJobRecord {
  const payloadHash = input.payload === undefined ? undefined : sha256(stableStringify(input.payload));
  return {
    jobId: `job_${randomUUID()}`,
    tenantId: normalizeTenantId(input.tenantId),
    jobType: input.jobType,
    sourceType: input.sourceType,
    status: "queued",
    priority: input.priority ?? "normal",
    correlationId: buildCorrelationId(input.correlationId),
    idempotencyKey: buildIntegrationJobIdempotencyKey(input),
    hospitalId: input.hospitalId,
    patientId: input.patientId,
    adapterId: input.adapterId,
    context: input.context,
    contractId: input.contractId,
    contractVersion: input.contractVersion,
    payloadHash,
    payload: redactSensitiveJobPayload(input.payload),
    createdBy: input.createdBy,
    attempts: 0,
    maxAttempts: input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
    availableAt: input.availableAt ?? new Date(),
  };
}

export function canTransitionIntegrationJobStatus(from: IntegrationJobStatus, to: IntegrationJobStatus): boolean {
  if (from === to) return true;
  if (TERMINAL_STATUSES.has(from)) return false;
  return TRANSITIONS[from].includes(to);
}

export function assertIntegrationJobTransition(from: IntegrationJobStatus, to: IntegrationJobStatus): void {
  if (!canTransitionIntegrationJobStatus(from, to)) {
    throw new Error(`Invalid integration job transition: ${from} -> ${to}`);
  }
}

export function normalizeIntegrationJobListFilter(filter: IntegrationJobListFilter = {}): NormalizedIntegrationJobListFilter {
  return {
    ...filter,
    tenantId: normalizeTenantId(filter.tenantId),
    limit: Math.max(1, Math.min(filter.limit ?? 50, MAX_JOB_LIST_LIMIT)),
  };
}

export function redactSensitiveJobPayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => redactSensitiveJobPayload(item));
  if (!value || typeof value !== "object") return value;

  const redacted: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    redacted[key] = isSensitiveKey(key) ? "[REDACTED]" : redactSensitiveJobPayload(item);
  }
  return redacted;
}

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}
