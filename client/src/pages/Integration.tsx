import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Plug, Plus, RefreshCw, CheckCircle2, XCircle, Database, Activity, ListChecks, Clock3, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const systemTypeLabels: Record<string, string> = {
  his: "HIS",
  emr: "EMR",
  lis: "LIS",
  ris: "RIS",
  pacs: "PACS",
  erp: "ERP",
  crm: "CRM",
  claim_system: "Claim System",
  legacy_db: "Legacy Database",
};

const connectorLabels: Record<string, string> = {
  api_rest: "REST API",
  api_graphql: "GraphQL",
  hl7v2: "HL7 v2",
  db_view: "Database View",
  cdc: "Change Data Capture",
  batch_file: "Batch File (CSV/SFTP)",
  dicomweb: "DICOMweb",
  portal_adapter: "Portal Adapter",
};

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  inactive: "bg-gray-100 text-gray-700",
  error: "bg-red-100 text-red-700",
  testing: "bg-blue-100 text-blue-700",
};

const jobStatusColors: Record<string, string> = {
  queued: "bg-blue-100 text-blue-700",
  claimed: "bg-sky-100 text-sky-700",
  running: "bg-amber-100 text-amber-700",
  succeeded: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  needs_review: "bg-orange-100 text-orange-700",
  dead_lettered: "bg-red-200 text-red-800",
  cancelled: "bg-gray-100 text-gray-700",
};

export default function Integration() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const { data: adapters, refetch } = trpc.integration.listAdapters.useQuery({});
  const { data: events } = trpc.integration.listEvents.useQuery({ limit: 20 });
  const { data: jobs, refetch: refetchJobs } = trpc.integration.listJobs.useQuery({ limit: 20 });
  const createAdapter = trpc.integration.createAdapter.useMutation({
    onSuccess: () => { refetch(); setShowCreateDialog(false); toast.success("สร้าง Adapter สำเร็จ"); }
  });
  const createJob = trpc.integration.createJob.useMutation({
    onSuccess: (data) => {
      refetchJobs();
      toast.success(`Queued job ${data.jobId}`);
    },
    onError: (error) => toast.error(error.message),
  });
  const testConnection = trpc.integration.testConnection.useMutation({
    onSuccess: (data) => {
      if (data.healthy) toast.success(`เชื่อมต่อสำเร็จ (${data.responseTimeMs}ms)`);
      else toast.error("เชื่อมต่อล้มเหลว");
    }
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Plug className="h-7 w-7 text-primary" />
              เชื่อมต่อระบบ HIS
            </h1>
            <p className="text-muted-foreground mt-1">จัดการ Adapter สำหรับเชื่อมต่อข้อมูลจากระบบ HIS และ Legacy Database ของโรงพยาบาล</p>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />เพิ่ม Adapter</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>เพิ่ม Integration Adapter</DialogTitle></DialogHeader>
              <form onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                createAdapter.mutate({
                  hospitalId: Number(fd.get("hospitalId")),
                  name: fd.get("name") as string,
                  systemType: fd.get("systemType") as any,
                  connectorPattern: fd.get("connectorPattern") as any,
                  authMethod: (fd.get("authMethod") as any) || undefined,
                });
              }} className="space-y-4">
                <div><Label>ชื่อ Adapter</Label><Input name="name" placeholder="เช่น HIS-BangkokHospital-HL7" required /></div>
                <div><Label>รหัสโรงพยาบาล</Label><Input name="hospitalId" type="number" required /></div>
                <div>
                  <Label>ประเภทระบบ</Label>
                  <Select name="systemType" required>
                    <SelectTrigger><SelectValue placeholder="เลือกประเภทระบบ" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(systemTypeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>รูปแบบการเชื่อมต่อ</Label>
                  <Select name="connectorPattern" required>
                    <SelectTrigger><SelectValue placeholder="เลือกรูปแบบ" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(connectorLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>วิธีการยืนยันตัวตน</Label>
                  <Select name="authMethod">
                    <SelectTrigger><SelectValue placeholder="เลือกวิธี (ไม่บังคับ)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="oauth2">OAuth 2.0</SelectItem>
                      <SelectItem value="api_key">API Key</SelectItem>
                      <SelectItem value="mtls">mTLS</SelectItem>
                      <SelectItem value="basic">Basic Auth</SelectItem>
                      <SelectItem value="vpn">VPN</SelectItem>
                      <SelectItem value="none">ไม่มี</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" disabled={createAdapter.isPending}>สร้าง Adapter</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Architecture Info */}
        <Card className="bg-muted/30 border-dashed">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <Database className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium text-sm">หลักการเชื่อมต่อ</p>
                <p className="text-xs text-muted-foreground mt-1">
                  ระบบนี้ไม่ได้ทดแทน HIS หรือ Legacy DB เดิม แต่ทำหน้าที่เป็น Integration Layer
                  ที่ดึงข้อมูลจากระบบเดิมมาแปลงเป็น FHIR R4 แล้วออก Verifiable Credential
                  ให้ผู้ป่วยพกพาข้อมูลข้ามโรงพยาบาลได้
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="adapters">
          <TabsList>
            <TabsTrigger value="adapters">Adapters ({adapters?.length || 0})</TabsTrigger>
            <TabsTrigger value="jobs">Jobs ({jobs?.length || 0})</TabsTrigger>
            <TabsTrigger value="events">Integration Events</TabsTrigger>
          </TabsList>

          <TabsContent value="adapters" className="mt-4">
            <div className="space-y-3">
              {(!adapters || adapters.length === 0) ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <Plug className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>ยังไม่มี Adapter ที่เชื่อมต่อ</p>
                    <p className="text-xs mt-1">เพิ่ม Adapter เพื่อเริ่มดึงข้อมูลจากระบบ HIS</p>
                  </CardContent>
                </Card>
              ) : (
                adapters.map(adapter => (
                  <Card key={adapter.id} className="hover:shadow-sm transition-shadow">
                    <CardContent className="pt-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                            <Plug className="h-5 w-5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{adapter.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {systemTypeLabels[adapter.systemType] || adapter.systemType}
                              {" • "}
                              {connectorLabels[adapter.connectorPattern] || adapter.connectorPattern}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              โรงพยาบาล #{adapter.hospitalId}
                              {adapter.lastHealthCheck && ` • ตรวจสอบล่าสุด: ${new Date(adapter.lastHealthCheck).toLocaleString("th-TH")}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-11 sm:ml-0">
                          <Badge className={statusColors[adapter.status] || "bg-gray-100"}>
                            {adapter.status === "active" ? "ใช้งาน" : adapter.status === "error" ? "ผิดพลาด" : adapter.status === "testing" ? "ทดสอบ" : "ปิดใช้งาน"}
                          </Badge>
                          <Button size="sm" variant="outline" onClick={() => testConnection.mutate({ id: adapter.id })}>
                            <Activity className="h-3 w-3 mr-1" />ทดสอบ
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="jobs" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <ListChecks className="h-5 w-5" />
                      Integration Jobs
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      Queue status for service-readiness integration work. Payload/result bodies are hidden from this monitor.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={createJob.isPending}
                    onClick={() => createJob.mutate({
                      jobType: "noop",
                      sourceType: "manual",
                      context: "opd_visit",
                      contractId: "opd_readiness_v1",
                      contractVersion: "1.0.0",
                      sourceRef: "integration-monitor-smoke",
                      payload: { source: "integration-monitor", synthetic: true },
                    })}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Queue Demo Job
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {(!jobs || jobs.length === 0) ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <Clock3 className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p>No integration jobs yet</p>
                    <p className="text-xs mt-1">Queued import, mapping, VC/VP, SHL, and sync-back work will appear here.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {jobs.map((job: any) => (
                      <div key={job.jobId} className="rounded-lg border p-4">
                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-mono text-sm font-medium truncate">{job.jobId}</p>
                              <Badge className={jobStatusColors[job.status] || "bg-gray-100 text-gray-700"}>
                                {job.status}
                              </Badge>
                              {job.status === "needs_review" || job.status === "dead_lettered" || job.status === "failed" ? (
                                <AlertTriangle className="h-4 w-4 text-amber-600" />
                              ) : null}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {job.jobType} {" "}·{" "} {job.sourceType}
                            </p>
                          </div>
                          <div className="text-xs text-muted-foreground lg:text-right">
                            <p>{job.createdAt ? new Date(job.createdAt).toLocaleString("th-TH") : "not started"}</p>
                            <p>attempts {job.attempts ?? 0}/{job.maxAttempts ?? 0}</p>
                          </div>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 mt-4 text-xs">
                          <div>
                            <p className="text-muted-foreground">Correlation ID</p>
                            <p className="font-mono truncate">{job.correlationId}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Context</p>
                            <p>{job.context || "system"}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Contract</p>
                            <p className="truncate">{job.contractId || "none"} {job.contractVersion ? `v${job.contractVersion}` : ""}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Artifacts</p>
                            <p>{job.hasPayload ? "payload ref/hash" : "no payload"} · {job.hasResult ? "has result" : "no result"}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="events" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-lg">Integration Events</CardTitle></CardHeader>
              <CardContent>
                {(!events || events.length === 0) ? (
                  <p className="text-center py-8 text-muted-foreground">ยังไม่มี events</p>
                ) : (
                  <div className="space-y-2">
                    {events.map((ev: any) => (
                      <div key={ev.id} className="flex items-center justify-between p-3 border rounded-lg text-sm">
                        <div className="flex items-center gap-3">
                          {ev.status === "processed" ? <CheckCircle2 className="h-4 w-4 text-green-600" /> :
                           ev.status === "error" ? <XCircle className="h-4 w-4 text-red-600" /> :
                           <RefreshCw className="h-4 w-4 text-blue-600" />}
                          <div>
                            <p className="font-medium">{ev.eventType} — {ev.resourceType}</p>
                            <p className="text-xs text-muted-foreground">Adapter #{ev.adapterId}</p>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(ev.createdAt).toLocaleString("th-TH")}
                        </span>
                      </div>
                    ))}
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
