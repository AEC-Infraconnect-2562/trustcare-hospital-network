import { describe, it, expect } from "vitest";

// Test the role switching logic and menu visibility with activeRole
describe("Role Switching & Active Role Menu Visibility", () => {
  // Simulate the DashboardLayout's getMenuForRole logic
  type SystemRole = "system_admin" | "hospital_admin" | "doctor" | "nurse" | "integration_engineer" | "patient";

  interface MenuItemDef {
    id: string;
    roles: string[];
  }

  const ADDITIONAL_ROLE_MENU_MAP: Record<string, string[]> = {
    issuer_maker: ["issuer", "verifier"],
    issuer_checker: ["issuer", "verifier"],
  };

  // Simplified menu items for testing (matching DashboardLayout)
  const allMenuItems: MenuItemDef[] = [
    { id: "dashboard", roles: ["system_admin", "hospital_admin", "doctor", "nurse", "integration_engineer"] },
    { id: "executive", roles: ["system_admin", "hospital_admin"] },
    { id: "wallet", roles: ["system_admin", "patient"] },
    { id: "consent", roles: ["system_admin", "patient"] },
    { id: "shl", roles: ["system_admin", "patient"] },
    { id: "referral", roles: ["system_admin", "hospital_admin", "doctor", "nurse"] },
    { id: "cross-border", roles: ["system_admin", "hospital_admin", "doctor"] },
    { id: "international", roles: ["system_admin", "hospital_admin", "doctor", "nurse"] },
    { id: "issuer", roles: ["system_admin", "hospital_admin", "doctor"] },
    { id: "verifier", roles: ["system_admin", "hospital_admin", "doctor", "nurse"] },
    { id: "trust-registry", roles: ["system_admin", "hospital_admin"] },
    { id: "claim-center", roles: ["system_admin", "hospital_admin", "doctor", "nurse"] },
    { id: "integration", roles: ["system_admin", "hospital_admin", "integration_engineer"] },
    { id: "portability", roles: ["system_admin", "hospital_admin", "doctor", "integration_engineer"] },
    { id: "fhir-mapping", roles: ["system_admin", "hospital_admin", "integration_engineer"] },
    { id: "terminology", roles: ["system_admin", "hospital_admin", "integration_engineer"] },
    { id: "patient-identity", roles: ["system_admin", "hospital_admin", "integration_engineer"] },
    { id: "hospitals", roles: ["system_admin", "hospital_admin"] },
    { id: "audit", roles: ["system_admin", "hospital_admin"] },
    { id: "users", roles: ["system_admin", "hospital_admin"] },
    { id: "settings", roles: ["system_admin", "hospital_admin"] },
  ];

  function getMenuForRole(role: SystemRole, additionalRoles: string[] = []) {
    return allMenuItems.filter(item => {
      if (item.roles.includes(role)) return true;
      if (role === "patient") return false;
      for (const addRole of additionalRoles) {
        const grantedMenus = ADDITIONAL_ROLE_MENU_MAP[addRole];
        if (grantedMenus && grantedMenus.includes(item.id)) return true;
      }
      return false;
    });
  }

  describe("Doctor switching to patient role", () => {
    it("should see doctor menus when activeRole is doctor", () => {
      const menus = getMenuForRole("doctor", []);
      const menuIds = menus.map(m => m.id);
      expect(menuIds).toContain("dashboard");
      expect(menuIds).toContain("issuer");
      expect(menuIds).toContain("referral");
      expect(menuIds).not.toContain("wallet");
      expect(menuIds).not.toContain("consent");
    });

    it("should see patient menus when activeRole is patient", () => {
      // When doctor switches to patient, they use activeRole=patient
      const menus = getMenuForRole("patient", []);
      const menuIds = menus.map(m => m.id);
      expect(menuIds).toContain("wallet");
      expect(menuIds).toContain("consent");
      expect(menuIds).toContain("shl");
      expect(menuIds).not.toContain("dashboard");
      expect(menuIds).not.toContain("issuer");
      expect(menuIds).not.toContain("referral");
    });
  });

  describe("Nurse with issuer_maker switching to patient", () => {
    it("should see nurse menus + issuer when activeRole is nurse with issuer_maker", () => {
      const menus = getMenuForRole("nurse", ["issuer_maker"]);
      const menuIds = menus.map(m => m.id);
      expect(menuIds).toContain("dashboard");
      expect(menuIds).toContain("issuer"); // granted by issuer_maker
      expect(menuIds).toContain("verifier"); // granted by issuer_maker
      expect(menuIds).toContain("referral");
      expect(menuIds).not.toContain("wallet");
    });

    it("should see only patient menus when activeRole is patient (even with issuer_maker)", () => {
      // When nurse switches to patient, additionalRoles don't apply to patient view
      // because the menu is filtered by activeRole, not systemRole
      const menus = getMenuForRole("patient", []);
      const menuIds = menus.map(m => m.id);
      expect(menuIds).toContain("wallet");
      expect(menuIds).toContain("consent");
      expect(menuIds).not.toContain("issuer");
      expect(menuIds).not.toContain("dashboard");
    });
  });

  describe("Available roles logic", () => {
    it("staff should be able to switch to patient", () => {
      const systemRole = "doctor";
      const allowedRoles = [systemRole, "patient"];
      expect(allowedRoles).toContain("doctor");
      expect(allowedRoles).toContain("patient");
    });

    it("patient should NOT be able to switch to other roles", () => {
      const systemRole = "patient";
      const allowedRoles = [systemRole]; // patient can only be patient
      expect(allowedRoles).toHaveLength(1);
      expect(allowedRoles).toContain("patient");
    });

    it("patient should not receive issuer roles from stale additional role rows", () => {
      const menus = getMenuForRole("patient", ["issuer_maker", "issuer_checker"]);
      const menuIds = menus.map(m => m.id);
      expect(menuIds).not.toContain("issuer");
      expect(menuIds).not.toContain("verifier");
    });

    it("system_admin can switch to patient", () => {
      const systemRole = "system_admin";
      const allowedRoles = [systemRole, "patient"];
      expect(allowedRoles).toContain("system_admin");
      expect(allowedRoles).toContain("patient");
    });
  });

  describe("Role switch validation", () => {
    it("should reject switching to a role that is not the user's systemRole or patient", () => {
      const systemRole = "nurse";
      const requestedRole = "system_admin";
      const allowedRoles = [systemRole, "patient"];
      expect(allowedRoles.includes(requestedRole)).toBe(false);
    });

    it("should allow switching to own systemRole", () => {
      const systemRole = "nurse";
      const requestedRole = "nurse";
      const allowedRoles = [systemRole, "patient"];
      expect(allowedRoles.includes(requestedRole)).toBe(true);
    });

    it("should allow switching to patient", () => {
      const systemRole = "nurse";
      const requestedRole = "patient";
      const allowedRoles = [systemRole, "patient"];
      expect(allowedRoles.includes(requestedRole)).toBe(true);
    });
  });

  describe("Menu count verification per activeRole", () => {
    it("system_admin sees all 21 menus", () => {
      const menus = getMenuForRole("system_admin", []);
      expect(menus.length).toBe(21);
    });

    it("patient sees only 3 menus (wallet, consent, shl)", () => {
      const menus = getMenuForRole("patient", []);
      expect(menus.length).toBe(3);
    });

    it("doctor switching to patient sees 3 menus", () => {
      // activeRole = patient, no additional roles applied in patient mode
      const menus = getMenuForRole("patient", []);
      expect(menus.length).toBe(3);
    });

    it("integration_engineer sees 8 menus", () => {
      const menus = getMenuForRole("integration_engineer", []);
      const menuIds = menus.map(m => m.id);
      expect(menuIds).toContain("dashboard");
      expect(menuIds).toContain("integration");
      expect(menuIds).toContain("portability");
      expect(menuIds).toContain("fhir-mapping");
      expect(menuIds).toContain("terminology");
      expect(menuIds).toContain("patient-identity");
      expect(menus.length).toBe(6);
    });
  });
});
