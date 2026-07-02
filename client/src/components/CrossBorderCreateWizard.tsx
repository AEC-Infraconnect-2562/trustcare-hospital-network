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
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Globe, Building2, FileText, Languages, ShieldCheck, Send, Package } from "lucide-react";

interface Props {
  onSuccess: () => void;
  onCancel?: () => void;
}

type Step = 1 | 2 | 3 | 4 | 5 | 6;

const stepsMeta = [
  { id: 1, title: "ทิศทาง", icon: Globe },
  { id: 2, title: "พันธมิตร", icon: Building2 },
  { id: 3, title: "ผู้ป่วย", icon: FileText },
  { id: 4, title: "ภาษา/แปล", icon: Languages },
  { id: 5, title: "ความยินยอม", icon: ShieldCheck },
  { id: 6, title: "ยืนยัน", icon: Send },
];

export function CrossBorderCreateWizard({ onSuccess, onCancel }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState({
    referralType: "cross_border_outbound" as string,
    partnerOrgName: "",
    partnerCountry: "",
    language: "en" as string,
    jurisdiction: "",
    translationRequired: false,
    patientId: "",
    reason: "",
    consentGranted: false,
  });

  const createMutation = trpc.crossBorderReferral.create.useMutation({
    onSuccess: () => { toast.success("สร้างการส่งต่อข้ามเครือข่ายสำเร็จ"); onSuccess(); },
    onError: (e) => toast.error(e.message),
  });

  const progress = useMemo(() => ((step - 1) / 5) * 100, [step]);

  const canProceed = useMemo(() => {
    switch (step) {
      case 1: return !!form.referralType;
      case 2: return !!form.partnerOrgName;
      case 3: return !!form.patientId && !!form.reason;
      case 4: return !!form.language;
      case 5: return form.consentGranted;
      case 6: return true;
      default: return false;
    }
  }, [step, form]);

  const handleSubmit = () => {
    createMutation.mutate({
      referralType: form.referralType as any,
      partnerOrgName: form.partnerOrgName,
      partnerCountry: form.partnerCountry || undefined,
      language: form.language as any,
      jurisdiction: form.jurisdiction || undefined,
      translationRequired: form.translationRequired,
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>ขั้นตอน {step}/6</span>
          <span>{stepsMeta[step - 1].title}</span>
        </div>
        <Progress value={progress} className="h-1.5" />
      </div>

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
              {i < stepsMeta.length - 1 && <div className={`w-4 h-0.5 ${isCompleted ? "bg-emerald-500" : "bg-muted"}`} />}
            </div>
          );
        })}
      </div>

      {step === 1 && (
        <Card>
          <CardHeader><CardTitle className="text-base">เลือกทิศทางการส่งต่อ</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Select value={form.referralType} onValueChange={(v) => setForm((p) => ({ ...p, referralType: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cross_branch">ข้ามสาขา (Cross-branch)</SelectItem>
                <SelectItem value="cross_border_outbound">ส่งออกต่างประเทศ (Outbound)</SelectItem>
                <SelectItem value="cross_border_inbound">รับเข้าจากต่างประเทศ (Inbound)</SelectItem>
                <SelectItem value="external_partner">พันธมิตรภายนอก (External Partner)</SelectItem>
              </SelectContent>
            </Select>
            <div className="rounded-md border p-3 bg-muted/30">
              <p className="text-xs text-muted-foreground">
                {form.referralType === "cross_branch" && "ส่งต่อระหว่างสาขาภายในเครือข่าย TrustCare"}
                {form.referralType === "cross_border_outbound" && "ส่งผู้ป่วยไปรักษาต่อที่โรงพยาบาลต่างประเทศ"}
                {form.referralType === "cross_border_inbound" && "รับผู้ป่วยจากโรงพยาบาลต่างประเทศเข้ามารักษา"}
                {form.referralType === "external_partner" && "ส่งต่อไปยังโรงพยาบาลพันธมิตรที่ลงทะเบียนแล้ว"}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader><CardTitle className="text-base">ข้อมูลองค์กรพันธมิตร</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>ชื่อองค์กร/โรงพยาบาลพันธมิตร *</Label>
              <Input value={form.partnerOrgName} onChange={(e) => setForm((p) => ({ ...p, partnerOrgName: e.target.value }))} placeholder="เช่น Singapore General Hospital" />
            </div>
            <div className="space-y-2">
              <Label>ประเทศ</Label>
              <Input value={form.partnerCountry} onChange={(e) => setForm((p) => ({ ...p, partnerCountry: e.target.value }))} placeholder="เช่น Singapore, Japan" />
            </div>
            <div className="space-y-2">
              <Label>เขตอำนาจศาล (Jurisdiction)</Label>
              <Input value={form.jurisdiction} onChange={(e) => setForm((p) => ({ ...p, jurisdiction: e.target.value }))} placeholder="เช่น PDPA-TH, HIPAA-US" />
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader><CardTitle className="text-base">ข้อมูลผู้ป่วยและเหตุผล</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>รหัสผู้ป่วย *</Label>
              <Input value={form.patientId} onChange={(e) => setForm((p) => ({ ...p, patientId: e.target.value }))} type="number" placeholder="ระบุ ID ผู้ป่วย" />
            </div>
            <div className="space-y-2">
              <Label>เหตุผลการส่งต่อ *</Label>
              <Textarea value={form.reason} onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))} placeholder="ระบุเหตุผล เช่น ต้องการรักษาเฉพาะทาง..." rows={3} />
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <CardHeader><CardTitle className="text-base">ภาษาและการแปล</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>ภาษาหลักของเอกสาร</Label>
              <Select value={form.language} onValueChange={(v) => setForm((p) => ({ ...p, language: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="th">ไทย (Thai)</SelectItem>
                  <SelectItem value="en">อังกฤษ (English)</SelectItem>
                  <SelectItem value="zh">จีน (Chinese)</SelectItem>
                  <SelectItem value="ja">ญี่ปุ่น (Japanese)</SelectItem>
                  <SelectItem value="other">อื่นๆ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between p-3 rounded-md border">
              <div>
                <p className="text-sm font-medium">ต้องการแปลเอกสาร</p>
                <p className="text-xs text-muted-foreground">ระบบจะจัดเตรียมเอกสารแปลสำหรับโรงพยาบาลปลายทาง</p>
              </div>
              <Switch checked={form.translationRequired} onCheckedChange={(v) => setForm((p) => ({ ...p, translationRequired: v }))} />
            </div>
          </CardContent>
        </Card>
      )}

      {step === 5 && (
        <Card>
          <CardHeader><CardTitle className="text-base">ความยินยอมข้ามพรมแดน</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border p-4 bg-muted/30 space-y-3">
              <p className="text-sm font-medium">ข้อตกลงการส่งต่อข้อมูลข้ามพรมแดน</p>
              <ul className="text-xs text-muted-foreground space-y-1.5 list-disc list-inside">
                <li>ข้อมูลจะถูกส่งไปยังเขตอำนาจศาลของประเทศปลายทาง ({form.jurisdiction || form.partnerCountry || "ต่างประเทศ"})</li>
                <li>ข้อมูลจะถูกเข้ารหัสด้วย SHL (SMART Health Links) ตลอดการส่งต่อ</li>
                <li>เอกสารจะถูกตรวจสอบความถูกต้องด้วย Verifiable Credential (VC/VP)</li>
                <li>ผู้ป่วยสามารถเพิกถอนความยินยอมและเรียกคืนข้อมูลได้</li>
              </ul>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-md border">
              <Checkbox id="cross-consent" checked={form.consentGranted} onCheckedChange={(v) => setForm((p) => ({ ...p, consentGranted: !!v }))} />
              <label htmlFor="cross-consent" className="text-sm cursor-pointer leading-relaxed">
                ผู้ป่วยยินยอมให้ส่งข้อมูลทางการแพทย์ข้ามพรมแดนไปยัง {form.partnerOrgName || "องค์กรปลายทาง"}
              </label>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 6 && (
        <Card>
          <CardHeader><CardTitle className="text-base">ยืนยันการส่งต่อข้ามเครือข่าย</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-muted-foreground">ประเภท</p>
                <Badge>{form.referralType.replace(/_/g, " ")}</Badge>
              </div>
              <div><p className="text-xs text-muted-foreground">ภาษา</p><p className="font-medium">{form.language}</p></div>
              <div><p className="text-xs text-muted-foreground">องค์กรปลายทาง</p><p className="font-medium">{form.partnerOrgName}</p></div>
              <div><p className="text-xs text-muted-foreground">ประเทศ</p><p className="font-medium">{form.partnerCountry || "-"}</p></div>
            </div>
            {form.translationRequired && <Badge variant="outline"><Languages className="h-3 w-3 mr-1" />ต้องแปลเอกสาร</Badge>}
            <div className="flex items-center gap-2 text-xs text-emerald-600"><ShieldCheck className="h-4 w-4" /><span>ผู้ป่วยยินยอมข้ามพรมแดนแล้ว</span></div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" onClick={() => step === 1 ? onCancel?.() : setStep((s) => (s - 1) as Step)} disabled={createMutation.isPending}>
          <ArrowLeft className="h-4 w-4 mr-2" />{step === 1 ? "ยกเลิก" : "ย้อนกลับ"}
        </Button>
        {step < 6 ? (
          <Button onClick={() => setStep((s) => (s + 1) as Step)} disabled={!canProceed}>ถัดไป <ArrowRight className="h-4 w-4 ml-2" /></Button>
        ) : (
          <Button onClick={handleSubmit} disabled={createMutation.isPending}>
            {createMutation.isPending ? "กำลังสร้าง..." : "สร้างการส่งต่อ"}<Package className="h-4 w-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );
}
