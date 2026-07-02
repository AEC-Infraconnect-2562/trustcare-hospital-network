import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Building2, BadgeCheck, Users, ArrowRightLeft, Activity, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = trpc.dashboard.stats.useQuery();
  const { data: activity, isLoading: actLoading } = trpc.dashboard.recentActivity.useQuery();
  const { lang } = useLanguage();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{lang === "en" ? "Dashboard" : "แดชบอร์ด"}</h1>
          <p className="text-muted-foreground text-sm mt-1">{lang === "en" ? "Trustcare Hospital Network Overview" : "ภาพรวมเครือข่ายโรงพยาบาล Trustcare"}</p>
        </div>

        {/* Recent Activity - primary content at top */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              {lang === "en" ? "Recent Activity" : "กิจกรรมล่าสุด"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {actLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : activity && activity.length > 0 ? (
              <div className="space-y-2">
                {activity.map((event: any) => (
                  <div key={event.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Activity className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{getActionLabel(event.action, lang)}</p>
                        <p className="text-xs text-muted-foreground">
                          {event.resourceType} {event.resourceId ? `#${event.resourceId.slice(0, 8)}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {event.isBreakGlass && <Badge variant="destructive" className="text-[10px]">{lang === "en" ? "Emergency" : "ฉุกเฉิน"}</Badge>}
                      <span className="text-xs text-muted-foreground">
                        {new Date(event.createdAt).toLocaleString(lang === "en" ? "en-US" : "th-TH", { dateStyle: "short", timeStyle: "short" })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">{lang === "en" ? "No activity yet" : "ยังไม่มีกิจกรรม"}</p>
            )}
          </CardContent>
        </Card>

        {/* Statistics Summary - moved to bottom */}
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            {lang === "en" ? "Network Statistics" : "สถิติเครือข่าย"}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Building2} label={lang === "en" ? "Network Hospitals" : "โรงพยาบาลในเครือ"} value={stats?.hospitals} loading={statsLoading} color="text-blue-600" />
            <StatCard icon={BadgeCheck} label={lang === "en" ? "Issued Credentials" : "ใบรับรองที่ออก"} value={stats?.credentials} loading={statsLoading} color="text-emerald-600" />
            <StatCard icon={Users} label={lang === "en" ? "Registered Patients" : "ผู้ป่วยในระบบ"} value={stats?.patients} loading={statsLoading} color="text-violet-600" />
            <StatCard icon={ArrowRightLeft} label={lang === "en" ? "Referrals" : "การส่งต่อ"} value={stats?.referrals} loading={statsLoading} color="text-amber-600" />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function StatCard({ icon: Icon, label, value, loading, color }: { icon: any; label: string; value?: number; loading: boolean; color: string }) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            {loading ? (
              <Skeleton className="h-8 w-16 mt-1" />
            ) : (
              <p className="text-2xl font-semibold mt-1">{value?.toLocaleString() ?? 0}</p>
            )}
          </div>
          <div className={`h-10 w-10 rounded-lg bg-muted flex items-center justify-center ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function getActionLabel(action: string, lang: string): string {
  const mapTh: Record<string, string> = {
    "hospital.created": "เพิ่มโรงพยาบาลใหม่",
    "credential.issued": "ออกใบรับรอง",
    "credential.revoked": "เพิกถอนใบรับรอง",
    "consent.granted": "ให้ความยินยอม",
    "consent.revoked": "ถอนความยินยอม",
    "referral.created": "สร้างใบส่งต่อ",
    "referral.accepted": "รับใบส่งต่อ",
    "referral.completed": "ส่งต่อเสร็จสิ้น",
    "referral.rejected": "ปฏิเสธใบส่งต่อ",
  };
  const mapEn: Record<string, string> = {
    "hospital.created": "New hospital added",
    "credential.issued": "Credential issued",
    "credential.revoked": "Credential revoked",
    "consent.granted": "Consent granted",
    "consent.revoked": "Consent revoked",
    "referral.created": "Referral created",
    "referral.accepted": "Referral accepted",
    "referral.completed": "Referral completed",
    "referral.rejected": "Referral rejected",
  };
  const map = lang === "en" ? mapEn : mapTh;
  return map[action] || action;
}
