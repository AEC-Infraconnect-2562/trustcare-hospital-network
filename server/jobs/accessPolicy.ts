import { isPatientRole } from "@shared/rolePolicy";
import type { IntegrationJobListFilter } from "./types";

export interface IntegrationJobActor {
  id: number;
  role?: string | null;
  systemRole?: string | null;
  hospitalId?: number | null;
}

export interface IntegrationJobVisibilityRow {
  patientId?: number | null;
  hospitalId?: number | null;
  adapterId?: number | null;
}

export function scopeIntegrationJobListFilter(
  actor: IntegrationJobActor,
  filter: IntegrationJobListFilter = {},
): IntegrationJobListFilter {
  const systemRole = actor.systemRole ?? "patient";
  if (isPatientRole(systemRole)) {
    if (filter.patientId !== undefined && filter.patientId !== actor.id) {
      throw new Error("Patients can only view their own integration jobs.");
    }
    return { ...filter, patientId: actor.id, hospitalId: undefined };
  }

  if (systemRole === "system_admin") return filter;

  if (systemRole === "integration_engineer") {
    if (actor.hospitalId && filter.hospitalId && filter.hospitalId !== actor.hospitalId) {
      throw new Error("Integration engineers can only view jobs for their assigned hospital.");
    }
    return actor.hospitalId ? { ...filter, hospitalId: actor.hospitalId } : filter;
  }

  if (!actor.hospitalId) {
    throw new Error("Staff users need a hospital scope to view integration jobs.");
  }
  if (filter.hospitalId && filter.hospitalId !== actor.hospitalId) {
    throw new Error("Staff users can only view jobs for their assigned hospital.");
  }
  return { ...filter, hospitalId: actor.hospitalId };
}

export function canViewIntegrationJob(actor: IntegrationJobActor, job: IntegrationJobVisibilityRow): boolean {
  const systemRole = actor.systemRole ?? "patient";
  if (isPatientRole(systemRole)) return job.patientId === actor.id;
  if (systemRole === "system_admin") return true;
  if (systemRole === "integration_engineer") {
    if (!actor.hospitalId) return true;
    return job.hospitalId === actor.hospitalId || (!job.hospitalId && Boolean(job.adapterId));
  }
  return Boolean(actor.hospitalId && job.hospitalId === actor.hospitalId);
}

export function assertIntegrationJobCreateAllowed(actor: IntegrationJobActor, hospitalId?: number): void {
  const systemRole = actor.systemRole ?? "patient";
  if (isPatientRole(systemRole)) {
    throw new Error("Patients cannot create integration jobs directly.");
  }
  if (systemRole === "system_admin") return;
  if (systemRole === "integration_engineer" && !actor.hospitalId) return;
  if (!actor.hospitalId) {
    throw new Error("Staff users need a hospital scope to create integration jobs.");
  }
  if (hospitalId && hospitalId !== actor.hospitalId) {
    throw new Error("Staff users can only create integration jobs for their assigned hospital.");
  }
}
