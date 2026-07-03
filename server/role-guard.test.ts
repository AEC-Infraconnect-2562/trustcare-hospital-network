import { describe, expect, it } from "vitest";

// Pure access-control tests mirroring client/src/components/RoleGuard.tsx.
// Keep this fixture synchronized with App.tsx and shared/menuConfig.ts.

type SystemRole =
  | "system_admin"
  | "hospital_admin"
  | "maker"
  | "checker"
  | "doctor"
  | "nurse"
  | "integration_engineer"
  | "patient";

interface RouteAccess {
  path: string;
  roles: SystemRole[];
  additionalRolesGrant?: string[];
}

const routeAccessConfig: RouteAccess[] = [
  {
    path: "/dashboard",
    roles: [
      "system_admin",
      "hospital_admin",
      "maker",
      "checker",
      "doctor",
      "nurse",
      "integration_engineer",
    ],
  },
  { path: "/executive", roles: ["system_admin", "hospital_admin"] },
  {
    path: "/profile",
    roles: [
      "system_admin",
      "hospital_admin",
      "maker",
      "checker",
      "doctor",
      "nurse",
      "integration_engineer",
      "patient",
    ],
  },
  {
    path: "/prepare-service",
    roles: [
      "system_admin",
      "hospital_admin",
      "maker",
      "checker",
      "doctor",
      "nurse",
      "integration_engineer",
      "patient",
    ],
  },
  {
    path: "/wallet",
    roles: [
      "system_admin",
      "hospital_admin",
      "maker",
      "checker",
      "doctor",
      "nurse",
      "integration_engineer",
      "patient",
    ],
  },
  {
    path: "/consent",
    roles: ["system_admin", "hospital_admin", "doctor", "nurse", "patient"],
  },
  {
    path: "/shl",
    roles: [
      "system_admin",
      "hospital_admin",
      "maker",
      "checker",
      "doctor",
      "nurse",
      "integration_engineer",
      "patient",
    ],
    additionalRolesGrant: ["issuer_maker", "issuer_checker"],
  },
  {
    path: "/service-verify",
    roles: ["system_admin", "hospital_admin", "doctor", "nurse"],
  },
  {
    path: "/referral",
    roles: ["system_admin", "hospital_admin", "doctor", "nurse"],
  },
  {
    path: "/cross-border",
    roles: ["system_admin", "hospital_admin", "doctor"],
  },
  {
    path: "/international",
    roles: ["system_admin", "hospital_admin", "doctor", "nurse"],
  },
  {
    path: "/partner-portal",
    roles: [
      "system_admin",
      "hospital_admin",
      "maker",
      "checker",
      "doctor",
      "nurse",
      "integration_engineer",
    ],
    additionalRolesGrant: ["issuer_maker", "issuer_checker"],
  },
  {
    path: "/issuer",
    roles: ["system_admin", "hospital_admin", "maker", "checker", "doctor"],
    additionalRolesGrant: ["issuer_maker", "issuer_checker"],
  },
  {
    path: "/issuer/:id",
    roles: ["system_admin", "hospital_admin", "maker", "checker", "doctor"],
    additionalRolesGrant: ["issuer_maker", "issuer_checker"],
  },
  {
    path: "/maker-queue",
    roles: ["system_admin", "hospital_admin", "maker", "doctor", "nurse"],
    additionalRolesGrant: ["issuer_maker"],
  },
  {
    path: "/checker-queue",
    roles: ["system_admin", "hospital_admin", "checker", "doctor"],
    additionalRolesGrant: ["issuer_checker"],
  },
  {
    path: "/verifier",
    roles: ["system_admin", "hospital_admin", "checker", "doctor", "nurse"],
    additionalRolesGrant: ["issuer_maker", "issuer_checker"],
  },
  { path: "/trust-registry", roles: ["system_admin", "hospital_admin"] },
  {
    path: "/claim-center",
    roles: ["system_admin", "hospital_admin", "doctor", "nurse"],
  },
  { path: "/claim-analytics", roles: ["system_admin", "hospital_admin"] },
  {
    path: "/integration",
    roles: ["system_admin", "hospital_admin", "integration_engineer"],
  },
  {
    path: "/adapter-sdk",
    roles: ["system_admin", "hospital_admin", "integration_engineer"],
  },
  {
    path: "/portability",
    roles: [
      "system_admin",
      "hospital_admin",
      "maker",
      "checker",
      "doctor",
      "integration_engineer",
    ],
  },
  {
    path: "/fhir-mapping",
    roles: ["system_admin", "hospital_admin", "integration_engineer"],
  },
  {
    path: "/terminology",
    roles: ["system_admin", "hospital_admin", "integration_engineer"],
  },
  {
    path: "/patient-identity",
    roles: ["system_admin", "hospital_admin", "integration_engineer"],
  },
  { path: "/hospitals", roles: ["system_admin", "hospital_admin"] },
  { path: "/partner-wizard", roles: ["system_admin", "hospital_admin"] },
  { path: "/audit", roles: ["system_admin", "hospital_admin"] },
  { path: "/users", roles: ["system_admin", "hospital_admin"] },
  { path: "/settings", roles: ["system_admin", "hospital_admin"] },
];

function normalizeRoutePath(path: string): string {
  const clean = path.split("?")[0].split("#")[0].replace(/\/+$/, "");
  return clean || "/";
}

function routeMatches(configPath: string, actualPath: string): boolean {
  const pattern = normalizeRoutePath(configPath);
  const actual = normalizeRoutePath(actualPath);
  if (!pattern.includes(":")) return pattern === actual;
  const patternSegments = pattern.split("/");
  const actualSegments = actual.split("/");
  if (patternSegments.length !== actualSegments.length) return false;
  return patternSegments.every((segment, index) => {
    if (segment.startsWith(":")) return actualSegments[index].length > 0;
    return segment === actualSegments[index];
  });
}

function hasAccess(
  path: string,
  activeRole: SystemRole,
  additionalRoles: string[] = []
): boolean {
  const config = routeAccessConfig.find(route =>
    routeMatches(route.path, path)
  );
  if (!config) return true;
  if (config.roles.includes(activeRole)) return true;
  if (activeRole === "patient") return false;
  if (config.additionalRolesGrant) {
    for (const addRole of additionalRoles) {
      if (config.additionalRolesGrant.includes(addRole)) return true;
    }
  }
  return false;
}

describe("RoleGuard - Route Access Control", () => {
  describe("system_admin has access to all routes", () => {
    it("allows system_admin to access every protected route", () => {
      for (const route of routeAccessConfig) {
        expect(hasAccess(route.path, "system_admin")).toBe(true);
      }
    });
  });

  describe("patient role restrictions", () => {
    const patientAllowed = [
      "/profile",
      "/prepare-service",
      "/wallet",
      "/consent",
      "/shl",
    ];
    const patientDenied = [
      "/dashboard",
      "/executive",
      "/service-verify",
      "/referral",
      "/cross-border",
      "/international",
      "/partner-portal",
      "/issuer",
      "/issuer/42",
      "/maker-queue",
      "/checker-queue",
      "/verifier",
      "/trust-registry",
      "/claim-center",
      "/claim-analytics",
      "/integration",
      "/adapter-sdk",
      "/portability",
      "/fhir-mapping",
      "/terminology",
      "/patient-identity",
      "/hospitals",
      "/partner-wizard",
      "/audit",
      "/users",
      "/settings",
    ];

    it("allows patient to access patient readiness and wallet routes", () => {
      for (const path of patientAllowed) {
        expect(hasAccess(path, "patient")).toBe(true);
      }
    });

    it("denies patient access to clinical, verifier, issuer, integration, and admin routes", () => {
      for (const path of patientDenied) {
        expect(hasAccess(path, "patient")).toBe(false);
      }
    });

    it("ignores stale issuer grants on patient accounts", () => {
      expect(hasAccess("/issuer", "patient", ["issuer_maker"])).toBe(false);
      expect(hasAccess("/issuer/42", "patient", ["issuer_checker"])).toBe(
        false
      );
      expect(hasAccess("/maker-queue", "patient", ["issuer_maker"])).toBe(
        false
      );
      expect(hasAccess("/checker-queue", "patient", ["issuer_checker"])).toBe(
        false
      );
    });
  });

  describe("nurse role restrictions", () => {
    const nurseAllowed = [
      "/dashboard",
      "/profile",
      "/prepare-service",
      "/wallet",
      "/consent",
      "/shl",
      "/service-verify",
      "/referral",
      "/international",
      "/maker-queue",
      "/verifier",
      "/claim-center",
    ];
    const nurseDenied = [
      "/executive",
      "/cross-border",
      "/issuer",
      "/issuer/42",
      "/checker-queue",
      "/trust-registry",
      "/claim-analytics",
      "/integration",
      "/adapter-sdk",
      "/portability",
      "/fhir-mapping",
      "/terminology",
      "/patient-identity",
      "/hospitals",
      "/partner-wizard",
      "/audit",
      "/users",
      "/settings",
    ];

    it("allows nurse to access clinical intake routes", () => {
      for (const path of nurseAllowed) {
        expect(hasAccess(path, "nurse")).toBe(true);
      }
    });

    it("denies nurse access to admin and integration routes", () => {
      for (const path of nurseDenied) {
        expect(hasAccess(path, "nurse")).toBe(false);
      }
    });
  });

  describe("integration_engineer role restrictions", () => {
    const engineerAllowed = [
      "/dashboard",
      "/profile",
      "/prepare-service",
      "/wallet",
      "/shl",
      "/partner-portal",
      "/integration",
      "/adapter-sdk",
      "/portability",
      "/fhir-mapping",
      "/terminology",
      "/patient-identity",
    ];
    const engineerDenied = [
      "/executive",
      "/consent",
      "/service-verify",
      "/referral",
      "/cross-border",
      "/international",
      "/issuer",
      "/issuer/42",
      "/maker-queue",
      "/checker-queue",
      "/verifier",
      "/trust-registry",
      "/claim-center",
      "/claim-analytics",
      "/hospitals",
      "/partner-wizard",
      "/audit",
      "/users",
      "/settings",
    ];

    it("allows integration_engineer to access interop and readiness routes", () => {
      for (const path of engineerAllowed) {
        expect(hasAccess(path, "integration_engineer")).toBe(true);
      }
    });

    it("denies integration_engineer access to clinical decision and admin routes", () => {
      for (const path of engineerDenied) {
        expect(hasAccess(path, "integration_engineer")).toBe(false);
      }
    });
  });

  describe("additionalRoles grant access", () => {
    it("nurse with issuer_maker can access issuer, credential detail, and maker queue", () => {
      expect(hasAccess("/issuer", "nurse", ["issuer_maker"])).toBe(true);
      expect(hasAccess("/issuer/42", "nurse", ["issuer_maker"])).toBe(true);
      expect(hasAccess("/maker-queue", "nurse", ["issuer_maker"])).toBe(true);
      expect(hasAccess("/verifier", "nurse", ["issuer_maker"])).toBe(true);
    });

    it("nurse with issuer_maker cannot access checker queue", () => {
      expect(hasAccess("/checker-queue", "nurse", ["issuer_maker"])).toBe(
        false
      );
    });

    it("nurse with issuer_checker can access checker routes", () => {
      expect(hasAccess("/checker-queue", "nurse", ["issuer_checker"])).toBe(
        true
      );
      expect(hasAccess("/issuer", "nurse", ["issuer_checker"])).toBe(true);
      expect(hasAccess("/issuer/42", "nurse", ["issuer_checker"])).toBe(true);
      expect(hasAccess("/maker-queue", "nurse", ["issuer_checker"])).toBe(true);
    });

    it("integration_engineer with issuer_maker can access issuer routes", () => {
      expect(
        hasAccess("/issuer", "integration_engineer", ["issuer_maker"])
      ).toBe(true);
      expect(
        hasAccess("/issuer/42", "integration_engineer", ["issuer_maker"])
      ).toBe(true);
      expect(
        hasAccess("/maker-queue", "integration_engineer", ["issuer_maker"])
      ).toBe(true);
    });
  });

  describe("route matching", () => {
    it("matches dynamic credential detail routes", () => {
      expect(routeMatches("/issuer/:id", "/issuer/42")).toBe(true);
      expect(routeMatches("/issuer/:id", "/issuer/42?tab=trust")).toBe(true);
      expect(routeMatches("/issuer/:id", "/issuer")).toBe(false);
      expect(routeMatches("/issuer/:id", "/issuer/42/audit")).toBe(false);
    });
  });

  describe("public routes with no config", () => {
    it("allows access to routes not in the protected config", () => {
      expect(hasAccess("/", "patient")).toBe(true);
      expect(hasAccess("/404", "patient")).toBe(true);
      expect(hasAccess("/some-unknown-path", "patient")).toBe(true);
    });
  });

  describe("routeAccessConfig consistency", () => {
    it("every protected route includes system_admin", () => {
      for (const route of routeAccessConfig) {
        expect(route.roles).toContain("system_admin");
      }
    });

    it("every protected route has at least one role", () => {
      for (const route of routeAccessConfig) {
        expect(route.roles.length).toBeGreaterThan(0);
      }
    });

    it("routes with additionalRolesGrant use valid grant values", () => {
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
