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
import { Plug, Plus, RefreshCw, CheckCircle2, XCircle, Database, Activity, ListChecks, Clock3, AlertTriangle, Gauge, RadioTower, GitBranch, Wrench, FileClock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  getAdapterHealthLabel,
  getJobTroubleshootingHint,
  summarizeIntegrationWorkbench,
  type IntegrationWorkbenchSeverity,
} from "@shared/integrationWorkbench";

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

const healthSeverityColors: Record<IntegrationWorkbenchSeverity, string> = {
  ok: "bg-green-100 text-green-700",
  watch: "bg-amber-100 text-amber-700",
  blocked: "bg-red-100 text-red-700",
  neutral: "bg-gray-100 text-gray-700",
};

function formatDateTime(value?: string | Date | null) {
  return value ? new Date(value).toLocaleString("th-TH") : "not recorded";
}

function metadataKeys(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "no metadata";
  const keys = Object.keys(value as Record<string, unknown>).slice(0, 5);
  return keys.length ? keys.join(", ") : "no metadata";
}

export default function Integration() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedAdapterId, setSelectedAdapterId] = useState<number | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [lastHealthByAdapterId, setLastHealthByAdapterId] = useState<Record<number, any>>({});

  const { data: adapters, refetch } = trpc.integration.listAdapters.useQuery({});
  const { data: events } = trpc.integration.listEvents.useQuery({ limit: 20 });
  const { data: jobs, refetch: refetchJobs } = trpc.integration.listJobs.useQuery({ limit: 20 });
  const selectedAdapter = adapters?.find((adapter: any) => adapter.id === selectedAdapterId) ?? adapters?.[0];
  const selectedJob = jobs?.find((job: any) => job.jobId === selectedJobId) ?? jobs?.[0];
  const effectiveSelectedAdapterId = selectedAdapterId ?? selectedAdapter?.id ?? 0;
  const effectiveSelectedJobId = selectedJobId ?? selectedJob?.jobId ?? "";
  const { data: healthLogs } = trpc.integration.healthLogs.useQuery(
    { adapterId: effectiveSelectedAdapterId },
    { enabled: Boolean(effectiveSelectedAdapterId) },
  );
  const { data: mappingVersions } = trpc.integration.listMappingVersions.useQuery(
    { adapterId: effectiveSelectedAdapterId },
    { enabled: Boolean(effectiveSelectedAdapterId) },
  );
  const { data: selectedJobDetail } = trpc.integration.getJob.useQuery(
    { jobId: effectiveSelectedJobId },
    { enabled: Boolean(effectiveSelectedJobId) },
  );
  const workbenchSummary = summarizeIntegrationWorkbench(adapters ?? [], jobs ?? []);
  const selectedJobRecord = selectedJobDetail?.job ?? selectedJob;
  const selectedJobHint = selectedJobRecord ? getJobTroubleshootingHint(selectedJobRecord) : undefined;
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
    onSuccess: (data, variables) => {
      setLastHealthByAdapterId((current) => ({ ...current, [variables.id]: data }));
      refetch();
      const label = data.healthy ? "เชื่อมต่อสำเร็จ" : `ต้องตรวจสอบ: ${data.healthStatus ?? "unknown"}`;
      if (data.healthy) toast.success(`${label} (${data.responseTimeMs}ms)`);
      else toast.error(label);
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

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Adapters ready</p>
                  <p className="text-2xl font-semibold">{workbenchSummary.healthyAdapters}/{workbenchSummary.totalAdapters}</p>
                </div>
                <ShieldCheck className="h-5 w-5 text-green-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Watch / blocked</p>
                  <p className="text-2xl font-semibold">{workbenchSummary.watchAdapters + workbenchSummary.blockedAdapters}</p>
                </div>
                <RadioTower className="h-5 w-5 text-amber-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Job backlog</p>
                  <p className="text-2xl font-semibold">{workbenchSummary.backlogJobs}</p>
                </div>
                <Gauge className="h-5 w-5 text-sky-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Needs review</p>
                  <p className="text-2xl font-semibold">{workbenchSummary.reviewJobs}</p>
                </div>
                <Wrench className="h-5 w-5 text-red-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="adapters">
          <TabsList>
            <TabsTrigger value="adapters">Adapters ({adapters?.length || 0})</TabsTrigger>
            <TabsTrigger value="jobs">Jobs ({jobs?.length || 0})</TabsTrigger>
            <TabsTrigger value="events">Integration Events</TabsTrigger>
          </TabsList>

          <TabsContent value="adapters" className="mt-4">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
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
                adapters.map(adapter => {
                  const health = getAdapterHealthLabel(adapter);
                  const latestHealth = lastHealthByAdapterId[adapter.id];
                  return (
                  <Card key={adapter.id} className={`hover:shadow-sm transition-shadow ${selectedAdapter?.id === adapter.id ? "ring-2 ring-primary/30" : ""}`}>
                    <CardContent className="pt-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <button type="button" className="flex items-center gap-3 min-w-0 text-left" onClick={() => setSelectedAdapterId(adapter.id)}>
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
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <Badge className={healthSeverityColors[health.severity]}>{health.label}</Badge>
                              {latestHealth?.backpressure?.state ? <Badge variant="outline">pressure: {latestHealth.backpressure.state}</Badge> : null}
                              {latestHealth?.circuitBreaker?.state ? <Badge variant="outline">circuit: {latestHealth.circuitBreaker.state}</Badge> : null}
                            </div>
                          </div>
                        </button>
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
                  );
                })
              )}
              </div>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <RadioTower className="h-5 w-5" />
                    Adapter Runtime
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!selectedAdapter ? (
                    <div className="py-10 text-center text-sm text-muted-foreground">No adapter selected</div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <p className="font-medium truncate">{selectedAdapter.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Adapter #{selectedAdapter.id} · Hospital #{selectedAdapter.hospitalId}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="rounded-md border p-3">
                          <p className="text-xs text-muted-foreground">Health</p>
                          <Badge className={healthSeverityColors[getAdapterHealthLabel(selectedAdapter).severity]}>
                            {getAdapterHealthLabel(selectedAdapter).label}
                          </Badge>
                        </div>
                        <div className="rounded-md border p-3">
                          <p className="text-xs text-muted-foreground">Mapping</p>
                          <p className="font-medium">{mappingVersions?.[0]?.version ?? "no version"}</p>
                        </div>
                      </div>
                      {lastHealthByAdapterId[selectedAdapter.id] ? (
                        <div className="rounded-md border p-3 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-medium">Latest check</p>
                            <Badge variant="outline">{lastHealthByAdapterId[selectedAdapter.id].responseTimeMs}ms</Badge>
                          </div>
                          <div className="mt-3 grid gap-2 sm:grid-cols-2 text-xs">
                            <div>
                              <p className="text-muted-foreground">Backpressure</p>
                              <p>{lastHealthByAdapterId[selectedAdapter.id].backpressure?.state ?? "unknown"}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Circuit</p>
                              <p>{lastHealthByAdapterId[selectedAdapter.id].circuitBreaker?.state ?? "unknown"}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Local buffer</p>
                              <p>{lastHealthByAdapterId[selectedAdapter.id].localBuffer?.depth ?? 0}/{lastHealthByAdapterId[selectedAdapter.id].localBuffer?.limit ?? 0}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Next action</p>
                              <p>{lastHealthByAdapterId[selectedAdapter.id].jobAction ?? getAdapterHealthLabel(selectedAdapter).nextAction}</p>
                            </div>
                          </div>
                        </div>
                      ) : null}
                      <div className="space-y-2">
                        <p className="text-sm font-medium flex items-center gap-2"><GitBranch className="h-4 w-4" /> Mapping versions</p>
                        {(mappingVersions ?? []).slice(0, 4).map((mapping: any) => (
                          <div key={mapping.id} className="flex items-center justify-between rounded-md border p-2 text-xs">
                            <span>{mapping.resourceType} v{mapping.version}</span>
                            <Badge variant="outline">{mapping.status}</Badge>
                          </div>
                        ))}
                        {(!mappingVersions || mappingVersions.length === 0) ? <p className="text-xs text-muted-foreground">No mapping versions</p> : null}
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-medium flex items-center gap-2"><FileClock className="h-4 w-4" /> Health log</p>
                        {(healthLogs ?? []).slice(0, 5).map((log: any) => (
                          <div key={log.id} className="rounded-md border p-2 text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <Badge className={log.status === "healthy" ? healthSeverityColors.ok : log.status === "down" ? healthSeverityColors.blocked : healthSeverityColors.watch}>{log.status}</Badge>
                              <span className="text-muted-foreground">{formatDateTime(log.checkedAt)}</span>
                            </div>
                            {log.errorMessage ? <p className="mt-1 text-muted-foreground">{log.errorMessage}</p> : null}
                          </div>
                        ))}
                        {(!healthLogs || healthLogs.length === 0) ? <p className="text-xs text-muted-foreground">No health logs</p> : null}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="jobs" className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
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
                              <Badge className={healthSeverityColors[getJobTroubleshootingHint(job).severity]}>
                                {getJobTroubleshootingHint(job).label}
                              </Badge>
                              {job.status === "needs_review" || job.status === "dead_lettered" || job.status === "failed" ? (
                                <AlertTriangle className="h-4 w-4 text-amber-600" />
                              ) : null}
                              <Button size="sm" variant="outline" onClick={() => setSelectedJobId(job.jobId)}>
                                Open
                              </Button>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {job.jobType} {" "}·{" "} {job.sourceType}
                            </p>
                            <p className="text-xs text-muted-foreground mt-2">{getJobTroubleshootingHint(job).nextAction}</p>
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
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileClock className="h-5 w-5" />
                  Job Timeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!selectedJobRecord || !selectedJobHint ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">No job selected</div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={jobStatusColors[selectedJobRecord.status] || "bg-gray-100 text-gray-700"}>{selectedJobRecord.status}</Badge>
                        <Badge className={healthSeverityColors[selectedJobHint.severity]}>{selectedJobHint.label}</Badge>
                      </div>
                      <p className="font-mono text-sm break-all">{selectedJobRecord.jobId}</p>
                      <p className="text-xs text-muted-foreground">{selectedJobHint.nextAction}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-md border p-3">
                        <p className="text-muted-foreground">Correlation ID</p>
                        <p className="font-mono truncate">{selectedJobRecord.correlationId}</p>
                      </div>
                      <div className="rounded-md border p-3">
                        <p className="text-muted-foreground">Adapter</p>
                        <p>{selectedJobRecord.adapterId ? `#${selectedJobRecord.adapterId}` : "not scoped"}</p>
                      </div>
                      <div className="rounded-md border p-3">
                        <p className="text-muted-foreground">Contract</p>
                        <p className="truncate">{selectedJobRecord.contractId || "none"}</p>
                      </div>
                      <div className="rounded-md border p-3">
                        <p className="text-muted-foreground">Attempts</p>
                        <p>{selectedJobRecord.attempts ?? 0}/{selectedJobRecord.maxAttempts ?? 0}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Events</p>
                      {(selectedJobDetail?.events ?? []).map((event: any) => (
                        <div key={event.id} className="rounded-md border p-3 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">{event.eventType}</span>
                            <Badge variant="outline">{event.status ?? event.level}</Badge>
                          </div>
                          <p className="mt-1 text-muted-foreground">{event.message ?? "No message"}</p>
                          <p className="mt-1 font-mono text-muted-foreground truncate">metadata: {metadataKeys(event.metadata)}</p>
                        </div>
                      ))}
                      {(!selectedJobDetail?.events || selectedJobDetail.events.length === 0) ? (
                        <p className="text-xs text-muted-foreground">No events loaded</p>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Artifacts</p>
                      {(selectedJobDetail?.artifacts ?? []).map((artifact: any) => (
                        <div key={artifact.id ?? artifact.artifactId} className="rounded-md border p-3 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">{artifact.artifactType ?? "artifact"}</span>
                            <Badge variant="outline">{artifact.hash ? `${String(artifact.hash).slice(0, 10)}...` : "no hash"}</Badge>
                          </div>
                          <p className="mt-1 font-mono text-muted-foreground truncate">{artifact.artifactId ?? "untracked"}</p>
                        </div>
                      ))}
                      {(!selectedJobDetail?.artifacts || selectedJobDetail.artifacts.length === 0) ? (
                        <p className="text-xs text-muted-foreground">No artifacts</p>
                      ) : null}
                    </div>
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
