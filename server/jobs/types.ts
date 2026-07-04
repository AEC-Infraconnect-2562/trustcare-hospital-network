export const INTEGRATION_JOB_TYPES = [
  "import.source_payload",
  "mapping.canonicalize_fhir",
  "dqi.evaluate",
  "document.create_reference",
  "maker_checker.route_review",
  "vc.issue",
  "vp.build",
  "shl.build_packet",
  "sync_back.plan",
  "sync_back.execute",
  "reconciliation.run",
  "adapter.health_check",
  "noop",
] as const;

export type IntegrationJobType = (typeof INTEGRATION_JOB_TYPES)[number];

export const INTEGRATION_SOURCE_TYPES = [
  "his_db_view",
  "hl7v2",
  "csv",
  "fhir_native",
  "patient_upload",
  "document_metadata",
  "smart_health_link",
  "native_vc_vp",
  "sync_back",
  "adapter_health",
  "manual",
] as const;

export type IntegrationSourceType = (typeof INTEGRATION_SOURCE_TYPES)[number];

export const SERVICE_READINESS_CONTEXTS = [
  "opd_visit",
  "emergency",
  "referral",
  "cross_border",
  "medical_tourist",
  "insurance_claim",
  "pharmacy_dispense",
] as const;

export type ServiceReadinessContext = (typeof SERVICE_READINESS_CONTEXTS)[number];

export const INTEGRATION_JOB_STATUSES = [
  "queued",
  "claimed",
  "running",
  "succeeded",
  "failed",
  "needs_review",
  "dead_lettered",
  "cancelled",
] as const;

export type IntegrationJobStatus = (typeof INTEGRATION_JOB_STATUSES)[number];

export type IntegrationJobPriority = "low" | "normal" | "high" | "urgent";

export type IntegrationJobEventLevel = "info" | "warning" | "error" | "debug";

export interface IntegrationJobCreateInput {
  jobType: IntegrationJobType;
  sourceType: IntegrationSourceType;
  tenantId?: string;
  hospitalId?: number;
  patientId?: number;
  adapterId?: number;
  context?: ServiceReadinessContext;
  contractId?: string;
  contractVersion?: string;
  correlationId?: string;
  idempotencyKey?: string;
  sourceRef?: string;
  priority?: IntegrationJobPriority;
  payload?: unknown;
  createdBy?: number;
  availableAt?: Date;
  maxAttempts?: number;
}

export interface QueuedIntegrationJobRecord {
  jobId: string;
  tenantId: string;
  jobType: IntegrationJobType;
  sourceType: IntegrationSourceType;
  status: IntegrationJobStatus;
  priority: IntegrationJobPriority;
  correlationId: string;
  idempotencyKey: string;
  hospitalId?: number;
  patientId?: number;
  adapterId?: number;
  context?: ServiceReadinessContext;
  contractId?: string;
  contractVersion?: string;
  payloadHash?: string;
  payload?: unknown;
  createdBy?: number;
  attempts: number;
  maxAttempts: number;
  availableAt: Date;
}

export interface IntegrationJobListFilter {
  tenantId?: string;
  hospitalId?: number;
  patientId?: number;
  context?: ServiceReadinessContext;
  status?: IntegrationJobStatus;
  correlationId?: string;
  limit?: number;
}

export interface NormalizedIntegrationJobListFilter extends IntegrationJobListFilter {
  tenantId: string;
  limit: number;
}
