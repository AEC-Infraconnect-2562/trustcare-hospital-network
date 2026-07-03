import DashboardLayout from "@/components/DashboardLayout";
import { ServiceReadinessPanel } from "@/components/ServiceReadinessPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { readinessContextValues, type ReadinessContext } from "@shared/readiness";
import {
  BookOpenCheck,
  Building2,
  CalendarCheck2,
  ClipboardCheck,
  DatabaseZap,
  FileInput,
  Globe2,
  HeartPulse,
  Hospital,
  Network,
  PackageCheck,
  Plane,
  QrCode,
  ReceiptText,
  RefreshCcw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  UploadCloud,
  UserRoundPlus,
  WalletCards,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const contextIcons: Record<ReadinessContext, any> = {
  opd_visit: Stethoscope,
  emergency: ShieldAlert,
  referral: RefreshCcw,
  cross_border: Network,
  medical_tourist: Plane,
  insurance_claim: ReceiptText,
  pharmacy_dispense: PackageCheck,
};

type Mode = "patient" | "hospital" | "contracts" | "mapping" | "api";

export default function PrepareForService() {
  const [context, setContext] = useState<ReadinessContext>("opd_visit");
  const [mode, setMode] = useState<Mode>("patient");
  const [targetName, setTargetName] = useState("นายสมชาย ใจดี");
  const [importNotes, setImportNotes] = useState("Need last 12 months summary for this service context.");
  const workbenchQuery = trpc.wallet.prepareWorkbench.useQuery({ context });
  const importMutation = trpc.wallet.importForService.useMutation({
    onSuccess: result => toast.success(`Import ${result.importId} queued: ${result.status}`),
    onError: error => toast.error(error.message),
  });
  const deployMutation = trpc.wallet.deployBundleToWallet.useMutation({
    onSuccess: result => toast.success(`Deployment ${result.deploymentId} queued for ${result.counts.targets} wallet(s)`),
    onError: error => toast.error(error.message),
  });
  const walkInMutation = trpc.wallet.connectWalkInWallet.useMutation({
    onSuccess: result => toast.success(`Walk-in wallet ${result.connectionId}: ${result.status}`),
    onError: error => toast.error(error.message),
  });
  const bundleMutation = trpc.wallet.buildServiceBundle.useMutation({
    onSuccess: result => toast.success(`Bundle ${result.bundleId} is ${result.status}`),
    onError: error => toast.error(error.message),
  });

  const workbench = workbenchQuery.data as any;
  const activeContract = workbench?.activeContract;
  const readiness = workbench?.patient?.readiness;
  const patientUseCases = workbench?.patient?.visibleUseCases ?? [];
  const hospitalUseCases = workbench?.hospital?.visibleUseCases ?? [];
  const activeUseCase = useMemo(() => {
    return patientUseCases.find((item: any) => item.context === context) ?? patientUseCases[0];
  }, [patientUseCases, context]);

  const contextCards = useMemo(() => {
    const seen = new Set<ReadinessContext>();
    return patientUseCases.filter((item: any) => {
      if (!readinessContextValues.includes(item.context) || seen.has(item.context)) return false;
      seen.add(item.context);
      return true;
    });
  }, [patientUseCases]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-4xl">
            <div className="flex items-center gap-2">
              <HeartPulse className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">Prepare for Service</h1>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Core wallet-first readiness for patients and hospitals. Patients prepare a minimum necessary packet from
              their own wallet; hospitals verify incoming packets, onboard walk-in wallets, and issue documents back to
              target wallets.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="gap-1.5">
              <CalendarCheck2 className="h-3.5 w-3.5" />
              Wallet-first readiness
            </Badge>
            <Badge variant="secondary" className="gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              Contract-driven
            </Badge>
          </div>
        </div>

        <Tabs value={mode} onValueChange={value => setMode(value as Mode)}>
          <TabsList className="flex h-auto flex-wrap justify-start">
            <TabsTrigger value="patient" className="gap-2">
              <WalletCards className="h-4 w-4" />
              Patient
            </TabsTrigger>
            <TabsTrigger value="hospital" className="gap-2">
              <Hospital className="h-4 w-4" />
              Hospital
            </TabsTrigger>
            <TabsTrigger value="contracts" className="gap-2">
              <BookOpenCheck className="h-4 w-4" />
              Contract Hub
            </TabsTrigger>
            <TabsTrigger value="mapping" className="gap-2">
              <DatabaseZap className="h-4 w-4" />
              Data Mapping
            </TabsTrigger>
            <TabsTrigger value="api" className="gap-2">
              <Globe2 className="h-4 w-4" />
              API
            </TabsTrigger>
          </TabsList>

          <TabsContent value="patient" className="mt-5 space-y-5">
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold">Patient-facing bundle use cases</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      The patient menu shows what the wallet holder prepares for their own service. Inbound hospital
                      operations such as "foreign patient intake" are intentionally kept in the Hospital tab.
                    </p>
                  </div>
                  <Badge variant="outline">{activeUseCase?.bundleType ?? "ServiceReadinessBundle"}</Badge>
                </div>
              </CardContent>
            </Card>

            {workbenchQuery.isLoading ? (
              <LoadingCard label="Loading service readiness contracts..." />
            ) : (
              <>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {contextCards.map((item: any) => {
                    const Icon = contextIcons[item.context as ReadinessContext] ?? ClipboardCheck;
                    const selected = context === item.context;
                    return (
                      <Button
                        key={item.id}
                        variant={selected ? "default" : "outline"}
                        className="h-auto justify-start rounded-lg p-3 text-left"
                        onClick={() => setContext(item.context)}
                      >
                        <Icon className="mr-3 h-5 w-5 shrink-0" />
                        <span className="min-w-0">
                          <span className="block whitespace-normal text-sm font-semibold">{item.label}</span>
                          <span className={`block text-xs ${selected ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                            {item.labelEn}
                          </span>
                        </span>
                      </Button>
                    );
                  })}
                </div>

                <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <CardTitle className="text-lg">{activeContract?.patientLabel ?? "Prepare service packet"}</CardTitle>
                          <p className="mt-1 text-sm text-muted-foreground">{activeContract?.patientLabelEn}</p>
                        </div>
                        <Badge variant={readiness?.criticalReady ? "default" : "secondary"}>
                          {readiness?.criticalReady ? "Ready" : "Needs documents"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <div className="space-y-2">
                        <div className="flex items-end justify-between">
                          <div>
                            <p className="text-3xl font-semibold">{readiness?.score ?? 0}%</p>
                            <p className="text-xs text-muted-foreground">Contract readiness score</p>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Required {readiness?.requiredReady ?? 0}/{readiness?.requiredTotal ?? 0}
                          </p>
                        </div>
                        <Progress value={readiness?.score ?? 0} />
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <Checklist title="Ready in wallet" items={readiness?.ready ?? []} status="ready" />
                        <Checklist title="Missing for this case" items={readiness?.missing ?? []} status="missing" />
                      </div>

                      <Separator />

                      <div className="grid gap-3 md:grid-cols-3">
                        <ActionPanel
                          icon={UploadCloud}
                          title="Import / upload"
                          description="Legacy PDF, image, FHIR JSON, SHL, VC, VP, or source connector job."
                          button="Queue import"
                          onClick={() =>
                            importMutation.mutate({
                              context,
                              sourceType: "patient_upload",
                              documentType: readiness?.missing?.[0]?.cardTypes?.[0],
                              consentRef: "urn:trustcare:vc:consent:ui-simulated",
                            })
                          }
                          disabled={importMutation.isPending}
                        />
                        <ActionPanel
                          icon={FileInput}
                          title="Build bundle"
                          description="Create a contract-shaped Document Bundle before VP/SHL presentation."
                          button="Preview bundle"
                          onClick={() => bundleMutation.mutate({ context, audience: "patient", receiver: "TrustCare intake" })}
                          disabled={bundleMutation.isPending}
                        />
                        <ActionPanel
                          icon={QrCode}
                          title="Create VP/QR"
                          description="Use the real wallet packet flow below when signed VCs are available."
                          button="Use VP flow"
                          onClick={() => document.getElementById("real-vp-flow")?.scrollIntoView({ behavior: "smooth" })}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Dynamic intake form</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Generated from the active Contract Hub Questionnaire. Responses become QuestionnaireResponse and
                        can feed FHIR, VC, or document requests.
                      </p>
                      {(activeContract?.questionnaire?.item ?? []).slice(0, 6).map((item: any) => (
                        <div key={item.linkId} className="rounded-md border p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium">{item.text}</p>
                            {item.required && <Badge variant="secondary">required</Badge>}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">FHIR linkId: {item.linkId}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Document bundle preview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <BundlePreview bundle={workbench?.patient?.bundlePreview} />
                  </CardContent>
                </Card>

                <div id="real-vp-flow">
                  <ServiceReadinessPanel context={context} />
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="hospital" className="mt-5 space-y-5">
            <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Hospital className="h-5 w-5 text-primary" />
                    Hospital Service Readiness Workbench
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid gap-3 md:grid-cols-2">
                    {hospitalUseCases.map((item: any) => {
                      const Icon = contextIcons[item.context as ReadinessContext] ?? Building2;
                      return (
                        <button
                          key={item.id}
                          onClick={() => setContext(item.context)}
                          className={`rounded-lg border p-3 text-left transition hover:bg-accent ${context === item.context ? "border-primary bg-primary/5" : ""}`}
                        >
                          <div className="flex items-start gap-3">
                            <Icon className="mt-0.5 h-5 w-5 text-primary" />
                            <div>
                              <p className="text-sm font-semibold">{item.label}</p>
                              <p className="text-xs text-muted-foreground">{item.labelEn}</p>
                              <Badge variant="outline" className="mt-2">{item.bundleType}</Badge>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <Separator />

                  <div className="grid gap-3 md:grid-cols-3">
                    {(workbench?.hospital?.workQueue ?? []).map((queue: any) => (
                      <div key={queue.queueId} className="rounded-lg border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold">{queue.label}</p>
                          <Badge>{queue.count}</Badge>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">Next: {queue.nextAction}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Deploy to target wallet</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Target patient or wallet</Label>
                    <Input value={targetName} onChange={event => setTargetName(event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Import/review notes</Label>
                    <Textarea value={importNotes} onChange={event => setImportNotes(event.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Button
                      className="gap-2"
                      onClick={() => deployMutation.mutate({ context, targetWalletMode: "single", targetPatientIds: [1] })}
                      disabled={deployMutation.isPending}
                    >
                      <Send className="h-4 w-4" />
                      Deploy bundle
                    </Button>
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() => walkInMutation.mutate({ patientName: targetName, consentAttested: true })}
                      disabled={walkInMutation.isPending}
                    >
                      <UserRoundPlus className="h-4 w-4" />
                      Connect walk-in wallet
                    </Button>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    {(workbench?.hospital?.targetWallets ?? []).map((wallet: any) => (
                      <div key={wallet.patientId} className="rounded-md border p-3 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium">{wallet.name}</p>
                          <Badge variant="outline">{wallet.walletStatus}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{wallet.hn} - {wallet.holderDid}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Hospital-only cases hidden from patient menu</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {(workbench?.hospital?.hiddenFromPatient ?? []).map((item: any) => (
                  <div key={item.id} className="rounded-lg border border-dashed p-3">
                    <p className="text-sm font-semibold">{item.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.rationale}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contracts" className="mt-5 space-y-5">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BookOpenCheck className="h-5 w-5 text-primary" />
                  Contract Hub
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Versioned contracts keep Wallet, TrustCare, HIS connectors, partners, VC schema, FHIR profiles, and
                  consent policy aligned.
                </p>
                <div className="grid gap-3 lg:grid-cols-2">
                  {(workbench?.contractHub?.contracts ?? []).map((contract: any) => (
                    <div key={contract.contractId} className="rounded-lg border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold">{contract.contractId}</p>
                        <Badge variant="outline">{contract.status}</Badge>
                      </div>
                      <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
                        <ContractLine label="Patient" value={contract.patientLabel} />
                        <ContractLine label="Hospital" value={contract.hospitalLabel} />
                        <ContractLine label="Patient bundle" value={contract.bundleTypes.patient} />
                        <ContractLine label="Hospital bundle" value={contract.bundleTypes.hospital} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="mapping" className="mt-5 space-y-5">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <DatabaseZap className="h-5 w-5 text-primary" />
                  Data Mapping v2
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{workbench?.dataMappingV2?.principle}</p>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {(workbench?.dataMappingV2?.profiles ?? []).map((profile: any) => (
                    <div key={profile.mappingProfileId} className="rounded-lg border p-3">
                      <p className="text-sm font-semibold">{profile.mappingProfileId}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{profile.contractId}</p>
                      <div className="mt-3 space-y-2">
                        {profile.requiredOutputs.slice(0, 4).map((output: any) => (
                          <div key={output.requirementKey} className="rounded-md bg-muted p-2 text-xs">
                            <p className="font-medium">{output.documentType}</p>
                            <p className="text-muted-foreground">{output.fhirResources.join(", ")}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="api" className="mt-5 space-y-5">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Globe2 className="h-5 w-5 text-primary" />
                  Public API response formats
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-md border bg-muted p-3 text-sm">
                  <p className="font-mono">{workbench?.api?.basePath}</p>
                  <p className="mt-1 text-muted-foreground">{workbench?.api?.authModel}</p>
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  {(workbench?.api?.endpoints ?? []).map((endpoint: any) => (
                    <div key={`${endpoint.method}-${endpoint.path}`} className="rounded-lg border p-3">
                      <div className="flex items-center gap-2">
                        <Badge>{endpoint.method}</Badge>
                        <p className="font-mono text-sm">{endpoint.path}</p>
                      </div>
                      <pre className="mt-3 max-h-48 overflow-auto rounded-md bg-slate-950 p-3 text-xs text-slate-50">
                        {JSON.stringify(endpoint.response, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

function LoadingCard({ label }: { label: string }) {
  return (
    <Card>
      <CardContent className="flex min-h-[240px] items-center justify-center text-sm text-muted-foreground">
        {label}
      </CardContent>
    </Card>
  );
}

function Checklist({ title, items, status }: { title: string; items: any[]; status: "ready" | "missing" }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
        {status === "ready" ? <ClipboardCheck className="h-4 w-4 text-emerald-600" /> : <ShieldAlert className="h-4 w-4 text-amber-600" />}
        {title}
      </div>
      <div className="space-y-2">
        {items.length ? (
          items.map(item => (
            <div key={item.key} className="flex items-center justify-between gap-2 text-sm">
              <span>{item.label}</span>
              <Badge variant={status === "ready" ? "outline" : item.required ? "destructive" : "secondary"}>
                {status === "ready" ? item.matchedCards?.length ?? 1 : item.required ? "required" : "optional"}
              </Badge>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No items.</p>
        )}
      </div>
    </div>
  );
}

function ActionPanel({
  icon: Icon,
  title,
  description,
  button,
  onClick,
  disabled,
}: {
  icon: any;
  title: string;
  description: string;
  button: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="rounded-lg border p-3">
      <Icon className="h-5 w-5 text-primary" />
      <p className="mt-2 text-sm font-semibold">{title}</p>
      <p className="mt-1 min-h-12 text-xs text-muted-foreground">{description}</p>
      <Button variant="outline" size="sm" className="mt-3 w-full" onClick={onClick} disabled={disabled}>
        {button}
      </Button>
    </div>
  );
}

function BundlePreview({ bundle }: { bundle: any }) {
  if (!bundle) return <p className="text-sm text-muted-foreground">No bundle yet.</p>;
  return (
    <div className="grid gap-3 lg:grid-cols-[340px_1fr]">
      <div className="rounded-lg border p-3 text-sm">
        <p className="font-semibold">{bundle.bundleType}</p>
        <p className="mt-1 text-xs text-muted-foreground">{bundle.bundleId}</p>
        <div className="mt-3 grid gap-2">
          <ContractLine label="Status" value={bundle.status} />
          <ContractLine label="Direction" value={bundle.direction} />
          <ContractLine label="Score" value={`${bundle.readinessScore}%`} />
          <ContractLine label="Trust hash" value={bundle.trustLayer?.integrityHash?.slice(0, 16) + "..."} />
        </div>
      </div>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {(bundle.items ?? []).map((item: any) => (
          <div key={item.key} className="rounded-md border p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium">{item.label}</p>
              <Badge variant={item.status === "ready" ? "outline" : "secondary"}>{item.status}</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{item.outputArtifacts?.vcType}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ContractLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="break-words text-sm font-medium">{value}</p>
    </div>
  );
}
