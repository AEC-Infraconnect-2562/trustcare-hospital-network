import { createHash } from "crypto";

export type ClaimPayerType =
  | "nhso"
  | "sso"
  | "csmbs"
  | "private_insurance"
  | "corporate"
  | "self_pay"
  | "travel_insurance";

export type ClaimStatus =
  | "draft"
  | "validating"
  | "correction_required"
  | "ready_to_submit"
  | "submitted"
  | "accepted"
  | "rejected"
  | "more_info_requested"
  | "appeal"
  | "paid"
  | "closed";

export type ClaimType =
  | "opd"
  | "ipd"
  | "dental"
  | "pharmacy"
  | "rehabilitation"
  | "emergency";

export type ValidationIssue = {
  severity: "info" | "warning" | "error";
  field: string;
  message: string;
  action: string;
};

export type ClaimEvidenceItem = {
  id: string;
  title: string;
  type:
    | "legacy_file"
    | "vc"
    | "vp"
    | "shl"
    | "fhir_bundle"
    | "invoice"
    | "receipt";
  source: "patient_wallet" | "his" | "payer_portal" | "partner_portal" | "upload" | "finance";
  status: "verified" | "needs_review" | "missing" | "accepted" | "rejected";
  credentialType?: "insurance_eligibility" | "claim_package" | "claim_receipt" | string;
  hash?: string;
  required: boolean;
  simulated: boolean;
};

export type ClaimWorkbenchCase = {
  id: string;
  claimCaseId?: number;
  caseRef: string;
  patient: {
    id: number;
    name: string;
    hn: string;
    walletDid: string;
  };
  hospital: {
    id: number;
    name: string;
    code: string;
    did: string;
  };
  payer: {
    id: number;
    name: string;
    payerType: ClaimPayerType;
    submissionFormat: "api" | "portal" | "batch_file" | "email" | "rpa";
    adapterMode: "real_db" | "simulated_seed";
  };
  claimType: ClaimType;
  status: ClaimStatus;
  priority: "normal" | "urgent" | "discharge_blocker";
  source: "real_db" | "simulated_seed";
  simulated: boolean;
  memberId: string;
  encounterRef: string;
  totalAmount: number;
  approvedAmount: number;
  currency: "THB" | "USD";
  serviceDate: string;
  readinessScore: number;
  diagnosisCodes: string[];
  procedureCodes: string[];
  serviceItems: Array<{
    code: string;
    description: string;
    amount: number;
  }>;
  eligibility: {
    status: "eligible" | "ineligible" | "pending";
    checkedAt: string;
    validUntil: string;
    preAuthorizationRequired: boolean;
    coverageCredentialId: string;
    benefits: Record<string, unknown>;
  };
  preauthorization?: {
    status: "not_required" | "draft" | "submitted" | "approved" | "more_info_requested";
    guaranteeRef?: string;
    approvedAmount?: number;
  };
  evidence: ClaimEvidenceItem[];
  checklist: Array<{
    id: string;
    label: string;
    status: "complete" | "missing" | "review";
    required: boolean;
  }>;
  validationIssues: ValidationIssue[];
  fhirClaim: Record<string, unknown>;
  packageCredential: Record<string, unknown>;
  payerResponse?: Record<string, unknown>;
  payment?: Record<string, unknown>;
  walletOutputs: Array<{
    credentialType: "insurance_eligibility" | "claim_package" | "claim_receipt";
    credentialId: string;
    status: "issued" | "ready" | "pending";
  }>;
  timeline: Array<{
    at: string;
    label: string;
    actor: string;
    status: "done" | "current" | "pending" | "blocked";
  }>;
  lastUpdatedAt: string;
};

type DbClaimCase = {
  id: number;
  patientId: number;
  hospitalId: number;
  payerAdapterId: number;
  encounterRef?: string | null;
  claimType: ClaimType;
  status: ClaimStatus;
  totalAmount?: string | null;
  approvedAmount?: string | null;
  diagnosisCodes?: unknown;
  procedureCodes?: unknown;
  serviceItems?: unknown;
  validationIssues?: unknown;
  payerClaimId?: string | null;
  submittedAt?: Date | string | null;
  respondedAt?: Date | string | null;
  paidAt?: Date | string | null;
  rejectionReason?: string | null;
  claimReceiptVcId?: string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
};

type DbPayerAdapter = {
  id: number;
  name: string;
  payerType: ClaimPayerType | string;
  submissionFormat?: "api" | "portal" | "batch_file" | "email" | "rpa" | null;
  status?: string | null;
  validationRules?: unknown;
};

type NormalizedPayer = {
  id: number;
  name: string;
  payerType: ClaimPayerType;
  submissionFormat: "api" | "portal" | "batch_file" | "email" | "rpa";
  adapterMode: "real_db" | "simulated_seed";
  status: string;
};

const DEFAULT_NOW = "2026-07-03T10:00:00.000Z";

export const claimMaturityReferences = [
  {
    label: "HL7 FHIR R4 Claim",
    url: "https://hl7.org/fhir/R4/claim.html",
    use: "Canonical provider-to-payer claim, preauthorization, and predetermination request model.",
  },
  {
    label: "HL7 FHIR R4 CoverageEligibilityRequest",
    url: "https://hl7.org/fhir/R4/coverageeligibilityrequest.html",
    use: "Coverage validation, benefit discovery, and preauthorization requirement discovery.",
  },
  {
    label: "HL7 FHIR R4 ClaimResponse",
    url: "https://hl7.org/fhir/R4/claimresponse.html",
    use: "Payer adjudication, approval, rejection, and more-information response model.",
  },
  {
    label: "HL7 FHIR R4 PaymentReconciliation",
    url: "https://hl7.org/fhir/R4/paymentreconciliation.html",
    use: "Bulk payment and receivable reconciliation model.",
  },
  {
    label: "HL7 Da Vinci PAS / CRD / DTR",
    url: "https://hl7.org/fhir/us/davinci-pas/",
    use: "Modern reference pattern for coverage requirements, documentation collection, and prior authorization.",
  },
  {
    label: "CMS Interoperability and Prior Authorization final rule",
    url: "https://www.cms.gov/initiatives/burden-reduction/overview/interoperability/policies-regulations/cms-interoperability-prior-authorization-final-rule-cms-0057-f",
    use: "Reference for API-driven prior authorization and payer interoperability policy direction.",
  },
];

export const claimStateMachine = [
  "pre_visit_ready",
  "eligibility_checked",
  "documents_collected",
  "package_validated",
  "claim_package_vc_issued",
  "payer_submitted",
  "payer_adjudicated",
  "payment_reconciled",
  "claim_receipt_vc_issued",
  "closed",
];

export const requiredDocumentsByClaimType: Record<ClaimType, string[]> = {
  opd: ["patient_identity", "coverage_eligibility", "encounter_summary", "diagnosis", "invoice"],
  ipd: [
    "patient_identity",
    "coverage_eligibility",
    "preauthorization_or_guarantee",
    "admission_note",
    "discharge_summary",
    "procedure_codes",
    "invoice",
  ],
  dental: ["patient_identity", "coverage_eligibility", "dental_chart", "procedure_codes", "invoice"],
  pharmacy: ["patient_identity", "coverage_eligibility", "prescription", "dispense_record", "receipt"],
  rehabilitation: ["patient_identity", "coverage_eligibility", "referral_or_care_plan", "therapy_notes", "invoice"],
  emergency: [
    "patient_identity",
    "coverage_eligibility",
    "emergency_note",
    "triage_record",
    "discharge_summary",
    "invoice",
  ],
};

export function buildClaimWorkbench(input: {
  claimCases?: DbClaimCase[];
  payerAdapters?: DbPayerAdapter[];
  now?: string;
}) {
  const now = input.now ?? new Date().toISOString();
  const adapters = normalizePayers(input.payerAdapters);
  const realPackets = (input.claimCases ?? []).map((claim) => mapDbClaimToWorkbenchCase(claim, adapters, now));
  const seedPackets = buildSimulatedClaimScenarios(now);
  const casePackets = realPackets.length > 0 ? realPackets : seedPackets;
  const overview = summarizeClaims(casePackets);

  return {
    generatedAt: now,
    simulationMode: realPackets.length === 0,
    simulationNotice:
      realPackets.length === 0
        ? "No claim_cases rows were returned, so the workbench is using clearly marked simulated seed packets for end-to-end testing."
        : "Workbench is using claim_cases from the database. Simulated seed scenarios remain available as API examples.",
    dataBoundary:
      "TrustCare keeps FHIR/VC/VP claim packets patient-portable and adapter-ready. Payer-specific submission is isolated behind payer adapters.",
    overview,
    lanes: buildLanes(casePackets),
    adapters,
    casePackets,
    seedPackets,
    apiExamples: buildClaimPublicApiExamples(casePackets[0] ?? seedPackets[0]),
    references: claimMaturityReferences,
    stateMachine: claimStateMachine,
  };
}

export function buildClaimPackageCredential(packet: ClaimWorkbenchCase) {
  const fhirClaimHash = digest(packet.fhirClaim);
  const evidenceHash = digest(packet.evidence.map(({ id, hash, status, type }) => ({ id, hash, status, type })));
  return {
    id: `urn:uuid:vc-claim-package-${packet.caseRef.toLowerCase()}`,
    type: ["VerifiableCredential", "ClaimPackageCredential"],
    issuer: packet.hospital.did,
    issuanceDate: packet.lastUpdatedAt,
    credentialSubject: {
      id: packet.patient.walletDid,
      claimCaseRef: packet.caseRef,
      encounterRef: packet.encounterRef,
      claimType: packet.claimType,
      payer: packet.payer.name,
      payerType: packet.payer.payerType,
      targetFormat: targetFormatForPayer(packet.payer),
      totalAmount: packet.totalAmount,
      currency: packet.currency,
      serviceDate: packet.serviceDate,
      fhirClaimHash,
      evidenceHash,
      evidence: packet.evidence.map((item) => ({
        id: item.id,
        type: item.type,
        credentialType: item.credentialType,
        source: item.source,
        hash: item.hash,
        status: item.status,
      })),
      consent: {
        purpose: "insurance",
        lawfulBasis: "patient_consent_or_healthcare_claim_processing",
        consentRef: `CONSENT-CLAIM-${packet.caseRef}`,
      },
      simulation: packet.simulated,
    },
    proof: {
      type: "DataIntegrityProof",
      cryptosuite: "eddsa-jcs-2022",
      proofPurpose: "assertionMethod",
      verificationMethod: `${packet.hospital.did}#claim-issuer-key-1`,
      simulated: packet.simulated,
    },
  };
}

export function buildClaimReceiptCredential(packet: ClaimWorkbenchCase, payment?: Record<string, unknown>) {
  const paidAmount = numberFromUnknown(payment?.paidAmount, packet.approvedAmount);
  return {
    id: `urn:uuid:vc-claim-receipt-${packet.caseRef.toLowerCase()}`,
    type: ["VerifiableCredential", "ClaimReceiptCredential"],
    issuer: packet.hospital.did,
    issuanceDate: new Date().toISOString(),
    credentialSubject: {
      id: packet.patient.walletDid,
      claimCaseRef: packet.caseRef,
      payerClaimId: String(payment?.payerClaimId ?? `PAYER-${packet.caseRef}`),
      payer: packet.payer.name,
      adjudicationStatus: "paid",
      approvedAmount: packet.approvedAmount,
      paidAmount,
      patientResponsibility: Math.max(packet.totalAmount - packet.approvedAmount, 0),
      currency: packet.currency,
      eobProfile: "FHIR ExplanationOfBenefit patient-facing summary",
      paymentReconciliationHash: digest(payment ?? packet.payment ?? {}),
      simulation: packet.simulated,
    },
    proof: {
      type: "DataIntegrityProof",
      cryptosuite: "eddsa-jcs-2022",
      proofPurpose: "assertionMethod",
      verificationMethod: `${packet.hospital.did}#claim-receipt-key-1`,
      simulated: packet.simulated,
    },
  };
}

export function buildPayerSubmissionEnvelope(packet: ClaimWorkbenchCase, mode?: string) {
  return {
    submissionId: `SUB-${packet.caseRef}-${Date.now().toString(36).toUpperCase()}`,
    claimCaseRef: packet.caseRef,
    payerClaimId: `PAYER-${packet.caseRef}`,
    targetPayer: packet.payer.name,
    adapterMode: mode ?? packet.payer.submissionFormat,
    targetFormat: targetFormatForPayer(packet.payer),
    status: "submitted",
    submittedAt: new Date().toISOString(),
    claimPackageCredentialId: String(packet.packageCredential.id),
    fhirClaimHash: digest(packet.fhirClaim),
    transport: transportForPayer(packet.payer),
    simulation: packet.simulated,
  };
}

export function buildPayerAdjudicationEnvelope(
  packet: ClaimWorkbenchCase,
  decision: "accepted" | "rejected" | "more_info_requested",
  reason?: string,
) {
  const approvedAmount = decision === "accepted" ? packet.approvedAmount : 0;
  return {
    claimCaseRef: packet.caseRef,
    payerClaimId: `PAYER-${packet.caseRef}`,
    status: decision,
    respondedAt: new Date().toISOString(),
    approvedAmount,
    currency: packet.currency,
    reason:
      reason ??
      (decision === "more_info_requested"
        ? "Payer requests discharge summary and itemized invoice."
        : decision === "rejected"
          ? "Coverage inactive or required documentation missing."
          : "Approved under simulated payer rules."),
    fhirResource: {
      resourceType: "ClaimResponse",
      id: `claimresponse-${packet.caseRef.toLowerCase()}`,
      status: "active",
      outcome: decision === "accepted" ? "complete" : decision === "rejected" ? "error" : "partial",
      disposition: reason ?? "Simulated adjudication response.",
      request: { reference: `Claim/${packet.caseRef}` },
      created: new Date().toISOString(),
      total: [{ category: { text: "benefit" }, amount: { value: approvedAmount, currency: packet.currency } }],
    },
    simulation: packet.simulated,
  };
}

export function buildPaymentReconciliationEnvelope(packet: ClaimWorkbenchCase, paidAmount?: number) {
  const paymentAmount = paidAmount ?? packet.approvedAmount;
  const reconciliation = {
    resourceType: "PaymentReconciliation",
    id: `paymentreconciliation-${packet.caseRef.toLowerCase()}`,
    status: "active",
    outcome: "complete",
    created: new Date().toISOString(),
    paymentDate: new Date().toISOString().slice(0, 10),
    paymentAmount: { value: paymentAmount, currency: packet.currency },
    paymentIdentifier: { system: "https://trustcare.example/payments", value: `PAY-${packet.caseRef}` },
    detail: [
      {
        identifier: { value: `PAYER-${packet.caseRef}` },
        type: { text: "claim" },
        request: { reference: `Claim/${packet.caseRef}` },
        response: { reference: `ClaimResponse/claimresponse-${packet.caseRef.toLowerCase()}` },
        amount: { value: paymentAmount, currency: packet.currency },
      },
    ],
  };
  return {
    claimCaseRef: packet.caseRef,
    payerClaimId: `PAYER-${packet.caseRef}`,
    status: "paid",
    paidAt: new Date().toISOString(),
    paidAmount: paymentAmount,
    currency: packet.currency,
    reconciliation,
    claimReceiptCredential: buildClaimReceiptCredential(packet, {
      payerClaimId: `PAYER-${packet.caseRef}`,
      paidAmount: paymentAmount,
      reconciliation,
    }),
    simulation: packet.simulated,
  };
}

export function validateClaimPacket(packet: ClaimWorkbenchCase): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const requiredDocuments = requiredDocumentsByClaimType[packet.claimType];
  for (const doc of requiredDocuments) {
    const hasDocument = packet.checklist.some(
      (item) => item.id === doc && (item.status === "complete" || item.status === "review"),
    );
    if (!hasDocument) {
      issues.push({
        severity: "error",
        field: doc,
        message: `${doc} is required for ${packet.claimType.toUpperCase()} claim submission.`,
        action: "Attach document evidence or import from HIS/Wallet before issuing ClaimPackageCredential.",
      });
    }
  }
  if (packet.eligibility.status !== "eligible") {
    issues.push({
      severity: "error",
      field: "eligibility",
      message: "Coverage eligibility is not confirmed.",
      action: "Run eligibility check or import a CoverageEligibilityCredential.",
    });
  }
  if (packet.totalAmount <= 0) {
    issues.push({
      severity: "error",
      field: "totalAmount",
      message: "Claim total must be greater than zero.",
      action: "Import itemized invoice from HIS/ERP or enter finance-approved charge lines.",
    });
  }
  if (packet.payer.payerType === "private_insurance" && packet.eligibility.preAuthorizationRequired && !packet.preauthorization) {
    issues.push({
      severity: "warning",
      field: "preauthorization",
      message: "Private insurance claim likely requires a guarantee/preauthorization reference.",
      action: "Submit guarantee request through the payer adapter or attach guarantee letter.",
    });
  }
  return [...packet.validationIssues, ...issues];
}

export function buildClaimPublicApiExamples(packet: ClaimWorkbenchCase) {
  const eligibilityResponse = {
    requestId: `ELIG-${packet.caseRef}`,
    patientId: packet.patient.id,
    payerType: packet.payer.payerType,
    status: packet.eligibility.status,
    coverageCredentialId: packet.eligibility.coverageCredentialId,
    validUntil: packet.eligibility.validUntil,
    benefits: packet.eligibility.benefits,
    preAuthorizationRequired: packet.eligibility.preAuthorizationRequired,
    simulation: packet.simulated,
  };
  const submissionResponse = buildPayerSubmissionEnvelope(packet);
  const adjudicationResponse = buildPayerAdjudicationEnvelope(packet, "accepted");
  const paymentResponse = buildPaymentReconciliationEnvelope(packet);

  return {
    version: "v1",
    basePath: "/api/public/claim-center/v1",
    securityModel:
      "Production endpoints should require partner API key or OAuth2 client credentials plus request signature. Mock endpoints return simulated data only.",
    endpoints: [
      {
        method: "POST",
        path: "/eligibility-check",
        purpose: "Receive wallet/policy/member data and return a CoverageEligibility-style decision.",
        response: eligibilityResponse,
      },
      {
        method: "POST",
        path: "/claim-packages",
        purpose: "Receive a verified claim package envelope with FHIR Claim, evidence hashes, and ClaimPackageCredential.",
        response: submissionResponse,
      },
      {
        method: "POST",
        path: "/payer-responses",
        purpose: "Receive payer adjudication, rejection, or more-information response.",
        response: adjudicationResponse,
      },
      {
        method: "POST",
        path: "/payments",
        purpose: "Receive remittance/payment reconciliation and issue ClaimReceiptCredential.",
        response: paymentResponse,
      },
    ],
  };
}

export function parseCodes(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (value && typeof value === "object") return Object.values(value as Record<string, unknown>).map(String).filter(Boolean);
  return String(value ?? "")
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseServiceItems(value: unknown): Array<{ code: string; description: string; amount: number }> {
  if (Array.isArray(value)) {
    return value
      .map((item, index) => {
        const record = item as Record<string, unknown>;
        return {
          code: String(record.code ?? `ITEM-${index + 1}`),
          description: String(record.description ?? record.name ?? "Service item"),
          amount: numberFromUnknown(record.amount, 0),
        };
      })
      .filter((item) => item.amount > 0 || item.description);
  }
  return String(value ?? "")
    .split(/\n+/)
    .map((line, index) => {
      const [description, amountText, codeText] = line.split("|").map((part) => part.trim());
      return {
        code: codeText || `ITEM-${index + 1}`,
        description: description || `Service item ${index + 1}`,
        amount: numberFromUnknown(amountText, 0),
      };
    })
    .filter((item) => item.description && item.amount >= 0);
}

function normalizePayers(payers?: DbPayerAdapter[]): NormalizedPayer[] {
  const normalized = (payers ?? []).map((payer) => ({
    id: payer.id,
    name: payer.name,
    payerType: normalizePayerType(payer.payerType),
    submissionFormat: payer.submissionFormat ?? "portal",
    adapterMode: "real_db" as const,
    status: payer.status ?? "testing",
  }));
  return normalized.length > 0
    ? normalized
    : [
        { id: 101, name: "สปสช. (NHSO)", payerType: "nhso" as const, submissionFormat: "batch_file" as const, adapterMode: "simulated_seed" as const, status: "active" },
        { id: 102, name: "ประกันสังคม (SSO)", payerType: "sso" as const, submissionFormat: "portal" as const, adapterMode: "simulated_seed" as const, status: "active" },
        { id: 103, name: "AIA Thailand Direct Billing", payerType: "private_insurance" as const, submissionFormat: "api" as const, adapterMode: "simulated_seed" as const, status: "testing" },
        { id: 104, name: "กรมบัญชีกลาง (CSMBS)", payerType: "csmbs" as const, submissionFormat: "portal" as const, adapterMode: "simulated_seed" as const, status: "testing" },
        { id: 105, name: "Global Travel Assistance", payerType: "travel_insurance" as const, submissionFormat: "email" as const, adapterMode: "simulated_seed" as const, status: "testing" },
      ];
}

function mapDbClaimToWorkbenchCase(claim: DbClaimCase, payers: ReturnType<typeof normalizePayers>, now: string): ClaimWorkbenchCase {
  const payer = payers.find((item) => item.id === claim.payerAdapterId) ?? payers[0];
  const diagnosisCodes = parseCodes(claim.diagnosisCodes);
  const procedureCodes = parseCodes(claim.procedureCodes);
  const serviceItems = parseServiceItems(claim.serviceItems);
  const totalAmount = numberFromUnknown(claim.totalAmount, serviceItems.reduce((sum, item) => sum + item.amount, 0));
  const approvedAmount = numberFromUnknown(claim.approvedAmount, claim.status === "paid" || claim.status === "accepted" ? totalAmount * 0.82 : 0);
  const evidence = defaultEvidenceForCase(claim.claimType, false, claim.status);
  const packet = buildPacket({
    id: `DB-CLM-${claim.id}`,
    claimCaseId: claim.id,
    caseRef: `CLM-${String(claim.id).padStart(6, "0")}`,
    patientId: claim.patientId,
    patientName: `Patient #${claim.patientId}`,
    hn: `HN-${claim.patientId}`,
    hospitalId: claim.hospitalId,
    hospitalName: `Hospital #${claim.hospitalId}`,
    hospitalCode: `H${claim.hospitalId}`,
    payer,
    claimType: claim.claimType,
    status: claim.status,
    source: "real_db",
    simulated: false,
    memberId: `MEM-${claim.patientId}-${payer.id}`,
    encounterRef: claim.encounterRef ?? `ENC-${claim.id}`,
    totalAmount,
    approvedAmount,
    currency: "THB",
    serviceDate: toIsoDate(claim.createdAt ?? now),
    diagnosisCodes,
    procedureCodes,
    serviceItems,
    evidence,
    now: toIsoString(claim.updatedAt ?? now),
    validationIssues: normalizeValidationIssues(claim.validationIssues),
  });
  return packet;
}

function buildSimulatedClaimScenarios(now: string): ClaimWorkbenchCase[] {
  const payers = normalizePayers();
  const cases = [
    buildPacket({
      id: "SIM-CLM-001",
      caseRef: "SIM-CLM-001",
      patientId: 1,
      patientName: "นายสมชาย ใจดี",
      hn: "HN-TCC-00100001",
      hospitalId: 1,
      hospitalName: "TrustCare Central Hospital",
      hospitalCode: "TCC",
      payer: payers[0],
      claimType: "opd",
      status: "ready_to_submit",
      source: "simulated_seed",
      simulated: true,
      memberId: "NHSO-1101700200011",
      encounterRef: "ENC-TCC-20260703-OPD-001",
      totalAmount: 4200,
      approvedAmount: 4200,
      currency: "THB",
      serviceDate: "2026-07-03",
      diagnosisCodes: ["E11.9", "I10"],
      procedureCodes: [],
      serviceItems: [
        { code: "OPD-001", description: "OPD consultation and chronic disease review", amount: 800 },
        { code: "LAB-HBA1C", description: "HbA1c laboratory test", amount: 650 },
        { code: "RX-30D", description: "30-day medication package", amount: 2750 },
      ],
      evidence: defaultEvidenceForCase("opd", true, "ready_to_submit"),
      now,
    }),
    buildPacket({
      id: "SIM-CLM-002",
      caseRef: "SIM-CLM-002",
      patientId: 3,
      patientName: "นางสาวมาลี รักสุขภาพ",
      hn: "HN-TCN-00100003",
      hospitalId: 2,
      hospitalName: "TrustCare North Hospital",
      hospitalCode: "TCN",
      payer: payers[1],
      claimType: "rehabilitation",
      status: "more_info_requested",
      source: "simulated_seed",
      simulated: true,
      memberId: "SSO-33-9876543",
      encounterRef: "ENC-TCN-20260702-REHAB-014",
      totalAmount: 12800,
      approvedAmount: 9600,
      currency: "THB",
      serviceDate: "2026-07-02",
      diagnosisCodes: ["M54.5"],
      procedureCodes: ["93.39"],
      serviceItems: [
        { code: "PT-SESSION", description: "Physical therapy 8 sessions", amount: 9600 },
        { code: "ORTHO-REVIEW", description: "Orthopedic follow-up", amount: 3200 },
      ],
      evidence: defaultEvidenceForCase("rehabilitation", true, "more_info_requested"),
      now,
      validationIssues: [
        {
          severity: "warning",
          field: "therapy_notes",
          message: "SSO reviewer requests signed therapy progress note.",
          action: "Attach signed therapy note from HIS or request VC from rehabilitation unit.",
        },
      ],
    }),
    buildPacket({
      id: "SIM-CLM-003",
      caseRef: "SIM-CLM-003",
      patientId: 8,
      patientName: "Ms. Olivia Chen",
      hn: "HN-TCS-00200008",
      hospitalId: 3,
      hospitalName: "TrustCare Seaside Hospital",
      hospitalCode: "TCS",
      payer: payers[2],
      claimType: "ipd",
      status: "submitted",
      source: "simulated_seed",
      simulated: true,
      memberId: "AIA-DB-TH-778899",
      encounterRef: "ENC-TCS-20260701-IPD-009",
      totalAmount: 184500,
      approvedAmount: 166000,
      currency: "THB",
      serviceDate: "2026-07-01",
      diagnosisCodes: ["K35.8"],
      procedureCodes: ["47.01"],
      serviceItems: [
        { code: "IPD-ROOM-2D", description: "Inpatient room and nursing 2 days", amount: 22000 },
        { code: "OR-APPENDECTOMY", description: "Laparoscopic appendectomy", amount: 125000 },
        { code: "MED-SUPPLY", description: "Medication and surgical supplies", amount: 37500 },
      ],
      evidence: defaultEvidenceForCase("ipd", true, "submitted"),
      now,
      preauthorization: {
        status: "approved",
        guaranteeRef: "GOP-AIA-2026-778899",
        approvedAmount: 166000,
      },
    }),
    buildPacket({
      id: "SIM-CLM-004",
      caseRef: "SIM-CLM-004",
      patientId: 10,
      patientName: "Mr. Amir Al-Farsi",
      hn: "HN-TCC-00200010",
      hospitalId: 1,
      hospitalName: "TrustCare Central Hospital",
      hospitalCode: "TCC",
      payer: payers[4],
      claimType: "emergency",
      status: "accepted",
      source: "simulated_seed",
      simulated: true,
      memberId: "GTA-TRAVEL-2026-4451",
      encounterRef: "ENC-TCC-20260702-ER-021",
      totalAmount: 56200,
      approvedAmount: 50400,
      currency: "THB",
      serviceDate: "2026-07-02",
      diagnosisCodes: ["S52.5"],
      procedureCodes: ["79.12"],
      serviceItems: [
        { code: "ER-TRIAGE", description: "Emergency triage and physician care", amount: 4500 },
        { code: "XR-FOREARM", description: "Forearm X-ray", amount: 2700 },
        { code: "ORTHO-CAST", description: "Closed reduction and cast", amount: 49000 },
      ],
      evidence: defaultEvidenceForCase("emergency", true, "accepted"),
      now,
    }),
    buildPacket({
      id: "SIM-CLM-005",
      caseRef: "SIM-CLM-005",
      patientId: 12,
      patientName: "นางวิภา สุขใจ",
      hn: "HN-TCN-00100012",
      hospitalId: 2,
      hospitalName: "TrustCare North Hospital",
      hospitalCode: "TCN",
      payer: payers[3],
      claimType: "dental",
      status: "correction_required",
      source: "simulated_seed",
      simulated: true,
      memberId: "CSMBS-198012120001",
      encounterRef: "ENC-TCN-20260703-DENT-005",
      totalAmount: 7800,
      approvedAmount: 0,
      currency: "THB",
      serviceDate: "2026-07-03",
      diagnosisCodes: ["K02.9"],
      procedureCodes: [],
      serviceItems: [{ code: "DENT-FILL", description: "Dental filling and X-ray", amount: 7800 }],
      evidence: defaultEvidenceForCase("dental", true, "correction_required").map((item) =>
        item.id === "procedure_codes" ? { ...item, status: "missing" as const } : item,
      ),
      now,
      validationIssues: [
        {
          severity: "error",
          field: "procedure_codes",
          message: "Dental claim requires coded procedure line.",
          action: "Map dental treatment to payer procedure code before submission.",
        },
      ],
    }),
    buildPacket({
      id: "SIM-CLM-006",
      caseRef: "SIM-CLM-006",
      patientId: 14,
      patientName: "Mr. Kenji Sato",
      hn: "HN-TCS-00200014",
      hospitalId: 3,
      hospitalName: "TrustCare Seaside Hospital",
      hospitalCode: "TCS",
      payer: { id: 106, name: "Self-pay reimbursement wallet packet", payerType: "self_pay", submissionFormat: "email", adapterMode: "simulated_seed", status: "active" },
      claimType: "pharmacy",
      status: "paid",
      source: "simulated_seed",
      simulated: true,
      memberId: "SELF-PAY",
      encounterRef: "ENC-TCS-20260701-PHAR-077",
      totalAmount: 3600,
      approvedAmount: 3600,
      currency: "THB",
      serviceDate: "2026-07-01",
      diagnosisCodes: ["J06.9"],
      procedureCodes: [],
      serviceItems: [{ code: "RX-ACUTE", description: "Dispensed medication after OPD visit", amount: 3600 }],
      evidence: defaultEvidenceForCase("pharmacy", true, "paid"),
      now,
    }),
  ];
  return cases;
}

function buildPacket(input: {
  id: string;
  claimCaseId?: number;
  caseRef: string;
  patientId: number;
  patientName: string;
  hn: string;
  hospitalId: number;
  hospitalName: string;
  hospitalCode: string;
  payer: NormalizedPayer;
  claimType: ClaimType;
  status: ClaimStatus;
  source: "real_db" | "simulated_seed";
  simulated: boolean;
  memberId: string;
  encounterRef: string;
  totalAmount: number;
  approvedAmount: number;
  currency: "THB" | "USD";
  serviceDate: string;
  diagnosisCodes: string[];
  procedureCodes: string[];
  serviceItems: Array<{ code: string; description: string; amount: number }>;
  evidence: ClaimEvidenceItem[];
  now: string;
  validationIssues?: ValidationIssue[];
  preauthorization?: ClaimWorkbenchCase["preauthorization"];
}): ClaimWorkbenchCase {
  const checklist = checklistFromEvidence(input.claimType, input.evidence);
  const readinessScore = scoreReadiness(input.status, checklist, input.validationIssues ?? []);
  const base: ClaimWorkbenchCase = {
    id: input.id,
    claimCaseId: input.claimCaseId,
    caseRef: input.caseRef,
    patient: {
      id: input.patientId,
      name: input.patientName,
      hn: input.hn,
      walletDid: `did:key:zTrustCarePatient${input.patientId}`,
    },
    hospital: {
      id: input.hospitalId,
      name: input.hospitalName,
      code: input.hospitalCode,
      did: `did:web:trustcare.example:hospitals:${input.hospitalCode.toLowerCase()}`,
    },
    payer: {
      id: input.payer.id,
      name: input.payer.name,
      payerType: input.payer.payerType,
      submissionFormat: input.payer.submissionFormat,
      adapterMode: input.payer.adapterMode,
    },
    claimType: input.claimType,
    status: input.status,
    priority: input.claimType === "ipd" ? "discharge_blocker" : input.claimType === "emergency" ? "urgent" : "normal",
    source: input.source,
    simulated: input.simulated,
    memberId: input.memberId,
    encounterRef: input.encounterRef,
    totalAmount: input.totalAmount,
    approvedAmount: input.approvedAmount,
    currency: input.currency,
    serviceDate: input.serviceDate,
    readinessScore,
    diagnosisCodes: input.diagnosisCodes,
    procedureCodes: input.procedureCodes,
    serviceItems: input.serviceItems,
    eligibility: {
      status: input.memberId === "" ? "pending" : "eligible",
      checkedAt: input.now,
      validUntil: "2026-08-02",
      preAuthorizationRequired: input.payer.payerType === "private_insurance" || input.claimType === "ipd",
      coverageCredentialId: `vc-eligibility-${input.caseRef.toLowerCase()}`,
      benefits: {
        opd: true,
        ipd: input.payer.payerType !== "self_pay",
        dental: ["private_insurance", "csmbs"].includes(input.payer.payerType),
        directBilling: input.payer.payerType !== "self_pay",
      },
    },
    preauthorization: input.preauthorization,
    evidence: input.evidence,
    checklist,
    validationIssues: input.validationIssues ?? [],
    fhirClaim: {},
    packageCredential: {},
    walletOutputs: [
      { credentialType: "insurance_eligibility", credentialId: `vc-eligibility-${input.caseRef.toLowerCase()}`, status: "issued" },
      { credentialType: "claim_package", credentialId: `vc-claim-package-${input.caseRef.toLowerCase()}`, status: input.status === "draft" ? "pending" : "ready" },
      { credentialType: "claim_receipt", credentialId: `vc-claim-receipt-${input.caseRef.toLowerCase()}`, status: input.status === "paid" ? "issued" : "pending" },
    ],
    timeline: buildTimeline(input.status, input.now),
    lastUpdatedAt: input.now,
  };
  base.fhirClaim = buildCanonicalFhirClaim(base);
  base.packageCredential = buildClaimPackageCredential(base);
  if (["accepted", "paid"].includes(base.status)) base.payerResponse = buildPayerAdjudicationEnvelope(base, "accepted");
  if (base.status === "paid") base.payment = buildPaymentReconciliationEnvelope(base);
  base.validationIssues = validateClaimPacket(base);
  return base;
}

function buildCanonicalFhirClaim(packet: ClaimWorkbenchCase) {
  return {
    resourceType: "Claim",
    id: packet.caseRef,
    status: packet.status === "draft" ? "draft" : "active",
    type: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/claim-type", code: packet.claimType }] },
    use: packet.eligibility.preAuthorizationRequired && packet.status === "draft" ? "preauthorization" : "claim",
    patient: { reference: `Patient/${packet.patient.id}`, display: packet.patient.name },
    billablePeriod: { start: packet.serviceDate, end: packet.serviceDate },
    created: packet.lastUpdatedAt,
    insurer: { display: packet.payer.name },
    provider: { reference: `Organization/${packet.hospital.code}`, display: packet.hospital.name },
    priority: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/processpriority", code: packet.priority === "urgent" ? "stat" : "normal" }] },
    diagnosis: packet.diagnosisCodes.map((code, index) => ({
      sequence: index + 1,
      diagnosisCodeableConcept: {
        coding: [{ system: "http://hl7.org/fhir/sid/icd-10", code }],
      },
    })),
    procedure: packet.procedureCodes.map((code, index) => ({
      sequence: index + 1,
      procedureCodeableConcept: {
        coding: [{ system: "http://hl7.org/fhir/sid/icd-10-pcs", code }],
      },
    })),
    insurance: [
      {
        sequence: 1,
        focal: true,
        identifier: { value: packet.memberId },
        coverage: { display: packet.payer.name },
        preAuthRef: packet.preauthorization?.guaranteeRef ? [packet.preauthorization.guaranteeRef] : undefined,
      },
    ],
    supportingInfo: packet.evidence.map((item, index) => ({
      sequence: index + 1,
      category: { text: item.type },
      code: { text: item.title },
      valueString: item.hash ?? item.status,
    })),
    item: packet.serviceItems.map((item, index) => ({
      sequence: index + 1,
      productOrService: { coding: [{ system: "https://trustcare.example/billing-code", code: item.code }], text: item.description },
      net: { value: item.amount, currency: packet.currency },
    })),
    total: { value: packet.totalAmount, currency: packet.currency },
  };
}

function defaultEvidenceForCase(claimType: ClaimType, simulated: boolean, status: ClaimStatus): ClaimEvidenceItem[] {
  const docs = requiredDocumentsByClaimType[claimType];
  return docs.map((doc, index) => ({
    id: doc,
    title: evidenceTitle(doc),
    type: evidenceType(doc),
    source: evidenceSource(doc),
    status: status === "correction_required" && index === docs.length - 1 ? "needs_review" : "verified",
    credentialType: credentialTypeForEvidence(doc),
    hash: `sha256:${digest({ doc, claimType, simulated }).slice(0, 32)}`,
    required: true,
    simulated,
  }));
}

function checklistFromEvidence(claimType: ClaimType, evidence: ClaimEvidenceItem[]) {
  return requiredDocumentsByClaimType[claimType].map((doc) => {
    const item = evidence.find((entry) => entry.id === doc);
    return {
      id: doc,
      label: evidenceTitle(doc),
      status:
        item?.status === "verified" || item?.status === "accepted"
          ? ("complete" as const)
          : item?.status === "needs_review"
            ? ("review" as const)
            : ("missing" as const),
      required: true,
    };
  });
}

function scoreReadiness(status: ClaimStatus, checklist: ClaimWorkbenchCase["checklist"], issues: ValidationIssue[]) {
  if (status === "paid" || status === "accepted") return 100;
  const complete = checklist.filter((item) => item.status === "complete").length;
  const score = Math.round((complete / Math.max(checklist.length, 1)) * 100);
  const penalty = issues.filter((issue) => issue.severity === "error").length * 15 + issues.filter((issue) => issue.severity === "warning").length * 8;
  return Math.max(0, Math.min(100, score - penalty));
}

function buildTimeline(status: ClaimStatus, now: string) {
  const doneUntil: Record<ClaimStatus, number> = {
    draft: 0,
    validating: 1,
    correction_required: 2,
    ready_to_submit: 3,
    submitted: 5,
    more_info_requested: 6,
    accepted: 6,
    rejected: 6,
    appeal: 6,
    paid: 8,
    closed: 9,
  };
  return claimStateMachine.map((label, index) => ({
    at: index <= doneUntil[status] ? now : "",
    label,
    actor: index < 2 ? "Patient / registration" : index < 5 ? "Claim maker/checker" : index < 7 ? "Payer adapter" : "Finance / wallet",
    status:
      index < doneUntil[status]
        ? ("done" as const)
        : index === doneUntil[status]
          ? status === "correction_required" || status === "more_info_requested"
            ? ("blocked" as const)
            : ("current" as const)
          : ("pending" as const),
  }));
}

function buildLanes(cases: ClaimWorkbenchCase[]) {
  const laneDefs = [
    { id: "intake", label: "Intake / eligibility", statuses: ["draft", "validating", "correction_required"] },
    { id: "ready", label: "Ready to submit", statuses: ["ready_to_submit"] },
    { id: "payer", label: "Payer response", statuses: ["submitted", "more_info_requested", "accepted", "rejected", "appeal"] },
    { id: "payment", label: "Payment / wallet receipt", statuses: ["paid", "closed"] },
  ];
  return laneDefs.map((lane) => ({
    ...lane,
    count: cases.filter((claim) => lane.statuses.includes(claim.status)).length,
    value: cases
      .filter((claim) => lane.statuses.includes(claim.status))
      .reduce((sum, claim) => sum + claim.totalAmount, 0),
  }));
}

function summarizeClaims(cases: ClaimWorkbenchCase[]) {
  const totalValue = cases.reduce((sum, claim) => sum + claim.totalAmount, 0);
  const approvedValue = cases.reduce((sum, claim) => sum + claim.approvedAmount, 0);
  const pendingDocuments = cases.reduce(
    (sum, claim) => sum + claim.checklist.filter((item) => item.status !== "complete").length,
    0,
  );
  const paidCount = cases.filter((claim) => claim.status === "paid").length;
  return {
    totalClaims: cases.length,
    totalValue,
    approvedValue,
    pendingDocuments,
    paidCount,
    avgReadinessScore: Math.round(cases.reduce((sum, claim) => sum + claim.readinessScore, 0) / Math.max(cases.length, 1)),
    verifiedWithin24hTarget: cases.filter((claim) => claim.readinessScore >= 80).length,
  };
}

function targetFormatForPayer(payer: ClaimWorkbenchCase["payer"]) {
  if (payer.payerType === "nhso" || payer.payerType === "sso" || payer.payerType === "csmbs") return "FHIR Claim canonical -> Thai payer portal/batch mapping";
  if (payer.submissionFormat === "api") return "FHIR Claim + ClaimPackageCredential REST envelope";
  if (payer.payerType === "self_pay") return "Patient wallet reimbursement packet";
  return "FHIR Claim canonical -> payer-specific document packet";
}

function transportForPayer(payer: ClaimWorkbenchCase["payer"]) {
  return {
    mode: payer.submissionFormat,
    fallbackModes: ["portal", "batch_file", "secure_email"],
    adapterRequired: payer.payerType !== "self_pay",
    notes: "Use payer contract settings and ruleset version before enabling production submission.",
  };
}

function evidenceTitle(id: string) {
  const map: Record<string, string> = {
    patient_identity: "Patient Identity VC / demographic proof",
    coverage_eligibility: "Coverage Eligibility VC",
    encounter_summary: "Encounter summary",
    diagnosis: "Diagnosis codes",
    invoice: "Itemized invoice",
    preauthorization_or_guarantee: "Preauthorization / guarantee letter",
    admission_note: "Admission note",
    discharge_summary: "Discharge summary",
    procedure_codes: "Procedure codes",
    dental_chart: "Dental chart",
    prescription: "Prescription VC",
    dispense_record: "Pharmacy dispense record",
    receipt: "Receipt",
    referral_or_care_plan: "Referral / care plan",
    therapy_notes: "Therapy notes",
    emergency_note: "Emergency note",
    triage_record: "Triage record",
  };
  return map[id] ?? id.replace(/_/g, " ");
}

function evidenceType(id: string): ClaimEvidenceItem["type"] {
  if (id.includes("coverage") || id.includes("identity") || id.includes("prescription") || id.includes("summary")) return "vc";
  if (id === "invoice") return "invoice";
  if (id === "receipt") return "receipt";
  return "fhir_bundle";
}

function evidenceSource(id: string): ClaimEvidenceItem["source"] {
  if (id.includes("identity") || id.includes("coverage")) return "patient_wallet";
  if (id === "invoice" || id === "receipt") return "finance";
  return "his";
}

function credentialTypeForEvidence(id: string) {
  if (id.includes("coverage")) return "insurance_eligibility";
  if (id === "receipt") return "claim_receipt";
  if (id.includes("identity")) return "patient_identity";
  return "claim_package";
}

function normalizePayerType(value: string): ClaimPayerType {
  if (value === "travel_insurance") return "travel_insurance";
  if (["nhso", "sso", "csmbs", "private_insurance", "corporate", "self_pay"].includes(value)) return value as ClaimPayerType;
  return "private_insurance";
}

function normalizeValidationIssues(value: unknown): ValidationIssue[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((issue) => issue as Record<string, unknown>)
    .map((issue) => ({
      severity: issue.severity === "warning" || issue.severity === "info" ? issue.severity : "error",
      field: String(issue.field ?? "claim"),
      message: String(issue.message ?? "Claim validation issue"),
      action: String(issue.action ?? "Review and correct the claim package."),
    }));
}

function numberFromUnknown(value: unknown, fallback: number) {
  const parsed = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toIsoDate(value: Date | string | null | undefined) {
  return toIsoString(value).slice(0, 10);
}

function toIsoString(value: Date | string | null | undefined) {
  if (!value) return DEFAULT_NOW;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? DEFAULT_NOW : date.toISOString();
}

function digest(value: unknown) {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
