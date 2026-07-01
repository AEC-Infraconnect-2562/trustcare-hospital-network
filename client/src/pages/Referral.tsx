import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { ArrowRightLeft, Plus, ArrowRight, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  requested: { label: "รอรับ", color: "bg-amber-100 text-amber-800 border-amber-300", icon: Clock },
  accepted: { label: "รับแล้ว", color: "bg-blue-100 text-blue-800 border-blue-300", icon: CheckCircle2 },
  in_progress: { label: "กำลังดำเนินการ", color: "bg-indigo-100 text-indigo-800 border-indigo-300", icon: Loader2 },
  completed: { label: "เสร็จสิ้น", color: "bg-emerald-100 text-emerald-800 border-emerald-300", icon: CheckCircle2 },
  replied: { label: "ตอบกลับ", color: "bg-green-100 text-green-800 border-green-300", icon: CheckCircle2 },
  rejected: { label: "ปฏิเสธ", color: "bg-red-100 text-red-800 border-red-300", icon: XCircle },
};

const priorityLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  routine: { label: "ปกติ", variant: "secondary" },
  urgent: { label: "เร่งด่วน", variant: "default" },
  emergency: { label: "ฉุกเฉิน", variant: "destructive" },
};

export default function Referral() {
  const { data: referrals, isLoading, refetch } = trpc.referral.list.useQuery({});
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">ส่งต่อผู้ป่วย</h1>
            <p className="text-muted-foreground text-sm mt-1">Closed-loop Referral — ติดตามสถานะการส่งต่อ</p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />สร้างใบส่งต่อ</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>สร้างใบส่งต่อใหม่</DialogTitle></DialogHeader>
              <CreateReferralForm onSuccess={() => { setCreateOpen(false); refetch(); }} />
            </DialogContent>
          </Dialog>
        </div>

        {/* State Machine Flow */}
        <Card className="bg-muted/30">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2 font-medium">ลำดับสถานะการส่งต่อ</p>
            <div className="flex items-center gap-1 flex-wrap text-xs">
              {["Requested", "Accepted", "InProgress", "Completed", "Replied"].map((s, i) => (
                <span key={s} className="flex items-center gap-1">
                  <Badge variant="outline" className="text-[10px] px-2">{s}</Badge>
                  {i < 4 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
                </span>
              ))}
              <span className="text-muted-foreground mx-2">|</span>
              <Badge variant="outline" className="text-[10px] px-2 border-red-300 text-red-600">Rejected</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Referral List */}
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">กำลังโหลด...</div>
        ) : referrals && referrals.length > 0 ? (
          <div className="space-y-3">
            {referrals.map((ref: any) => {
              const status = statusConfig[ref.status] || statusConfig.requested;
              const priority = priorityLabels[ref.priority] || priorityLabels.routine;
              const StatusIcon = status.icon;
              return (
                <Card key={ref.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center mt-0.5">
                          <ArrowRightLeft className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm font-mono">{ref.referralCode}</p>
                            <Badge variant={priority.variant} className="text-[10px]">{priority.label}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{ref.reason}</p>
                          {ref.diagnosis && <p className="text-xs text-muted-foreground">วินิจฉัย: {ref.diagnosis} {ref.icdCode && `(${ref.icdCode})`}</p>}
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {new Date(ref.createdAt).toLocaleDateString("th-TH")}
                          </p>
                        </div>
                      </div>
                      <Badge className={`text-[10px] border ${status.color}`}>
                        <StatusIcon className="h-3 w-3 mr-1" />{status.label}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center py-16">
              <ArrowRightLeft className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">ยังไม่มีใบส่งต่อ</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

function CreateReferralForm({ onSuccess }: { onSuccess: () => void }) {
  const [form, setForm] = useState({
    patientId: "", fromHospitalId: "", toHospitalId: "", priority: "routine",
    reason: "", clinicalNotes: "", diagnosis: "", icdCode: "",
  });
  const { data: hospitals } = trpc.hospital.list.useQuery();
  const createMutation = trpc.referral.create.useMutation({
    onSuccess: (data) => { toast.success(`สร้างใบส่งต่อ ${data.referralCode} สำเร็จ`); onSuccess(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <form onSubmit={e => { e.preventDefault(); createMutation.mutate({
      patientId: Number(form.patientId),
      fromHospitalId: Number(form.fromHospitalId),
      toHospitalId: Number(form.toHospitalId),
      priority: form.priority as any,
      reason: form.reason,
      clinicalNotes: form.clinicalNotes || undefined,
      diagnosis: form.diagnosis || undefined,
      icdCode: form.icdCode || undefined,
    }); }} className="space-y-4">
      <div className="space-y-2">
        <Label>รหัสผู้ป่วย (User ID)</Label>
        <Input value={form.patientId} onChange={e => setForm(p => ({ ...p, patientId: e.target.value }))} type="number" placeholder="1" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>จากโรงพยาบาล</Label>
          <Select value={form.fromHospitalId} onValueChange={v => setForm(p => ({ ...p, fromHospitalId: v }))}>
            <SelectTrigger><SelectValue placeholder="เลือก..." /></SelectTrigger>
            <SelectContent>
              {hospitals?.map((h: any) => <SelectItem key={h.id} value={String(h.id)}>{h.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>ไปยังโรงพยาบาล</Label>
          <Select value={form.toHospitalId} onValueChange={v => setForm(p => ({ ...p, toHospitalId: v }))}>
            <SelectTrigger><SelectValue placeholder="เลือก..." /></SelectTrigger>
            <SelectContent>
              {hospitals?.map((h: any) => <SelectItem key={h.id} value={String(h.id)}>{h.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>ความเร่งด่วน</Label>
        <Select value={form.priority} onValueChange={v => setForm(p => ({ ...p, priority: v }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="routine">ปกติ</SelectItem>
            <SelectItem value="urgent">เร่งด่วน</SelectItem>
            <SelectItem value="emergency">ฉุกเฉิน</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>เหตุผลการส่งต่อ *</Label>
        <Textarea value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} placeholder="ระบุเหตุผล..." />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>การวินิจฉัย</Label>
          <Input value={form.diagnosis} onChange={e => setForm(p => ({ ...p, diagnosis: e.target.value }))} placeholder="เบาหวาน..." />
        </div>
        <div className="space-y-2">
          <Label>รหัส ICD-10</Label>
          <Input value={form.icdCode} onChange={e => setForm(p => ({ ...p, icdCode: e.target.value }))} placeholder="E11" />
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={createMutation.isPending || !form.reason}>
        {createMutation.isPending ? "กำลังสร้าง..." : "สร้างใบส่งต่อ"}
      </Button>
    </form>
  );
}
