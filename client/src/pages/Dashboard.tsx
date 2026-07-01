import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Building2, BadgeCheck, Users, ArrowRightLeft, Activity, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = trpc.dashboard.stats.useQuery();
  const { data: activity, isLoading: actLoading } = trpc.dashboard.recentActivity.useQuery();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">แดชบอร์ด</h1>
          <p className="text-muted-foreground text-sm mt-1">ภาพรวมเครือข่ายโรงพยาบาล Trustcare</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Building2} label="โรงพยาบาลในเครือ" value={stats?.hospitals} loading={statsLoading} color="text-blue-600" />
          <StatCard icon={BadgeCheck} label="ใบรับรองที่ออก" value={stats?.credentials} loading={statsLoading} color="text-emerald-600" />
          <StatCard icon={Users} label="ผู้ป่วยในระบบ" value={stats?.patients} loading={statsLoading} color="text-violet-600" />
          <StatCard icon={ArrowRightLeft} label="การส่งต่อ" value={stats?.referrals} loading={statsLoading} color="text-amber-600" />
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              กิจกรรมล่าสุด
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
                        <p className="text-sm font-medium">{getActionLabel(event.action)}</p>
                        <p className="text-xs text-muted-foreground">
                          {event.resourceType} {event.resourceId ? `#${event.resourceId.slice(0, 8)}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {event.isBreakGlass && <Badge variant="destructive" className="text-[10px]">ฉุกเฉิน</Badge>}
                      <span className="text-xs text-muted-foreground">
                        {new Date(event.createdAt).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">ยังไม่มีกิจกรรม</p>
            )}
          </CardContent>
        </Card>
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

function getActionLabel(action: string): string {
  const map: Record<string, string> = {
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
  return map[action] || action;
}
