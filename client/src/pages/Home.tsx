import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import {
  Shield, Building2, Stethoscope, Heart as HeartPulse,
  Settings2, User, Loader2, Database, ChevronRight,
  Heart, FileCheck2, QrCode, Globe2, Lock, Fingerprint,
  ArrowRightLeft, Microscope, Pill, Syringe, BadgeCheck,
  FolderCheck, RefreshCcw,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const ROLE_CONFIG: Record<string, { label: string; labelTh: string; icon: React.ElementType; color: string; bgColor: string; description: string }> = {
  system_admin: { label: "System Admin", labelTh: "ผู้ดูแลระบบ", icon: Shield, color: "text-red-600", bgColor: "bg-red-50 border-red-200 hover:border-red-400", description: "เข้าถึงทุกฟังก์ชัน จัดการโรงพยาบาล ผู้ใช้ และระบบทั้งหมด" },
  hospital_admin: { label: "Hospital Admin", labelTh: "ผู้ดูแลโรงพยาบาล", icon: Building2, color: "text-blue-600", bgColor: "bg-blue-50 border-blue-200 hover:border-blue-400", description: "บริหารจัดการโรงพยาบาล ออก VC และดูรายงาน" },
  maker: { label: "Maker", labelTh: "ผู้ร่าง (Maker)", icon: FileCheck2, color: "text-teal-600", bgColor: "bg-teal-50 border-teal-200 hover:border-teal-400", description: "ร่างเอกสาร VC ส่งให้ Checker อนุมัติ" },
  checker: { label: "Checker", labelTh: "ผู้อนุมัติ (Checker)", icon: BadgeCheck, color: "text-indigo-600", bgColor: "bg-indigo-50 border-indigo-200 hover:border-indigo-400", description: "ตรวจสอบและอนุมัติเอกสาร VC ที่ Maker ร่าง" },
  doctor: { label: "Doctor", labelTh: "แพทย์", icon: Stethoscope, color: "text-green-600", bgColor: "bg-green-50 border-green-200 hover:border-green-400", description: "ออกใบรับรองแพทย์ ส่งต่อผู้ป่วย ดูข้อมูลคลินิก" },
  nurse: { label: "Nurse", labelTh: "พยาบาล", icon: HeartPulse, color: "text-pink-600", bgColor: "bg-pink-50 border-pink-200 hover:border-pink-400", description: "ดูข้อมูลผู้ป่วย จัดการส่งต่อ ออก VC พื้นฐาน" },
  integration_engineer: { label: "Integration Engineer", labelTh: "วิศวกรระบบ", icon: Settings2, color: "text-purple-600", bgColor: "bg-purple-50 border-purple-200 hover:border-purple-400", description: "จัดการ FHIR Mapping, Adapter และระบบเชื่อมต่อ" },
  patient: { label: "Patient", labelTh: "ผู้ป่วย", icon: User, color: "text-amber-600", bgColor: "bg-amber-50 border-amber-200 hover:border-amber-400", description: "ดูกระเป๋าสุขภาพ แสดง QR VC และจัดการความยินยอม" },
};

const SYSTEM_FEATURES = [
  { icon: FileCheck2, title: "Verifiable Credentials", titleTh: "ใบรับรองดิจิทัล", desc: "ออก VC 24 ประเภท ตาม W3C VC Data Model 2.0" },
  { icon: Fingerprint, title: "DID:web + DID:key", titleTh: "ตัวตนดิจิทัล", desc: "โรงพยาบาลใช้ did:web, ผู้ป่วยใช้ did:key" },
  { icon: Lock, title: "Maker/Checker", titleTh: "การอนุมัติ 2 ชั้น", desc: "ระบบ Dual-control สำหรับออกเอกสาร VC" },
  { icon: QrCode, title: "QR Verification", titleTh: "ตรวจสอบด้วย QR", desc: "สแกน QR Code ตรวจสอบ VC/VP ทันที" },
  { icon: ArrowRightLeft, title: "Referral & Cross-border", titleTh: "ส่งต่อข้ามเครือข่าย", desc: "ส่งต่อผู้ป่วยพร้อม VP ข้ามโรงพยาบาล" },
  { icon: Globe2, title: "FHIR R4 Mapping", titleTh: "มาตรฐาน FHIR", desc: "แปลงข้อมูลเป็น FHIR R4 Bundle อัตโนมัติ" },
  { icon: RefreshCcw, title: "Sync-back to HIS", titleTh: "ส่งกลับ HIS", desc: "Sync VC กลับระบบ HIS ต้นทาง" },
  { icon: Microscope, title: "24 Document Types", titleTh: "24 ประเภทเอกสาร", desc: "ครอบคลุมตั้งแต่ใบรับรองแพทย์ถึง Claim Package" },
];

export default function Home() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [loggingIn, setLoggingIn] = useState(false);
  const demoUsers = trpc.auth.getDemoUsers.useQuery();
  const seedMutation = trpc.seed.run.useMutation();

  useEffect(() => {
    if (user && !loading) {
      setLocation("/dashboard");
    }
  }, [user, loading, setLocation]);

  const handleDemoLogin = async (openId: string, activeRole?: string) => {
    setLoggingIn(true);
    try {
      const res = await fetch("/api/auth/demo-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ openId, activeRole }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Login failed");
      }
      const data = await res.json();
      if (data.token) {
        sessionStorage.setItem("demo_session_token", data.token);
      }
      window.location.href = "/dashboard";
    } catch (e: any) {
      toast.error("เข้าสู่ระบบไม่สำเร็จ: " + e.message);
      setLoggingIn(false);
    }
  };

  const handleSeed = async () => {
    try {
      await seedMutation.mutateAsync();
      toast.success("Seed สำเร็จ! กรุณารอสักครู่...");
      demoUsers.refetch();
    } catch (e: any) {
      toast.error("Seed ไม่สำเร็จ: " + e.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin h-8 w-8 text-primary" />
      </div>
    );
  }

  const users = demoUsers.data || [];
  const groupedUsers: Record<string, any[]> = {};
  for (const u of users) {
    const role = (u as any).systemRole || "patient";
    if (!groupedUsers[role]) groupedUsers[role] = [];
    groupedUsers[role].push(u);
  }

  const roleOrder = ["system_admin", "hospital_admin", "doctor", "nurse", "integration_engineer", "patient"];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Heart className="h-5 w-5 text-primary" />
            </div>
            <div>
              <span className="font-semibold text-lg tracking-tight">Trustcare Hospital Network</span>
              <span className="hidden sm:inline text-xs text-muted-foreground ml-2">VC/VP Issuance Platform</span>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSeed}
            disabled={seedMutation.isPending}
          >
            <Database className="h-4 w-4 mr-2" />
            {seedMutation.isPending ? "กำลัง Seed..." : "Seed Demo Data"}
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container py-12 md:py-16">
        <div className="max-w-4xl mx-auto text-center space-y-5">
          <Badge variant="secondary" className="text-xs px-3 py-1">
            W3C Verifiable Credentials Data Model 2.0
          </Badge>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight leading-tight">
            ระบบออกใบรับรองดิจิทัล
            <span className="text-primary block mt-1">เครือโรงพยาบาล Trustcare</span>
          </h1>
          <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
            แพลตฟอร์มบริหารจัดการ Verifiable Credentials (VC) และ Verifiable Presentations (VP)
            สำหรับเครือข่ายโรงพยาบาล รองรับ 24 ประเภทเอกสาร พร้อม Maker/Checker workflow,
            DID-based trust, FHIR R4 interoperability และ QR Code verification
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container pb-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
          {SYSTEM_FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <Card key={f.title} className="border bg-white/60 hover:bg-white hover:shadow-md transition-all duration-200">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-lg bg-primary/8 flex items-center justify-center shrink-0">
                      <Icon className="h-4.5 w-4.5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{f.titleTh}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{f.desc}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Divider */}
      <div className="container">
        <div className="border-t" />
      </div>

      {/* Demo Users Section */}
      <section className="container py-12">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold tracking-tight">เข้าสู่ระบบ</h2>
            <p className="text-muted-foreground mt-2">
              เลือก Test User ตาม Role ที่ต้องการทดสอบ — แต่ละ Role จะเห็นเมนูและฟังก์ชันที่แตกต่างกัน
            </p>
          </div>

          {users.length === 0 ? (
            <div className="text-center py-16 bg-muted/30 rounded-xl border border-dashed">
              <Database className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium mb-2">ยังไม่มี Test Users</h3>
              <p className="text-muted-foreground mb-6 text-sm">กดปุ่ม "Seed Demo Data" ด้านบนเพื่อสร้างข้อมูลทดสอบ</p>
              <Button onClick={handleSeed} disabled={seedMutation.isPending}>
                <Database className="h-4 w-4 mr-2" />
                {seedMutation.isPending ? "กำลัง Seed..." : "Seed Demo Data"}
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {roleOrder.map(role => {
                const roleUsers = groupedUsers[role];
                if (!roleUsers || roleUsers.length === 0) return null;
                const config = ROLE_CONFIG[role];
                if (!config) return null;
                const Icon = config.icon;
                return (
                  <div key={role}>
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className={`h-5 w-5 ${config.color}`} />
                      <h3 className="font-semibold">{config.labelTh}</h3>
                      <Badge variant="outline" className="text-[10px] font-normal">{config.label}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">{config.description}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {roleUsers.map((u: any) => (
                        <Card
                          key={u.openId}
                          className={`border-2 transition-all duration-200 ${config.bgColor} hover:shadow-lg group`}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10 shrink-0 shadow-sm">
                                {u.avatarUrl && <AvatarImage src={u.avatarUrl} alt={u.name} />}
                                <AvatarFallback className={`${config.bgColor} ${config.color} text-sm font-medium`}>
                                  {u.name?.charAt(0) || "?"}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{u.name}</p>
                                <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                                {u.hospitalId && (
                                  <p className="text-xs text-muted-foreground/70 mt-0.5">
                                    <Building2 className="h-3 w-3 inline mr-1" />
                                    Hospital #{u.hospitalId}
                                  </p>
                                )}
                                {u.additionalRoles && u.additionalRoles.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {u.additionalRoles.map((r: string) => (
                                      <Badge key={r} variant="secondary" className="text-[10px] px-1.5 py-0">
                                        {r === "issuer_maker" ? "Maker" : r === "issuer_checker" ? "Checker" : r}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-col gap-1 shrink-0">
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="h-7 text-xs px-2"
                                  onClick={(e) => { e.stopPropagation(); !loggingIn && handleDemoLogin(u.openId); }}
                                  disabled={loggingIn}
                                >
                                  เข้าสู่ระบบ
                                  <ChevronRight className="h-3 w-3 ml-1" />
                                </Button>
                                {role !== "patient" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs px-2"
                                    onClick={(e) => { e.stopPropagation(); !loggingIn && handleDemoLogin(u.openId, "patient"); }}
                                    disabled={loggingIn}
                                  >
                                    <User className="h-3 w-3 mr-1" />
                                    เข้าเป็นผู้ป่วย
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Tech Stack Footer */}
      <footer className="border-t bg-muted/20 py-8">
        <div className="container">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center text-xs text-muted-foreground">
              <div>
                <p className="font-medium text-foreground mb-1">Standards</p>
                <p>W3C VC 2.0, DID Core, FHIR R4</p>
              </div>
              <div>
                <p className="font-medium text-foreground mb-1">Security</p>
                <p>Maker/Checker, DID:web Trust, Role Policy</p>
              </div>
              <div>
                <p className="font-medium text-foreground mb-1">Interop</p>
                <p>FHIR Bundle, SHL, Cross-border VP</p>
              </div>
              <div>
                <p className="font-medium text-foreground mb-1">Future IAM</p>
                <p>Keycloak / Third-party IdP Ready</p>
              </div>
            </div>
            <p className="text-center text-xs text-muted-foreground mt-6">
              &copy; 2024-2026 Trustcare Hospital Network — Demo Environment
            </p>
          </div>
        </div>
      </footer>

      {/* Loading overlay */}
      {loggingIn && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="animate-spin h-8 w-8 text-primary" />
            <p className="text-sm text-muted-foreground">กำลังเข้าสู่ระบบ...</p>
          </div>
        </div>
      )}
    </div>
  );
}
