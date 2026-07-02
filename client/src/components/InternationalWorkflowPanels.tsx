import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { FileText, Stethoscope, DollarSign, LogOut, Upload, CheckCircle2, Clock, AlertCircle } from "lucide-react";

interface Props {
  caseId: number | undefined;
  caseStatus?: string;
  onStatusUpdate?: () => void;
}

export function InternationalWorkflowPanels({ caseId, caseStatus, onStatusUpdate }: Props) {
  if (!caseId) return null;

  return (
    <Tabs defaultValue="documents" className="mt-4">
      <TabsList className="grid grid-cols-4 w-full">
        <TabsTrigger value="documents" className="text-xs"><FileText className="h-3.5 w-3.5 mr-1" />Document Intake</TabsTrigger>
        <TabsTrigger value="clinical" className="text-xs"><Stethoscope className="h-3.5 w-3.5 mr-1" />Clinical Review</TabsTrigger>
        <TabsTrigger value="financial" className="text-xs"><DollarSign className="h-3.5 w-3.5 mr-1" />Financial</TabsTrigger>
        <TabsTrigger value="discharge" className="text-xs"><LogOut className="h-3.5 w-3.5 mr-1" />Discharge</TabsTrigger>
      </TabsList>

      <TabsContent value="documents">
        <DocumentIntakePanel caseId={caseId} />
      </TabsContent>
      <TabsContent value="clinical">
        <ClinicalPreReviewPanel caseId={caseId} />
      </TabsContent>
      <TabsContent value="financial">
        <FinancialPanel caseId={caseId} />
      </TabsContent>
      <TabsContent value="discharge">
        <DischargePanel caseId={caseId} onStatusUpdate={onStatusUpdate} />
      </TabsContent>
    </Tabs>
  );
}

function DocumentIntakePanel({ caseId }: { caseId: number }) {
  const { data: docs, refetch } = trpc.international.listDocuments.useQuery({ caseId });
  const addDoc = trpc.international.addDocument.useMutation({
    onSuccess: () => { refetch(); toast.success("เพิ่มเอกสารสำเร็จ"); },
    onError: (e) => toast.error(e.message),
  });
  const verifyDoc = trpc.international.verifyDocument.useMutation({
    onSuccess: () => { refetch(); toast.success("อัพเดทสถานะเอกสาร"); },
    onError: (e) => toast.error(e.message),
  });
  const [docType, setDocType] = useState<string>("passport");
  const [fileName, setFileName] = useState("");

  const docTypeLabels: Record<string, string> = {
    passport: "หนังสือเดินทาง",
    insurance_card: "บัตรประกัน",
    referral_letter: "ใบส่งต่อ",
    lab_report: "ผล Lab",
    imaging_report: "ผลภาพถ่ายทางการแพทย์",
    medication_list: "รายการยา",
    medical_certificate: "ใบรับรองแพทย์",
    visa_support_letter: "หนังสือสนับสนุนวีซ่า",
    quotation: "ใบเสนอราคา",
    guarantee_letter: "หนังสือค้ำประกัน",
    other: "อื่นๆ",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Document Intake Workspace
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Document Form */}
        <div className="flex gap-2 items-end">
          <div className="flex-1 space-y-1">
            <Label className="text-xs">ประเภทเอกสาร</Label>
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(docTypeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 space-y-1">
            <Label className="text-xs">ชื่อไฟล์</Label>
            <Input className="h-8 text-xs" value={fileName} onChange={(e) => setFileName(e.target.value)} placeholder="passport_scan.pdf" />
          </div>
          <Button size="sm" className="h-8" onClick={() => {
            addDoc.mutate({ caseId, documentType: docType as any, fileName: fileName || undefined });
            setFileName("");
          }} disabled={addDoc.isPending}>
            <Upload className="h-3.5 w-3.5 mr-1" />เพิ่ม
          </Button>
        </div>

        {/* Document List */}
        <div className="space-y-2">
          {(docs ?? []).map((doc: any) => (
            <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
              <div className="flex items-center gap-3">
                <FileText className="h-4 w-4 text-blue-500" />
                <div>
                  <p className="text-sm font-medium">{doc.fileName || docTypeLabels[doc.documentType] || doc.documentType}</p>
                  <p className="text-xs text-muted-foreground">{docTypeLabels[doc.documentType]}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={doc.verificationStatus === "verified" ? "default" : doc.verificationStatus === "rejected" ? "destructive" : "secondary"}>
                  {doc.verificationStatus === "verified" ? "✓ ยืนยันแล้ว" : doc.verificationStatus === "rejected" ? "✗ ปฏิเสธ" : "รอตรวจสอบ"}
                </Badge>
                {doc.verificationStatus === "unverified" && (
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => verifyDoc.mutate({ id: doc.id, verificationStatus: "verified" })}>
                      <CheckCircle2 className="h-3 w-3 mr-1" />ยืนยัน
                    </Button>
                    <Button size="sm" variant="outline" className="h-6 text-xs text-destructive" onClick={() => verifyDoc.mutate({ id: doc.id, verificationStatus: "rejected", notes: "ไม่ผ่านเกณฑ์" })}>
                      ปฏิเสธ
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {(!docs || docs.length === 0) && (
            <div className="text-center py-6 text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">ยังไม่มีเอกสาร</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ClinicalPreReviewPanel({ caseId }: { caseId: number }) {
  const { data: caseData } = trpc.international.getCase.useQuery({ id: caseId });
  const updateCase = trpc.international.updateCase.useMutation({
    onSuccess: () => toast.success("บันทึกข้อมูลคลินิกสำเร็จ"),
    onError: (e) => toast.error(e.message),
  });
  const [notes, setNotes] = useState("");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Stethoscope className="h-4 w-4" />
          Clinical Pre-Review
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Service Line</Label>
            <p className="text-sm font-medium">{caseData?.serviceLine || "ยังไม่ระบุ"}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">สถานะปัจจุบัน</Label>
            <Badge variant="outline">{caseData?.status || "-"}</Badge>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-800">Checklist การตรวจสอบเบื้องต้น</span>
          </div>
          <ul className="space-y-1 text-xs text-amber-700">
            <li className="flex items-center gap-2"><input type="checkbox" className="rounded" /> ตรวจสอบประวัติการรักษาจากต้นทาง</li>
            <li className="flex items-center gap-2"><input type="checkbox" className="rounded" /> ยืนยันความพร้อมของแพทย์ผู้เชี่ยวชาญ</li>
            <li className="flex items-center gap-2"><input type="checkbox" className="rounded" /> ตรวจสอบผลตรวจ Lab / Imaging ล่าสุด</li>
            <li className="flex items-center gap-2"><input type="checkbox" className="rounded" /> ประเมินความเสี่ยงและข้อจำกัด</li>
            <li className="flex items-center gap-2"><input type="checkbox" className="rounded" /> ยืนยันแผนการรักษาเบื้องต้น</li>
          </ul>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">บันทึกทางคลินิก (Clinical Notes)</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="บันทึกผลการ pre-review, ข้อสังเกต, แผนการรักษาเบื้องต้น..."
            rows={4}
          />
          <Button size="sm" onClick={() => updateCase.mutate({ id: caseId, clinicalNotes: notes })} disabled={updateCase.isPending}>
            บันทึก Clinical Notes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function FinancialPanel({ caseId }: { caseId: number }) {
  const { data: caseData, refetch } = trpc.international.getCase.useQuery({ id: caseId });
  const updateCase = trpc.international.updateCase.useMutation({
    onSuccess: () => { refetch(); toast.success("บันทึกข้อมูลการเงินสำเร็จ"); },
    onError: (e) => toast.error(e.message),
  });
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("THB");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <DollarSign className="h-4 w-4" />
          Financial / Quotation Workflow
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">ประกันภัย</Label>
            <p className="text-sm">{caseData?.insuranceProvider || "ไม่มี / Self-pay"}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">ใบเสนอราคาปัจจุบัน</Label>
            <p className="text-sm font-medium">
              {caseData?.quotationAmount ? `${caseData.quotationAmount} ${caseData.quotationCurrency || "THB"}` : "ยังไม่ออกใบเสนอราคา"}
            </p>
          </div>
        </div>

        <div className="p-3 rounded-lg border bg-muted/30">
          <p className="text-xs font-medium mb-2">ออกใบเสนอราคา / อัพเดทจำนวนเงิน</p>
          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">จำนวนเงิน</Label>
              <Input className="h-8 text-xs" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="150000" />
            </div>
            <div className="w-24 space-y-1">
              <Label className="text-xs">สกุลเงิน</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="THB">THB</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="JPY">JPY</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" className="h-8" onClick={() => updateCase.mutate({ id: caseId, quotationAmount: amount, quotationCurrency: currency })} disabled={!amount || updateCase.isPending}>
              บันทึก
            </Button>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-800">ขั้นตอนการเงิน</span>
          </div>
          <ol className="space-y-1 text-xs text-blue-700 list-decimal list-inside">
            <li>ออกใบเสนอราคา (Quotation)</li>
            <li>ส่งให้ผู้ป่วย / ตัวแทนอนุมัติ</li>
            <li>ตรวจสอบประกัน (Insurance Review)</li>
            <li>ออก Guarantee Letter (ถ้ามี)</li>
            <li>รับชำระเงินมัดจำ</li>
            <li>ออกใบเสร็จ / สรุปค่าใช้จ่ายหลังรักษา</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}

function DischargePanel({ caseId, onStatusUpdate }: { caseId: number; onStatusUpdate?: () => void }) {
  const { data: caseData } = trpc.international.getCase.useQuery({ id: caseId });
  const updateStatus = trpc.international.updateStatus.useMutation({
    onSuccess: () => { onStatusUpdate?.(); toast.success("อัพเดทสถานะสำเร็จ"); },
    onError: (e) => toast.error(e.message),
  });

  const isDischargeReady = caseData?.status === "treatment_in_progress" || caseData?.status === "discharge_prepared";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <LogOut className="h-4 w-4" />
          Discharge Packet Generation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span className="text-sm font-medium text-emerald-800">Discharge Checklist</span>
          </div>
          <ul className="space-y-1 text-xs text-emerald-700">
            <li className="flex items-center gap-2"><input type="checkbox" className="rounded" /> สรุปผลการรักษา (Treatment Summary)</li>
            <li className="flex items-center gap-2"><input type="checkbox" className="rounded" /> ใบรับรองแพทย์ (Medical Certificate)</li>
            <li className="flex items-center gap-2"><input type="checkbox" className="rounded" /> รายการยาที่จ่าย (Medication List)</li>
            <li className="flex items-center gap-2"><input type="checkbox" className="rounded" /> แผนติดตามผล (Follow-up Plan)</li>
            <li className="flex items-center gap-2"><input type="checkbox" className="rounded" /> สรุปค่าใช้จ่าย (Final Invoice)</li>
            <li className="flex items-center gap-2"><input type="checkbox" className="rounded" /> เอกสารสำหรับเดินทางกลับ (Fit-to-fly Certificate)</li>
          </ul>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!isDischargeReady || updateStatus.isPending}
            onClick={() => updateStatus.mutate({ id: caseId, status: "discharge_prepared" })}
          >
            เตรียม Discharge Packet
          </Button>
          <Button
            size="sm"
            disabled={caseData?.status !== "discharge_prepared" || updateStatus.isPending}
            onClick={() => updateStatus.mutate({ id: caseId, status: "follow_up_scheduled" })}
          >
            ส่ง Discharge + นัด Follow-up
          </Button>
        </div>

        {!isDischargeReady && (
          <p className="text-xs text-muted-foreground">
            * Discharge panel จะพร้อมใช้งานเมื่อเคสอยู่ในสถานะ "กำลังรักษา" หรือ "เตรียม Discharge"
          </p>
        )}
      </CardContent>
    </Card>
  );
}
