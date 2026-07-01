export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonRecord = Record<string, any>;

export type HisSourceFormat =
  | "db_view"
  | "csv"
  | "hl7v2"
  | "rest_api"
  | "fhir_native"
  | "document";

export type PortabilityContext =
  | "treatment"
  | "cross_branch_referral"
  | "cross_border"
  | "e_claim"
  | "medical_tourist"
  | "emergency"
  | "self_share";

export type ConsentPurpose =
  | "treatment"
  | "referral"
  | "claim"
  | "insurance"
  | "public_health"
  | "research"
  | "emergency"
  | "medical_tourism";

export type TrustcareCredentialType =
  | "PatientIdentityCredential"
  | "ConsentReceiptCredential"
  | "PatientSummaryCredential"
  | "AllergyAlertCredential"
  | "MedicationSummaryCredential"
  | "ReferralCredential"
  | "CoverageEligibilityCredential"
  | "MedicalCertificateCredential"
  | "PrescriptionCredential"
  | "ClaimPackageCredential"
  | "SyncReceiptCredential";

export type DataQualitySeverity = "error" | "warning";

export interface DataQualityIssue {
  ruleId: string;
  severity: DataQualitySeverity;
  resourceType?: string;
  resourceId?: string;
  message: string;
}

export interface HisIngestionInput {
  sourceFormat: HisSourceFormat;
  payload: unknown;
  sourceSystem: string;
  sourceOrganizationId: string;
  sourceOrganizationName?: string;
  mapperVersion?: string;
  receivedAt?: string;
}

export interface CanonicalFhirResult {
  bundle: JsonRecord;
  patient: JsonRecord;
  clinicalResources: JsonRecord[];
  provenanceResources: JsonRecord[];
  issues: DataQualityIssue[];
  summary: {
    patientId: string;
    patientName: string;
    resourceCounts: Record<string, number>;
    bundleHash: string;
    generatedAt: string;
  };
}

export interface ConsentGrant {
  id: string;
  patientId: string;
  purpose: ConsentPurpose;
  requesterId: string;
  requesterRole: string;
  grantedToOrganizationId?: string;
  scopes: string[];
  status: "granted" | "revoked" | "expired";
  grantedAt: string;
  expiresAt?: string;
  vcCredentialId?: string;
}

export interface PolicyDecision {
  allowed: boolean;
  purpose: ConsentPurpose;
  requestedScopes: string[];
  grantedScopes: string[];
  minimizedScopes: string[];
  reasons: string[];
  requiresBreakGlass: boolean;
}

export interface IssuerProfile {
  id: string;
  name: string;
  did: string;
  country?: string;
  trustDomain?: string;
}

export interface IssuedVc {
  id: string;
  type: string;
  format: "jwt-vc" | "sd-jwt-vc";
  jwt: string;
  credential: JsonRecord;
  digest: string;
  expiresAt?: string;
  disclosureDigests?: Record<string, string>;
  alg?: string;
  kid?: string;
  keyMode?: "asymmetric" | "dev-hmac";
  statusListIndex?: string;
}

export interface PresentationPackage {
  id: string;
  format: "jwt-vp";
  jwt: string;
  holderDid: string;
  credentialIds: string[];
  purpose: ConsentPurpose;
  audience: string;
  expiresAt: string;
}

export interface ContextPacket {
  context: PortabilityContext;
  canonicalSummary: CanonicalFhirResult["summary"];
  shlManifest: JsonRecord;
  outboundCredentials: IssuedVc[];
  presentation: PresentationPackage;
  auditEvent: JsonRecord;
  policyDecision: PolicyDecision;
}

export type SyncTargetKind = "fhir_rest" | "hl7v2" | "db_view" | "rest_api" | "csv_batch" | "manual_queue";
export type SyncOperationType = "create" | "update" | "upsert" | "append" | "revoke";
export type SyncWriteMode = "system_of_record" | "system_of_reference" | "mirror_only";

export interface LegacySyncTarget {
  id: string;
  name: string;
  kind: SyncTargetKind;
  writeMode: SyncWriteMode;
  supportedResources: string[];
  supportsTransactions: boolean;
  supportsVersionCheck: boolean;
  idempotencyStrategy: "business_key" | "source_event_id" | "content_hash";
}

export interface SyncBackRequest {
  target: LegacySyncTarget;
  operation: SyncOperationType;
  resource: JsonRecord;
  sourceEventId: string;
  patientBusinessKey: string;
  expectedVersion?: string;
  reason: string;
  actorId: string;
  occurredAt?: string;
}

export interface SyncBackPlan {
  id: string;
  targetId: string;
  targetKind: SyncTargetKind;
  operation: SyncOperationType;
  idempotencyKey: string;
  consistencyKey: string;
  outboundPayload: JsonRecord;
  preconditions: JsonRecord[];
  rollbackHint?: string;
  status: "ready" | "manual_review_required" | "blocked";
  issues: DataQualityIssue[];
}

export interface SyncBackExecutionResult {
  id: string;
  planId: string;
  targetId: string;
  targetKind: SyncTargetKind;
  accepted: boolean;
  status: "accepted" | "rejected" | "queued_for_review";
  ackCode: string;
  targetVersion?: string;
  targetReference?: string;
  message: string;
  executedAt: string;
  actorId: string;
  readBack?: JsonRecord;
  consistency: {
    idempotencyKey: string;
    consistencyKey: string;
    targetChecksum?: string;
    matched: boolean;
  };
  reconciliation?: SyncReconciliationJob;
}

export interface SyncBackExecutionOptions {
  actorId: string;
  accepted?: boolean;
  targetVersion?: string;
  targetReference?: string;
  message?: string;
  allowManualReview?: boolean;
  executedAt?: string;
}

export interface SyncReconciliationJob {
  id: string;
  planId: string;
  executionId: string;
  targetId: string;
  targetKind: SyncTargetKind;
  status: "not_required" | "scheduled" | "manual_review" | "failed";
  reason: string;
  runMode: "read_back" | "ack_replay" | "manual_review";
  dueAt?: string;
  checks: JsonRecord[];
  attempts: number;
}

export type TrustRegistryVerificationMode = "off" | "advisory" | "required";

export interface TrustRegistryVerificationPolicy {
  mode: TrustRegistryVerificationMode;
  trustedIssuers: string[];
  issuerJwks: Record<string, JsonRecord[]>;
  kidJwks: Record<string, JsonRecord>;
  revokedCredentialIds: string[];
  revokedStatusIndexes: string[];
  allowedCredentialTypes?: TrustcareCredentialType[];
}
