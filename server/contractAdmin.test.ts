import { describe, expect, it } from "vitest";
import * as db from "./db";

describe("Contract Admin CRUD helpers", () => {
  it("listAllContracts returns an array", async () => {
    const result = await db.listAllContracts();
    expect(Array.isArray(result)).toBe(true);
  });

  it("getContractById returns null for non-existent id", async () => {
    const result = await db.getContractById(999999);
    expect(result).toBeNull();
  });

  it("getContractByContractId returns null for non-existent contractId", async () => {
    const result = await db.getContractByContractId("non_existent_contract_xyz");
    expect(result).toBeNull();
  });

  it("listBundleTemplates returns an array", async () => {
    const result = await db.listBundleTemplates();
    expect(Array.isArray(result)).toBe(true);
  });

  it("listBundleTemplates with contractId filter returns an array", async () => {
    const result = await db.listBundleTemplates("opd_readiness_v1");
    expect(Array.isArray(result)).toBe(true);
  });

  it("createServiceContract creates and returns an id", async () => {
    const id = await db.createServiceContract({
      contractId: "test_contract_vitest_" + Date.now(),
      context: "opd_visit",
      version: "1.0.0",
      status: "draft",
      patientLabel: "ทดสอบ",
      patientLabelEn: "Test",
      hospitalLabel: "ทดสอบ รพ.",
      hospitalLabelEn: "Test Hospital",
      patientVisible: true,
      hospitalVisible: true,
      patientBundleType: "patient_readiness_bundle",
      hospitalBundleType: "hospital_readiness_bundle",
    });
    expect(typeof id).toBe("number");
    expect(id).toBeGreaterThan(0);

    // Verify it exists
    const contract = await db.getContractById(id);
    expect(contract).not.toBeNull();
    expect(contract!.context).toBe("opd_visit");
    expect(contract!.status).toBe("draft");

    // Clean up - soft delete
    await db.deleteServiceContract(id);
    const deleted = await db.getContractById(id);
    expect(deleted!.status).toBe("deprecated");
  });

  it("updateServiceContract updates fields", async () => {
    const id = await db.createServiceContract({
      contractId: "test_update_vitest_" + Date.now(),
      context: "emergency",
      version: "1.0.0",
      status: "draft",
      patientLabel: "ฉุกเฉิน",
      patientLabelEn: "Emergency",
      hospitalLabel: "ฉุกเฉิน รพ.",
      hospitalLabelEn: "Emergency Hospital",
      patientVisible: true,
      hospitalVisible: true,
      patientBundleType: "patient_readiness_bundle",
      hospitalBundleType: "hospital_readiness_bundle",
    });

    await db.updateServiceContract(id, { status: "active", version: "2.0.0" });
    const updated = await db.getContractById(id);
    expect(updated!.status).toBe("active");
    expect(updated!.version).toBe("2.0.0");

    // Clean up
    await db.deleteServiceContract(id);
  });
});
