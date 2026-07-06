import { describe, it, expect } from "vitest";
import { contextForWalletCardType } from "./routers";

describe("VP Context Mapping — contextForWalletCardType", () => {
  describe("Medical document types", () => {
    it("maps appointment → appointment", () => {
      expect(contextForWalletCardType("appointment")).toBe("appointment");
    });
    it("maps prescription → prescription", () => {
      expect(contextForWalletCardType("prescription")).toBe("prescription");
    });
    it("maps lab_result → lab_result", () => {
      expect(contextForWalletCardType("lab_result")).toBe("lab_result");
    });
    it("maps diagnostic_report → diagnostic_report", () => {
      expect(contextForWalletCardType("diagnostic_report")).toBe("diagnostic_report");
    });
    it("maps discharge_summary → discharge_summary", () => {
      expect(contextForWalletCardType("discharge_summary")).toBe("discharge_summary");
    });
    it("maps medical_certificate → medical_certificate", () => {
      expect(contextForWalletCardType("medical_certificate")).toBe("medical_certificate");
    });
    it("maps referral → referral", () => {
      expect(contextForWalletCardType("referral")).toBe("referral");
    });
    it("maps immunization → immunization", () => {
      expect(contextForWalletCardType("immunization")).toBe("immunization");
    });
    it("maps patient_summary → patient_summary", () => {
      expect(contextForWalletCardType("patient_summary")).toBe("patient_summary");
    });
  });

  describe("Allergy and medication types", () => {
    it("maps allergy → allergy_alert", () => {
      expect(contextForWalletCardType("allergy")).toBe("allergy_alert");
    });
    it("maps medication → medication", () => {
      expect(contextForWalletCardType("medication")).toBe("medication");
    });
  });

  describe("Identity types", () => {
    it("maps identity → identity", () => {
      expect(contextForWalletCardType("identity")).toBe("identity");
    });
    it("maps patient_identity → identity", () => {
      expect(contextForWalletCardType("patient_identity")).toBe("identity");
    });
    it("maps staff_identity → identity", () => {
      expect(contextForWalletCardType("staff_identity")).toBe("identity");
    });
  });

  describe("Insurance and claim types", () => {
    it("maps coverage → insurance", () => {
      expect(contextForWalletCardType("coverage")).toBe("insurance");
    });
    it("maps insurance_eligibility → insurance", () => {
      expect(contextForWalletCardType("insurance_eligibility")).toBe("insurance");
    });
    it("maps claim → claim", () => {
      expect(contextForWalletCardType("claim")).toBe("claim");
    });
    it("maps claim_package → claim", () => {
      expect(contextForWalletCardType("claim_package")).toBe("claim");
    });
    it("maps claim_receipt → claim", () => {
      expect(contextForWalletCardType("claim_receipt")).toBe("claim");
    });
  });

  describe("Travel and visa types", () => {
    it("maps travel_document → travel_document", () => {
      expect(contextForWalletCardType("travel_document")).toBe("travel_document");
    });
    it("maps travel_document_verification → travel_document", () => {
      expect(contextForWalletCardType("travel_document_verification")).toBe("travel_document");
    });
    it("maps visa_support_letter → visa_support", () => {
      expect(contextForWalletCardType("visa_support_letter")).toBe("visa_support");
    });
  });

  describe("Other specialized types", () => {
    it("maps consent → consent", () => {
      expect(contextForWalletCardType("consent")).toBe("consent");
    });
    it("maps shl_manifest → shl_package", () => {
      expect(contextForWalletCardType("shl_manifest")).toBe("shl_package");
    });
    it("maps pharmacy_dispense → pharmacy", () => {
      expect(contextForWalletCardType("pharmacy_dispense")).toBe("pharmacy");
    });
    it("maps quotation → quotation", () => {
      expect(contextForWalletCardType("quotation")).toBe("quotation");
    });
    it("maps guarantee_letter → guarantee_letter", () => {
      expect(contextForWalletCardType("guarantee_letter")).toBe("guarantee_letter");
    });
    it("maps mpi_link_certificate → identity_link", () => {
      expect(contextForWalletCardType("mpi_link_certificate")).toBe("identity_link");
    });
    it("maps sync_receipt → sync_receipt", () => {
      expect(contextForWalletCardType("sync_receipt")).toBe("sync_receipt");
    });
  });

  describe("Fallback behavior", () => {
    it("returns the cardType itself for unknown types", () => {
      expect(contextForWalletCardType("unknown_type")).toBe("unknown_type");
    });
    it("returns empty string for empty input", () => {
      expect(contextForWalletCardType("")).toBe("");
    });
    it("does not return 'single_document' for any known type", () => {
      const knownTypes = [
        "appointment", "prescription", "lab_result", "diagnostic_report",
        "discharge_summary", "medical_certificate", "referral", "immunization",
        "allergy", "medication", "patient_summary", "consent", "identity",
        "patient_identity", "staff_identity", "coverage", "insurance_eligibility",
        "claim", "claim_package", "claim_receipt", "travel_document",
        "travel_document_verification", "shl_manifest", "pharmacy_dispense",
        "visa_support_letter", "quotation", "guarantee_letter",
        "mpi_link_certificate", "sync_receipt",
      ];
      for (const type of knownTypes) {
        expect(contextForWalletCardType(type)).not.toBe("single_document");
      }
    });
  });
});
