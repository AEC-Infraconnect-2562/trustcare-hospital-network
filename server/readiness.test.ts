import { describe, expect, it } from "vitest";
import { assessReadiness } from "@shared/readiness";

describe("service readiness model", () => {
  it("marks OPD readiness complete when required identity, allergy, and medication cards exist", () => {
    const readiness = assessReadiness([
      { id: 1, cardType: "identity", credentialStatus: "active" },
      { id: 2, cardType: "allergy", credentialStatus: "active" },
      { id: 3, cardType: "medication", credentialStatus: "active" },
    ], "opd_visit");

    expect(readiness.criticalReady).toBe(true);
    expect(readiness.requiredReady).toBe(3);
    expect(readiness.score).toBeGreaterThanOrEqual(80);
    expect(readiness.selectedCardIds).toEqual([1, 2, 3]);
  });

  it("keeps emergency critical readiness false when allergy data is missing", () => {
    const readiness = assessReadiness([
      { id: 1, cardType: "identity", credentialStatus: "active" },
      { id: 2, cardType: "medication", credentialStatus: "active" },
      { id: 3, cardType: "patient_summary", credentialStatus: "active" },
    ], "emergency");

    expect(readiness.criticalReady).toBe(false);
    expect(readiness.missing.map((item) => item.key)).toContain("allergy");
    expect(readiness.recommendedActions).toContain("request_allergy");
  });

  it("ignores revoked cards when calculating referral readiness", () => {
    const readiness = assessReadiness([
      { id: 1, cardType: "identity", credentialStatus: "active" },
      { id: 2, cardType: "referral", credentialStatus: "revoked" },
      { id: 3, cardType: "patient_summary", credentialStatus: "active" },
    ], "referral");

    expect(readiness.criticalReady).toBe(false);
    expect(readiness.missing.map((item) => item.key)).toContain("referral");
    expect(readiness.selectedCardIds).toEqual([1, 3]);
  });
});
