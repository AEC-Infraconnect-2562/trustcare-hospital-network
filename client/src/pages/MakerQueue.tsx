import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  FilePlus,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  Ban,
  AlertTriangle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const statusConfig: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    icon: any;
  }
> = {
  draft: { label: "ร่าง", variant: "secondary", icon: Clock },
  pending_review: {
    label: "รอตรวจสอบ",
    variant: "default",
    icon: AlertTriangle,
  },
  approved: { label: "อนุมัติแล้ว", variant: "default", icon: CheckCircle2 },
  rejected: { label: "ปฏิเสธ", variant: "destructive", icon: XCircle },
  issued: { label: "ออก VC แล้ว", variant: "default", icon: CheckCircle2 },
  cancelled: { label: "ยกเลิก", variant: "secondary", icon: Ban },
};

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
  claim_package: "แพ็คเกจเคลม",
  sync_receipt: "ใบรับรอง Sync",
};

export default function MakerQueue() {
  const {
    data: requests,
    isLoading,
    refetch,
  } = trpc.makerChecker.myRequests.useQuery();
  const { data: templates } = trpc.credential.templates.useQuery({});
  const { data: hospitals } = trpc.hospital.list.useQuery();
  const [createOpen, setCreateOpen] = useState(false);

  const submitMutation = trpc.makerChecker.submitForReview.useMutation({
    onSuccess: () => {
      toast.success("ส่งคำขอตรวจสอบสำเร็จ");
      refetch();
    },
    onError: e => toast.error(e.message),
  });

  const cancelMutation = trpc.makerChecker.cancelRequest.useMutation({
    onSuccess: () => {
      toast.success("ยกเลิกคำขอสำเร็จ");
      refetch();
    },
    onError: e => toast.error(e.message),
  });

  const draftRequests =
    requests?.filter((r: any) => r.status === "draft") || [];
  const pendingRequests =
    requests?.filter((r: any) => r.status === "pending_review") || [];
  const completedRequests =
    requests?.filter((r: any) =>
      ["approved", "rejected", "issued", "cancelled"].includes(r.status)
    ) || [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              สร้างคำขอออก VC (Maker)
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              สร้างคำขอออกใบรับรองดิจิทัล แล้วส่งให้ Checker ตรวจสอบ
            </p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <FilePlus className="h-4 w-4 mr-2" />
                สร้างคำขอใหม่
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>สร้างคำขอออก VC ใหม่</DialogTitle>
              </DialogHeader>
              <CreateRequestForm
                templates={templates || []}
                hospitals={hospitals || []}
                onSuccess={() => {
                  setCreateOpen(false);
                  refetch();
                }}
              />
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                <Clock className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{draftRequests.length}</p>
                <p className="text-xs text-muted-foreground">ร่าง</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingRequests.length}</p>
                <p className="text-xs text-muted-foreground">รอตรวจสอบ</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {
                    completedRequests.filter((r: any) => r.status === "issued")
                      .length
                  }
                </p>
                <p className="text-xs text-muted-foreground">ออก VC แล้ว</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                <XCircle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {
                    completedRequests.filter(
                      (r: any) => r.status === "rejected"
                    ).length
                  }
                </p>
                <p className="text-xs text-muted-foreground">ถูกปฏิเสธ</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="draft">
          <TabsList>
            <TabsTrigger value="draft">
              ร่าง ({draftRequests.length})
            </TabsTrigger>
            <TabsTrigger value="pending">
              รอตรวจสอบ ({pendingRequests.length})
            </TabsTrigger>
            <TabsTrigger value="completed">
              เสร็จสิ้น ({completedRequests.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="draft" className="mt-4">
            <RequestTable
              requests={draftRequests}
              isLoading={isLoading}
              templates={templates || []}
              actions={(req: any) => (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => submitMutation.mutate({ id: req.id })}
                    disabled={submitMutation.isPending}
                  >
                    <Send className="h-3 w-3 mr-1" />
                    ส่งตรวจ
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => cancelMutation.mutate({ id: req.id })}
                    disabled={cancelMutation.isPending}
                  >
                    ยกเลิก
                  </Button>
                </div>
              )}
            />
          </TabsContent>

          <TabsContent value="pending" className="mt-4">
            <RequestTable
              requests={pendingRequests}
              isLoading={isLoading}
              templates={templates || []}
            />
          </TabsContent>

          <TabsContent value="completed" className="mt-4">
            <RequestTable
              requests={completedRequests}
              isLoading={isLoading}
              templates={templates || []}
              showChecker
            />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

function RequestTable({
  requests,
  isLoading,
  templates,
  actions,
  showChecker,
}: {
  requests: any[];
  isLoading: boolean;
  templates: any[];
  actions?: (req: any) => React.ReactNode;
  showChecker?: boolean;
}) {
  if (isLoading)
    return (
      <div className="text-center py-8 text-muted-foreground">กำลังโหลด...</div>
    );
  if (!requests.length)
    return (
      <div className="text-center py-8 text-muted-foreground">ไม่มีรายการ</div>
    );

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>เลขคำขอ</TableHead>
            <TableHead>ประเภท</TableHead>
            <TableHead>ผู้ป่วย ID</TableHead>
            <TableHead>สถานะ</TableHead>
            <TableHead>ลำดับความสำคัญ</TableHead>
            {showChecker && <TableHead>ผู้ตรวจสอบ</TableHead>}
            <TableHead>วันที่สร้าง</TableHead>
            {actions && <TableHead>การดำเนินการ</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.map((req: any) => {
            const template = templates.find(
              (t: any) => t.id === req.templateId
            );
            const status = statusConfig[req.status] || statusConfig.draft;
            const StatusIcon = status.icon;
            return (
              <TableRow key={req.id}>
                <TableCell className="font-mono text-sm">
                  {req.requestNumber}
                </TableCell>
                <TableCell>
                  {template?.name ||
                    typeLabels[template?.type] ||
                    `Template #${req.templateId}`}
                </TableCell>
                <TableCell>{req.patientId}</TableCell>
                <TableCell>
                  <Badge variant={status.variant} className="gap-1">
                    <StatusIcon className="h-3 w-3" />
                    {status.label}
                  </Badge>
                </TableCell>
                <TableCell>
                  {req.priority === "urgent" ? (
                    <Badge variant="destructive">เร่งด่วน</Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">ปกติ</span>
                  )}
                </TableCell>
                {showChecker && (
                  <TableCell>
                    {req.checkerId ? `User #${req.checkerId}` : "-"}
                  </TableCell>
                )}
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(req.createdAt).toLocaleDateString("th-TH", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </TableCell>
                {actions && <TableCell>{actions(req)}</TableCell>}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function CreateRequestForm({
  templates,
  hospitals,
  onSuccess,
}: {
  templates: any[];
  hospitals: any[];
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    templateId: "",
    patientId: "",
    hospitalId: "",
    makerNotes: "",
    priority: "normal" as "normal" | "urgent",
  });
  const { data: patients } = trpc.shl.patientOptions.useQuery();

  const createMutation = trpc.makerChecker.createRequest.useMutation({
    onSuccess: () => {
      toast.success("สร้างคำขอสำเร็จ");
      onSuccess();
    },
    onError: e => toast.error(e.message),
  });

  useEffect(() => {
    if (!form.hospitalId && hospitals[0]?.id) {
      setForm(previous => ({
        ...previous,
        hospitalId: String(hospitals[0].id),
      }));
    }
  }, [form.hospitalId, hospitals]);

  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        const selectedTemplate = templates.find(
          (t: any) => String(t.id) === form.templateId
        );
        createMutation.mutate({
          templateId: Number(form.templateId),
          patientId: Number(form.patientId),
          hospitalId: form.hospitalId ? Number(form.hospitalId) : 0,
          credentialType: selectedTemplate?.type || "patient_summary",
          makerNotes: form.makerNotes || undefined,
          priority: form.priority,
          requestData: {
            issuedVia: "maker-checker-workflow",
            requestedAt: new Date().toISOString(),
          },
        });
      }}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label>
          เทมเพลตใบรับรอง <span className="text-destructive">*</span>
        </Label>
        <Select
          value={form.templateId}
          onValueChange={v => setForm(p => ({ ...p, templateId: v }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="เลือกเทมเพลต" />
          </SelectTrigger>
          <SelectContent>
            {templates.map((t: any) => (
              <SelectItem key={t.id} value={String(t.id)}>
                {t.name} ({typeLabels[t.type] || t.type})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>
          รหัสผู้ป่วย (User ID) <span className="text-destructive">*</span>
        </Label>
        <Select
          value={form.patientId}
          onValueChange={v => setForm(p => ({ ...p, patientId: v }))}
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
          value={form.hospitalId}
          onValueChange={v => setForm(p => ({ ...p, hospitalId: v }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="เลือกโรงพยาบาล" />
          </SelectTrigger>
          <SelectContent>
            {hospitals.map((h: any) => (
              <SelectItem key={h.id} value={String(h.id)}>
                {h.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>ลำดับความสำคัญ</Label>
        <Select
          value={form.priority}
          onValueChange={v =>
            setForm(p => ({ ...p, priority: v as "normal" | "urgent" }))
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="normal">ปกติ</SelectItem>
            <SelectItem value="urgent">เร่งด่วน</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>หมายเหตุ (สำหรับ Checker)</Label>
        <Textarea
          value={form.makerNotes}
          onChange={e => setForm(p => ({ ...p, makerNotes: e.target.value }))}
          placeholder="ระบุรายละเอียดเพิ่มเติม..."
          rows={3}
        />
      </div>
      <DialogFooter>
        <Button
          type="submit"
          className="w-full"
          disabled={
            !form.templateId || !form.patientId || createMutation.isPending
          }
        >
          {createMutation.isPending ? "กำลังสร้าง..." : "สร้างคำขอ (Draft)"}
        </Button>
      </DialogFooter>
    </form>
  );
}
