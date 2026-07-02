import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, User, Building2, FileText, ShieldCheck, Send } from "lucide-react";

interface Props {
  onSuccess: () => void;
  onCancel?: () => void;
}

type Step = 1 | 2 | 3 | 4 | 5;

const stepsMeta = [
  { id: 1, title: "ผู้ป่วย", icon: User },
  { id: 2, title: "ปลายทาง", icon: Building2 },
  { id: 3, title: "ข้อมูลคลินิก", icon: FileText },
  { id: 4, title: "ความยินยอม", icon: ShieldCheck },
  { id: 5, title: "ยืนยัน", icon: Send },
];

export function ReferralCreationWizard({ onSuccess, onCancel }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState({
    patientId: "",
    fromHospitalId: "",
    toHospitalId: "",
    priority: "routine",
    reason: "",
    clinicalNotes: "",
    diagnosis: "",
    icdCode: "",
    consentGranted: false,
  });

  const { data: hospitals } = trpc.hospital.list.useQuery();
  const createMutation = trpc.referral.create.useMutation({
    onSuccess: (data) => {
      toast.success(`สร้างใบส่งต่อ ${data.referralCode} สำเร็จ`);
      onSuccess();
    },
    onError: (e) => toast.error(e.message),
  });

  const progress = useMemo(() => ((step - 1) / 4) * 100, [step]);

  const canProceed = useMemo(() => {
    switch (step) {
      case 1: return !!form.patientId && !!form.fromHospitalId;
      case 2: return !!form.toHospitalId && form.fromHospitalId !== form.toHospitalId;
      case 3: return !!form.reason;
      case 4: return form.consentGranted;
      case 5: return true;
      default: return false;
    }
  }, [step, form]);

  const handleSubmit = () => {
    createMutation.mutate({
      patientId: Number(form.patientId),
      fromHospitalId: Number(form.fromHospitalId),
      toHospitalId: Number(form.toHospitalId),
      priority: form.priority as any,
      reason: form.reason,
      clinicalNotes: form.clinicalNotes || undefined,
      diagnosis: form.diagnosis || undefined,
      icdCode: form.icdCode || undefined,
    });
  };

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>ขั้นตอน {step}/5</span>
          <span>{stepsMeta[step - 1].title}</span>
        </div>
        <Progress value={progress} className="h-1.5" />
      </div>

      {/* Step Indicators */}
      <div className="flex items-center justify-center gap-1 mb-4">
        {stepsMeta.map((s, i) => {
          const Icon = s.icon;
          const isActive = step === s.id;
          const isCompleted = step > s.id;
          return (
            <div key={s.id} className="flex items-center gap-1">
              <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs transition-all ${
                isActive ? "bg-primary text-primary-foreground" : isCompleted ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
              }`}>
                {isCompleted ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
              </div>
              {i < stepsMeta.length - 1 && <div className={`w-6 h-0.5 ${isCompleted ? "bg-emerald-500" : "bg-muted"}`} />}
            </div>
          );
        })}
      </div>

      {/* Step 1: Patient Selection */}
      {step === 1 && (
        <Card>
          <CardHeader><CardTitle className="text-base">เลือกผู้ป่วยและต้นทาง</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>รหัสผู้ป่วย (User ID) *</Label>
              <Input value={form.patientId} onChange={(e) => setForm((p) => ({ ...p, patientId: e.target.value }))} type="number" placeholder="ระบุ ID ผู้ป่วย" />
            </div>
            <div className="space-y-2">
              <Label>โรงพยาบาลต้นทาง *</Label>
              <Select value={form.fromHospitalId} onValueChange={(v) => setForm((p) => ({ ...p, fromHospitalId: v }))}>
                <SelectTrigger><SelectValue placeholder="เลือกโรงพยาบาล..." /></SelectTrigger>
                <SelectContent>
                  {hospitals?.map((h: any) => <SelectItem key={h.id} value={String(h.id)}>{h.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Destination */}
      {step === 2 && (
        <Card>
          <CardHeader><CardTitle className="text-base">เลือกปลายทางและความเร่งด่วน</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>โรงพยาบาลปลายทาง *</Label>
              <Select value={form.toHospitalId} onValueChange={(v) => setForm((p) => ({ ...p, toHospitalId: v }))}>
                <SelectTrigger><SelectValue placeholder="เลือกโรงพยาบาล..." /></SelectTrigger>
                <SelectContent>
                  {hospitals?.filter((h: any) => String(h.id) !== form.fromHospitalId).map((h: any) => (
                    <SelectItem key={h.id} value={String(h.id)}>{h.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.fromHospitalId === form.toHospitalId && form.toHospitalId && (
                <p className="text-xs text-destructive">ต้นทางและปลายทางต้องไม่ใช่โรงพยาบาลเดียวกัน</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>ความเร่งด่วน</Label>
              <Select value={form.priority} onValueChange={(v) => setForm((p) => ({ ...p, priority: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="routine">ปกติ (Routine)</SelectItem>
                  <SelectItem value="urgent">เร่งด่วน (Urgent)</SelectItem>
                  <SelectItem value="emergency">ฉุกเฉิน (Emergency)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Clinical Information */}
      {step === 3 && (
        <Card>
          <CardHeader><CardTitle className="text-base">ข้อมูลทางคลินิก</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>เหตุผลการส่งต่อ *</Label>
              <Textarea value={form.reason} onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))} placeholder="ระบุเหตุผลในการส่งต่อผู้ป่วย..." rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>การวินิจฉัย</Label>
                <Input value={form.diagnosis} onChange={(e) => setForm((p) => ({ ...p, diagnosis: e.target.value }))} placeholder="เช่น เบาหวาน Type 2" />
              </div>
              <div className="space-y-2">
                <Label>รหัส ICD-10</Label>
                <Input value={form.icdCode} onChange={(e) => setForm((p) => ({ ...p, icdCode: e.target.value }))} placeholder="เช่น E11" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>หมายเหตุทางคลินิก</Label>
              <Textarea value={form.clinicalNotes} onChange={(e) => setForm((p) => ({ ...p, clinicalNotes: e.target.value }))} placeholder="ข้อมูลเพิ่มเติมสำหรับแพทย์ปลายทาง..." rows={2} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Consent */}
      {step === 4 && (
        <Card>
          <CardHeader><CardTitle className="text-base">ความยินยอมผู้ป่วย</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border p-4 bg-muted/30 space-y-3">
              <p className="text-sm font-medium">ข้อตกลงการส่งต่อข้อมูล</p>
              <ul className="text-xs text-muted-foreground space-y-1.5 list-disc list-inside">
                <li>ข้อมูลผู้ป่วยจะถูกส่งต่อไปยังโรงพยาบาลปลายทางเพื่อการรักษาต่อเนื่อง</li>
                <li>ข้อมูลจะถูกเข้ารหัสระหว่างการส่งต่อ (SHL encrypted transport)</li>
                <li>โรงพยาบาลปลายทางจะเข้าถึงข้อมูลได้เฉพาะที่จำเป็นต่อการรักษา</li>
                <li>ผู้ป่วยสามารถเพิกถอนความยินยอมได้ตลอดเวลา</li>
              </ul>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-md border">
              <Checkbox id="consent" checked={form.consentGranted} onCheckedChange={(v) => setForm((p) => ({ ...p, consentGranted: !!v }))} />
              <label htmlFor="consent" className="text-sm cursor-pointer leading-relaxed">
                ผู้ป่วยได้รับทราบและยินยอมให้ส่งต่อข้อมูลทางการแพทย์ไปยังโรงพยาบาลปลายทาง
              </label>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Confirmation */}
      {step === 5 && (
        <Card>
          <CardHeader><CardTitle className="text-base">ยืนยันข้อมูลการส่งต่อ</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-muted-foreground">ผู้ป่วย ID</p><p className="font-medium">{form.patientId}</p></div>
              <div><p className="text-xs text-muted-foreground">ความเร่งด่วน</p>
                <Badge variant={form.priority === "emergency" ? "destructive" : form.priority === "urgent" ? "default" : "secondary"}>
                  {form.priority === "routine" ? "ปกติ" : form.priority === "urgent" ? "เร่งด่วน" : "ฉุกเฉิน"}
                </Badge>
              </div>
              <div><p className="text-xs text-muted-foreground">จากโรงพยาบาล</p><p className="font-medium">{hospitals?.find((h: any) => String(h.id) === form.fromHospitalId)?.name || form.fromHospitalId}</p></div>
              <div><p className="text-xs text-muted-foreground">ไปยังโรงพยาบาล</p><p className="font-medium">{hospitals?.find((h: any) => String(h.id) === form.toHospitalId)?.name || form.toHospitalId}</p></div>
            </div>
            <div><p className="text-xs text-muted-foreground">เหตุผล</p><p className="text-sm">{form.reason}</p></div>
            {form.diagnosis && <div><p className="text-xs text-muted-foreground">วินิจฉัย</p><p className="text-sm">{form.diagnosis} {form.icdCode && `(${form.icdCode})`}</p></div>}
            <div className="flex items-center gap-2 text-xs text-emerald-600"><ShieldCheck className="h-4 w-4" /><span>ผู้ป่วยยินยอมแล้ว</span></div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" onClick={() => step === 1 ? onCancel?.() : setStep((s) => (s - 1) as Step)} disabled={createMutation.isPending}>
          <ArrowLeft className="h-4 w-4 mr-2" />{step === 1 ? "ยกเลิก" : "ย้อนกลับ"}
        </Button>
        {step < 5 ? (
          <Button onClick={() => setStep((s) => (s + 1) as Step)} disabled={!canProceed}>ถัดไป <ArrowRight className="h-4 w-4 ml-2" /></Button>
        ) : (
          <Button onClick={handleSubmit} disabled={createMutation.isPending}>
            {createMutation.isPending ? "กำลังสร้าง..." : "สร้างใบส่งต่อ"}<Send className="h-4 w-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );
}
