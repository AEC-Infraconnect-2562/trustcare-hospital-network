import { describe, expect, it } from "vitest";
import {
  getAdapterHealthLabel,
  getJobTroubleshootingHint,
  summarizeIntegrationWorkbench,
} from "../shared/integrationWorkbench";

describe("integration workbench helpers", () => {
  it("summarizes adapter health and job backlog for the workbench", () => {
    const summary = summarizeIntegrationWorkbench(
      [
        { status: "active", healthStatus: "healthy" },
        { status: "active", healthStatus: "degraded" },
        { status: "error", healthStatus: "down" },
      ],
      [
        { status: "queued" },
        { status: "running" },
        { status: "needs_review" },
        { status: "dead_lettered" },
        { status: "succeeded" },
      ],
    );

    expect(summary).toEqual({
      totalAdapters: 3,
      healthyAdapters: 1,
      watchAdapters: 1,
      blockedAdapters: 1,
      totalJobs: 5,
      backlogJobs: 2,
      reviewJobs: 2,
      completedJobs: 1,
    });
  });

  it("labels adapter states with operator-safe next actions", () => {
    expect(getAdapterHealthLabel({ status: "active", healthStatus: "healthy" })).toMatchObject({
      label: "Healthy",
      severity: "ok",
      nextAction: "Accept scoped work",
    });
    expect(getAdapterHealthLabel({ status: "active", healthStatus: "degraded" })).toMatchObject({
      label: "Degraded",
      severity: "watch",
    });
    expect(getAdapterHealthLabel({ status: "inactive", healthStatus: "unknown" })).toMatchObject({
      label: "Blocked",
      severity: "blocked",
    });
  });

  it("labels retry and dead-letter job states without exposing payloads", () => {
    expect(getJobTroubleshootingHint({ status: "dead_lettered" })).toMatchObject({
      label: "Dead letter",
      severity: "blocked",
    });
    expect(getJobTroubleshootingHint({ status: "needs_review" })).toMatchObject({
      label: "Needs review",
      severity: "watch",
    });
    expect(getJobTroubleshootingHint({ status: "queued" })).toMatchObject({
      label: "Queued",
      nextAction: "Waiting for worker capacity",
    });
  });
});
