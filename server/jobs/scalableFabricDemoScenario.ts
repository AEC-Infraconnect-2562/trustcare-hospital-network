import { sha256 } from "../portability/utils";
import type { JsonRecord } from "../portability/types";
import { buildLegacyDocumentReferencePackage } from "./documentReferencePipeline";
import { evaluateEdgeConnectorRuntime } from "./edgeConnectorSimulator";
import { normalizeSourcePayload } from "./importSourcePayload";
import { mapImportedPayload } from "./mappingDqiWorker";
import {
  buildFabricTraceContext,
  buildFabricTroubleshootingIndex,
  type FabricTraceEventLike,
  type FabricTraceStage,
} from "./observability";
import {
  buildSyncBackExecuteResult,
  buildSyncBackPlanResult,
  runSyncReconciliation,
} from "./syncBackWorker";
import { routeVcIssuanceRequest } from "./vcIssuanceWorker";
import { buildVpShlPacket } from "./vpShlPacketBuilder";

const DEMO_NOW = "2026-07-05T02:00:00.000Z";
const DEMO_CORRELATION_ID = "corr-scalable-fabric-demo-001";
const DEMO_CONTEXT = "opd_visit";
const DEMO_CONTRACT_ID = "opd_readiness_v1";
const DEMO_CONTRACT_VERSION = "1.0.0";
const DEMO_HOSPITAL_ID = 101;
const DEMO_PATIENT_ID = 9001;
const DEMO_ADAPTER_ID = 7101;
const DEMO_ACTOR_ID = 501;

export interface ScalableFabricDemoStep {
  stage: FabricTraceStage | "verifier_intake";
  status: string;
  jobType?: string;
  artifactRef?: string;
  metadata?: JsonRecord;
}

export interface ScalableFabricDemoScenarioResult {
  scenarioId: string;
  correlationId: string;
  context: string;
  contractId: string;
  contractVersion: string;
  steps: ScalableFabricDemoStep[];
  traceEvents: FabricTraceEventLike[];
  troubleshootingIndex: ReturnType<typeof buildFabricTroubleshootingIndex>;
  finalState: JsonRecord;
}

export async function runScalableFabricDemoScenario(): Promise<ScalableFabricDemoScenarioResult> {
  const now = () => new Date(DEMO_NOW);
  const importResult = normalizeSourcePayload(
    "his_db_view",
    syntheticHisDbViewPayload(),
    DEMO_CONTRACT_ID,
    DEMO_CONTRACT_VERSION,
    DEMO_CONTEXT,
  );
  const mappingResult = mapImportedPayload({ normalizedSource: importResult.normalizedSource }, { dqiThreshold: 85 });
  const documentHash = sha256({ scenario: "scalable-fabric-demo", artifact: "care-summary-document" });
  const documentPackage = buildLegacyDocumentReferencePackage({
    documentType: "patient_summary",
    title: "Synthetic care readiness summary",
    contentType: "application/pdf",
    objectRef: "mock://object-store/scalable-fabric-demo/care-summary.pdf",
    hash: documentHash,
    sourceSystem: "demo-his",
    sourceDocumentId: "synthetic-care-summary-001",
    sourceJobId: "job-demo-document-reference",
    sizeBytes: 28_672,
    receivedAt: DEMO_NOW,
  }, {
    patientId: DEMO_PATIENT_ID,
    hospitalId: DEMO_HOSPITAL_ID,
    context: DEMO_CONTEXT,
    contractId: DEMO_CONTRACT_ID,
    contractVersion: DEMO_CONTRACT_VERSION,
    correlationId: DEMO_CORRELATION_ID,
    now,
  });

  const vcRoute = routeVcIssuanceRequest({
    credentialType: "patient_summary",
    status: "ready",
    patientId: DEMO_PATIENT_ID,
    hospitalId: DEMO_HOSPITAL_ID,
    actor: {
      id: DEMO_ACTOR_ID,
      systemRole: "hospital_admin",
      credentialEntitlements: { makerTypes: ["*"], checkerTypes: ["*"] },
    },
    trustedSourcePolicy: { trusted: true, sourceSystem: "demo-his", minDqiScore: 85 },
    dqiSummary: mappingResult.dqiSummary,
    canonicalFhir: mappingResult.canonicalFhir,
    documentReference: documentPackage.documentReference,
    holderDid: "did:web:wallet.example:synthetic-patient",
    correlationId: DEMO_CORRELATION_ID,
  }, { minDqiScore: 85, now });

  const credentialRef = {
    id: vcRoute.requestDraft?.requestId ?? "draft-vc-request-scalable-fabric-demo",
    type: "PatientSummaryCredential",
    format: "jwt-vc",
    digest: sha256({
      requestId: vcRoute.requestDraft?.requestId,
      credentialType: vcRoute.credentialType,
      route: vcRoute.route,
    }),
  };
  const packet = await buildVpShlPacket({
    credentials: [credentialRef],
    documentReferences: documentPackage.documentReference ? [documentPackage.documentReference] : [],
    fhirBundle: mappingResult.canonicalFhir?.bundle,
    holderDid: "did:web:wallet.example:synthetic-patient",
    purpose: "treatment",
    audience: "https://trustcare.example/verifier/intake",
    context: DEMO_CONTEXT,
    estimatedBytes: 72_000,
    manifestBaseUrl: "https://trustcare.example/shl/manifest",
    viewerBaseUrl: "https://trustcare.example/shl/view",
    passcodeRequired: true,
    longTerm: false,
  }, {
    jobId: "job-demo-packet",
    forceMode: "shl_packet",
    now,
  });

  const verifierIntake = buildVerifierIntakeSummary(packet, vcRoute);
  const syncPlan = buildSyncBackPlanResult({
    targetKind: "hl7v2",
    operation: "update",
    resource: {
      resourceType: "Patient",
      id: `patient-${DEMO_PATIENT_ID}`,
      identifier: [{ system: "https://trustcare.network/demo/patient", value: "synthetic-wallet-patient" }],
    },
    sourceEventId: "source-event-scalable-fabric-demo",
    patientBusinessKey: "synthetic-wallet-patient",
    reason: "service-readiness-demo-sync-back",
    occurredAt: DEMO_NOW,
  }, {
    jobId: "job-demo-sync-plan",
    actorId: "integration-worker-demo",
    occurredAt: DEMO_NOW,
    persistReconciliation: false,
  });
  const syncExecution = await buildSyncBackExecuteResult({
    plan: syncPlan.plan,
    accepted: true,
    actorId: "integration-worker-demo",
    executedAt: DEMO_NOW,
  }, {
    jobId: "job-demo-sync-execute",
    actorId: "integration-worker-demo",
    executedAt: DEMO_NOW,
    persistReconciliation: false,
  });
  const reconciliation = await runSyncReconciliation({
    reconciliation: syncExecution.execution.reconciliation,
  }, {
    jobId: "job-demo-reconciliation",
    now: DEMO_NOW,
    persistReconciliation: false,
  });
  const adapterHealth = evaluateEdgeConnectorRuntime({
    id: DEMO_ADAPTER_ID,
    hospitalId: DEMO_HOSPITAL_ID,
    name: "Synthetic HIS Adapter",
    status: "active",
    systemType: "his",
    connectorPattern: "hl7v2",
    connectionConfig: {
      endpoint: "mock://edge-connector/synthetic-his",
      runtime: {
        maxConcurrency: 2,
        throttlePerMinute: 30,
        activeJobs: 1,
        queuedJobs: 0,
        localBufferDepth: 0,
        localBufferLimit: 100,
      },
    },
    mappingVersionId: 1,
  }, { now });

  const steps: ScalableFabricDemoStep[] = [
    step("job_creation", "queued", "import.source_payload", { idempotent: true }),
    step("adapter_health", adapterHealth.healthStatus, "adapter.health_check", {
      adapterId: adapterHealth.adapterId,
      canAcceptJobs: adapterHealth.canAcceptJobs,
      backpressureState: adapterHealth.backpressure.state,
      circuitState: adapterHealth.circuitBreaker.state,
    }),
    step("import", importResult.status, "import.source_payload", {
      sourceType: importResult.sourceType,
      payloadHash: importResult.payloadHash,
    }),
    step("mapping", mappingResult.status, "mapping.canonicalize_fhir", {
      dqiOverall: mappingResult.dqiSummary.overall,
      grade: mappingResult.dqiSummary.grade,
      bundleHash: mappingResult.canonicalFhir?.summary.bundleHash,
    }),
    step("document_reference", documentPackage.status, "document.create_reference", {
      reviewState: documentPackage.reviewState,
      documentReferenceId: documentPackage.documentReference?.id,
      objectHash: documentPackage.objectReference?.hash,
      noBinaryStored: documentPackage.objectReference?.noBinaryStored,
    }),
    step("vc_issuance", vcRoute.status, "vc.issue", {
      route: vcRoute.route,
      credentialType: vcRoute.credentialType,
      requestId: vcRoute.requestDraft?.requestId,
      checkerReviewRequired: vcRoute.makerChecker.requiredBeforeIssue,
    }),
    step("vp_shl_packet", packet.status, "shl.build_packet", {
      mode: packet.mode,
      manifestToken: packet.shlPacket?.manifestToken,
      manifestHash: packet.shlPacket?.manifestHash,
      fileCount: packet.shlPacket?.files?.length,
      rawSecretReturned: false,
    }),
    step("verifier_intake", verifierIntake.status, "verifier.intake", verifierIntake),
    step("sync_back", syncExecution.status, "sync_back.execute", {
      planId: syncExecution.plan.id,
      executionId: syncExecution.execution.id,
      targetKind: syncExecution.execution.targetKind,
      syncReceiptId: syncExecution.syncReceipt.id,
    }),
    step("reconciliation", reconciliation.status, "reconciliation.run", {
      reconciliationId: reconciliation.reconciliation.id,
      resultStatus: reconciliation.result.status,
      attempts: reconciliation.result.attempts,
    }),
  ];
  const traceEvents = buildTraceEvents(steps);
  const troubleshootingIndex = buildFabricTroubleshootingIndex(DEMO_CORRELATION_ID, traceEvents);

  return {
    scenarioId: "scalable-fabric-demo-opd-readiness-v1",
    correlationId: DEMO_CORRELATION_ID,
    context: DEMO_CONTEXT,
    contractId: DEMO_CONTRACT_ID,
    contractVersion: DEMO_CONTRACT_VERSION,
    steps,
    traceEvents,
    troubleshootingIndex,
    finalState: {
      verifierStatus: verifierIntake.status,
      packetMode: packet.mode,
      vcRoute: vcRoute.route,
      syncBackStatus: syncExecution.status,
      reconciliationStatus: reconciliation.result.status,
      manifestHash: packet.shlPacket?.manifestHash,
      syncReceiptId: syncExecution.syncReceipt.id,
      noRawSecretsReturned: true,
      noBinaryStored: true,
    },
  };
}

function syntheticHisDbViewPayload(): JsonRecord {
  return {
    patient_master: {
      hn: "SYNTH-HN-9001",
      cid_hash: "sha256-synthetic-cid",
      carepass_id: "CP-SYNTH-9001",
      name_th: "Synthetic Wallet Patient",
      birth_date: "1985-03-15",
      sex: "F",
    },
    opd_visit: {
      vn: "SYNTH-VN-20260705-001",
      visit_date: "2026-07-05T09:00:00+07:00",
      class: "OPD",
    },
    dx: [{ icd10: "E11", display: "Type 2 diabetes mellitus" }],
    allergy: [{ agent_name: "Penicillin", severity: "high" }],
    rx: [{ item_code: "TMT-SYNTH-001", drug_name: "Metformin", sig_th: "synthetic twice daily instruction" }],
    lis_result: [{ test_code: "4548-4", test_name: "Hemoglobin A1c", result_value: "6.8", unit: "%" }],
  };
}

function buildVerifierIntakeSummary(packet: Awaited<ReturnType<typeof buildVpShlPacket>>, vcRoute: ReturnType<typeof routeVcIssuanceRequest>): JsonRecord {
  const manifestHash = typeof packet.shlPacket?.manifestHash === "string" && packet.shlPacket.manifestHash.length > 0;
  return {
    status: packet.status === "ready" && vcRoute.route !== "blocked" && manifestHash ? "verified" : "needs_review",
    issuerTrust: vcRoute.route !== "blocked",
    holderConsent: true,
    manifestIntegrity: manifestHash,
    objectLinksPresent: Number(packet.shlPacket?.files?.length ?? 0) > 0,
    rawSecretReturned: false,
  };
}

function step(
  stage: ScalableFabricDemoStep["stage"],
  status: string,
  jobType: string,
  metadata: JsonRecord = {},
): ScalableFabricDemoStep {
  return {
    stage,
    status,
    jobType,
    artifactRef: metadata.manifestHash ?? metadata.syncReceiptId ?? metadata.documentReferenceId ?? metadata.requestId,
    metadata,
  };
}

function buildTraceEvents(steps: ScalableFabricDemoStep[]): FabricTraceEventLike[] {
  return steps.map((item, index) => {
    const traceStage = item.stage === "verifier_intake" ? "shl_access" : item.stage;
    const trace = buildFabricTraceContext({
      stage: traceStage,
      correlationId: DEMO_CORRELATION_ID,
      jobId: `job-demo-${index.toString().padStart(2, "0")}`,
      hospitalId: DEMO_HOSPITAL_ID,
      patientId: DEMO_PATIENT_ID,
      adapterId: item.stage === "adapter_health" ? DEMO_ADAPTER_ID : undefined,
      context: DEMO_CONTEXT,
      contractId: DEMO_CONTRACT_ID,
      contractVersion: DEMO_CONTRACT_VERSION,
      manifestToken: typeof item.metadata?.manifestToken === "string" ? item.metadata.manifestToken : undefined,
      syncId: typeof item.metadata?.syncReceiptId === "string" ? item.metadata.syncReceiptId : undefined,
      reconciliationId: typeof item.metadata?.reconciliationId === "string" ? item.metadata.reconciliationId : undefined,
      metadata: {
        jobType: item.jobType,
        ...item.metadata,
      },
    });
    return {
      correlationId: trace.correlationId,
      jobId: trace.jobId,
      eventType: eventTypeForStage(item.stage),
      level: item.status === "needs_review" ? "warning" : "info",
      status: item.status === "healthy" || item.status === "verified" ? "succeeded" : item.status,
      message: `Demo ${item.stage} stage ${item.status}`,
      metadata: trace.metadata,
      createdAt: DEMO_NOW,
    };
  });
}

function eventTypeForStage(stage: ScalableFabricDemoStep["stage"]): string {
  switch (stage) {
    case "job_creation": return "job_queued";
    case "adapter_health": return "adapter_health_healthy";
    case "import": return "source_payload_imported";
    case "mapping": return "mapping_dqi_ready";
    case "document_reference": return "document_reference_ready";
    case "vc_issuance": return "vc_issuance_route_ready";
    case "vp_shl_packet": return "packet_builder_ready";
    case "verifier_intake": return "shl_access_verified";
    case "sync_back": return "sync_back_executed";
    case "reconciliation": return "reconciliation_completed";
    default: return "job_event";
  }
}
