import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import {
  CheckCircle2,
  Clipboard,
  Clock,
  Eye,
  FileJson2,
  FileSearch,
  KeyRound,
  Link2,
  LockKeyhole,
  Plus,
  QrCode,
  RefreshCw,
  ShieldCheck,
  XCircle,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { toast } from "sonner";

const purposeLabels: Record<string, string> = {
  referral: "Referral",
  patient_summary: "Patient summary",
  discharge: "Discharge",
  cross_border: "Cross-border",
  medical_tourist: "Medical tourist",
  insurance: "E-Claim / insurance",
  self_share: "Self share",
};

const statusTone: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700 border-emerald-200",
  pending_review: "bg-amber-100 text-amber-800 border-amber-200",
  expired: "bg-zinc-100 text-zinc-700 border-zinc-200",
  revoked: "bg-red-100 text-red-700 border-red-200",
  disabled: "bg-red-100 text-red-700 border-red-200",
  max_accessed: "bg-orange-100 text-orange-700 border-orange-200",
};

const shlFriendlyContexts: Record<
  string,
  {
    title: string;
    why: string;
    recipient: string;
    includes: string[];
    nextAction: string;
    riskNote: string;
  }
> = {
  medical_tourist: {
    title: "International care intake packet",
    why: "Use this when an international desk, overseas coordinator, or receiving hospital needs enough trusted information for pre-review, estimate, and onboarding.",
    recipient: "International patient coordinator, receiving clinician, or approved facilitator",
    includes: ["Identity/passport reference", "Clinical summary", "Travel or guarantee documents", "Consent and audit trail"],
    nextAction: "Share the QR/link with the named recipient and keep the passcode on a separate channel.",
    riskNote: "Usually high sensitivity because it can include identity, travel, clinical, and finance documents.",
  },
  e_claim: {
    title: "Insurance or payer claim packet",
    why: "Use this when a payer needs verified eligibility, clinical evidence, invoice, and receipt data for claim review.",
    recipient: "Claim center, insurer, NHSO/SSO adapter, or authorized payer reviewer",
    includes: ["Coverage eligibility", "Claim package", "Clinical summary", "Invoice/receipt references"],
    nextAction: "Confirm payer purpose and access limit before sending.",
    riskNote: "Keep access short and named-recipient where possible because financial and clinical data travel together.",
  },
  insurance: {
    title: "Insurance or payer claim packet",
    why: "Use this when a payer needs verified eligibility, clinical evidence, invoice, and receipt data for claim review.",
    recipient: "Claim center, insurer, NHSO/SSO adapter, or authorized payer reviewer",
    includes: ["Coverage eligibility", "Claim package", "Clinical summary", "Invoice/receipt references"],
    nextAction: "Confirm payer purpose and access limit before sending.",
    riskNote: "Keep access short and named-recipient where possible because financial and clinical data travel together.",
  },
  cross_branch_referral: {
    title: "Closed-loop referral packet",
    why: "Use this when a sending and receiving care team need one verifiable packet for referral, acceptance, and follow-up.",
    recipient: "Receiving hospital, specialist clinic, referral coordinator, or partner portal reviewer",
    includes: ["Referral document", "Patient summary", "Relevant diagnostics", "Consent receipt"],
    nextAction: "Send after confirming the receiving organization and referral purpose.",
    riskNote: "Referral packets should preserve history, versions, and access logs for clinical handoff audit.",
  },
  referral: {
    title: "Referral packet",
    why: "Use this when a receiving provider needs referral context and supporting clinical documents before accepting care.",
    recipient: "Receiving provider or referral coordinator",
    includes: ["Referral document", "Patient summary", "Relevant diagnostics", "Consent receipt"],
    nextAction: "Send after confirming the receiving organization and referral purpose.",
    riskNote: "Referral packets should preserve history, versions, and access logs for clinical handoff audit.",
  },
  emergency: {
    title: "Emergency triage packet",
    why: "Use this when emergency staff need critical identity, allergy, medication, and condition information quickly.",
    recipient: "Emergency triage desk or treating clinician",
    includes: ["Identity", "Allergy alerts", "Current medications", "Active conditions"],
    nextAction: "Keep expiry short and rotate if the link might have been shared too widely.",
    riskNote: "Emergency sharing can be time-critical; every access still needs audit.",
  },
  treatment: {
    title: "Treatment readiness packet",
    why: "Use this when a clinic needs a patient summary and supporting documents to start service with less repeated history-taking.",
    recipient: "Hospital registration, OPD nurse, doctor, or pharmacy service point",
    includes: ["Patient identity", "Patient summary", "Medication/allergy data", "Uploaded DocumentReference files"],
    nextAction: "Use at check-in or when a service point asks for the prepared packet.",
    riskNote: "Treatment packets should share the minimum necessary documents for the selected service.",
  },
  patient_summary: {
    title: "Patient summary share",
    why: "Use this when the patient wants to share a short clinical summary without sending a full referral or claim packet.",
    recipient: "Clinician or service point chosen by the patient",
    includes: ["Identity", "Problem list", "Allergies", "Medication summary"],
    nextAction: "Share only with the intended recipient and revoke after use if it is not needed again.",
    riskNote: "A summary is smaller than a full packet but still contains sensitive clinical data.",
  },
  self_share: {
    title: "Patient self-share packet",
    why: "Use this when the patient chooses a limited wallet packet to share for one purpose.",
    recipient: "Patient-selected recipient",
    includes: ["Selected wallet documents", "Consent/holder proof", "Access policy"],
    nextAction: "Review the selected contents before sending the QR/link.",
    riskNote: "Self-share links should be easy to revoke from the wallet.",
  },
};

const defaultCreate = {
  purpose: "patient_summary",
  context: "treatment",
  patientId: "",
  hospitalId: "",
  expiresInDays: "14",
  maxAccessCount: "10",
  label: "",
  passcodeRequired: true,
  forceCheckerReview: false,
  simulatorScenario: "patient_summary",
};

export default function SmartHealthLinks() {
  const { user } = useAuth();
  const activeRole = String(
    (user as any)?.activeRole ?? (user as any)?.systemRole ?? "patient"
  );
  const isPatient = activeRole === "patient";
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState(defaultCreate);
  const [lastCreated, setLastCreated] = useState<any>(null);

  const links = trpc.shl.list.useQuery({});
  const patients = trpc.shl.patientOptions.useQuery();
  const scenarios = trpc.shl.simulatorScenarios.useQuery();
  const hospitals = trpc.hospital.list.useQuery();
  const selectedDetail = trpc.shl.getById.useQuery(
    { id: selectedId! },
    { enabled: Boolean(selectedId) }
  );
  const selected =
    selectedDetail.data ??
    links.data?.find((item: any) => item.id === selectedId);

  const createShl = trpc.shl.create.useMutation({
    onSuccess: async (data: any) => {
      setLastCreated(data);
      setSelectedId(data.id);
      setOpen(false);
      await links.refetch();
      toast.success(
        data.nextStep === "checker_review_required"
          ? "SHL sent to Checker review"
          : "SHL ready to share"
      );
    },
  });
  const revokeShl = trpc.shl.revoke.useMutation({
    onSuccess: async () => {
      await Promise.all([links.refetch(), selectedDetail.refetch()]);
      toast.success("SHL revoked");
    },
  });
  const rotatePasscode = trpc.shl.rotatePasscode.useMutation({
    onSuccess: (data: any) => {
      setLastCreated({
        ...selected,
        passcode: data.passcode,
        passcodeRequired: true,
      });
      toast.success("Passcode rotated");
    },
  });
  const resetAttempts = trpc.shl.resetPasscodeAttempts.useMutation({
    onSuccess: (data: any) => {
      links.refetch();
      toast.success(data.reactivated ? "SHL unlocked and passcode attempts reset" : "Passcode attempts reset");
    },
  });

  const selectedRecord = selected as any;
  const accessRows = useMemo(
    () => selectedRecord?.accessLogs ?? [],
    [selectedRecord]
  );
  const versionRows = useMemo(
    () => selectedRecord?.versions ?? [],
    [selectedRecord]
  );
  const fileRows = useMemo(() => selectedRecord?.files ?? [], [selectedRecord]);
  const documentBundle = useMemo(() => {
    if (selectedRecord?.documentBundle) return selectedRecord.documentBundle;
    if (!selectedRecord) return undefined;
    return buildClientDocumentBundle(selectedRecord, fileRows);
  }, [selectedRecord, fileRows]);
  const visibleScenarios = useMemo(() => {
    const rows = scenarios.data ?? [];
    if (!isPatient) return rows;
    return rows.filter((scenario: any) =>
      ["patient_summary", "self_share"].includes(scenario.id)
    );
  }, [isPatient, scenarios.data]);

  useEffect(() => {
    if (!visibleScenarios.length) return;
    if (
      !visibleScenarios.some(
        (scenario: any) => scenario.id === form.simulatorScenario
      )
    ) {
      updateScenario(visibleScenarios[0].id);
    }
  }, [visibleScenarios]);

  useEffect(() => {
    const rows = links.data ?? [];
    if (!rows.length) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    if (!selectedId || !rows.some((link: any) => link.id === selectedId)) {
      setSelectedId(rows[0].id);
    }
  }, [links.data, selectedId]);

  function submitCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const scenario = visibleScenarios.find(
      (item: any) => item.id === form.simulatorScenario
    );
    createShl.mutate({
      patientId: isPatient ? undefined : Number(form.patientId),
      hospitalId: form.hospitalId ? Number(form.hospitalId) : undefined,
      purpose: (scenario?.purpose ?? form.purpose) as any,
      context: (scenario?.context ?? form.context) as any,
      label: form.label || scenario?.label,
      simulatorScenario: form.simulatorScenario,
      expiresInDays: Number(form.expiresInDays),
      maxAccessCount: Number(form.maxAccessCount),
      passcodeRequired: form.passcodeRequired,
      forceCheckerReview: form.forceCheckerReview,
    });
  }

  function updateScenario(id: string) {
    const scenario = scenarios.data?.find((item: any) => item.id === id);
    setForm(current => ({
      ...current,
      simulatorScenario: id,
      purpose: scenario?.purpose ?? current.purpose,
      context: scenario?.context ?? current.context,
      label: scenario?.label ?? current.label,
    }));
  }

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <Link2 className="h-6 w-6 text-primary" />
              Smart Health Links
            </h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="outline">SHL transport</Badge>
              <Badge variant="outline">FHIR Bundle JWE</Badge>
              <Badge variant="outline">VC/VP trust layer</Badge>
            </div>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create SHL
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Smart Health Link</DialogTitle>
              </DialogHeader>
              <form onSubmit={submitCreate} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  {!isPatient && (
                    <div className="space-y-2">
                      <Label>Patient</Label>
                      <Select
                        value={form.patientId}
                        onValueChange={value =>
                          setForm({ ...form, patientId: value })
                        }
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select patient" />
                        </SelectTrigger>
                        <SelectContent>
                          {(patients.data ?? []).map((patient: any) => (
                            <SelectItem
                              key={patient.id}
                              value={String(patient.id)}
                            >
                              {patient.name ??
                                patient.email ??
                                `Patient #${patient.id}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Hospital</Label>
                    <Select
                      value={form.hospitalId}
                      onValueChange={value =>
                        setForm({ ...form, hospitalId: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Default hospital" />
                      </SelectTrigger>
                      <SelectContent>
                        {(hospitals.data ?? []).map((hospital: any) => (
                          <SelectItem
                            key={hospital.id}
                            value={String(hospital.id)}
                          >
                            {hospital.nameEn ?? hospital.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Scenario</Label>
                    <Select
                      value={form.simulatorScenario}
                      onValueChange={updateScenario}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {visibleScenarios.map((scenario: any) => (
                          <SelectItem key={scenario.id} value={scenario.id}>
                            {scenario.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Label</Label>
                    <Input
                      value={form.label}
                      onChange={event =>
                        setForm({ ...form, label: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Expiry days</Label>
                    <Input
                      type="number"
                      min={1}
                      max={365}
                      value={form.expiresInDays}
                      onChange={event =>
                        setForm({ ...form, expiresInDays: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max access</Label>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={form.maxAccessCount}
                      onChange={event =>
                        setForm({ ...form, maxAccessCount: event.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-6 rounded-md border p-3">
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={form.passcodeRequired}
                      onCheckedChange={checked =>
                        setForm({ ...form, passcodeRequired: checked })
                      }
                    />
                    Passcode
                  </label>
                  {!isPatient && (
                    <label className="flex items-center gap-2 text-sm">
                      <Switch
                        checked={form.forceCheckerReview}
                        onCheckedChange={checked =>
                          setForm({ ...form, forceCheckerReview: checked })
                        }
                      />
                      Force Checker review
                    </label>
                  )}
                  <Badge variant="secondary">
                    {purposeLabels[form.purpose] ?? form.purpose}
                  </Badge>
                  <Badge variant="secondary">{form.context}</Badge>
                </div>
                <Button
                  type="submit"
                  disabled={createShl.isPending}
                  className="w-full"
                >
                  {createShl.isPending ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="mr-2 h-4 w-4" />
                  )}
                  Create SHL package
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {lastCreated?.passcode && (
          <div className="flex flex-col gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-950 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <KeyRound className="h-5 w-5" />
              <div>
                <div className="text-sm font-medium">One-time passcode</div>
                <div className="font-mono text-2xl tracking-widest">
                  {lastCreated.passcode}
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                copyText(lastCreated.viewerUrl ?? lastCreated.qrPayload)
              }
            >
              Copy viewer link
            </Button>
          </div>
        )}

        <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
          <div className="space-y-3">
            {links.isLoading && (
              <Card>
                <CardContent className="flex min-h-[160px] items-center justify-center gap-2 text-sm text-muted-foreground">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Loading Smart Health Links...
                </CardContent>
              </Card>
            )}
            {(links.data ?? []).map((link: any) => {
              const isSelected = selectedId === link.id;
              const friendly = getShlFriendlyContext(link);
              const trustChecks = buildShlTrustChecks(link, link.files?.length ?? 0);
              return (
                <div key={link.id} className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setSelectedId(link.id)}
                    className={`w-full rounded-md border bg-card p-4 text-left transition hover:border-primary ${isSelected ? "border-primary shadow-sm ring-1 ring-primary/20" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <QrCode className="h-4 w-4 text-primary" />
                          <span className="truncate font-medium">
                            {link.label ??
                              purposeLabels[link.purpose] ??
                              link.purpose}
                          </span>
                        </div>
                        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                          {friendly.why}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          <Badge variant="outline">{purposeLabels[link.purpose] ?? link.purpose}</Badge>
                          <Badge variant="outline">{friendly.title}</Badge>
                          <Badge variant="secondary">
                            เปิดแล้ว {link.currentAccessCount ?? 0} ครั้ง
                            {link.maxAccessCount ? ` จาก ${link.maxAccessCount}` : ""}
                          </Badge>
                          <Badge variant="secondary">
                            Trust {trustChecks.filter((check) => check.present).length}/{trustChecks.length} พร้อม
                          </Badge>
                        </div>
                        {link.passcodeRequired && Number(link.passcodeFailedAttempts ?? 0) > 0 && (
                          <div className={`mt-2 flex items-center gap-1.5 text-xs font-medium ${
                            Number(link.passcodeFailedAttempts) >= Number(link.passcodeMaxAttempts ?? 5)
                              ? "text-red-600" : Number(link.passcodeFailedAttempts) >= Math.ceil(Number(link.passcodeMaxAttempts ?? 5) * 0.6)
                              ? "text-amber-600" : "text-muted-foreground"
                          }`}>
                            <AlertTriangle className="h-3.5 w-3.5" />
                            {Number(link.passcodeFailedAttempts) >= Number(link.passcodeMaxAttempts ?? 5)
                              ? "Locked - passcode limit reached"
                              : `ใส่ passcode ผิด ${link.passcodeFailedAttempts}/${link.passcodeMaxAttempts ?? 5} ครั้ง`}
                          </div>
                        )}
                      </div>
                      <Badge
                        className={statusTone[link.status] ?? statusTone.expired}
                      >
                        {link.status}
                      </Badge>
                    </div>
                  </button>
                  {isSelected && selected && (
                    <div className="xl:hidden">
                      <ShlInlineDetail
                        selected={selectedRecord}
                        fileRows={fileRows}
                        versionRows={versionRows}
                        accessRows={accessRows}
                        onCopy={() => copyText(selected.viewerUrl ?? selected.qrPayload)}
                        onRotate={() => rotatePasscode.mutate({ id: selected.id })}
                        onResetAttempts={() => resetAttempts.mutate({ id: selected.id })}
                        rotatePending={rotatePasscode.isPending}
                        resetPending={resetAttempts.isPending}
                        documentBundle={documentBundle}
                      />
                    </div>
                  )}
                </div>
              );
            })}
            {!links.isLoading && links.data?.length === 0 && (
              <Card>
                <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10">
                    <FileSearch className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">No Smart Health Links yet.</p>
                    <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                      Create a passcode-protected link when a hospital, partner,
                      or verifier needs a time-limited health packet.
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button size="sm" onClick={() => setOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Create SHL
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        window.location.href = "/prepare-service";
                      }}
                    >
                      Prepare service packet
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="hidden space-y-5 xl:block">
            {!selected ? (
              <Card>
                <CardContent className="flex min-h-[360px] items-center justify-center text-sm text-muted-foreground">
                  Select an SHL package.
                </CardContent>
              </Card>
            ) : (
              <>
                <Card>
                  <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <LockKeyhole className="h-5 w-5 text-primary" />
                        {selected.label ??
                          purposeLabels[selected.purpose] ??
                          selected.purpose}
                      </CardTitle>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge
                          className={
                            statusTone[selected.status] ?? statusTone.expired
                          }
                        >
                          {selected.status}
                        </Badge>
                        <Badge variant="outline">{selected.context}</Badge>
                        {selected.manifestCredentialId && (
                          <Badge variant="outline">VC bound</Badge>
                        )}
                        {selected.presentationId && (
                          <Badge variant="outline">VP bound</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          copyText(selected.viewerUrl ?? selected.qrPayload)
                        }
                      >
                        <Clipboard className="mr-2 h-4 w-4" />
                        Copy
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          rotatePasscode.mutate({ id: selected.id })
                        }
                        disabled={
                          rotatePasscode.isPending ||
                          selected.status !== "active"
                        }
                      >
                        <KeyRound className="mr-2 h-4 w-4" />
                        Rotate
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600"
                        onClick={() =>
                          revokeShl.mutate({
                            id: selected.id,
                            reason: "User revoked from SHL workbench",
                          })
                        }
                        disabled={selected.status !== "active"}
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Revoke
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ShlFriendlySummary shl={selectedRecord} />
                    <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
                      <div className="rounded-md border p-3">
                        <QRCodeCanvas
                          value={selected.viewerUrl ?? selected.qrPayload ?? ""}
                          size={190}
                          includeMargin
                        />
                      </div>
                      <div className="grid gap-3 text-sm md:grid-cols-2">
                        <Metric
                          icon={FileJson2}
                          label="Manifest fingerprint"
                          value={shortHash(selected.manifestHash)}
                          hint="Used to prove the package was not changed after issuance."
                        />
                        <Metric
                          icon={CheckCircle2}
                          label="Health data bundle"
                          value={shortHash(selected.sourceBundleHash)}
                          hint="FHIR/legacy files are listed in the SHL manifest and checked by hash."
                        />
                        <Metric
                          icon={Clock}
                          label="Expires"
                          value={
                            selected.expiresAt
                              ? new Date(selected.expiresAt).toLocaleString()
                              : "No expiry"
                          }
                          hint="After this time the link should no longer disclose files."
                        />
                        <Metric
                          icon={Eye}
                          label="Access used"
                          value={formatAccessCount(selected)}
                          hint="This means how many times the manifest has been opened by recipients."
                        />
                      </div>
                    </div>
                    {/* Passcode Lock-out Warning Panel */}
                    {selected.passcodeRequired && (() => {
                      const failed = Number(selected.passcodeFailedAttempts ?? 0);
                      const max = Number(selected.passcodeMaxAttempts ?? 5);
                      const remaining = Math.max(max - failed, 0);
                      const isLocked = failed >= max;
                      const isWarning = failed >= Math.ceil(max * 0.6) && !isLocked;
                      if (failed === 0) return null;
                      return (
                        <div className={`mt-4 rounded-lg border p-4 ${
                          isLocked ? "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/30"
                          : isWarning ? "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30"
                          : "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/30"
                        }`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${
                                isLocked ? "text-red-600" : isWarning ? "text-amber-600" : "text-muted-foreground"
                              }`} />
                              <div>
                                <p className={`text-sm font-semibold ${
                                  isLocked ? "text-red-700 dark:text-red-400" : isWarning ? "text-amber-700 dark:text-amber-400" : ""
                                }`}>
                                  {isLocked ? "SHL Locked - Passcode Failure Limit Reached" : "Passcode Attempts Warning"}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {isLocked
                                    ? `This SHL has been automatically disabled after ${failed} failed passcode attempts. Reset attempts to reactivate.`
                                    : `${failed} of ${max} passcode attempts used. ${remaining} remaining before auto-lockout.`}
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className={isLocked ? "border-red-300 text-red-700 hover:bg-red-100" : ""}
                              onClick={() => resetAttempts.mutate({ id: selected.id })}
                              disabled={resetAttempts.isPending}
                            >
                              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                              {isLocked ? "Unlock & Reset" : "Reset Attempts"}
                            </Button>
                          </div>
                          <div className="mt-3">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>Failed: {failed}/{max}</span>
                              <span>Remaining: {remaining}</span>
                            </div>
                            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  isLocked ? "bg-red-500" : isWarning ? "bg-amber-500" : "bg-zinc-400"
                                }`}
                                style={{ width: `${Math.min((failed / max) * 100, 100)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                    <ShlTrustChecklist shl={selectedRecord} fileCount={fileRows.length} />
                    <ManifestDocumentBundle bundle={documentBundle} />
                    <Separator className="my-4" />
                    <div className="grid gap-2 text-xs">
                      <div className="truncate">
                        <span className="text-muted-foreground">
                          Manifest URL:
                        </span>{" "}
                        {selected.manifestUrl}
                      </div>
                      <div className="truncate">
                        <span className="text-muted-foreground">
                          Viewer URL:
                        </span>{" "}
                        {selected.viewerUrl}
                      </div>
                      <div className="truncate">
                        <span className="text-muted-foreground">SHLink:</span>{" "}
                        {selected.qrPayload}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Tabs defaultValue="documents">
                  <TabsList>
                    <TabsTrigger value="documents">Documents</TabsTrigger>
                    <TabsTrigger value="files">Files</TabsTrigger>
                    <TabsTrigger value="versions">Versions</TabsTrigger>
                    <TabsTrigger value="access">Access log</TabsTrigger>
                  </TabsList>
                  <TabsContent value="documents" className="space-y-2">
                    <ManifestDocumentBundle bundle={documentBundle} compact />
                  </TabsContent>
                  <TabsContent value="files" className="space-y-2">
                    {fileRows.map((file: any) => (
                      <Row
                        key={file.id}
                        title={file.contentType}
                        subtitle={file.fileId}
                        right={shortHash(file.contentHash)}
                      />
                    ))}
                  </TabsContent>
                  <TabsContent value="versions" className="space-y-2">
                    {versionRows.map((version: any) => (
                      <Row
                        key={version.id}
                        title={`v${version.manifestVersion} ${version.status}`}
                        subtitle={version.changeReason ?? (version.createdAt ? new Date(version.createdAt).toLocaleString() : '')}
                        right={shortHash(version.manifestHash)}
                      />
                    ))}
                  </TabsContent>
                  <TabsContent value="access" className="space-y-2">
                    {accessRows.map((log: any) => (
                      <Row
                        key={log.id}
                        title={`${log.result} ${log.recipient ?? ""}`}
                        subtitle={`${log.accessorOrg ?? log.accessorName ?? "External viewer"} ${log.accessorCountry ?? ""}`}
                        right={new Date(log.accessedAt).toLocaleString()}
                      />
                    ))}
                    {accessRows.length === 0 && (
                      <div className="rounded-md border p-4 text-sm text-muted-foreground">
                        No access events.
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function ShlInlineDetail({
  selected,
  fileRows,
  versionRows,
  accessRows,
  onCopy,
  onRotate,
  onResetAttempts,
  rotatePending,
  resetPending,
  documentBundle,
}: {
  selected: any;
  fileRows: any[];
  versionRows: any[];
  accessRows: any[];
  onCopy: () => void;
  onRotate: () => void;
  onResetAttempts: () => void;
  rotatePending?: boolean;
  resetPending?: boolean;
  documentBundle?: any;
}) {
  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <LockKeyhole className="h-4 w-4 text-primary" />
            {selected.label ?? purposeLabels[selected.purpose] ?? selected.purpose}
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={onCopy}>
              <Clipboard className="mr-2 h-4 w-4" />
              Copy
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onRotate}
              disabled={rotatePending || selected.status !== "active"}
            >
              <KeyRound className="mr-2 h-4 w-4" />
              Rotate
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ShlFriendlySummary shl={selected} />
        <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
          <div className="rounded-md border bg-background p-3">
            <QRCodeCanvas
              value={selected.viewerUrl ?? selected.qrPayload ?? ""}
              size={150}
              includeMargin
            />
          </div>
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <Metric
              icon={Eye}
              label="Access used"
              value={formatAccessCount(selected)}
              hint="จำนวนครั้งที่ผู้รับเปิด manifest แล้ว"
            />
            <Metric
              icon={Clock}
              label="Expires"
              value={selected.expiresAt ? new Date(selected.expiresAt).toLocaleString() : "No expiry"}
              hint="หมดอายุแล้วจะไม่ควรเปิดไฟล์สุขภาพได้"
            />
            <Metric
              icon={FileJson2}
              label="Manifest fingerprint"
              value={shortHash(selected.manifestHash)}
              hint="ใช้ตรวจว่า manifest ไม่ถูกแก้ไข"
            />
            <Metric
              icon={CheckCircle2}
              label="Health data bundle"
              value={shortHash(selected.sourceBundleHash)}
              hint="FHIR bundle หรือ legacy files ที่ถูกเข้ารหัส"
            />
          </div>
        </div>
        <PasscodeWarning
          selected={selected}
          onResetAttempts={onResetAttempts}
          resetPending={resetPending}
        />
        <ShlTrustChecklist shl={selected} fileCount={fileRows.length} />
        <ManifestDocumentBundle bundle={documentBundle} />
        <Tabs defaultValue="documents">
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="files">Files ({fileRows.length})</TabsTrigger>
            <TabsTrigger value="versions">Versions ({versionRows.length})</TabsTrigger>
            <TabsTrigger value="access">Access log ({accessRows.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="documents" className="space-y-2">
            <ManifestDocumentBundle bundle={documentBundle} compact />
          </TabsContent>
          <TabsContent value="files" className="space-y-2">
            {fileRows.length ? fileRows.map((file: any) => (
              <Row
                key={file.id}
                title={file.contentType}
                subtitle={file.fileId}
                right={shortHash(file.contentHash)}
              />
            )) : <EmptyDetailRow label="No files loaded for this package yet." />}
          </TabsContent>
          <TabsContent value="versions" className="space-y-2">
            {versionRows.length ? versionRows.map((version: any) => (
              <Row
                key={version.id}
                title={`v${version.manifestVersion} ${version.status}`}
                subtitle={version.changeReason ?? (version.createdAt ? new Date(version.createdAt).toLocaleString() : "")}
                right={shortHash(version.manifestHash)}
              />
            )) : <EmptyDetailRow label="No version history loaded yet." />}
          </TabsContent>
          <TabsContent value="access" className="space-y-2">
            {accessRows.length ? accessRows.map((log: any) => (
              <Row
                key={log.id}
                title={`${log.result} ${log.recipient ?? ""}`}
                subtitle={`${log.accessorOrg ?? log.accessorName ?? "External viewer"} ${log.accessorCountry ?? ""}`}
                right={log.accessedAt ? new Date(log.accessedAt).toLocaleString() : undefined}
              />
            )) : <EmptyDetailRow label="No access events yet." />}
          </TabsContent>
        </Tabs>
        <details className="rounded-md border bg-background p-3 text-xs">
          <summary className="cursor-pointer font-medium">Technical references</summary>
          <div className="mt-3 grid gap-2">
            <div className="truncate"><span className="text-muted-foreground">Manifest URL:</span> {selected.manifestUrl}</div>
            <div className="truncate"><span className="text-muted-foreground">Viewer URL:</span> {selected.viewerUrl}</div>
            <div className="truncate"><span className="text-muted-foreground">SHLink:</span> {selected.qrPayload}</div>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

function ShlFriendlySummary({ shl }: { shl: any }) {
  const friendly = getShlFriendlyContext(shl);
  return (
    <div className="mb-4 rounded-md border bg-muted/30 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold">{friendly.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{friendly.why}</p>
        </div>
        <Badge variant="outline" className="w-fit">{purposeLabels[shl?.purpose] ?? shl?.purpose ?? "SHL"}</Badge>
      </div>
      <div className="mt-3 grid gap-3 text-sm md:grid-cols-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Intended recipient</p>
          <p className="mt-1">{friendly.recipient}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Typical contents</p>
          <p className="mt-1">{friendly.includes.join(", ")}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Recommended next step</p>
          <p className="mt-1">{friendly.nextAction}</p>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{friendly.riskNote}</p>
    </div>
  );
}

function PasscodeWarning({
  selected,
  onResetAttempts,
  resetPending,
}: {
  selected: any;
  onResetAttempts: () => void;
  resetPending?: boolean;
}) {
  if (!selected.passcodeRequired) return null;
  const failed = Number(selected.passcodeFailedAttempts ?? 0);
  if (failed === 0) return null;
  const max = Number(selected.passcodeMaxAttempts ?? 5);
  const remaining = Math.max(max - failed, 0);
  const isLocked = failed >= max;
  const isWarning = failed >= Math.ceil(max * 0.6) && !isLocked;
  return (
    <div className={`mt-4 rounded-lg border p-4 ${
      isLocked ? "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/30"
      : isWarning ? "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30"
      : "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/30"
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${
            isLocked ? "text-red-600" : isWarning ? "text-amber-600" : "text-muted-foreground"
          }`} />
          <div>
            <p className={`text-sm font-semibold ${
              isLocked ? "text-red-700 dark:text-red-400" : isWarning ? "text-amber-700 dark:text-amber-400" : ""
            }`}>
              {isLocked ? "SHL Locked - Passcode Failure Limit Reached" : "Passcode Attempts Warning"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {isLocked
                ? `This SHL has been automatically disabled after ${failed} failed passcode attempts. Reset attempts to reactivate.`
                : `${failed} of ${max} passcode attempts used. ${remaining} remaining before auto-lockout.`}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className={isLocked ? "border-red-300 text-red-700 hover:bg-red-100" : ""}
          onClick={onResetAttempts}
          disabled={resetPending}
        >
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
          {isLocked ? "Unlock & Reset" : "Reset Attempts"}
        </Button>
      </div>
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Failed: {failed}/{max}</span>
          <span>Remaining: {remaining}</span>
        </div>
        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
          <div
            className={`h-full rounded-full transition-all ${
              isLocked ? "bg-red-500" : isWarning ? "bg-amber-500" : "bg-zinc-400"
            }`}
            style={{ width: `${Math.min((failed / max) * 100, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function ManifestDocumentBundle({ bundle, compact = false }: { bundle?: any; compact?: boolean }) {
  const documents = bundle?.documents ?? [];
  if (!bundle || documents.length === 0) {
    return (
      <div className="rounded-md border p-4 text-sm text-muted-foreground">
        No manifest document bundle is available yet.
      </div>
    );
  }
  return (
    <div className={compact ? "space-y-2" : "mt-4 rounded-md border bg-muted/30 p-3"}>
      {!compact && (
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold">Manifest Document Bundle</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Documents associated with this SHL manifest, including FHIR object links and VC/VP trust bindings.
            </p>
          </div>
          <Badge variant="outline">{documents.length} documents</Badge>
        </div>
      )}
      <div className="grid gap-2">
        {documents.map((doc: any) => (
          <details
            key={doc.id ?? doc.documentType}
            className="rounded-md border bg-background p-3"
            open={!compact && Number(doc.sequence ?? 1) === 1}
          >
            <summary className="cursor-pointer list-none">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <FileSearch className="h-4 w-4 text-primary" />
                    <p className="truncate text-sm font-semibold">{doc.title}</p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {doc.documentType} - {doc.category} - {doc.sourceRole}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={doc.status === "available_in_manifest" ? "secondary" : "outline"}>
                    {doc.status}
                  </Badge>
                  {doc.vcBinding?.recommendedCredentialType && (
                    <Badge variant="outline">{doc.vcBinding.recommendedCredentialType}</Badge>
                  )}
                </div>
              </div>
            </summary>
            <div className="mt-3 grid gap-3 text-xs md:grid-cols-2 xl:grid-cols-3">
              <ObjectLink label="FHIR object" value={doc.objectLinks?.fhirDocumentReference} />
              <ObjectLink label="Manifest file" value={doc.objectLinks?.shlFile ?? doc.manifestFileId} />
              <ObjectLink label="FHIR bundle" value={doc.objectLinks?.fhirBundle} />
              <ObjectLink label="Manifest VC" value={doc.objectLinks?.manifestCredential} />
              <ObjectLink label="Holder VP" value={doc.objectLinks?.holderPresentation} />
              <ObjectLink label="Future API" value={doc.objectLinks?.futureApi} />
            </div>
            <div className="mt-3 grid gap-2 text-xs md:grid-cols-3">
              <ShlFieldLine label="Content hash" value={shortHash(doc.hash?.contentHash)} />
              <ShlFieldLine label="Plaintext hash" value={shortHash(doc.hash?.plaintextHash)} />
              <ShlFieldLine label="Source bundle hash" value={shortHash(doc.hash?.sourceBundleHash)} />
            </div>
            <div className="mt-3 rounded-md border bg-muted/30 p-2 text-xs text-muted-foreground">
              Associated trust: Manifest VC proves the manifest and hashes; Holder VP proves patient/holder consent around this SHL; access policy applies passcode, expiry, access count, and revocation.
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

function ObjectLink({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="min-w-0 rounded-md border p-2">
      <p className="text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-mono text-[11px]">{value || "pending"}</p>
    </div>
  );
}

function ShlFieldLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-2">
      <p className="text-muted-foreground">{label}</p>
      <p className="mt-1 break-words font-mono text-[11px]">{value}</p>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: any;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span>{label}</span>
      </div>
      <div className="mt-1 font-medium">{value}</div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Row({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border p-3 text-sm">
      <div className="min-w-0">
        <div className="truncate font-medium">{title}</div>
        {subtitle && (
          <div className="truncate text-xs text-muted-foreground">
            {subtitle}
          </div>
        )}
      </div>
      {right && (
        <div className="shrink-0 font-mono text-xs text-muted-foreground">
          {right}
        </div>
      )}
    </div>
  );
}

function EmptyDetailRow({ label }: { label: string }) {
  return (
    <div className="rounded-md border p-4 text-sm text-muted-foreground">
      {label}
    </div>
  );
}

function ShlTrustChecklist({ shl, fileCount }: { shl: any; fileCount: number }) {
  const checks = buildShlTrustChecks(shl, fileCount);

  return (
    <div className="mt-4 rounded-md border bg-muted/30 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">VC/VP trust layer around SHL</p>
          <p className="mt-1 text-xs text-muted-foreground">
            These checks explain why the SHL can be trusted without forcing the shlink itself to be a VC.
          </p>
        </div>
        <Badge variant="outline">
          {checks.filter((check) => check.present).length} of {checks.length} ready
        </Badge>
      </div>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {checks.map((check) => (
          <div key={check.key} className="rounded-md border bg-background p-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{check.label}</span>
              <Badge variant={check.present ? "secondary" : "destructive"}>{check.present ? "present" : "missing"}</Badge>
            </div>
            <p className="mt-1 text-muted-foreground">{check.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function buildShlTrustChecks(shl: any, fileCount: number) {
  return [
    {
      key: "transport",
      label: "SHL transport",
      present: Boolean(shl?.manifestUrl && shl?.qrPayload),
      detail: "QR/link points to a manifest and encrypted health files, not to a VC directly.",
    },
    {
      key: "manifestCredential",
      label: "Manifest VC",
      present: Boolean(shl?.manifestCredentialId),
      detail: "Manifest hash, source bundle hash, purpose, expiry, and issuer trust are bound to a credential.",
    },
    {
      key: "holderPresentation",
      label: "Holder VP",
      present: Boolean(shl?.presentationId),
      detail: "A holder presentation proves patient consent/holder binding around the shared packet.",
    },
    {
      key: "fileHashes",
      label: "File hashes",
      present: Boolean((fileCount > 0 || shl?.sourceBundleHash) && shl?.manifestHash),
      detail: "FHIR JSON and legacy DocumentReference files can be checked against the manifest.",
    },
    {
      key: "accessPolicy",
      label: "Access policy",
      present: Boolean(shl?.passcodeRequired || shl?.expiresAt || shl?.maxAccessCount),
      detail: "Passcode, expiry, access count, revocation, and audit controls protect the link.",
    },
  ];
}

function getShlFriendlyContext(shl: any) {
  const context = String(shl?.context ?? "").toLowerCase();
  const purpose = String(shl?.purpose ?? "").toLowerCase();
  const label = String(shl?.label ?? "").toLowerCase();
  const keys = [
    context,
    purpose,
    label.includes("claim") ? "e_claim" : "",
    label.includes("tourist") ? "medical_tourist" : "",
    label.includes("referral") ? "referral" : "",
    label.includes("emergency") ? "emergency" : "",
    label.includes("pharmacy") ? "treatment" : "",
  ].filter(Boolean);
  for (const key of keys) {
    if (shlFriendlyContexts[key]) return shlFriendlyContexts[key];
  }
  return shlFriendlyContexts.patient_summary;
}

const clientManifestTemplates: Record<string, Array<{ documentType: string; title: string; category: string; sourceRole: string; vcType?: string }>> = {
  medical_tourist: [
    { documentType: "travel_document", title: "Passport / travel identity", category: "identity_and_access", sourceRole: "International desk" },
    { documentType: "patient_summary", title: "Clinical summary for pre-review", category: "clinical_summary", sourceRole: "Referring clinician", vcType: "PatientSummaryCredential" },
    { documentType: "quotation", title: "Treatment quotation / estimate", category: "medical_tourism", sourceRole: "International desk", vcType: "QuotationCredential" },
    { documentType: "guarantee_letter", title: "Guarantee letter or payer support", category: "medical_tourism", sourceRole: "Payer or facilitator" },
  ],
  e_claim: [
    { documentType: "insurance_eligibility", title: "Coverage eligibility", category: "claims_and_finance", sourceRole: "Payer adapter", vcType: "CoverageEligibilityCredential" },
    { documentType: "claim_package", title: "Verified claim package", category: "claims_and_finance", sourceRole: "Claim center", vcType: "ClaimPackageCredential" },
    { documentType: "invoice", title: "Invoice / charge summary", category: "claims_and_finance", sourceRole: "Hospital finance" },
    { documentType: "claim_receipt", title: "Receipt / payment evidence", category: "claims_and_finance", sourceRole: "Hospital finance", vcType: "ReceiptCredential" },
  ],
  insurance: [
    { documentType: "insurance_eligibility", title: "Coverage eligibility", category: "claims_and_finance", sourceRole: "Payer adapter", vcType: "CoverageEligibilityCredential" },
    { documentType: "claim_package", title: "Verified claim package", category: "claims_and_finance", sourceRole: "Claim center", vcType: "ClaimPackageCredential" },
    { documentType: "invoice", title: "Invoice / charge summary", category: "claims_and_finance", sourceRole: "Hospital finance" },
    { documentType: "claim_receipt", title: "Receipt / payment evidence", category: "claims_and_finance", sourceRole: "Hospital finance", vcType: "ReceiptCredential" },
  ],
  referral: [
    { documentType: "referral_vc", title: "Referral document", category: "care_transition", sourceRole: "Referring hospital", vcType: "ReferralCredential" },
    { documentType: "patient_summary", title: "Patient summary", category: "clinical_summary", sourceRole: "Referring clinician", vcType: "PatientSummaryCredential" },
    { documentType: "lab_result", title: "Relevant laboratory results", category: "diagnostics_and_results", sourceRole: "LIS" },
    { documentType: "consent_receipt", title: "Referral consent receipt", category: "identity_and_access", sourceRole: "Patient wallet", vcType: "ConsentReceiptCredential" },
  ],
  cross_branch_referral: [
    { documentType: "referral_vc", title: "Referral document", category: "care_transition", sourceRole: "Referring hospital", vcType: "ReferralCredential" },
    { documentType: "patient_summary", title: "Patient summary", category: "clinical_summary", sourceRole: "Referring clinician", vcType: "PatientSummaryCredential" },
    { documentType: "lab_result", title: "Relevant laboratory results", category: "diagnostics_and_results", sourceRole: "LIS" },
    { documentType: "consent_receipt", title: "Referral consent receipt", category: "identity_and_access", sourceRole: "Patient wallet", vcType: "ConsentReceiptCredential" },
  ],
  emergency: [
    { documentType: "patient_identity", title: "Patient identity", category: "identity_and_access", sourceRole: "Patient wallet", vcType: "PatientIdentityCredential" },
    { documentType: "allergy_alert", title: "Allergy alerts", category: "clinical_summary", sourceRole: "HIS/EMR" },
    { documentType: "medication_summary", title: "Current medications", category: "medication_and_pharmacy", sourceRole: "Pharmacy" },
    { documentType: "patient_summary", title: "Critical conditions summary", category: "clinical_summary", sourceRole: "HIS/EMR", vcType: "PatientSummaryCredential" },
  ],
  treatment: [
    { documentType: "patient_identity", title: "Patient identity", category: "identity_and_access", sourceRole: "Patient wallet", vcType: "PatientIdentityCredential" },
    { documentType: "patient_summary", title: "Recent patient summary", category: "clinical_summary", sourceRole: "HIS/EMR", vcType: "PatientSummaryCredential" },
    { documentType: "medication_summary", title: "Current medications", category: "medication_and_pharmacy", sourceRole: "Pharmacy" },
    { documentType: "allergy_alert", title: "Allergy alerts", category: "clinical_summary", sourceRole: "HIS/EMR" },
  ],
};

function buildClientDocumentBundle(shl: any, files: any[]) {
  const key = String(shl?.context ?? shl?.purpose ?? "patient_summary");
  const templates = clientManifestTemplates[key] ?? clientManifestTemplates[String(shl?.purpose ?? "")] ?? clientManifestTemplates.treatment;
  const manifestVersion = Number(shl?.currentManifestVersion ?? files[0]?.manifestVersion ?? 1);
  const file = files.find((row) => row.contentType === "application/fhir+json") ?? files[0] ?? {};
  return {
    bundleId: `shl-bundle-${shl?.id ?? "selected"}-v${manifestVersion}`,
    manifestVersion,
    source: "client_fallback_until_backend_document_bundle_is_seeded",
    bindingModel: "SHL manifest file -> FHIR Bundle/DocumentReference -> VC/VP trust links",
    status: shl?.status,
    documents: templates.map((template, index) => ({
      id: `fallback-${shl?.id ?? "shl"}-${template.documentType}`,
      sequence: index + 1,
      title: template.title,
      documentType: template.documentType,
      category: template.category,
      status: shl?.status === "active" ? "available_in_manifest" : "linked_to_inactive_shl",
      sourceRole: template.sourceRole,
      fhirResource: template.documentType.includes("identity") ? "Patient" : "DocumentReference",
      contentType: file.contentType ?? "application/fhir+json",
      manifestFileId: file.fileId,
      manifestFileDbId: file.id,
      manifestVersion,
      hash: {
        contentHash: file.contentHash,
        plaintextHash: file.plaintextHash,
        sourceBundleHash: shl?.sourceBundleHash,
      },
      objectLinks: {
        manifest: shl?.manifestUrl,
        shlFile: file.fileId ? `shl://${shl?.id}/versions/${manifestVersion}/files/${file.fileId}` : undefined,
        fhirDocumentReference: `DocumentReference/shl-${shl?.id}-${manifestVersion}-${template.documentType}`,
        fhirBundle: shl?.sourceBundleHash ? `Bundle/${shl.sourceBundleHash}` : undefined,
        manifestCredential: shl?.manifestCredentialId ? `Credential/${shl.manifestCredentialId}` : undefined,
        holderPresentation: shl?.presentationId ? `Presentation/${shl.presentationId}` : undefined,
        futureApi: `/api/shl/${shl?.id}/manifest-documents/${template.documentType}`,
      },
      vcBinding: {
        recommendedCredentialType: template.vcType,
        manifestCredentialId: shl?.manifestCredentialId,
        presentationId: shl?.presentationId,
      },
      accessBinding: {
        passcodeRequired: Boolean(shl?.passcodeRequired),
        expiresAt: shl?.expiresAt,
        currentAccessCount: shl?.currentAccessCount ?? 0,
        maxAccessCount: shl?.maxAccessCount,
      },
    })),
    files,
  };
}

function formatAccessCount(shl: any) {
  const current = Number(shl?.currentAccessCount ?? 0);
  const max = shl?.maxAccessCount ? Number(shl.maxAccessCount) : null;
  if (!max) return `${current} opens, no fixed limit`;
  return `${current} opens of ${max} allowed`;
}

function shortHash(value?: string | null) {
  if (!value) return "pending";
  return value.length > 18
    ? `${value.slice(0, 10)}...${value.slice(-6)}`
    : value;
}

function copyText(value?: string | null) {
  if (!value) return;
  void navigator.clipboard.writeText(value);
  toast.success("Copied");
}
