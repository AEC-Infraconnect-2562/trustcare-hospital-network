import { describe, expect, it } from "vitest";
import {
  assertIntegrationJobTransition,
  buildIntegrationJobIdempotencyKey,
  buildQueuedIntegrationJob,
  canTransitionIntegrationJobStatus,
  normalizeIntegrationJobListFilter,
  redactSensitiveJobPayload,
} from "./jobs/dbQueue";

const baseJobInput = {
  tenantId: "trustcare-network",
  hospitalId: 101,
  patientId: 202,
  context: "referral" as const,
  contractId: "referral_readiness_v1",
  contractVersion: "1.0.0",
  jobType: "import.source_payload" as const,
  sourceType: "his_db_view" as const,
  sourceRef: "demo-his-view:referral-2026-07-04",
  correlationId: "corr-demo-referral",
  payload: {
    sourceSystem: "demo-his",
    hn: "DEMO-HN-001",
    patient: {
      name: "Demo Patient",
      phone: "0000000000",
      visitId: "VISIT-001",
    },
    documentReference: "DocumentReference/demo-001",
  },
};

describe("integration job queue foundation", () => {
  it("builds stable idempotency keys from contract-scoped source input", () => {
    const first = buildIntegrationJobIdempotencyKey(baseJobInput);
    const second = buildIntegrationJobIdempotencyKey({ ...baseJobInput });
    const changedContract = buildIntegrationJobIdempotencyKey({
      ...baseJobInput,
      contractVersion: "1.0.1",
    });

    expect(first).toMatch(/^idem_[a-f0-9]{48}$/);
    expect(second).toBe(first);
    expect(changedContract).not.toBe(first);
  });

  it("creates queued job metadata without exposing PHI-like payload fields", () => {
    const job = buildQueuedIntegrationJob(baseJobInput);

    expect(job.jobId).toMatch(/^job_/);
    expect(job.status).toBe("queued");
    expect(job.tenantId).toBe("trustcare-network");
    expect(job.correlationId).toBe("corr-demo-referral");
    expect(job.idempotencyKey).toMatch(/^idem_[a-f0-9]{48}$/);
    expect(job.payloadHash).toMatch(/^[a-f0-9]{64}$/);
    expect(job.attempts).toBe(0);
    expect(job.maxAttempts).toBe(3);
    expect(job.payload).toEqual({
      sourceSystem: "demo-his",
      hn: "[REDACTED]",
      patient: {
        name: "[REDACTED]",
        phone: "[REDACTED]",
        visitId: "VISIT-001",
      },
      documentReference: "DocumentReference/demo-001",
    });
  });

  it("redacts nested secret and SHL transport fields before logging metadata", () => {
    const redacted = redactSensitiveJobPayload({
      passcode: "do-not-log",
      shlKey: "do-not-log",
      credentials: [{ jwt: "do-not-log", issuer: "did:web:issuer.example" }],
      safe: { correlationId: "corr-safe" },
    });

    expect(redacted).toEqual({
      passcode: "[REDACTED]",
      shlKey: "[REDACTED]",
      credentials: [{ jwt: "[REDACTED]", issuer: "did:web:issuer.example" }],
      safe: { correlationId: "corr-safe" },
    });
  });

  it("enforces retry-safe job status transitions", () => {
    expect(canTransitionIntegrationJobStatus("queued", "claimed")).toBe(true);
    expect(canTransitionIntegrationJobStatus("running", "needs_review")).toBe(true);
    expect(canTransitionIntegrationJobStatus("failed", "queued")).toBe(true);
    expect(canTransitionIntegrationJobStatus("succeeded", "running")).toBe(false);
    expect(() => assertIntegrationJobTransition("dead_lettered", "queued")).toThrow(/Invalid integration job transition/);
  });

  it("normalizes job list filters for tenant-scoped monitor queries", () => {
    expect(normalizeIntegrationJobListFilter({ limit: 999 })).toEqual({
      tenantId: "trustcare-network",
      limit: 200,
    });
    expect(normalizeIntegrationJobListFilter({ tenantId: " hospital-a ", status: "queued", limit: 0 })).toEqual({
      tenantId: "hospital-a",
      status: "queued",
      limit: 1,
    });
  });
});
