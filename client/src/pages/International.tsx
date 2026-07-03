import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CareTransitionWorkspace } from "@/components/CareTransitionWorkspace";
import { InternationalWorkflowPanels } from "@/components/InternationalWorkflowPanels";
import { trpc } from "@/lib/trpc";
import { useMemo, useState } from "react";
import { Plane, Plus, User, FileText, Globe, Calendar, CheckCircle2, ClipboardList, Package } from "lucide-react";
import { toast } from "sonner";

const statusFlow = [
  "inquiry", "profile_created", "documents_uploaded", "identity_verified",
  "clinical_pre_review", "quotation_prepared", "insurance_review",
  "appointment_confirmed", "arrival_ready", "patient_arrived",
  "treatment_in_progress", "discharge_prepared", "follow_up_scheduled", "closed"
];

const statusLabels: Record<string, string> = {
  inquiry: "สอบถาม",
  profile_created: "สร้างโปรไฟล์",
  documents_uploaded: "อัปโหลดเอกสาร",
  identity_verified: "ยืนยันตัวตน",
  clinical_pre_review: "ตรวจสอบข้อมูลทางการแพทย์",
  more_info_requested: "ขอข้อมูลเพิ่ม",
  quotation_prepared: "จัดทำใบเสนอราคา",
  insurance_review: "ตรวจสอบประกัน",
  appointment_confirmed: "ยืนยันนัดหมาย",
  arrival_ready: "พร้อมเดินทาง",
  patient_arrived: "ผู้ป่วยมาถึง",
  treatment_in_progress: "กำลังรักษา",
  discharge_prepared: "เตรียมจำหน่าย",
  follow_up_scheduled: "นัดติดตามผล",
  closed: "ปิดเคส",
};

const languageLabels: Record<string, string> = {
  en: "English", zh: "中文", ja: "日本語", ar: "العربية", ru: "Русский", ko: "한국어", de: "Deutsch", fr: "Français", other: "Other",
};

export default function International() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState<number>();

  const { data: cases, refetch } = trpc.international.listCases.useQuery({
    status: statusFilter === "all" ? undefined : statusFilter,
  });
  const selectedCase = useMemo(() => {
    if (!cases?.length) return undefined;
    return cases.find((item: any) => item.id === selectedCaseId) ?? cases[0];
  }, [cases, selectedCaseId]);
  const createCase = trpc.international.createCase.useMutation({
    onSuccess: () => { refetch(); setShowCreateDialog(false); toast.success("สร้างเคสผู้ป่วยต่างชาติสำเร็จ"); }
  });
  const updateStatus = trpc.international.updateStatus.useMutation({
    onSuccess: () => { refetch(); toast.success("อัปเดตสถานะสำเร็จ"); }
  });
  const overview = trpc.careTransition.overview.useQuery();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
              <Plane className="h-6 w-6 sm:h-7 sm:w-7 text-primary shrink-0" />
              <span>ผู้ป่วยต่างชาติ (Medical Tourist)</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">จัดการเคสผู้ป่วยต่างชาติ ตั้งแต่สอบถามจนถึงติดตามผลหลังรักษา</p>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="self-start sm:self-auto"><Plus className="h-4 w-4 mr-2" />เคสใหม่</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>สร้างเคสผู้ป่วยต่างชาติ</DialogTitle></DialogHeader>
              <form onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                createCase.mutate({
                  country: fd.get("country") as string,
                  language: fd.get("language") as any,
                  passportNumber: fd.get("passportNumber") as string,
                  passportCountry: fd.get("passportCountry") as string,
                  insuranceProvider: fd.get("insuranceProvider") as string,
                  serviceLine: fd.get("serviceLine") as string,
                  contactEmail: fd.get("contactEmail") as string,
                  contactPhone: fd.get("contactPhone") as string,
                });
              }} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>ประเทศ (ISO 3)</Label><Input name="country" placeholder="THA, USA, JPN..." required /></div>
                  <div>
                    <Label>ภาษาที่ใช้</Label>
                    <Select name="language">
                      <SelectTrigger><SelectValue placeholder="เลือกภาษา" /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(languageLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>เลขหนังสือเดินทาง</Label><Input name="passportNumber" /></div>
                  <div><Label>ประเทศที่ออก</Label><Input name="passportCountry" placeholder="USA, GBR..." /></div>
                </div>
                <div><Label>บริษัทประกัน</Label><Input name="insuranceProvider" /></div>
                <div><Label>บริการที่ต้องการ</Label><Input name="serviceLine" placeholder="เช่น Cardiology, Orthopedics..." /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>อีเมล</Label><Input name="contactEmail" type="email" /></div>
                  <div><Label>โทรศัพท์</Label><Input name="contactPhone" /></div>
                </div>
                <Button type="submit" className="w-full" disabled={createCase.isPending}>สร้างเคส</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* KPI Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPI title="เคสทั้งหมด" value={cases?.length ?? 0} icon={Globe} />
          <KPI title="เอกสาร" value={overview.data?.stats.documents ?? 0} icon={FileText} />
          <KPI title="งานค้าง" value={overview.data?.stats.activeTasks ?? 0} icon={ClipboardList} />
          <KPI title="แพ็กเกจ" value={overview.data?.stats.packages ?? 0} icon={Package} />
        </div>

        {/* Status Flow Indicator */}
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">ขั้นตอนการดูแลผู้ป่วยต่างชาติ</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 overflow-x-auto pb-2">
              {statusFlow.slice(0, 8).map((s, i) => (
                <div key={s} className="flex items-center">
                  <div className="px-2 py-1 rounded text-xs bg-muted text-muted-foreground whitespace-nowrap">
                    {statusLabels[s]}
                  </div>
                  {i < 7 && <span className="text-muted-foreground mx-1">→</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Cases List */}
        <Tabs defaultValue="all" onValueChange={setStatusFilter}>
          <TabsList>
            <TabsTrigger value="all">ทั้งหมด</TabsTrigger>
            <TabsTrigger value="inquiry">สอบถาม</TabsTrigger>
            <TabsTrigger value="appointment_confirmed">นัดหมายแล้ว</TabsTrigger>
            <TabsTrigger value="treatment_in_progress">กำลังรักษา</TabsTrigger>
            <TabsTrigger value="closed">ปิดเคส</TabsTrigger>
          </TabsList>
          <TabsContent value={statusFilter} className="mt-4">
            <Card>
              <CardContent className="pt-6">
                {(!cases || cases.length === 0) ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Globe className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>ยังไม่มีเคสผู้ป่วยต่างชาติ</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {cases.map(c => (
                      <div
                        key={c.id}
                        className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border rounded-lg hover:bg-muted/30 transition-colors cursor-pointer ${selectedCase?.id === c.id ? "border-primary" : ""}`}
                        onClick={() => setSelectedCaseId(c.id)}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2 rounded-full bg-primary/10 shrink-0">
                            <User className="h-5 w-5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">เคส #{c.id} — {c.serviceLine || "ทั่วไป"}</p>
                            <div className="flex flex-wrap gap-1 mt-1 text-xs text-muted-foreground">
                              {c.country && <span>🌍 {c.country}</span>}
                              {c.language && <span>🗣️ {languageLabels[c.language] || c.language}</span>}
                              {c.contactEmail && <span className="truncate max-w-[150px]">✉️ {c.contactEmail}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                          <Badge variant="outline" className="text-[10px]">{statusLabels[c.status] || c.status}</Badge>
                          {c.status !== "closed" && (
                            <Button size="sm" variant="outline" onClick={(e) => {
                              e.stopPropagation();
                              const idx = statusFlow.indexOf(c.status);
                              if (idx < statusFlow.length - 1) {
                                updateStatus.mutate({ id: c.id, status: statusFlow[idx + 1] as any });
                              }
                            }}>
                              ขั้นตอนถัดไป
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* International Workflow Panels */}
        <InternationalWorkflowPanels caseId={selectedCase?.id} caseStatus={selectedCase?.status} onStatusUpdate={() => refetch()} />

        <CareTransitionWorkspace
          caseType="medical_tourist"
          caseId={selectedCase?.id}
          patientId={selectedCase?.patientId || undefined}
          hospitalId={selectedCase?.preferredBranchId || undefined}
          recipientName={selectedCase?.insuranceProvider || selectedCase?.country || undefined}
          defaultPackageType="medical_tourist"
        />
      </div>
    </DashboardLayout>
  );
}

function KPI({ title, value, icon: Icon }: { title: string; value: number; icon: any }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">{title}</p>
      </div>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}
