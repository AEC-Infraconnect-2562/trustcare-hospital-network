import { describe, expect, it } from "vitest";
import { buildQueuedIntegrationJob } from "./jobs/dbQueue";
import { IntegrationJobHandlerRegistry, IntegrationJobWorkerRuntime } from "./jobs/runtime";
import {
  buildSyncBackExecuteResult,
  buildSyncBackPlanResult,
  registerSyncBackWorkerHandlers,
  runSyncReconciliation,
} from "./jobs/syncBackWorker";

const patientResource = {
  resourceType: "Patient",
  id: "patient-sync-001",
  identifier: [{ system: "https://trustcare.network/patient", value: "HN-001" }],
};

describe("sync-back worker", () => {
  it("plans FHIR REST sync-back with idempotency and sync plan artifact", () => {
    const result = buildSyncBackPlanResult({
      targetKind: "fhir_rest",
      operation: "update",
      resource: patientResource,
      sourceEventId: "source-event-001",
      patientBusinessKey: "HN-001",
      expectedVersion: "v1",
      reason: "update-hospital-record",
    });

    expect(result.status).toBe("ready");
    expect(result.plan.targetKind).toBe("fhir_rest");
    expect(result.plan.outboundPayload).toMatchObject({
      protocol: "FHIR REST",
      method: "PUT",
      resourceType: "Patient",
    });
    expect(result.artifacts.some((artifact) => artifact.artifactType === "sync_plan")).toBe(true);
  });

  it("executes HL7v2 sync-back and prepares a persisted reconciliation descriptor", async () => {
    const result = await buildSyncBackExecuteResult({
      targetKind: "hl7v2",
      operation: "update",
      resource: patientResource,
      sourceEventId: "source-event-002",
      patientBusinessKey: "HN-002",
      reason: "legacy-broker-update",
      accepted: true,
    }, { persistReconciliation: false });

    expect(result.status).toBe("ready");
    expect(result.execution.targetKind).toBe("hl7v2");
    expect(result.execution.reconciliation).toMatchObject({
      status: "scheduled",
      runMode: "ack_replay",
    });
    expect(result.syncReceipt).toMatchObject({
      resourceType: "TrustcareSyncReceipt",
      targetKind: "hl7v2",
    });
    expect(result.reconciliationPersistence).toMatchObject({
      persisted: false,
      reconciliationJobId: result.execution.reconciliation?.id,
    });
  });

  it("routes manual queue sync-back to needs_review", async () => {
    const result = await buildSyncBackExecuteResult({
      targetKind: "manual_queue",
      operation: "update",
      resource: patientResource,
      sourceEventId: "source-event-003",
      patientBusinessKey: "HN-003",
      reason: "manual-record-review",
    }, { persistReconciliation: false });

    expect(result.status).toBe("needs_review");
    expect(result.execution.status).toBe("queued_for_review");
    expect(result.execution.reconciliation?.status).toBe("manual_review");
    expect(result.reconciliationPersistence).toMatchObject({ persisted: false });
  });

  it("runs reconciliation checks and updates status metadata", async () => {
    const result = await runSyncReconciliation({
      reconciliation: {
        id: "sync-reconcile-demo",
        planId: "sync-plan-demo",
        executionId: "sync-exec-demo",
        targetId: "fhir-rest-primary",
        targetKind: "fhir_rest",
        status: "scheduled",
        runMode: "read_back",
        reason: "readback check",
        attempts: 1,
        checks: [{ type: "idempotency", expected: "idem-1" }],
      },
    }, { persistReconciliation: false, now: "2026-07-05T00:00:00.000Z" });

    expect(result.status).toBe("ready");
    expect(result.result).toMatchObject({
      status: "passed",
      attempts: 2,
      checkCount: 1,
    });
  });

  it("registers sync-back handlers with the worker runtime", async () => {
    const registry = new IntegrationJobHandlerRegistry();
    registerSyncBackWorkerHandlers(registry, {
      persistReconciliation: false,
      now: () => new Date("2026-07-05T00:00:00.000Z"),
    });

    const runtime = new IntegrationJobWorkerRuntime({ registry });
    const job = buildQueuedIntegrationJob({
      jobType: "sync_back.plan",
      sourceType: "sync_back",
      payload: {
        targetKind: "csv_batch",
        operation: "append",
        resource: patientResource,
        sourceEventId: "source-event-004",
        patientBusinessKey: "HN-004",
        reason: "batch-export",
      },
    });

    const result = await runtime.process(job);

    expect(result.status).toBe("succeeded");
    expect(result.events.some((event) => event.eventType === "sync_back_plan_ready")).toBe(true);
    expect(JSON.stringify(result.result)).not.toContain("passcode");
  });
});
