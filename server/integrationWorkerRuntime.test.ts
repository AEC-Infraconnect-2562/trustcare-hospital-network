import { describe, expect, it } from "vitest";
import { buildQueuedIntegrationJob } from "./jobs/dbQueue";
import { IntegrationJobHandlerRegistry, IntegrationJobWorkerRuntime } from "./jobs/runtime";

function demoJob() {
  return buildQueuedIntegrationJob({
    jobType: "import.source_payload",
    sourceType: "fhir_native",
    tenantId: "trustcare-network",
    hospitalId: 11,
    context: "opd_visit",
    contractId: "opd_readiness_v1",
    contractVersion: "1.0.0",
    correlationId: "corr-worker-demo",
    sourceRef: "synthetic-source-001",
    payload: { resourceType: "Bundle", secret: "do-not-log" },
  });
}

describe("integration worker runtime skeleton", () => {
  it("registers one handler per job type", () => {
    const registry = new IntegrationJobHandlerRegistry();
    registry.register("import.source_payload", () => ({ status: "succeeded" }));

    expect(registry.has("import.source_payload")).toBe(true);
    expect(registry.listJobTypes()).toEqual(["import.source_payload"]);
    expect(() => registry.register("import.source_payload", () => ({ status: "succeeded" }))).toThrow(/already registered/);
  });

  it("processes a job and propagates correlationId into safe events", async () => {
    const registry = new IntegrationJobHandlerRegistry();
    registry.register("import.source_payload", ({ correlationId, emitEvent }) => {
      emitEvent({
        eventType: "source_payload_normalized",
        level: "info",
        status: "running",
        message: "Source payload normalized",
        metadata: { correlationId, passcode: "do-not-log", patient: { name: "Demo Patient" } },
      });
      return {
        status: "succeeded",
        result: { normalized: true, jwt: "do-not-log" },
      };
    });

    const runtime = new IntegrationJobWorkerRuntime({ registry });
    const result = await runtime.process(demoJob());

    expect(result.status).toBe("succeeded");
    expect(result.correlationId).toBe("corr-worker-demo");
    expect(result.attempts).toBe(1);
    expect(result.result).toEqual({ normalized: true, jwt: "[REDACTED]" });
    expect(result.events.map((event) => event.correlationId)).toEqual([
      "corr-worker-demo",
      "corr-worker-demo",
      "corr-worker-demo",
    ]);
    expect(result.events[1].metadata).toEqual({
      correlationId: "corr-worker-demo",
      passcode: "[REDACTED]",
      patient: { name: "[REDACTED]" },
    });
  });

  it("schedules retry without leaking handler error details", async () => {
    const registry = new IntegrationJobHandlerRegistry();
    registry.register("import.source_payload", () => {
      throw new Error("contains secret patient detail");
    });

    const now = new Date("2026-07-04T10:00:00.000Z");
    const runtime = new IntegrationJobWorkerRuntime({
      registry,
      now: () => now,
      retryPolicy: { maxAttempts: 3, baseDelayMs: 1000, maxDelayMs: 10000, jitterMs: 0 },
    });
    const result = await runtime.process(demoJob());

    expect(result.status).toBe("queued");
    expect(result.attempts).toBe(1);
    expect(result.retryAt?.toISOString()).toBe("2026-07-04T10:00:01.000Z");
    expect(result.errorCode).toBe("Error");
    expect(result.errorMessage).toBe("Job failed and was scheduled for retry");
    expect(JSON.stringify(result)).not.toContain("contains secret patient detail");
  });

  it("routes unregistered job types to needs_review", async () => {
    const registry = new IntegrationJobHandlerRegistry();
    const runtime = new IntegrationJobWorkerRuntime({ registry });
    const result = await runtime.process(demoJob());

    expect(result.status).toBe("needs_review");
    expect(result.errorCode).toBe("HANDLER_NOT_REGISTERED");
    expect(result.events[0].eventType).toBe("handler_missing");
  });
});
