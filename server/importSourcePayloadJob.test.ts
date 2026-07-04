import { describe, expect, it } from "vitest";
import { buildQueuedIntegrationJob } from "./jobs/dbQueue";
import { buildImportSourcePayloadHandler, normalizeSourcePayload, registerImportSourcePayloadHandler } from "./jobs/importSourcePayload";
import { IntegrationJobHandlerRegistry, IntegrationJobWorkerRuntime } from "./jobs/runtime";

const contract = {
  contractId: "opd_visit_readiness_v1",
  contractVersion: "2026.07.prepare-service.v1",
  context: "opd_visit",
};

describe("import source payload job handler", () => {
  it("normalizes HIS DB view payloads without issuing VC", () => {
    const result = normalizeSourcePayload(
      "his_db_view",
      {
        patient_master: { hn: "HN-DEMO-001", full_name_th: "Demo Patient", birth_date: "1985-01-01" },
        opd_visit: { vn: "VN-001", visit_date: "2026-07-04T09:00:00+07:00" },
        dx: [{ icd10: "E11", display: "Type 2 diabetes" }],
      },
      contract.contractId,
      contract.contractVersion,
      contract.context,
    );

    expect(result.status).toBe("ready");
    expect(result.normalizedSource).toMatchObject({
      sourceFormat: "db_view",
      payload: {
        patient: { hn: "HN-DEMO-001" },
        encounter: { vn: "VN-001" },
      },
    });
  });

  it("accepts HL7v2 and rejects malformed HL7v2 payloads", () => {
    const hl7 = "MSH|^~\\&|HIS|TRUSTCARE|PORTABILITY|TRUSTCARE|202607010900||ADT^A01|MSG0001|P|2.5";

    expect(normalizeSourcePayload("hl7v2", hl7, contract.contractId, contract.contractVersion, contract.context).status).toBe("ready");
    expect(normalizeSourcePayload("hl7v2", "PID|1|missing-msh", contract.contractId, contract.contractVersion, contract.context)).toMatchObject({
      status: "needs_review",
      reviewReason: "HL7 v2 payload must start with an MSH segment.",
    });
  });

  it("routes incomplete CSV imports to review", () => {
    const csv = [
      "hospital_code,hn,full_name_th,birth_date,visit_no,diagnosis_code",
      "H001,HN-1,,19850101,VN-1,E11",
    ].join("\n");

    const result = normalizeSourcePayload("csv", csv, contract.contractId, contract.contractVersion, contract.context);

    expect(result.status).toBe("needs_review");
    expect(result.reviewReason).toBe("One or more CSV rows need mapping review.");
  });

  it("accepts FHIR-native and legacy document metadata imports", () => {
    const fhir = normalizeSourcePayload("fhir_native", { resourceType: "Bundle", type: "document" }, contract.contractId, contract.contractVersion, contract.context);
    const document = normalizeSourcePayload(
      "document_metadata",
      { hash: "sha256-demo", contentType: "application/pdf", objectRef: "s3://demo/object.pdf" },
      contract.contractId,
      contract.contractVersion,
      contract.context,
    );

    expect(fhir.status).toBe("ready");
    expect(document.status).toBe("ready");
    expect(document.normalizedSource).toMatchObject({ sourceFormat: "document_metadata" });
  });

  it("registers a runtime handler and leaves trust-layer imports for later review", async () => {
    const registry = new IntegrationJobHandlerRegistry();
    registerImportSourcePayloadHandler(registry);
    const runtime = new IntegrationJobWorkerRuntime({ registry });
    const job = buildQueuedIntegrationJob({
      jobType: "import.source_payload",
      sourceType: "smart_health_link",
      context: "referral",
      contractId: "referral_readiness_v1",
      sourceRef: "synthetic-shl",
      correlationId: "corr-import-shl",
      payload: { shlKey: "do-not-log", manifestUrl: "https://example.test/manifest.json" },
    });

    const result = await runtime.process(job);

    expect(result.status).toBe("needs_review");
    expect(JSON.stringify(result)).not.toContain("do-not-log");
    expect(result.events.some((event) => event.eventType === "source_payload_needs_review")).toBe(true);
  });

  it("can build a standalone import handler for unit-level use", async () => {
    const handler = buildImportSourcePayloadHandler();
    const events: unknown[] = [];
    const output = await handler({
      job: buildQueuedIntegrationJob({
        jobType: "import.source_payload",
        sourceType: "fhir_native",
        context: "insurance_claim",
        payload: { resourceType: "Bundle", type: "document" },
      }),
      correlationId: "corr-unit",
      emitEvent: (event) => events.push(event),
    });

    expect(output.status).toBe("succeeded");
    expect(events).toHaveLength(2);
  });
});
