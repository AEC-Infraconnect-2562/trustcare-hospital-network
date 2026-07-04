import { describe, expect, it } from "vitest";
import { buildQueuedIntegrationJob } from "./jobs/dbQueue";
import { mapImportedPayload, registerMappingDqiHandler } from "./jobs/mappingDqiWorker";
import { IntegrationJobHandlerRegistry, IntegrationJobWorkerRuntime } from "./jobs/runtime";

const dbViewSource = {
  sourceFormat: "db_view",
  payload: {
    patient: {
      hn: "HN-10045",
      cidHash: "sha256-demo",
      name: "Demo Patient",
      birthDate: "1985-03-15",
      sex: "M",
    },
    diagnoses: [{ code: "E11", display: "Type 2 diabetes mellitus" }],
    allergies: [{ substance: "Penicillin", severity: "high" }],
  },
  sourceSystem: "demo-his",
  sourceOrganizationId: "TH-HCODE-99999",
};

describe("mapping and DQI worker", () => {
  it("produces canonical FHIR summary when DQI meets threshold", () => {
    const result = mapImportedPayload({ normalizedSource: dbViewSource }, { dqiThreshold: 70 });

    expect(result.status).toBe("ready");
    expect(result.canonicalFhir?.bundle.resourceType).toBe("Bundle");
    expect(result.canonicalFhir?.summary.resourceCounts.Patient).toBe(1);
    expect(result.dqiSummary.overall).toBeGreaterThanOrEqual(70);
    expect(result.operationOutcome.resourceType).toBe("OperationOutcome");
  });

  it("routes low DQI or missing identifiers to needs_review", () => {
    const result = mapImportedPayload({
      normalizedSource: {
        ...dbViewSource,
        payload: {
          patient: { name: "No Identifier" },
          diagnoses: [],
        },
      },
    });

    expect(result.status).toBe("needs_review");
    expect(result.issues.some((issue) => issue.ruleId === "DQ-001")).toBe(true);
    expect(result.operationOutcome.issue.length).toBeGreaterThan(0);
  });

  it("validates DocumentReference hash and content metadata", () => {
    const ready = mapImportedPayload({
      normalizedSource: {
        sourceFormat: "document_metadata",
        documentReferenceCandidate: {
          hash: "sha256-demo",
          contentType: "application/pdf",
          objectRef: "s3://demo/document.pdf",
        },
      },
    });
    const missingHash = mapImportedPayload({
      normalizedSource: {
        sourceFormat: "document_metadata",
        documentReferenceCandidate: {
          contentType: "application/pdf",
        },
      },
    });

    expect(ready.status).toBe("ready");
    expect(ready.documentReferenceCandidate?.resourceType).toBe("DocumentReference");
    expect(missingHash.status).toBe("needs_review");
    expect(missingHash.issues.some((issue) => issue.ruleId === "DQ-DOC-001")).toBe(true);
  });

  it("canonicalizes HL7v2 source payloads", () => {
    const hl7 = [
      "MSH|^~\\&|HIS|TRUSTCARE|PORTABILITY|TRUSTCARE|202607010900||ORU^R01|MSG0001|P|2.5",
      "PID|1||HN-20001^^^TRUSTCARE^MR||DEMO^PATIENT||19850315|M",
      "OBX|1|NM|4548-4^HbA1c||7.8|%|4.0-6.0|H|||F|||20260630",
    ].join("\r");

    const result = mapImportedPayload({
      normalizedSource: {
        sourceFormat: "hl7v2",
        payload: hl7,
        sourceSystem: "legacy-hl7",
        sourceOrganizationId: "TH-HCODE-88888",
      },
    });

    expect(result.canonicalFhir?.summary.resourceCounts.Patient).toBe(1);
    expect(result.canonicalFhir?.summary.resourceCounts.Observation).toBe(1);
  });

  it("registers with runtime and returns needs_review for unsupported sources", async () => {
    const registry = new IntegrationJobHandlerRegistry();
    registerMappingDqiHandler(registry);
    const runtime = new IntegrationJobWorkerRuntime({ registry });
    const job = buildQueuedIntegrationJob({
      jobType: "mapping.canonicalize_fhir",
      sourceType: "manual",
      correlationId: "corr-map-unsupported",
      payload: { normalizedSource: { sourceFormat: "unsupported", payload: {} } },
    });

    const result = await runtime.process(job);

    expect(result.status).toBe("needs_review");
    expect(result.events.some((event) => event.eventType === "mapping_dqi_needs_review")).toBe(true);
  });
});
