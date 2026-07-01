import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { Edit3, Shield, User, Users as UsersIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { canHoldIssuerPrivileges } from "@shared/rolePolicy";

const roleLabels: Record<string, string> = {
  system_admin: "ผู้ดูแลระบบ",
  hospital_admin: "ผู้ดูแลโรงพยาบาล",
  maker: "Maker",
  checker: "Checker",
  doctor: "แพทย์",
  nurse: "พยาบาล",
  integration_engineer: "วิศวกรระบบ",
  patient: "ผู้ป่วย",
};

const documentTypes = [
  ["patient_identity", "บัตรคนไข้"],
  ["consent_receipt", "ใบรับรองความยินยอม"],
  ["patient_summary", "สรุปข้อมูลผู้ป่วย"],
  ["allergy_alert", "แจ้งเตือนการแพ้"],
  ["medication_summary", "สรุปรายการยา"],
  ["referral_vc", "ใบส่งต่อ"],
  ["immunization", "ประวัติวัคซีน"],
  ["medical_certificate", "ใบรับรองแพทย์"],
  ["prescription", "ใบสั่งยา"],
  ["lab_result", "ผลแล็บ"],
  ["diagnostic_report", "รายงานวินิจฉัย"],
  ["discharge_summary", "สรุปจำหน่าย"],
  ["insurance_eligibility", "ยืนยันสิทธิ์"],
  ["claim_package", "ชุดเอกสารเคลม"],
  ["claim_receipt", "ใบรับเคลม"],
  ["travel_document_verification", "เอกสาร Medical Tourist"],
  ["shl_manifest", "SHL Manifest"],
  ["pharmacy_dispense", "บันทึกจ่ายยา"],
  ["appointment", "ใบนัด"],
  ["visa_support_letter", "หนังสือประกอบวีซ่า"],
  ["quotation", "ใบเสนอราคา"],
  ["guarantee_letter", "Guarantee Letter"],
  ["mpi_link_certificate", "MPI Link"],
  ["sync_receipt", "Sync Receipt"],
] as const;

export default function Users() {
  const { data: users, isLoading, refetch } = trpc.users.list.useQuery({});
  const { data: hospitals } = trpc.hospital.list.useQuery();
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const updateRole = trpc.users.updateRole.useMutation({
    onSuccess: async () => {
      toast.success("อัปเดตสิทธิผู้ใช้แล้ว");
      setEditing(null);
      await refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const startEdit = (user: any) => {
    setEditing(user);
    setForm({
      systemRole: user.systemRole ?? "patient",
      hospitalId: user.hospitalId ? String(user.hospitalId) : "none",
      makerTypes: user.credentialEntitlements?.makerTypes ?? [],
      checkerTypes: user.credentialEntitlements?.checkerTypes ?? [],
    });
  };
  const canEditIssuerPrivileges = canHoldIssuerPrivileges(form.systemRole);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">จัดการผู้ใช้</h1>
          <p className="text-muted-foreground text-sm mt-1">กำหนด Role และสิทธิเอกสาร/VC สำหรับ Maker และ Checker</p>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">กำลังโหลด...</div>
            ) : users && users.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ผู้ใช้</TableHead>
                    <TableHead>อีเมล</TableHead>
                    <TableHead>System Role</TableHead>
                    <TableHead>Maker Docs</TableHead>
                    <TableHead>Checker Docs</TableHead>
                    <TableHead className="text-right">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u: any) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            {u.role === "admin" ? <Shield className="h-4 w-4 text-primary" /> : <User className="h-4 w-4 text-muted-foreground" />}
                          </div>
                          <span className="font-medium text-sm">{u.name || "ไม่ระบุชื่อ"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{u.email || "-"}</TableCell>
                      <TableCell><Badge variant="secondary" className="text-[10px]">{roleLabels[u.systemRole] || u.systemRole || u.role}</Badge></TableCell>
                      <TableCell><EntitlementBadges values={u.credentialEntitlements?.makerTypes} /></TableCell>
                      <TableCell><EntitlementBadges values={u.credentialEntitlements?.checkerTypes} /></TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => startEdit(u)}><Edit3 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center py-16">
                <UsersIcon className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground">ยังไม่มีผู้ใช้ในระบบ</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={Boolean(editing)} onOpenChange={() => setEditing(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>กำหนด Role และสิทธิเอกสาร</DialogTitle></DialogHeader>
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>System Role</Label>
                <Select value={form.systemRole} onValueChange={(value) => setForm((prev: any) => ({
                  ...prev,
                  systemRole: value,
                  makerTypes: canHoldIssuerPrivileges(value) ? prev.makerTypes : [],
                  checkerTypes: canHoldIssuerPrivileges(value) ? prev.checkerTypes : [],
                }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(roleLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>โรงพยาบาล</Label>
                <Select value={form.hospitalId} onValueChange={(value) => setForm((prev: any) => ({ ...prev, hospitalId: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">ไม่ผูกโรงพยาบาล</SelectItem>
                    {hospitals?.map((hospital: any) => <SelectItem key={hospital.id} value={String(hospital.id)}>{hospital.nameEn || hospital.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <EntitlementPicker
              title="Maker document permissions"
              values={form.makerTypes ?? []}
              onChange={(values) => setForm((prev: any) => ({ ...prev, makerTypes: values }))}
              disabled={!canEditIssuerPrivileges}
            />
            <EntitlementPicker
              title="Checker document permissions"
              values={form.checkerTypes ?? []}
              onChange={(values) => setForm((prev: any) => ({ ...prev, checkerTypes: values }))}
              disabled={!canEditIssuerPrivileges}
            />

            {!canEditIssuerPrivileges && (
              <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                ผู้ป่วยไม่มีสิทธิเป็น Maker/Checker และระบบจะล้างสิทธิเอกสาร VC เมื่อบันทึก
              </p>
            )}

            <Button
              className="w-full"
              disabled={updateRole.isPending}
              onClick={() => editing && updateRole.mutate({
                id: editing.id,
                systemRole: form.systemRole,
                hospitalId: form.hospitalId === "none" ? undefined : Number(form.hospitalId),
                credentialEntitlements: {
                  makerTypes: canEditIssuerPrivileges ? form.makerTypes ?? [] : [],
                  checkerTypes: canEditIssuerPrivileges ? form.checkerTypes ?? [] : [],
                },
              })}
            >
              บันทึกสิทธิ
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function EntitlementPicker({ title, values, onChange, disabled = false }: { title: string; values: string[]; onChange: (values: string[]) => void; disabled?: boolean }) {
  const setAll = () => onChange(documentTypes.map(([value]) => value));
  const clear = () => onChange([]);
  const toggle = (value: string) => onChange(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label>{title}</Label>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={setAll} disabled={disabled}>ทั้งหมด</Button>
          <Button type="button" size="sm" variant="ghost" onClick={clear} disabled={disabled}>ล้าง</Button>
        </div>
      </div>
      <div className="grid max-h-[260px] gap-2 overflow-auto rounded-md border p-3 sm:grid-cols-2 lg:grid-cols-3">
        {documentTypes.map(([value, label]) => (
          <label key={value} className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${disabled ? "opacity-50" : "hover:bg-muted"}`}>
            <input type="checkbox" checked={values.includes(value)} onChange={() => toggle(value)} disabled={disabled} />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function EntitlementBadges({ values }: { values?: string[] }) {
  if (!values?.length) return <span className="text-xs text-muted-foreground">-</span>;
  return (
    <div className="flex max-w-[260px] flex-wrap gap-1">
      {values.slice(0, 3).map((value) => <Badge key={value} variant="outline" className="text-[10px]">{documentTypes.find(([key]) => key === value)?.[1] ?? value}</Badge>)}
      {values.length > 3 && <Badge variant="secondary" className="text-[10px]">+{values.length - 3}</Badge>}
    </div>
  );
}
