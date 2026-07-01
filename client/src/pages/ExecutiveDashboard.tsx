import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import {
  TrendingUp, Users, ArrowRightLeft, Receipt, Plane, Plug,
  Activity, BarChart3, Target, AlertTriangle, ShieldCheck, CheckCircle2,
} from "lucide-react";

export default function ExecutiveDashboard() {
  const stats = trpc.dashboard.stats.useQuery();
  const recentActivity = trpc.dashboard.recentActivity.useQuery();

  const kpiCards = [
    {
      title: "อัตราการใช้งาน VC",
      value: stats.data?.credentials ?? 0,
      subtitle: "ใบรับรองที่ออกทั้งหมด",
      icon: Target,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "การส่งต่อผู้ป่วย",
      value: stats.data?.referrals ?? 0,
      subtitle: "รายการทั้งหมด",
      icon: ArrowRightLeft,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "ผู้ป่วยในระบบ",
      value: stats.data?.patients ?? 0,
      subtitle: "ผู้ป่วยที่ลงทะเบียน",
      icon: Users,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      title: "โรงพยาบาลในเครือ",
      value: stats.data?.hospitals ?? 0,
      subtitle: "แห่ง",
      icon: Activity,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <BarChart3 className="h-7 w-7 text-primary" />
          แดชบอร์ดผู้บริหาร
        </h1>
        <p className="text-muted-foreground mt-1">
          ภาพรวมประสิทธิภาพเครือข่ายโรงพยาบาล Trustcare
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi) => (
          <Card key={kpi.title} className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{kpi.title}</p>
                  <p className="text-3xl font-bold mt-1">{kpi.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{kpi.subtitle}</p>
                </div>
                <div className={`h-10 w-10 rounded-lg ${kpi.bgColor} flex items-center justify-center`}>
                  <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detailed Sections */}
      <Tabs defaultValue="adoption" className="space-y-4">
        <TabsList>
          <TabsTrigger value="adoption">การใช้งาน</TabsTrigger>
          <TabsTrigger value="referral">การส่งต่อ</TabsTrigger>
          <TabsTrigger value="claims">เคลม</TabsTrigger>
          <TabsTrigger value="tourist">ผู้ป่วยต่างชาติ</TabsTrigger>
          <TabsTrigger value="integration">เชื่อมต่อ</TabsTrigger>
        </TabsList>

        <TabsContent value="adoption">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-blue-500" />
                  อัตราการ Onboard ผู้ป่วย
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">ผู้ป่วยที่มี Wallet</span>
                    <Badge variant="secondary">{stats.data?.patients ?? 0} คน</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">VC ที่ออกทั้งหมด</span>
                    <Badge variant="secondary">{stats.data?.credentials ?? 0} ใบ</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">โรงพยาบาลที่เชื่อมต่อ</span>
                    <Badge variant="secondary">{stats.data?.hospitals ?? 0} แห่ง</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  กิจกรรมล่าสุด
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {recentActivity.data && recentActivity.data.length > 0 ? (
                    recentActivity.data.slice(0, 5).map((event: any) => (
                      <div key={event.id} className="flex justify-between items-center text-sm">
                        <span className="truncate max-w-[200px]">{event.action}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(event.createdAt).toLocaleDateString("th-TH")}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">ยังไม่มีกิจกรรม</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="referral">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ArrowRightLeft className="h-4 w-4" />
                  การส่งต่อทั้งหมด
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{stats.data?.referrals ?? 0}</p>
                <p className="text-xs text-muted-foreground">รายการ (ภายในเครือ + ข้ามเครือข่าย)</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  โรงพยาบาลในเครือ
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{stats.data?.hospitals ?? 0}</p>
                <p className="text-xs text-muted-foreground">สาขาที่รองรับการส่งต่อ</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  VC ที่ใช้ในการส่งต่อ
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{stats.data?.credentials ?? 0}</p>
                <p className="text-xs text-muted-foreground">Referral VC + Patient Summary</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="claims">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Receipt className="h-4 w-4" />
                  สถิติเคลม
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm">เคลมทั้งหมด</span>
                    <Badge variant="secondary">{stats.data?.claims ?? 0} รายการ</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">VC ที่ใช้เป็นหลักฐาน</span>
                    <Badge className="bg-green-100 text-green-700">{stats.data?.credentials ?? 0}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">VC-backed Claims</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    ระบบ E-Claim ใช้ Verifiable Credential เป็นหลักฐานประกอบการเคลม
                    ช่วยลดเวลาการตรวจสอบและเพิ่มความน่าเชื่อถือ
                  </p>
                  <div className="flex justify-between">
                    <span className="text-sm">Adapter เชื่อมต่อ Payer</span>
                    <Badge variant="secondary">{stats.data?.adapters ?? 0}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tourist">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Plane className="h-4 w-4" />
                  ผู้ป่วยต่างชาติ
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm">เคสทั้งหมด</span>
                    <Badge variant="secondary">{stats.data?.tourists ?? 0} เคส</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">VC ที่ออกให้ผู้ป่วยต่างชาติ</span>
                    <Badge className="bg-blue-100 text-blue-700">{stats.data?.credentials ?? 0}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cross-border Data Portability</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  ผู้ป่วยต่างชาติได้รับ Discharge Packet VC ที่สามารถนำไปใช้ต่อในประเทศต้นทาง
                  รองรับ Smart Health Links สำหรับแชร์ข้อมูลข้ามพรมแดน
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="integration">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Plug className="h-4 w-4" />
                  สถานะ Adapter
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm">Adapter ทั้งหมด</span>
                    <Badge variant="secondary">{stats.data?.adapters ?? 0}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">ออนไลน์</span>
                    <Badge className="bg-green-100 text-green-700">{stats.data?.adaptersOnline ?? 0}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">ออฟไลน์</span>
                    <Badge className="bg-red-100 text-red-700">
                      {(stats.data?.adapters ?? 0) - (stats.data?.adaptersOnline ?? 0)}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">HIS/Legacy Integration</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    ระบบเชื่อมต่อกับ HIS, EMR, LIS และระบบ Legacy ของโรงพยาบาลผ่าน Adapter Layer
                    เพื่อดึงข้อมูลมาออก VC โดยไม่ต้องเปลี่ยนระบบเดิม
                  </p>
                  <div className="flex justify-between">
                    <span className="text-sm">โรงพยาบาลที่เชื่อมต่อ</span>
                    <Badge variant="secondary">{stats.data?.hospitals ?? 0}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
