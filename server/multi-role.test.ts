import { describe, it, expect } from "vitest";

// ============================================================
// Test the menu visibility logic with multi-role support
// ============================================================

type SystemRole = "system_admin" | "hospital_admin" | "doctor" | "nurse" | "integration_engineer" | "patient";

interface MenuItemDef {
  id: string;
  label: string;
  icon: string;
  path: string;
  roles: SystemRole[];
  group: string;
  groupLabel: string;
}

// Mirror the allMenuItems from DashboardLayout
const allMenuItems: MenuItemDef[] = [
  { id: "dashboard", label: "แดชบอร์ด", icon: "LayoutDashboard", path: "/dashboard", roles: ["system_admin", "hospital_admin", "doctor", "nurse", "integration_engineer", "patient"], group: "overview", groupLabel: "ภาพรวม" },
  { id: "executive", label: "แดชบอร์ดผู้บริหาร", icon: "BarChart3", path: "/executive", roles: ["system_admin", "hospital_admin"], group: "overview", groupLabel: "ภาพรวม" },
  { id: "wallet", label: "กระเป๋าสุขภาพ", icon: "Wallet", path: "/wallet", roles: ["system_admin", "hospital_admin", "doctor", "nurse", "patient"], group: "patient_services", groupLabel: "บริการผู้ป่วย" },
  { id: "consent", label: "จัดการความยินยอม", icon: "FileCheck", path: "/consent", roles: ["system_admin", "hospital_admin", "doctor", "nurse", "patient"], group: "patient_services", groupLabel: "บริการผู้ป่วย" },
  { id: "shl", label: "ลิงก์แชร์สุขภาพ", icon: "Link2", path: "/shl", roles: ["system_admin", "hospital_admin", "doctor", "nurse", "patient"], group: "patient_services", groupLabel: "บริการผู้ป่วย" },
  { id: "referral", label: "ส่งต่อผู้ป่วย", icon: "ArrowRightLeft", path: "/referral", roles: ["system_admin", "hospital_admin", "doctor", "nurse"], group: "clinical", groupLabel: "บริการทางคลินิก" },
  { id: "cross-border", label: "ส่งต่อข้ามเครือข่าย", icon: "Globe", path: "/cross-border", roles: ["system_admin", "hospital_admin", "doctor"], group: "clinical", groupLabel: "บริการทางคลินิก" },
  { id: "international", label: "ผู้ป่วยต่างชาติ", icon: "Plane", path: "/international", roles: ["system_admin", "hospital_admin", "doctor", "nurse"], group: "clinical", groupLabel: "บริการทางคลินิก" },
  { id: "issuer", label: "ออกใบรับรอง", icon: "BadgeCheck", path: "/issuer", roles: ["system_admin", "hospital_admin", "doctor"], group: "credentials", groupLabel: "ใบรับรองดิจิทัล" },
  { id: "verifier", label: "ตรวจสอบใบรับรอง", icon: "ScanLine", path: "/verifier", roles: ["system_admin", "hospital_admin", "doctor", "nurse"], group: "credentials", groupLabel: "ใบรับรองดิจิทัล" },
  { id: "trust-registry", label: "ทะเบียนความน่าเชื่อถือ", icon: "ShieldAlert", path: "/trust-registry", roles: ["system_admin", "hospital_admin"], group: "credentials", groupLabel: "ใบรับรองดิจิทัล" },
  { id: "claim-center", label: "ศูนย์เคลม", icon: "Receipt", path: "/claim-center", roles: ["system_admin", "hospital_admin", "doctor", "nurse"], group: "claims", groupLabel: "เคลมและการเงิน" },
  { id: "integration", label: "เชื่อมต่อระบบ HIS", icon: "Plug", path: "/integration", roles: ["system_admin", "hospital_admin", "integration_engineer"], group: "interop", groupLabel: "เชื่อมต่อและมาตรฐาน" },
  { id: "portability", label: "Portability Layer", icon: "FileJson2", path: "/portability", roles: ["system_admin", "hospital_admin", "doctor", "integration_engineer"], group: "interop", groupLabel: "เชื่อมต่อและมาตรฐาน" },
  { id: "fhir-mapping", label: "แผนที่ข้อมูล FHIR", icon: "GitBranch", path: "/fhir-mapping", roles: ["system_admin", "hospital_admin", "integration_engineer"], group: "interop", groupLabel: "เชื่อมต่อและมาตรฐาน" },
  { id: "terminology", label: "จับคู่รหัสมาตรฐาน", icon: "BookOpen", path: "/terminology", roles: ["system_admin", "hospital_admin", "integration_engineer"], group: "interop", groupLabel: "เชื่อมต่อและมาตรฐาน" },
  { id: "patient-identity", label: "เชื่อมโยงตัวตน (MPI)", icon: "Fingerprint", path: "/patient-identity", roles: ["system_admin", "hospital_admin", "integration_engineer"], group: "admin", groupLabel: "บริหารระบบ" },
  { id: "hospitals", label: "จัดการเครือข่าย", icon: "Building2", path: "/hospitals", roles: ["system_admin", "hospital_admin"], group: "admin", groupLabel: "บริหารระบบ" },
  { id: "audit", label: "บันทึกการเข้าถึง", icon: "FileSearch", path: "/audit", roles: ["system_admin", "hospital_admin"], group: "admin", groupLabel: "บริหารระบบ" },
  { id: "users", label: "จัดการผู้ใช้", icon: "Users", path: "/users", roles: ["system_admin", "hospital_admin"], group: "admin", groupLabel: "บริหารระบบ" },
  { id: "settings", label: "ตั้งค่าระบบ", icon: "Settings", path: "/settings", roles: ["system_admin", "hospital_admin"], group: "admin", groupLabel: "บริหารระบบ" },
];

// Mirror the ADDITIONAL_ROLE_MENU_MAP from DashboardLayout
const ADDITIONAL_ROLE_MENU_MAP: Record<string, string[]> = {
  issuer_maker: ["issuer", "verifier"],
  issuer_checker: ["issuer", "verifier"],
};

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

describe("Multi-Role Menu Visibility", () => {
  describe("System Admin", () => {
    it("should see ALL menu items", () => {
      const items = getMenuForRole("system_admin");
      expect(items.length).toBe(allMenuItems.length);
    });
  });

  describe("Hospital Admin", () => {
    it("should see admin, clinical, credentials, claims, and interop menus", () => {
      const items = getMenuForRole("hospital_admin");
      const ids = items.map(i => i.id);
      expect(ids).toContain("dashboard");
      expect(ids).toContain("executive");
      expect(ids).toContain("issuer");
      expect(ids).toContain("hospitals");
      expect(ids).toContain("users");
      expect(ids).toContain("audit");
      expect(ids).toContain("claim-center");
    });
  });

  describe("Doctor (no additional roles)", () => {
    it("should see clinical, credentials (issuer+verifier), patient services", () => {
      const items = getMenuForRole("doctor");
      const ids = items.map(i => i.id);
      expect(ids).toContain("dashboard");
      expect(ids).toContain("wallet");
      expect(ids).toContain("referral");
      expect(ids).toContain("cross-border");
      expect(ids).toContain("issuer");
      expect(ids).toContain("verifier");
      expect(ids).toContain("claim-center");
      expect(ids).not.toContain("executive");
      expect(ids).not.toContain("hospitals");
      expect(ids).not.toContain("users");
      expect(ids).not.toContain("audit");
    });
  });

  describe("Nurse (no additional roles)", () => {
    it("should NOT see issuer menu by default", () => {
      const items = getMenuForRole("nurse");
      const ids = items.map(i => i.id);
      expect(ids).not.toContain("issuer");
      expect(ids).toContain("verifier");
      expect(ids).toContain("referral");
      expect(ids).toContain("claim-center");
      expect(ids).not.toContain("executive");
      expect(ids).not.toContain("hospitals");
      expect(ids).not.toContain("cross-border");
    });
  });

  describe("Nurse with issuer_maker additional role", () => {
    it("should see issuer and verifier menus in addition to normal nurse menus", () => {
      const items = getMenuForRole("nurse", ["issuer_maker"]);
      const ids = items.map(i => i.id);
      expect(ids).toContain("issuer"); // Granted by issuer_maker
      expect(ids).toContain("verifier"); // Already visible + granted by issuer_maker
      expect(ids).toContain("referral");
      expect(ids).toContain("claim-center");
      expect(ids).not.toContain("executive");
      expect(ids).not.toContain("hospitals");
    });
  });

  describe("Integration Engineer (no additional roles)", () => {
    it("should see interop menus but NOT clinical or credentials", () => {
      const items = getMenuForRole("integration_engineer");
      const ids = items.map(i => i.id);
      expect(ids).toContain("dashboard");
      expect(ids).toContain("integration");
      expect(ids).toContain("fhir-mapping");
      expect(ids).toContain("terminology");
      expect(ids).toContain("portability");
      expect(ids).toContain("patient-identity");
      expect(ids).not.toContain("issuer");
      expect(ids).not.toContain("verifier");
      expect(ids).not.toContain("wallet");
      expect(ids).not.toContain("referral");
      expect(ids).not.toContain("executive");
    });
  });

  describe("Integration Engineer with issuer_checker additional role", () => {
    it("should see issuer and verifier menus in addition to interop menus", () => {
      const items = getMenuForRole("integration_engineer", ["issuer_checker"]);
      const ids = items.map(i => i.id);
      expect(ids).toContain("integration");
      expect(ids).toContain("issuer"); // Granted by issuer_checker
      expect(ids).toContain("verifier"); // Granted by issuer_checker
      expect(ids).not.toContain("wallet");
      expect(ids).not.toContain("referral");
    });
  });

  describe("Patient (no additional roles)", () => {
    it("should only see patient services", () => {
      const items = getMenuForRole("patient");
      const ids = items.map(i => i.id);
      expect(ids).toContain("dashboard");
      expect(ids).toContain("wallet");
      expect(ids).toContain("consent");
      expect(ids).toContain("shl");
      expect(ids).not.toContain("issuer");
      expect(ids).not.toContain("verifier");
      expect(ids).not.toContain("referral");
      expect(ids).not.toContain("hospitals");
      expect(ids).not.toContain("integration");
      expect(ids).not.toContain("executive");
    });
  });

  describe("Patient with issuer_maker additional role (edge case)", () => {
    it("should still be limited to patient services", () => {
      const items = getMenuForRole("patient", ["issuer_maker"]);
      const ids = items.map(i => i.id);
      expect(ids).toContain("dashboard");
      expect(ids).toContain("wallet");
      expect(ids).not.toContain("issuer");
      expect(ids).not.toContain("verifier");
    });
  });
});

describe("Clinical Procedure Access Control", () => {
  const clinicalRoles = ["system_admin", "hospital_admin", "doctor", "nurse"];
  const issuerAdditionalRoles = ["issuer_maker", "issuer_checker"];

  function canAccessClinical(systemRole: string, additionalRoles: string[] = []): boolean {
    if (systemRole === "patient") return false;
    if (clinicalRoles.includes(systemRole)) return true;
    return additionalRoles.some(r => issuerAdditionalRoles.includes(r));
  }

  it("system_admin can access clinical procedures", () => {
    expect(canAccessClinical("system_admin")).toBe(true);
  });

  it("hospital_admin can access clinical procedures", () => {
    expect(canAccessClinical("hospital_admin")).toBe(true);
  });

  it("doctor can access clinical procedures", () => {
    expect(canAccessClinical("doctor")).toBe(true);
  });

  it("nurse can access clinical procedures", () => {
    expect(canAccessClinical("nurse")).toBe(true);
  });

  it("integration_engineer CANNOT access clinical procedures by default", () => {
    expect(canAccessClinical("integration_engineer")).toBe(false);
  });

  it("patient CANNOT access clinical procedures by default", () => {
    expect(canAccessClinical("patient")).toBe(false);
  });

  it("integration_engineer WITH issuer_maker CAN access clinical procedures", () => {
    expect(canAccessClinical("integration_engineer", ["issuer_maker"])).toBe(true);
  });

  it("patient WITH issuer_checker CANNOT access clinical procedures", () => {
    expect(canAccessClinical("patient", ["issuer_checker"])).toBe(false);
  });
});
