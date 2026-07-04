import { describe, expect, it } from "vitest";
import { buildQueuedIntegrationJob } from "./jobs/dbQueue";
import { buildLegacyDocumentReferencePackage } from "./jobs/documentReferencePipeline";
import {
  VC_ISSUANCE_CREDENTIAL_TYPES,
  registerVcIssuanceHandler,
  routeVcIssuanceRequest,
} from "./jobs/vcIssuanceWorker";
import { IntegrationJobHandlerRegistry, IntegrationJobWorkerRuntime } from "./jobs/runtime";

const makerActor = {
  id: 501,
  systemRole: "hospital_admin",
  credentialEntitlements: { makerTypes: ["*"], checkerTypes: ["*"] },
};

describe("VC issuance routing worker", () => {
  it("routes trusted high-DQI canonical output to Checker review without issuing VC", () => {
    const result = routeVcIssuanceRequest({
      credentialType: "patient_summary",
      status: "ready",
      patientId: 42,
      hospitalId: 7,
      actor: makerActor,
      trustedSourcePolicy: { trusted: true, sourceSystem: "demo-his", minDqiScore: 85 },
      dqiSummary: { overall: 96, grade: "A" },
      canonicalFhir: {
        summary: {
          bundleHash: "sha256-synthetic-bundle",
          resourceCounts: { Patient: 1, Observation: 2 },
        },
        bundle: { resourceType: "Bundle", type: "document" },
      },
    }, { now: () => new Date("2026-07-04T11:00:00.000Z") });

    expect(result.status).toBe("ready");
    expect(result.route).toBe("auto_ready_for_checker");
    expect(result.requestDraft).toMatchObject({
      status: "submitted",
      type: "patient_summary",
      makerId: 501,
      vcIssuance: "not_started",
    });
    expect(result.makerChecker).toMatchObject({ required: true, requiredBeforeIssue: true, nextAction: "submit_to_checker_queue" });
    expect(JSON.stringify(result)).not.toContain("sdJwtVc");
    expect(result.auditEvents[0].details.vcIssued).toBe(false);
  });

  it("routes low-DQI or untrusted source output to Maker review", () => {
    const result = routeVcIssuanceRequest({
      credentialType: "patient_summary",
      status: "ready",
      patientId: 42,
      hospitalId: 7,
      actor: makerActor,
      trustedSourcePolicy: { trusted: false, sourceSystem: "csv-import", minDqiScore: 85 },
      dqiSummary: { overall: 72, grade: "C" },
      canonicalFhir: {
        summary: { bundleHash: "sha256-low-dqi", resourceCounts: { Patient: 1 } },
        bundle: { resourceType: "Bundle", type: "document" },
      },
    });

    expect(result.status).toBe("needs_review");
    expect(result.route).toBe("maker_review_required");
    expect(result.requestDraft?.status).toBe("draft");
    expect(result.issues.some((issue) => issue.ruleId === "VC-ROUTE-003")).toBe(true);
    expect(result.issues.some((issue) => issue.ruleId === "VC-ROUTE-004")).toBe(true);
  });

  it("blocks patient actors from Maker/Checker routing", () => {
    const result = routeVcIssuanceRequest({
      credentialType: "patient_summary",
      status: "ready",
      patientId: 42,
      hospitalId: 7,
      actor: {
        id: 42,
        systemRole: "patient",
        credentialEntitlements: { makerTypes: ["*"], checkerTypes: ["*"] },
      },
      trustedSourcePolicy: { trusted: true },
      dqiSummary: { overall: 99 },
      canonicalFhir: {
        summary: { bundleHash: "sha256-patient", resourceCounts: { Patient: 1 } },
        bundle: { resourceType: "Bundle", type: "document" },
      },
    });

    expect(result.status).toBe("needs_review");
    expect(result.route).toBe("blocked");
    expect(result.requestDraft).toBeUndefined();
    expect(result.issues.some((issue) => issue.ruleId === "VC-ROUTE-005")).toBe(true);
  });

  it("infers an existing enum credential type from DocumentReference metadata", () => {
    const documentPackage = buildLegacyDocumentReferencePackage({
      documentType: "lab_report",
      contentType: "application/pdf",
      objectRef: "mock://object-store/lab-report.pdf",
      hash: "sha256-synthetic-lab-report",
    });
    const result = routeVcIssuanceRequest({
      status: "ready",
      patientId: 42,
      hospitalId: 7,
      actor: {
        ...makerActor,
        credentialEntitlements: { makerTypes: ["lab_result"], checkerTypes: ["lab_result"] },
      },
      trustedSourcePolicy: { trusted: true },
      dqiSummary: { overall: 94 },
      documentReferencePackage: documentPackage,
    });

    expect(result.credentialType).toBe("lab_result");
    expect(VC_ISSUANCE_CREDENTIAL_TYPES).toContain(result.credentialType);
    expect(result.route).toBe("auto_ready_for_checker");
  });

  it("registers vc.issue with runtime and keeps actual issuance out of the job", async () => {
    const registry = new IntegrationJobHandlerRegistry();
    registerVcIssuanceHandler(registry);
    const runtime = new IntegrationJobWorkerRuntime({ registry });
    const job = buildQueuedIntegrationJob({
      jobType: "vc.issue",
      sourceType: "fhir_native",
      patientId: 42,
      hospitalId: 7,
      context: "opd_visit",
      correlationId: "corr-vc-route-001",
      payload: {
        credentialType: "patient_summary",
        status: "ready",
        patientId: 42,
        hospitalId: 7,
        actor: makerActor,
        trustedSourcePolicy: { trusted: true },
        dqiSummary: { overall: 96 },
        canonicalFhir: {
          summary: { bundleHash: "sha256-runtime", resourceCounts: { Patient: 1 } },
          bundle: { resourceType: "Bundle", type: "document" },
        },
      },
    });

    const result = await runtime.process(job);

    expect(result.status).toBe("succeeded");
    expect(result.events.some((event) => event.eventType === "vc_issuance_route_ready")).toBe(true);
    expect(JSON.stringify(result)).not.toContain("verifiableCredential");
    expect(JSON.stringify(result)).not.toContain("sdJwtVc");
  });
});
