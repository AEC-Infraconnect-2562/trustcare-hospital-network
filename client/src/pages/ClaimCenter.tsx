import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Receipt, Plus, CheckCircle2, XCircle, Clock, AlertTriangle, DollarSign, FileCheck } from "lucide-react";
import { toast } from "sonner";

const claimStatusMap: Record<string, { label: string; color: string }> = {
  draft: { label: "ร่าง", color: "bg-gray-100 text-gray-700" },
  validating: { label: "กำลังตรวจสอบ", color: "bg-blue-100 text-blue-700" },
  correction_required: { label: "ต้องแก้ไข", color: "bg-orange-100 text-orange-700" },
  ready_to_submit: { label: "พร้อมส่ง", color: "bg-emerald-100 text-emerald-700" },
  submitted: { label: "ส่งแล้ว", color: "bg-indigo-100 text-indigo-700" },
  accepted: { label: "อนุมัติ", color: "bg-green-100 text-green-700" },
  rejected: { label: "ปฏิเสธ", color: "bg-red-100 text-red-700" },
  more_info_requested: { label: "ขอข้อมูลเพิ่ม", color: "bg-yellow-100 text-yellow-700" },
  appeal: { label: "อุทธรณ์", color: "bg-purple-100 text-purple-700" },
  paid: { label: "จ่ายแล้ว", color: "bg-green-200 text-green-800" },
  closed: { label: "ปิดเคส", color: "bg-gray-200 text-gray-600" },
};

export default function ClaimCenter() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const { data: claims, refetch } = trpc.claim.listCases.useQuery({
    status: statusFilter === "all" ? undefined : statusFilter,
  });
  const { data: payers } = trpc.claim.listPayers.useQuery();
  const createCase = trpc.claim.createCase.useMutation({ onSuccess: () => { refetch(); setShowCreateDialog(false); toast.success("สร้างเคสเคลมสำเร็จ"); } });
  const validateClaim = trpc.claim.validate.useMutation({ onSuccess: (data) => { refetch(); if (data.valid) toast.success("ตรวจสอบผ่าน พร้อมส่ง"); else toast.warning("พบข้อผิดพลาด กรุณาแก้ไข"); } });
  const updateStatus = trpc.claim.updateStatus.useMutation({ onSuccess: () => { refetch(); toast.success("อัปเดตสถานะสำเร็จ"); } });

  const stats = {
    total: claims?.length || 0,
    pending: claims?.filter(c => ["draft", "validating", "correction_required", "ready_to_submit"].includes(c.status)).length || 0,
    submitted: claims?.filter(c => c.status === "submitted").length || 0,
    paid: claims?.filter(c => c.status === "paid").length || 0,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Receipt className="h-7 w-7 text-primary" />
              ศูนย์เคลม
            </h1>
            <p className="text-muted-foreground mt-1">จัดการเคลมค่ารักษาพยาบาล ตรวจสอบสิทธิ์ และติดตามสถานะการเบิกจ่าย</p>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />สร้างเคสเคลม</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>สร้างเคสเคลมใหม่</DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                createCase.mutate({
                  patientId: Number(fd.get("patientId")),
                  hospitalId: Number(fd.get("hospitalId")),
                  payerAdapterId: Number(fd.get("payerAdapterId")),
                  claimType: fd.get("claimType") as any,
                  totalAmount: fd.get("totalAmount") as string,
                });
              }} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>รหัสผู้ป่วย</Label><Input name="patientId" type="number" required /></div>
                  <div><Label>รหัสโรงพยาบาล</Label><Input name="hospitalId" type="number" required /></div>
                </div>
                <div>
                  <Label>ผู้จ่าย (Payer)</Label>
                  <Select name="payerAdapterId" required>
                    <SelectTrigger><SelectValue placeholder="เลือกผู้จ่าย" /></SelectTrigger>
                    <SelectContent>
                      {payers?.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>ประเภทเคลม</Label>
                  <Select name="claimType" required>
                    <SelectTrigger><SelectValue placeholder="เลือกประเภท" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="opd">ผู้ป่วยนอก (OPD)</SelectItem>
                      <SelectItem value="ipd">ผู้ป่วยใน (IPD)</SelectItem>
                      <SelectItem value="dental">ทันตกรรม</SelectItem>
                      <SelectItem value="pharmacy">เภสัชกรรม</SelectItem>
                      <SelectItem value="rehabilitation">เวชศาสตร์ฟื้นฟู</SelectItem>
                      <SelectItem value="emergency">ฉุกเฉิน</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>จำนวนเงิน (บาท)</Label><Input name="totalAmount" placeholder="0.00" /></div>
                <Button type="submit" className="w-full" disabled={createCase.isPending}>สร้างเคส</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="pt-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50"><FileCheck className="h-5 w-5 text-blue-600" /></div>
            <div><p className="text-sm text-muted-foreground">ทั้งหมด</p><p className="text-xl font-bold">{stats.total}</p></div>
          </CardContent></Card>
          <Card><CardContent className="pt-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-50"><Clock className="h-5 w-5 text-orange-600" /></div>
            <div><p className="text-sm text-muted-foreground">รอดำเนินการ</p><p className="text-xl font-bold">{stats.pending}</p></div>
          </CardContent></Card>
          <Card><CardContent className="pt-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-50"><AlertTriangle className="h-5 w-5 text-indigo-600" /></div>
            <div><p className="text-sm text-muted-foreground">ส่งแล้ว</p><p className="text-xl font-bold">{stats.submitted}</p></div>
          </CardContent></Card>
          <Card><CardContent className="pt-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-50"><DollarSign className="h-5 w-5 text-green-600" /></div>
            <div><p className="text-sm text-muted-foreground">จ่ายแล้ว</p><p className="text-xl font-bold">{stats.paid}</p></div>
          </CardContent></Card>
        </div>

        {/* Filter & List */}
        <Tabs defaultValue="all" onValueChange={setStatusFilter}>
          <TabsList>
            <TabsTrigger value="all">ทั้งหมด</TabsTrigger>
            <TabsTrigger value="draft">ร่าง</TabsTrigger>
            <TabsTrigger value="submitted">ส่งแล้ว</TabsTrigger>
            <TabsTrigger value="accepted">อนุมัติ</TabsTrigger>
            <TabsTrigger value="rejected">ปฏิเสธ</TabsTrigger>
            <TabsTrigger value="paid">จ่ายแล้ว</TabsTrigger>
          </TabsList>
          <TabsContent value={statusFilter} className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-lg">รายการเคลม</CardTitle></CardHeader>
              <CardContent>
                {(!claims || claims.length === 0) ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Receipt className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>ยังไม่มีรายการเคลม</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {claims.map(claim => {
                      const statusInfo = claimStatusMap[claim.status] || { label: claim.status, color: "bg-gray-100" };
                      return (
                        <div key={claim.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="p-2 rounded-lg bg-primary/10">
                              <Receipt className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">เคส #{claim.id} — {claim.claimType?.toUpperCase()}</p>
                              <p className="text-sm text-muted-foreground">
                                ผู้ป่วย #{claim.patientId} • โรงพยาบาล #{claim.hospitalId}
                                {claim.totalAmount && ` • ฿${claim.totalAmount}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
                            {claim.status === "draft" && (
                              <Button size="sm" variant="outline" onClick={() => validateClaim.mutate({ id: claim.id })}>
                                ตรวจสอบ
                              </Button>
                            )}
                            {claim.status === "ready_to_submit" && (
                              <Button size="sm" onClick={() => updateStatus.mutate({ id: claim.id, status: "submitted" })}>
                                ส่งเคลม
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
