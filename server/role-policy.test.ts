import { describe, expect, it } from "vitest";
import {
  availableRolesForSystemRole,
  canActAsCredentialChecker,
  canActAsCredentialMaker,
  normalizeCredentialEntitlements,
  sanitizeAdditionalRolesForSystemRole,
} from "@shared/rolePolicy";

describe("TrustCare role policy", () => {
  it("strips issuer Maker/Checker roles from patient users", () => {
    expect(sanitizeAdditionalRolesForSystemRole("patient", ["issuer_maker", "issuer_checker"])).toEqual([]);
    expect(availableRolesForSystemRole("patient", ["issuer_maker", "issuer_checker"])).toEqual(["patient"]);
  });

  it("does not allow patients to act as Maker or Checker even with stale issuer roles", () => {
    expect(canActAsCredentialMaker("patient", ["issuer_maker"])).toBe(false);
    expect(canActAsCredentialChecker("patient", ["issuer_checker"])).toBe(false);
  });

  it("clears credential entitlements for patient users", () => {
    expect(normalizeCredentialEntitlements("patient", {
      makerTypes: ["prescription"],
      checkerTypes: ["medical_certificate"],
    })).toEqual({ makerTypes: [], checkerTypes: [] });
  });

  it("allows hospital staff to hold explicit issuer privileges", () => {
    expect(canActAsCredentialMaker("nurse", ["issuer_maker"])).toBe(true);
    expect(canActAsCredentialChecker("doctor", ["issuer_checker"])).toBe(true);
  });
});
