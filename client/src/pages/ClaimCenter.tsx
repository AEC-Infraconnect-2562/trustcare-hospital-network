import DashboardLayout from "@/components/DashboardLayout";
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
import { Link } from "wouter";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Banknote,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  FileText,
  Inbox,
  Link2,
  Loader2,
  Plug,
  ReceiptText,
  RefreshCw,
  Send,
  ShieldCheck,
  WalletCards,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type ClaimPacket = any;
type ActionResult = Record<string, unknown> | undefined;

const statusLabels: Record<string, string> = {
  draft: "Draft",
  validating: "Validating",
  correction_required: "Correction required",
  ready_to_submit: "Ready to submit",
  submitted: "Submitted",
  accepted: "Accepted",
  rejected: "Rejected",
  more_info_requested: "More info requested",
  appeal: "Appeal",
  paid: "Paid",
  closed: "Closed",
};

const statusTone: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  validating: "bg-sky-100 text-sky-700",
  correction_required: "bg-amber-100 text-amber-800",
  ready_to_submit: "bg-emerald-100 text-emerald-800",
  submitted: "bg-indigo-100 text-indigo-800",
  accepted: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  more_info_requested: "bg-yellow-100 text-yellow-800",
  appeal: "bg-purple-100 text-purple-800",
  paid: "bg-teal-100 text-teal-800",
  closed: "bg-slate-200 text-slate-700",
};

const claimTypes = [
  ["opd", "OPD"],
  ["ipd", "IPD"],
  ["dental", "Dental"],
  ["pharmacy", "Pharmacy"],
  ["rehabilitation", "Rehabilitation"],
  ["emergency", "Emergency"],
];

const intakeChannels = [
  ["wallet_vp", "Patient Wallet VP"],
  ["shl", "Smart Health Link"],
  ["legacy_upload", "Legacy upload"],
  ["his_import", "HIS import"],
  ["partner_portal", "Partner/Payer Portal"],
];

function money(value: number, currency = "THB") {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function statusBadge(status: string) {
  return <Badge className={statusTone[status] ?? "bg-slate-100 text-slate-700"}>{statusLabels[status] ?? status}</Badge>;
}

function MetricCard({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: typeof ReceiptText;
  label: string;
  value: string | number;
  helper: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-md bg-primary/10 p-2">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold leading-tight">{value}</p>
          <p className="truncate text-xs text-muted-foreground">{helper}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-80 overflow-auto rounded-md bg-slate-950 p-3 text-xs leading-relaxed text-slate-50">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function CaseList({
  cases,
  selectedId,
  onSelect,
}: {
  cases: ClaimPacket[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      {cases.map((claim) => (
        <button
          key={claim.id}
          type="button"
          onClick={() => onSelect(claim.id)}
          className={`w-full rounded-md border p-3 text-left transition-colors ${
            selectedId === claim.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium">{claim.caseRef}</p>
              <p className="truncate text-sm text-muted-foreground">{claim.patient.name}</p>
            </div>
            {statusBadge(claim.status)}
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>{claim.payer.name}</span>
            <span>{money(claim.totalAmount, claim.currency)}</span>
          </div>
          <Progress className="mt-2" value={claim.readinessScore} />
        </button>
      ))}
    </div>
  );
}

function EvidenceInbox({ claim }: { claim?: ClaimPacket }) {
  if (!claim) return null;
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {claim.evidence.map((item: any) => {
        const Icon = item.status === "verified" || item.status === "accepted" ? CheckCircle2 : AlertTriangle;
        return (
          <div key={item.id} className="rounded-md border p-3">
            <div className="flex items-start gap-3">
              <Icon className={`mt-0.5 h-5 w-5 ${item.status === "missing" ? "text-red-600" : "text-emerald-600"}`} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{item.title}</p>
                  {item.required && <Badge variant="outline">required</Badge>}
                  {item.simulated && <Badge variant="secondary">simulated</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">
                  {item.type} from {item.source}
                </p>
                {item.hash && <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{item.hash}</p>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Timeline({ claim }: { claim?: ClaimPacket }) {
  if (!claim) return null;
  return (
    <div className="space-y-3">
      {claim.timeline.map((event: any, index: number) => {
        const done = event.status === "done";
        const current = event.status === "current";
        const blocked = event.status === "blocked";
        return (
          <div key={event.label} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full border ${
                  blocked
                    ? "border-amber-500 bg-amber-100 text-amber-800"
                    : done || current
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted bg-background text-muted-foreground"
                }`}
              >
                {blocked ? <AlertTriangle className="h-4 w-4" /> : done ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
              </div>
              {index < claim.timeline.length - 1 && <div className="h-8 w-px bg-border" />}
            </div>
            <div className="pb-3">
              <p className="font-medium">{event.label.replace(/_/g, " ")}</p>
              <p className="text-sm text-muted-foreground">{event.actor}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ClaimCenter() {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedId, setSelectedId] = useState<string>();
  const [actionResult, setActionResult] = useState<ActionResult>();
  const [payerDecision, setPayerDecision] = useState<"accepted" | "rejected" | "more_info_requested">("accepted");
  const [readinessForm, setReadinessForm] = useState({
    patientId: "1",
    hospitalId: "1",
    payerAdapterId: "101",
    memberId: "NHSO-1101700200011",
    encounterRef: "ENC-TCC-20260703-OPD-001",
    claimType: "opd",
    totalAmount: "4200",
    diagnosisCodes: "E11.9, I10",
    procedureCodes: "",
    serviceItems: "OPD consultation and chronic disease review|800|OPD-001\nHbA1c laboratory test|650|LAB-HBA1C\n30-day medication package|2750|RX-30D",
    intakeChannel: "wallet_vp",
    consentRef: "CONSENT-CLAIM-SOMCHAI-20260703",
  });

  const workbench = trpc.claim.workbench.useQuery();
  const createReadiness = trpc.claim.createReadiness.useMutation({
    onSuccess: (result) => {
      setActionResult(result as ActionResult);
      workbench.refetch();
      toast.success(result.id ? `Claim case #${result.id} created` : "Simulated readiness packet generated");
    },
    onError: (error) => toast.error(error.message),
  });
  const issuePackage = trpc.claim.issueClaimPackageVc.useMutation({
    onSuccess: (result) => {
      setActionResult(result as ActionResult);
      workbench.refetch();
      toast.success(result.valid ? "ClaimPackageCredential ready" : "Package needs correction before submission");
    },
    onError: (error) => toast.error(error.message),
  });
  const submitToPayer = trpc.claim.submitToPayer.useMutation({
    onSuccess: (result) => {
      setActionResult(result as ActionResult);
      workbench.refetch();
      toast.success("Payer submission envelope created");
    },
    onError: (error) => toast.error(error.message),
  });
  const recordResponse = trpc.claim.recordPayerResponse.useMutation({
    onSuccess: (result) => {
      setActionResult(result as ActionResult);
      workbench.refetch();
      toast.success("Payer response recorded");
    },
    onError: (error) => toast.error(error.message),
  });
  const recordPayment = trpc.claim.recordPayment.useMutation({
    onSuccess: (result) => {
      setActionResult(result as ActionResult);
      workbench.refetch();
      toast.success("Payment reconciled and ClaimReceiptCredential generated");
    },
    onError: (error) => toast.error(error.message),
  });

  const data = workbench.data;
  const cases = data?.casePackets ?? [];
  const selected = useMemo(
    () => cases.find((claim: ClaimPacket) => claim.id === selectedId) ?? cases[0],
    [cases, selectedId],
  );
  const target = selected ? { claimCaseId: selected.claimCaseId, simulatedCaseId: selected.id } : {};

  const adapters = data?.adapters ?? [];
  const selectedPayer = adapters.find((adapter: any) => String(adapter.id) === readinessForm.payerAdapterId);

  function setFormValue(key: keyof typeof readinessForm, value: string) {
    setReadinessForm((prev) => ({ ...prev, [key]: value }));
  }

  function submitReadiness() {
    createReadiness.mutate({
      patientId: Number(readinessForm.patientId),
      hospitalId: Number(readinessForm.hospitalId),
      payerAdapterId: Number(readinessForm.payerAdapterId),
      memberId: readinessForm.memberId,
      encounterRef: readinessForm.encounterRef,
      claimType: readinessForm.claimType as any,
      totalAmount: readinessForm.totalAmount,
      diagnosisCodes: readinessForm.diagnosisCodes,
      procedureCodes: readinessForm.procedureCodes,
      serviceItems: readinessForm.serviceItems,
      intakeChannel: readinessForm.intakeChannel as any,
      consentRef: readinessForm.consentRef,
    });
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
              <ReceiptText className="h-7 w-7 text-primary" />
              Claim Center
            </h1>
            <p className="mt-1 max-w-4xl text-muted-foreground">
              Hospital-side claim workbench for patient wallet evidence, FHIR Claim canonical packages, VC/VP trust layer, payer adapters, adjudication, payment reconciliation, and wallet claim receipts.
            </p>
          </div>
          <Button variant="outline" onClick={() => workbench.refetch()} disabled={workbench.isFetching}>
            {workbench.isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
        </div>

        {data?.simulationMode && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <div className="flex gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4" />
              <div>
                <p className="font-medium">Simulated claim seed data is active.</p>
                <p>{data.simulationNotice}</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <MetricCard icon={FileCheck2} label="Claims" value={data?.overview.totalClaims ?? 0} helper="workbench packets" />
          <MetricCard icon={ShieldCheck} label="Readiness" value={`${data?.overview.avgReadinessScore ?? 0}%`} helper="average package score" />
          <MetricCard icon={Banknote} label="Claim value" value={money(data?.overview.totalValue ?? 0)} helper="submitted / queued value" />
          <MetricCard icon={WalletCards} label="Wallet outputs" value={data?.overview.paidCount ?? 0} helper="paid receipts ready" />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_1fr]">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Inbox className="h-4 w-4" />
                  Claim Worklist
                </CardTitle>
              </CardHeader>
              <CardContent>
                {workbench.isLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading claim packets
                  </div>
                ) : (
                  <CaseList cases={cases} selectedId={selected?.id} onSelect={setSelectedId} />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock3 className="h-4 w-4" />
                  Lifecycle
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Timeline claim={selected} />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            {selected && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-semibold">{selected.caseRef}</h2>
                        {statusBadge(selected.status)}
                        {selected.simulated && <Badge variant="secondary">simulated</Badge>}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {selected.patient.name} / {selected.patient.hn} / {selected.hospital.name}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {selected.payer.name} / {selected.claimType.toUpperCase()} / {money(selected.totalAmount, selected.currency)}
                      </p>
                      {selected.claimCaseId && (
                        <Link href={`/claim-center/${selected.claimCaseId}`}>
                          <Button variant="outline" size="sm" className="mt-2 gap-1">
                            <FileText className="h-3.5 w-3.5" /> ดูรายละเอียดเต็ม
                          </Button>
                        </Link>
                      )}
                    </div>
                    <div className="min-w-[220px]">
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Readiness score</span>
                        <span className="font-medium">{selected.readinessScore}%</span>
                      </div>
                      <Progress value={selected.readinessScore} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="flex h-auto flex-wrap justify-start">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="intake">Intake</TabsTrigger>
                <TabsTrigger value="evidence">Evidence</TabsTrigger>
                <TabsTrigger value="package">Package</TabsTrigger>
                <TabsTrigger value="payer">Payer</TabsTrigger>
                <TabsTrigger value="payment">Payment</TabsTrigger>
                <TabsTrigger value="api">API</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-4 space-y-4">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
                  {data?.lanes.map((lane: any) => (
                    <Card key={lane.id}>
                      <CardContent className="p-4">
                        <p className="text-sm font-medium">{lane.label}</p>
                        <p className="mt-2 text-2xl font-semibold">{lane.count}</p>
                        <p className="text-sm text-muted-foreground">{money(lane.value)}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <ClipboardCheck className="h-4 w-4" />
                      Operating model
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <div className="rounded-md border p-3">
                      <p className="font-medium">1. Coverage Eligibility VC</p>
                      <p className="mt-1 text-sm text-muted-foreground">Patient presents policy, government scheme, or wallet credential. TrustCare records benefit status and consent scope.</p>
                    </div>
                    <div className="rounded-md border p-3">
                      <p className="font-medium">2. Verified Claim Package</p>
                      <p className="mt-1 text-sm text-muted-foreground">FHIR Claim + DocumentReference evidence + ClaimPackageCredential before payer submission.</p>
                    </div>
                    <div className="rounded-md border p-3">
                      <p className="font-medium">3. Payer Adapter</p>
                      <p className="mt-1 text-sm text-muted-foreground">NHSO, SSO, CSMBS, private insurance, travel assistance, or portal/manual fallback.</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="intake" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <ShieldCheck className="h-4 w-4" />
                      Pre-Visit Claim Readiness
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div>
                        <Label>Patient ID</Label>
                        <Input value={readinessForm.patientId} onChange={(e) => setFormValue("patientId", e.target.value)} />
                      </div>
                      <div>
                        <Label>Hospital ID</Label>
                        <Input value={readinessForm.hospitalId} onChange={(e) => setFormValue("hospitalId", e.target.value)} />
                      </div>
                      <div>
                        <Label>Claim type</Label>
                        <Select value={readinessForm.claimType} onValueChange={(value) => setFormValue("claimType", value)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {claimTypes.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Payer adapter</Label>
                        <Select value={readinessForm.payerAdapterId} onValueChange={(value) => setFormValue("payerAdapterId", value)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {adapters.map((adapter: any) => (
                              <SelectItem key={adapter.id} value={String(adapter.id)}>
                                {adapter.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Member / Policy ID</Label>
                        <Input value={readinessForm.memberId} onChange={(e) => setFormValue("memberId", e.target.value)} />
                      </div>
                      <div>
                        <Label>Total amount</Label>
                        <Input value={readinessForm.totalAmount} onChange={(e) => setFormValue("totalAmount", e.target.value)} />
                      </div>
                      <div>
                        <Label>Encounter ref</Label>
                        <Input value={readinessForm.encounterRef} onChange={(e) => setFormValue("encounterRef", e.target.value)} />
                      </div>
                      <div>
                        <Label>Intake channel</Label>
                        <Select value={readinessForm.intakeChannel} onValueChange={(value) => setFormValue("intakeChannel", value)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {intakeChannels.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Consent ref</Label>
                        <Input value={readinessForm.consentRef} onChange={(e) => setFormValue("consentRef", e.target.value)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                      <div>
                        <Label>Diagnosis codes</Label>
                        <Textarea value={readinessForm.diagnosisCodes} onChange={(e) => setFormValue("diagnosisCodes", e.target.value)} rows={4} />
                      </div>
                      <div>
                        <Label>Procedure codes</Label>
                        <Textarea value={readinessForm.procedureCodes} onChange={(e) => setFormValue("procedureCodes", e.target.value)} rows={4} />
                      </div>
                      <div>
                        <Label>Service lines: description|amount|code</Label>
                        <Textarea value={readinessForm.serviceItems} onChange={(e) => setFormValue("serviceItems", e.target.value)} rows={4} />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Button onClick={submitReadiness} disabled={createReadiness.isPending}>
                        {createReadiness.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                        Create readiness case
                      </Button>
                      {selectedPayer && (
                        <p className="text-sm text-muted-foreground">
                          Adapter: {selectedPayer.payerType} / {selectedPayer.submissionFormat} / {selectedPayer.adapterMode}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="evidence" className="mt-4 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Inbox className="h-4 w-4" />
                      Document & VC/VP Evidence Inbox
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <EvidenceInbox claim={selected} />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-base">Checklist</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {selected?.checklist.map((item: any) => (
                      <div key={item.id} className="flex items-center justify-between rounded-md border p-3">
                        <div className="flex items-center gap-2">
                          {item.status === "complete" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
                          <span>{item.label}</span>
                        </div>
                        <Badge variant={item.status === "complete" ? "default" : "secondary"}>{item.status}</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="package" className="mt-4 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <BadgeCheck className="h-4 w-4" />
                      Claim Package Builder
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <div>
                        <p className="mb-2 font-medium">Canonical FHIR Claim</p>
                        <JsonBlock value={selected?.fhirClaim ?? {}} />
                      </div>
                      <div>
                        <p className="mb-2 font-medium">ClaimPackageCredential</p>
                        <JsonBlock value={selected?.packageCredential ?? {}} />
                      </div>
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <p className="font-medium">Validation issues</p>
                      {selected?.validationIssues?.length ? (
                        selected.validationIssues.map((issue: any, index: number) => (
                          <div key={`${issue.field}-${index}`} className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
                            <p className="font-medium text-amber-900">{issue.field}: {issue.message}</p>
                            <p className="text-amber-800">{issue.action}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">No blocking validation issues.</p>
                      )}
                    </div>
                    <Button onClick={() => issuePackage.mutate(target)} disabled={!selected || issuePackage.isPending}>
                      {issuePackage.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileCheck2 className="mr-2 h-4 w-4" />}
                      Issue ClaimPackageCredential
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="payer" className="mt-4 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Send className="h-4 w-4" />
                      Payer Submission & Response
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <Button onClick={() => submitToPayer.mutate({ ...target, adapterMode: selected?.payer.submissionFormat })} disabled={!selected || submitToPayer.isPending}>
                        <Send className="mr-2 h-4 w-4" />
                        Submit via adapter
                      </Button>
                      <Select value={payerDecision} onValueChange={(value) => setPayerDecision(value as any)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="accepted">Accepted</SelectItem>
                          <SelectItem value="more_info_requested">More info requested</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="outline" onClick={() => recordResponse.mutate({ ...target, decision: payerDecision })} disabled={!selected || recordResponse.isPending}>
                        <ClipboardCheck className="mr-2 h-4 w-4" />
                        Record payer response
                      </Button>
                    </div>
                    <JsonBlock value={selected?.payerResponse ?? { message: "Submit or record payer response to see the envelope here." }} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="payment" className="mt-4 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Banknote className="h-4 w-4" />
                      Payment Reconciliation
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div className="rounded-md border p-3">
                        <p className="text-sm text-muted-foreground">Approved</p>
                        <p className="text-xl font-semibold">{money(selected?.approvedAmount ?? 0)}</p>
                      </div>
                      <div className="rounded-md border p-3">
                        <p className="text-sm text-muted-foreground">Patient responsibility</p>
                        <p className="text-xl font-semibold">{money(Math.max((selected?.totalAmount ?? 0) - (selected?.approvedAmount ?? 0), 0))}</p>
                      </div>
                      <Button className="self-end" onClick={() => recordPayment.mutate({ ...target, paidAmount: selected?.approvedAmount })} disabled={!selected || recordPayment.isPending}>
                        <WalletCards className="mr-2 h-4 w-4" />
                        Reconcile + issue receipt VC
                      </Button>
                    </div>
                    <JsonBlock value={selected?.payment ?? { message: "Record payment to create PaymentReconciliation and ClaimReceiptCredential." }} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="api" className="mt-4 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Plug className="h-4 w-4" />
                      Public API / Payer Adapter Samples
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                      <div className="flex gap-2">
                        <Link2 className="mt-0.5 h-4 w-4" />
                        <p>
                          Mock endpoints are available under <code>/api/public/claim-center/v1</code>. Production must add partner auth, request signing, consent scope, adapter ruleset, and payer contract configuration.
                        </p>
                      </div>
                    </div>
                    <JsonBlock value={data?.apiExamples ?? {}} />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {actionResult && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    {String(actionResult.status ?? actionResult.valid ?? "").includes("false") ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                    Last Action Result
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <JsonBlock value={actionResult} />
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
