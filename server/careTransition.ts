import { sha256 } from "./portability/utils";

export const caseTypeValues = ["internal_referral", "cross_branch", "cross_border", "external_partner", "medical_tourist"] as const;
export const caseDocumentTypeValues = [
  "referral_letter",
  "patient_summary",
  "lab_report",
  "imaging_report",
  "passport",
  "insurance_card",
  "guarantee_letter",
  "quotation",
  "visa_support_letter",
  "consent",
  "claim_document",
  "invoice",
  "receipt",
  "discharge_summary",
  "prescription",
  "medical_certificate",
  "other",
] as const;
export const connectorTypeValues = ["fhir_rest", "hl7v2_mllp", "db_view", "cdc", "sftp_csv", "smart_health_link", "native_vc_vp", "manual_portal"] as const;
export const packageTypeValues = ["referral", "cross_border", "medical_tourist", "discharge", "counter_referral", "claim"] as const;

export type CaseType = (typeof caseTypeValues)[number];
export type CaseDocumentType = (typeof caseDocumentTypeValues)[number];
export type ConnectorType = (typeof connectorTypeValues)[number];
export type CarePackageType = (typeof packageTypeValues)[number];

export type CareTransitionTaskSeed = {
  taskType: string;
  title: string;
  ownerRole: string;
  priority?: "routine" | "urgent" | "stat";
};

export function caseTypeFromReferralType(referralType?: string): CaseType {
  if (referralType === "cross_branch") return "cross_branch";
  if (referralType === "external_partner") return "external_partner";
  return "cross_border";
}

export function packageTypeForCase(caseType: CaseType): CarePackageType {
  if (caseType === "medical_tourist") return "medical_tourist";
  if (caseType === "internal_referral") return "referral";
  if (caseType === "external_partner") return "cross_border";
  return "cross_border";
}

export function purposeForCarePackage(packageType: CarePackageType) {
  if (packageType === "medical_tourist") return "medical_tourist";
  if (packageType === "discharge") return "discharge";
  if (packageType === "claim") return "claim";
  if (packageType === "cross_border") return "cross_border";
  return "referral";
}

export function defaultTasksForCase(caseType: CaseType, options?: { translationRequired?: boolean; payerRequired?: boolean }): CareTransitionTaskSeed[] {
  const common: CareTransitionTaskSeed[] = [
    { taskType: "mpi_match", title: "MPI / patient identity match", ownerRole: "hospital_admin" },
    { taskType: "consent_review", title: "Consent and purpose check", ownerRole: "nurse" },
    { taskType: "document_quality", title: "Document quality and provenance review", ownerRole: "maker" },
    { taskType: "clinical_triage", title: "Clinical triage and specialty routing", ownerRole: "doctor", priority: "urgent" },
  ];
  if (caseType !== "internal_referral") {
    common.push({ taskType: "package_dispatch", title: "SHL / VP package dispatch", ownerRole: "integration_engineer" });
  }
  if (caseType === "cross_border" || caseType === "external_partner" || caseType === "medical_tourist") {
    common.push({ taskType: "legal_acceptance", title: "Jurisdiction and data transfer acceptance", ownerRole: "hospital_admin" } as CareTransitionTaskSeed);
  }
  if (options?.translationRequired || caseType === "medical_tourist") {
    common.push({ taskType: "translation_review", title: "Translation / interpreter review", ownerRole: "hospital_admin" });
  }
  if (options?.payerRequired || caseType === "medical_tourist") {
    common.push({ taskType: "financial_review", title: "Coverage, guarantee, quotation, and payment review", ownerRole: "hospital_admin" });
  }
  common.push(
    { taskType: "appointment_scheduling", title: "Appointment or admission scheduling", ownerRole: "hospital_admin" },
    { taskType: "discharge_packet", title: "Discharge / counter-referral packet", ownerRole: "doctor" },
    { taskType: "sync_back", title: "Sync-back receipt to source systems", ownerRole: "integration_engineer" },
  );
  return common;
}

export function connectorCapability(connectorType: ConnectorType) {
  const capabilities: Record<ConnectorType, string[]> = {
    fhir_rest: ["Patient", "ServiceRequest", "Task", "DocumentReference", "Bundle", "Coverage", "Claim"],
    hl7v2_mllp: ["ADT", "ORM", "ORU", "MDM"],
    db_view: ["read_model", "polling", "mapping_profile"],
    cdc: ["change_stream", "idempotent_sync", "replay"],
    sftp_csv: ["batch_file", "csv_mapping", "checksum"],
    smart_health_link: ["shlink_manifest", "jwe_files", "passcode"],
    native_vc_vp: ["issuer_did", "holder_vp", "trust_registry"],
    manual_portal: ["document_upload", "manual_review", "delegated_issuance"],
  };
  return capabilities[connectorType];
}

export function validatePartnerConnector(input: {
  connectorType: ConnectorType;
  endpointUrl?: string | null;
  authType?: string | null;
  canonicalMapping?: unknown;
  supportedDocumentTypes?: unknown;
}) {
  const issues: string[] = [];
  const warnings: string[] = [];
  if (input.connectorType !== "manual_portal" && input.connectorType !== "db_view" && !input.endpointUrl) {
    issues.push("Endpoint URL is required for this connector type.");
  }
  if ((input.connectorType === "fhir_rest" || input.connectorType === "native_vc_vp") && input.authType === "none") {
    warnings.push("Production partner API should use OAuth2, mTLS, API key, or signed VP authentication.");
  }
  if (!input.canonicalMapping && !["smart_health_link", "native_vc_vp"].includes(input.connectorType)) {
    warnings.push("Canonical mapping profile is recommended before activating structured ingestion.");
  }
  if (!input.supportedDocumentTypes) {
    warnings.push("Supported document types should be declared for document routing and Maker/Checker entitlement checks.");
  }
  return {
    ok: issues.length === 0,
    issues,
    warnings,
    capabilities: connectorCapability(input.connectorType),
  };
}

export function buildDocumentReference(input: {
  id: string;
  title: string;
  documentType: string;
  caseType: CaseType;
  caseId: number;
  patientId?: number | null;
  fileName?: string | null;
  fileUrl?: string | null;
  mimeType?: string | null;
  hash?: string | null;
  sourcePartnerId?: number | null;
  sourceSystem?: string | null;
  direction?: "inbound" | "outbound";
}) {
  const hash = input.hash || sha256({
    caseType: input.caseType,
    caseId: input.caseId,
    fileName: input.fileName,
    fileUrl: input.fileUrl,
    title: input.title,
    documentType: input.documentType,
  });
  return {
    resourceType: "DocumentReference",
    id: input.id,
    status: "current",
    docStatus: "preliminary",
    type: {
      coding: [{ system: "https://trustcare.network/fhir/document-type", code: input.documentType }],
      text: input.title,
    },
    subject: input.patientId ? { reference: `Patient/${input.patientId}` } : undefined,
    date: new Date().toISOString(),
    author: input.sourcePartnerId ? [{ reference: `Organization/${input.sourcePartnerId}` }] : undefined,
    description: input.title,
    securityLabel: [{ coding: [{ system: "https://trustcare.network/security-label", code: input.caseType }] }],
    content: [{
      attachment: {
        contentType: input.mimeType || "application/pdf",
        url: input.fileUrl || undefined,
        title: input.fileName || input.title,
        hash,
      },
      format: {
        system: "https://trustcare.network/document-format",
        code: input.direction || "inbound",
      },
    }],
    context: {
      related: [{ reference: `${input.caseType}/${input.caseId}` }],
      sourcePatientInfo: input.patientId ? { reference: `Patient/${input.patientId}` } : undefined,
    },
    extension: [
      { url: "https://trustcare.network/fhir/StructureDefinition/source-system", valueString: input.sourceSystem || "partner_portal" },
      { url: "https://trustcare.network/fhir/StructureDefinition/source-hash", valueString: hash },
    ],
  };
}

export function buildServiceRequest(input: {
  id: string;
  caseType: CaseType;
  patientId?: number | null;
  reason?: string | null;
  diagnosis?: string | null;
  priority?: string | null;
  requester?: string | null;
  performer?: string | null;
}) {
  return {
    resourceType: "ServiceRequest",
    id: input.id,
    status: "active",
    intent: "order",
    priority: input.priority === "emergency" ? "stat" : input.priority === "urgent" ? "urgent" : "routine",
    category: [{ coding: [{ system: "https://trustcare.network/service-category", code: input.caseType }] }],
    code: {
      coding: [{ system: "https://trustcare.network/service-request", code: "care-transition" }],
      text: input.reason || "Care transition request",
    },
    subject: input.patientId ? { reference: `Patient/${input.patientId}` } : undefined,
    authoredOn: new Date().toISOString(),
    requester: input.requester ? { display: input.requester } : undefined,
    performer: input.performer ? [{ display: input.performer }] : undefined,
    reasonCode: input.diagnosis ? [{ text: input.diagnosis }] : undefined,
  };
}

export function buildCarePackageManifest(input: {
  caseType: CaseType;
  caseId: number;
  packageType: CarePackageType;
  documents: Array<{ id: number; title: string; documentType: string; hash?: string | null; fhirDocumentReferenceId?: string | null }>;
  credentialIds?: string[];
  presentationId?: string | null;
  shlId?: number | null;
  consentCredentialId?: string | null;
  costEstimate?: unknown;
  claimRef?: string | null;
}) {
  const items = input.documents.map((document) => ({
    type: "document_reference",
    id: document.id,
    title: document.title,
    documentType: document.documentType,
    hash: document.hash,
    fhirDocumentReferenceId: document.fhirDocumentReferenceId,
  }));
  const manifest = {
    packageId: `${input.packageType}-${input.caseType}-${input.caseId}-${Date.now()}`,
    caseType: input.caseType,
    caseId: input.caseId,
    packageType: input.packageType,
    trustLayer: "vc-vp-around-care-package",
    transport: "shl-manifest-or-portal-inbox",
    items,
    credentialIds: input.credentialIds || [],
    presentationId: input.presentationId || null,
    shlId: input.shlId || null,
    consentCredentialId: input.consentCredentialId || null,
    costEstimate: input.costEstimate || null,
    claimRef: input.claimRef || null,
    generatedAt: new Date().toISOString(),
  };
  return { manifest, manifestHash: sha256(manifest) };
}
