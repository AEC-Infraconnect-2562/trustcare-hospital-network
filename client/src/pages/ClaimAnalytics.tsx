import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { BarChart3, TrendingUp, Clock, XCircle, CheckCircle2, DollarSign, PieChart } from "lucide-react";

const statusColors: Record<string, string> = {
  draft: "bg-gray-200",
  validating: "bg-blue-200",
  correction_required: "bg-orange-200",
  ready_to_submit: "bg-emerald-200",
  submitted: "bg-indigo-200",
  accepted: "bg-green-300",
  rejected: "bg-red-200",
  more_info_requested: "bg-yellow-200",
  appeal: "bg-purple-200",
  paid: "bg-green-400",
  closed: "bg-gray-300",
};

const statusLabels: Record<string, string> = {
  draft: "ร่าง",
  validating: "กำลังตรวจสอบ",
  correction_required: "ต้องแก้ไข",
  ready_to_submit: "พร้อมส่ง",
  submitted: "ส่งแล้ว",
  accepted: "อนุมัติ",
  rejected: "ปฏิเสธ",
  more_info_requested: "ขอข้อมูลเพิ่ม",
  appeal: "อุทธรณ์",
  paid: "จ่ายแล้ว",
  closed: "ปิดเคส",
};

const typeLabels: Record<string, string> = {
  opd: "ผู้ป่วยนอก (OPD)",
  ipd: "ผู้ป่วยใน (IPD)",
  dental: "ทันตกรรม",
  pharmacy: "เภสัชกรรม",
  rehabilitation: "เวชศาสตร์ฟื้นฟู",
  emergency: "ฉุกเฉิน",
};

export default function ClaimAnalytics() {
  const { data: analytics, isLoading, error, refetch } = trpc.claim.analytics.useQuery();

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="h-8 w-64 bg-muted animate-pulse rounded" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />)}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <BarChart3 className="h-7 w-7 text-primary" />
              Claim Analytics Dashboard
            </h1>
          </div>
          <Card className="border-red-200 bg-red-50/50">
            <CardContent className="p-6 text-center">
              <XCircle className="h-10 w-10 text-red-500 mx-auto mb-3" />
              <p className="font-medium text-red-900">ไม่สามารถโหลดข้อมูลวิเคราะห์ได้</p>
              <p className="text-sm text-red-700 mt-1">{error.message}</p>
              <button onClick={() => refetch()} className="mt-4 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-800 rounded-md text-sm font-medium transition-colors">
                ลองใหม่อีกครั้ง
              </button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const data = analytics || { totalClaims: 0, approvalRate: 0, avgProcessingDays: 0, statusBreakdown: [], typeBreakdown: [], rejectionReasons: [], monthlyTrend: [] };
  const maxMonthlyValue = Math.max(...(data.monthlyTrend?.map(m => Math.max(m.submitted, m.accepted, m.rejected, m.paid)) || [1]), 1);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-primary" />
            Claim Analytics Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">วิเคราะห์อัตราอนุมัติ ระยะเวลาดำเนินการ และเหตุผลการปฏิเสธ</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50"><PieChart className="h-5 w-5 text-blue-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">เคลมทั้งหมด</p>
                <p className="text-2xl font-bold">{data.totalClaims}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-50"><CheckCircle2 className="h-5 w-5 text-green-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">อัตราอนุมัติ</p>
                <p className="text-2xl font-bold">{data.approvalRate}%</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-50"><Clock className="h-5 w-5 text-amber-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">เวลาเฉลี่ย</p>
                <p className="text-2xl font-bold">{data.avgProcessingDays} <span className="text-sm font-normal">วัน</span></p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-50"><XCircle className="h-5 w-5 text-red-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">ปฏิเสธ</p>
                <p className="text-2xl font-bold">{data.statusBreakdown?.find(s => s.status === "rejected")?.count || 0}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Status Breakdown */}
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><PieChart className="h-4 w-4" />สถานะเคลม</CardTitle></CardHeader>
            <CardContent>
              {data.statusBreakdown && data.statusBreakdown.length > 0 ? (
                <div className="space-y-3">
                  {data.statusBreakdown.map((item: any) => {
                    const pct = data.totalClaims > 0 ? Math.round((item.count / data.totalClaims) * 100) : 0;
                    return (
                      <div key={item.status} className="flex items-center gap-3">
                        <div className="w-32 text-sm truncate">{statusLabels[item.status] || item.status}</div>
                        <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-500 ${statusColors[item.status] || "bg-gray-200"}`} style={{ width: `${pct}%` }} />
                        </div>
                        <div className="w-16 text-right text-sm font-medium">{item.count} ({pct}%)</div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">ยังไม่มีข้อมูล</p>
              )}
            </CardContent>
          </Card>

          {/* Type Breakdown */}
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><DollarSign className="h-4 w-4" />ประเภทเคลม</CardTitle></CardHeader>
            <CardContent>
              {data.typeBreakdown && data.typeBreakdown.length > 0 ? (
                <div className="space-y-3">
                  {data.typeBreakdown.map((item: any) => {
                    const pct = data.totalClaims > 0 ? Math.round((item.count / data.totalClaims) * 100) : 0;
                    return (
                      <div key={item.type} className="flex items-center gap-3">
                        <div className="w-40 text-sm truncate">{typeLabels[item.type] || item.type}</div>
                        <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-primary/60 transition-all duration-500" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="w-16 text-right text-sm font-medium">{item.count}</div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">ยังไม่มีข้อมูล</p>
              )}
            </CardContent>
          </Card>

          {/* Monthly Trend */}
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" />แนวโน้มรายเดือน</CardTitle></CardHeader>
            <CardContent>
              {data.monthlyTrend && data.monthlyTrend.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-indigo-400" />ส่ง</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-400" />อนุมัติ</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-400" />ปฏิเสธ</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-500" />จ่ายแล้ว</span>
                  </div>
                  {data.monthlyTrend.map((m: any) => (
                    <div key={m.month} className="flex items-center gap-2">
                      <div className="w-16 text-xs text-muted-foreground font-mono">{m.month}</div>
                      <div className="flex-1 flex gap-1 h-5">
                        <div className="bg-indigo-400 rounded-sm transition-all" style={{ width: `${(m.submitted / maxMonthlyValue) * 100}%` }} title={`ส่ง: ${m.submitted}`} />
                        <div className="bg-green-400 rounded-sm transition-all" style={{ width: `${(m.accepted / maxMonthlyValue) * 100}%` }} title={`อนุมัติ: ${m.accepted}`} />
                        <div className="bg-red-400 rounded-sm transition-all" style={{ width: `${(m.rejected / maxMonthlyValue) * 100}%` }} title={`ปฏิเสธ: ${m.rejected}`} />
                        <div className="bg-emerald-500 rounded-sm transition-all" style={{ width: `${(m.paid / maxMonthlyValue) * 100}%` }} title={`จ่ายแล้ว: ${m.paid}`} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">ยังไม่มีข้อมูลรายเดือน</p>
              )}
            </CardContent>
          </Card>

          {/* Top Rejection Reasons */}
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><XCircle className="h-4 w-4" />เหตุผลการปฏิเสธ (Top 10)</CardTitle></CardHeader>
            <CardContent>
              {data.rejectionReasons && data.rejectionReasons.length > 0 ? (
                <div className="space-y-2">
                  {data.rejectionReasons.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                      <span className="text-sm flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] px-1.5">{idx + 1}</Badge>
                        {item.reason}
                      </span>
                      <Badge variant="destructive" className="text-xs">{item.count}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">ยังไม่มีข้อมูลการปฏิเสธ</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
