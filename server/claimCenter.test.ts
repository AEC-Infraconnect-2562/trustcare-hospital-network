import { describe, expect, it } from "vitest";
import {
  buildClaimPublicApiExamples,
  buildClaimReceiptCredential,
  buildClaimWorkbench,
  buildPayerAdjudicationEnvelope,
  buildPaymentReconciliationEnvelope,
  buildPayerSubmissionEnvelope,
  validateClaimPacket,
} from "./claimCenter";

describe("Claim Center workbench", () => {
  it("builds simulated seed packets across Thai payer and travel insurance scenarios", () => {
    const workbench = buildClaimWorkbench({ now: "2026-07-03T10:00:00.000Z" });

    expect(workbench.simulationMode).toBe(true);
    expect(workbench.seedPackets.length).toBeGreaterThanOrEqual(6);
    expect(workbench.seedPackets.map((packet) => packet.hospital.code)).toEqual(
      expect.arrayContaining(["TCC", "TCN", "TCS"]),
    );
    expect(workbench.seedPackets.map((packet) => packet.payer.payerType)).toEqual(
      expect.arrayContaining(["nhso", "sso", "csmbs", "private_insurance", "travel_insurance"]),
    );
  });

  it("creates canonical FHIR Claim and ClaimPackageCredential trust envelope", () => {
    const packet = buildClaimWorkbench({ now: "2026-07-03T10:00:00.000Z" }).seedPackets[0];

    expect(packet.fhirClaim.resourceType).toBe("Claim");
    expect((packet.fhirClaim.diagnosis as any[]).length).toBeGreaterThan(0);
    expect(packet.packageCredential.type).toContain("ClaimPackageCredential");
    expect(packet.packageCredential.credentialSubject.fhirClaimHash).toMatch(/^[a-f0-9]{64}$/);
    expect(packet.packageCredential.credentialSubject.evidenceHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("reports claim validation issues before payer submission", () => {
    const dental = buildClaimWorkbench({ now: "2026-07-03T10:00:00.000Z" }).seedPackets.find(
      (packet) => packet.claimType === "dental",
    );

    expect(dental).toBeDefined();
    const issues = validateClaimPacket(dental!);
    expect(issues.some((issue) => issue.field === "procedure_codes" && issue.severity === "error")).toBe(true);
  });

  it("builds payer submission, adjudication, payment, and receipt envelopes", () => {
    const packet = buildClaimWorkbench({ now: "2026-07-03T10:00:00.000Z" }).seedPackets[0];
    const submission = buildPayerSubmissionEnvelope(packet, "batch_file");
    const adjudication = buildPayerAdjudicationEnvelope(packet, "accepted");
    const payment = buildPaymentReconciliationEnvelope(packet);
    const receipt = buildClaimReceiptCredential(packet, payment);

    expect(submission.status).toBe("submitted");
    expect(submission.targetFormat).toContain("FHIR Claim");
    expect(adjudication.fhirResource.resourceType).toBe("ClaimResponse");
    expect(payment.reconciliation.resourceType).toBe("PaymentReconciliation");
    expect(receipt.type).toContain("ClaimReceiptCredential");
  });

  it("documents public mock API response formats", () => {
    const packet = buildClaimWorkbench({ now: "2026-07-03T10:00:00.000Z" }).seedPackets[0];
    const api = buildClaimPublicApiExamples(packet);

    expect(api.basePath).toBe("/api/public/claim-center/v1");
    expect(api.endpoints.map((endpoint) => endpoint.path)).toEqual([
      "/eligibility-check",
      "/claim-packages",
      "/payer-responses",
      "/payments",
    ]);
    expect(api.endpoints.every((endpoint) => endpoint.response)).toBe(true);
  });
});
