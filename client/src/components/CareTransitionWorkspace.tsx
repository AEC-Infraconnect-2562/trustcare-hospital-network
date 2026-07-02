import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  CheckCircle2, ClipboardList, FileText, Package, PlayCircle, Send, Upload,
  Scale, Clock, AlertCircle, XCircle, HelpCircle, ShieldCheck, Gavel
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type CaseType = "internal_referral" | "cross_branch" | "cross_border" | "external_partner" | "medical_tourist";
type PackageType = "referral" | "cross_border" | "medical_tourist" | "discharge" | "counter_referral" | "claim";

const caseDocumentTypes = [
  "referral_letter", "patient_summary", "lab_report", "imaging_report",
  "passport", "insurance_card", "guarantee_letter", "quotation",
  "visa_support_letter", "consent", "claim_document", "invoice",
  "receipt", "discharge_summary", "prescription", "medical_certificate", "other",
] as const;

const documentLabels: Record<string, string> = {
  referral_letter: "Referral letter", patient_summary: "Patient summary",
  lab_report: "Lab report", imaging_report: "Imaging report",
  passport: "Passport", insurance_card: "Insurance card",
  guarantee_letter: "Guarantee letter", quotation: "Quotation",
  visa_support_letter: "Visa support letter", consent: "Consent",
  claim_document: "Claim document", invoice: "Invoice",
  receipt: "Receipt", discharge_summary: "Discharge summary",
  prescription: "Prescription", medical_certificate: "Medical certificate", other: "Other",
};

const packageOptions: PackageType[] = ["referral", "cross_border", "medical_tourist", "discharge", "counter_referral", "claim"];

const decisionTypes = [
  { value: "clinical_acceptance", label: "Clinical Acceptance", icon: ShieldCheck },
  { value: "document_acceptance", label: "Document Acceptance", icon: FileText },
  { value: "financial_acceptance", label: "Financial Acceptance", icon: Scale },
  { value: "legal_acceptance", label: "Legal Acceptance", icon: Gavel },
  { value: "admission_acceptance", label: "Admission Acceptance", icon: CheckCircle2 },
  { value: "discharge_clearance", label: "Discharge Clearance", icon: CheckCircle2 },
] as const;

const outcomeConfig: Record<string, { label: string; color: string; icon: any }> = {
  accepted: { label: "Accepted", color: "bg-emerald-100 text-emerald-800 border-emerald-300", icon: CheckCircle2 },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-800 border-red-300", icon: XCircle },
  more_info_requested: { label: "More Info Requested", color: "bg-amber-100 text-amber-800 border-amber-300", icon: HelpCircle },
  conditional: { label: "Conditional", color: "bg-blue-100 text-blue-800 border-blue-300", icon: AlertCircle },
};

const eventTypeIcons: Record<string, any> = {
  created: PlayCircle, document_received: Upload, document_verified: CheckCircle2,
  decision_recorded: Scale, package_generated: Package,
};

export function CareTransitionWorkspace({
  caseType, caseId, patientId, hospitalId, recipientName, defaultPackageType,
}: {
  caseType: CaseType;
  caseId?: number;
  patientId?: number;
  hospitalId?: number;
  recipientName?: string;
  defaultPackageType?: PackageType;
}) {
  const [docForm, setDocForm] = useState({
    direction: "inbound", documentType: "referral_letter",
    title: "", fileName: "", fileUrl: "", notes: "",
  });
  const [packageForm, setPackageForm] = useState({
    packageType: defaultPackageType || "referral",
    recipientName: recipientName || "",
    recipientType: "partner_hospital",
    claimRef: "", estimateAmount: "", estimateCurrency: "THB", includeShl: true,
  });
  const [decisionForm, setDecisionForm] = useState({
    decisionType: "clinical_acceptance",
    outcome: "accepted",
    reason: "",
  });

  const enabled = Boolean(caseId);
  const workspace = trpc.careTransition.workspace.useQuery(
    { caseType, caseId: caseId || 0 },
    { enabled },
  );
  const initializeCase = trpc.careTransition.initializeCase.useMutation({
    onSuccess: () => { workspace.refetch(); toast.success("Workflow initialized"); },
    onError: (error) => toast.error(error.message),
  });
  const addDocument = trpc.careTransition.addDocument.useMutation({
    onSuccess: () => {
      setDocForm((prev) => ({ ...prev, title: "", fileName: "", fileUrl: "", notes: "" }));
      workspace.refetch();
      toast.success("Document received as FHIR DocumentReference");
    },
    onError: (error) => toast.error(error.message),
  });
  const verifyDocument = trpc.careTransition.verifyDocument.useMutation({
    onSuccess: (result) => {
      workspace.refetch();
      toast.success(result.vcRequest ? "Document verified and VC request submitted" : "Document verified");
    },
    onError: (error) => toast.error(error.message),
  });
  const updateTask = trpc.careTransition.updateTask.useMutation({
    onSuccess: () => { workspace.refetch(); toast.success("Task updated"); },
    onError: (error) => toast.error(error.message),
  });
  const recordDecision = trpc.careTransition.recordDecision.useMutation({
    onSuccess: () => {
      workspace.refetch();
      setDecisionForm(prev => ({ ...prev, reason: "" }));
      toast.success("Decision recorded");
    },
    onError: (error) => toast.error(error.message),
  });
  const generatePackage = trpc.careTransition.generatePackage.useMutation({
    onSuccess: (result) => {
      workspace.refetch();
      toast.success(result.shl?.id ? `Care package generated with SHL #${result.shl.id}` : "Care package generated");
    },
    onError: (error) => toast.error(error.message),
  });

  if (!enabled) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Select or create a case to manage documents, tasks, decisions, and care packages.
        </CardContent>
      </Card>
    );
  }

  const data = workspace.data;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Metric title="Documents" value={data?.documents.length ?? 0} />
        <Metric title="Open tasks" value={data?.tasks.filter((t: any) => !["completed", "cancelled"].includes(t.status)).length ?? 0} />
        <Metric title="Decisions" value={data?.decisions.length ?? 0} />
        <Metric title="Packages" value={data?.packages.length ?? 0} />
        <Metric title="Events" value={data?.events.length ?? 0} />
      </div>

      <Tabs defaultValue="documents">
        <TabsList className="flex flex-wrap h-auto justify-start">
          <TabsTrigger value="documents"><FileText className="h-4 w-4 mr-2" />Documents</TabsTrigger>
          <TabsTrigger value="tasks"><ClipboardList className="h-4 w-4 mr-2" />Tasks</TabsTrigger>
          <TabsTrigger value="decisions"><Scale className="h-4 w-4 mr-2" />Decisions</TabsTrigger>
          <TabsTrigger value="packages"><Package className="h-4 w-4 mr-2" />Packages</TabsTrigger>
          <TabsTrigger value="timeline"><Clock className="h-4 w-4 mr-2" />Timeline</TabsTrigger>
        </TabsList>

        {/* DOCUMENTS TAB */}
        <TabsContent value="documents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Upload className="h-4 w-4" />Receive / send case document</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="grid grid-cols-1 md:grid-cols-6 gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!docForm.title.trim()) { toast.error("Document title is required"); return; }
                  addDocument.mutate({
                    caseType, caseId: caseId!,
                    direction: docForm.direction as "inbound" | "outbound",
                    documentType: docForm.documentType as any,
                    title: docForm.title,
                    fileName: docForm.fileName || undefined,
                    fileUrl: docForm.fileUrl || undefined,
                    notes: docForm.notes || undefined,
                    patientId,
                    sourceSystem: docForm.direction === "outbound" ? "trustcare" : "partner_portal",
                  });
                }}
              >
                <div className="space-y-2">
                  <Label>Direction</Label>
                  <Select value={docForm.direction} onValueChange={(v) => setDocForm((p) => ({ ...p, direction: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inbound">Inbound</SelectItem>
                      <SelectItem value="outbound">Outbound</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={docForm.documentType} onValueChange={(v) => setDocForm((p) => ({ ...p, documentType: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {caseDocumentTypes.map((t) => <SelectItem key={t} value={t}>{documentLabels[t]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2 space-y-2">
                  <Label>Title</Label>
                  <Input value={docForm.title} onChange={(e) => setDocForm((p) => ({ ...p, title: e.target.value }))} placeholder="Referral letter, passport scan..." />
                </div>
                <div className="space-y-2">
                  <Label>File name</Label>
                  <Input value={docForm.fileName} onChange={(e) => setDocForm((p) => ({ ...p, fileName: e.target.value }))} placeholder="file.pdf" />
                </div>
                <div className="space-y-2">
                  <Label>URL / key</Label>
                  <Input value={docForm.fileUrl} onChange={(e) => setDocForm((p) => ({ ...p, fileUrl: e.target.value }))} placeholder="s3:// or https://" />
                </div>
                <div className="md:col-span-5 space-y-2">
                  <Label>Notes</Label>
                  <Textarea value={docForm.notes} onChange={(e) => setDocForm((p) => ({ ...p, notes: e.target.value }))} rows={2} />
                </div>
                <div className="flex items-end">
                  <Button type="submit" className="w-full" disabled={addDocument.isPending}>
                    <Upload className="h-4 w-4 mr-2" />Save
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-2">
            {(data?.documents ?? []).map((doc: any) => (
              <div key={doc.id} className="rounded-md border p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-sm">{doc.title}</p>
                    <Badge variant="outline">{documentLabels[doc.documentType] || doc.documentType}</Badge>
                    <Badge variant={doc.direction === "outbound" ? "default" : "secondary"}>{doc.direction}</Badge>
                    <Badge className={doc.verificationStatus === "verified" ? "bg-emerald-100 text-emerald-800" : doc.verificationStatus === "rejected" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}>
                      {doc.verificationStatus}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {doc.fhirDocumentReferenceId} {doc.hash ? `| hash ${String(doc.hash).slice(0, 16)}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {doc.verificationStatus === "needs_review" && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => verifyDocument.mutate({ id: doc.id, verificationStatus: "verified" })}>
                        <CheckCircle2 className="h-3 w-3 mr-1" />Verify
                      </Button>
                      <Button size="sm" variant="outline" className="text-red-600" onClick={() => verifyDocument.mutate({ id: doc.id, verificationStatus: "rejected" })}>
                        <XCircle className="h-3 w-3 mr-1" />Reject
                      </Button>
                      <Button size="sm" onClick={() => verifyDocument.mutate({ id: doc.id, verificationStatus: "converted_to_vc", createVcRequest: true })}>
                        Submit VC
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {data?.documents.length === 0 && <EmptyLine text="No case documents yet." />}
          </div>
        </TabsContent>

        {/* TASKS TAB */}
        <TabsContent value="tasks" className="space-y-4">
          <div className="flex justify-between gap-3">
            <p className="text-sm text-muted-foreground">FHIR Task style operational checklist for intake, triage, finance, package dispatch, discharge, and sync-back.</p>
            <Button variant="outline" onClick={() => initializeCase.mutate({ caseType, caseId: caseId! })} disabled={initializeCase.isPending}>
              <PlayCircle className="h-4 w-4 mr-2" />Initialize
            </Button>
          </div>
          <div className="space-y-2">
            {(data?.tasks ?? []).map((task: any) => {
              const isComplete = task.status === "completed";
              return (
                <div key={task.id} className={`rounded-md border p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 ${isComplete ? "opacity-60" : ""}`}>
                  <div>
                    <p className="font-medium text-sm">{task.title}</p>
                    <p className="text-xs text-muted-foreground">{task.taskType} | owner: {task.ownerRole || "unassigned"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={isComplete ? "default" : task.status === "in_progress" ? "secondary" : "outline"}>{task.status}</Badge>
                    {!isComplete && task.status !== "cancelled" && (
                      <>
                        {task.status === "ready" && (
                          <Button size="sm" variant="outline" onClick={() => updateTask.mutate({ id: task.id, status: "in_progress" })}>
                            Start
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => updateTask.mutate({ id: task.id, status: "completed", output: { completedFrom: "care_transition_workspace" } })}>
                          Complete
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            {data?.tasks.length === 0 && <EmptyLine text="No tasks yet. Initialize the workflow to create the checklist." />}
          </div>
        </TabsContent>

        {/* DECISIONS TAB */}
        <TabsContent value="decisions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Gavel className="h-4 w-4" />Record Decision (Maker/Checker)</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="grid grid-cols-1 md:grid-cols-4 gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  recordDecision.mutate({
                    caseType, caseId: caseId!,
                    decisionType: decisionForm.decisionType as any,
                    outcome: decisionForm.outcome as any,
                    reason: decisionForm.reason || undefined,
                  });
                }}
              >
                <div className="space-y-2">
                  <Label>Decision Type</Label>
                  <Select value={decisionForm.decisionType} onValueChange={(v) => setDecisionForm(p => ({ ...p, decisionType: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {decisionTypes.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Outcome</Label>
                  <Select value={decisionForm.outcome} onValueChange={(v) => setDecisionForm(p => ({ ...p, outcome: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="accepted">Accepted</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                      <SelectItem value="more_info_requested">More Info Requested</SelectItem>
                      <SelectItem value="conditional">Conditional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Reason / Notes</Label>
                  <Input value={decisionForm.reason} onChange={(e) => setDecisionForm(p => ({ ...p, reason: e.target.value }))} placeholder="Reason for decision..." />
                </div>
                <div className="flex items-end">
                  <Button type="submit" className="w-full" disabled={recordDecision.isPending}>
                    <Gavel className="h-4 w-4 mr-2" />Record
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-2">
            {(data?.decisions ?? []).map((dec: any) => {
              const outcome = outcomeConfig[dec.outcome] || outcomeConfig.accepted;
              const OutcomeIcon = outcome.icon;
              const typeInfo = decisionTypes.find(d => d.value === dec.decisionType);
              const TypeIcon = typeInfo?.icon || Scale;
              return (
                <div key={dec.id} className="rounded-md border p-3">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center mt-0.5">
                        <TypeIcon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{typeInfo?.label || dec.decisionType}</p>
                        {dec.reason && <p className="text-xs text-muted-foreground mt-0.5">{dec.reason}</p>}
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {new Date(dec.createdAt).toLocaleString("th-TH")}
                        </p>
                      </div>
                    </div>
                    <Badge className={`text-[10px] border ${outcome.color}`}>
                      <OutcomeIcon className="h-3 w-3 mr-1" />{outcome.label}
                    </Badge>
                  </div>
                </div>
              );
            })}
            {data?.decisions.length === 0 && <EmptyLine text="No decisions recorded yet." />}
          </div>
        </TabsContent>

        {/* PACKAGES TAB */}
        <TabsContent value="packages" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Send className="h-4 w-4" />Generate CP / SHL / VP package</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="grid grid-cols-1 md:grid-cols-6 gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  generatePackage.mutate({
                    caseType, caseId: caseId!,
                    packageType: packageForm.packageType as PackageType,
                    patientId, hospitalId,
                    recipientName: packageForm.recipientName || undefined,
                    recipientType: packageForm.recipientType as any,
                    includeShl: packageForm.includeShl,
                    claimRef: packageForm.claimRef || undefined,
                    costEstimate: packageForm.estimateAmount ? { amount: packageForm.estimateAmount, currency: packageForm.estimateCurrency } : undefined,
                  });
                }}
              >
                <div className="space-y-2">
                  <Label>Package</Label>
                  <Select value={packageForm.packageType} onValueChange={(v) => setPackageForm((p) => ({ ...p, packageType: v as PackageType }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {packageOptions.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Recipient</Label>
                  <Input value={packageForm.recipientName} onChange={(e) => setPackageForm((p) => ({ ...p, recipientName: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Cost estimate</Label>
                  <Input value={packageForm.estimateAmount} onChange={(e) => setPackageForm((p) => ({ ...p, estimateAmount: e.target.value }))} placeholder="120000" />
                </div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Input value={packageForm.estimateCurrency} onChange={(e) => setPackageForm((p) => ({ ...p, estimateCurrency: e.target.value.toUpperCase() }))} />
                </div>
                <div className="space-y-2">
                  <Label>Claim ref</Label>
                  <Input value={packageForm.claimRef} onChange={(e) => setPackageForm((p) => ({ ...p, claimRef: e.target.value }))} />
                </div>
                <div className="flex items-end">
                  <Button type="submit" className="w-full" disabled={generatePackage.isPending}>
                    <Package className="h-4 w-4 mr-2" />Generate
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-2">
            {(data?.packages ?? []).map((pack: any) => (
              <div key={pack.id} className="rounded-md border p-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-sm">Package #{pack.id} | {pack.packageType?.replace(/_/g, " ")}</p>
                    <p className="text-xs text-muted-foreground">
                      manifest {pack.manifestHash?.slice(0, 18)} | FHIR {pack.fhirBundleHash?.slice(0, 18)}
                    </p>
                    {pack.recipientName && <p className="text-xs text-muted-foreground">→ {pack.recipientName}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge>{pack.status}</Badge>
                    {pack.shlId && <Badge variant="outline">SHL #{pack.shlId}</Badge>}
                    {pack.presentationId && <Badge variant="outline">VP</Badge>}
                  </div>
                </div>
              </div>
            ))}
            {data?.packages.length === 0 && <EmptyLine text="No care packages generated yet." />}
          </div>
        </TabsContent>

        {/* TIMELINE TAB */}
        <TabsContent value="timeline" className="space-y-4">
          <div className="relative pl-6 space-y-4">
            <div className="absolute left-2.5 top-2 bottom-2 w-px bg-border" />
            {(data?.events ?? []).map((evt: any, idx: number) => {
              const Icon = eventTypeIcons[evt.eventType] || Clock;
              return (
                <div key={evt.id || idx} className="relative flex gap-3">
                  <div className="absolute -left-3.5 top-1 h-5 w-5 rounded-full bg-background border-2 border-primary flex items-center justify-center">
                    <Icon className="h-3 w-3 text-primary" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium">{evt.summary}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-[10px]">{evt.eventType?.replace(/_/g, " ")}</Badge>
                      {evt.actorRole && <Badge variant="secondary" className="text-[10px]">{evt.actorRole}</Badge>}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(evt.createdAt).toLocaleString("th-TH")}
                    </p>
                  </div>
                </div>
              );
            })}
            {data?.events.length === 0 && <EmptyLine text="No events recorded yet." />}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Metric({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <p className="text-xs text-muted-foreground">{title}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
