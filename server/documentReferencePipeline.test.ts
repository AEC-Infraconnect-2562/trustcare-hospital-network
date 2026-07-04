import { describe, expect, it } from "vitest";
import { buildQueuedIntegrationJob } from "./jobs/dbQueue";
import {
  buildLegacyDocumentReferencePackage,
  registerDocumentReferencePipelineHandler,
} from "./jobs/documentReferencePipeline";
import { IntegrationJobHandlerRegistry, IntegrationJobWorkerRuntime } from "./jobs/runtime";

const validDocumentMetadata = {
  title: "Synthetic referral scan",
  documentType: "referral_letter",
  contentType: "application/pdf",
  objectRef: "mock://object-store/referral-scan.pdf",
  fileName: "referral-scan.pdf",
  sizeBytes: 12345,
  hash: "sha256-synthetic-referral",
  sourceSystem: "partner-portal-demo",
  sourceDocumentId: "src-doc-001",
  sourceJobId: "job-import-001",
};

describe("DocumentReference pipeline worker", () => {
  it("converts legacy file metadata into DocumentReference, Provenance, and artifact descriptors", () => {
    const result = buildLegacyDocumentReferencePackage(validDocumentMetadata, {
      patientId: 42,
      hospitalId: 7,
      context: "referral",
      contractId: "referral_readiness_v1",
      contractVersion: "2026.07.prepare-service.v1",
      now: () => new Date("2026-07-04T10:00:00.000Z"),
    });

    expect(result.status).toBe("ready");
    expect(result.reviewState).toBe("ready_for_maker_review");
    expect(result.documentReference).toMatchObject({
      resourceType: "DocumentReference",
      status: "current",
      docStatus: "preliminary",
      subject: { reference: "Patient/42" },
      custodian: { reference: "Organization/7" },
    });
    expect(result.documentReference?.content[0].attachment).toMatchObject({
      contentType: "application/pdf",
      url: "mock://object-store/referral-scan.pdf",
      hash: "sha256-synthetic-referral",
    });
    expect(result.provenance?.target[0].reference).toBe(`DocumentReference/${result.documentReference?.id}`);
    expect(result.artifacts.some((artifact) => artifact.artifactType === "document_reference")).toBe(true);
    expect(result.artifacts.some((artifact) => artifact.artifactType === "object_reference")).toBe(true);
    expect(result.objectReference).toMatchObject({ storageKind: "mock_reference", noBinaryStored: true });
  });

  it("routes missing content hash to needs_review instead of creating a DocumentReference", () => {
    const result = buildLegacyDocumentReferencePackage({
      ...validDocumentMetadata,
      hash: undefined,
    });

    expect(result.status).toBe("needs_review");
    expect(result.reviewState).toBe("needs_source_review");
    expect(result.documentReference).toBeUndefined();
    expect(result.issues.some((issue) => issue.ruleId === "DOC-REF-001")).toBe(true);
    expect(result.artifacts[0].artifactType).toBe("operation_outcome");
  });

  it("rejects inline binary payloads and does not echo the binary in the result", () => {
    const result = buildLegacyDocumentReferencePackage({
      ...validDocumentMetadata,
      fileBase64: "raw-binary-should-not-persist",
    });

    expect(result.status).toBe("needs_review");
    expect(result.issues.some((issue) => issue.ruleId === "DOC-REF-004")).toBe(true);
    expect(JSON.stringify(result)).not.toContain("raw-binary-should-not-persist");
  });

  it("accepts a DocumentReference candidate from the mapping worker and links provenance to it", () => {
    const result = buildLegacyDocumentReferencePackage({
      documentReferenceCandidate: {
        resourceType: "DocumentReference",
        id: "docref-candidate-001",
        type: { text: "lab_report" },
        content: [{
          attachment: {
            contentType: "application/pdf",
            url: "object://lab/lab-report.pdf",
            title: "lab-report.pdf",
            hash: "sha256-synthetic-lab",
          },
        }],
      },
      sourceJobId: "job-map-001",
    });

    expect(result.status).toBe("ready");
    expect(result.documentReference?.id).toBe("docref-candidate-001");
    expect(result.provenance?.entity[0].what.display).toBe("object://lab/lab-report.pdf");
  });

  it("registers document.create_reference with the worker runtime", async () => {
    const registry = new IntegrationJobHandlerRegistry();
    registerDocumentReferencePipelineHandler(registry);
    const runtime = new IntegrationJobWorkerRuntime({ registry });
    const job = buildQueuedIntegrationJob({
      jobType: "document.create_reference",
      sourceType: "document_metadata",
      patientId: 42,
      hospitalId: 7,
      context: "referral",
      correlationId: "corr-docref-001",
      payload: validDocumentMetadata,
    });

    const result = await runtime.process(job);

    expect(result.status).toBe("succeeded");
    expect(result.events.some((event) => event.eventType === "document_reference_ready")).toBe(true);
    expect(JSON.stringify(result)).not.toContain("fileBase64");
  });
});
