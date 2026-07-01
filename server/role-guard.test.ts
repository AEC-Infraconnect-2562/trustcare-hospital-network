import { describe, it, expect } from "vitest";

// We test the pure hasAccess function logic that mirrors the RoleGuard component
// Since RoleGuard is a React component, we test the access logic separately

type SystemRole = "system_admin" | "hospital_admin" | "doctor" | "nurse" | "integration_engineer" | "patient";

interface RouteAccess {
  path: string;
  roles: SystemRole[];
  additionalRolesGrant?: string[];
}

// Mirror of the routeAccessConfig from RoleGuard.tsx
const routeAccessConfig: RouteAccess[] = [
  { path: "/dashboard", roles: ["system_admin", "hospital_admin", "doctor", "nurse", "integration_engineer", "patient"] },
  { path: "/executive", roles: ["system_admin", "hospital_admin"] },
  { path: "/wallet", roles: ["system_admin", "hospital_admin", "doctor", "nurse", "patient"] },
  { path: "/consent", roles: ["system_admin", "hospital_admin", "doctor", "nurse", "patient"] },
  { path: "/shl", roles: ["system_admin", "hospital_admin", "doctor", "nurse", "patient"] },
  { path: "/referral", roles: ["system_admin", "hospital_admin", "doctor", "nurse"] },
  { path: "/cross-border", roles: ["system_admin", "hospital_admin", "doctor"] },
  { path: "/international", roles: ["system_admin", "hospital_admin", "doctor", "nurse"] },
  { path: "/issuer", roles: ["system_admin", "hospital_admin", "doctor"], additionalRolesGrant: ["issuer_maker", "issuer_checker"] },
  { path: "/maker-queue", roles: ["system_admin", "hospital_admin", "doctor"], additionalRolesGrant: ["issuer_maker", "issuer_checker"] },
  { path: "/checker-queue", roles: ["system_admin"], additionalRolesGrant: ["issuer_checker"] },
  { path: "/verifier", roles: ["system_admin", "hospital_admin", "doctor", "nurse"], additionalRolesGrant: ["issuer_maker", "issuer_checker"] },
  { path: "/trust-registry", roles: ["system_admin", "hospital_admin"] },
  { path: "/claim-center", roles: ["system_admin", "hospital_admin", "doctor", "nurse"] },
  { path: "/integration", roles: ["system_admin", "hospital_admin", "integration_engineer"] },
  { path: "/portability", roles: ["system_admin", "hospital_admin", "doctor", "integration_engineer"] },
  { path: "/fhir-mapping", roles: ["system_admin", "hospital_admin", "integration_engineer"] },
  { path: "/terminology", roles: ["system_admin", "hospital_admin", "integration_engineer"] },
  { path: "/patient-identity", roles: ["system_admin", "hospital_admin", "integration_engineer"] },
  { path: "/hospitals", roles: ["system_admin", "hospital_admin"] },
  { path: "/audit", roles: ["system_admin", "hospital_admin"] },
  { path: "/users", roles: ["system_admin", "hospital_admin"] },
  { path: "/settings", roles: ["system_admin", "hospital_admin"] },
];

function hasAccess(path: string, activeRole: SystemRole, additionalRoles: string[] = []): boolean {
  const config = routeAccessConfig.find(r => r.path === path);
  if (!config) return true;
  if (config.roles.includes(activeRole)) return true;
  if (config.additionalRolesGrant) {
    for (const addRole of additionalRoles) {
      if (config.additionalRolesGrant.includes(addRole)) return true;
    }
  }
  return false;
}

describe("RoleGuard - Route Access Control", () => {
  describe("system_admin has access to all routes", () => {
    it("should allow system_admin to access every protected route", () => {
      for (const route of routeAccessConfig) {
        expect(hasAccess(route.path, "system_admin")).toBe(true);
      }
    });
  });

  describe("patient role restrictions", () => {
    const patientAllowed = ["/dashboard", "/wallet", "/consent", "/shl"];
    const patientDenied = [
      "/executive", "/referral", "/cross-border", "/international",
      "/issuer", "/maker-queue", "/checker-queue", "/verifier",
      "/trust-registry", "/claim-center", "/integration", "/portability",
      "/fhir-mapping", "/terminology", "/patient-identity",
      "/hospitals", "/audit", "/users", "/settings"
    ];

    it("should allow patient to access patient-specific routes", () => {
      for (const path of patientAllowed) {
        expect(hasAccess(path, "patient")).toBe(true);
      }
    });

    it("should deny patient access to clinical/admin routes", () => {
      for (const path of patientDenied) {
        expect(hasAccess(path, "patient")).toBe(false);
      }
    });
  });

  describe("nurse role restrictions", () => {
    const nurseAllowed = [
      "/dashboard", "/wallet", "/consent", "/shl",
      "/referral", "/international", "/verifier",
      "/claim-center"
    ];
    const nurseDenied = [
      "/executive", "/cross-border", "/issuer", "/maker-queue",
      "/checker-queue", "/trust-registry", "/integration",
      "/portability", "/fhir-mapping", "/terminology",
      "/patient-identity", "/hospitals", "/audit", "/users", "/settings"
    ];

    it("should allow nurse to access clinical and patient routes", () => {
      for (const path of nurseAllowed) {
        expect(hasAccess(path, "nurse")).toBe(true);
      }
    });

    it("should deny nurse access to admin/interop routes", () => {
      for (const path of nurseDenied) {
        expect(hasAccess(path, "nurse")).toBe(false);
      }
    });
  });

  describe("integration_engineer role restrictions", () => {
    const engineerAllowed = [
      "/dashboard", "/integration", "/portability",
      "/fhir-mapping", "/terminology", "/patient-identity"
    ];
    const engineerDenied = [
      "/executive", "/wallet", "/consent", "/shl",
      "/referral", "/cross-border", "/international",
      "/issuer", "/maker-queue", "/checker-queue", "/verifier",
      "/trust-registry", "/claim-center",
      "/hospitals", "/audit", "/users", "/settings"
    ];

    it("should allow integration_engineer to access interop routes", () => {
      for (const path of engineerAllowed) {
        expect(hasAccess(path, "integration_engineer")).toBe(true);
      }
    });

    it("should deny integration_engineer access to clinical/admin routes", () => {
      for (const path of engineerDenied) {
        expect(hasAccess(path, "integration_engineer")).toBe(false);
      }
    });
  });

  describe("additionalRoles grant access", () => {
    it("nurse with issuer_maker can access issuer and maker-queue", () => {
      expect(hasAccess("/issuer", "nurse", ["issuer_maker"])).toBe(true);
      expect(hasAccess("/maker-queue", "nurse", ["issuer_maker"])).toBe(true);
      expect(hasAccess("/verifier", "nurse", ["issuer_maker"])).toBe(true);
    });

    it("nurse with issuer_maker cannot access checker-queue", () => {
      expect(hasAccess("/checker-queue", "nurse", ["issuer_maker"])).toBe(false);
    });

    it("nurse with issuer_checker can access checker-queue", () => {
      expect(hasAccess("/checker-queue", "nurse", ["issuer_checker"])).toBe(true);
      expect(hasAccess("/issuer", "nurse", ["issuer_checker"])).toBe(true);
      expect(hasAccess("/maker-queue", "nurse", ["issuer_checker"])).toBe(true);
    });

    it("patient with no additional roles cannot access issuer routes", () => {
      expect(hasAccess("/issuer", "patient")).toBe(false);
      expect(hasAccess("/maker-queue", "patient")).toBe(false);
      expect(hasAccess("/checker-queue", "patient")).toBe(false);
    });

    it("integration_engineer with issuer_maker can access issuer routes", () => {
      expect(hasAccess("/issuer", "integration_engineer", ["issuer_maker"])).toBe(true);
      expect(hasAccess("/maker-queue", "integration_engineer", ["issuer_maker"])).toBe(true);
    });
  });

  describe("public routes (no config) allow all", () => {
    it("should allow access to routes not in the config", () => {
      expect(hasAccess("/", "patient")).toBe(true);
      expect(hasAccess("/404", "patient")).toBe(true);
      expect(hasAccess("/some-unknown-path", "patient")).toBe(true);
    });
  });

  describe("routeAccessConfig consistency", () => {
    it("every route should include system_admin", () => {
      for (const route of routeAccessConfig) {
        expect(route.roles).toContain("system_admin");
      }
    });

    it("every route should have at least one role", () => {
      for (const route of routeAccessConfig) {
        expect(route.roles.length).toBeGreaterThan(0);
      }
    });

    it("routes with additionalRolesGrant should have valid grant values", () => {
      const validGrants = ["issuer_maker", "issuer_checker"];
      for (const route of routeAccessConfig) {
        if (route.additionalRolesGrant) {
          for (const grant of route.additionalRolesGrant) {
            expect(validGrants).toContain(grant);
          }
        }
      }
    });
  });
});
