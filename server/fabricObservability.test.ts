import { describe, expect, it } from "vitest";
import {
  buildFabricTraceContext,
  buildFabricTroubleshootingIndex,
  findSensitiveMetadata,
  inferFabricTraceStage,
} from "./jobs/observability";

describe("fabric observability", () => {
  it("builds PHI-safe trace context with a stable correlation id", () => {
    const trace = buildFabricTraceContext({
      stage: "vc_issuance",
      correlationId: "corr-vc-123",
      jobId: "job-123",
      hospitalId: 10,
      patientId: 20,
      adapterId: 30,
      contractId: "opd_readiness_v1",
      credentialId: "cred-123",
      metadata: {
        issuer: "did:web:issuer.example",
        patient: { name: "Demo Patient" },
        passcode: "do-not-log",
      },
    });

    expect(trace).toMatchObject({
      stage: "vc_issuance",
      correlationId: "corr-vc-123",
      jobId: "job-123",
      hospitalId: 10,
      patientId: 20,
      adapterId: 30,
      contractId: "opd_readiness_v1",
      credentialId: "cred-123",
    });
    expect(trace.metadata).toEqual({
      issuer: "did:web:issuer.example",
      patient: { name: "[REDACTED]" },
      passcode: "[REDACTED]",
    });
  });

  it("detects unredacted sensitive metadata keys", () => {
    const findings = findSensitiveMetadata({
      safe: "ok",
      jwt: "raw-token",
      nested: {
        phone: "0000000000",
        shlKey: "[REDACTED]",
      },
    });

    expect(findings).toEqual([
      { path: "metadata.jwt", key: "jwt" },
      { path: "metadata.nested.phone", key: "phone" },
    ]);
  });

  it("infers fabric stages from job events", () => {
    expect(inferFabricTraceStage({ eventType: "source_payload_imported" })).toBe("import");
    expect(inferFabricTraceStage({ eventType: "mapping_dqi_needs_review" })).toBe("mapping");
    expect(inferFabricTraceStage({ eventType: "document_reference_ready" })).toBe("document_reference");
    expect(inferFabricTraceStage({ eventType: "vc_issuance_route_ready" })).toBe("vc_issuance");
    expect(inferFabricTraceStage({ eventType: "packet_builder_ready" })).toBe("vp_shl_packet");
    expect(inferFabricTraceStage({ eventType: "adapter_health_down" })).toBe("adapter_health");
  });

  it("builds troubleshooting index and root-cause hints by correlation id", () => {
    const index = buildFabricTroubleshootingIndex("corr-trace-001", [
      {
        correlationId: "corr-trace-001",
        jobId: "job-1",
        eventType: "job_queued",
        level: "info",
        status: "queued",
        metadata: { jobType: "sync_back.execute" },
      },
      {
        correlationId: "corr-trace-001",
        jobId: "job-1",
        eventType: "adapter_health_down",
        level: "warning",
        status: "needs_review",
        metadata: { canAcceptJobs: false, adapterId: 9 },
      },
      {
        correlationId: "corr-trace-001",
        jobId: "job-1",
        eventType: "sync_back_needs_review",
        level: "warning",
        status: "needs_review",
        metadata: { targetKind: "hl7v2" },
      },
      {
        correlationId: "corr-trace-001",
        jobId: "job-1",
        eventType: "job_dead_lettered",
        level: "error",
        status: "dead_lettered",
        metadata: { errorName: "TimeoutError" },
      },
      {
        correlationId: "corr-other",
        eventType: "mapping_dqi_ready",
        level: "info",
        status: "succeeded",
      },
    ]);

    expect(index).toMatchObject({
      correlationId: "corr-trace-001",
      eventCount: 4,
      latestStatus: "dead_lettered",
      levelCounts: { info: 1, warning: 2, error: 1 },
    });
    expect(index.stagesPresent).toEqual(["job_creation", "sync_back", "adapter_health"]);
    expect(index.rootCauseHints).toContain("Check adapter health, backpressure, circuit breaker, and mapping version.");
    expect(index.rootCauseHints).toContain("Inspect the dead-letter event, fix the input or adapter, then create a new idempotent job.");
    expect(index.sensitiveFindings).toEqual([]);
  });
});
