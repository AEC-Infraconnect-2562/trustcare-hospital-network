import {
  canActAsCredentialChecker,
  canActAsCredentialMaker,
  canHoldIssuerPrivileges,
  normalizeCredentialEntitlements,
  sanitizeAdditionalRolesForSystemRole,
  type CredentialEntitlements,
} from "../../shared/rolePolicy";
import { sha256 } from "../portability/utils";
import type { DataQualityIssue, JsonRecord } from "../portability/types";
import type { IntegrationJobHandler, IntegrationJobHandlerRegistry } from "./runtime";

export const VC_ISSUANCE_CREDENTIAL_TYPES = [
  "patient_identity",
  "consent_receipt",
  "patient_summary",
  "allergy_alert",
  "medication_summary",
  "referral_vc",
  "immunization",
  "medical_certificate",
  "prescription",
  "lab_result",
  "diagnostic_report",
  "discharge_summary",
  "insurance_eligibility",
  "claim_package",
  "claim_receipt",
  "travel_document_verification",
  "shl_manifest",
  "pharmacy_dispense",
  "appointment",
  "visa_support_letter",
  "quotation",
  "guarantee_letter",
  "mpi_link_certificate",
  "sync_receipt",
] as const;

export type VcIssuanceCredentialType = (typeof VC_ISSUANCE_CREDENTIAL_TYPES)[number];
export type VcIssuanceRoute = "auto_ready_for_checker" | "maker_review_required" | "blocked";

export interface VcIssuanceActor {
  id?: number;
  systemRole?: string;
  additionalRoles?: string[];
  credentialEntitlements?: CredentialEntitlements | null;
}

interface NormalizedVcIssuanceActor {
  id?: number;
  systemRole: string;
  additionalRoles: string[];
  credentialEntitlements: CredentialEntitlements;
}

export interface VcIssuanceRoutingResult {
  status: "ready" | "needs_review";
  route: VcIssuanceRoute;
  credentialType?: VcIssuanceCredentialType;
  requestDraft?: JsonRecord;
  makerChecker: JsonRecord;
  trustedSourcePolicy: JsonRecord;
  dqiSummary?: JsonRecord;
  operationOutcome: JsonRecord;
  auditEvents: JsonRecord[];
  issues: DataQualityIssue[];
}

export interface VcIssuanceRoutingOptions {
  minDqiScore?: number;
  now?: () => Date;
}

const DEFAULT_MIN_DQI_SCORE = 85;

export function registerVcIssuanceHandler(registry: IntegrationJobHandlerRegistry, options: VcIssuanceRoutingOptions = {}): void {
  registry.register("vc.issue", buildVcIssuanceHandler(options));
}

export function buildVcIssuanceHandler(options: VcIssuanceRoutingOptions = {}): IntegrationJobHandler {
  return ({ job, emitEvent }) => {
    const result = routeVcIssuanceRequest(job.payload, {
      ...options,
      now: options.now,
    });

    emitEvent({
      eventType: result.status === "ready" ? "vc_issuance_route_ready" : "vc_issuance_route_needs_review",
      level: result.status === "ready" ? "info" : "warning",
      status: result.status === "ready" ? "running" : "needs_review",
      message: result.status === "ready" ? "VC request is ready for Checker review" : "VC request requires Maker review",
      metadata: {
        route: result.route,
        credentialType: result.credentialType,
        issueCount: result.issues.length,
        auditEventCount: result.auditEvents.length,
        checkerReviewRequired: result.makerChecker.requiredBeforeIssue,
      },
    });

    return {
      status: result.status === "ready" ? "succeeded" : "needs_review",
      result,
      metadata: {
        route: result.route,
        credentialType: result.credentialType,
      },
    };
  };
}

export function routeVcIssuanceRequest(payload: unknown, options: VcIssuanceRoutingOptions = {}): VcIssuanceRoutingResult {
  const record = asRecord(payload);
  const minDqiScore = options.minDqiScore ?? Number(asRecord(record.trustedSourcePolicy).minDqiScore ?? DEFAULT_MIN_DQI_SCORE);
  const actor = normalizeActor(asRecord(record.actor ?? record.requestedBy));
  const credentialType = inferCredentialType(record);
  const trustedSourcePolicy = normalizeTrustedSourcePolicy(record, minDqiScore);
  const dqiSummary = extractDqiSummary(record);
  const sourceReady = extractSourceReady(record);
  const issues: DataQualityIssue[] = [];

  if (!credentialType) {
    issues.push(issue("VC-ROUTE-001", "error", "Credential type is missing or unsupported by the existing enum."));
  }
  if (!sourceReady) {
    issues.push(issue("VC-ROUTE-002", "error", "Source artifact is not ready for credential issuance routing."));
  }
  if (dqiSummary && Number(dqiSummary.overall ?? 0) < minDqiScore) {
    issues.push(issue("VC-ROUTE-003", "warning", "DQI score is below trusted-source threshold."));
  }
  if (!trustedSourcePolicy.trusted) {
    issues.push(issue("VC-ROUTE-004", "warning", "Source is not trusted for auto-ready credential routing."));
  }
  if (actor.systemRole === "patient" || !canHoldIssuerPrivileges(actor.systemRole)) {
    issues.push(issue("VC-ROUTE-005", "error", "Patient actors cannot act as Maker or Checker."));
  }

  const entitlements = normalizeCredentialEntitlements(actor.systemRole, actor.credentialEntitlements);
  const additionalRoles = sanitizeAdditionalRolesForSystemRole(actor.systemRole, actor.additionalRoles);
  const makerEligible = Boolean(credentialType)
    && canActAsCredentialMaker(actor.systemRole, additionalRoles)
    && hasCredentialEntitlement(entitlements.makerTypes, credentialType);
  const checkerEligible = Boolean(credentialType)
    && canActAsCredentialChecker(actor.systemRole, additionalRoles)
    && hasCredentialEntitlement(entitlements.checkerTypes, credentialType);
  if (credentialType && !makerEligible && actor.id) {
    issues.push(issue("VC-ROUTE-006", "warning", "Actor is not entitled to create this credential request as Maker."));
  }

  const route = decideRoute({ issues, trusted: trustedSourcePolicy.trusted, dqiSummary, minDqiScore, makerEligible });
  const operationOutcome = buildOperationOutcome(issues);
  const now = options.now?.().toISOString() ?? new Date().toISOString();
  const makerChecker = {
    required: true,
    requiredBeforeIssue: true,
    makerEligible,
    checkerEligible,
    makerRole: actor.systemRole,
    additionalRoles,
    nextAction: route === "auto_ready_for_checker" ? "submit_to_checker_queue" : route === "blocked" ? "resolve_blocker" : "maker_review_required",
  };
  const requestDraft = credentialType && route !== "blocked"
    ? buildCredentialRequestDraft(record, credentialType, actor, route, makerChecker, now)
    : undefined;
  const auditEvents = buildAuditEvents({
    route,
    credentialType,
    actor,
    requestDraft,
    makerChecker,
    hospitalId: numberValue(record.issuerHospitalId ?? record.hospitalId),
    subjectId: numberValue(record.subjectId ?? record.patientId),
    now,
  });

  return {
    status: route === "auto_ready_for_checker" ? "ready" : "needs_review",
    route,
    credentialType,
    requestDraft,
    makerChecker,
    trustedSourcePolicy,
    dqiSummary,
    operationOutcome,
    auditEvents,
    issues,
  };
}

function buildCredentialRequestDraft(
  record: JsonRecord,
  credentialType: VcIssuanceCredentialType,
  actor: NormalizedVcIssuanceActor,
  route: VcIssuanceRoute,
  makerChecker: JsonRecord,
  now: string,
): JsonRecord {
  const subjectId = numberValue(record.subjectId ?? record.patientId);
  const issuerHospitalId = numberValue(record.issuerHospitalId ?? record.hospitalId);
  const documentData = buildDocumentData(record);
  const canonicalReview = {
    status: route === "auto_ready_for_checker" ? "pending_checker_review" : "pending_maker_review",
    requiredBeforeIssue: true,
    dqiSummary: extractDqiSummary(record),
    trustedSourcePolicy: normalizeTrustedSourcePolicy(record, Number(asRecord(record.trustedSourcePolicy).minDqiScore ?? DEFAULT_MIN_DQI_SCORE)),
  };
  return {
    requestId: `draft-vc-request-${sha256({ credentialType, subjectId, issuerHospitalId, documentData }).slice(0, 24)}`,
    status: route === "auto_ready_for_checker" ? "submitted" : "draft",
    type: credentialType,
    issuerHospitalId,
    subjectId,
    makerId: actor.id,
    makerRole: actor.systemRole,
    holderDid: optionalString(record.holderDid),
    issuerDid: optionalString(record.issuerDid),
    documentData,
    canonicalReview,
    makerChecker,
    submittedAt: route === "auto_ready_for_checker" ? now : undefined,
    vcIssuance: "not_started",
  };
}

function buildDocumentData(record: JsonRecord): JsonRecord {
  const documentReference = asRecord(record.documentReference ?? record.documentReferencePackage?.documentReference);
  const canonicalFhir = asRecord(record.canonicalFhir ?? record.mappingResult?.canonicalFhir);
  return stripUndefined({
    sourceJobId: optionalString(record.sourceJobId),
    correlationId: optionalString(record.correlationId),
    documentReference: documentReference.resourceType === "DocumentReference" ? safeReference(documentReference) : undefined,
    fhirBundle: canonicalFhir.bundle ? {
      resourceType: "Bundle",
      bundleHash: asRecord(canonicalFhir.summary).bundleHash ?? sha256(canonicalFhir.bundle),
      resourceCounts: asRecord(canonicalFhir.summary).resourceCounts,
    } : undefined,
    evidence: Array.isArray(record.evidence) ? record.evidence : undefined,
  });
}

function safeReference(resource: JsonRecord): JsonRecord {
  const attachment = firstAttachment(resource);
  return stripUndefined({
    resourceType: "DocumentReference",
    id: resource.id,
    status: resource.status,
    type: resource.type,
    content: [{
      attachment: {
        contentType: attachment.contentType,
        url: attachment.url,
        hash: attachment.hash,
        size: attachment.size,
      },
    }],
  });
}

function normalizeActor(actor: JsonRecord): NormalizedVcIssuanceActor {
  return {
    id: numberValue(actor.id),
    systemRole: optionalString(actor.systemRole ?? actor.role) ?? "system",
    additionalRoles: Array.isArray(actor.additionalRoles) ? actor.additionalRoles.map(String) : [],
    credentialEntitlements: asRecord(actor.credentialEntitlements),
  };
}

function normalizeTrustedSourcePolicy(record: JsonRecord, minDqiScore: number): JsonRecord {
  const policy = asRecord(record.trustedSourcePolicy);
  return {
    trusted: Boolean(policy.trusted ?? policy.trustedSource ?? false),
    sourceSystem: optionalString(policy.sourceSystem ?? record.sourceSystem),
    trustedSourceId: optionalString(policy.trustedSourceId),
    minDqiScore,
  };
}

function inferCredentialType(record: JsonRecord): VcIssuanceCredentialType | undefined {
  const direct = optionalString(record.credentialType ?? record.type ?? record.requestedCredentialType);
  if (isCredentialType(direct)) return direct;
  const context = optionalString(record.context);
  const documentReference = asRecord(record.documentReference ?? record.documentReferencePackage?.documentReference);
  const documentType = optionalString(asRecord(documentReference.type).text)
    ?? optionalString(firstCodingCode(asRecord(documentReference.type)))
    ?? optionalString(record.documentType);
  const inferred = credentialTypeFromDocumentOrContext(documentType ?? context);
  return isCredentialType(inferred) ? inferred : undefined;
}

function credentialTypeFromDocumentOrContext(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  const map: Record<string, VcIssuanceCredentialType> = {
    referral: "referral_vc",
    referral_letter: "referral_vc",
    lab: "lab_result",
    lab_report: "lab_result",
    diagnostic: "diagnostic_report",
    diagnostic_report: "diagnostic_report",
    medical_certificate: "medical_certificate",
    prescription: "prescription",
    discharge: "discharge_summary",
    discharge_summary: "discharge_summary",
    insurance: "insurance_eligibility",
    insurance_claim: "claim_package",
    claim: "claim_package",
    shl_manifest: "shl_manifest",
    pharmacy: "pharmacy_dispense",
    pharmacy_dispense: "pharmacy_dispense",
    visa_support_letter: "visa_support_letter",
    quotation: "quotation",
    guarantee_letter: "guarantee_letter",
    patient_summary: "patient_summary",
    opd_visit: "patient_summary",
  };
  return map[normalized] ?? (normalized.includes("lab") ? "lab_result" : normalized.includes("referral") ? "referral_vc" : undefined);
}

function extractDqiSummary(record: JsonRecord): JsonRecord | undefined {
  const dqi = record.dqiSummary ?? record.mappingResult?.dqiSummary ?? record.documentReferencePackage?.dqiSummary;
  return dqi && typeof dqi === "object" && !Array.isArray(dqi) ? dqi as JsonRecord : undefined;
}

function extractSourceReady(record: JsonRecord): boolean {
  const status = optionalString(record.status ?? record.mappingResult?.status ?? record.documentReferencePackage?.status);
  if (status) return ["ready", "succeeded"].includes(status);
  return Boolean(record.canonicalFhir ?? record.documentReference ?? record.documentReferencePackage?.documentReference);
}

function decideRoute(input: {
  issues: DataQualityIssue[];
  trusted: boolean;
  dqiSummary?: JsonRecord;
  minDqiScore: number;
  makerEligible: boolean;
}): VcIssuanceRoute {
  if (input.issues.some((item) => item.severity === "error")) return "blocked";
  const dqiReady = !input.dqiSummary || Number(input.dqiSummary.overall ?? 0) >= input.minDqiScore;
  if (input.trusted && dqiReady && input.makerEligible) return "auto_ready_for_checker";
  return "maker_review_required";
}

function buildAuditEvents(input: {
  route: VcIssuanceRoute;
  credentialType?: VcIssuanceCredentialType;
  actor: NormalizedVcIssuanceActor;
  requestDraft?: JsonRecord;
  makerChecker: JsonRecord;
  hospitalId?: number;
  subjectId?: number;
  now: string;
}): JsonRecord[] {
  const action = input.route === "auto_ready_for_checker"
    ? "credential.request.route_ready_for_checker"
    : input.route === "blocked"
      ? "credential.request.route_blocked"
      : "credential.request.route_maker_review_required";
  return [stripUndefined({
    action,
    actorId: input.actor.id,
    actorRole: input.actor.systemRole,
    hospitalId: input.hospitalId,
    resourceType: "credential_issuance_request",
    resourceId: input.requestDraft?.requestId,
    occurredAt: input.now,
    details: {
      type: input.credentialType,
      subjectId: input.subjectId,
      route: input.route,
      makerChecker: input.makerChecker,
      vcIssued: false,
    },
  })];
}

function buildOperationOutcome(issues: DataQualityIssue[]): JsonRecord {
  return {
    resourceType: "OperationOutcome",
    issue: issues.map((item) => ({
      severity: item.severity,
      code: "processing",
      diagnostics: item.message,
      details: { text: item.ruleId },
    })),
  };
}

function hasCredentialEntitlement(allowed: string[], credentialType?: string): boolean {
  if (!credentialType) return false;
  return allowed.includes("*") || allowed.includes(credentialType);
}

function isCredentialType(value: unknown): value is VcIssuanceCredentialType {
  return VC_ISSUANCE_CREDENTIAL_TYPES.includes(value as VcIssuanceCredentialType);
}

function firstAttachment(candidate: JsonRecord): JsonRecord {
  const content = Array.isArray(candidate.content) ? asRecord(candidate.content[0]) : {};
  return asRecord(content.attachment);
}

function firstCodingCode(type: JsonRecord): string | undefined {
  const coding = Array.isArray(type.coding) ? asRecord(type.coding[0]) : {};
  return optionalString(coding.code);
}

function issue(ruleId: string, severity: "error" | "warning", message: string): DataQualityIssue {
  return { ruleId, severity, message };
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

function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => stripUndefined(item)).filter((item) => item !== undefined) as T;
  if (!value || typeof value !== "object") return value;
  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (item === undefined) continue;
    output[key] = stripUndefined(item);
  }
  return output as T;
}
