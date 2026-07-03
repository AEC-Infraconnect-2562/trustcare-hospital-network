import { createHash } from "node:crypto";
import {
  assessReadiness,
  readinessContextLabels,
  readinessContextValues,
  readinessRequirements,
  type ReadinessCardLike,
  type ReadinessContext,
  type ReadinessRequirement,
} from "../shared/readiness";
import {
  buildTrustLayerChecklist,
  classifyPacketTransport,
  singleDocumentCredentialContracts,
  type TrustLayerDecision,
} from "../shared/trustLayer";

export type PrepareAudience =
  | "patient"
  | "hospital"
  | "integration_engineer"
  | "partner";

export type BundleDirection =
  | "patient_outbound"
  | "hospital_inbound"
  | "hospital_outbound"
  | "post_service"
  | "shared";

export type BundleTransport = "vp" | "shl" | "fhir_bundle" | "document_reference";

export interface PrepareWorkbenchInput {
  context?: ReadinessContext;
  patientId?: number;
  cards?: ReadinessCardLike[];
  now?: string;
}

export interface ServiceReadinessContract {
  contractId: string;
  context: ReadinessContext;
  version: string;
  status: "active";
  label: string;
  labelEn: string;
  patientLabel: string;
  patientLabelEn: string;
  hospitalLabel: string;
  hospitalLabelEn: string;
  patientVisible: boolean;
  hospitalVisible: boolean;
  patientDirection: BundleDirection;
  hospitalDirection: BundleDirection;
  bundleTypes: {
    patient: string;
    hospital: string;
  };
  recommendedTransports: BundleTransport[];
  packetTrustPolicy: {
    singleDocument: TrustLayerDecision;
    bundled: TrustLayerDecision;
    shl: TrustLayerDecision;
  };
  requirements: ReadinessRequirement[];
  questionnaire: Record<string, unknown>;
  vcTypes: string[];
  fhirResources: string[];
  consentPolicy: {
    legalBasis: string[];
    pdpaControls: string[];
    minimumNecessary: string;
    defaultExpiryMinutes: number;
  };
}

export interface AudienceUseCase {
  id: string;
  context: ReadinessContext;
  audience: PrepareAudience;
  label: string;
  labelEn: string;
  bundleType: string;
  direction: BundleDirection;
  visibleInPatientMenu: boolean;
  visibleInHospitalMenu: boolean;
  rationale: string;
  exampleDocuments: string[];
}

const VERSION = "2026.07.prepare-service.v1";
const BASE_PATH = "/api/public/prepare-service/v1";

const contextPresentation: Record<
  ReadinessContext,
  {
    patientLabel: string;
    patientLabelEn: string;
    hospitalLabel: string;
    hospitalLabelEn: string;
    patientDirection: BundleDirection;
    hospitalDirection: BundleDirection;
    patientBundle: string;
    hospitalBundle: string;
    transports: BundleTransport[];
    patientVisible?: boolean;
  }
> = {
  opd_visit: {
    patientLabel: "เตรียมเข้ารับบริการ OPD",
    patientLabelEn: "Prepare my OPD visit",
    hospitalLabel: "OPD intake readiness",
    hospitalLabelEn: "OPD intake readiness",
    patientDirection: "patient_outbound",
    hospitalDirection: "hospital_inbound",
    patientBundle: "OPDReadinessBundle",
    hospitalBundle: "HospitalOPDIntakeBundle",
    transports: ["vp", "fhir_bundle"],
  },
  emergency: {
    patientLabel: "บัตรข้อมูลฉุกเฉิน",
    patientLabelEn: "Emergency wallet card",
    hospitalLabel: "Emergency break-glass intake",
    hospitalLabelEn: "Emergency break-glass intake",
    patientDirection: "shared",
    hospitalDirection: "hospital_inbound",
    patientBundle: "EmergencyReadinessBundle",
    hospitalBundle: "EmergencyIntakeBundle",
    transports: ["vp"],
  },
  referral: {
    patientLabel: "เตรียมเอกสารรักษาต่อ",
    patientLabelEn: "Prepare referral or continuing care",
    hospitalLabel: "Referral send/receive workbench",
    hospitalLabelEn: "Referral send/receive workbench",
    patientDirection: "patient_outbound",
    hospitalDirection: "hospital_outbound",
    patientBundle: "ReferralReadinessBundle",
    hospitalBundle: "ReferralHandoffBundle",
    transports: ["vp", "shl", "fhir_bundle"],
  },
  cross_border: {
    patientLabel: "รักษาต่อข้ามเครือข่าย/ต่างประเทศ",
    patientLabelEn: "Cross-network or overseas care",
    hospitalLabel: "Cross-network/cross-border referral",
    hospitalLabelEn: "Cross-network or cross-border referral",
    patientDirection: "patient_outbound",
    hospitalDirection: "hospital_outbound",
    patientBundle: "CrossNetworkCareBundle",
    hospitalBundle: "CrossBorderReferralBundle",
    transports: ["shl", "vp", "fhir_bundle"],
  },
  medical_tourist: {
    patientLabel: "เตรียมไปรักษาต่างประเทศ",
    patientLabelEn: "Prepare care abroad",
    hospitalLabel: "รับผู้ป่วยต่างชาติ",
    hospitalLabelEn: "Inbound international patient",
    patientDirection: "patient_outbound",
    hospitalDirection: "hospital_inbound",
    patientBundle: "OutboundInternationalCareBundle",
    hospitalBundle: "InboundMedicalTouristBundle",
    transports: ["shl", "vp", "document_reference"],
  },
  insurance_claim: {
    patientLabel: "เตรียมเอกสารเคลม/ประกัน",
    patientLabelEn: "Prepare claim or coverage packet",
    hospitalLabel: "Payer readiness and claim intake",
    hospitalLabelEn: "Payer readiness and claim intake",
    patientDirection: "shared",
    hospitalDirection: "hospital_outbound",
    patientBundle: "InsuranceClaimReadinessBundle",
    hospitalBundle: "VerifiedClaimPackageBundle",
    transports: ["vp", "fhir_bundle", "document_reference"],
  },
  pharmacy_dispense: {
    patientLabel: "รับยา/ต่อยา",
    patientLabelEn: "Medication pickup or refill",
    hospitalLabel: "Pharmacy dispense readiness",
    hospitalLabelEn: "Pharmacy dispense readiness",
    patientDirection: "patient_outbound",
    hospitalDirection: "hospital_inbound",
    patientBundle: "PharmacyDispenseReadinessBundle",
    hospitalBundle: "PharmacyDispenseBundle",
    transports: ["vp", "fhir_bundle"],
  },
};

const additionalPatientUseCases: AudienceUseCase[] = [
  {
    id: "patient.pre_admission",
    context: "opd_visit",
    audience: "patient",
    label: "เตรียมเอกสารก่อนนอนโรงพยาบาล/ผ่าตัด",
    labelEn: "Pre-admission or procedure readiness",
    bundleType: "PreAdmissionReadinessBundle",
    direction: "patient_outbound",
    visibleInPatientMenu: true,
    visibleInHospitalMenu: false,
    rationale:
      "Patients need consent, current medication, allergy, coverage, and procedure instructions before planned admission.",
    exampleDocuments: ["patient_identity", "consent_receipt", "medication_summary", "allergy_alert", "coverage"],
  },
  {
    id: "patient.discharge_follow_up",
    context: "referral",
    audience: "patient",
    label: "เอกสารหลังรับบริการ/ติดตามผล",
    labelEn: "After-care and follow-up packet",
    bundleType: "DischargeWalletBundle",
    direction: "post_service",
    visibleInPatientMenu: true,
    visibleInHospitalMenu: false,
    rationale:
      "The patient keeps discharge, prescription, appointment, receipt, and claim evidence for the next service point.",
    exampleDocuments: ["discharge_summary", "prescription", "appointment", "claim_receipt"],
  },
  {
    id: "patient.caregiver_proxy",
    context: "opd_visit",
    audience: "patient",
    label: "เตรียมเอกสารแทนคนในครอบครัว",
    labelEn: "Caregiver or proxy preparation",
    bundleType: "ProxyCareReadinessBundle",
    direction: "patient_outbound",
    visibleInPatientMenu: true,
    visibleInHospitalMenu: false,
    rationale:
      "Mature patient apps support linked profiles; TrustCare should require delegated authority before sharing another person's packet.",
    exampleDocuments: ["patient_identity", "consent_receipt", "patient_summary"],
  },
];

const hospitalOnlyUseCases: AudienceUseCase[] = [
  {
    id: "hospital.walk_in_wallet_onboarding",
    context: "opd_visit",
    audience: "hospital",
    label: "ลงทะเบียน Wallet สำหรับผู้ป่วย Walk-in",
    labelEn: "Walk-in wallet onboarding",
    bundleType: "WalkInWalletOnboardingBundle",
    direction: "hospital_inbound",
    visibleInPatientMenu: false,
    visibleInHospitalMenu: true,
    rationale:
      "Hospital staff need a workflow to connect a new or external wallet before issuing documents into it.",
    exampleDocuments: ["patient_identity", "consent_receipt", "appointment"],
  },
  {
    id: "hospital.inbound_international_patient",
    context: "medical_tourist",
    audience: "hospital",
    label: "รับผู้ป่วยต่างชาติ",
    labelEn: "Inbound international patient",
    bundleType: "InboundMedicalTouristBundle",
    direction: "hospital_inbound",
    visibleInPatientMenu: false,
    visibleInHospitalMenu: true,
    rationale:
      "This is the hospital's international desk workflow. A Thai patient should instead see Prepare care abroad.",
    exampleDocuments: ["travel_document", "patient_summary", "quotation", "guarantee_letter"],
  },
  {
    id: "hospital.partner_portal_intake",
    context: "cross_border",
    audience: "partner",
    label: "รับเอกสารจาก Partner Portal",
    labelEn: "Partner portal document intake",
    bundleType: "PartnerIntakeSubmissionBundle",
    direction: "hospital_inbound",
    visibleInPatientMenu: false,
    visibleInHospitalMenu: true,
    rationale:
      "Partners submit legacy documents, FHIR, SHL, VC, or VP into a governed review flow before hospital use.",
    exampleDocuments: ["referral_vc", "patient_summary", "lab_result", "consent_receipt"],
  },
  {
    id: "hospital.issue_to_wallet",
    context: "opd_visit",
    audience: "hospital",
    label: "ออกเอกสารเข้า Wallet",
    labelEn: "Issue or deploy documents to wallet",
    bundleType: "WalletDeploymentBundle",
    direction: "hospital_outbound",
    visibleInPatientMenu: false,
    visibleInHospitalMenu: true,
    rationale:
      "Hospitals produce encounter outputs and deploy VCs to the target patient wallet through Maker/Checker policy.",
    exampleDocuments: ["medical_certificate", "prescription", "lab_result", "appointment"],
  },
];

export function buildAudienceUseCases() {
  const contractUseCases = readinessContextValues.flatMap((context): AudienceUseCase[] => {
    const presentation = contextPresentation[context];
    return [
      {
        id: `patient.${context}`,
        context,
        audience: "patient",
        label: presentation.patientLabel,
        labelEn: presentation.patientLabelEn,
        bundleType: presentation.patientBundle,
        direction: presentation.patientDirection,
        visibleInPatientMenu: presentation.patientVisible ?? true,
        visibleInHospitalMenu: false,
        rationale: patientRationale(context),
        exampleDocuments: readinessRequirements[context].slice(0, 4).map((item) => item.cardTypes[0]),
      },
      {
        id: `hospital.${context}`,
        context,
        audience: "hospital",
        label: presentation.hospitalLabel,
        labelEn: presentation.hospitalLabelEn,
        bundleType: presentation.hospitalBundle,
        direction: presentation.hospitalDirection,
        visibleInPatientMenu: false,
        visibleInHospitalMenu: true,
        rationale: hospitalRationale(context),
        exampleDocuments: readinessRequirements[context].slice(0, 4).map((item) => item.cardTypes[0]),
      },
    ];
  });

  const all = [...contractUseCases, ...additionalPatientUseCases, ...hospitalOnlyUseCases];
  return {
    patient: all.filter((item) => item.visibleInPatientMenu),
    hospital: all.filter((item) => item.visibleInHospitalMenu),
    hiddenFromPatient: all.filter((item) => !item.visibleInPatientMenu && item.visibleInHospitalMenu),
    all,
  };
}

export function buildServiceReadinessContracts(): ServiceReadinessContract[] {
  return readinessContextValues.map((context) => {
    const labels = readinessContextLabels[context];
    const presentation = contextPresentation[context];
    return {
      contractId: contractIdFor(context),
      context,
      version: VERSION,
      status: "active",
      label: labels.label,
      labelEn: labels.labelEn,
      patientLabel: presentation.patientLabel,
      patientLabelEn: presentation.patientLabelEn,
      hospitalLabel: presentation.hospitalLabel,
      hospitalLabelEn: presentation.hospitalLabelEn,
      patientVisible: presentation.patientVisible ?? true,
      hospitalVisible: true,
      patientDirection: presentation.patientDirection,
      hospitalDirection: presentation.hospitalDirection,
      bundleTypes: {
        patient: presentation.patientBundle,
        hospital: presentation.hospitalBundle,
      },
      recommendedTransports: presentation.transports,
      packetTrustPolicy: {
        singleDocument: classifyPacketTransport({ credentialCount: 1 }),
        bundled: classifyPacketTransport({ credentialCount: Math.min(readinessRequirements[context].length, 5) }),
        shl: classifyPacketTransport({
          credentialCount: readinessRequirements[context].length,
          context,
          hasFhirBundle: true,
          hasLegacyDocuments: presentation.transports.includes("document_reference"),
          estimatedBytes: 120_000,
        }),
      },
      requirements: readinessRequirements[context],
      questionnaire: buildQuestionnaire(context),
      vcTypes: Array.from(new Set(readinessRequirements[context].flatMap((item) => item.cardTypes.map(toCredentialType)))),
      fhirResources: Array.from(new Set(readinessRequirements[context].flatMap(fhirResourcesForRequirement))),
      consentPolicy: {
        legalBasis: ["explicit_consent", "healthcare_service_contract", "medical_treatment_exception_when_applicable"],
        pdpaControls: [
          "purpose_limitation",
          "data_minimization",
          "consent_receipt_vc",
          "audit_event",
          "expiry_or_revocation",
          "break_glass_reason_for_emergency",
        ],
        minimumNecessary: "Only documents required by the selected service context are requested or shared.",
        defaultExpiryMinutes: context === "emergency" ? 60 : 24 * 60,
      },
    };
  });
}

export function resolveServiceReadinessContract(context: ReadinessContext) {
  return buildServiceReadinessContracts().find((contract) => contract.context === context) ?? buildServiceReadinessContracts()[0];
}

export function buildPrepareServiceWorkbench(input: PrepareWorkbenchInput = {}) {
  const context = input.context ?? "opd_visit";
  const patientId = input.patientId ?? 1;
  const cards = input.cards ?? demoCardsForContext(context);
  const now = input.now ?? new Date().toISOString();
  const readiness = assessReadiness(cards, context);
  const contract = resolveServiceReadinessContract(context);
  const bundle = buildServiceBundleEnvelope({ context, audience: "patient", patientId, cards, now });
  const useCases = buildAudienceUseCases();

  return {
    simulationMode: true,
    simulationLabel: "Simulated Contract Hub + Wallet orchestration until Manus persists DB tables and connector jobs.",
    generatedAt: now,
    activeContext: context,
    patientId,
    activeContract: contract,
    patient: {
      primaryGoal: "Collect the minimum necessary documents into the patient's wallet and create a VP or SHL service packet.",
      visibleUseCases: useCases.patient,
      readiness,
      importOptions: buildDocumentImportOptions(context),
      dynamicQuestionnaire: contract.questionnaire,
      bundlePreview: bundle,
      packetActions: [
        "present_single_document_vp",
        "request_missing_documents",
        "import_legacy_document",
        "verify_vc_or_vp",
        "build_vp_packet",
        "build_shl_packet_for_large_bundle",
        "revoke_or_expire_packet",
      ],
    },
    hospital: {
      primaryGoal: "Verify incoming packets, onboard walk-in wallets, deploy hospital-issued documents, and sync encounter outputs.",
      visibleUseCases: useCases.hospital,
      hiddenFromPatient: useCases.hiddenFromPatient,
      workQueue: buildHospitalWorkQueue(now),
      targetWallets: buildTargetWallets(),
      deploymentDraft: buildWalletDeploymentEnvelope({
        context,
        hospitalId: 1,
        targetPatientIds: [patientId],
        issueDocuments: contract.requirements.filter((item) => item.required).map((item) => item.cardTypes[0]),
        now,
      }),
      walkInConnection: buildWalkInWalletConnection({
        patientName: "Walk-in Patient",
        consentAttested: true,
        now,
      }),
    },
    contractHub: buildContractHubCatalog(),
    singleDocumentVcVp: {
      policy: classifyPacketTransport({ credentialCount: 1 }),
      catalog: singleDocumentCredentialContracts,
      checklist: buildTrustLayerChecklist({
        mode: "direct_vp",
        hasIssuer: true,
        hasHolder: true,
        hasSchema: true,
        hasStatus: true,
        hasConsent: true,
      }),
    },
    dataMappingV2: buildDataMappingV2Profiles(),
    api: buildPrepareServicePublicApiExamples(context),
  };
}

export function buildServiceBundleEnvelope(input: {
  context: ReadinessContext;
  audience?: PrepareAudience;
  patientId?: number;
  cards?: ReadinessCardLike[];
  receiver?: string;
  now?: string;
}) {
  const context = input.context;
  const audience = input.audience ?? "patient";
  const now = input.now ?? new Date().toISOString();
  const contract = resolveServiceReadinessContract(context);
  const cards = input.cards ?? [];
  const readiness = assessReadiness(cards, context);
  const bundleType = audience === "hospital" ? contract.bundleTypes.hospital : contract.bundleTypes.patient;
  const direction = audience === "hospital" ? contract.hospitalDirection : contract.patientDirection;
  const bundleId = `svc_bundle_${stableId(`${context}:${audience}:${input.patientId ?? "demo"}:${now}`).slice(0, 18)}`;
  const missingRequired = readiness.missing.filter((item) => item.required);

  const items = contract.requirements.map((requirement) => {
    const ready = readiness.ready.find((item) => item.key === requirement.key);
    return {
      key: requirement.key,
      documentType: requirement.cardTypes[0],
      category: requirement.category,
      label: requirement.label,
      labelEn: requirement.labelEn,
      required: requirement.required,
      status: ready ? "ready" : "missing",
      sourceHint: requirement.sourceHint,
      matchedCardIds: ready?.matchedCards.map((card) => card.id).filter(Boolean) ?? [],
      outputArtifacts: {
        documentReference: `DocumentReference/${requirement.key}-${bundleId}`,
        vcType: toCredentialType(requirement.cardTypes[0]),
        fhirResources: fhirResourcesForRequirement(requirement),
      },
    };
  });
  const transportDecision = classifyPacketTransport({
    documentTypes: items.map((item) => item.documentType),
    credentialCount: readiness.selectedCardIds.length || items.filter((item) => item.status === "ready").length || items.length,
    context,
    hasFhirBundle: true,
    hasLegacyDocuments: contract.recommendedTransports.includes("document_reference"),
    estimatedBytes: items.length * 18_000,
  });
  const verificationChecklist = buildTrustLayerChecklist({
    mode: transportDecision.mode,
    hasIssuer: true,
    hasHolder: true,
    hasSchema: true,
    hasStatus: true,
    hasConsent: true,
    hasManifestCredential: transportDecision.mode === "shl_packet",
    hasPresentation: true,
    hasPasscodePolicy: transportDecision.mode === "shl_packet",
    hasFileHashes: transportDecision.mode === "shl_packet",
    hasDocumentReferences: contract.recommendedTransports.includes("document_reference"),
  });

  return {
    bundleId,
    contractId: contract.contractId,
    templateId: `bundle.${context}.${audience}.v1`,
    bundleType,
    context,
    audience,
    direction,
    status: missingRequired.length ? "partial" : "ready",
    readinessScore: readiness.score,
    requiredMissing: missingRequired.map((item) => item.key),
    createdAt: now,
    expiresAt: addMinutes(now, contract.consentPolicy.defaultExpiryMinutes),
    receiver: input.receiver ?? "TrustCare service intake",
    items,
    trustLayer: {
      transportDecision,
      verificationChecklist,
      vp: {
        recommended: transportDecision.mode !== "shl_packet" || contract.recommendedTransports.includes("vp"),
        holderDid: `did:key:patient-${input.patientId ?? "demo"}`,
        credentialCount: readiness.selectedCardIds.length,
        directSingleDocument: transportDecision.mode === "direct_vp",
      },
      shl: {
        recommended: transportDecision.mode === "shl_packet" || contract.recommendedTransports.includes("shl"),
        manifestCredentialType: "ShlManifestCredential",
        useWhen: "Large or mixed FHIR/legacy bundle, cross-network referral, international care, or partner review.",
      },
      consentCredentialType: "ConsentReceiptCredential",
      integrityHash: hashJson({ contractId: contract.contractId, items }),
    },
    fhirBundle: {
      resourceType: "Bundle",
      type: "collection",
      identifier: { system: "https://trustcare.network/service-bundles", value: bundleId },
      timestamp: now,
      entry: items.map((item) => ({
        fullUrl: `urn:uuid:${stableId(`${bundleId}:${item.key}`)}`,
        resource: {
          resourceType: "DocumentReference",
          status: "current",
          type: { text: item.labelEn },
          category: [{ text: item.category }],
          subject: { reference: `Patient/${input.patientId ?? "demo"}` },
        },
      })),
    },
    operationOutcome: {
      resourceType: "OperationOutcome",
      issue: missingRequired.map((item) => ({
        severity: "warning",
        code: "required",
        diagnostics: `Required document is missing: ${item.labelEn}`,
      })),
    },
  };
}

export function buildWalletDeploymentEnvelope(input: {
  context: ReadinessContext;
  hospitalId?: number;
  targetPatientIds?: number[];
  targetWalletMode?: "single" | "appointment_list" | "cohort" | "walk_in" | "external_wallet";
  issueDocuments?: string[];
  now?: string;
}) {
  const now = input.now ?? new Date().toISOString();
  const targetPatientIds = input.targetPatientIds?.length ? input.targetPatientIds : [1, 4, 8];
  const contract = resolveServiceReadinessContract(input.context);
  const issueDocuments = input.issueDocuments?.length
    ? input.issueDocuments
    : contract.requirements.filter((item) => item.required).map((item) => item.cardTypes[0]);
  return {
    deploymentId: `dep_${stableId(`${input.context}:${targetPatientIds.join(",")}:${now}`).slice(0, 16)}`,
    simulationMode: true,
    hospitalId: input.hospitalId ?? 1,
    context: input.context,
    contractId: contract.contractId,
    targetWalletSelection: {
      mode: input.targetWalletMode ?? "single",
      patientIds: targetPatientIds,
      supportsWalkInWallet: true,
      externalWalletHandshake: ["scan_did_qr", "send_wallet_invitation", "verify_holder_binding", "capture_consent"],
    },
    issuePolicy: {
      makerCheckerRequired: true,
      autoIssueFromHISWhenTrusted: true,
      dqiThreshold: 85,
      patientsCannotBeMakerOrChecker: true,
    },
    issueDocuments: issueDocuments.map((documentType) => ({
      documentType,
      source: "HIS/FHIR/Contract Hub mapping",
      status: "queued_for_mapping",
      vcType: toCredentialType(documentType),
    })),
    counts: {
      targets: targetPatientIds.length,
      queued: targetPatientIds.length * issueDocuments.length,
      requiresChecker: issueDocuments.length,
    },
    createdAt: now,
  };
}

export function buildWalkInWalletConnection(input: {
  patientName?: string;
  phone?: string;
  passport?: string;
  consentAttested?: boolean;
  now?: string;
}) {
  const now = input.now ?? new Date().toISOString();
  const seed = `${input.patientName ?? "walk-in"}:${input.phone ?? input.passport ?? "unknown"}:${now}`;
  return {
    connectionId: `walkin_${stableId(seed).slice(0, 14)}`,
    status: input.consentAttested ? "ready_to_link" : "pending_consent",
    holderDid: `did:key:z${stableId(seed).slice(0, 42)}`,
    walletBindingMethods: ["wallet_qr", "sms_invitation", "email_invitation", "paper_recovery_code"],
    patientIdentityConfidence: input.passport ? "passport_verified" : "hospital_registration_pending",
    consentRequired: !input.consentAttested,
    nextSteps: [
      "verify_identity",
      "capture_contextual_consent",
      "bind_holder_did",
      "issue_patient_identity_or_appointment_vc",
      "sync_hn_mapping_to_his",
    ],
    createdAt: now,
  };
}

export function simulatePrepareServiceImport(input: {
  context?: ReadinessContext;
  sourceType?: string;
  documentType?: string;
  patientId?: number;
  consentRef?: string;
  now?: string;
}) {
  const now = input.now ?? new Date().toISOString();
  const context = input.context ?? "opd_visit";
  const documentType = input.documentType ?? readinessRequirements[context][0].cardTypes[0];
  const sourceType = input.sourceType ?? "patient_upload";
  const importId = `imp_${stableId(`${context}:${documentType}:${sourceType}:${now}`).slice(0, 16)}`;
  const dqiScore = sourceType === "native_vc_vp" || sourceType === "fhir" ? 96 : sourceType === "patient_upload" ? 72 : 84;
  return {
    simulationMode: true,
    importId,
    context,
    patientId: input.patientId ?? 1,
    sourceType,
    documentType,
    consentRef: input.consentRef ?? "urn:trustcare:vc:consent:simulated",
    status: dqiScore >= 85 ? "ready_for_vc_issuance" : "needs_review",
    dqiScore,
    hash: `sha256:${hashJson({ context, documentType, sourceType, now })}`,
    documentReference: {
      resourceType: "DocumentReference",
      id: importId,
      status: "current",
      docStatus: "preliminary",
      type: { text: documentType },
      category: [{ text: readinessRequirements[context].find((item) => item.cardTypes.includes(documentType))?.category ?? "unknown" }],
      subject: { reference: `Patient/${input.patientId ?? 1}` },
      date: now,
      content: [{ attachment: { contentType: sourceType === "fhir" ? "application/fhir+json" : "application/pdf" } }],
    },
    next: dqiScore >= 85
      ? ["create_maker_request", "checker_approval", "issue_vc_to_wallet"]
      : ["manual_review", "request_better_source_or_attestation", "map_to_fhir_document_reference"],
  };
}

export function buildContractHubCatalog() {
  const contracts = buildServiceReadinessContracts();
  return {
    version: VERSION,
    status: "simulated_contracts_ready_for_db_seed",
    contracts,
    singleDocumentCredentialContracts,
    artifactTypes: [
      {
        type: "SingleDocumentVpContract",
        purpose: "Rules for presenting one VC directly as a holder VP without creating an SHL envelope.",
        owner: "wallet_product",
      },
      {
        type: "ServiceReadinessContract",
        purpose: "Versioned document/data requirements per care context and audience.",
        owner: "hospital_admin",
      },
      {
        type: "FHIR Questionnaire",
        purpose: "Dynamic intake forms for patient and hospital users.",
        owner: "clinical_operations",
      },
      {
        type: "FHIR QuestionnaireResponse",
        purpose: "Completed intake answers that can be validated and extracted.",
        owner: "patient_or_staff_author",
      },
      {
        type: "FHIR DocumentReference",
        purpose: "Metadata wrapper for legacy PDFs, scans, images, and external documents.",
        owner: "source_custodian",
      },
      {
        type: "VC Schema",
        purpose: "Credential claim model for documents that can be verifiably issued.",
        owner: "issuer_governance",
      },
      {
        type: "OpenAPI",
        purpose: "Partner-facing REST contract for wallet, import, packet, and deployment APIs.",
        owner: "integration_engineer",
      },
      {
        type: "TrustPolicy",
        purpose: "Issuer, holder, verifier, consent, revocation, and audit requirements.",
        owner: "system_admin",
      },
      {
        type: "ShlPacketTrustLayer",
        purpose: "VC/VP claims and verifier checklist wrapped around an SHL manifest and encrypted files.",
        owner: "trust_governance",
      },
    ],
    compatibilityRules: [
      "Single high-value documents such as patient identity, prescription, medical certificate, appointment, or eligibility should be shared as a direct VP unless they are part of a larger service packet.",
      "Small credential sets should use a purpose-bound VP bundle before escalating to SHL.",
      "Patient menus show patient_outbound/shared use cases only.",
      "Inbound international patient is hospital-facing; patient menu uses Prepare care abroad.",
      "Legacy documents enter as DocumentReference before optional VC issuance.",
      "SHL transports manifest/files; VC/VP remains the trust and consent layer.",
      "Every contract version must publish mapping rules, questionnaire, consent scope, and test payloads.",
    ],
  };
}

export function buildDataMappingV2Profiles() {
  return {
    version: VERSION,
    principle: "Map source data to a service contract first, then emit FHIR, DocumentReference, VC, VP, SHL, or tasks.",
    sourceConnectors: [
      "his_db_view",
      "his_fhir_rest",
      "hl7v2_adt_oru",
      "lis_csv_or_oru",
      "ris_pacs_dicom_report",
      "payer_api_or_portal",
      "partner_portal",
      "patient_upload",
      "native_vc_vp",
      "smart_health_link",
    ],
    profiles: readinessContextValues.map((context) => {
      const contract = resolveServiceReadinessContract(context);
      return {
        mappingProfileId: `map.${context}.contract.v1`,
        contractId: contract.contractId,
        context,
        requiredOutputs: contract.requirements.map((requirement) => ({
          requirementKey: requirement.key,
          documentType: requirement.cardTypes[0],
          fhirResources: fhirResourcesForRequirement(requirement),
          vcType: toCredentialType(requirement.cardTypes[0]),
          reviewPolicy: requirement.required ? "maker_checker_if_not_trusted_source" : "auto_attach_if_trusted",
        })),
        validation: {
          dqiThreshold: 85,
          operationOutcome: true,
          terminologyRequired: ["LOINC/SNOMED/ICD-10/TMT where available"],
        },
      };
    }),
  };
}

export function buildPrepareServicePublicApiExamples(context: ReadinessContext = "opd_visit") {
  const contract = resolveServiceReadinessContract(context);
  const bundle = buildServiceBundleEnvelope({ context, audience: "patient", patientId: 1, now: "2026-07-03T10:00:00.000Z" });
  return {
    basePath: BASE_PATH,
    authModel: "Production requires OAuth2/private-key JWT or signed partner token plus patient consent scope.",
    endpoints: [
      {
        method: "GET",
        path: "/contexts",
        response: buildAudienceUseCases(),
      },
      {
        method: "GET",
        path: "/contracts",
        response: { contracts: buildServiceReadinessContracts().map((item) => ({ contractId: item.contractId, context: item.context, patientLabel: item.patientLabel, hospitalLabel: item.hospitalLabel })) },
      },
      {
        method: "POST",
        path: "/assess",
        request: { patientId: 1, context, contractId: contract.contractId },
        response: {
          patientId: 1,
          context,
          contractId: contract.contractId,
          readiness: assessReadiness(demoCardsForContext(context), context),
          operationOutcome: { resourceType: "OperationOutcome", issue: [] },
        },
      },
      {
        method: "POST",
        path: "/import",
        request: { patientId: 1, context, sourceType: "patient_upload", documentType: contract.requirements[0].cardTypes[0] },
        response: simulatePrepareServiceImport({ context, patientId: 1, now: "2026-07-03T10:00:00.000Z" }),
      },
      {
        method: "POST",
        path: "/presentations/single-document",
        request: { patientId: 1, credentialId: "vc-prescription-001", documentType: "prescription", audience: "TrustCare Pharmacy" },
        response: {
          mode: "direct_vp",
          transportDecision: classifyPacketTransport({ credentialCount: 1, documentTypes: ["prescription"] }),
          presentation: {
            format: "jwt-vp",
            purpose: "treatment",
            audience: "TrustCare Pharmacy",
            credentialCount: 1,
            expiresInMinutes: 10,
          },
          verificationChecklist: buildTrustLayerChecklist({
            mode: "direct_vp",
            hasIssuer: true,
            hasHolder: true,
            hasSchema: true,
            hasStatus: true,
            hasConsent: true,
          }),
        },
      },
      {
        method: "POST",
        path: "/packets",
        request: { patientId: 1, context, packetType: "vp", consentRef: "urn:trustcare:vc:consent:simulated" },
        response: bundle,
      },
      {
        method: "POST",
        path: "/wallet-deployments",
        request: { hospitalId: 1, context, targetWalletSelection: { mode: "single", patientIds: [1] } },
        response: buildWalletDeploymentEnvelope({ context, hospitalId: 1, targetPatientIds: [1], now: "2026-07-03T10:00:00.000Z" }),
      },
      {
        method: "POST",
        path: "/walk-in-wallets",
        request: { patientName: "Walk-in Patient", consentAttested: true },
        response: buildWalkInWalletConnection({ patientName: "Walk-in Patient", consentAttested: true, now: "2026-07-03T10:00:00.000Z" }),
      },
    ],
  };
}

function buildQuestionnaire(context: ReadinessContext) {
  const requirements = readinessRequirements[context];
  return {
    resourceType: "Questionnaire",
    id: `questionnaire-${context}-v1`,
    url: `https://trustcare.network/fhir/Questionnaire/prepare-service/${context}/v1`,
    version: VERSION,
    status: "active",
    title: `${contextPresentation[context].patientLabelEn} intake`,
    subjectType: ["Patient"],
    item: [
      {
        linkId: "service-context",
        text: "Service context",
        type: "choice",
        required: true,
        answerOption: [{ valueCoding: { code: context, display: readinessContextLabels[context].labelEn } }],
      },
      ...requirements.map((requirement) => ({
        linkId: requirement.key,
        text: `Confirm or attach ${requirement.labelEn}`,
        type: "boolean",
        required: requirement.required,
      })),
      {
        linkId: "consent",
        text: "I consent to use the selected documents for this service context only.",
        type: "boolean",
        required: true,
      },
    ],
  };
}

function buildDocumentImportOptions(context: ReadinessContext) {
  return readinessRequirements[context].map((requirement) => ({
    requirementKey: requirement.key,
    documentType: requirement.cardTypes[0],
    required: requirement.required,
    sources: [
      requirement.sourceHint,
      "Patient upload",
      "Partner Portal",
      "FHIR API",
      "VC/VP",
      "Smart Health Link",
    ],
    outputPreference: ["DocumentReference", toCredentialType(requirement.cardTypes[0]), "Wallet card"],
  }));
}

function buildHospitalWorkQueue(now: string) {
  return [
    {
      queueId: "queue-opd-intake-001",
      label: "OPD packets awaiting verification",
      count: 12,
      oldestCreatedAt: addMinutes(now, -180),
      nextAction: "verify_vp_or_shl",
    },
    {
      queueId: "queue-walkin-wallet-001",
      label: "Walk-in wallets pending DID binding",
      count: 5,
      oldestCreatedAt: addMinutes(now, -45),
      nextAction: "capture_consent_and_bind_wallet",
    },
    {
      queueId: "queue-maker-checker-001",
      label: "Documents ready for Maker/Checker issuance",
      count: 9,
      oldestCreatedAt: addMinutes(now, -240),
      nextAction: "approve_and_issue_vc",
    },
    {
      queueId: "queue-international-001",
      label: "Inbound international packets",
      count: 4,
      oldestCreatedAt: addMinutes(now, -720),
      nextAction: "clinical_pre_review_and_financial_estimate",
    },
  ];
}

function buildTargetWallets() {
  return [
    { patientId: 1, name: "นายสมชาย ใจดี", holderDid: "did:key:patient-somchai", hn: "HN-TCC-00100001", walletStatus: "linked" },
    { patientId: 4, name: "Haruka Tanaka", holderDid: "did:key:patient-haruka", hn: "HN-TCN-00100004", walletStatus: "external_wallet" },
    { patientId: 8, name: "David Miller", holderDid: "did:key:patient-david", hn: "HN-TCS-00100008", walletStatus: "linked" },
  ];
}

function demoCardsForContext(context: ReadinessContext): ReadinessCardLike[] {
  const base: ReadinessCardLike[] = [
    card("identity", 1, "identity_and_access"),
    card("allergy", 2, "clinical_summary"),
    card("medication", 3, "medication_and_pharmacy"),
    card("patient_summary", 4, "clinical_summary"),
  ];
  if (context === "insurance_claim") return [base[0], card("coverage", 5, "claims_and_finance")];
  if (context === "pharmacy_dispense") return [base[0], base[1], card("prescription", 6, "medication_and_pharmacy")];
  if (context === "medical_tourist") return [base[0], base[3], card("travel_document", 7, "identity_and_access")];
  if (context === "cross_border") return [base[0], base[3], card("consent", 8, "identity_and_access")];
  if (context === "referral") return [base[0], base[3]];
  return base;
}

function card(cardType: string, id: number, category: string): ReadinessCardLike {
  return {
    id,
    credentialId: id,
    cardType,
    documentCategory: category,
    displayName: cardType,
    credentialStatus: "active",
    createdAt: "2026-07-03T10:00:00.000Z",
  };
}

function fhirResourcesForRequirement(requirement: ReadinessRequirement) {
  const type = requirement.cardTypes[0];
  if (type.includes("identity") || type.includes("travel")) return ["Patient", "RelatedPerson"];
  if (type.includes("allergy")) return ["AllergyIntolerance"];
  if (type.includes("medication") || type.includes("prescription") || type.includes("dispense")) return ["MedicationRequest", "MedicationStatement", "MedicationDispense"];
  if (type.includes("lab") || type.includes("diagnostic")) return ["DiagnosticReport", "Observation", "DocumentReference"];
  if (type.includes("coverage") || type.includes("claim") || type.includes("receipt")) return ["Coverage", "Claim", "ClaimResponse", "Invoice"];
  if (type.includes("referral")) return ["ServiceRequest", "DocumentReference"];
  if (type.includes("quotation") || type.includes("guarantee") || type.includes("visa")) return ["DocumentReference", "Task"];
  return ["DocumentReference"];
}

function toCredentialType(documentType: string) {
  const segments = documentType.split("_").filter(Boolean);
  return `${segments.map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1)).join("")}Credential`;
}

function contractIdFor(context: ReadinessContext) {
  return `trustcare.prepare.${context}.v1`;
}

function patientRationale(context: ReadinessContext) {
  if (context === "medical_tourist") {
    return "Patient-facing label is outbound care abroad, not inbound foreign patient intake.";
  }
  if (context === "cross_border") {
    return "Patient prepares documents to carry to a receiving hospital or overseas provider.";
  }
  return "Patient prepares a minimum necessary wallet packet for their own service context.";
}

function hospitalRationale(context: ReadinessContext) {
  if (context === "medical_tourist") {
    return "Hospital international desk receives, validates, quotes, and onboards inbound foreign patients.";
  }
  if (context === "referral" || context === "cross_border") {
    return "Hospital can both send packets out and verify incoming partner packets.";
  }
  return "Hospital verifies incoming packets and deploys hospital-issued documents to target wallets.";
}

function addMinutes(iso: string, minutes: number) {
  const date = new Date(iso);
  date.setMinutes(date.getMinutes() + minutes);
  return date.toISOString();
}

function stableId(seed: string) {
  return createHash("sha256").update(seed).digest("hex");
}

function hashJson(value: unknown) {
  return stableId(JSON.stringify(value));
}
