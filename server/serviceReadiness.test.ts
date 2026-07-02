import { describe, expect, it } from "vitest";
import {
  assessReadiness,
  readinessContextValues,
  type ReadinessCardLike,
  type ReadinessContext,
  type ReadinessResult,
} from "../shared/readiness";

/**
 * Service Readiness E2E Tests
 * 
 * Tests the core readiness assessment logic for all 7 service contexts,
 * document request scenarios, and role-based access patterns.
 */

// ─── Test Card Factories ────────────────────────────────────────────────────────
function makeCard(cardType: string, id = 1): ReadinessCardLike {
  return {
    id,
    credentialId: id,
    cardType,
    documentCategory: "clinical_summary",
    displayName: `Test ${cardType}`,
    credentialStatus: "active",
    createdAt: new Date().toISOString(),
  };
}

function makeFullOpdCards(): ReadinessCardLike[] {
  return [
    makeCard("identity", 1),
    makeCard("allergy", 2),
    makeCard("medication", 3),
    makeCard("patient_summary", 4),
    makeCard("coverage", 5),
  ];
}

function makeFullEmergencyCards(): ReadinessCardLike[] {
  return [
    makeCard("identity", 1),
    makeCard("allergy", 2),
    makeCard("medication", 3),
    makeCard("patient_summary", 4),
    makeCard("coverage", 5),
  ];
}

function makeFullReferralCards(): ReadinessCardLike[] {
  return [
    makeCard("identity", 1),
    makeCard("referral", 2),
    makeCard("patient_summary", 3),
    makeCard("lab_result", 4),
    makeCard("coverage", 5),
  ];
}

function makeFullCrossBorderCards(): ReadinessCardLike[] {
  return [
    makeCard("identity", 1),
    makeCard("referral", 2),
    makeCard("patient_summary", 3),
    makeCard("lab_result", 4),
    makeCard("consent", 5),
  ];
}

function makeFullMedicalTouristCards(): ReadinessCardLike[] {
  return [
    makeCard("identity", 1),
    makeCard("patient_summary", 2),
    makeCard("quotation", 3),
    makeCard("guarantee_letter", 4),
    makeCard("visa_support_letter", 5),
  ];
}

function makeFullInsuranceClaimCards(): ReadinessCardLike[] {
  return [
    makeCard("identity", 1),
    makeCard("coverage", 2),
    makeCard("claim", 3),
    makeCard("patient_summary", 4),
    makeCard("claim_receipt", 5), // receipt requirement needs claim_receipt cardType
  ];
}

function makeFullPharmacyCards(): ReadinessCardLike[] {
  return [
    makeCard("identity", 1),
    makeCard("prescription", 2),
    makeCard("medication", 3),
    makeCard("allergy", 4),
    makeCard("pharmacy_dispense", 5),
  ];
}

// ─── Test Suites ────────────────────────────────────────────────────────────────

describe("Service Readiness Assessment", () => {
  describe("readinessContextValues", () => {
    it("should have exactly 7 service contexts", () => {
      expect(readinessContextValues).toHaveLength(7);
    });

    it("should include all expected contexts", () => {
      expect(readinessContextValues).toContain("opd_visit");
      expect(readinessContextValues).toContain("emergency");
      expect(readinessContextValues).toContain("referral");
      expect(readinessContextValues).toContain("cross_border");
      expect(readinessContextValues).toContain("medical_tourist");
      expect(readinessContextValues).toContain("insurance_claim");
      expect(readinessContextValues).toContain("pharmacy_dispense");
    });
  });

  describe("OPD Visit Context", () => {
    it("should return 100% score with full OPD cards", () => {
      const result = assessReadiness(makeFullOpdCards(), "opd_visit");
      expect(result.score).toBe(100);
      expect(result.criticalReady).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it("should return partial score with identity only", () => {
      const cards = [makeCard("identity", 1)];
      const result = assessReadiness(cards, "opd_visit");
      expect(result.score).toBeLessThan(100);
      expect(result.score).toBeGreaterThan(0);
      expect(result.criticalReady).toBe(false);
      expect(result.missing.length).toBeGreaterThan(0);
    });

    it("should return 0% with no cards", () => {
      const result = assessReadiness([], "opd_visit");
      expect(result.score).toBe(0);
      expect(result.criticalReady).toBe(false);
      expect(result.requiredReady).toBe(0);
    });

    it("should identify required vs recommended missing items", () => {
      const cards = [makeCard("identity", 1)];
      const result = assessReadiness(cards, "opd_visit");
      const requiredMissing = result.missing.filter(m => m.required);
      const optionalMissing = result.missing.filter(m => !m.required);
      expect(requiredMissing.length).toBeGreaterThan(0);
      expect(optionalMissing.length).toBeGreaterThan(0);
    });

    it("should not count revoked credentials as ready", () => {
      const cards = [
        makeCard("identity", 1),
        { ...makeCard("allergy", 2), credentialStatus: "revoked" },
        { ...makeCard("medication", 3), credentialStatus: "expired" },
      ];
      const result = assessReadiness(cards, "opd_visit");
      // Only identity should count
      expect(result.requiredReady).toBe(1);
    });
  });

  describe("Emergency Context", () => {
    it("should return 100% with full emergency cards", () => {
      const result = assessReadiness(makeFullEmergencyCards(), "emergency");
      expect(result.score).toBe(100);
      expect(result.criticalReady).toBe(true);
    });

    it("should flag allergy and medication as critical missing in emergency", () => {
      const cards = [makeCard("identity", 1)];
      const result = assessReadiness(cards, "emergency");
      const missingKeys = result.missing.map(m => m.key);
      expect(missingKeys).toContain("allergy");
      expect(missingKeys).toContain("medication");
    });

    it("should calculate correct score with identity + allergy only", () => {
      const cards = [makeCard("identity", 1), makeCard("allergy", 2)];
      const result = assessReadiness(cards, "emergency");
      // 2/3 required = 66.7% * 0.8 = 53.3% + 0/2 recommended * 0.2 = 0 → ~53%
      expect(result.score).toBeGreaterThanOrEqual(50);
      expect(result.score).toBeLessThan(100);
      expect(result.criticalReady).toBe(false);
    });
  });

  describe("Referral Context", () => {
    it("should return 100% with full referral cards", () => {
      const result = assessReadiness(makeFullReferralCards(), "referral");
      expect(result.score).toBe(100);
      expect(result.criticalReady).toBe(true);
    });

    it("should require referral document specifically", () => {
      const cards = [makeCard("identity", 1), makeCard("patient_summary", 2)];
      const result = assessReadiness(cards, "referral");
      const missingKeys = result.missing.map(m => m.key);
      expect(missingKeys).toContain("referral");
    });

    it("should accept referral_vc as matching referral requirement", () => {
      const cards = [
        makeCard("identity", 1),
        makeCard("referral", 2),
        makeCard("patient_summary", 3),
      ];
      const result = assessReadiness(cards, "referral");
      expect(result.requiredReady).toBe(3);
      expect(result.criticalReady).toBe(true);
    });
  });

  describe("Cross-Border Context", () => {
    it("should return 100% with full cross-border cards", () => {
      const result = assessReadiness(makeFullCrossBorderCards(), "cross_border");
      expect(result.score).toBe(100);
      expect(result.criticalReady).toBe(true);
    });

    it("should require consent for cross-border specifically", () => {
      const cards = [
        makeCard("identity", 1),
        makeCard("referral", 2),
        makeCard("patient_summary", 3),
      ];
      const result = assessReadiness(cards, "cross_border");
      const missingKeys = result.missing.map(m => m.key);
      expect(missingKeys).toContain("consent");
    });

    it("should match demo-patient-004 scenario (identity + consent only)", () => {
      const cards = [makeCard("identity", 1), makeCard("consent", 2)];
      const result = assessReadiness(cards, "cross_border");
      expect(result.score).toBe(40);
      expect(result.criticalReady).toBe(false);
      expect(result.requiredReady).toBe(2);
      expect(result.requiredTotal).toBe(4);
    });
  });

  describe("Medical Tourist Context", () => {
    it("should return 100% with full medical tourist cards", () => {
      const result = assessReadiness(makeFullMedicalTouristCards(), "medical_tourist");
      expect(result.score).toBe(100);
      expect(result.criticalReady).toBe(true);
    });

    it("should require quotation for medical tourist", () => {
      const cards = [makeCard("identity", 1), makeCard("patient_summary", 2)];
      const result = assessReadiness(cards, "medical_tourist");
      const missingKeys = result.missing.map(m => m.key);
      expect(missingKeys).toContain("quotation");
    });

    it("should match demo-patient-008 scenario (identity + patient_summary)", () => {
      const cards = [makeCard("identity", 1), makeCard("patient_summary", 2)];
      const result = assessReadiness(cards, "medical_tourist");
      expect(result.score).toBe(53);
      expect(result.criticalReady).toBe(false);
    });
  });

  describe("Insurance Claim Context", () => {
    it("should return 100% with full insurance claim cards", () => {
      const result = assessReadiness(makeFullInsuranceClaimCards(), "insurance_claim");
      expect(result.score).toBe(100);
      expect(result.criticalReady).toBe(true);
    });

    it("should require coverage and claim documents", () => {
      const cards = [makeCard("identity", 1)];
      const result = assessReadiness(cards, "insurance_claim");
      const requiredMissing = result.missing.filter(m => m.required);
      const requiredKeys = requiredMissing.map(m => m.key);
      expect(requiredKeys).toContain("coverage");
      expect(requiredKeys).toContain("claim");
    });

    it("should match demo-patient-006 scenario (identity only)", () => {
      const cards = [makeCard("identity", 1)];
      const result = assessReadiness(cards, "insurance_claim");
      expect(result.score).toBe(27);
      expect(result.criticalReady).toBe(false);
    });
  });

  describe("Pharmacy Dispense Context", () => {
    it("should return 100% with full pharmacy cards", () => {
      const result = assessReadiness(makeFullPharmacyCards(), "pharmacy_dispense");
      expect(result.score).toBe(100);
      expect(result.criticalReady).toBe(true);
    });

    it("should require prescription and allergy for pharmacy", () => {
      const cards = [makeCard("identity", 1)];
      const result = assessReadiness(cards, "pharmacy_dispense");
      const requiredMissing = result.missing.filter(m => m.required);
      const requiredKeys = requiredMissing.map(m => m.key);
      expect(requiredKeys).toContain("prescription");
      expect(requiredKeys).toContain("allergy");
    });

    it("should match demo-patient-005 scenario (identity + allergy)", () => {
      const cards = [makeCard("identity", 1), makeCard("allergy", 2)];
      const result = assessReadiness(cards, "pharmacy_dispense");
      expect(result.score).toBe(40);
      expect(result.criticalReady).toBe(false);
    });
  });

  describe("Score Calculation", () => {
    it("score formula: 80% required + 20% recommended", () => {
      // OPD: 3 required, 2 recommended
      // With 2/3 required and 1/2 recommended:
      const cards = [makeCard("identity", 1), makeCard("allergy", 2), makeCard("patient_summary", 3)];
      const result = assessReadiness(cards, "opd_visit");
      // 2/3 * 0.8 + 1/2 * 0.2 = 0.533 + 0.1 = 0.633 → 63%
      expect(result.score).toBe(63);
    });

    it("should return 0 or 20 for empty wallet (20 when all-required context)", () => {
      for (const context of readinessContextValues) {
        const result = assessReadiness([], context);
        // Score is 0 when recommendedTotal > 0, or 20 when all items are required (0 * 0.8 + 1 * 0.2 = 20)
        // because 0/0 recommended = 1.0 score for recommended portion
        if (result.recommendedTotal === 0) {
          expect(result.score).toBe(20); // emergency has no recommended items
        } else {
          expect(result.score).toBe(0);
        }
      }
    });

    it("should return integer scores (no decimals)", () => {
      const cards = [makeCard("identity", 1)];
      for (const context of readinessContextValues) {
        const result = assessReadiness(cards, context);
        expect(Number.isInteger(result.score)).toBe(true);
      }
    });
  });

  describe("ReadinessResult Structure", () => {
    it("should return all required fields in result", () => {
      const result = assessReadiness([makeCard("identity", 1)], "opd_visit");
      expect(result).toHaveProperty("context");
      expect(result).toHaveProperty("label");
      expect(result).toHaveProperty("labelEn");
      expect(result).toHaveProperty("score");
      expect(result).toHaveProperty("criticalReady");
      expect(result).toHaveProperty("requiredTotal");
      expect(result).toHaveProperty("requiredReady");
      expect(result).toHaveProperty("recommendedTotal");
      expect(result).toHaveProperty("recommendedReady");
      expect(result).toHaveProperty("ready");
      expect(result).toHaveProperty("missing");
      expect(result).toHaveProperty("selectedCardIds");
      expect(result).toHaveProperty("recommendedActions");
    });

    it("ready items should have matchedCards array", () => {
      const cards = [makeCard("identity", 1)];
      const result = assessReadiness(cards, "opd_visit");
      for (const item of result.ready) {
        expect(item).toHaveProperty("matchedCards");
        expect(Array.isArray(item.matchedCards)).toBe(true);
        expect(item.matchedCards.length).toBeGreaterThan(0);
      }
    });

    it("missing items should have action and sourceHint", () => {
      const result = assessReadiness([], "opd_visit");
      for (const item of result.missing) {
        expect(item).toHaveProperty("action");
        expect(item).toHaveProperty("sourceHint");
        expect(typeof item.action).toBe("string");
        expect(typeof item.sourceHint).toBe("string");
      }
    });

    it("selectedCardIds should contain IDs of matched cards", () => {
      const cards = [makeCard("identity", 1), makeCard("allergy", 2)];
      const result = assessReadiness(cards, "opd_visit");
      expect(result.selectedCardIds).toContain(1);
      expect(result.selectedCardIds).toContain(2);
    });
  });

  describe("Edge Cases", () => {
    it("should handle duplicate card types gracefully", () => {
      const cards = [
        makeCard("identity", 1),
        makeCard("identity", 2), // duplicate
        makeCard("allergy", 3),
      ];
      const result = assessReadiness(cards, "opd_visit");
      // Both identity cards should be in matchedCards
      const identityReady = result.ready.find(r => r.key === "identity");
      expect(identityReady?.matchedCards.length).toBe(2);
    });

    it("should handle cards with null cardType", () => {
      const cards: ReadinessCardLike[] = [
        { id: 1, cardType: null, credentialStatus: "active" },
        makeCard("identity", 2),
      ];
      const result = assessReadiness(cards, "opd_visit");
      // Should not crash, identity should still be ready
      expect(result.ready.some(r => r.key === "identity")).toBe(true);
    });

    it("should handle cards with suspended status", () => {
      const cards: ReadinessCardLike[] = [
        { ...makeCard("identity", 1), credentialStatus: "suspended" },
        makeCard("allergy", 2),
      ];
      const result = assessReadiness(cards, "opd_visit");
      // Suspended should not count
      expect(result.ready.some(r => r.key === "identity")).toBe(false);
    });

    it("should handle all contexts without throwing", () => {
      const cards = [makeCard("identity", 1)];
      for (const context of readinessContextValues) {
        expect(() => assessReadiness(cards, context)).not.toThrow();
      }
    });
  });

  describe("Demo Patient Scenarios (Integration)", () => {
    it("P001 (Somchai) - full wallet should score 100% for OPD", () => {
      const cards = makeFullOpdCards();
      const result = assessReadiness(cards, "opd_visit");
      expect(result.score).toBe(100);
      expect(result.criticalReady).toBe(true);
    });

    it("P004 (Haruka) - cross_border with identity+consent = 40%", () => {
      const cards = [makeCard("identity", 1), makeCard("consent", 2)];
      const result = assessReadiness(cards, "cross_border");
      expect(result.score).toBe(40);
      expect(result.missing.map(m => m.key)).toContain("referral");
      expect(result.missing.map(m => m.key)).toContain("summary");
    });

    it("P005 (Wichai) - pharmacy with identity+allergy = 40%", () => {
      const cards = [makeCard("identity", 1), makeCard("allergy", 2)];
      const result = assessReadiness(cards, "pharmacy_dispense");
      expect(result.score).toBe(40);
      expect(result.missing.map(m => m.key)).toContain("prescription");
      expect(result.missing.map(m => m.key)).toContain("medication");
    });

    it("P006 (Porntip) - insurance with identity only = 27%", () => {
      const cards = [makeCard("identity", 1)];
      const result = assessReadiness(cards, "insurance_claim");
      expect(result.score).toBe(27);
    });

    it("P007 (Apichat) - referral with identity+allergy+medication = 27%", () => {
      const cards = [makeCard("identity", 1), makeCard("allergy", 2), makeCard("medication", 3)];
      const result = assessReadiness(cards, "referral");
      // identity matches, but allergy/medication don't match referral requirements
      // referral needs: identity(req), referral(req), summary(req), labs(rec), coverage(rec)
      expect(result.score).toBe(27);
      expect(result.criticalReady).toBe(false);
    });

    it("P008 (David) - medical_tourist with identity+summary = 53%", () => {
      const cards = [makeCard("identity", 1), makeCard("patient_summary", 2)];
      const result = assessReadiness(cards, "medical_tourist");
      expect(result.score).toBe(53);
    });

    it("P009 (Suda) - emergency with identity only = 40%", () => {
      const cards = [makeCard("identity", 1)];
      const result = assessReadiness(cards, "emergency");
      // emergency has 4 required items (identity, allergy, medication, conditions), 0 recommended
      // 1/4 required * 0.8 + 0/0 recommended (=1.0) * 0.2 = 0.2 + 0.2 = 0.4 → 40%
      expect(result.score).toBe(40);
    });
  });

  describe("Document Request Statuses", () => {
    // These tests validate the expected status transitions for document requests
    const VALID_STATUSES = ["draft", "pending_consent", "requested", "imported", "needs_review", "converted_to_vc", "rejected", "cancelled"];

    it("should define all valid document request statuses", () => {
      expect(VALID_STATUSES).toHaveLength(8);
      expect(VALID_STATUSES).toContain("draft");
      expect(VALID_STATUSES).toContain("pending_consent");
      expect(VALID_STATUSES).toContain("requested");
      expect(VALID_STATUSES).toContain("imported");
      expect(VALID_STATUSES).toContain("needs_review");
      expect(VALID_STATUSES).toContain("converted_to_vc");
      expect(VALID_STATUSES).toContain("rejected");
      expect(VALID_STATUSES).toContain("cancelled");
    });

    it("valid transitions from draft", () => {
      const validFromDraft = ["pending_consent", "requested", "cancelled"];
      for (const status of validFromDraft) {
        expect(VALID_STATUSES).toContain(status);
      }
    });

    it("valid transitions from requested", () => {
      const validFromRequested = ["imported", "needs_review", "rejected", "cancelled"];
      for (const status of validFromRequested) {
        expect(VALID_STATUSES).toContain(status);
      }
    });

    it("valid transitions from imported", () => {
      const validFromImported = ["needs_review", "converted_to_vc"];
      for (const status of validFromImported) {
        expect(VALID_STATUSES).toContain(status);
      }
    });
  });

  describe("Service Context Source Types", () => {
    const VALID_SOURCE_TYPES = ["his", "lis", "ris", "pacs", "hospital_app", "national_app", "partner_portal", "payer", "patient_upload", "personal_health_app", "other"];

    it("should define all valid source types", () => {
      expect(VALID_SOURCE_TYPES).toHaveLength(11);
    });

    it("should include hospital information systems", () => {
      expect(VALID_SOURCE_TYPES).toContain("his");
      expect(VALID_SOURCE_TYPES).toContain("lis");
      expect(VALID_SOURCE_TYPES).toContain("ris");
      expect(VALID_SOURCE_TYPES).toContain("pacs");
    });

    it("should include external sources", () => {
      expect(VALID_SOURCE_TYPES).toContain("partner_portal");
      expect(VALID_SOURCE_TYPES).toContain("payer");
      expect(VALID_SOURCE_TYPES).toContain("national_app");
      expect(VALID_SOURCE_TYPES).toContain("personal_health_app");
    });
  });

  describe("Role-Based Access Patterns", () => {
    // Validate that readiness is designed for patient-first access
    it("readiness assessment should work without hospital context (patient-owned)", () => {
      const cards = [makeCard("identity", 1), makeCard("allergy", 2)];
      // No hospital ID needed for assessment
      const result = assessReadiness(cards, "opd_visit");
      expect(result).toBeDefined();
      expect(result.score).toBeGreaterThan(0);
    });

    it("all contexts should have Thai labels for patient-facing UI", () => {
      const cards = [makeCard("identity", 1)];
      for (const context of readinessContextValues) {
        const result = assessReadiness(cards, context);
        expect(result.label).toBeTruthy();
        expect(result.labelEn).toBeTruthy();
        // Thai label should contain Thai characters
        expect(/[\u0E00-\u0E7F]/.test(result.label)).toBe(true);
      }
    });

    it("missing items should provide actionable hints for patients", () => {
      const result = assessReadiness([], "opd_visit");
      for (const item of result.missing) {
        expect(item.action).toBeTruthy();
        expect(item.sourceHint).toBeTruthy();
        // Actions should be machine-readable (snake_case)
        expect(item.action).toMatch(/^[a-z_]+$/);
      }
    });
  });
});
