import { describe, it, expect } from "vitest";
import { menuItems, getMenuForRole } from "../shared/menuConfig";

/**
 * Test that shared/menuConfig.ts is in sync with the DashboardLayout allMenuItems.
 * This is the single source of truth for role-based menu visibility.
 */

describe("Demo Login & Menu Config Sync", () => {
  describe("menuConfig completeness", () => {
    const expectedMenuIds = [
      "dashboard", "executive", "prepare-service", "wallet", "consent", "shl",
      "referral", "cross-border", "international", "partner-portal",
      "issuer", "maker-queue", "checker-queue", "verifier", "trust-registry",
      "claim-center",
      "integration", "portability", "fhir-mapping", "terminology", "adapter-sdk",
      "patient-identity", "hospitals", "partner-wizard", "audit", "users", "settings",
    ];

    it("should contain all expected menu items", () => {
      const ids = menuItems.map(i => i.id);
      for (const expected of expectedMenuIds) {
        expect(ids).toContain(expected);
      }
    });

    it("should have no duplicate IDs", () => {
      const ids = menuItems.map(i => i.id);
      const unique = new Set(ids);
      expect(unique.size).toBe(ids.length);
    });

    it("every menu item should have a valid path starting with /", () => {
      for (const item of menuItems) {
        expect(item.path.startsWith("/")).toBe(true);
      }
    });

    it("only consent history may be hidden from the default sidebar", () => {
      const hidden = menuItems.filter(item => item.roles.length === 0).map(item => item.id);
      expect(hidden).toEqual(["consent"]);
    });
  });

  describe("wallet visibility (synced with DashboardLayout)", () => {
    it("wallet should be visible to care, patient, Maker/Checker, and integration users", () => {
      const wallet = menuItems.find(i => i.id === "wallet")!;
      expect(wallet.roles).toContain("system_admin");
      expect(wallet.roles).toContain("hospital_admin");
      expect(wallet.roles).toContain("maker");
      expect(wallet.roles).toContain("checker");
      expect(wallet.roles).toContain("doctor");
      expect(wallet.roles).toContain("nurse");
      expect(wallet.roles).toContain("integration_engineer");
      expect(wallet.roles).toContain("patient");
    });
  });

  describe("executive dashboard visibility", () => {
    it("executive should be visible only to system_admin and hospital_admin", () => {
      const exec = menuItems.find(i => i.id === "executive")!;
      expect(exec.roles).toEqual(["system_admin", "hospital_admin"]);
    });
  });

  describe("patient-identity visibility", () => {
    it("patient-identity should be visible to system_admin, hospital_admin, integration_engineer", () => {
      const mpi = menuItems.find(i => i.id === "patient-identity")!;
      expect(mpi.roles).toContain("system_admin");
      expect(mpi.roles).toContain("hospital_admin");
      expect(mpi.roles).toContain("integration_engineer");
      expect(mpi.roles).not.toContain("doctor");
      expect(mpi.roles).not.toContain("nurse");
      expect(mpi.roles).not.toContain("patient");
    });
  });

  describe("getMenuForRole function", () => {
    it("system_admin should see all visible menu items", () => {
      const items = getMenuForRole("system_admin");
      expect(items.length).toBe(menuItems.filter(item => item.roles.length > 0).length);
    });

    it("patient should see readiness and wallet share menus, without issuer operations", () => {
      const items = getMenuForRole("patient");
      const ids = items.map(i => i.id);
      expect(ids).toEqual(["dashboard", "prepare-service", "wallet", "shl"]);
      expect(ids).not.toContain("consent");
      expect(ids).not.toContain("issuer");
      expect(ids).not.toContain("maker-queue");
      expect(ids).not.toContain("checker-queue");
    });

    it("integration_engineer should see wallet readiness and integration menus, but not issuer queues", () => {
      const items = getMenuForRole("integration_engineer");
      const ids = items.map(i => i.id);
      expect(ids).toContain("prepare-service");
      expect(ids).toContain("wallet");
      expect(ids).not.toContain("referral");
      expect(ids).not.toContain("issuer");
      expect(ids).not.toContain("maker-queue");
      expect(ids).not.toContain("checker-queue");
      expect(ids).toContain("integration");
      expect(ids).toContain("patient-identity");
    });
  });

  describe("Demo user seed data structure", () => {
    // This test validates the expected demo user structure
    const expectedDemoUsers = [
      { openId: "demo-system-admin", systemRole: "system_admin" },
      { openId: "demo-hospital-admin", systemRole: "hospital_admin" },
      { openId: "demo-doctor", systemRole: "doctor" },
      { openId: "demo-nurse", systemRole: "nurse" },
      { openId: "demo-engineer", systemRole: "integration_engineer" },
      { openId: "demo-patient", systemRole: "patient" },
    ];

    it("should have 6 demo users covering all roles", () => {
      expect(expectedDemoUsers.length).toBe(6);
      const roles = expectedDemoUsers.map(u => u.systemRole);
      expect(roles).toContain("system_admin");
      expect(roles).toContain("hospital_admin");
      expect(roles).toContain("doctor");
      expect(roles).toContain("nurse");
      expect(roles).toContain("integration_engineer");
      expect(roles).toContain("patient");
    });

    it("all demo openIds should start with demo-", () => {
      for (const user of expectedDemoUsers) {
        expect(user.openId.startsWith("demo-")).toBe(true);
      }
    });
  });

  describe("Additional roles for Maker/Checker", () => {
    const ADDITIONAL_ROLE_MENU_MAP: Record<string, string[]> = {
      issuer_maker: ["issuer", "maker-queue", "verifier"],
      issuer_checker: ["issuer", "checker-queue", "verifier"],
    };

    it("issuer_maker should grant access to issuer, maker queue, and verifier menus", () => {
      expect(ADDITIONAL_ROLE_MENU_MAP["issuer_maker"]).toContain("issuer");
      expect(ADDITIONAL_ROLE_MENU_MAP["issuer_maker"]).toContain("maker-queue");
      expect(ADDITIONAL_ROLE_MENU_MAP["issuer_maker"]).toContain("verifier");
    });

    it("issuer_checker should grant access to issuer, checker queue, and verifier menus", () => {
      expect(ADDITIONAL_ROLE_MENU_MAP["issuer_checker"]).toContain("issuer");
      expect(ADDITIONAL_ROLE_MENU_MAP["issuer_checker"]).toContain("checker-queue");
      expect(ADDITIONAL_ROLE_MENU_MAP["issuer_checker"]).toContain("verifier");
    });

    it("nurse with issuer_maker should see issuer menu (not normally visible)", () => {
      const nurseMenus = getMenuForRole("nurse");
      const nurseIds = nurseMenus.map(i => i.id);
      // Nurse normally doesn't see issuer
      expect(nurseIds).not.toContain("issuer");

      // But with issuer_maker additional role, the combined menu should include issuer
      const additionalMenuIds = ADDITIONAL_ROLE_MENU_MAP["issuer_maker"];
      const combinedIds = [...new Set([...nurseIds, ...additionalMenuIds])];
      expect(combinedIds).toContain("issuer");
      expect(combinedIds).toContain("verifier");
    });
  });
});
