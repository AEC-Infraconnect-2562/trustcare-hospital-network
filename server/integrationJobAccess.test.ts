import { describe, expect, it } from "vitest";
import {
  assertIntegrationJobCreateAllowed,
  canViewIntegrationJob,
  scopeIntegrationJobListFilter,
} from "./jobs/accessPolicy";

describe("integration job API access policy", () => {
  it("scopes patients to their own jobs", () => {
    const patient = { id: 42, systemRole: "patient" };

    expect(scopeIntegrationJobListFilter(patient, { status: "queued" })).toEqual({
      status: "queued",
      patientId: 42,
      hospitalId: undefined,
    });
    expect(() => scopeIntegrationJobListFilter(patient, { patientId: 41 })).toThrow(/own integration jobs/);
    expect(canViewIntegrationJob(patient, { patientId: 42 })).toBe(true);
    expect(canViewIntegrationJob(patient, { patientId: 7 })).toBe(false);
  });

  it("scopes hospital staff to their assigned hospital", () => {
    const doctor = { id: 5, systemRole: "doctor", hospitalId: 9 };

    expect(scopeIntegrationJobListFilter(doctor, { limit: 25 })).toEqual({
      limit: 25,
      hospitalId: 9,
    });
    expect(canViewIntegrationJob(doctor, { hospitalId: 9, patientId: 42 })).toBe(true);
    expect(canViewIntegrationJob(doctor, { hospitalId: 10, patientId: 42 })).toBe(false);
    expect(() => scopeIntegrationJobListFilter(doctor, { hospitalId: 10 })).toThrow(/assigned hospital/);
  });

  it("allows system admin to inspect system and hospital jobs", () => {
    const admin = { id: 1, systemRole: "system_admin" };

    expect(scopeIntegrationJobListFilter(admin, { hospitalId: 9 })).toEqual({ hospitalId: 9 });
    expect(canViewIntegrationJob(admin, { hospitalId: 10 })).toBe(true);
    expect(canViewIntegrationJob(admin, { adapterId: 3 })).toBe(true);
    expect(() => assertIntegrationJobCreateAllowed(admin)).not.toThrow();
  });

  it("allows integration engineers to inspect adapter/system jobs", () => {
    const engineer = { id: 8, systemRole: "integration_engineer" };
    const hospitalEngineer = { id: 9, systemRole: "integration_engineer", hospitalId: 3 };

    expect(canViewIntegrationJob(engineer, { adapterId: 4 })).toBe(true);
    expect(canViewIntegrationJob(hospitalEngineer, { adapterId: 4 })).toBe(true);
    expect(canViewIntegrationJob(hospitalEngineer, { hospitalId: 3 })).toBe(true);
    expect(canViewIntegrationJob(hospitalEngineer, { hospitalId: 4 })).toBe(false);
    expect(() => assertIntegrationJobCreateAllowed(engineer)).not.toThrow();
  });

  it("does not allow patients to create integration jobs directly", () => {
    expect(() => assertIntegrationJobCreateAllowed({ id: 42, systemRole: "patient" }, 1)).toThrow(/Patients cannot create/);
  });
});
