import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  CheckCircle2, ClipboardList, FileText, Package, PlayCircle, Send, Upload,
  Scale, Clock, AlertCircle, XCircle, HelpCircle, ShieldCheck, Gavel,
  FolderArchive, ChevronDown, ChevronRight, Trash2, Eye, Hash
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { COOKIE_NAME } from "@shared/const";

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

const bundleTypeOptions = [
  { value: "initial_submission", label: "Initial Submission" },
  { value: "follow_up", label: "Follow-up Documents" },
  { value: "lab_results", label: "Lab Results" },
  { value: "imaging", label: "Imaging / Radiology" },
  { value: "legal_documents", label: "Legal Documents" },
  { value: "insurance", label: "Insurance / Claims" },
  { value: "discharge", label: "Discharge Packet" },
  { value: "mixed", label: "Mixed" },
] as const;

const bundleStatusConfig: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "bg-gray-100 text-gray-700 border-gray-300" },
  submitted: { label: "Submitted", color: "bg-blue-100 text-blue-800 border-blue-300" },
  under_review: { label: "Under Review", color: "bg-amber-100 text-amber-800 border-amber-300" },
  accepted: { label: "Accepted", color: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-800 border-red-300" },
  archived: { label: "Archived", color: "bg-slate-100 text-slate-700 border-slate-300" },
};

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

function getAuthHeaders(): Record<string, string> {
  try {
    const demoToken = sessionStorage.getItem("demo_session_token");
    if (demoToken) return { Authorization: `Bearer ${demoToken}` };
    const raw = sessionStorage.getItem("manus-cookie");
    if (raw) {
      const prefix = `${COOKIE_NAME}=`;
      const pair = raw.split(";").find(s => s.trim().startsWith(prefix));
      const token = pair?.trim().slice(prefix.length);
      if (token) return { Authorization: `Bearer ${token}` };
    }
  } catch { /* noop */ }
  return {};
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

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
  const [bundleForm, setBundleForm] = useState({
    title: "", description: "", bundleType: "mixed",
  });
  const [expandedBundles, setExpandedBundles] = useState<Set<number>>(new Set());
  const [uploadProgress, setUploadProgress] = useState<Record<number, number>>({});
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const enabled = Boolean(caseId);
  const workspace = trpc.careTransition.workspace.useQuery(
    { caseType, caseId: caseId || 0 },
    { enabled },
  );
  const bundles = trpc.careTransition.getBundles.useQuery(
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
  const createBundle = trpc.careTransition.createBundle.useMutation({
    onSuccess: () => {
      bundles.refetch();
      setBundleForm({ title: "", description: "", bundleType: "mixed" });
      toast.success("Bundle created");
    },
    onError: (error) => toast.error(error.message),
  });
  const updateBundleStatus = trpc.careTransition.updateBundleStatus.useMutation({
    onSuccess: () => {
      bundles.refetch();
      toast.success("Bundle status updated");
    },
    onError: (error) => toast.error(error.message),
  });
  const removeBundleFile = trpc.careTransition.removeBundleFile.useMutation({
    onSuccess: () => {
      bundles.refetch();
      toast.success("File removed from bundle");
    },
    onError: (error) => toast.error(error.message),
  });

  const toggleBundleExpand = useCallback((bundleId: number) => {
    setExpandedBundles(prev => {
      const next = new Set(prev);
      if (next.has(bundleId)) next.delete(bundleId);
      else next.add(bundleId);
      return next;
    });
  }, []);

  const handleFileUpload = useCallback(async (bundleId: number, files: FileList) => {
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append("files", files[i]);
    }
    formData.append("caseType", caseType);
    formData.append("caseId", String(caseId || 0));
    formData.append("documentType", "other");
    formData.append("direction", "inbound");

    setUploadProgress(prev => ({ ...prev, [bundleId]: 0 }));

    try {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `/api/bundles/${bundleId}/upload`);

      // Add auth headers
      const authHeaders = getAuthHeaders();
      Object.entries(authHeaders).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value);
      });

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(prev => ({ ...prev, [bundleId]: percent }));
        }
      };

      await new Promise<void>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const result = JSON.parse(xhr.responseText);
            toast.success(`${result.filesUploaded} file(s) uploaded successfully`);
            bundles.refetch();
            resolve();
          } else {
            const error = JSON.parse(xhr.responseText);
            reject(new Error(error.error || "Upload failed"));
          }
        };
        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.send(formData);
      });
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploadProgress(prev => {
        const next = { ...prev };
        delete next[bundleId];
        return next;
      });
    }
  }, [caseType, caseId, bundles]);

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
        <Metric title="Bundles" value={bundles.data?.length ?? 0} />
      </div>

      <Tabs defaultValue="documents">
        <TabsList className="flex flex-wrap h-auto justify-start">
          <TabsTrigger value="documents"><FileText className="h-4 w-4 mr-2" />Documents</TabsTrigger>
          <TabsTrigger value="bundles"><FolderArchive className="h-4 w-4 mr-2" />Bundles</TabsTrigger>
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

        {/* BUNDLES TAB */}
        <TabsContent value="bundles" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><FolderArchive className="h-4 w-4" />Create Document Bundle</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="grid grid-cols-1 md:grid-cols-4 gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!bundleForm.title.trim()) { toast.error("Bundle title is required"); return; }
                  createBundle.mutate({
                    caseType,
                    caseId: caseId!,
                    title: bundleForm.title,
                    description: bundleForm.description || undefined,
                    bundleType: bundleForm.bundleType as any,
                  });
                }}
              >
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    value={bundleForm.title}
                    onChange={(e) => setBundleForm(p => ({ ...p, title: e.target.value }))}
                    placeholder="e.g., Initial referral documents"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Bundle Type</Label>
                  <Select value={bundleForm.bundleType} onValueChange={(v) => setBundleForm(p => ({ ...p, bundleType: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {bundleTypeOptions.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    value={bundleForm.description}
                    onChange={(e) => setBundleForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="Optional description..."
                  />
                </div>
                <div className="flex items-end">
                  <Button type="submit" className="w-full" disabled={createBundle.isPending}>
                    <FolderArchive className="h-4 w-4 mr-2" />Create Bundle
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Bundle List */}
          <div className="space-y-3">
            {(bundles.data ?? []).map((bundle: any) => {
              const isExpanded = expandedBundles.has(bundle.id);
              const statusInfo = bundleStatusConfig[bundle.status] || bundleStatusConfig.draft;
              const isDraft = bundle.status === "draft";
              const isReviewable = bundle.status === "submitted" || bundle.status === "under_review";

              return (
                <div key={bundle.id} className="rounded-lg border bg-card">
                  {/* Bundle Header */}
                  <div
                    className="p-4 cursor-pointer flex items-center justify-between gap-3 hover:bg-accent/50 transition-colors rounded-t-lg"
                    onClick={() => toggleBundleExpand(bundle.id)}
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{bundle.title}</p>
                          <Badge className={`text-[10px] border ${statusInfo.color}`}>{statusInfo.label}</Badge>
                          <Badge variant="outline" className="text-[10px]">
                            {bundleTypeOptions.find(t => t.value === bundle.bundleType)?.label || bundle.bundleType}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {bundle.fileCount} file(s) | {formatFileSize(Number(bundle.totalSizeBytes || 0))}
                          {bundle.integrityHash && ` | hash: ${bundle.integrityHash.slice(0, 12)}...`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      {isDraft && bundle.fileCount > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateBundleStatus.mutate({ bundleId: bundle.id, status: "submitted" })}
                          disabled={updateBundleStatus.isPending}
                        >
                          <Send className="h-3 w-3 mr-1" />Submit
                        </Button>
                      )}
                      {isReviewable && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateBundleStatus.mutate({ bundleId: bundle.id, status: "accepted" })}
                            disabled={updateBundleStatus.isPending}
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" />Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600"
                            onClick={() => updateBundleStatus.mutate({ bundleId: bundle.id, status: "rejected" })}
                            disabled={updateBundleStatus.isPending}
                          >
                            <XCircle className="h-3 w-3 mr-1" />Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="border-t px-4 pb-4 pt-3 space-y-3">
                      {bundle.description && (
                        <p className="text-xs text-muted-foreground">{bundle.description}</p>
                      )}

                      {/* File Upload Area (only for draft bundles) */}
                      {isDraft && (
                        <div className="border-2 border-dashed rounded-lg p-4 text-center">
                          <input
                            ref={(el) => { fileInputRefs.current[bundle.id] = el; }}
                            type="file"
                            multiple
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files && e.target.files.length > 0) {
                                handleFileUpload(bundle.id, e.target.files);
                                e.target.value = "";
                              }
                            }}
                          />
                          <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground mb-2">
                            Drop files here or click to upload (max 10 files, 50MB each)
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => fileInputRefs.current[bundle.id]?.click()}
                          >
                            Select Files
                          </Button>
                          {uploadProgress[bundle.id] !== undefined && (
                            <div className="mt-3 space-y-1">
                              <Progress value={uploadProgress[bundle.id]} className="h-2" />
                              <p className="text-xs text-muted-foreground">{uploadProgress[bundle.id]}% uploaded</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* File List */}
                      <BundleFileList
                        bundleId={bundle.id}
                        isDraft={isDraft}
                        onRemoveFile={(fileId) => removeBundleFile.mutate({ fileId, bundleId: bundle.id })}
                      />

                      {/* Bundle Metadata */}
                      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-2 border-t">
                        <span>Created: {new Date(bundle.createdAt).toLocaleString("th-TH")}</span>
                        {bundle.submittedBy && <span>Submitted by: #{bundle.submittedBy}</span>}
                        {bundle.reviewedBy && <span>Reviewed by: #{bundle.reviewedBy}</span>}
                        {bundle.reviewedAt && <span>Reviewed: {new Date(bundle.reviewedAt).toLocaleString("th-TH")}</span>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {bundles.data?.length === 0 && <EmptyLine text="No document bundles yet. Create one above to group related files." />}
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

/** Sub-component: Loads and displays files within a bundle */
function BundleFileList({ bundleId, isDraft, onRemoveFile }: { bundleId: number; isDraft: boolean; onRemoveFile: (fileId: number) => void }) {
  const bundleDetail = trpc.careTransition.getBundleWithFiles.useQuery({ bundleId });
  const files = (bundleDetail.data as any)?.files ?? [];

  if (bundleDetail.isLoading) {
    return <p className="text-xs text-muted-foreground animate-pulse">Loading files...</p>;
  }

  if (files.length === 0) {
    return <p className="text-xs text-muted-foreground italic">No files in this bundle yet.</p>;
  }

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground mb-1">Files ({files.length})</p>
      {files.map((file: any) => (
        <div key={file.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="font-medium text-xs truncate">{file.fileName || file.title}</p>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span>{file.mimeType || "unknown"}</span>
                {file.fileSize && <span>{formatFileSize(Number(file.fileSize))}</span>}
                {file.hash && (
                  <span className="flex items-center gap-0.5">
                    <Hash className="h-2.5 w-2.5" />{file.hash.slice(0, 8)}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {file.fileUrl && (
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" asChild>
                <a href={file.fileUrl} target="_blank" rel="noopener noreferrer">
                  <Eye className="h-3.5 w-3.5" />
                </a>
              </Button>
            )}
            {isDraft && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                onClick={() => onRemoveFile(file.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      ))}
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
