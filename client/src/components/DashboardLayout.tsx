import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
// getLoginUrl removed - DashboardLayout now redirects to / for unauthenticated users
import { useIsMobile } from "@/hooks/useMobile";
import { useTheme } from "@/contexts/ThemeContext";
import {
  LayoutDashboard, LogOut, PanelLeft, Wallet, ArrowRightLeft, ShieldCheck,
  BadgeCheck, ScanLine, GitBranch, BookOpen, Building2, FileSearch, Users,
  Settings, Moon, Sun, Bell, Globe, Plane, Receipt, Plug, ShieldAlert, Link2,
  FileJson2, Code2,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import { Badge } from "./ui/badge";
import { normalizeActiveRole, sanitizeAdditionalRolesForSystemRole } from "@shared/rolePolicy";
import { useLanguage } from "@/contexts/LanguageContext";

// Icon map
const iconMap: Record<string, any> = {
  LayoutDashboard, Wallet, ArrowRightLeft, ShieldCheck, BadgeCheck, ScanLine,
  GitBranch, BookOpen, Building2, FileSearch, Users, Settings, Globe, Plane,
  Receipt, Plug, ShieldAlert, Link2, FileJson2, Code2,
};

type SystemRole = "system_admin" | "hospital_admin" | "maker" | "checker" | "doctor" | "nurse" | "integration_engineer" | "patient";

interface MenuItemDef {
  id: string;
  label: string;
  icon: string;
  path: string;
  roles: SystemRole[];
  group: string;
  groupLabel: string;
}

const menuGroups = [
  { id: "overview", label: "ภาพรวม" },
  { id: "patient_services", label: "บริการผู้ป่วย" },
  { id: "clinical", label: "บริการทางคลินิก" },
  { id: "credentials", label: "ใบรับรองดิจิทัล" },
  { id: "claims", label: "เคลมและการเงิน" },
  { id: "interop", label: "เชื่อมต่อและมาตรฐาน" },
  { id: "admin", label: "บริหารระบบ" },
];

// English translations for menu groups and items
const menuGroupsEn: Record<string, string> = {
  overview: "Overview",
  patient_services: "Patient Services",
  clinical: "Clinical Services",
  credentials: "Digital Credentials",
  claims: "Claims & Finance",
  interop: "Interoperability",
  admin: "Administration",
};

const menuItemsEn: Record<string, string> = {
  dashboard: "Dashboard",
  executive: "Executive Dashboard",
  wallet: "Health Wallet",
  consent: "Consent Management",
  shl: "Smart Health Links",
  referral: "Patient Referral",
  "cross-border": "Cross-border Referral",
  international: "International Patients",
  issuer: "Issue Credentials",
  verifier: "Verify Credentials",
  "trust-registry": "Trust Registry",
  "claim-center": "Claim Center",
  integration: "HIS Integration",
  portability: "Portability Layer",
  "fhir-mapping": "FHIR Mapping",
  terminology: "Terminology Mapping",
  "adapter-sdk": "Adapter SDK",
  "patient-identity": "Patient Identity (MPI)",
  hospitals: "Network Management",
  "partner-wizard": "Partner Onboarding",
  audit: "Audit Trail",
  users: "User Management",
  settings: "Settings",
};

const allMenuItems: MenuItemDef[] = [
  // Overview
  { id: "dashboard", label: "แดชบอร์ด", icon: "LayoutDashboard", path: "/dashboard", roles: ["system_admin", "hospital_admin", "maker", "checker", "doctor", "nurse", "integration_engineer", "patient"], group: "overview", groupLabel: "ภาพรวม" },
  { id: "executive", label: "แดชบอร์ดผู้บริหาร", icon: "BarChart3", path: "/executive", roles: ["system_admin", "hospital_admin"], group: "overview", groupLabel: "ภาพรวม" },
  // Patient Services
  { id: "wallet", label: "กระเป๋าสุขภาพ", icon: "Wallet", path: "/wallet", roles: ["system_admin", "hospital_admin", "doctor", "nurse", "integration_engineer", "patient", "maker", "checker"], group: "patient_services", groupLabel: "บริการผู้ป่วย" },
  { id: "consent", label: "จัดการความยินยอม", icon: "ShieldCheck", path: "/consent", roles: ["system_admin", "hospital_admin", "doctor", "nurse", "patient"], group: "patient_services", groupLabel: "บริการผู้ป่วย" },
  { id: "shl", label: "ลิงก์แชร์สุขภาพ", icon: "Link2", path: "/shl", roles: ["system_admin", "hospital_admin", "maker", "checker", "doctor", "nurse", "integration_engineer", "patient"], group: "patient_services", groupLabel: "บริการผู้ป่วย" },
  // Clinical Services
  { id: "referral", label: "ส่งต่อผู้ป่วย", icon: "ArrowRightLeft", path: "/referral", roles: ["system_admin", "hospital_admin", "doctor", "nurse"], group: "clinical", groupLabel: "บริการทางคลินิก" },
  { id: "cross-border", label: "ส่งต่อข้ามเครือข่าย", icon: "Globe", path: "/cross-border", roles: ["system_admin", "hospital_admin", "doctor"], group: "clinical", groupLabel: "บริการทางคลินิก" },
  { id: "international", label: "ผู้ป่วยต่างชาติ", icon: "Plane", path: "/international", roles: ["system_admin", "hospital_admin", "doctor", "nurse"], group: "clinical", groupLabel: "บริการทางคลินิก" },
  // Digital Credentials
  { id: "issuer", label: "ออกใบรับรอง", icon: "BadgeCheck", path: "/issuer", roles: ["system_admin", "hospital_admin", "maker", "checker", "doctor"], group: "credentials", groupLabel: "ใบรับรองดิจิทัล" },
  { id: "verifier", label: "ตรวจสอบใบรับรอง", icon: "ScanLine", path: "/verifier", roles: ["system_admin", "hospital_admin", "checker", "doctor", "nurse"], group: "credentials", groupLabel: "ใบรับรองดิจิทัล" },
  { id: "trust-registry", label: "ทะเบียนความน่าเชื่อถือ", icon: "ShieldAlert", path: "/trust-registry", roles: ["system_admin", "hospital_admin"], group: "credentials", groupLabel: "ใบรับรองดิจิทัล" },
  // Claims & Finance
  { id: "claim-center", label: "ศูนย์เคลม", icon: "Receipt", path: "/claim-center", roles: ["system_admin", "hospital_admin", "doctor", "nurse"], group: "claims", groupLabel: "เคลมและการเงิน" },
  // Interoperability
  { id: "integration", label: "เชื่อมต่อระบบ HIS", icon: "Plug", path: "/integration", roles: ["system_admin", "hospital_admin", "integration_engineer"], group: "interop", groupLabel: "เชื่อมต่อและมาตรฐาน" },
  { id: "portability", label: "Portability Layer", icon: "FileJson2", path: "/portability", roles: ["system_admin", "hospital_admin", "maker", "checker", "doctor", "integration_engineer"], group: "interop", groupLabel: "เชื่อมต่อและมาตรฐาน" },
  { id: "fhir-mapping", label: "แผนที่ข้อมูล FHIR", icon: "GitBranch", path: "/fhir-mapping", roles: ["system_admin", "hospital_admin", "integration_engineer"], group: "interop", groupLabel: "เชื่อมต่อและมาตรฐาน" },
  { id: "terminology", label: "จับคู่รหัสมาตรฐาน", icon: "BookOpen", path: "/terminology", roles: ["system_admin", "hospital_admin", "integration_engineer"], group: "interop", groupLabel: "เชื่อมต่อและมาตรฐาน" },
  { id: "adapter-sdk", label: "Adapter SDK", icon: "Code2", path: "/adapter-sdk", roles: ["system_admin", "hospital_admin", "integration_engineer"], group: "interop", groupLabel: "เชื่อมต่อและมาตรฐาน" },
  // Administration
  { id: "patient-identity", label: "เชื่อมโยงตัวตน (MPI)", icon: "Fingerprint", path: "/patient-identity", roles: ["system_admin", "hospital_admin", "integration_engineer"], group: "admin", groupLabel: "บริหารระบบ" },
  { id: "hospitals", label: "จัดการเครือข่าย", icon: "Building2", path: "/hospitals", roles: ["system_admin", "hospital_admin"], group: "admin", groupLabel: "บริหารระบบ" },
  { id: "partner-wizard", label: "เพิ่มพันธมิตรต่างประเทศ", icon: "Globe", path: "/partner-wizard", roles: ["system_admin", "hospital_admin"], group: "admin", groupLabel: "บริหารระบบ" },
  { id: "audit", label: "บันทึกการเข้าถึง", icon: "FileSearch", path: "/audit", roles: ["system_admin", "hospital_admin"], group: "admin", groupLabel: "บริหารระบบ" },
  { id: "users", label: "จัดการผู้ใช้", icon: "Users", path: "/users", roles: ["system_admin", "hospital_admin"], group: "admin", groupLabel: "บริหารระบบ" },
  { id: "settings", label: "ตั้งค่าระบบ", icon: "Settings", path: "/settings", roles: ["system_admin", "hospital_admin"], group: "admin", groupLabel: "บริหารระบบ" },
];

function getMenuForRole(role: SystemRole) {
  return allMenuItems.filter(item => item.roles.includes(role));
}

function getGroupedMenu(role: SystemRole) {
  const items = getMenuForRole(role);
  const grouped: Record<string, MenuItemDef[]> = {};
  for (const item of items) {
    if (!grouped[item.group]) grouped[item.group] = [];
    grouped[item.group].push(item);
  }
  return menuGroups.filter(g => grouped[g.id]?.length).map(g => ({ ...g, items: grouped[g.id]! }));
}

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) return <DashboardLayoutSkeleton />;

  if (!user) {
    // Redirect to landing page which has demo users + system info
    window.location.href = "/";
    return <DashboardLayoutSkeleton />;
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}>
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

function DashboardLayoutContent({ children, setSidebarWidth }: { children: React.ReactNode; setSidebarWidth: (w: number) => void }) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const { theme, toggleTheme } = useTheme();

  // Default to system_admin for admin users, patient for others
  const systemRole: SystemRole = (user as any)?.systemRole || (user?.role === "admin" ? "system_admin" : "patient");
  const additionalRoles = sanitizeAdditionalRolesForSystemRole(systemRole, (user as any)?.additionalRoles ?? []);
  const activeRole = normalizeActiveRole(systemRole, (user as any)?.activeRole ?? systemRole, additionalRoles) as SystemRole;
  const grouped = getGroupedMenu(activeRole);
  const activeItem = allMenuItems.find(item => item.path === location);
  const { lang } = useLanguage();

  // Helper to get translated label
  const getItemLabel = (item: MenuItemDef) => lang === "en" ? (menuItemsEn[item.id] || item.label) : item.label;
  const getGroupLabel = (groupId: string, thLabel: string) => lang === "en" ? (menuGroupsEn[groupId] || thLabel) : thLabel;

  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r-0" disableTransition={isResizing}>
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed && (
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="font-semibold tracking-tight truncate text-sm">
                    Trustcare
                  </span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    Network
                  </Badge>
                  <div className="ml-auto">
                    <LanguageSwitcher />
                  </div>
                </div>
              )}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 overflow-y-auto">
            {grouped.map((group, gi) => (
              <div key={group.id} className="px-2 py-1">
                {!isCollapsed && (
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-3 py-2">
                    {getGroupLabel(group.id, group.label)}
                  </p>
                )}
                {isCollapsed && gi > 0 && <Separator className="my-1" />}
                <SidebarMenu>
                  {group.items.map(item => {
                    const isActive = location === item.path;
                    const Icon = iconMap[item.icon] || LayoutDashboard;
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => setLocation(item.path)}
                          tooltip={getItemLabel(item)}
                          className="h-9 transition-all font-normal"
                        >
                          <Icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                          <span className="text-sm">{getItemLabel(item)}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </div>
            ))}
          </SidebarContent>

          <SidebarFooter className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none">
                  <Avatar className="h-9 w-9 border shrink-0">
                    {(user as any)?.avatarUrl && <AvatarImage src={(user as any).avatarUrl} alt={user?.name || "User"} />}
                    <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
                      {user?.name?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">{user?.name || "-"}</p>
                    <p className="text-[11px] text-muted-foreground truncate mt-1">
                      {getRoleLabel(activeRole)}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem asChild className="cursor-pointer p-0">
                  <div className="flex items-center px-2 py-1.5">
                    <Globe className="mr-2 h-4 w-4" />
                    <LanguageSwitcher />
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={toggleTheme} className="cursor-pointer">
                  {theme === "dark" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                  <span>{theme === "dark" ? "โหมดสว่าง" : "โหมดมืด"}</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>ออกจากระบบ</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => { if (!isCollapsed) setIsResizing(true); }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-3 backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg" />
              <span className="text-sm font-medium">{activeItem ? getItemLabel(activeItem) : (lang === "en" ? "Menu" : "เมนู")}</span>
            </div>
            <div className="flex items-center gap-1">
              <LanguageSwitcher />
              <button onClick={toggleTheme} className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-accent">
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            </div>
          </div>
        )}
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </>
  );
}

function getRoleLabel(role: SystemRole): string {
  const map: Record<SystemRole, string> = {
    system_admin: "ผู้ดูแลระบบ",
    hospital_admin: "ผู้ดูแลโรงพยาบาล",
    maker: "Maker",
    checker: "Checker",
    doctor: "แพทย์",
    nurse: "พยาบาล",
    integration_engineer: "วิศวกรระบบ",
    patient: "ผู้ป่วย",
  };
  return map[role] || role;
}
