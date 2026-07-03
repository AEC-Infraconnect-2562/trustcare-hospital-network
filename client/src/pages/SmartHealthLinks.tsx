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
            {(links.data ?? []).map((link: any) => (
              <button
                key={link.id}
                type="button"
                onClick={() => setSelectedId(link.id)}
                className={`w-full rounded-md border bg-card p-4 text-left transition hover:border-primary ${selectedId === link.id ? "border-primary shadow-sm" : ""}`}
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
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>{purposeLabels[link.purpose] ?? link.purpose}</span>
                      <span>{link.context}</span>
                      <span>
                        {link.currentAccessCount ?? 0}/
                        {link.maxAccessCount ?? "unlimited"}
                      </span>
                    </div>
                  </div>
                  <Badge
                    className={statusTone[link.status] ?? statusTone.expired}
                  >
                    {link.status}
                  </Badge>
                </div>
              </button>
            ))}
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

          <div className="space-y-5">
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
                          label="Manifest hash"
                          value={shortHash(selected.manifestHash)}
                        />
                        <Metric
                          icon={CheckCircle2}
                          label="FHIR bundle"
                          value={shortHash(selected.sourceBundleHash)}
                        />
                        <Metric
                          icon={Clock}
                          label="Expires"
                          value={
                            selected.expiresAt
                              ? new Date(selected.expiresAt).toLocaleString()
                              : "No expiry"
                          }
                        />
                        <Metric
                          icon={Eye}
                          label="Access"
                          value={`${selected.currentAccessCount ?? 0}/${selected.maxAccessCount ?? "unlimited"}`}
                        />
                      </div>
                    </div>
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

                <Tabs defaultValue="files">
                  <TabsList>
                    <TabsTrigger value="files">Files</TabsTrigger>
                    <TabsTrigger value="versions">Versions</TabsTrigger>
                    <TabsTrigger value="access">Access log</TabsTrigger>
                  </TabsList>
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
                        subtitle={version.changeReason ?? version.createdAt}
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

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span>{label}</span>
      </div>
      <div className="mt-1 font-medium">{value}</div>
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
