export type IntegrationWorkbenchSeverity = "ok" | "watch" | "blocked" | "neutral";

export interface IntegrationWorkbenchAdapterLike {
  status?: string | null;
  healthStatus?: string | null;
}

export interface IntegrationWorkbenchJobLike {
  status?: string | null;
}

export interface IntegrationWorkbenchSummary {
  totalAdapters: number;
  healthyAdapters: number;
  watchAdapters: number;
  blockedAdapters: number;
  totalJobs: number;
  backlogJobs: number;
  reviewJobs: number;
  completedJobs: number;
}

export interface IntegrationWorkbenchLabel {
  label: string;
  severity: IntegrationWorkbenchSeverity;
  nextAction: string;
}

export function summarizeIntegrationWorkbench(
  adapters: IntegrationWorkbenchAdapterLike[] = [],
  jobs: IntegrationWorkbenchJobLike[] = [],
): IntegrationWorkbenchSummary {
  return {
    totalAdapters: adapters.length,
    healthyAdapters: adapters.filter((adapter) => getAdapterHealthLabel(adapter).severity === "ok").length,
    watchAdapters: adapters.filter((adapter) => getAdapterHealthLabel(adapter).severity === "watch").length,
    blockedAdapters: adapters.filter((adapter) => getAdapterHealthLabel(adapter).severity === "blocked").length,
    totalJobs: jobs.length,
    backlogJobs: jobs.filter((job) => ["queued", "claimed", "running"].includes(String(job.status ?? ""))).length,
    reviewJobs: jobs.filter((job) => ["failed", "needs_review", "dead_lettered"].includes(String(job.status ?? ""))).length,
    completedJobs: jobs.filter((job) => job.status === "succeeded").length,
  };
}

export function getAdapterHealthLabel(adapter: IntegrationWorkbenchAdapterLike): IntegrationWorkbenchLabel {
  const health = String(adapter.healthStatus ?? "unknown");
  const status = String(adapter.status ?? "testing");
  if (health === "healthy" && status === "active") {
    return { label: "Healthy", severity: "ok", nextAction: "Accept scoped work" };
  }
  if (health === "down" || status === "error" || status === "inactive") {
    return { label: health === "down" ? "Down" : "Blocked", severity: "blocked", nextAction: "Pause adapter work and inspect connector" };
  }
  if (health === "degraded" || status === "testing" || health === "unknown") {
    return { label: health === "unknown" ? "Unknown" : "Degraded", severity: "watch", nextAction: "Verify health check and mapping version" };
  }
  return { label: status, severity: "neutral", nextAction: "Review adapter configuration" };
}

export function getJobTroubleshootingHint(job: IntegrationWorkbenchJobLike): IntegrationWorkbenchLabel {
  const status = String(job.status ?? "queued");
  if (status === "succeeded") {
    return { label: "Done", severity: "ok", nextAction: "No action needed" };
  }
  if (status === "dead_lettered") {
    return { label: "Dead letter", severity: "blocked", nextAction: "Inspect events, fix input or adapter, then create a new idempotent job" };
  }
  if (status === "failed") {
    return { label: "Failed", severity: "blocked", nextAction: "Check latest event and adapter health before retry" };
  }
  if (status === "needs_review") {
    return { label: "Needs review", severity: "watch", nextAction: "Open the timeline and route to the responsible team" };
  }
  if (status === "running" || status === "claimed") {
    return { label: "In progress", severity: "neutral", nextAction: "Watch worker events and correlation ID" };
  }
  return { label: "Queued", severity: "neutral", nextAction: "Waiting for worker capacity" };
}
