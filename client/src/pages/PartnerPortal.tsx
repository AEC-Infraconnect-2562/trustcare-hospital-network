import { CareTransitionWorkspace } from "@/components/CareTransitionWorkspace";
import DashboardLayout from "@/components/DashboardLayout";
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
  ArrowLeft, CheckCircle2, FileText, Handshake, Inbox, Plug, Plus, Send, Upload, Workflow,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const connectorTypes = [
  "fhir_rest", "hl7v2_mllp", "db_view", "cdc", "sftp_csv",
  "smart_health_link", "native_vc_vp", "manual_portal",
] as const;

const documentTypes = [
  "referral_letter", "patient_summary", "lab_report", "imaging_report",
  "passport", "insurance_card", "guarantee_letter", "quotation",
  "visa_support_letter", "claim_document", "invoice", "receipt",
  "discharge_summary", "prescription", "medical_certificate",
] as const;

type ViewMode = "list" | "detail";
type SelectedCase = { caseType: "external_partner" | "cross_border" | "medical_tourist"; caseId: number };

export default function PartnerPortal() {
  const dashboard = trpc.partnerPortal.dashboard.useQuery();
  const connectors = trpc.partnerPortal.listConnectors.useQuery({});
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedCase, setSelectedCase] = useState<SelectedCase>();
  const [activeTab, setActiveTab] = useState("cases");

  // Connector form
  const [connectorForm, setConnectorForm] = useState({
    partnerName: "", connectorType: "fhir_rest", direction: "bidirectional",
    endpointUrl: "", authType: "oauth2_client_credentials", mappingProfile: "",
  });
  // Case intake form
  const [caseForm, setCaseForm] = useState({
    flowType: "external_partner", connectorId: "", partnerOrgName: "",
    partnerCountry: "", language: "en", patientId: "", serviceLine: "",
    contactEmail: "", contactPhone: "", payerMode: "insurance",
    reason: "", documentType: "referral_letter", documentTitle: "",
    fileName: "", fileUrl: "", translationRequired: false,
  });
  // Outbound form
  const [outboundForm, setOutboundForm] = useState({
    caseType: "external_partner", caseId: "", documentType: "quotation",
    title: "", recipientName: "", fileName: "", fileUrl: "",
  });

  const createConnector = trpc.partnerPortal.createConnector.useMutation({
    onSuccess: (result) => {
      connectors.refetch(); dashboard.refetch();
      setConnectorForm(p => ({ ...p, partnerName: "", endpointUrl: "", mappingProfile: "" }));
      toast.success(result.validation.ok ? "Connector saved for testing" : "Connector saved with validation issues");
    },
    onError: (error) => toast.error(error.message),
  });
  const validateConnector = trpc.partnerPortal.validateConnector.useMutation({
    onSuccess: (result) => { connectors.refetch(); toast.success(result.ok ? "Validation passed" : result.issues.join(" ")); },
    onError: (error) => toast.error(error.message),
  });
  const activateConnector = trpc.partnerPortal.activateConnector.useMutation({
    onSuccess: () => { connectors.refetch(); dashboard.refetch(); toast.success("Connector activated"); },
    onError: (error) => toast.error(error.message),
  });
  const submitCase = trpc.partnerPortal.submitCase.useMutation({
    onSuccess: (result) => {
      dashboard.refetch();
      if (result.caseId) {
        setSelectedCase({ caseType: result.caseType as SelectedCase["caseType"], caseId: result.caseId });
        setViewMode("detail");
      }
      toast.success(`Partner case submitted: ${result.caseType} #${result.caseId}`);
    },
    onError: (error) => toast.error(error.message),
  });
  const sendDocument = trpc.partnerPortal.sendDocument.useMutation({
    onSuccess: () => { dashboard.refetch(); toast.success("Outbound document registered"); },
    onError: (error) => toast.error(error.message),
  });

  // Case detail view
  if (viewMode === "detail" && selectedCase) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <Button variant="ghost" size="sm" onClick={() => setViewMode("list")}>
            <ArrowLeft className="h-4 w-4 mr-2" />Back to Partner Portal
          </Button>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">
              Case #{selectedCase.caseId} — {selectedCase.caseType.replace(/_/g, " ")}
            </h2>
            <Badge variant="outline">{selectedCase.caseType}</Badge>
          </div>
          <CareTransitionWorkspace
            caseType={selectedCase.caseType}
            caseId={selectedCase.caseId}
            defaultPackageType={selectedCase.caseType === "medical_tourist" ? "medical_tourist" : "cross_border"}
          />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <Handshake className="h-6 w-6 text-primary" />
              Partner Portal
            </h1>
            <p className="text-sm text-muted-foreground">Partner API layer, inbound/outbound document exchange, delegated VC/VP care packages.</p>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Metric title="Total cases" value={(dashboard.data?.stats.documents ?? 0)} />
          <Metric title="Pending review" value={dashboard.data?.stats.pendingDocuments ?? 0} />
          <Metric title="Active tasks" value={dashboard.data?.stats.activeTasks ?? 0} />
          <Metric title="Connectors" value={dashboard.data?.stats.activeConnectors ?? 0} />
          <Metric title="Packages" value={dashboard.data?.stats.packages ?? 0} />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex flex-wrap h-auto justify-start">
            <TabsTrigger value="cases"><Inbox className="h-4 w-4 mr-2" />Cases</TabsTrigger>
            <TabsTrigger value="connectors"><Plug className="h-4 w-4 mr-2" />Connectors</TabsTrigger>
            <TabsTrigger value="intake"><Plus className="h-4 w-4 mr-2" />New Case</TabsTrigger>
            <TabsTrigger value="outbound"><Send className="h-4 w-4 mr-2" />Outbound</TabsTrigger>
          </TabsList>

          {/* CASES TAB - Persistent list from backend */}
          <TabsContent value="cases" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />Inbound Cases &amp; Documents
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(!dashboard.data?.inboundDocuments || dashboard.data.inboundDocuments.length === 0) ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Inbox className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No inbound cases yet. Submit a case from the "New Case" tab.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {dashboard.data.inboundDocuments.map((doc: any) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => {
                          setSelectedCase({ caseType: doc.caseType, caseId: doc.caseId });
                          setViewMode("detail");
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <FileText className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{doc.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {doc.caseType?.replace(/_/g, " ")} #{doc.caseId} | {doc.documentType} | from {doc.sourceSystem || "partner"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={doc.verificationStatus === "verified" ? "bg-emerald-100 text-emerald-800" : doc.verificationStatus === "rejected" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}>
                            {doc.verificationStatus}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Outbound packages */}
            {dashboard.data?.outboundPackages && dashboard.data.outboundPackages.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Send className="h-4 w-4" />Outbound Packages</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {dashboard.data.outboundPackages.map((pack: any) => (
                      <div
                        key={pack.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => {
                          setSelectedCase({ caseType: pack.caseType, caseId: pack.caseId });
                          setViewMode("detail");
                        }}
                      >
                        <div>
                          <p className="font-medium text-sm">Package #{pack.id} — {pack.packageType?.replace(/_/g, " ")}</p>
                          <p className="text-xs text-muted-foreground">
                            {pack.caseType?.replace(/_/g, " ")} #{pack.caseId} {pack.recipientName ? `→ ${pack.recipientName}` : ""}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Badge>{pack.status}</Badge>
                          {pack.shlId && <Badge variant="outline">SHL</Badge>}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* CONNECTORS TAB */}
          <TabsContent value="connectors" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Register partner source connector</CardTitle></CardHeader>
              <CardContent>
                <form
                  className="grid grid-cols-1 md:grid-cols-6 gap-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!connectorForm.partnerName.trim()) { toast.error("Partner name required"); return; }
                    createConnector.mutate({
                      partnerName: connectorForm.partnerName,
                      connectorType: connectorForm.connectorType as any,
                      direction: connectorForm.direction as any,
                      endpointUrl: connectorForm.endpointUrl || undefined,
                      authType: connectorForm.authType as any,
                      mappingProfile: connectorForm.mappingProfile || undefined,
                      canonicalMapping: { fhirVersion: "4.0.1", resources: ["Patient", "ServiceRequest", "Task", "DocumentReference", "Coverage", "Claim"] },
                      supportedDocumentTypes: [...documentTypes],
                      supportedCredentialTypes: ["patient_summary", "referral_vc", "travel_document_verification", "guarantee_letter", "quotation"],
                    });
                  }}
                >
                  <div className="md:col-span-2 space-y-2">
                    <Label>Partner name</Label>
                    <Input value={connectorForm.partnerName} onChange={(e) => setConnectorForm(p => ({ ...p, partnerName: e.target.value }))} placeholder="Bangkok Hospital, SGH..." />
                  </div>
                  <div className="space-y-2">
                    <Label>Connector type</Label>
                    <Select value={connectorForm.connectorType} onValueChange={(v) => setConnectorForm(p => ({ ...p, connectorType: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{connectorTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Direction</Label>
                    <Select value={connectorForm.direction} onValueChange={(v) => setConnectorForm(p => ({ ...p, direction: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="inbound">inbound</SelectItem>
                        <SelectItem value="outbound">outbound</SelectItem>
                        <SelectItem value="bidirectional">bidirectional</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Auth type</Label>
                    <Select value={connectorForm.authType} onValueChange={(v) => setConnectorForm(p => ({ ...p, authType: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">none</SelectItem>
                        <SelectItem value="api_key">api_key</SelectItem>
                        <SelectItem value="oauth2_client_credentials">oauth2</SelectItem>
                        <SelectItem value="mutual_tls">mutual_tls</SelectItem>
                        <SelectItem value="signed_vp">signed_vp</SelectItem>
                        <SelectItem value="basic">basic</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Mapping profile</Label>
                    <Input value={connectorForm.mappingProfile} onChange={(e) => setConnectorForm(p => ({ ...p, mappingProfile: e.target.value }))} placeholder="trustcare-fhir-r4-v1" />
                  </div>
                  <div className="md:col-span-5 space-y-2">
                    <Label>Endpoint URL</Label>
                    <Input value={connectorForm.endpointUrl} onChange={(e) => setConnectorForm(p => ({ ...p, endpointUrl: e.target.value }))} placeholder="https://partner.example/fhir" />
                  </div>
                  <div className="flex items-end">
                    <Button type="submit" className="w-full" disabled={createConnector.isPending}>Save</Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <div className="space-y-2">
              {connectors.data?.map((connector: any) => (
                <div key={connector.id} className="rounded-md border p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <p className="font-medium text-sm">{connector.partnerName}</p>
                    <p className="text-xs text-muted-foreground">
                      {connector.connectorType} | {connector.direction} | {connector.endpointUrl || "portal inbox"} | {connector.mappingProfile || "no mapping"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge>{connector.status}</Badge>
                    <Badge variant="outline">{connector.validationStatus}</Badge>
                    <Button size="sm" variant="outline" onClick={() => validateConnector.mutate({ id: connector.id })} disabled={validateConnector.isPending}>
                      <CheckCircle2 className="h-3 w-3 mr-1" />Validate
                    </Button>
                    {connector.status !== "active" && (
                      <Button size="sm" onClick={() => activateConnector.mutate({ id: connector.id })} disabled={activateConnector.isPending}>
                        Activate
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {(!connectors.data || connectors.data.length === 0) && (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No connectors registered yet.
                </div>
              )}
            </div>
          </TabsContent>

          {/* NEW CASE INTAKE TAB */}
          <TabsContent value="intake" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Partner case and document intake</CardTitle></CardHeader>
              <CardContent>
                <form
                  className="grid grid-cols-1 md:grid-cols-6 gap-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!caseForm.partnerOrgName.trim()) { toast.error("Partner name required"); return; }
                    submitCase.mutate({
                      flowType: caseForm.flowType as any,
                      connectorId: Number(caseForm.connectorId || 0) || undefined,
                      partnerOrgName: caseForm.partnerOrgName,
                      partnerCountry: caseForm.partnerCountry || undefined,
                      language: caseForm.language as any,
                      patientId: Number(caseForm.patientId || 0) || undefined,
                      serviceLine: caseForm.serviceLine || undefined,
                      contactEmail: caseForm.contactEmail || undefined,
                      contactPhone: caseForm.contactPhone || undefined,
                      payerMode: caseForm.payerMode as any,
                      reason: caseForm.reason || undefined,
                      translationRequired: caseForm.translationRequired,
                      documents: caseForm.documentTitle ? [{
                        documentType: caseForm.documentType as any,
                        title: caseForm.documentTitle,
                        fileName: caseForm.fileName || undefined,
                        fileUrl: caseForm.fileUrl || undefined,
                      }] : [],
                    });
                  }}
                >
                  <div className="space-y-2">
                    <Label>Flow type</Label>
                    <Select value={caseForm.flowType} onValueChange={(v) => setCaseForm(p => ({ ...p, flowType: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="external_partner">External partner</SelectItem>
                        <SelectItem value="cross_border_inbound">Cross-border inbound</SelectItem>
                        <SelectItem value="medical_tourist">Medical tourist</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Connector ID</Label>
                    <Input value={caseForm.connectorId} onChange={(e) => setCaseForm(p => ({ ...p, connectorId: e.target.value }))} placeholder="Optional" />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label>Partner org name *</Label>
                    <Input value={caseForm.partnerOrgName} onChange={(e) => setCaseForm(p => ({ ...p, partnerOrgName: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Country (ISO 3)</Label>
                    <Input value={caseForm.partnerCountry} onChange={(e) => setCaseForm(p => ({ ...p, partnerCountry: e.target.value.toUpperCase() }))} placeholder="SGP, JPN..." />
                  </div>
                  <div className="space-y-2">
                    <Label>Patient ID</Label>
                    <Input value={caseForm.patientId} onChange={(e) => setCaseForm(p => ({ ...p, patientId: e.target.value }))} placeholder="Optional" />
                  </div>
                  <div className="space-y-2">
                    <Label>Service line</Label>
                    <Input value={caseForm.serviceLine} onChange={(e) => setCaseForm(p => ({ ...p, serviceLine: e.target.value }))} placeholder="Cardiology..." />
                  </div>
                  <div className="space-y-2">
                    <Label>Payer mode</Label>
                    <Select value={caseForm.payerMode} onValueChange={(v) => setCaseForm(p => ({ ...p, payerMode: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="self_pay">Self pay</SelectItem>
                        <SelectItem value="insurance">Insurance</SelectItem>
                        <SelectItem value="government">Government</SelectItem>
                        <SelectItem value="guarantee_letter">Guarantee letter</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label>Contact email</Label>
                    <Input value={caseForm.contactEmail} onChange={(e) => setCaseForm(p => ({ ...p, contactEmail: e.target.value }))} />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label>Reason / clinical notes</Label>
                    <Textarea value={caseForm.reason} onChange={(e) => setCaseForm(p => ({ ...p, reason: e.target.value }))} rows={2} />
                  </div>

                  <Separator className="md:col-span-6" />
                  <p className="md:col-span-6 text-xs text-muted-foreground font-medium">Initial document (optional)</p>

                  <div className="space-y-2">
                    <Label>Document type</Label>
                    <Select value={caseForm.documentType} onValueChange={(v) => setCaseForm(p => ({ ...p, documentType: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{documentTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label>Document title</Label>
                    <Input value={caseForm.documentTitle} onChange={(e) => setCaseForm(p => ({ ...p, documentTitle: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>File name</Label>
                    <Input value={caseForm.fileName} onChange={(e) => setCaseForm(p => ({ ...p, fileName: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>File URL</Label>
                    <Input value={caseForm.fileUrl} onChange={(e) => setCaseForm(p => ({ ...p, fileUrl: e.target.value }))} placeholder="Optional" />
                  </div>
                  <div className="flex items-end">
                    <Button type="submit" className="w-full" disabled={submitCase.isPending}>
                      <Upload className="h-4 w-4 mr-2" />Submit
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* OUTBOUND TAB */}
          <TabsContent value="outbound" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Hospital → Partner document</CardTitle></CardHeader>
              <CardContent>
                <form
                  className="grid grid-cols-1 md:grid-cols-6 gap-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!outboundForm.caseId) { toast.error("Case ID required"); return; }
                    sendDocument.mutate({
                      caseType: outboundForm.caseType as any,
                      caseId: Number(outboundForm.caseId),
                      documentType: outboundForm.documentType as any,
                      title: outboundForm.title,
                      recipientName: outboundForm.recipientName || undefined,
                      fileName: outboundForm.fileName || undefined,
                      fileUrl: outboundForm.fileUrl || undefined,
                    });
                  }}
                >
                  <div className="space-y-2">
                    <Label>Case type</Label>
                    <Select value={outboundForm.caseType} onValueChange={(v) => setOutboundForm(p => ({ ...p, caseType: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="internal_referral">internal_referral</SelectItem>
                        <SelectItem value="cross_border">cross_border</SelectItem>
                        <SelectItem value="external_partner">external_partner</SelectItem>
                        <SelectItem value="medical_tourist">medical_tourist</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Case ID *</Label>
                    <Input type="number" value={outboundForm.caseId} onChange={(e) => setOutboundForm(p => ({ ...p, caseId: e.target.value }))} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Document type</Label>
                    <Select value={outboundForm.documentType} onValueChange={(v) => setOutboundForm(p => ({ ...p, documentType: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{documentTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label>Title</Label>
                    <Input value={outboundForm.title} onChange={(e) => setOutboundForm(p => ({ ...p, title: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Recipient</Label>
                    <Input value={outboundForm.recipientName} onChange={(e) => setOutboundForm(p => ({ ...p, recipientName: e.target.value }))} />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label>File name</Label>
                    <Input value={outboundForm.fileName} onChange={(e) => setOutboundForm(p => ({ ...p, fileName: e.target.value }))} />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label>File URL</Label>
                    <Input value={outboundForm.fileUrl} onChange={(e) => setOutboundForm(p => ({ ...p, fileUrl: e.target.value }))} placeholder="Optional" />
                  </div>
                  <div className="flex items-end">
                    <Button type="submit" className="w-full" disabled={sendDocument.isPending}>
                      <Send className="h-4 w-4 mr-2" />Send
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
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
