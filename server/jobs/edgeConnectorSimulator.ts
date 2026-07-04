import * as db from "../db";
import type { JsonRecord } from "../portability/types";
import { stripUndefined } from "../portability/utils";
import type { IntegrationJobHandler, IntegrationJobHandlerRegistry } from "./runtime";

export type EdgeConnectorHealthStatus = "healthy" | "degraded" | "down";
export type EdgeConnectorBackpressureState = "accepting" | "throttled" | "saturated";
export type EdgeConnectorCircuitState = "closed" | "half_open" | "open";

export interface EdgeConnectorAdapterInput {
  id?: number;
  hospitalId?: number;
  name?: string | null;
  status?: string | null;
  healthStatus?: string | null;
  systemType?: string | null;
  connectorPattern?: string | null;
  connectionConfig?: unknown;
  mappingVersionId?: number | null;
}

export interface EdgeConnectorRuntimeResult {
  adapterId?: number;
  hospitalId?: number;
  adapterName?: string;
  connectorPattern: string;
  healthStatus: EdgeConnectorHealthStatus;
  healthy: boolean;
  canAcceptJobs: boolean;
  jobAction: "accept_jobs" | "pause_new_jobs" | "retry_later";
  responseTimeMs: number;
  errorMessage?: string;
  evaluatedAt: string;
  evaluationSource: "edge_connector_simulator";
  capability: EdgeConnectorCapabilityProfile;
  backpressure: EdgeConnectorBackpressure;
  circuitBreaker: EdgeConnectorCircuitBreaker;
  localBuffer: EdgeConnectorLocalBuffer;
  capacityScope: {
    scope: "adapter";
    hospitalId?: number;
    adapterId?: number;
    key: string;
  };
  issues: EdgeConnectorIssue[];
}

export interface EdgeConnectorCapabilityProfile {
  systemType: string;
  connectorPattern: string;
  sourceTypes: string[];
  targetKinds: string[];
  supportsInbound: boolean;
  supportsOutbound: boolean;
  supportsBatch: boolean;
  supportsHealthCheck: boolean;
  maxConcurrency: number;
  throttlePerMinute: number;
  mappingVersionId?: number;
  contract: {
    runtime: "trustcare-edge-connector-simulator";
    version: "1.0.0";
    requiresIdempotencyKey: true;
    requiresCorrelationId: true;
  };
}

export interface EdgeConnectorBackpressure {
  state: EdgeConnectorBackpressureState;
  activeJobs: number;
  queuedJobs: number;
  maxConcurrency: number;
  utilization: number;
  throttlePerMinute: number;
  retryAfterSeconds?: number;
  policy: "adapter_scoped_backpressure";
}

export interface EdgeConnectorCircuitBreaker {
  state: EdgeConnectorCircuitState;
  failureCount: number;
  failureThreshold: number;
  reason?: string;
  openedAt?: string;
  nextAttemptAt?: string;
}

export interface EdgeConnectorLocalBuffer {
  mode: "simulated_metadata_only";
  depth: number;
  limit: number;
  utilization: number;
  durable: boolean;
}

export interface EdgeConnectorIssue {
  code: string;
  severity: "warning" | "error";
  message: string;
}

export interface EdgeConnectorSimulatorOptions {
  persistHealth?: boolean;
  now?: () => Date;
  getAdapterById?: (adapterId: number) => Promise<EdgeConnectorAdapterInput | undefined>;
  recordHealth?: (adapterId: number, result: EdgeConnectorRuntimeResult) => Promise<void>;
}

export function registerEdgeConnectorSimulatorHandlers(
  registry: IntegrationJobHandlerRegistry,
  options: EdgeConnectorSimulatorOptions = {},
): void {
  registry.register("adapter.health_check", buildEdgeConnectorHealthCheckHandler(options));
}

export function buildEdgeConnectorHealthCheckHandler(options: EdgeConnectorSimulatorOptions = {}): IntegrationJobHandler {
  return async ({ job, emitEvent }) => {
    const adapter = await resolveAdapterForHealthCheck(job.payload, job.adapterId, options);
    if (!adapter) {
      emitEvent({
        eventType: "adapter_health_adapter_missing",
        level: "warning",
        status: "needs_review",
        message: "Adapter health check requires adapter metadata or adapterId",
        metadata: { adapterId: job.adapterId },
      });
      return {
        status: "needs_review",
        result: {
          status: "needs_review",
          adapterId: job.adapterId,
          issue: "adapter_missing",
        },
      };
    }

    const result = evaluateEdgeConnectorRuntime(adapter, { now: options.now });
    if (options.persistHealth !== false && result.adapterId) {
      await recordAdapterHealth(result.adapterId, result, options);
    }

    emitEvent({
      eventType: result.healthStatus === "healthy" ? "adapter_health_healthy" : `adapter_health_${result.healthStatus}`,
      level: result.healthStatus === "healthy" ? "info" : "warning",
      status: result.healthStatus === "healthy" ? "running" : "needs_review",
      message: result.healthStatus === "healthy"
        ? "Adapter is healthy and accepting scoped work"
        : "Adapter health check requires operator attention",
      metadata: {
        adapterId: result.adapterId,
        hospitalId: result.hospitalId,
        healthStatus: result.healthStatus,
        backpressureState: result.backpressure.state,
        circuitState: result.circuitBreaker.state,
        canAcceptJobs: result.canAcceptJobs,
        jobAction: result.jobAction,
        capacityScope: result.capacityScope,
      },
    });

    return {
      status: result.healthStatus === "healthy" ? "succeeded" : "needs_review",
      result,
      metadata: {
        adapterId: result.adapterId,
        healthStatus: result.healthStatus,
        canAcceptJobs: result.canAcceptJobs,
      },
    };
  };
}

export function evaluateEdgeConnectorRuntime(
  adapter: EdgeConnectorAdapterInput,
  options: Pick<EdgeConnectorSimulatorOptions, "now"> = {},
): EdgeConnectorRuntimeResult {
  const now = options.now?.() ?? new Date();
  const config = asRecord(adapter.connectionConfig);
  const runtime = asRecord(config.runtime ?? config.simulator ?? config.edgeConnector);
  const status = optionalString(adapter.status) ?? "testing";
  const connectorPattern = optionalString(adapter.connectorPattern) ?? "api_rest";
  const systemType = optionalString(adapter.systemType) ?? "his";
  const targetConfigured = hasAdapterConnectionTarget(connectorPattern, config);
  const capability = buildCapabilityProfile({
    systemType,
    connectorPattern,
    mappingVersionId: adapter.mappingVersionId ?? undefined,
    config,
    runtime,
  });
  const localBuffer = buildLocalBuffer(runtime);
  const backpressure = buildBackpressure(runtime, capability, localBuffer);
  const circuitBreaker = buildCircuitBreaker(runtime, status, now);
  const responseTimeMs = numberValue(runtime.responseTimeMs ?? config.responseTimeMs)
    ?? 50 + stableModulo(`${adapter.id ?? 0}:${adapter.name ?? ""}:${connectorPattern}`, 450);
  const forcedHealth = parseHealthStatus(runtime.healthStatus ?? runtime.status ?? config.simulatedHealthStatus ?? config.simulatedHealth);
  const issues = buildHealthIssues({
    status,
    targetConfigured,
    backpressure,
    circuitBreaker,
    forcedHealth,
  });
  const healthStatus = forcedHealth ?? deriveHealthStatus(status, targetConfigured, backpressure, circuitBreaker);
  const canAcceptJobs = healthStatus !== "down"
    && status === "active"
    && targetConfigured
    && circuitBreaker.state !== "open"
    && backpressure.state === "accepting";
  const jobAction = canAcceptJobs
    ? "accept_jobs"
    : healthStatus === "down" || circuitBreaker.state === "open"
      ? "retry_later"
      : "pause_new_jobs";
  const errorMessage = issues.length ? issues.map((issue) => issue.message).join(" ") : undefined;

  return stripUndefined({
    adapterId: adapter.id,
    hospitalId: adapter.hospitalId,
    adapterName: optionalString(adapter.name),
    connectorPattern,
    healthStatus,
    healthy: healthStatus === "healthy",
    canAcceptJobs,
    jobAction,
    responseTimeMs,
    errorMessage,
    evaluatedAt: now.toISOString(),
    evaluationSource: "edge_connector_simulator",
    capability,
    backpressure,
    circuitBreaker,
    localBuffer,
    capacityScope: {
      scope: "adapter",
      hospitalId: adapter.hospitalId,
      adapterId: adapter.id,
      key: adapter.id ? `hospital:${adapter.hospitalId ?? "unknown"}:adapter:${adapter.id}` : "adapter:unpersisted",
    },
    issues,
  });
}

async function resolveAdapterForHealthCheck(
  payload: unknown,
  adapterId: number | undefined,
  options: EdgeConnectorSimulatorOptions,
): Promise<EdgeConnectorAdapterInput | undefined> {
  const record = asRecord(payload);
  const embedded = asRecord(record.adapter);
  if (Object.keys(embedded).length > 0) {
    return {
      ...embedded,
      id: numberValue(embedded.id) ?? adapterId,
      hospitalId: numberValue(embedded.hospitalId),
    };
  }

  if (record.connectorPattern || record.connectionConfig || record.runtime || record.simulator) {
    return {
      id: adapterId ?? numberValue(record.adapterId),
      hospitalId: numberValue(record.hospitalId),
      name: optionalString(record.name),
      status: optionalString(record.status),
      systemType: optionalString(record.systemType),
      connectorPattern: optionalString(record.connectorPattern),
      connectionConfig: record.connectionConfig ?? record,
      mappingVersionId: numberValue(record.mappingVersionId),
    };
  }

  if (!adapterId) return undefined;
  return options.getAdapterById ? options.getAdapterById(adapterId) : db.getIntegrationAdapterById(adapterId) as any;
}

async function recordAdapterHealth(
  adapterId: number,
  result: EdgeConnectorRuntimeResult,
  options: EdgeConnectorSimulatorOptions,
): Promise<void> {
  if (options.recordHealth) {
    await options.recordHealth(adapterId, result);
    return;
  }
  await db.createAdapterHealthLog({
    adapterId,
    status: result.healthStatus,
    responseTimeMs: result.responseTimeMs,
    errorMessage: result.errorMessage,
  });
  await db.updateIntegrationAdapter(adapterId, {
    healthStatus: result.healthStatus,
    lastHealthCheck: new Date(result.evaluatedAt),
  } as any);
}

function buildCapabilityProfile(input: {
  systemType: string;
  connectorPattern: string;
  mappingVersionId?: number;
  config: JsonRecord;
  runtime: JsonRecord;
}): EdgeConnectorCapabilityProfile {
  const sourceTypes = sourceTypesForPattern(input.connectorPattern);
  const targetKinds = targetKindsForPattern(input.connectorPattern);
  const maxConcurrency = positiveInt(input.runtime.maxConcurrency ?? input.config.maxConcurrency, defaultMaxConcurrency(input.connectorPattern));
  const throttlePerMinute = positiveInt(input.runtime.throttlePerMinute ?? input.config.throttlePerMinute, defaultThrottle(input.connectorPattern));
  return stripUndefined({
    systemType: input.systemType,
    connectorPattern: input.connectorPattern,
    sourceTypes,
    targetKinds,
    supportsInbound: sourceTypes.length > 0,
    supportsOutbound: targetKinds.length > 0,
    supportsBatch: ["batch_file", "db_view", "cdc"].includes(input.connectorPattern),
    supportsHealthCheck: true,
    maxConcurrency,
    throttlePerMinute,
    mappingVersionId: input.mappingVersionId,
    contract: {
      runtime: "trustcare-edge-connector-simulator",
      version: "1.0.0",
      requiresIdempotencyKey: true,
      requiresCorrelationId: true,
    },
  });
}

function buildLocalBuffer(runtime: JsonRecord): EdgeConnectorLocalBuffer {
  const depth = nonNegativeInt(runtime.localBufferDepth ?? runtime.bufferDepth, 0);
  const limit = positiveInt(runtime.localBufferLimit ?? runtime.bufferLimit, 100);
  return {
    mode: "simulated_metadata_only",
    depth,
    limit,
    utilization: roundRatio(depth / limit),
    durable: runtime.localBufferDurable !== false,
  };
}

function buildBackpressure(
  runtime: JsonRecord,
  capability: EdgeConnectorCapabilityProfile,
  localBuffer: EdgeConnectorLocalBuffer,
): EdgeConnectorBackpressure {
  const activeJobs = nonNegativeInt(runtime.activeJobs ?? runtime.currentConcurrency, 0);
  const queuedJobs = nonNegativeInt(runtime.queuedJobs ?? runtime.queueDepth, 0);
  const utilization = roundRatio(activeJobs / capability.maxConcurrency);
  const saturated = activeJobs >= capability.maxConcurrency || localBuffer.utilization >= 0.95;
  const throttled = saturated
    || utilization >= 0.8
    || localBuffer.utilization >= 0.75
    || queuedJobs >= capability.maxConcurrency * 3
    || capability.throttlePerMinute === 0;
  const state: EdgeConnectorBackpressureState = saturated ? "saturated" : throttled ? "throttled" : "accepting";
  return stripUndefined({
    state,
    activeJobs,
    queuedJobs,
    maxConcurrency: capability.maxConcurrency,
    utilization,
    throttlePerMinute: capability.throttlePerMinute,
    retryAfterSeconds: state === "accepting" ? undefined : Math.min(300, Math.max(10, queuedJobs * 5 || 30)),
    policy: "adapter_scoped_backpressure",
  });
}

function buildCircuitBreaker(runtime: JsonRecord, adapterStatus: string, now: Date): EdgeConnectorCircuitBreaker {
  const rawCircuit = asRecord(runtime.circuitBreaker);
  const failureCount = nonNegativeInt(rawCircuit.failureCount ?? runtime.failureCount, adapterStatus === "error" ? 5 : 0);
  const failureThreshold = positiveInt(rawCircuit.failureThreshold ?? runtime.failureThreshold, 5);
  const explicitState = parseCircuitState(rawCircuit.state ?? runtime.circuitState);
  const state = explicitState
    ?? (adapterStatus === "error" || failureCount >= failureThreshold ? "open" : failureCount > 0 ? "half_open" : "closed");
  const resetAfterMs = positiveNumber(rawCircuit.resetAfterMs ?? runtime.resetAfterMs);
  return stripUndefined({
    state,
    failureCount,
    failureThreshold,
    reason: optionalString(rawCircuit.reason ?? runtime.circuitReason) ?? (state === "open" ? "adapter_error_threshold" : undefined),
    openedAt: optionalString(rawCircuit.openedAt ?? runtime.circuitOpenedAt),
    nextAttemptAt: state === "open" && resetAfterMs
      ? new Date(now.getTime() + resetAfterMs).toISOString()
      : undefined,
  });
}

function buildHealthIssues(input: {
  status: string;
  targetConfigured: boolean;
  backpressure: EdgeConnectorBackpressure;
  circuitBreaker: EdgeConnectorCircuitBreaker;
  forcedHealth?: EdgeConnectorHealthStatus;
}): EdgeConnectorIssue[] {
  const issues: EdgeConnectorIssue[] = [];
  if (input.status !== "active") {
    issues.push({
      code: "ADAPTER_NOT_ACTIVE",
      severity: input.status === "testing" ? "warning" : "error",
      message: `Adapter status is ${input.status}; activate adapter before accepting jobs.`,
    });
  }
  if (!input.targetConfigured) {
    issues.push({
      code: "ADAPTER_TARGET_MISSING",
      severity: "warning",
      message: "Adapter connection target is incomplete.",
    });
  }
  if (input.backpressure.state !== "accepting") {
    issues.push({
      code: "ADAPTER_BACKPRESSURE",
      severity: input.backpressure.state === "saturated" ? "error" : "warning",
      message: `Adapter backpressure is ${input.backpressure.state}; keep pressure scoped to this adapter.`,
    });
  }
  if (input.circuitBreaker.state === "open") {
    issues.push({
      code: "ADAPTER_CIRCUIT_OPEN",
      severity: "error",
      message: "Adapter circuit breaker is open; retry after the connector recovers.",
    });
  }
  if (input.forcedHealth && input.forcedHealth !== "healthy") {
    issues.push({
      code: "ADAPTER_SIMULATED_HEALTH",
      severity: input.forcedHealth === "down" ? "error" : "warning",
      message: `Adapter simulator forced health status ${input.forcedHealth}.`,
    });
  }
  return issues;
}

function deriveHealthStatus(
  status: string,
  targetConfigured: boolean,
  backpressure: EdgeConnectorBackpressure,
  circuitBreaker: EdgeConnectorCircuitBreaker,
): EdgeConnectorHealthStatus {
  if (status === "error" || status === "inactive" || circuitBreaker.state === "open") return "down";
  if (status !== "active" || !targetConfigured || backpressure.state !== "accepting" || circuitBreaker.state === "half_open") {
    return "degraded";
  }
  return "healthy";
}

function hasAdapterConnectionTarget(pattern: string, config: JsonRecord): boolean {
  const acceptedKeys = [
    "endpoint", "baseUrl", "url", "dsn", "connectionString", "host", "databaseUrl",
    "viewName", "tableName", "fileDropPath", "directory", "topic", "queueName",
  ];
  const hasTarget = acceptedKeys.some((key) => {
    const value = config[key];
    return typeof value === "string" ? value.trim().length > 0 : Boolean(value);
  });
  if (hasTarget) return true;
  return ["portal_adapter", "batch_file"].includes(pattern) && config.enabled === true;
}

function sourceTypesForPattern(pattern: string): string[] {
  switch (pattern) {
    case "hl7v2": return ["hl7v2"];
    case "db_view": return ["his_db_view"];
    case "cdc": return ["his_db_view"];
    case "batch_file": return ["csv", "document_metadata"];
    case "dicomweb": return ["document_metadata"];
    case "portal_adapter": return ["manual"];
    case "api_rest":
    case "api_graphql":
      return ["fhir_native"];
    default:
      return ["manual"];
  }
}

function targetKindsForPattern(pattern: string): string[] {
  switch (pattern) {
    case "hl7v2": return ["hl7v2"];
    case "db_view":
    case "cdc":
      return ["db_view"];
    case "batch_file": return ["csv_batch"];
    case "portal_adapter": return ["manual_queue"];
    case "api_rest":
    case "api_graphql":
    case "dicomweb":
      return ["fhir_rest", "rest_api"];
    default:
      return ["manual_queue"];
  }
}

function defaultMaxConcurrency(pattern: string): number {
  if (pattern === "hl7v2") return 2;
  if (pattern === "batch_file" || pattern === "portal_adapter") return 1;
  if (pattern === "db_view" || pattern === "cdc") return 3;
  return 5;
}

function defaultThrottle(pattern: string): number {
  if (pattern === "portal_adapter") return 6;
  if (pattern === "batch_file") return 12;
  if (pattern === "hl7v2") return 30;
  return 60;
}

function parseHealthStatus(value: unknown): EdgeConnectorHealthStatus | undefined {
  const normalized = optionalString(value);
  return normalized === "healthy" || normalized === "degraded" || normalized === "down" ? normalized : undefined;
}

function parseCircuitState(value: unknown): EdgeConnectorCircuitState | undefined {
  const normalized = optionalString(value);
  return normalized === "closed" || normalized === "half_open" || normalized === "open" ? normalized : undefined;
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

function positiveNumber(value: unknown): number | undefined {
  const parsed = numberValue(value);
  return parsed && parsed > 0 ? parsed : undefined;
}

function positiveInt(value: unknown, fallback: number): number {
  const parsed = numberValue(value);
  return parsed && parsed > 0 ? Math.floor(parsed) : fallback;
}

function nonNegativeInt(value: unknown, fallback: number): number {
  const parsed = numberValue(value);
  return parsed !== undefined && parsed >= 0 ? Math.floor(parsed) : fallback;
}

function roundRatio(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(Math.max(0, value) * 100) / 100;
}

function stableModulo(text: string, modulo: number): number {
  let value = 0;
  for (const char of text) {
    value = (value * 31 + char.charCodeAt(0)) % modulo;
  }
  return value;
}
