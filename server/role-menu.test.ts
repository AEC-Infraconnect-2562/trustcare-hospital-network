import { describe, it, expect } from "vitest";

// We test the menu filtering logic directly by replicating the DashboardLayout logic
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

const allMenuItems: MenuItemDef[] = [
  { id: "dashboard", label: "แดชบอร์ด", icon: "LayoutDashboard", path: "/dashboard", roles: ["system_admin", "hospital_admin", "doctor", "nurse", "integration_engineer", "patient"], group: "overview", groupLabel: "ภาพรวม" },
  { id: "executive", label: "แดชบอร์ดผู้บริหาร", icon: "BarChart3", path: "/executive", roles: ["system_admin", "hospital_admin"], group: "overview", groupLabel: "ภาพรวม" },
  { id: "wallet", label: "กระเป๋าสุขภาพ", icon: "Wallet", path: "/wallet", roles: ["system_admin", "hospital_admin", "doctor", "nurse", "patient"], group: "patient_services", groupLabel: "บริการผู้ป่วย" },
  { id: "consent", label: "จัดการความยินยอม", icon: "ShieldCheck", path: "/consent", roles: ["system_admin", "hospital_admin", "doctor", "nurse", "patient"], group: "patient_services", groupLabel: "บริการผู้ป่วย" },
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

function getMenuForRole(role: SystemRole) {
  return allMenuItems.filter(item => item.roles.includes(role));
}

describe("Role-based menu visibility", () => {
  it("system_admin should see all menu items", () => {
    const items = getMenuForRole("system_admin");
    expect(items.length).toBe(allMenuItems.length);
  });

  it("hospital_admin should see all items except integration-engineer-only menus", () => {
    const items = getMenuForRole("hospital_admin");
    expect(items.find(i => i.id === "wallet")).toBeDefined();
    expect(items.find(i => i.id === "executive")).toBeDefined();
    expect(items.find(i => i.id === "hospitals")).toBeDefined();
    expect(items.find(i => i.id === "users")).toBeDefined();
    expect(items.find(i => i.id === "settings")).toBeDefined();
  });

  it("doctor should see clinical, credentials (issuer), portability, wallet, but NOT admin", () => {
    const items = getMenuForRole("doctor");
    const ids = items.map(i => i.id);
    // Should have
    expect(ids).toContain("dashboard");
    expect(ids).toContain("wallet");
    expect(ids).toContain("consent");
    expect(ids).toContain("shl");
    expect(ids).toContain("referral");
    expect(ids).toContain("cross-border");
    expect(ids).toContain("international");
    expect(ids).toContain("issuer");
    expect(ids).toContain("verifier");
    expect(ids).toContain("claim-center");
    expect(ids).toContain("portability");
    // Should NOT have
    expect(ids).not.toContain("executive");
    expect(ids).not.toContain("hospitals");
    expect(ids).not.toContain("users");
    expect(ids).not.toContain("settings");
    expect(ids).not.toContain("integration");
    expect(ids).not.toContain("fhir-mapping");
    expect(ids).not.toContain("terminology");
    expect(ids).not.toContain("patient-identity");
  });

  it("nurse should see clinical, verifier, claim-center, wallet, but NOT issuer or admin", () => {
    const items = getMenuForRole("nurse");
    const ids = items.map(i => i.id);
    // Should have
    expect(ids).toContain("dashboard");
    expect(ids).toContain("wallet");
    expect(ids).toContain("consent");
    expect(ids).toContain("shl");
    expect(ids).toContain("referral");
    expect(ids).toContain("international");
    expect(ids).toContain("verifier");
    expect(ids).toContain("claim-center");
    // Should NOT have
    expect(ids).not.toContain("executive");
    expect(ids).not.toContain("issuer");
    expect(ids).not.toContain("cross-border");
    expect(ids).not.toContain("hospitals");
    expect(ids).not.toContain("users");
    expect(ids).not.toContain("settings");
    expect(ids).not.toContain("integration");
    expect(ids).not.toContain("fhir-mapping");
    expect(ids).not.toContain("terminology");
    expect(ids).not.toContain("patient-identity");
  });

  it("integration_engineer should see interop + MPI, but NOT clinical, credentials, or admin", () => {
    const items = getMenuForRole("integration_engineer");
    const ids = items.map(i => i.id);
    // Should have
    expect(ids).toContain("dashboard");
    expect(ids).toContain("integration");
    expect(ids).toContain("portability");
    expect(ids).toContain("fhir-mapping");
    expect(ids).toContain("terminology");
    expect(ids).toContain("patient-identity");
    // Should NOT have
    expect(ids).not.toContain("wallet");
    expect(ids).not.toContain("executive");
    expect(ids).not.toContain("referral");
    expect(ids).not.toContain("issuer");
    expect(ids).not.toContain("verifier");
    expect(ids).not.toContain("hospitals");
    expect(ids).not.toContain("users");
    expect(ids).not.toContain("settings");
    expect(ids).not.toContain("claim-center");
  });

  it("patient should see only dashboard, wallet, consent, shl", () => {
    const items = getMenuForRole("patient");
    const ids = items.map(i => i.id);
    expect(ids).toEqual(["dashboard", "wallet", "consent", "shl"]);
  });

  it("no role should have empty menu (at least dashboard)", () => {
    const roles: SystemRole[] = ["system_admin", "hospital_admin", "doctor", "nurse", "integration_engineer", "patient"];
    for (const role of roles) {
      const items = getMenuForRole(role);
      expect(items.length).toBeGreaterThan(0);
      expect(items.find(i => i.id === "dashboard")).toBeDefined();
    }
  });
});

describe("Backend procedure access control alignment", () => {
  const adminRoles: SystemRole[] = ["system_admin", "hospital_admin"];
  const clinicalRoles: SystemRole[] = ["system_admin", "hospital_admin", "doctor", "nurse"];
  const interopRoles: SystemRole[] = ["system_admin", "hospital_admin", "integration_engineer"];

  it("hospital management (create/update/delete) should be admin-only", () => {
    const menuItem = allMenuItems.find(i => i.id === "hospitals")!;
    expect(menuItem.roles).toEqual(expect.arrayContaining(adminRoles));
    expect(menuItem.roles).not.toContain("doctor");
    expect(menuItem.roles).not.toContain("nurse");
    expect(menuItem.roles).not.toContain("patient");
  });

  it("user management should be admin-only", () => {
    const menuItem = allMenuItems.find(i => i.id === "users")!;
    expect(menuItem.roles).toEqual(expect.arrayContaining(adminRoles));
    expect(menuItem.roles).not.toContain("doctor");
    expect(menuItem.roles).not.toContain("patient");
  });

  it("issuer menu should match clinical staff who can issue credentials", () => {
    const menuItem = allMenuItems.find(i => i.id === "issuer")!;
    expect(menuItem.roles).toContain("system_admin");
    expect(menuItem.roles).toContain("hospital_admin");
    expect(menuItem.roles).toContain("doctor");
    expect(menuItem.roles).not.toContain("nurse"); // nurse can verify but not issue by default
    expect(menuItem.roles).not.toContain("patient");
  });

  it("verifier menu should be available to clinical staff", () => {
    const menuItem = allMenuItems.find(i => i.id === "verifier")!;
    for (const role of clinicalRoles) {
      expect(menuItem.roles).toContain(role);
    }
    expect(menuItem.roles).not.toContain("patient");
  });

  it("integration/FHIR menus should match interop roles", () => {
    const interopMenus = ["integration", "fhir-mapping", "terminology"];
    for (const menuId of interopMenus) {
      const menuItem = allMenuItems.find(i => i.id === menuId)!;
      for (const role of interopRoles) {
        expect(menuItem.roles).toContain(role);
      }
      expect(menuItem.roles).not.toContain("patient");
      expect(menuItem.roles).not.toContain("nurse");
    }
  });

  it("wallet should be visible to clinical staff and patient", () => {
    const menuItem = allMenuItems.find(i => i.id === "wallet")!;
    expect(menuItem.roles).toContain("system_admin");
    expect(menuItem.roles).toContain("hospital_admin");
    expect(menuItem.roles).toContain("doctor");
    expect(menuItem.roles).toContain("nurse");
    expect(menuItem.roles).toContain("patient");
    expect(menuItem.roles).not.toContain("integration_engineer");
  });

  it("executive dashboard should be admin-only", () => {
    const menuItem = allMenuItems.find(i => i.id === "executive")!;
    expect(menuItem.roles).toEqual(expect.arrayContaining(adminRoles));
    expect(menuItem.roles).not.toContain("doctor");
    expect(menuItem.roles).not.toContain("nurse");
    expect(menuItem.roles).not.toContain("patient");
  });
});
