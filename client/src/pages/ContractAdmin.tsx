import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { readinessContextValues, type ReadinessContext } from "@shared/readiness";
import {
  Edit2,
  FileStack,
  Layers,
  Plus,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const contextLabels: Record<ReadinessContext, string> = {
  opd_visit: "OPD Visit",
  emergency: "Emergency",
  referral: "Referral",
  cross_border: "Cross-border",
  medical_tourist: "Medical Tourist",
  insurance_claim: "Insurance Claim",
  pharmacy_dispense: "Pharmacy Dispense",
};

const statusColors: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  draft: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  deprecated: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

interface ContractFormData {
  contractId: string;
  context: ReadinessContext;
  version: string;
  status: "active" | "draft" | "deprecated";
  patientLabel: string;
  patientLabelEn: string;
  hospitalLabel: string;
  hospitalLabelEn: string;
  patientVisible: boolean;
  hospitalVisible: boolean;
  patientBundleType: string;
  hospitalBundleType: string;
  requirementsJson: string;
  questionnaireJson: string;
  consentPolicyJson: string;
}

const emptyForm: ContractFormData = {
  contractId: "",
  context: "opd_visit",
  version: "1.0.0",
  status: "draft",
  patientLabel: "",
  patientLabelEn: "",
  hospitalLabel: "",
  hospitalLabelEn: "",
  patientVisible: true,
  hospitalVisible: true,
  patientBundleType: "patient_readiness_bundle",
  hospitalBundleType: "hospital_readiness_bundle",
  requirementsJson: "[]",
  questionnaireJson: "{}",
  consentPolicyJson: "{}",
};

export default function ContractAdmin() {
  const [tab, setTab] = useState("contracts");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ContractFormData>(emptyForm);

  const contractsQuery = trpc.contractAdmin.list.useQuery();
  const templatesQuery = trpc.contractAdmin.listTemplates.useQuery({});
  const createMutation = trpc.contractAdmin.create.useMutation({
    onSuccess: () => {
      toast.success("สร้างสัญญาบริการสำเร็จ");
      contractsQuery.refetch();
      setShowForm(false);
      resetForm();
    },
    onError: (err) => toast.error(err.message),
  });
  const updateMutation = trpc.contractAdmin.update.useMutation({
    onSuccess: () => {
      toast.success("อัปเดตสัญญาบริการสำเร็จ");
      contractsQuery.refetch();
      setShowForm(false);
      resetForm();
    },
    onError: (err) => toast.error(err.message),
  });
  const deleteMutation = trpc.contractAdmin.delete.useMutation({
    onSuccess: () => {
      toast.success("ลบสัญญาบริการสำเร็จ (deprecated)");
      contractsQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  function openCreate() {
    resetForm();
    setShowForm(true);
  }

  function openEdit(contract: any) {
    setEditingId(contract.id);
    setForm({
      contractId: contract.contractId,
      context: contract.context,
      version: contract.version,
      status: contract.status,
      patientLabel: contract.patientLabel,
      patientLabelEn: contract.patientLabelEn,
      hospitalLabel: contract.hospitalLabel,
      hospitalLabelEn: contract.hospitalLabelEn,
      patientVisible: contract.patientVisible ?? true,
      hospitalVisible: contract.hospitalVisible ?? true,
      patientBundleType: contract.patientBundleType,
      hospitalBundleType: contract.hospitalBundleType,
      requirementsJson: JSON.stringify(contract.requirementsJson ?? [], null, 2),
      questionnaireJson: JSON.stringify(contract.questionnaireJson ?? {}, null, 2),
      consentPolicyJson: JSON.stringify(contract.consentPolicyJson ?? {}, null, 2),
    });
    setShowForm(true);
  }

  function handleSubmit() {
    // Validate JSON fields
    let requirementsJson: any, questionnaireJson: any, consentPolicyJson: any;
    try {
      requirementsJson = JSON.parse(form.requirementsJson);
    } catch {
      toast.error("Requirements JSON ไม่ถูกต้อง");
      return;
    }
    try {
      questionnaireJson = JSON.parse(form.questionnaireJson);
    } catch {
      toast.error("Questionnaire JSON ไม่ถูกต้อง");
      return;
    }
    try {
      consentPolicyJson = JSON.parse(form.consentPolicyJson);
    } catch {
      toast.error("Consent Policy JSON ไม่ถูกต้อง");
      return;
    }

    const payload = {
      ...form,
      requirementsJson,
      questionnaireJson,
      consentPolicyJson,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const contracts = contractsQuery.data ?? [];
  const templates = templatesQuery.data ?? [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <FileStack className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">จัดการสัญญาบริการ</h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Contract Admin — จัดการ Service Readiness Contracts และ Bundle Templates
            </p>
          </div>
          <Button className="gap-2" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            สร้างสัญญาใหม่
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="contracts" className="gap-2">
              <FileStack className="h-4 w-4" />
              Contracts ({contracts.length})
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-2">
              <Layers className="h-4 w-4" />
              Bundle Templates ({templates.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="contracts" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contract ID</TableHead>
                      <TableHead>Context</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Patient Label</TableHead>
                      <TableHead>Hospital Label</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contracts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                          ยังไม่มีสัญญาบริการ — กดปุ่ม "สร้างสัญญาใหม่" เพื่อเริ่มต้น
                        </TableCell>
                      </TableRow>
                    ) : (
                      contracts.map((contract: any) => (
                        <TableRow key={contract.id}>
                          <TableCell className="font-mono text-sm">{contract.contractId}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{contextLabels[contract.context as ReadinessContext] ?? contract.context}</Badge>
                          </TableCell>
                          <TableCell>{contract.version}</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[contract.status] ?? ""}`}>
                              {contract.status}
                            </span>
                          </TableCell>
                          <TableCell className="max-w-[160px] truncate">{contract.patientLabel}</TableCell>
                          <TableCell className="max-w-[160px] truncate">{contract.hospitalLabel}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => openEdit(contract)}>
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => {
                                  if (confirm("ต้องการลบ (deprecate) สัญญานี้หรือไม่?")) {
                                    deleteMutation.mutate({ id: contract.id });
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="templates" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Template ID</TableHead>
                      <TableHead>Contract</TableHead>
                      <TableHead>Audience</TableHead>
                      <TableHead>Bundle Type</TableHead>
                      <TableHead>Direction</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                          ยังไม่มี Bundle Templates
                        </TableCell>
                      </TableRow>
                    ) : (
                      templates.map((tpl: any) => (
                        <TableRow key={tpl.id}>
                          <TableCell className="font-mono text-sm">{tpl.templateId}</TableCell>
                          <TableCell className="font-mono text-xs">{tpl.contractId}</TableCell>
                          <TableCell>
                            <Badge variant={tpl.audience === "patient" ? "default" : "secondary"}>{tpl.audience}</Badge>
                          </TableCell>
                          <TableCell>{tpl.bundleType}</TableCell>
                          <TableCell>{tpl.direction}</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[tpl.status] ?? ""}`}>
                              {tpl.status}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Create/Edit Dialog */}
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "แก้ไขสัญญาบริการ" : "สร้างสัญญาบริการใหม่"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="contractId">Contract ID *</Label>
                  <Input
                    id="contractId"
                    value={form.contractId}
                    onChange={(e) => setForm({ ...form, contractId: e.target.value })}
                    placeholder="e.g. opd_readiness_v1"
                    disabled={!!editingId}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="context">Context *</Label>
                  <Select value={form.context} onValueChange={(v) => setForm({ ...form, context: v as ReadinessContext })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {readinessContextValues.map((ctx) => (
                        <SelectItem key={ctx} value={ctx}>{contextLabels[ctx]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="version">Version</Label>
                  <Input
                    id="version"
                    value={form.version}
                    onChange={(e) => setForm({ ...form, version: e.target.value })}
                    placeholder="1.0.0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as any })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="deprecated">Deprecated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Visibility</Label>
                  <div className="flex items-center gap-4 pt-2">
                    <div className="flex items-center gap-2">
                      <Switch checked={form.patientVisible} onCheckedChange={(v) => setForm({ ...form, patientVisible: v })} />
                      <span className="text-xs">Patient</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={form.hospitalVisible} onCheckedChange={(v) => setForm({ ...form, hospitalVisible: v })} />
                      <span className="text-xs">Hospital</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="patientLabel">Patient Label (TH) *</Label>
                  <Input
                    id="patientLabel"
                    value={form.patientLabel}
                    onChange={(e) => setForm({ ...form, patientLabel: e.target.value })}
                    placeholder="เตรียมเอกสารตรวจผู้ป่วยนอก"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="patientLabelEn">Patient Label (EN) *</Label>
                  <Input
                    id="patientLabelEn"
                    value={form.patientLabelEn}
                    onChange={(e) => setForm({ ...form, patientLabelEn: e.target.value })}
                    placeholder="OPD Readiness"
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="hospitalLabel">Hospital Label (TH) *</Label>
                  <Input
                    id="hospitalLabel"
                    value={form.hospitalLabel}
                    onChange={(e) => setForm({ ...form, hospitalLabel: e.target.value })}
                    placeholder="ตรวจสอบเอกสารผู้ป่วยนอก"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hospitalLabelEn">Hospital Label (EN) *</Label>
                  <Input
                    id="hospitalLabelEn"
                    value={form.hospitalLabelEn}
                    onChange={(e) => setForm({ ...form, hospitalLabelEn: e.target.value })}
                    placeholder="OPD Intake Verification"
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="patientBundleType">Patient Bundle Type</Label>
                  <Input
                    id="patientBundleType"
                    value={form.patientBundleType}
                    onChange={(e) => setForm({ ...form, patientBundleType: e.target.value })}
                    placeholder="patient_readiness_bundle"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hospitalBundleType">Hospital Bundle Type</Label>
                  <Input
                    id="hospitalBundleType"
                    value={form.hospitalBundleType}
                    onChange={(e) => setForm({ ...form, hospitalBundleType: e.target.value })}
                    placeholder="hospital_readiness_bundle"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="requirementsJson">Requirements JSON</Label>
                <Textarea
                  id="requirementsJson"
                  value={form.requirementsJson}
                  onChange={(e) => setForm({ ...form, requirementsJson: e.target.value })}
                  rows={4}
                  className="font-mono text-xs"
                  placeholder="[]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="questionnaireJson">Questionnaire JSON</Label>
                <Textarea
                  id="questionnaireJson"
                  value={form.questionnaireJson}
                  onChange={(e) => setForm({ ...form, questionnaireJson: e.target.value })}
                  rows={4}
                  className="font-mono text-xs"
                  placeholder="{}"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="consentPolicyJson">Consent Policy JSON</Label>
                <Textarea
                  id="consentPolicyJson"
                  value={form.consentPolicyJson}
                  onChange={(e) => setForm({ ...form, consentPolicyJson: e.target.value })}
                  rows={4}
                  className="font-mono text-xs"
                  placeholder="{}"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowForm(false)}>ยกเลิก</Button>
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending ? "กำลังบันทึก..." : editingId ? "อัปเดต" : "สร้าง"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
