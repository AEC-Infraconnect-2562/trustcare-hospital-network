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
import { CheckCircle2, ClipboardList, FileText, Package, PlayCircle, Send, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type CaseType = "internal_referral" | "cross_branch" | "cross_border" | "external_partner" | "medical_tourist";
type PackageType = "referral" | "cross_border" | "medical_tourist" | "discharge" | "counter_referral" | "claim";

const caseDocumentTypes = [
  "referral_letter",
  "patient_summary",
  "lab_report",
  "imaging_report",
  "passport",
  "insurance_card",
  "guarantee_letter",
  "quotation",
  "visa_support_letter",
  "consent",
  "claim_document",
  "invoice",
  "receipt",
  "discharge_summary",
  "prescription",
  "medical_certificate",
  "other",
] as const;

const documentLabels: Record<string, string> = {
  referral_letter: "Referral letter",
  patient_summary: "Patient summary",
  lab_report: "Lab report",
  imaging_report: "Imaging report",
  passport: "Passport",
  insurance_card: "Insurance card",
  guarantee_letter: "Guarantee letter",
  quotation: "Quotation",
  visa_support_letter: "Visa support letter",
  consent: "Consent",
  claim_document: "Claim document",
  invoice: "Invoice",
  receipt: "Receipt",
  discharge_summary: "Discharge summary",
  prescription: "Prescription",
  medical_certificate: "Medical certificate",
  other: "Other",
};

const packageOptions: PackageType[] = ["referral", "cross_border", "medical_tourist", "discharge", "counter_referral", "claim"];

export function CareTransitionWorkspace({
  caseType,
  caseId,
  patientId,
  hospitalId,
  recipientName,
  defaultPackageType,
}: {
  caseType: CaseType;
  caseId?: number;
  patientId?: number;
  hospitalId?: number;
  recipientName?: string;
  defaultPackageType?: PackageType;
}) {
  const [docForm, setDocForm] = useState({
    direction: "inbound",
    documentType: "referral_letter",
    title: "",
    fileName: "",
    fileUrl: "",
    notes: "",
  });
  const [packageForm, setPackageForm] = useState({
    packageType: defaultPackageType || "referral",
    recipientName: recipientName || "",
    recipientType: "partner_hospital",
    claimRef: "",
    estimateAmount: "",
    estimateCurrency: "THB",
    includeShl: true,
  });

  const enabled = Boolean(caseId);
  const workspace = trpc.careTransition.workspace.useQuery(
    { caseType, caseId: caseId || 0 },
    { enabled },
  );
  const initializeCase = trpc.careTransition.initializeCase.useMutation({
    onSuccess: () => {
      workspace.refetch();
      toast.success("Workflow initialized");
    },
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
    onSuccess: () => {
      workspace.refetch();
      toast.success("Task updated");
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric title="Documents" value={data?.documents.length ?? 0} />
        <Metric title="Open tasks" value={data?.tasks.filter((task: any) => !["completed", "cancelled"].includes(task.status)).length ?? 0} />
        <Metric title="Packages" value={data?.packages.length ?? 0} />
        <Metric title="Decisions" value={data?.decisions.length ?? 0} />
      </div>

      <Tabs defaultValue="documents">
        <TabsList className="flex flex-wrap h-auto justify-start">
          <TabsTrigger value="documents"><FileText className="h-4 w-4 mr-2" />Documents</TabsTrigger>
          <TabsTrigger value="tasks"><ClipboardList className="h-4 w-4 mr-2" />Tasks</TabsTrigger>
          <TabsTrigger value="packages"><Package className="h-4 w-4 mr-2" />Packages</TabsTrigger>
        </TabsList>

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
                  if (!docForm.title.trim()) {
                    toast.error("Document title is required");
                    return;
                  }
                  addDocument.mutate({
                    caseType,
                    caseId: caseId!,
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
                  <Select value={docForm.direction} onValueChange={(value) => setDocForm((prev) => ({ ...prev, direction: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inbound">Inbound</SelectItem>
                      <SelectItem value="outbound">Outbound</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={docForm.documentType} onValueChange={(value) => setDocForm((prev) => ({ ...prev, documentType: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {caseDocumentTypes.map((type) => <SelectItem key={type} value={type}>{documentLabels[type]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2 space-y-2">
                  <Label>Title</Label>
                  <Input value={docForm.title} onChange={(event) => setDocForm((prev) => ({ ...prev, title: event.target.value }))} placeholder="Referral letter, passport scan, guarantee letter" />
                </div>
                <div className="space-y-2">
                  <Label>File name</Label>
                  <Input value={docForm.fileName} onChange={(event) => setDocForm((prev) => ({ ...prev, fileName: event.target.value }))} placeholder="file.pdf" />
                </div>
                <div className="space-y-2">
                  <Label>URL / key</Label>
                  <Input value={docForm.fileUrl} onChange={(event) => setDocForm((prev) => ({ ...prev, fileUrl: event.target.value }))} placeholder="s3:// or https://" />
                </div>
                <div className="md:col-span-5 space-y-2">
                  <Label>Notes</Label>
                  <Textarea value={docForm.notes} onChange={(event) => setDocForm((prev) => ({ ...prev, notes: event.target.value }))} rows={2} />
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
            {(data?.documents ?? []).map((document: any) => (
              <div key={document.id} className="rounded-md border p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-sm">{document.title}</p>
                    <Badge variant="outline">{documentLabels[document.documentType] || document.documentType}</Badge>
                    <Badge variant={document.direction === "outbound" ? "default" : "secondary"}>{document.direction}</Badge>
                    <Badge>{document.verificationStatus}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {document.fhirDocumentReferenceId} {document.hash ? `| hash ${String(document.hash).slice(0, 16)}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => verifyDocument.mutate({ id: document.id, verificationStatus: "verified" })}>
                    <CheckCircle2 className="h-3 w-3 mr-1" />Verify
                  </Button>
                  <Button size="sm" onClick={() => verifyDocument.mutate({ id: document.id, verificationStatus: "converted_to_vc", createVcRequest: true })}>
                    Submit VC
                  </Button>
                </div>
              </div>
            ))}
            {data?.documents.length === 0 && <EmptyLine text="No case documents yet." />}
          </div>
        </TabsContent>

        <TabsContent value="tasks" className="space-y-4">
          <div className="flex justify-between gap-3">
            <p className="text-sm text-muted-foreground">FHIR Task style operational checklist for intake, triage, finance, package dispatch, discharge, and sync-back.</p>
            <Button variant="outline" onClick={() => initializeCase.mutate({ caseType, caseId: caseId! })} disabled={initializeCase.isPending}>
              <PlayCircle className="h-4 w-4 mr-2" />Initialize
            </Button>
          </div>
          <div className="space-y-2">
            {(data?.tasks ?? []).map((task: any) => (
              <div key={task.id} className="rounded-md border p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-sm">{task.title}</p>
                  <p className="text-xs text-muted-foreground">{task.taskType} | owner {task.ownerRole || "unassigned"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={task.status === "completed" ? "default" : "secondary"}>{task.status}</Badge>
                  <Button size="sm" variant="outline" onClick={() => updateTask.mutate({ id: task.id, status: "completed", output: { completedFrom: "care_transition_workspace" } })}>
                    Complete
                  </Button>
                </div>
              </div>
            ))}
            {data?.tasks.length === 0 && <EmptyLine text="No tasks yet. Initialize the workflow to create the checklist." />}
          </div>
        </TabsContent>

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
                    caseType,
                    caseId: caseId!,
                    packageType: packageForm.packageType as PackageType,
                    patientId,
                    hospitalId,
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
                  <Select value={packageForm.packageType} onValueChange={(value) => setPackageForm((prev) => ({ ...prev, packageType: value as PackageType }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {packageOptions.map((type) => <SelectItem key={type} value={type}>{type.replace(/_/g, " ")}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Recipient</Label>
                  <Input value={packageForm.recipientName} onChange={(event) => setPackageForm((prev) => ({ ...prev, recipientName: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Cost estimate</Label>
                  <Input value={packageForm.estimateAmount} onChange={(event) => setPackageForm((prev) => ({ ...prev, estimateAmount: event.target.value }))} placeholder="120000" />
                </div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Input value={packageForm.estimateCurrency} onChange={(event) => setPackageForm((prev) => ({ ...prev, estimateCurrency: event.target.value.toUpperCase() }))} />
                </div>
                <div className="space-y-2">
                  <Label>Claim ref</Label>
                  <Input value={packageForm.claimRef} onChange={(event) => setPackageForm((prev) => ({ ...prev, claimRef: event.target.value }))} />
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
                    <p className="font-medium text-sm">Package #{pack.id} | {pack.packageType}</p>
                    <p className="text-xs text-muted-foreground">manifest {pack.manifestHash?.slice(0, 18)} | FHIR {pack.fhirBundleHash?.slice(0, 18)}</p>
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
