export type SystemRole = "system_admin" | "hospital_admin" | "doctor" | "nurse" | "integration_engineer" | "patient";

export interface MenuItem {
  id: string;
  label: string;
  labelEn: string;
  icon: string; // lucide icon name
  path: string;
  roles: SystemRole[];
  group: string;
  groupLabel: string;
  groupLabelEn: string;
}

export const menuGroups = [
  { id: "overview", label: "ภาพรวม", labelEn: "Overview" },
  { id: "patient_services", label: "บริการผู้ป่วย", labelEn: "Patient Services" },
  { id: "clinical", label: "บริการทางคลินิก", labelEn: "Clinical Services" },
  { id: "credentials", label: "ใบรับรองดิจิทัล", labelEn: "Digital Credentials" },
  { id: "claims", label: "เคลมและการเงิน", labelEn: "Claims & Finance" },
  { id: "interop", label: "เชื่อมต่อและมาตรฐาน", labelEn: "Interoperability" },
  { id: "admin", label: "บริหารระบบ", labelEn: "Administration" },
] as const;

export const menuItems: MenuItem[] = [
  // ─── Overview ───
  {
    id: "dashboard",
    label: "แดชบอร์ด",
    labelEn: "Dashboard",
    icon: "LayoutDashboard",
    path: "/dashboard",
    roles: ["system_admin", "hospital_admin", "doctor", "nurse", "integration_engineer", "patient"],
    group: "overview",
    groupLabel: "ภาพรวม",
    groupLabelEn: "Overview",
  },

  // ─── Patient Services ───
  {
    id: "wallet",
    label: "กระเป๋าสุขภาพ",
    labelEn: "Health Wallet",
    icon: "Wallet",
    path: "/wallet",
    roles: ["patient"],
    group: "patient_services",
    groupLabel: "บริการผู้ป่วย",
    groupLabelEn: "Patient Services",
  },
  {
    id: "consent",
    label: "จัดการความยินยอม",
    labelEn: "Consent Management",
    icon: "ShieldCheck",
    path: "/consent",
    roles: ["system_admin", "hospital_admin", "doctor", "nurse", "patient"],
    group: "patient_services",
    groupLabel: "บริการผู้ป่วย",
    groupLabelEn: "Patient Services",
  },
  {
    id: "shl",
    label: "ลิงก์แชร์สุขภาพ",
    labelEn: "Smart Health Links",
    icon: "Link2",
    path: "/shl",
    roles: ["system_admin", "hospital_admin", "doctor", "nurse", "patient"],
    group: "patient_services",
    groupLabel: "บริการผู้ป่วย",
    groupLabelEn: "Patient Services",
  },

  // ─── Clinical Services ───
  {
    id: "referral",
    label: "ส่งต่อผู้ป่วย",
    labelEn: "Patient Referral",
    icon: "ArrowRightLeft",
    path: "/referral",
    roles: ["system_admin", "hospital_admin", "doctor", "nurse"],
    group: "clinical",
    groupLabel: "บริการทางคลินิก",
    groupLabelEn: "Clinical Services",
  },
  {
    id: "cross-border",
    label: "ส่งต่อข้ามเครือข่าย",
    labelEn: "Cross-border Referral",
    icon: "Globe",
    path: "/cross-border",
    roles: ["system_admin", "hospital_admin", "doctor"],
    group: "clinical",
    groupLabel: "บริการทางคลินิก",
    groupLabelEn: "Clinical Services",
  },
  {
    id: "international",
    label: "ผู้ป่วยต่างชาติ",
    labelEn: "International Patients",
    icon: "Plane",
    path: "/international",
    roles: ["system_admin", "hospital_admin", "doctor", "nurse"],
    group: "clinical",
    groupLabel: "บริการทางคลินิก",
    groupLabelEn: "Clinical Services",
  },

  // ─── Digital Credentials ───
  {
    id: "issuer",
    label: "ออกใบรับรอง",
    labelEn: "Issue Credential",
    icon: "BadgeCheck",
    path: "/issuer",
    roles: ["system_admin", "hospital_admin", "doctor"],
    group: "credentials",
    groupLabel: "ใบรับรองดิจิทัล",
    groupLabelEn: "Digital Credentials",
  },
  {
    id: "verifier",
    label: "ตรวจสอบใบรับรอง",
    labelEn: "Verify Credential",
    icon: "ScanLine",
    path: "/verifier",
    roles: ["system_admin", "hospital_admin", "doctor", "nurse"],
    group: "credentials",
    groupLabel: "ใบรับรองดิจิทัล",
    groupLabelEn: "Digital Credentials",
  },
  {
    id: "trust-registry",
    label: "ทะเบียนความน่าเชื่อถือ",
    labelEn: "Trust Registry",
    icon: "ShieldAlert",
    path: "/trust-registry",
    roles: ["system_admin", "hospital_admin"],
    group: "credentials",
    groupLabel: "ใบรับรองดิจิทัล",
    groupLabelEn: "Digital Credentials",
  },

  // ─── Claims & Finance ───
  {
    id: "claim-center",
    label: "ศูนย์เคลม",
    labelEn: "Claim Center",
    icon: "Receipt",
    path: "/claim-center",
    roles: ["system_admin", "hospital_admin", "doctor", "nurse"],
    group: "claims",
    groupLabel: "เคลมและการเงิน",
    groupLabelEn: "Claims & Finance",
  },

  // ─── Interoperability ───
  {
    id: "integration",
    label: "เชื่อมต่อระบบ HIS",
    labelEn: "HIS Integration",
    icon: "Plug",
    path: "/integration",
    roles: ["system_admin", "hospital_admin", "integration_engineer"],
    group: "interop",
    groupLabel: "เชื่อมต่อและมาตรฐาน",
    groupLabelEn: "Interoperability",
  },
  {
    id: "fhir-mapping",
    label: "แผนที่ข้อมูล FHIR",
    labelEn: "FHIR Mapping",
    icon: "GitBranch",
    path: "/fhir-mapping",
    roles: ["system_admin", "hospital_admin", "integration_engineer"],
    group: "interop",
    groupLabel: "เชื่อมต่อและมาตรฐาน",
    groupLabelEn: "Interoperability",
  },
  {
    id: "terminology",
    label: "จับคู่รหัสมาตรฐาน",
    labelEn: "Terminology Mapping",
    icon: "BookOpen",
    path: "/terminology",
    roles: ["system_admin", "hospital_admin", "integration_engineer"],
    group: "interop",
    groupLabel: "เชื่อมต่อและมาตรฐาน",
    groupLabelEn: "Interoperability",
  },

  // ─── Administration ───
  {
    id: "hospitals",
    label: "จัดการเครือข่าย",
    labelEn: "Network Management",
    icon: "Building2",
    path: "/hospitals",
    roles: ["system_admin", "hospital_admin"],
    group: "admin",
    groupLabel: "บริหารระบบ",
    groupLabelEn: "Administration",
  },
  {
    id: "audit",
    label: "บันทึกการเข้าถึง",
    labelEn: "Audit Trail",
    icon: "FileSearch",
    path: "/audit",
    roles: ["system_admin", "hospital_admin"],
    group: "admin",
    groupLabel: "บริหารระบบ",
    groupLabelEn: "Administration",
  },
  {
    id: "users",
    label: "จัดการผู้ใช้",
    labelEn: "User Management",
    icon: "Users",
    path: "/users",
    roles: ["system_admin", "hospital_admin"],
    group: "admin",
    groupLabel: "บริหารระบบ",
    groupLabelEn: "Administration",
  },
  {
    id: "settings",
    label: "ตั้งค่าระบบ",
    labelEn: "Settings",
    icon: "Settings",
    path: "/settings",
    roles: ["system_admin", "hospital_admin"],
    group: "admin",
    groupLabel: "บริหารระบบ",
    groupLabelEn: "Administration",
  },
];

export function getMenuForRole(role: SystemRole): MenuItem[] {
  return menuItems.filter(item => item.roles.includes(role));
}

export function getGroupedMenu(role: SystemRole) {
  const items = getMenuForRole(role);
  const grouped: Record<string, MenuItem[]> = {};
  for (const item of items) {
    if (!grouped[item.group]) grouped[item.group] = [];
    grouped[item.group].push(item);
  }
  return menuGroups
    .filter(g => grouped[g.id]?.length)
    .map(g => ({ ...g, items: grouped[g.id]! }));
}
