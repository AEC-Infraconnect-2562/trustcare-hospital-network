import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import {
  BadgeCheck,
  Plus,
  FileText,
  Ban,
  Clock,
  ClipboardCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const typeLabels: Record<string, string> = {
  patient_identity: "บัตรประจำตัวผู้ป่วย",
  consent_receipt: "ใบรับรองความยินยอม",
  patient_summary: "สรุปข้อมูลผู้ป่วย",
  allergy_alert: "แจ้งเตือนการแพ้",
  medication_summary: "สรุปยาที่ใช้",
  referral_vc: "ใบส่งต่อ",
  immunization: "ประวัติวัคซีน",
  medical_certificate: "ใบรับรองแพทย์",
  prescription: "ใบสั่งยา",
  lab_result: "ผลตรวจห้องปฏิบัติการ",
  diagnostic_report: "รายงานวินิจฉัย",
  discharge_summary: "สรุปจำหน่าย",
  insurance_eligibility: "ตรวจสอบสิทธิประกัน",
  claim_package: "ชุดเอกสาร E-Claim",
  claim_receipt: "ใบรับเรื่องเคลม",
  travel_document_verification: "เอกสารยืนยันเพื่อเดินทาง",
  shl_manifest: "Smart Health Link Manifest",
  pharmacy_dispense: "จ่ายยา",
  appointment: "ใบนัดหมาย",
  visa_support_letter: "หนังสือประกอบวีซ่า",
  quotation: "ใบเสนอราคา",
  guarantee_letter: "หนังสือรับรองค่าใช้จ่าย",
  mpi_link_certificate: "ใบรับรองการเชื่อม MPI",
  sync_receipt: "หลักฐาน Sync กลับ HIS",
};

const statusLabels: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" }
> = {
  active: { label: "ใช้งาน", variant: "default" },
  revoked: { label: "เพิกถอน", variant: "destructive" },
  expired: { label: "หมดอายุ", variant: "secondary" },
  suspended: { label: "ระงับ", variant: "secondary" },
};

const requestStatusLabels: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" }
> = {
  submitted: { label: "รอ Checker", variant: "secondary" },
  changes_requested: { label: "ขอแก้ไข", variant: "secondary" },
  approved: { label: "อนุมัติแล้ว", variant: "secondary" },
  issued: { label: "ออก VC แล้ว", variant: "default" },
  rejected: { label: "ปฏิเสธ", variant: "destructive" },
};

export default function Issuer() {
  const [, setLocation] = useLocation();
  const {
    data: credentials,
    isLoading,
    refetch,
  } = trpc.credential.list.useQuery({});
  const { data: templates } = trpc.credential.templates.useQuery({});
  const { data: requests, refetch: refetchRequests } =
    trpc.credential.issuanceRequests.useQuery({ limit: 50 });
  const [issueOpen, setIssueOpen] = useState(false);
  const [revokeId, setRevokeId] = useState<number | null>(null);
  const [revokeReason, setRevokeReason] = useState("");

  const revokeMutation = trpc.credential.revoke.useMutation({
    onSuccess: () => {
      toast.success("เพิกถอนใบรับรองสำเร็จ");
      setRevokeId(null);
      setRevokeReason("");
      refetch();
    },
    onError: e => toast.error(e.message),
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              ออกใบรับรอง
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              VC Issuer Portal - Maker ส่งคำขอ และ Checker ออก Verifiable
              Credentials จริง
            </p>
          </div>
          <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                สร้างคำขอ VC
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>สร้างคำขอออก VC</DialogTitle>
              </DialogHeader>
              <IssueCredentialForm
                templates={templates || []}
                onSuccess={() => {
                  setIssueOpen(false);
                  refetchRequests();
                }}
              />
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="issued">
          <TabsList>
            <TabsTrigger value="issued" className="gap-2">
              <BadgeCheck className="h-3.5 w-3.5" />
              ใบรับรองที่ออก
            </TabsTrigger>
            <TabsTrigger value="requests" className="gap-2">
              <ClipboardCheck className="h-3.5 w-3.5" />
              คำขอ Maker/Checker
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-2">
              <FileText className="h-3.5 w-3.5" />
              เทมเพลต
            </TabsTrigger>
          </TabsList>

          <TabsContent value="issued" className="mt-4">
            <Card>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="p-8 text-center text-muted-foreground">
                    กำลังโหลด...
                  </div>
                ) : credentials && credentials.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ประเภท</TableHead>
                        <TableHead>Credential ID</TableHead>
                        <TableHead>สถานะ</TableHead>
                        <TableHead>วันที่ออก</TableHead>
                        <TableHead>หมดอายุ</TableHead>
                        <TableHead className="text-right">จัดการ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...credentials]
                        .sort((a: any, b: any) => {
                          const identityTypes = [
                            "patient_identity",
                            "identity",
                          ];
                          const aIsIdentity = identityTypes.includes(a.type)
                            ? 0
                            : 1;
                          const bIsIdentity = identityTypes.includes(b.type)
                            ? 0
                            : 1;
                          return aIsIdentity - bIsIdentity;
                        })
                        .map((cred: any) => {
                          const status =
                            statusLabels[cred.status] || statusLabels.active;
                          return (
                            <TableRow
                              key={cred.id}
                              className="cursor-pointer hover:bg-muted/50 transition-colors"
                              onClick={() => setLocation(`/issuer/${cred.id}`)}
                            >
                              <TableCell className="font-medium text-sm">
                                {typeLabels[cred.type] || cred.type}
                              </TableCell>
                              <TableCell className="font-mono text-xs text-muted-foreground">
                                {cred.credentialId.slice(0, 20)}...
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={status.variant}
                                  className="text-[10px]"
                                >
                                  {status.label}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm">
                                {new Date(cred.issuedAt).toLocaleDateString(
                                  "th-TH"
                                )}
                              </TableCell>
                              <TableCell className="text-sm">
                                {cred.expiresAt
                                  ? new Date(cred.expiresAt).toLocaleDateString(
                                      "th-TH"
                                    )
                                  : "—"}
                              </TableCell>
                              <TableCell className="text-right">
                                {cred.status === "active" && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-destructive h-7 text-xs"
                                    onClick={e => {
                                      e.stopPropagation();
                                      setRevokeId(cred.id);
                                    }}
                                  >
                                    <Ban className="h-3 w-3 mr-1" />
                                    เพิกถอน
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="flex flex-col items-center py-16">
                    <BadgeCheck className="h-12 w-12 text-muted-foreground/30 mb-4" />
                    <p className="text-muted-foreground">
                      ยังไม่มีใบรับรองที่ออก
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="requests" className="mt-4">
            <Card>
              <CardContent className="p-0">
                {requests && requests.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ประเภท</TableHead>
                        <TableHead>Request ID</TableHead>
                        <TableHead>Maker</TableHead>
                        <TableHead>Checker</TableHead>
                        <TableHead>สถานะ</TableHead>
                        <TableHead>วันที่ส่ง</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {requests.map((request: any) => {
                        const status =
                          requestStatusLabels[request.status] ||
                          requestStatusLabels.submitted;
                        return (
                          <TableRow key={request.id}>
                            <TableCell className="font-medium text-sm">
                              {typeLabels[request.type] || request.type}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {request.requestId?.slice(0, 32)}...
                            </TableCell>
                            <TableCell className="text-sm">
                              {request.makerRole || request.makerId || "-"}
                            </TableCell>
                            <TableCell className="text-sm">
                              {request.checkerRole || request.checkerId || "-"}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={status.variant}
                                className="text-[10px]"
                              >
                                {status.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {request.submittedAt
                                ? new Date(
                                    request.submittedAt
                                  ).toLocaleDateString("th-TH")
                                : "-"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="flex flex-col items-center py-16">
                    <ClipboardCheck className="h-12 w-12 text-muted-foreground/30 mb-4" />
                    <p className="text-muted-foreground">
                      ยังไม่มีคำขอจาก Maker
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="templates" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates?.map((t: any) => (
                <Card key={t.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-medium text-sm">{t.name}</h3>
                        <p className="text-xs text-muted-foreground">
                          {typeLabels[t.type] || t.type}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>อายุ {t.validityDays} วัน</span>
                      <Badge
                        variant="secondary"
                        className="text-[10px] ml-auto"
                      >
                        v{t.version}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              )) || (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                  ยังไม่มีเทมเพลต
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Revoke Dialog */}
        <Dialog open={!!revokeId} onOpenChange={() => setRevokeId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>เพิกถอนใบรับรอง</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                กรุณาระบุเหตุผลในการเพิกถอน
              </p>
              <Input
                value={revokeReason}
                onChange={e => setRevokeReason(e.target.value)}
                placeholder="เหตุผล..."
              />
              <Button
                variant="destructive"
                className="w-full"
                disabled={!revokeReason || revokeMutation.isPending}
                onClick={() =>
                  revokeId &&
                  revokeMutation.mutate({ id: revokeId, reason: revokeReason })
                }
              >
                {revokeMutation.isPending
                  ? "กำลังดำเนินการ..."
                  : "ยืนยันเพิกถอน"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

function IssueCredentialForm({
  templates,
  onSuccess,
}: {
  templates: any[];
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    templateId: "",
    subjectId: "",
    type: "patient_identity" as string,
    issuerHospitalId: "",
  });
  const { data: hospitals } = trpc.hospital.list.useQuery();
  const { data: patients } = trpc.shl.patientOptions.useQuery();
  const issueMutation = trpc.credential.issue.useMutation({
    onSuccess: () => {
      toast.success("ส่งคำขอให้ Checker ตรวจและออก VC แล้ว");
      onSuccess();
    },
    onError: e => toast.error(e.message),
  });

  useEffect(() => {
    if (!form.issuerHospitalId && hospitals?.[0]?.id) {
      setForm(previous => ({
        ...previous,
        issuerHospitalId: String(hospitals[0].id),
      }));
    }
  }, [form.issuerHospitalId, hospitals]);

  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        issueMutation.mutate({
          templateId: Number(form.templateId) || undefined,
          subjectId: Number(form.subjectId),
          type: form.type as any,
          issuerHospitalId: Number(form.issuerHospitalId),
          credentialData: { issuedVia: "trustcare-portal" },
        });
      }}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label>ประเภทใบรับรอง</Label>
        <Select
          value={form.type}
          onValueChange={v => setForm(p => ({ ...p, type: v }))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(typeLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>เทมเพลต</Label>
        <Select
          value={form.templateId}
          onValueChange={v => setForm(p => ({ ...p, templateId: v }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="เลือกเทมเพลต หรือให้ระบบใช้ค่าเริ่มต้น" />
          </SelectTrigger>
          <SelectContent>
            {templates
              .filter((template: any) => template.type === form.type && (!form.issuerHospitalId || !template.hospitalId || String(template.hospitalId) === form.issuerHospitalId))
              .map((template: any) => (
                <SelectItem key={template.id} value={String(template.id)}>
                  {template.name} v{template.version}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>รหัสผู้ป่วย (User ID)</Label>
        <Select
          value={form.subjectId}
          onValueChange={v => setForm(p => ({ ...p, subjectId: v }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select patient" />
          </SelectTrigger>
          <SelectContent>
            {(patients ?? []).map((patient: any) => (
              <SelectItem key={patient.id} value={String(patient.id)}>
                {patient.name || patient.email || `Patient #${patient.id}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>โรงพยาบาลผู้ออก</Label>
        <Select
          value={form.issuerHospitalId}
          onValueChange={v => setForm(p => ({ ...p, issuerHospitalId: v }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="เลือกโรงพยาบาล" />
          </SelectTrigger>
          <SelectContent>
            {hospitals?.map((h: any) => (
              <SelectItem key={h.id} value={String(h.id)}>
                {h.name}
              </SelectItem>
            )) || <SelectItem value="1">โรงพยาบาล</SelectItem>}
          </SelectContent>
        </Select>
      </div>
      <Button
        type="submit"
        className="w-full"
        disabled={
          !form.subjectId || !form.issuerHospitalId || issueMutation.isPending
        }
      >
        {issueMutation.isPending ? "กำลังส่งคำขอ..." : "ส่งคำขอให้ Checker"}
      </Button>
    </form>
  );
}
