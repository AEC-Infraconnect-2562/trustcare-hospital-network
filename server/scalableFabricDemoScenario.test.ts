import { describe, expect, it } from "vitest";
import { runScalableFabricDemoScenario } from "./jobs/scalableFabricDemoScenario";

describe("scalable fabric demo scenario", () => {
  it("runs the contract-scoped import to reconciliation smoke path", async () => {
    const result = await runScalableFabricDemoScenario();
    const byStage = Object.fromEntries(result.steps.map((step) => [step.stage, step]));

    expect(result).toMatchObject({
      scenarioId: "scalable-fabric-demo-opd-readiness-v1",
      correlationId: "corr-scalable-fabric-demo-001",
      context: "opd_visit",
      contractId: "opd_readiness_v1",
      contractVersion: "1.0.0",
    });
    expect(byStage.job_creation.status).toBe("queued");
    expect(byStage.adapter_health.status).toBe("healthy");
    expect(byStage.import.status).toBe("ready");
    expect(byStage.mapping.status).toBe("ready");
    expect(byStage.document_reference.status).toBe("ready");
    expect(byStage.vc_issuance.metadata?.route).toBe("auto_ready_for_checker");
    expect(byStage.vp_shl_packet.metadata).toMatchObject({
      mode: "shl_packet",
      rawSecretReturned: false,
    });
    expect(byStage.verifier_intake.status).toBe("verified");
    expect(byStage.sync_back.status).toBe("ready");
    expect(byStage.reconciliation.metadata?.resultStatus).toBe("passed");
    expect(result.finalState).toMatchObject({
      verifierStatus: "verified",
      packetMode: "shl_packet",
      vcRoute: "auto_ready_for_checker",
      syncBackStatus: "ready",
      reconciliationStatus: "passed",
      noRawSecretsReturned: true,
      noBinaryStored: true,
    });
  });

  it("propagates a single correlation id across every demo trace event", async () => {
    const result = await runScalableFabricDemoScenario();

    expect(result.traceEvents.length).toBe(result.steps.length);
    expect(result.traceEvents.every((event) => event.correlationId === result.correlationId)).toBe(true);
    expect(result.troubleshootingIndex).toMatchObject({
      correlationId: result.correlationId,
      eventCount: result.traceEvents.length,
      latestStatus: "ready",
      sensitiveFindings: [],
    });
    expect(result.troubleshootingIndex.stagesPresent).toEqual([
      "job_creation",
      "import",
      "mapping",
      "document_reference",
      "vc_issuance",
      "vp_shl_packet",
      "shl_access",
      "sync_back",
      "reconciliation",
      "adapter_health",
    ]);
  });

  it("keeps the demo result free of raw patient identifiers and raw SHL secrets", async () => {
    const result = await runScalableFabricDemoScenario();
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain("Synthetic Wallet Patient");
    expect(serialized).not.toContain("SYNTH-HN-9001");
    expect(serialized).not.toContain("SYNTH-VN-20260705-001");
    expect(serialized).not.toContain("shlink:/");
    expect(serialized).not.toContain("raw-shl-key");
    expect(serialized).not.toContain("raw-passcode");
    expect(serialized).not.toContain("jwt");
    expect(result.troubleshootingIndex.sensitiveFindings).toEqual([]);
  });
});
