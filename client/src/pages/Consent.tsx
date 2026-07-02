import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { ShieldCheck, FileText, Clock, XCircle, CheckCircle2, Info, History, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

function ConsentExpiryAlert() {
  const { data: expiring } = trpc.consent.expiringWithinDays.useQuery({ days: 7 });
  if (!expiring || expiring.length === 0) return null;
  return (
    <Card className="border-amber-200 bg-amber-50/50">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-amber-900">ความยินยอมใกล้หมดอายุ</p>
            <p className="text-amber-700 mt-1">คุณมี {expiring.length} รายการที่จะหมดอายุภายใน 7 วัน</p>
            <ul className="mt-2 space-y-1">
              {expiring.slice(0, 3).map((item: any) => (
                <li key={item.id} className="text-xs text-amber-700">
                  • {purposeLabels[item.purpose] || item.purpose} — หมดอายุใน {item.daysUntilExpiry} วัน
                  ({new Date(item.expiresAt).toLocaleDateString("th-TH")})
                </li>
              ))}
              {expiring.length > 3 && <li className="text-xs text-amber-600">...และอีก {expiring.length - 3} รายการ</li>}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const purposeLabels: Record<string, string> = {
  treatment: "การรักษา",
  referral: "การส่งต่อ",
  research: "การวิจัย",
  insurance: "ประกันภัย",
  public_health: "สาธารณสุข",
  emergency: "ฉุกเฉิน",
};

export default function Consent() {
  const { data: records, isLoading, refetch } = trpc.consent.records.useQuery({});
  const { data: policies } = trpc.consent.policies.useQuery({});
  const { data: consentHistory } = trpc.consent.history.useQuery({});
  const [revokeId, setRevokeId] = useState<number | null>(null);
  const [revokeReason, setRevokeReason] = useState("");

  const revokeMutation = trpc.consent.revoke.useMutation({
    onSuccess: () => { toast.success("ถอนความยินยอมสำเร็จ"); setRevokeId(null); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">จัดการความยินยอม</h1>
          <p className="text-muted-foreground text-sm mt-1">ตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA)</p>
        </div>

        {/* Anti-dark-pattern notice */}
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="p-4 flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">สิทธิ์ของคุณในการจัดการความยินยอม</p>
              <p className="mt-1 text-blue-700">คุณสามารถถอนความยินยอมได้ทุกเมื่อ โดยไม่มีผลกระทบต่อการรักษาที่ผ่านมา การถอนความยินยอมจะมีผลทันทีสำหรับการใช้ข้อมูลในอนาคต</p>
            </div>
          </CardContent>
        </Card>

        {/* Consent Expiry Reminder Alert */}
        <ConsentExpiryAlert />

        <Tabs defaultValue="records">
          <TabsList>
            <TabsTrigger value="records" className="gap-2"><ShieldCheck className="h-3.5 w-3.5" />ความยินยอมของฉัน</TabsTrigger>
            <TabsTrigger value="policies" className="gap-2"><FileText className="h-3.5 w-3.5" />นโยบาย</TabsTrigger>
            <TabsTrigger value="history" className="gap-2"><History className="h-3.5 w-3.5" />ประวัติ</TabsTrigger>
          </TabsList>

          <TabsContent value="records" className="mt-4">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">กำลังโหลด...</div>
            ) : records && records.length > 0 ? (
              <div className="space-y-3">
                {records.map((r: any) => (
                  <Card key={r.id} className="hover:shadow-sm transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${r.status === "granted" ? "bg-emerald-100" : r.status === "revoked" ? "bg-red-100" : "bg-gray-100"}`}>
                            {r.status === "granted" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> :
                             r.status === "revoked" ? <XCircle className="h-4 w-4 text-red-600" /> :
                             <Clock className="h-4 w-4 text-gray-600" />}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{purposeLabels[r.purpose] || r.purpose}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              ให้เมื่อ: {new Date(r.grantedAt).toLocaleDateString("th-TH")}
                              {r.expiresAt && ` | หมดอายุ: ${new Date(r.expiresAt).toLocaleDateString("th-TH")}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={r.status === "granted" ? "default" : r.status === "revoked" ? "destructive" : "secondary"} className="text-[10px]">
                            {r.status === "granted" ? "ให้ความยินยอม" : r.status === "revoked" ? "ถอนแล้ว" : "หมดอายุ"}
                          </Badge>
                          {r.status === "granted" && (
                            <Button size="sm" variant="outline" className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                              onClick={() => setRevokeId(r.id)}>
                              ถอนความยินยอม
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center py-16">
                  <ShieldCheck className="h-12 w-12 text-muted-foreground/30 mb-4" />
                  <p className="text-muted-foreground">ยังไม่มีบันทึกความยินยอม</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="policies" className="mt-4">
            <div className="space-y-3">
              {policies?.map((p: any) => (
                <Card key={p.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-sm">{p.name}</h3>
                        <p className="text-xs text-muted-foreground mt-1">{p.description || "ไม่มีรายละเอียด"}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="secondary" className="text-[10px]">{purposeLabels[p.purpose]}</Badge>
                          <span className="text-[10px] text-muted-foreground">เก็บข้อมูล {p.retentionDays} วัน</span>
                          {p.isRequired && <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-300">จำเป็น</Badge>}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px]">v{p.version}</Badge>
                    </div>
                  </CardContent>
                </Card>
              )) || <p className="text-center py-8 text-muted-foreground">ยังไม่มีนโยบาย</p>}
            </div>
          </TabsContent>
          <TabsContent value="history" className="mt-4">
            {consentHistory && consentHistory.length > 0 ? (
              <div className="space-y-2">
                {consentHistory.map((h: any, idx: number) => (
                  <Card key={idx} className="hover:shadow-sm transition-shadow">
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${h.action === "consent.granted" ? "bg-emerald-100" : "bg-red-100"}`}>
                        {h.action === "consent.granted" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-red-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{h.action === "consent.granted" ? "ให้ความยินยอม" : "ถอนความยินยอม"} • {purposeLabels[h.purpose] || h.purpose}</p>
                        <p className="text-xs text-muted-foreground">ผู้ดำเนินการ: ผู้ป่วย #{h.actorId} • {h.timestamp ? new Date(h.timestamp).toLocaleString("th-TH") : "-"}</p>
                      </div>
                      <Badge variant={h.action === "consent.granted" ? "default" : "destructive"} className="text-[10px] shrink-0">
                        {h.action === "consent.granted" ? "Grant" : "Revoke"}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card><CardContent className="flex flex-col items-center py-16"><History className="h-12 w-12 text-muted-foreground/30 mb-4" /><p className="text-muted-foreground">ยังไม่มีประวัติการจัดการความยินยอม</p></CardContent></Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Revoke Dialog */}
        <Dialog open={!!revokeId} onOpenChange={() => setRevokeId(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>ถอนความยินยอม</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">การถอนความยินยอมจะมีผลทันที แต่ไม่กระทบการใช้ข้อมูลที่ผ่านมาแล้ว</p>
              </div>
              <textarea
                className="w-full border rounded-lg p-3 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="เหตุผลในการถอน (ไม่บังคับ)..."
                value={revokeReason}
                onChange={e => setRevokeReason(e.target.value)}
              />
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setRevokeId(null)}>ยกเลิก</Button>
                <Button variant="destructive" className="flex-1" disabled={revokeMutation.isPending}
                  onClick={() => revokeId && revokeMutation.mutate({ id: revokeId, reason: revokeReason || "ผู้ป่วยถอนความยินยอม" })}>
                  {revokeMutation.isPending ? "กำลังดำเนินการ..." : "ยืนยันถอนความยินยอม"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
