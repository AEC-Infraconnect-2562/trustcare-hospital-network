import { CareTransitionWorkspace } from "@/components/CareTransitionWorkspace";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Handshake, Plug, Send, Upload, Workflow } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const connectorTypes = [
  "fhir_rest",
  "hl7v2_mllp",
  "db_view",
  "cdc",
  "sftp_csv",
  "smart_health_link",
  "native_vc_vp",
  "manual_portal",
] as const;

const documentTypes = [
  "referral_letter",
  "patient_summary",
  "lab_report",
  "imaging_report",
  "passport",
  "insurance_card",
  "guarantee_letter",
  "quotation",
  "visa_support_letter",
  "claim_document",
  "invoice",
  "receipt",
  "discharge_summary",
  "prescription",
  "medical_certificate",
] as const;

type SubmittedCase = {
  caseType: "external_partner" | "cross_border" | "medical_tourist";
  caseId: number;
};

export default function PartnerPortal() {
  const dashboard = trpc.partnerPortal.dashboard.useQuery();
  const connectors = trpc.partnerPortal.listConnectors.useQuery({});
  const [submittedCase, setSubmittedCase] = useState<SubmittedCase>();
  const [connectorForm, setConnectorForm] = useState({
    partnerName: "ASEAN Partner Hospital",
    connectorType: "fhir_rest",
    direction: "bidirectional",
    endpointUrl: "https://partner.example/fhir",
    authType: "oauth2_client_credentials",
    mappingProfile: "trustcare-partner-fhir-r4-v1",
  });
  const [caseForm, setCaseForm] = useState({
    flowType: "external_partner",
    connectorId: "",
    partnerOrgName: "ASEAN Partner Hospital",
    partnerCountry: "SGP",
    language: "en",
    patientId: "",
    serviceLine: "Cardiology",
    contactEmail: "intl@partner.example",
    contactPhone: "",
    payerMode: "insurance",
    reason: "Specialist referral with recent labs and imaging.",
    documentType: "referral_letter",
    documentTitle: "Referral letter and clinical summary",
    fileName: "referral-letter.pdf",
    fileUrl: "",
    translationRequired: false,
  });
  const [outboundForm, setOutboundForm] = useState({
    caseType: "external_partner",
    caseId: "",
    documentType: "quotation",
    title: "Treatment quotation",
    recipientName: "Partner coordinator",
    fileName: "quotation.pdf",
    fileUrl: "",
  });

  const createConnector = trpc.partnerPortal.createConnector.useMutation({
    onSuccess: (result) => {
      connectors.refetch();
      dashboard.refetch();
      toast.success(result.validation.ok ? "Connector saved for testing" : "Connector saved with validation issues");
    },
    onError: (error) => toast.error(error.message),
  });
  const validateConnector = trpc.partnerPortal.validateConnector.useMutation({
    onSuccess: (result) => {
      connectors.refetch();
      toast.success(result.ok ? "Connector validation passed" : result.issues.join(" "));
    },
    onError: (error) => toast.error(error.message),
  });
  const activateConnector = trpc.partnerPortal.activateConnector.useMutation({
    onSuccess: () => {
      connectors.refetch();
      dashboard.refetch();
      toast.success("Connector activated");
    },
    onError: (error) => toast.error(error.message),
  });
  const submitCase = trpc.partnerPortal.submitCase.useMutation({
    onSuccess: (result) => {
      dashboard.refetch();
      if (result.caseId) setSubmittedCase({ caseType: result.caseType as SubmittedCase["caseType"], caseId: result.caseId });
      toast.success(`Partner case submitted: ${result.caseType} #${result.caseId}`);
    },
    onError: (error) => toast.error(error.message),
  });
  const sendDocument = trpc.partnerPortal.sendDocument.useMutation({
    onSuccess: () => {
      dashboard.refetch();
      toast.success("Outbound document registered");
    },
    onError: (error) => toast.error(error.message),
  });

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

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Metric title="Documents" value={dashboard.data?.stats.documents ?? 0} />
          <Metric title="Pending review" value={dashboard.data?.stats.pendingDocuments ?? 0} />
          <Metric title="Active tasks" value={dashboard.data?.stats.activeTasks ?? 0} />
          <Metric title="Connectors" value={dashboard.data?.stats.activeConnectors ?? 0} />
          <Metric title="Packages" value={dashboard.data?.stats.packages ?? 0} />
        </div>

        <Tabs defaultValue="api">
          <TabsList className="flex flex-wrap h-auto justify-start">
            <TabsTrigger value="api"><Plug className="h-4 w-4 mr-2" />API Layer</TabsTrigger>
            <TabsTrigger value="inbound"><Upload className="h-4 w-4 mr-2" />Inbound case</TabsTrigger>
            <TabsTrigger value="outbound"><Send className="h-4 w-4 mr-2" />Outbound docs</TabsTrigger>
            <TabsTrigger value="workbench"><Workflow className="h-4 w-4 mr-2" />Workbench</TabsTrigger>
          </TabsList>

          <TabsContent value="api" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Partner source connector</CardTitle></CardHeader>
              <CardContent>
                <form
                  className="grid grid-cols-1 md:grid-cols-6 gap-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    createConnector.mutate({
                      partnerName: connectorForm.partnerName,
                      connectorType: connectorForm.connectorType as any,
                      direction: connectorForm.direction as any,
                      endpointUrl: connectorForm.endpointUrl || undefined,
                      authType: connectorForm.authType as any,
                      mappingProfile: connectorForm.mappingProfile || undefined,
                      canonicalMapping: {
                        fhirVersion: "4.0.1",
                        resources: ["Patient", "ServiceRequest", "Task", "DocumentReference", "Coverage", "Claim"],
                      },
                      supportedDocumentTypes: [...documentTypes],
                      supportedCredentialTypes: ["patient_summary", "referral_vc", "travel_document_verification", "guarantee_letter", "quotation"],
                    });
                  }}
                >
                  <div className="md:col-span-2 space-y-2">
                    <Label>Partner</Label>
                    <Input value={connectorForm.partnerName} onChange={(event) => setConnectorForm((prev) => ({ ...prev, partnerName: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Connector</Label>
                    <Select value={connectorForm.connectorType} onValueChange={(value) => setConnectorForm((prev) => ({ ...prev, connectorType: value }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {connectorTypes.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Direction</Label>
                    <Select value={connectorForm.direction} onValueChange={(value) => setConnectorForm((prev) => ({ ...prev, direction: value }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="inbound">inbound</SelectItem>
                        <SelectItem value="outbound">outbound</SelectItem>
                        <SelectItem value="bidirectional">bidirectional</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Auth</Label>
                    <Select value={connectorForm.authType} onValueChange={(value) => setConnectorForm((prev) => ({ ...prev, authType: value }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">none</SelectItem>
                        <SelectItem value="api_key">api_key</SelectItem>
                        <SelectItem value="oauth2_client_credentials">oauth2_client_credentials</SelectItem>
                        <SelectItem value="mutual_tls">mutual_tls</SelectItem>
                        <SelectItem value="signed_vp">signed_vp</SelectItem>
                        <SelectItem value="basic">basic</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Mapping</Label>
                    <Input value={connectorForm.mappingProfile} onChange={(event) => setConnectorForm((prev) => ({ ...prev, mappingProfile: event.target.value }))} />
                  </div>
                  <div className="md:col-span-5 space-y-2">
                    <Label>Endpoint / inbox</Label>
                    <Input value={connectorForm.endpointUrl} onChange={(event) => setConnectorForm((prev) => ({ ...prev, endpointUrl: event.target.value }))} />
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
                    <p className="text-xs text-muted-foreground">{connector.connectorType} | {connector.endpointUrl || "portal inbox"} | {connector.mappingProfile || "no mapping profile"}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge>{connector.status}</Badge>
                    <Badge variant="outline">{connector.validationStatus}</Badge>
                    <Button size="sm" variant="outline" onClick={() => validateConnector.mutate({ id: connector.id })}>Validate</Button>
                    <Button size="sm" onClick={() => activateConnector.mutate({ id: connector.id })}>Activate</Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="inbound" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Partner case and document intake</CardTitle></CardHeader>
              <CardContent>
                <form
                  className="grid grid-cols-1 md:grid-cols-6 gap-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    submitCase.mutate({
                      flowType: caseForm.flowType as any,
                      connectorId: Number(caseForm.connectorId || 0) || undefined,
                      partnerOrgName: caseForm.partnerOrgName,
                      partnerCountry: caseForm.partnerCountry,
                      language: caseForm.language as any,
                      patientId: Number(caseForm.patientId || 0) || undefined,
                      serviceLine: caseForm.serviceLine,
                      contactEmail: caseForm.contactEmail,
                      contactPhone: caseForm.contactPhone || undefined,
                      payerMode: caseForm.payerMode as any,
                      reason: caseForm.reason,
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
                    <Label>Flow</Label>
                    <Select value={caseForm.flowType} onValueChange={(value) => setCaseForm((prev) => ({ ...prev, flowType: value }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="external_partner">external_partner</SelectItem>
                        <SelectItem value="cross_border_inbound">cross_border_inbound</SelectItem>
                        <SelectItem value="medical_tourist">medical_tourist</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Connector ID</Label>
                    <Input value={caseForm.connectorId} onChange={(event) => setCaseForm((prev) => ({ ...prev, connectorId: event.target.value }))} />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label>Partner</Label>
                    <Input value={caseForm.partnerOrgName} onChange={(event) => setCaseForm((prev) => ({ ...prev, partnerOrgName: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Country</Label>
                    <Input value={caseForm.partnerCountry} onChange={(event) => setCaseForm((prev) => ({ ...prev, partnerCountry: event.target.value.toUpperCase() }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Patient ID</Label>
                    <Input value={caseForm.patientId} onChange={(event) => setCaseForm((prev) => ({ ...prev, patientId: event.target.value }))} placeholder="Optional" />
                  </div>
                  <div className="space-y-2">
                    <Label>Service line</Label>
                    <Input value={caseForm.serviceLine} onChange={(event) => setCaseForm((prev) => ({ ...prev, serviceLine: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Payer mode</Label>
                    <Select value={caseForm.payerMode} onValueChange={(value) => setCaseForm((prev) => ({ ...prev, payerMode: value }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="self_pay">self_pay</SelectItem>
                        <SelectItem value="insurance">insurance</SelectItem>
                        <SelectItem value="government">government</SelectItem>
                        <SelectItem value="guarantee_letter">guarantee_letter</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label>Contact email</Label>
                    <Input value={caseForm.contactEmail} onChange={(event) => setCaseForm((prev) => ({ ...prev, contactEmail: event.target.value }))} />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label>Reason</Label>
                    <Textarea value={caseForm.reason} onChange={(event) => setCaseForm((prev) => ({ ...prev, reason: event.target.value }))} rows={2} />
                  </div>
                  <div className="space-y-2">
                    <Label>Document type</Label>
                    <Select value={caseForm.documentType} onValueChange={(value) => setCaseForm((prev) => ({ ...prev, documentType: value }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{documentTypes.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label>Document title</Label>
                    <Input value={caseForm.documentTitle} onChange={(event) => setCaseForm((prev) => ({ ...prev, documentTitle: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>File name</Label>
                    <Input value={caseForm.fileName} onChange={(event) => setCaseForm((prev) => ({ ...prev, fileName: event.target.value }))} />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label>File URL</Label>
                    <Input value={caseForm.fileUrl} onChange={(event) => setCaseForm((prev) => ({ ...prev, fileUrl: event.target.value }))} placeholder="Optional" />
                  </div>
                  <div className="flex items-end">
                    <Button type="submit" className="w-full" disabled={submitCase.isPending}>Submit</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="outbound" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Hospital to partner document form</CardTitle></CardHeader>
              <CardContent>
                <form
                  className="grid grid-cols-1 md:grid-cols-6 gap-3"
                  onSubmit={(event) => {
                    event.preventDefault();
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
                    <Select value={outboundForm.caseType} onValueChange={(value) => setOutboundForm((prev) => ({ ...prev, caseType: value }))}>
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
                    <Label>Case ID</Label>
                    <Input type="number" value={outboundForm.caseId} onChange={(event) => setOutboundForm((prev) => ({ ...prev, caseId: event.target.value }))} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Document type</Label>
                    <Select value={outboundForm.documentType} onValueChange={(value) => setOutboundForm((prev) => ({ ...prev, documentType: value }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{documentTypes.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label>Title</Label>
                    <Input value={outboundForm.title} onChange={(event) => setOutboundForm((prev) => ({ ...prev, title: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Recipient</Label>
                    <Input value={outboundForm.recipientName} onChange={(event) => setOutboundForm((prev) => ({ ...prev, recipientName: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>File name</Label>
                    <Input value={outboundForm.fileName} onChange={(event) => setOutboundForm((prev) => ({ ...prev, fileName: event.target.value }))} />
                  </div>
                  <div className="md:col-span-4 space-y-2">
                    <Label>File URL</Label>
                    <Input value={outboundForm.fileUrl} onChange={(event) => setOutboundForm((prev) => ({ ...prev, fileUrl: event.target.value }))} />
                  </div>
                  <div className="flex items-end">
                    <Button type="submit" className="w-full" disabled={sendDocument.isPending}>Send</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="workbench" className="space-y-4">
            <CareTransitionWorkspace
              caseType={submittedCase?.caseType || "external_partner"}
              caseId={submittedCase?.caseId}
              defaultPackageType={submittedCase?.caseType === "medical_tourist" ? "medical_tourist" : "cross_border"}
            />
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
