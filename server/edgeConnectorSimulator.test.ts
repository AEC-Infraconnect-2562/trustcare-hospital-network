import { describe, expect, it } from "vitest";
import { buildQueuedIntegrationJob } from "./jobs/dbQueue";
import {
  evaluateEdgeConnectorRuntime,
  registerEdgeConnectorSimulatorHandlers,
} from "./jobs/edgeConnectorSimulator";
import { IntegrationJobHandlerRegistry, IntegrationJobWorkerRuntime } from "./jobs/runtime";

const now = () => new Date("2026-07-05T01:00:00.000Z");

describe("edge connector simulator", () => {
  it("builds a healthy adapter-scoped runtime contract", () => {
    const result = evaluateEdgeConnectorRuntime({
      id: 7,
      hospitalId: 101,
      name: "Synthetic FHIR Adapter",
      status: "active",
      systemType: "his",
      connectorPattern: "api_rest",
      mappingVersionId: 55,
      connectionConfig: {
        baseUrl: "https://his.example/fhir",
        runtime: {
          maxConcurrency: 4,
          activeJobs: 1,
          queuedJobs: 1,
          throttlePerMinute: 90,
          localBufferDepth: 3,
          localBufferLimit: 100,
        },
      },
    }, { now });

    expect(result.healthStatus).toBe("healthy");
    expect(result.canAcceptJobs).toBe(true);
    expect(result.jobAction).toBe("accept_jobs");
    expect(result.capability.targetKinds).toContain("fhir_rest");
    expect(result.capability.contract).toMatchObject({
      runtime: "trustcare-edge-connector-simulator",
      requiresIdempotencyKey: true,
      requiresCorrelationId: true,
    });
    expect(result.capacityScope).toMatchObject({
      scope: "adapter",
      hospitalId: 101,
      adapterId: 7,
      key: "hospital:101:adapter:7",
    });
    expect(JSON.stringify(result)).not.toContain("https://his.example/fhir");
  });

  it("throttles only the overloaded adapter when concurrency and local buffer are high", () => {
    const result = evaluateEdgeConnectorRuntime({
      id: 8,
      hospitalId: 101,
      status: "active",
      connectorPattern: "hl7v2",
      connectionConfig: {
        host: "mllp.local",
        runtime: {
          maxConcurrency: 2,
          activeJobs: 2,
          queuedJobs: 9,
          localBufferDepth: 95,
          localBufferLimit: 100,
        },
      },
    }, { now });

    expect(result.healthStatus).toBe("degraded");
    expect(result.canAcceptJobs).toBe(false);
    expect(result.jobAction).toBe("pause_new_jobs");
    expect(result.backpressure).toMatchObject({
      state: "saturated",
      policy: "adapter_scoped_backpressure",
      activeJobs: 2,
      maxConcurrency: 2,
    });
    expect(result.issues.some((issue) => issue.code === "ADAPTER_BACKPRESSURE")).toBe(true);
    expect(result.capacityScope.key).toBe("hospital:101:adapter:8");
  });

  it("marks an open circuit adapter down and schedules retry metadata", () => {
    const result = evaluateEdgeConnectorRuntime({
      id: 9,
      hospitalId: 202,
      status: "active",
      connectorPattern: "db_view",
      connectionConfig: {
        viewName: "patient_readiness_view",
        runtime: {
          circuitBreaker: {
            state: "open",
            failureCount: 5,
            failureThreshold: 5,
            resetAfterMs: 60000,
            reason: "connection_timeout",
          },
        },
      },
    }, { now });

    expect(result.healthStatus).toBe("down");
    expect(result.canAcceptJobs).toBe(false);
    expect(result.jobAction).toBe("retry_later");
    expect(result.circuitBreaker).toMatchObject({
      state: "open",
      failureCount: 5,
      failureThreshold: 5,
      reason: "connection_timeout",
      nextAttemptAt: "2026-07-05T01:01:00.000Z",
    });
    expect(result.issues.some((issue) => issue.code === "ADAPTER_CIRCUIT_OPEN")).toBe(true);
  });

  it("registers the adapter health check handler with the worker runtime", async () => {
    const registry = new IntegrationJobHandlerRegistry();
    registerEdgeConnectorSimulatorHandlers(registry, {
      persistHealth: false,
      now,
    });
    const runtime = new IntegrationJobWorkerRuntime({ registry });
    const job = buildQueuedIntegrationJob({
      jobType: "adapter.health_check",
      sourceType: "adapter_health",
      adapterId: 10,
      hospitalId: 303,
      correlationId: "corr-adapter-health",
      payload: {
        adapter: {
          id: 10,
          hospitalId: 303,
          status: "active",
          connectorPattern: "batch_file",
          connectionConfig: {
            enabled: true,
            runtime: {
              healthStatus: "down",
              localBufferDepth: 10,
              localBufferLimit: 20,
            },
          },
        },
      },
    });

    const result = await runtime.process(job);

    expect(result.status).toBe("needs_review");
    expect(result.events.some((event) => event.eventType === "adapter_health_down")).toBe(true);
    expect(result.result).toMatchObject({
      adapterId: 10,
      hospitalId: 303,
      healthStatus: "down",
      jobAction: "retry_later",
    });
    expect(JSON.stringify(result)).not.toContain("passcode");
  });

  it("routes health jobs without adapter metadata to review", async () => {
    const registry = new IntegrationJobHandlerRegistry();
    registerEdgeConnectorSimulatorHandlers(registry, { persistHealth: false, now });
    const runtime = new IntegrationJobWorkerRuntime({ registry });
    const job = buildQueuedIntegrationJob({
      jobType: "adapter.health_check",
      sourceType: "adapter_health",
      correlationId: "corr-adapter-missing",
      payload: {},
    });

    const result = await runtime.process(job);

    expect(result.status).toBe("needs_review");
    expect(result.events.some((event) => event.eventType === "adapter_health_adapter_missing")).toBe(true);
  });
});
