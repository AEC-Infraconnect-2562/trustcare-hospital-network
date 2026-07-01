import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Link2, Plus, QrCode, Eye, XCircle, Clock, Shield } from "lucide-react";
import { toast } from "sonner";

const purposeLabels: Record<string, string> = {
  referral: "ส่งต่อผู้ป่วย",
  patient_summary: "สรุปข้อมูลผู้ป่วย",
  discharge: "สรุปจำหน่าย",
  cross_border: "ข้ามประเทศ",
  medical_tourist: "ผู้ป่วยต่างชาติ",
  insurance: "ประกัน/เคลม",
  self_share: "แชร์ด้วยตนเอง",
};

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  expired: "bg-gray-100 text-gray-700",
  revoked: "bg-red-100 text-red-700",
  max_accessed: "bg-orange-100 text-orange-700",
};

const statusLabels: Record<string, string> = {
  active: "ใช้งานได้",
  expired: "หมดอายุ",
  revoked: "ถูกเพิกถอน",
  max_accessed: "ถึงขีดจำกัด",
};

export default function SmartHealthLinks() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedShl, setSelectedShl] = useState<number | null>(null);

  // For demo, use patientId = 1
  const { data: links, refetch } = trpc.shl.list.useQuery({ patientId: 1 });
  const { data: accessLogs } = trpc.shl.accessLogs.useQuery(
    { shlId: selectedShl! },
    { enabled: !!selectedShl }
  );
  const createShl = trpc.shl.create.useMutation({
    onSuccess: (data) => { refetch(); setShowCreateDialog(false); toast.success(`สร้าง SHL สำเร็จ`); }
  });
  const revokeShl = trpc.shl.revoke.useMutation({
    onSuccess: () => { refetch(); toast.success("เพิกถอน SHL สำเร็จ"); }
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Link2 className="h-7 w-7 text-primary" />
              ลิงก์แชร์สุขภาพ (Smart Health Links)
            </h1>
            <p className="text-muted-foreground mt-1">สร้างและจัดการลิงก์สำหรับแชร์ข้อมูลสุขภาพอย่างปลอดภัย มีการควบคุมการเข้าถึงและหมดอายุอัตโนมัติ</p>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />สร้าง SHL</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>สร้าง Smart Health Link</DialogTitle></DialogHeader>
              <form onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                createShl.mutate({
                  patientId: 1,
                  hospitalId: Number(fd.get("hospitalId")) || 1,
                  purpose: fd.get("purpose") as any,
                  maxAccessCount: fd.get("maxAccessCount") ? Number(fd.get("maxAccessCount")) : undefined,
                  expiresInDays: fd.get("expiresInDays") ? Number(fd.get("expiresInDays")) : undefined,
                });
              }} className="space-y-4">
                <div>
                  <Label>วัตถุประสงค์</Label>
                  <Select name="purpose" required>
                    <SelectTrigger><SelectValue placeholder="เลือกวัตถุประสงค์" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(purposeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>รหัสโรงพยาบาล</Label><Input name="hospitalId" type="number" defaultValue={1} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>จำนวนครั้งที่เข้าถึงได้</Label><Input name="maxAccessCount" type="number" placeholder="ไม่จำกัด" /></div>
                  <div><Label>หมดอายุใน (วัน)</Label><Input name="expiresInDays" type="number" placeholder="ไม่หมดอายุ" /></div>
                </div>
                <Card className="bg-muted/30 border-dashed">
                  <CardContent className="pt-3">
                    <div className="flex items-start gap-2">
                      <Shield className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <p className="text-xs text-muted-foreground">
                        SHL จะสร้าง QR Code ที่ผู้ป่วยสามารถแชร์กับแพทย์หรือโรงพยาบาลอื่นได้
                        ข้อมูลจะถูกเข้ารหัสและมีการควบคุมการเข้าถึง
                      </p>
                    </div>
                  </CardContent>
                </Card>
                <Button type="submit" className="w-full" disabled={createShl.isPending}>สร้าง SHL</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Info */}
        <Card className="bg-muted/30 border-dashed">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <QrCode className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium text-sm">Smart Health Links (SHL) คืออะไร?</p>
                <p className="text-xs text-muted-foreground mt-1">
                  SHL เป็นมาตรฐานสำหรับแชร์ข้อมูลสุขภาพผ่าน QR Code หรือ URL อย่างปลอดภัย
                  ผู้ป่วยสามารถควบคุมว่าใครเข้าถึงได้ กี่ครั้ง และหมดอายุเมื่อไหร่
                  เหมาะสำหรับการส่งต่อผู้ป่วย การเดินทางข้ามประเทศ และการแชร์ข้อมูลกับประกัน
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* SHL List */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-3">
            <h2 className="text-lg font-semibold">ลิงก์ที่สร้างไว้</h2>
            {(!links || links.length === 0) ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Link2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>ยังไม่มี Smart Health Link</p>
                  <p className="text-xs mt-1">สร้าง SHL เพื่อแชร์ข้อมูลสุขภาพอย่างปลอดภัย</p>
                </CardContent>
              </Card>
            ) : (
              links.map((link: any) => (
                <Card key={link.id} className={`hover:shadow-sm transition-shadow cursor-pointer ${selectedShl === link.id ? "ring-2 ring-primary" : ""}`}
                  onClick={() => setSelectedShl(link.id)}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <QrCode className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{purposeLabels[link.purpose] || link.purpose}</p>
                          <p className="text-sm text-muted-foreground">
                            เข้าถึงแล้ว {link.currentAccessCount || 0}
                            {link.maxAccessCount ? `/${link.maxAccessCount}` : ""} ครั้ง
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {link.expiresAt && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                หมดอายุ: {new Date(link.expiresAt).toLocaleDateString("th-TH")}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={statusColors[link.status] || "bg-gray-100"}>
                          {statusLabels[link.status] || link.status}
                        </Badge>
                        {link.status === "active" && (
                          <Button size="sm" variant="ghost" className="text-red-600" onClick={(e) => {
                            e.stopPropagation();
                            revokeShl.mutate({ id: link.id });
                          }}>
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Access Logs Panel */}
          <div>
            <h2 className="text-lg font-semibold mb-3">ประวัติการเข้าถึง</h2>
            <Card>
              <CardContent className="pt-4">
                {!selectedShl ? (
                  <p className="text-center py-8 text-sm text-muted-foreground">เลือก SHL เพื่อดูประวัติ</p>
                ) : (!accessLogs || accessLogs.length === 0) ? (
                  <p className="text-center py-8 text-sm text-muted-foreground">ยังไม่มีการเข้าถึง</p>
                ) : (
                  <div className="space-y-2">
                    {accessLogs.map((log: any) => (
                      <div key={log.id} className="p-3 border rounded-lg text-sm">
                        <div className="flex items-center gap-2">
                          <Eye className="h-3 w-3 text-muted-foreground" />
                          <span className="font-medium">{log.accessorName || "ไม่ระบุชื่อ"}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {log.accessorOrg && <span>{log.accessorOrg} • </span>}
                          {log.accessorCountry && <span>{log.accessorCountry} • </span>}
                          {new Date(log.accessedAt).toLocaleString("th-TH")}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
