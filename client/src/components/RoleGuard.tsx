import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { normalizeActiveRole, sanitizeAdditionalRolesForSystemRole } from "@shared/rolePolicy";

// ─── Route Access Configuration ────────────────────────────────────────────
// Maps each protected route to the roles that can access it.
// This mirrors the allMenuItems in DashboardLayout.tsx.
type SystemRole = "system_admin" | "hospital_admin" | "maker" | "checker" | "doctor" | "nurse" | "integration_engineer" | "patient";

interface RouteAccess {
  path: string;
  roles: SystemRole[];
  // Additional roles (e.g., issuer_maker, issuer_checker) that also grant access
  additionalRolesGrant?: string[];
}

const routeAccessConfig: RouteAccess[] = [
  // Overview
  { path: "/dashboard", roles: ["system_admin", "hospital_admin", "maker", "checker", "doctor", "nurse", "integration_engineer", "patient"] },
  { path: "/executive", roles: ["system_admin", "hospital_admin"] },
  // Patient Services
  { path: "/wallet", roles: ["system_admin", "hospital_admin", "doctor", "nurse", "patient"] },
  { path: "/consent", roles: ["system_admin", "hospital_admin", "doctor", "nurse", "patient"] },
  { path: "/shl", roles: ["system_admin", "hospital_admin", "maker", "checker", "doctor", "nurse", "integration_engineer", "patient"], additionalRolesGrant: ["issuer_maker", "issuer_checker"] },
  // Clinical Services
  { path: "/referral", roles: ["system_admin", "hospital_admin", "doctor", "nurse"] },
  { path: "/cross-border", roles: ["system_admin", "hospital_admin", "doctor"] },
  { path: "/international", roles: ["system_admin", "hospital_admin", "doctor", "nurse"] },
  { path: "/partner-portal", roles: ["system_admin", "hospital_admin", "maker", "checker", "doctor", "nurse", "integration_engineer"], additionalRolesGrant: ["issuer_maker", "issuer_checker"] },
  // Digital Credentials
  { path: "/issuer", roles: ["system_admin", "hospital_admin", "doctor"], additionalRolesGrant: ["issuer_maker", "issuer_checker"] },
  { path: "/maker-queue", roles: ["system_admin", "hospital_admin", "doctor"], additionalRolesGrant: ["issuer_maker", "issuer_checker"] },
  { path: "/checker-queue", roles: ["system_admin"], additionalRolesGrant: ["issuer_checker"] },
  { path: "/verifier", roles: ["system_admin", "hospital_admin", "doctor", "nurse"], additionalRolesGrant: ["issuer_maker", "issuer_checker"] },
  { path: "/trust-registry", roles: ["system_admin", "hospital_admin"] },
  // Claims & Finance
  { path: "/claim-center", roles: ["system_admin", "hospital_admin", "doctor", "nurse"] },
  // Interoperability
  { path: "/integration", roles: ["system_admin", "hospital_admin", "integration_engineer"] },
  { path: "/portability", roles: ["system_admin", "hospital_admin", "maker", "checker", "doctor", "integration_engineer"] },
  { path: "/fhir-mapping", roles: ["system_admin", "hospital_admin", "integration_engineer"] },
  { path: "/terminology", roles: ["system_admin", "hospital_admin", "integration_engineer"] },
  // Administration
  { path: "/patient-identity", roles: ["system_admin", "hospital_admin", "integration_engineer"] },
  { path: "/hospitals", roles: ["system_admin", "hospital_admin"] },
  { path: "/audit", roles: ["system_admin", "hospital_admin"] },
  { path: "/users", roles: ["system_admin", "hospital_admin"] },
  { path: "/settings", roles: ["system_admin", "hospital_admin"] },
];

function hasAccess(
  path: string,
  activeRole: string,
  additionalRoles: string[]
): boolean {
  const config = routeAccessConfig.find(r => r.path === path);
  // If no config found, allow access (public routes like /, /404)
  if (!config) return true;
  const effectiveAdditionalRoles = activeRole === "patient" ? [] : additionalRoles;
  // Check primary role
  if (config.roles.includes(activeRole as SystemRole)) return true;
  // Check additional roles
  if (config.additionalRolesGrant) {
    for (const addRole of effectiveAdditionalRoles) {
      if (config.additionalRolesGrant.includes(addRole)) return true;
    }
  }
  return false;
}

// Export for testing
export { routeAccessConfig, hasAccess };
export type { SystemRole, RouteAccess };

// ─── RoleGuard Component ───────────────────────────────────────────────────
export default function RoleGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [location, setLocation] = useLocation();
  const [denied, setDenied] = useState(false);

  // Derive activeRole and additionalRoles from user data
  const systemRole: SystemRole = (user as any)?.systemRole || (user?.role === "admin" ? "system_admin" : "patient");
  const additionalRoles: string[] = sanitizeAdditionalRolesForSystemRole(systemRole, (user as any)?.additionalRoles || []);
  const activeRole = normalizeActiveRole(systemRole, (user as any)?.activeRole || systemRole, additionalRoles);

  useEffect(() => {
    if (loading || !user) return;
    // Skip guard for public routes
    if (location === "/" || location === "/404" || location === "/shl-viewer") {
      setDenied(false);
      return;
    }
    const allowed = hasAccess(location, activeRole, additionalRoles);
    setDenied(!allowed);
  }, [location, user, loading, activeRole, additionalRoles]);

  if (loading) return null; // Let DashboardLayout handle loading state
  if (!user) return <>{children}</>; // Let DashboardLayout handle unauthenticated

  if (denied) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-6 p-8 max-w-md w-full text-center">
          <div className="h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center">
            <ShieldAlert className="h-10 w-10 text-destructive" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">ไม่มีสิทธิ์เข้าถึง</h1>
            <p className="text-muted-foreground">
              บทบาทปัจจุบันของคุณ ({getRoleLabel(activeRole)}) ไม่มีสิทธิ์เข้าถึงหน้านี้
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setLocation("/dashboard")}>
              กลับแดชบอร์ด
            </Button>
            <Button onClick={() => window.history.back()}>
              ย้อนกลับ
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    system_admin: "ผู้ดูแลระบบ",
    hospital_admin: "ผู้ดูแลโรงพยาบาล",
    maker: "Maker",
    checker: "Checker",
    doctor: "แพทย์",
    nurse: "พยาบาล",
    integration_engineer: "วิศวกรเชื่อมต่อ",
    patient: "ผู้ป่วย",
    issuer_maker: "Maker",
    issuer_checker: "Checker",
  };
  return labels[role] || role;
}
