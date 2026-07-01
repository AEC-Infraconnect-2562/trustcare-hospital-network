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
import { CheckCircle2, ClipboardCheck, Database, FileBadge, FileJson2, KeyRound, Pill, RefreshCcw, ShieldCheck, Tags, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const sampleHisPayload = {
  patient: {
    hn: "HN-10045",
    cid: "1101700203456",
    name: "Somchai Jaidee",
    birthDate: "1985-03-15",
    sex: "M",
    phone: "+66812345678",
  },
  encounter: { vn: "VN-20260701-001", class: "OPD", visitDate: "2026-07-01T02:00:00Z" },
  allergies: [{ substance: "Penicillin", severity: "high", reaction: "Anaphylaxis" }],
  medications: [{ code: "TMT-123", name: "Metformin 500mg", frequency: "1 tab twice daily" }],
  diagnoses: [{ code: "E11", display: "Type 2 diabetes mellitus", status: "active" }],
  labs: [{ loinc: "4548-4", name: "HbA1c", value: "7.8", unit: "%", abnormalFlag: "H", specimenDate: "2026-06-30" }],
};

export default function PortabilityWorkbench() {
  const [sourceFormat, setSourceFormat] = useState("db_view");
  const [payload, setPayload] = useState(JSON.stringify(sampleHisPayload, null, 2));
  const [latestJwt, setLatestJwt] = useState("");
  const [verifyInput, setVerifyInput] = useState("");
  const [csvText, setCsvText] = useState("");

  const canonicalize = trpc.portability.canonicalizeHis.useMutation({
    onSuccess: () => toast.success("Canonical FHIR bundle generated"),
    onError: (error) => toast.error(error.message),
  });
  const packet = trpc.portability.createPacket.useMutation({
    onSuccess: (data) => {
      setLatestJwt(data.presentation.jwt);
      setVerifyInput(data.presentation.jwt);
      toast.success("VC presentation package created");
    },
    onError: (error) => toast.error(error.message),
  });
  const certificate = trpc.portability.issueMedicalCertificate.useMutation({
    onSuccess: () => toast.success("Medical certificate request submitted for Checker review"),
    onError: (error) => toast.error(error.message),
  });
  const prescription = trpc.portability.issuePrescription.useMutation({
    onSuccess: () => toast.success("Prescription request submitted for Checker review"),
    onError: (error) => toast.error(error.message),
  });
  const verify = trpc.portability.verify.useMutation({
    onSuccess: (data) => toast[data.verified ? "success" : "error"](data.verified ? "Verified" : "Verification failed"),
  });
  const syncTargets = trpc.portability.syncTargets.useQuery();
  const productionReadiness = trpc.portability.productionReadiness.useQuery();
  const reconciliationJobs = trpc.portability.reconciliationJobs.useQuery({ limit: 10 });
  const syncPlan = trpc.portability.planSyncBack.useMutation({
    onSuccess: () => toast.success("Sync-back plan generated"),
    onError: (error) => toast.error(error.message),
  });
  const syncExecute = trpc.portability.executeSyncBack.useMutation({
    onSuccess: (data) => {
      setLatestJwt(data.syncReceiptCredential.jwt);
      setVerifyInput(data.syncReceiptCredential.jwt);
      toast.success("Sync receipt VC issued");
    },
    onError: (error) => toast.error(error.message),
  });
  const demoSeed = trpc.portability.demoSeed.useQuery({ patientsPerHospital: 12 });
  const labels = trpc.portability.standardLabels.useQuery();
  const didDocs = trpc.portability.didDocuments.useQuery({ hospitalCode: "TCC", patientSeed: "P001", carepassId: "CP-TH-2026-000001" });
  const connectors = trpc.portability.sourceTruthConnectors.useQuery();
  const seedBatches = trpc.portability.seedBatches.useQuery({ limit: 10 });
  const issuedPresentations = trpc.portability.issuedPresentations.useQuery({ limit: 10 });
  const issuanceRequests = trpc.credential.issuanceRequests.useQuery({ limit: 10 });
  const reviewCsv = trpc.portability.reviewCsvImport.useMutation({
    onSuccess: () => toast.success("CSV reviewed against canonical mapping"),
    onError: (error) => toast.error(error.message),
  });
  const canonicalizeDraft = trpc.portability.canonicalizeDraft.useMutation({
    onSuccess: () => toast.success("Reviewed draft canonicalized"),
    onError: (error) => toast.error(error.message),
  });
  const reseedDb = trpc.portability.reseedDb.useMutation({
    onSuccess: async () => {
      toast.success("VC/VP seed data reseeded in DB");
      await Promise.all([seedBatches.refetch(), issuedPresentations.refetch(), issuanceRequests.refetch()]);
    },
    onError: (error) => toast.error(error.message),
  });
  const approveRequest = trpc.credential.approveIssuanceRequest.useMutation({
    onSuccess: async (data) => {
      setLatestJwt(data.credential.jwt);
      setVerifyInput(data.credential.jwt);
      toast.success("Checker issued VC");
      await issuanceRequests.refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const parsedPayload = useMemo(() => {
    try {
      return JSON.parse(payload);
    } catch {
      return null;
    }
  }, [payload]);

  const firstTarget = syncTargets.data?.[0];
  const firstReadyDraft = (reviewCsv.data?.drafts as any[] | undefined)?.find((draft) => draft.status === "ready");
  const firstSubmittedRequest = issuanceRequests.data?.find((request) => request.status === "submitted");
  const sampleMedicationRequest = {
    resourceType: "MedicationRequest",
    id: "rx-demo-001",
    status: "active",
    intent: "order",
    medicationCodeableConcept: { text: "Metformin 500mg" },
    subject: { reference: "Patient/HN-10045", display: "Somchai Jaidee" },
    authoredOn: new Date().toISOString(),
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Patient Data Portability</h1>
            <p className="text-muted-foreground text-sm mt-1">
              FHIR canonicalization, VC-only document issuance, verification, and HIS sync-back planning.
            </p>
          </div>
          <Badge variant="secondary" className="shrink-0">FHIR R4 + VC</Badge>
        </div>

        <Tabs defaultValue="canonical">
          <TabsList>
            <TabsTrigger value="canonical" className="gap-2"><FileJson2 className="h-3.5 w-3.5" />Canonical</TabsTrigger>
            <TabsTrigger value="documents" className="gap-2"><FileBadge className="h-3.5 w-3.5" />VC Documents</TabsTrigger>
            <TabsTrigger value="source-truth" className="gap-2"><Upload className="h-3.5 w-3.5" />Source Truth</TabsTrigger>
            <TabsTrigger value="seed" className="gap-2"><Database className="h-3.5 w-3.5" />Seed/DID</TabsTrigger>
            <TabsTrigger value="checker" className="gap-2"><CheckCircle2 className="h-3.5 w-3.5" />Checker</TabsTrigger>
            <TabsTrigger value="verify" className="gap-2"><ClipboardCheck className="h-3.5 w-3.5" />Verify</TabsTrigger>
            <TabsTrigger value="sync" className="gap-2"><RefreshCcw className="h-3.5 w-3.5" />Sync Back</TabsTrigger>
            <TabsTrigger value="production" className="gap-2"><ShieldCheck className="h-3.5 w-3.5" />Production</TabsTrigger>
          </TabsList>

          <TabsContent value="canonical" className="mt-4">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
              <Card>
                <CardHeader><CardTitle className="text-base">HIS Sample Input</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Source format</Label>
                    <Select value={sourceFormat} onValueChange={setSourceFormat}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="db_view">DB view / CSV row</SelectItem>
                        <SelectItem value="hl7v2">HL7 v2 message</SelectItem>
                        <SelectItem value="rest_api">REST API payload</SelectItem>
                        <SelectItem value="fhir_native">FHIR native</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Textarea className="min-h-[360px] font-mono text-xs" value={payload} onChange={(event) => setPayload(event.target.value)} />
                  <div className="flex gap-2">
                    <Button
                      disabled={!parsedPayload || canonicalize.isPending}
                      onClick={() => canonicalize.mutate({
                        sourceFormat: sourceFormat as any,
                        payload: parsedPayload,
                        sourceSystem: "demo-his",
                        sourceOrganizationId: "TH-HCODE-99999",
                        sourceOrganizationName: "Trustcare Demo Hospital",
                        mapperVersion: "demo-2026.07",
                      })}
                    >
                      Generate FHIR Bundle
                    </Button>
                    <Button
                      variant="outline"
                      disabled={!parsedPayload || packet.isPending}
                      onClick={() => packet.mutate({
                        context: "cross_border",
                        hisInput: {
                          sourceFormat: sourceFormat as any,
                          payload: parsedPayload,
                          sourceSystem: "demo-his",
                          sourceOrganizationId: "TH-HCODE-99999",
                          sourceOrganizationName: "Trustcare Demo Hospital",
                          mapperVersion: "demo-2026.07",
                        },
                        consent: {
                          id: "consent-demo-001",
                          patientId: "patient-demo-001",
                          purpose: "referral",
                          requesterId: "doctor-demo",
                          requesterRole: "doctor",
                          grantedToOrganizationId: "foreign-hospital-demo",
                          scopes: ["Patient.read", "Condition.read", "AllergyIntolerance.read", "Medication.read", "Observation.read", "DocumentReference.read"],
                          status: "granted",
                          grantedAt: new Date().toISOString(),
                          expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
                        },
                      })}
                    >
                      Create VP Packet
                    </Button>
                  </div>
                </CardContent>
              </Card>
              <ResultCard title="Canonical Output" data={packet.data ?? canonicalize.data} />
            </div>
          </TabsContent>

          <TabsContent value="documents" className="mt-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileBadge className="h-4 w-4" />Medical Certificate VC</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    className="w-full"
                    disabled={certificate.isPending}
                    onClick={() => certificate.mutate({
                      patient: { id: "patient-demo-001", name: "Somchai Jaidee" },
                      practitioner: { id: "doctor-demo-001", name: "Dr. Arisa Klinjai", licenseNo: "MD-TH-12345" },
                      organization: { id: "TH-HCODE-99999", name: "Trustcare Demo Hospital" },
                      diagnosisText: "Upper respiratory tract infection, clinically stable.",
                      fitnessForWork: "restricted",
                      recommendations: ["Rest for 2 days", "Return if fever persists"],
                      validFrom: new Date().toISOString(),
                      validUntil: new Date(Date.now() + 3 * 86400000).toISOString(),
                    })}
                  >
                    Submit as Maker
                  </Button>
                  <ResultCard title="Certificate Result" data={certificate.data} compact />
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Pill className="h-4 w-4" />Prescription VC</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    className="w-full"
                    disabled={prescription.isPending}
                    onClick={() => prescription.mutate({
                      patient: { id: "patient-demo-001", name: "Somchai Jaidee" },
                      prescriber: { id: "doctor-demo-001", name: "Dr. Arisa Klinjai", licenseNo: "MD-TH-12345" },
                      organization: { id: "TH-HCODE-99999", name: "Trustcare Demo Hospital" },
                      medications: [
                        { code: "TMT-123", name: "Metformin 500mg", instructions: "Take one tablet twice daily after meals.", daysSupply: 30, repeatsAllowed: 0 },
                      ],
                      substitutionAllowed: false,
                      dispenseWindowDays: 30,
                    })}
                  >
                    Submit as Maker
                  </Button>
                  <ResultCard title="Prescription Result" data={prescription.data} compact />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="source-truth" className="mt-4">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Upload className="h-4 w-4" />Canonical Data Mapping Review</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    className="min-h-[300px] font-mono text-xs"
                    value={csvText}
                    onChange={(event) => setCsvText(event.target.value)}
                    placeholder="hospital_code,hn,full_name_th,birth_date,visit_no,..."
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => setCsvText(String((demoSeed.data as any)?.sourceTruth?.csv?.csvText ?? ""))}>Use Seed CSV</Button>
                    <Button disabled={!csvText || reviewCsv.isPending} onClick={() => reviewCsv.mutate({ csvText, sourceSystem: "CSV-UPLOAD", sourceOrganizationId: "TCC", sourceOrganizationName: "TrustCare Central Hospital" })}>Review CSV</Button>
                    <Button variant="outline" disabled={!firstReadyDraft || canonicalizeDraft.isPending} onClick={() => firstReadyDraft && canonicalizeDraft.mutate({ draft: firstReadyDraft })}>Canonicalize Ready Draft</Button>
                  </div>
                  <ResultCard title="Source Connectors" data={connectors.data} compact />
                </CardContent>
              </Card>
              <div className="space-y-4">
                <ResultCard title="CSV Review" data={reviewCsv.data} compact />
                <ResultCard title="Canonical Draft" data={canonicalizeDraft.data} compact />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="seed" className="mt-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Database className="h-4 w-4" />Seed and Reseed</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button disabled={reseedDb.isPending} onClick={() => reseedDb.mutate({ patientsPerHospital: 12, resetExistingSeed: true })}>Reseed DB VC/VP</Button>
                    <Button variant="outline" onClick={() => seedBatches.refetch()}>Refresh Batches</Button>
                  </div>
                  <ResultCard title="Reseed Result" data={reseedDb.data} compact />
                  <ResultCard title="Seed Batches" data={seedBatches.data} compact />
                </CardContent>
              </Card>
              <div className="space-y-4">
                <ResultCard title="Demo Seed Catalog" data={(demoSeed.data as any)?.counts ? { counts: (demoSeed.data as any).counts, hospitals: (demoSeed.data as any).hospitals, vpScenarios: (demoSeed.data as any).vpScenarios } : demoSeed.data} compact />
                <ResultCard title="Issued Presentations" data={issuedPresentations.data} compact />
              </div>
              <ResultCard title="DID:web / DID:key Documents" data={didDocs.data} compact />
              <ResultCard title="FHIR and Document Labels" data={labels.data ? { brand: (labels.data as any).brand, fontPolicy: (labels.data as any).fontPolicy, sampleDocuments: Object.entries((labels.data as any).documentTypes ?? {}).slice(0, 8) } : undefined} compact />
            </div>
          </TabsContent>

          <TabsContent value="checker" className="mt-4">
            <div className="grid gap-4 lg:grid-cols-[0.8fr_1fr]">
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />Maker/Checker Queue</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button variant="outline" onClick={() => issuanceRequests.refetch()}>Refresh Queue</Button>
                    <Button disabled={!firstSubmittedRequest || approveRequest.isPending} onClick={() => firstSubmittedRequest && approveRequest.mutate({ id: firstSubmittedRequest.id, checkerNotes: "Checked against canonical review and approved." })}>Approve First Request</Button>
                  </div>
                  <ResultCard title="Latest Issued VC" data={approveRequest.data} compact />
                </CardContent>
              </Card>
              <ResultCard title="Issuance Requests" data={issuanceRequests.data} />
            </div>
          </TabsContent>

          <TabsContent value="verify" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Verify VC / VP JWT</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <Textarea className="min-h-[160px] font-mono text-xs" value={verifyInput} onChange={(event) => setVerifyInput(event.target.value)} placeholder="Paste VC or VP JWT" />
                <div className="flex flex-wrap gap-2">
                  <Button disabled={!verifyInput || verify.isPending} onClick={() => verify.mutate({ jwt: verifyInput, kind: "presentation" })}>Verify as VP</Button>
                  <Button variant="outline" disabled={!verifyInput || verify.isPending} onClick={() => verify.mutate({ jwt: verifyInput, kind: "credential" })}>Verify as VC</Button>
                  <Button variant="outline" disabled={!verifyInput || verify.isPending} onClick={() => verify.mutate({ jwt: verifyInput, kind: "credential", trustRegistryMode: "required" })}>Strict Trust Verify</Button>
                  <Button variant="ghost" disabled={!latestJwt} onClick={() => setVerifyInput(latestJwt)}>Use Latest JWT</Button>
                </div>
                <ResultCard title="Verification Result" data={verify.data} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sync" className="mt-4">
            <div className="grid gap-4 lg:grid-cols-[0.8fr_1fr]">
              <Card>
                <CardHeader><CardTitle className="text-base">Sync-back Plan</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Patient business key</Label>
                    <Input value="HN-10045" readOnly />
                  </div>
                  <Button
                    className="w-full"
                    disabled={!firstTarget || syncPlan.isPending}
                    onClick={() => firstTarget && syncPlan.mutate({
                      target: firstTarget as any,
                      operation: "upsert",
                      resource: sampleMedicationRequest,
                      sourceEventId: `rx-${Date.now()}`,
                      patientBusinessKey: "HN-10045",
                      expectedVersion: "W/\"1\"",
                      reason: "Prescription issued from Trustcare VC workflow",
                    })}
                  >
                    Plan MedicationRequest Sync
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={!syncPlan.data || syncExecute.isPending}
                    onClick={() => syncPlan.data && syncExecute.mutate({
                      plan: syncPlan.data as any,
                      subjectId: "HN-10045",
                      holderDid: "did:key:patient-demo",
                      allowManualReview: true,
                    })}
                  >
                    Execute Sync and Issue Receipt VC
                  </Button>
                  <div className="text-xs text-muted-foreground">
                    {syncTargets.data?.map((target) => (
                      <p key={target.id}>{target.name}: {target.kind}, {target.writeMode}</p>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <ResultCard title="Sync Execution Result" data={syncExecute.data ? { plan: syncPlan.data, ...syncExecute.data } : syncPlan.data} />
            </div>
          </TabsContent>

          <TabsContent value="production" className="mt-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <ResultCard title="Production Readiness" data={productionReadiness.data} />
              <ResultCard title="Reconciliation Jobs" data={reconciliationJobs.data} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

function ResultCard({ title, data, compact = false }: { title: string; data: unknown; compact?: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent>
        {data ? (
          <pre className={`overflow-auto rounded-md bg-muted/50 p-3 font-mono text-xs ${compact ? "max-h-[260px]" : "max-h-[560px]"}`}>
            {JSON.stringify(data, null, 2)}
          </pre>
        ) : (
          <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">No output yet</div>
        )}
      </CardContent>
    </Card>
  );
}
