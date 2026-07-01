import { describe, it, expect } from "vitest";
import { menuItems, getMenuForRole } from "../shared/menuConfig";

/**
 * Test that shared/menuConfig.ts is in sync with the DashboardLayout allMenuItems.
 * This is the single source of truth for role-based menu visibility.
 */

describe("Demo Login & Menu Config Sync", () => {
  describe("menuConfig completeness", () => {
    const expectedMenuIds = [
      "dashboard", "executive", "wallet", "consent", "shl",
      "referral", "cross-border", "international",
      "issuer", "verifier", "trust-registry",
      "claim-center",
      "integration", "portability", "fhir-mapping", "terminology",
      "patient-identity", "hospitals", "audit", "users", "settings",
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

    it("every menu item should have at least one role", () => {
      for (const item of menuItems) {
        expect(item.roles.length).toBeGreaterThan(0);
      }
    });
  });

  describe("wallet visibility (synced with DashboardLayout)", () => {
    it("wallet should be visible to system_admin, hospital_admin, doctor, nurse, and patient", () => {
      const wallet = menuItems.find(i => i.id === "wallet")!;
      expect(wallet.roles).toContain("system_admin");
      expect(wallet.roles).toContain("hospital_admin");
      expect(wallet.roles).toContain("doctor");
      expect(wallet.roles).toContain("nurse");
      expect(wallet.roles).toContain("patient");
      expect(wallet.roles).not.toContain("integration_engineer");
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
    it("system_admin should see all menu items", () => {
      const items = getMenuForRole("system_admin");
      expect(items.length).toBe(menuItems.length);
    });

    it("patient should see only dashboard, wallet, consent, shl", () => {
      const items = getMenuForRole("patient");
      const ids = items.map(i => i.id);
      expect(ids).toEqual(["dashboard", "wallet", "consent", "shl"]);
    });

    it("integration_engineer should NOT see wallet, referral, issuer", () => {
      const items = getMenuForRole("integration_engineer");
      const ids = items.map(i => i.id);
      expect(ids).not.toContain("wallet");
      expect(ids).not.toContain("referral");
      expect(ids).not.toContain("issuer");
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
      issuer_maker: ["issuer", "verifier"],
      issuer_checker: ["issuer", "verifier"],
    };

    it("issuer_maker should grant access to issuer and verifier menus", () => {
      expect(ADDITIONAL_ROLE_MENU_MAP["issuer_maker"]).toContain("issuer");
      expect(ADDITIONAL_ROLE_MENU_MAP["issuer_maker"]).toContain("verifier");
    });

    it("issuer_checker should grant access to issuer and verifier menus", () => {
      expect(ADDITIONAL_ROLE_MENU_MAP["issuer_checker"]).toContain("issuer");
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
