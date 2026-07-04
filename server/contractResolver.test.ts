import { describe, expect, it } from "vitest";
import { buildPrepareServiceWorkbench } from "./prepareService";
import { resolveIntegrationContract } from "./contractResolver";

describe("contract-first integration resolver", () => {
  it.each(["opd_visit", "referral", "cross_border", "insurance_claim", "pharmacy_dispense"] as const)(
    "resolves %s to contract, mapping profile, consent policy, and output artifacts",
    (context) => {
      const resolved = resolveIntegrationContract({
        context,
        tenantId: "tenant-a",
        hospitalId: 77,
      });

      expect(resolved.tenantId).toBe("tenant-a");
      expect(resolved.hospitalId).toBe(77);
      expect(resolved.context).toBe(context);
      expect(resolved.contract.context).toBe(context);
      expect(resolved.contractId).toBe(resolved.contract.contractId);
      expect(resolved.contractVersion).toBe(resolved.contract.version);
      expect(resolved.mappingProfile.contractId).toBe(resolved.contractId);
      expect(resolved.consentPolicy.pdpaControls).toContain("data_minimization");
      expect(resolved.outputArtifacts.some((artifact) => artifact.kind === "operation_outcome")).toBe(true);
      expect(resolved.outputArtifacts.some((artifact) => artifact.kind === "fhir_resource")).toBe(true);
    },
  );

  it("keeps transport policy contract-scoped", () => {
    const referral = resolveIntegrationContract({ context: "referral" });
    const insurance = resolveIntegrationContract({ context: "insurance_claim" });

    expect(referral.transportPolicy.shlPacketAllowed).toBe(true);
    expect(referral.outputArtifacts.some((artifact) => artifact.kind === "shl_packet")).toBe(true);
    expect(insurance.transportPolicy.directVpAllowed).toBe(true);
    expect(insurance.outputArtifacts.some((artifact) => artifact.kind === "document_reference")).toBe(true);
  });

  it("resolves by explicit contractId and version", () => {
    const byContext = resolveIntegrationContract({ context: "opd_visit" });
    const byId = resolveIntegrationContract({
      contractId: byContext.contractId,
      contractVersion: byContext.contractVersion,
    });

    expect(byId.fallbackUsed).toBe(false);
    expect(byId.context).toBe("opd_visit");
    expect(byId.contractId).toBe(byContext.contractId);
  });

  it("falls back safely when contractId or version is not available", () => {
    const missingContract = resolveIntegrationContract({
      context: "referral",
      contractId: "missing-contract",
    });
    const missingVersion = resolveIntegrationContract({
      context: "opd_visit",
      contractVersion: "1900.01.missing",
    });

    expect(missingContract.fallbackUsed).toBe(true);
    expect(missingContract.context).toBe("referral");
    expect(missingContract.warnings.join(" ")).toContain("missing-contract");
    expect(missingVersion.fallbackUsed).toBe(true);
    expect(missingVersion.contractVersion).not.toBe("1900.01.missing");
  });

  it("does not break existing Prepare for Service workbench generation", () => {
    const workbench = buildPrepareServiceWorkbench({ context: "insurance_claim", now: "2026-07-04T00:00:00.000Z" });

    expect(workbench.activeContract.context).toBe("insurance_claim");
    expect(workbench.contractHub.contracts.length).toBeGreaterThan(0);
  });
});
