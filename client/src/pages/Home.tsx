import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import {
  Shield, Building2, Stethoscope, Heart as HeartPulse,
  Settings2, User, Loader2, Database, ChevronRight,
  Heart,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const ROLE_CONFIG: Record<string, { label: string; labelTh: string; icon: React.ElementType; color: string; bgColor: string; description: string }> = {
  system_admin: { label: "System Admin", labelTh: "ผู้ดูแลระบบ", icon: Shield, color: "text-red-600", bgColor: "bg-red-50 border-red-200 hover:border-red-400", description: "เข้าถึงทุกฟังก์ชัน จัดการโรงพยาบาล ผู้ใช้ และระบบทั้งหมด" },
  hospital_admin: { label: "Hospital Admin", labelTh: "ผู้ดูแลโรงพยาบาล", icon: Building2, color: "text-blue-600", bgColor: "bg-blue-50 border-blue-200 hover:border-blue-400", description: "บริหารจัดการโรงพยาบาล ออก VC และดูรายงาน" },
  doctor: { label: "Doctor", labelTh: "แพทย์", icon: Stethoscope, color: "text-green-600", bgColor: "bg-green-50 border-green-200 hover:border-green-400", description: "ออกใบรับรองแพทย์ ส่งต่อผู้ป่วย ดูข้อมูลคลินิก" },
  nurse: { label: "Nurse", labelTh: "พยาบาล", icon: HeartPulse, color: "text-pink-600", bgColor: "bg-pink-50 border-pink-200 hover:border-pink-400", description: "ดูข้อมูลผู้ป่วย จัดการส่งต่อ ออก VC พื้นฐาน" },
  integration_engineer: { label: "Integration Engineer", labelTh: "วิศวกรระบบ", icon: Settings2, color: "text-purple-600", bgColor: "bg-purple-50 border-purple-200 hover:border-purple-400", description: "จัดการ FHIR Mapping, Adapter และระบบเชื่อมต่อ" },
  patient: { label: "Patient", labelTh: "ผู้ป่วย", icon: User, color: "text-amber-600", bgColor: "bg-amber-50 border-amber-200 hover:border-amber-400", description: "ดูกระเป๋าสุขภาพ แสดง QR VC และจัดการความยินยอม" },
};

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
      // Store token in sessionStorage as fallback when cookies are stripped by proxy
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

  // Order of roles to display
  const roleOrder = ["system_admin", "hospital_admin", "doctor", "nurse", "integration_engineer", "patient"];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/3">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Heart className="h-5 w-5 text-primary" />
            </div>
            <span className="font-semibold text-lg tracking-tight">Trustcare Hospital Network</span>
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

      {/* Hero */}
      <section className="container py-12 md:py-16">
        <div className="max-w-3xl mx-auto text-center space-y-4">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Demo Login
            <span className="text-primary ml-2">Trustcare Hospital VC</span>
          </h1>
          <p className="text-muted-foreground">
            เลือก Role ที่ต้องการทดสอบ — แต่ละ Role จะเห็นเมนูและฟังก์ชันที่แตกต่างกัน
          </p>
        </div>
      </section>

      {/* Demo Users Grid */}
      <section className="container pb-16">
        {users.length === 0 ? (
          <div className="text-center py-16">
            <Database className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium mb-2">ยังไม่มี Demo Users</h3>
            <p className="text-muted-foreground mb-6">กดปุ่ม "Seed Demo Data" ด้านบนเพื่อสร้างข้อมูลทดสอบ</p>
            <Button onClick={handleSeed} disabled={seedMutation.isPending}>
              <Database className="h-4 w-4 mr-2" />
              {seedMutation.isPending ? "กำลัง Seed..." : "Seed Demo Data"}
            </Button>
          </div>
        ) : (
          <div className="space-y-8">
            {roleOrder.map(role => {
              const roleUsers = groupedUsers[role];
              if (!roleUsers || roleUsers.length === 0) return null;
              const config = ROLE_CONFIG[role];
              if (!config) return null;
              const Icon = config.icon;
              return (
                <div key={role}>
                  <div className="flex items-center gap-2 mb-3">
                    <Icon className={`h-5 w-5 ${config.color}`} />
                    <h2 className="font-semibold text-lg">{config.labelTh}</h2>
                    <span className="text-xs text-muted-foreground">({config.label})</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{config.description}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {roleUsers.map((u: any) => (
                      <Card
                        key={u.openId}
                        className={`border-2 transition-all duration-200 ${config.bgColor} hover:shadow-lg group`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <div className={`h-10 w-10 rounded-full flex items-center justify-center bg-white/80 shadow-sm`}>
                              <Icon className={`h-5 w-5 ${config.color}`} />
                            </div>
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
      </section>

      {/* Footer */}
      <footer className="border-t py-6">
        <div className="container text-center text-sm text-muted-foreground">
          <p>&copy; 2024 Trustcare Hospital Network — Demo Environment</p>
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
