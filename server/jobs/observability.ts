import { buildCorrelationId, isSensitiveKey, redactSensitiveJobPayload } from "./dbQueue";
import type { IntegrationJobEventLevel, IntegrationJobStatus } from "./types";

export const FABRIC_TRACE_STAGES = [
  "job_creation",
  "import",
  "mapping",
  "document_reference",
  "vc_issuance",
  "vp_shl_packet",
  "shl_access",
  "sync_back",
  "reconciliation",
  "adapter_health",
] as const;

export type FabricTraceStage = (typeof FABRIC_TRACE_STAGES)[number];

export interface FabricTraceContextInput {
  stage: FabricTraceStage;
  correlationId?: string;
  jobId?: string;
  hospitalId?: number;
  patientId?: number;
  adapterId?: number;
  context?: string;
  contractId?: string;
  contractVersion?: string;
  credentialId?: string;
  presentationId?: string;
  shlId?: string;
  manifestToken?: string;
  syncId?: string;
  reconciliationId?: string;
  metadata?: unknown;
}

export interface FabricTraceContext {
  stage: FabricTraceStage;
  correlationId: string;
  jobId?: string;
  hospitalId?: number;
  patientId?: number;
  adapterId?: number;
  context?: string;
  contractId?: string;
  contractVersion?: string;
  credentialId?: string;
  presentationId?: string;
  shlId?: string;
  manifestToken?: string;
  syncId?: string;
  reconciliationId?: string;
  metadata?: unknown;
}

export interface FabricTraceEventLike {
  correlationId?: string | null;
  jobId?: string | null;
  eventType?: string | null;
  level?: IntegrationJobEventLevel | string | null;
  status?: IntegrationJobStatus | string | null;
  message?: string | null;
  metadata?: unknown;
  createdAt?: Date | string | null;
}

export interface FabricTroubleshootingIndex {
  correlationId: string;
  eventCount: number;
  stagesPresent: FabricTraceStage[];
  latestStatus?: string;
  levelCounts: Record<string, number>;
  rootCauseHints: string[];
  sensitiveFindings: SensitiveMetadataFinding[];
}

export interface SensitiveMetadataFinding {
  path: string;
  key: string;
}

export function buildFabricTraceContext(input: FabricTraceContextInput): FabricTraceContext {
  return stripUndefined({
    stage: input.stage,
    correlationId: buildCorrelationId(input.correlationId),
    jobId: input.jobId,
    hospitalId: input.hospitalId,
    patientId: input.patientId,
    adapterId: input.adapterId,
    context: input.context,
    contractId: input.contractId,
    contractVersion: input.contractVersion,
    credentialId: input.credentialId,
    presentationId: input.presentationId,
    shlId: input.shlId,
    manifestToken: input.manifestToken,
    syncId: input.syncId,
    reconciliationId: input.reconciliationId,
    metadata: input.metadata === undefined ? undefined : redactSensitiveJobPayload(input.metadata),
  });
}

export function buildFabricTroubleshootingIndex(
  correlationId: string,
  events: FabricTraceEventLike[],
): FabricTroubleshootingIndex {
  const normalizedCorrelationId = buildCorrelationId(correlationId);
  const matching = events.filter((event) => event.correlationId === normalizedCorrelationId || !event.correlationId);
  const levelCounts = matching.reduce<Record<string, number>>((acc, event) => {
    const level = String(event.level ?? "unknown");
    acc[level] = (acc[level] ?? 0) + 1;
    return acc;
  }, {});
  const stagesPresent = uniqueStages(matching.map((event) => inferFabricTraceStage(event)));
  const sensitiveFindings = matching.flatMap((event, index) => findSensitiveMetadata(event.metadata, `events[${index}].metadata`));
  return {
    correlationId: normalizedCorrelationId,
    eventCount: matching.length,
    stagesPresent,
    latestStatus: matching.at(-1)?.status ? String(matching.at(-1)?.status) : undefined,
    levelCounts,
    rootCauseHints: buildRootCauseHints(matching),
    sensitiveFindings,
  };
}

export function findSensitiveMetadata(value: unknown, path = "metadata"): SensitiveMetadataFinding[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findSensitiveMetadata(item, `${path}[${index}]`));
  }
  if (!value || typeof value !== "object") return [];

  const findings: SensitiveMetadataFinding[] = [];
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    const itemPath = `${path}.${key}`;
    if (isSensitiveKey(key) && item !== "[REDACTED]" && item !== undefined && item !== null) {
      findings.push({ path: itemPath, key });
    }
    findings.push(...findSensitiveMetadata(item, itemPath));
  }
  return findings;
}

export function inferFabricTraceStage(event: FabricTraceEventLike): FabricTraceStage | undefined {
  const eventType = String(event.eventType ?? "");
  const metadata = event.metadata && typeof event.metadata === "object" ? event.metadata as Record<string, unknown> : {};
  const jobType = String(metadata.jobType ?? "");
  if (eventType === "job_queued" || eventType === "job_reused" || eventType === "job_started") return "job_creation";
  if (eventType.includes("adapter_health") || jobType === "adapter.health_check") return "adapter_health";
  if (eventType.includes("reconciliation") || jobType === "reconciliation.run") return "reconciliation";
  if (eventType.includes("sync_back") || jobType.startsWith("sync_back.")) return "sync_back";
  if (eventType.includes("packet") || jobType === "vp.build" || jobType === "shl.build_packet") return "vp_shl_packet";
  if (eventType.includes("shl")) return "shl_access";
  if (eventType.includes("vc_issuance") || jobType === "vc.issue") return "vc_issuance";
  if (eventType.includes("document_reference") || jobType === "document.create_reference") return "document_reference";
  if (eventType.includes("mapping") || eventType.includes("dqi") || jobType === "mapping.canonicalize_fhir") return "mapping";
  if (eventType.includes("import") || eventType.includes("source_payload") || jobType === "import.source_payload") return "import";
  return undefined;
}

function buildRootCauseHints(events: FabricTraceEventLike[]): string[] {
  const hints = new Set<string>();
  for (const event of events) {
    const eventType = String(event.eventType ?? "");
    const status = String(event.status ?? "");
    const metadata = event.metadata && typeof event.metadata === "object" ? event.metadata as Record<string, unknown> : {};
    if (eventType === "handler_missing") hints.add("Register the missing worker handler before retrying the job.");
    if (eventType.includes("adapter_health_down") || metadata.canAcceptJobs === false) hints.add("Check adapter health, backpressure, circuit breaker, and mapping version.");
    if (eventType.includes("reconciliation_needs_review")) hints.add("Run reconciliation checks and compare source/target consistency keys.");
    if (eventType.includes("sync_back_needs_review")) hints.add("Inspect the sync-back target response and route manual review if the adapter rejected the payload.");
    if (eventType.includes("shl") && (event.level === "error" || status === "failed")) hints.add("Check SHL access state, passcode lockout, manifest hash, and object reference availability.");
    if (status === "dead_lettered" || eventType === "job_dead_lettered") hints.add("Inspect the dead-letter event, fix the input or adapter, then create a new idempotent job.");
  }
  return Array.from(hints);
}

function uniqueStages(stages: Array<FabricTraceStage | undefined>): FabricTraceStage[] {
  const set = new Set<FabricTraceStage>();
  for (const stage of stages) {
    if (stage) set.add(stage);
  }
  return FABRIC_TRACE_STAGES.filter((stage) => set.has(stage));
}

function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => stripUndefined(item)).filter((item) => item !== undefined) as T;
  if (!value || typeof value !== "object") return value;
  const cleaned: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    const next = stripUndefined(item);
    if (next !== undefined) cleaned[key] = next;
  }
  return cleaned as T;
}
