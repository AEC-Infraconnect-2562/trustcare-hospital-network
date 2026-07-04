import { describe, expect, it } from "vitest";
import { buildQueuedIntegrationJob } from "./jobs/dbQueue";
import {
  buildVpShlPacket,
  registerVpShlPacketBuilderHandlers,
} from "./jobs/vpShlPacketBuilder";
import { IntegrationJobHandlerRegistry, IntegrationJobWorkerRuntime } from "./jobs/runtime";

const credential = {
  id: "urn:trustcare:vc:synthetic-patient-summary",
  type: "PatientSummaryCredential",
  format: "jwt-vc",
  digest: "sha256-synthetic-credential",
  jwt: "synthetic-vc-jwt-not-returned-as-vp",
};

const fhirBundle = {
  resourceType: "Bundle",
  type: "document",
  entry: [{ resource: { resourceType: "Patient", id: "42" } }],
};

const documentReference = {
  resourceType: "DocumentReference",
  id: "docref-synthetic-lab",
  status: "current",
  type: { coding: [{ system: "https://trustcare.network/fhir/document-type", code: "lab_report" }], text: "lab_report" },
  content: [{
    attachment: {
      contentType: "application/pdf",
      url: "mock://object-store/lab-report.pdf",
      hash: "sha256-synthetic-lab-report",
    },
  }],
};

describe("VP/SHL packet builder worker", () => {
  it("builds direct VP metadata for a small single-credential packet", async () => {
    const result = await buildVpShlPacket({
      credentials: [credential],
      holderDid: "did:web:wallet.example:patient42",
      purpose: "treatment",
      audience: "https://verifier.example/intake",
      context: "opd_visit",
    }, { now: () => new Date("2026-07-04T12:00:00.000Z") });

    expect(result.status).toBe("ready");
    expect(result.mode).toBe("direct_vp");
    expect(result.vpPackage).toMatchObject({
      format: "jwt-vp",
      status: "metadata_only_not_signed",
      rawJwtReturned: false,
    });
    expect(result.shlPacket).toBeUndefined();
  });

  it("builds SHL packet metadata for large or mixed bundles without returning raw secrets", async () => {
    const result = await buildVpShlPacket({
      credentials: [credential],
      fhirBundle,
      documentReferences: [documentReference],
      holderDid: "did:web:wallet.example:patient42",
      purpose: "referral",
      audience: "https://receiver.example/referral",
      context: "referral",
      estimatedBytes: 55_000,
      manifestBaseUrl: "https://trustcare.example/shl/manifest",
      passcodeRequired: true,
      passcode: "raw-passcode-should-not-return",
      shlKey: "raw-shl-key-should-not-return",
    });
    const serialized = JSON.stringify(result);

    expect(result.status).toBe("ready");
    expect(result.mode).toBe("shl_packet");
    expect(result.shlPacket?.manifestCredential).toMatchObject({
      credentialType: "ShlManifestCredential",
      status: "metadata_only_not_issued",
      vcIssuance: "maker_checker_required",
    });
    expect(result.shlPacket?.files.length).toBeGreaterThanOrEqual(2);
    expect(result.packetMetadata).toMatchObject({
      rawShlKeyReturned: false,
      rawPasscodeReturned: false,
      shlContextVersioningReviewed: true,
    });
    expect(serialized).not.toContain("raw-passcode-should-not-return");
    expect(serialized).not.toContain("raw-shl-key-should-not-return");
    expect(serialized).not.toContain("shlink:/");
  });

  it("registers vp.build with runtime for small VP packets", async () => {
    const registry = new IntegrationJobHandlerRegistry();
    registerVpShlPacketBuilderHandlers(registry);
    const runtime = new IntegrationJobWorkerRuntime({ registry });
    const job = buildQueuedIntegrationJob({
      jobType: "vp.build",
      sourceType: "native_vc_vp",
      patientId: 42,
      context: "opd_visit",
      correlationId: "corr-vp-build-001",
      payload: {
        credentials: [credential],
        holderDid: "did:web:wallet.example:patient42",
        purpose: "treatment",
      },
    });

    const result = await runtime.process(job);

    expect(result.status).toBe("succeeded");
    expect(result.events.some((event) => event.eventType === "packet_builder_ready")).toBe(true);
    expect(JSON.stringify(result)).not.toContain("shlink:/");
  });

  it("forces shl.build_packet jobs to produce SHL packet metadata", async () => {
    const registry = new IntegrationJobHandlerRegistry();
    registerVpShlPacketBuilderHandlers(registry);
    const runtime = new IntegrationJobWorkerRuntime({ registry });
    const job = buildQueuedIntegrationJob({
      jobType: "shl.build_packet",
      sourceType: "smart_health_link",
      patientId: 42,
      context: "opd_visit",
      correlationId: "corr-shl-build-001",
      payload: {
        credentials: [credential],
        holderDid: "did:web:wallet.example:patient42",
        purpose: "treatment",
      },
    });

    const result = await runtime.process(job);

    expect(result.status).toBe("succeeded");
    expect(result.result).toMatchObject({ mode: "shl_packet" });
    expect(JSON.stringify(result)).not.toContain("raw-shl-key");
  });
});
