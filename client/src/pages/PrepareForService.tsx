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
import { useAuth } from "@/_core/hooks/useAuth";
import { readinessContextValues, type ReadinessContext } from "@shared/readiness";
import {
  BookOpenCheck,
  Building2,
  CalendarCheck2,
  CheckCircle2,
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
  Wrench,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { QRCodeCanvas } from "qrcode.react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const contextIcons: Record<ReadinessContext, any> = {
  opd_visit: Stethoscope,
  emergency: ShieldAlert,
  referral: RefreshCcw,
  cross_border: Network,
  medical_tourist: Plane,
  insurance_claim: ReceiptText,
  pharmacy_dispense: PackageCheck,
};

const contextLabels: Record<ReadinessContext, { th: string; en: string }> = {
  opd_visit: { th: "ตรวจผู้ป่วยนอก", en: "OPD Visit" },
  emergency: { th: "ฉุกเฉิน", en: "Emergency" },
  referral: { th: "ส่งต่อ", en: "Referral" },
  cross_border: { th: "ข้ามพรมแดน", en: "Cross-border" },
  medical_tourist: { th: "ท่องเที่ยวเชิงการแพทย์", en: "Medical Tourist" },
  insurance_claim: { th: "เคลมประกัน", en: "Insurance Claim" },
  pharmacy_dispense: { th: "จ่ายยา", en: "Pharmacy Dispense" },
};

const hospitalUseCaseUx: Record<
  string,
  {
    primaryAction: string;
    operatorGoal: string;
    intake: string[];
    outputs: string[];
    nextSteps: string[];
    handoff: string;
  }
> = {
  HospitalOPDIntakeBundle: {
    primaryAction: "Verify OPD packet",
    operatorGoal: "Confirm the patient wallet packet is enough to open or update the encounter without asking the same history again.",
    intake: ["Patient identity", "Allergy and medication summary", "Patient-provided upload or SHL", "Coverage if available"],
    outputs: ["Encounter-ready FHIR Bundle", "DocumentReference review tasks", "Optional check-in SHL/VP"],
    nextSteps: ["Verify VP or SHL", "Repair missing mapping fields", "Create encounter draft in HIS", "Queue missing VC requests"],
    handoff: "Front desk and OPD nurse can start service once identity and critical clinical data are trusted.",
  },
  EmergencyIntakeBundle: {
    primaryAction: "Start break-glass review",
    operatorGoal: "Make critical allergy, medication, condition, and identity data visible fast while preserving break-glass audit.",
    intake: ["Emergency wallet card", "Critical allergy alerts", "Medication list", "Break-glass reason"],
    outputs: ["Short-lived emergency VP/SHL", "Break-glass audit event", "Triage-ready clinical summary"],
    nextSteps: ["Record emergency reason", "Verify holder or proxy", "Expose minimum critical data", "Expire access after emergency window"],
    handoff: "Emergency users see only life-critical data first; detailed documents remain governed by policy.",
  },
  ReferralHandoffBundle: {
    primaryAction: "Review referral handoff",
    operatorGoal: "Send or receive a referral packet with enough clinical context, consent, and version history for the receiving team.",
    intake: ["Referral VC or legacy referral letter", "Patient summary", "Relevant labs/images reports", "Consent receipt"],
    outputs: ["Referral handoff bundle", "Receiving task list", "SHL packet for large files"],
    nextSteps: ["Validate sender trust", "Check required referral documents", "Request missing diagnostics", "Generate receiver-facing SHL/VP"],
    handoff: "Referral coordinators can track accepted, missing, superseded, and revoked packets without losing audit history.",
  },
  CrossBorderReferralBundle: {
    primaryAction: "Prepare partner packet",
    operatorGoal: "Build a partner-verifiable packet for cross-network or cross-border care with language, consent, and trust constraints.",
    intake: ["Referral/summary", "Translation or bilingual summary", "Partner trust record", "Consent scoped to destination"],
    outputs: ["Cross-border SHL packet", "Partner portal submission", "Manifest VC and holder VP"],
    nextSteps: ["Confirm destination organization", "Validate consent scope", "Attach translated summary", "Issue or rotate SHL packet"],
    handoff: "Use named recipient, passcode, short expiry, and manifest history for cross-border workflows.",
  },
  InboundMedicalTouristBundle: {
    primaryAction: "Open international intake",
    operatorGoal: "Let the international desk collect medical history, travel identity, estimate, guarantee, and appointment readiness before arrival.",
    intake: ["Passport/travel document", "Clinical summary", "Guarantee letter or payer details", "Preferred service request"],
    outputs: ["Pre-review case", "Financial estimate task", "Appointment/onboarding bundle", "Wallet invitation if needed"],
    nextSteps: ["Verify identity and facilitator", "Clinical pre-review", "Create estimate", "Bind or invite target wallet"],
    handoff: "This is hospital-facing inbound work; patient-facing wording should be Prepare care abroad.",
  },
  VerifiedClaimPackageBundle: {
    primaryAction: "Verify claim package",
    operatorGoal: "Assemble payer-ready evidence from wallet, SHL, HIS, invoice, and receipt data before claim submission.",
    intake: ["Coverage eligibility", "Clinical summary or certificate", "Invoice and receipt", "Payer adapter policy"],
    outputs: ["Verified claim package", "Payer response tracker", "Claim audit receipt"],
    nextSteps: ["Check eligibility", "Validate invoice/receipt", "Attach clinical evidence", "Submit to payer adapter"],
    handoff: "Claim staff should see what is missing before submission and what payer response is expected next.",
  },
  PharmacyDispenseBundle: {
    primaryAction: "Verify dispense readiness",
    operatorGoal: "Confirm prescription, allergy, medication history, and patient identity before dispensing or refill.",
    intake: ["Prescription VC", "Patient identity", "Allergy alerts", "Current medication list"],
    outputs: ["Dispense-ready verification", "Medication safety warnings", "Dispense receipt VC"],
    nextSteps: ["Verify prescription issuer", "Check allergy/duplicate therapy", "Confirm patient identity", "Issue dispense receipt"],
    handoff: "Pharmacy users need a fast safety-first packet, not a full referral bundle.",
  },
  WalkInWalletOnboardingBundle: {
    primaryAction: "Connect walk-in wallet",
    operatorGoal: "Bind a new or external wallet to a patient record before issuing encounter documents into it.",
    intake: ["Identity evidence", "Phone/email invitation channel", "Holder DID QR", "Contextual consent"],
    outputs: ["Wallet binding record", "HN-to-DID mapping", "Starter identity/appointment VC"],
    nextSteps: ["Verify identity", "Scan or invite wallet", "Capture consent", "Sync HN mapping back to HIS"],
    handoff: "Walk-in onboarding must be auditable because the hospital is linking a holder DID to an HN.",
  },
  PartnerIntakeSubmissionBundle: {
    primaryAction: "Review partner submission",
    operatorGoal: "Accept partner-uploaded legacy files, FHIR, SHL, VC, or VP into a controlled verification queue before hospital use.",
    intake: ["Partner identity/API key", "Submitted documents", "FHIR/SHL/VC/VP evidence", "Source attestation"],
    outputs: ["Partner intake task", "DocumentReference set", "Trust validation report"],
    nextSteps: ["Validate partner trust", "Map files to DocumentReference", "Run DQI checks", "Route to Maker/Checker if issuing VC"],
    handoff: "Partner Portal is an intake channel, not a shortcut around consent, validation, and audit.",
  },
  WalletDeploymentBundle: {
    primaryAction: "Deploy documents to wallet",
    operatorGoal: "Issue hospital-created documents into a target patient wallet after mapping, Maker/Checker, and consent rules pass.",
    intake: ["Target wallet/HN", "Documents ready for issuance", "Maker/Checker policy", "Consent or treatment basis"],
    outputs: ["Issued VC records", "Wallet delivery receipt", "HIS sync-back receipt"],
    nextSteps: ["Select target wallet", "Confirm document types", "Route Checker approval", "Deliver VC and write sync receipt"],
    handoff: "This flow creates wallet-held outputs; patients should not be Maker/Checker for these documents.",
  },
};

const nextActionLabels: Record<string, string> = {
  verify_vp_or_shl: "Verify incoming VP or SHL packet",
  capture_consent_and_bind_wallet: "Capture consent and bind wallet DID",
  approve_and_issue_vc: "Approve and issue VC through Maker/Checker",
  clinical_pre_review_and_financial_estimate: "Clinical pre-review and financial estimate",
};

type Mode = "patient" | "hospital" | "contracts" | "mapping" | "api";

export default function PrepareForService() {
  const { user } = useAuth();
  const systemRole = (user as any)?.systemRole ?? "patient";
  const activeRole = (user as any)?.activeRole ?? systemRole;
  const isPatient = activeRole === "patient";

  const [context, setContext] = useState<ReadinessContext>("opd_visit");
  const [mode, setMode] = useState<Mode>(isPatient ? "patient" : "hospital");
  const [selectedHospitalUseCaseId, setSelectedHospitalUseCaseId] = useState<string | null>(null);
  const [targetName, setTargetName] = useState("");
  const [importNotes, setImportNotes] = useState("");

  const workbenchQuery = trpc.wallet.prepareWorkbench.useQuery({ context });
  const importMutation = trpc.wallet.importForService.useMutation({
    onSuccess: result => toast.success(`นำเข้าเอกสาร ${result.importId} สำเร็จ`),
    onError: error => toast.error(error.message),
  });
  const deployMutation = trpc.wallet.deployBundleToWallet.useMutation({
    onSuccess: result => toast.success(`ส่งเอกสารไปยัง ${result.counts.targets} กระเป๋าสำเร็จ`),
    onError: error => toast.error(error.message),
  });
  const walkInMutation = trpc.wallet.connectWalkInWallet.useMutation({
    onSuccess: result => toast.success(`เชื่อมต่อกระเป๋า Walk-in: ${result.connectionId}`),
    onError: error => toast.error(error.message),
  });
  const bundleMutation = trpc.wallet.buildServiceBundle.useMutation({
    onSuccess: result => toast.success(`สร้างชุดเอกสาร ${result.bundleId} สถานะ: ${result.status}`),
    onError: error => toast.error(error.message),
  });

  const workbench = workbenchQuery.data as any;
  const activeContract = workbench?.activeContract;
  const readiness = workbench?.patient?.readiness;
  const patientUseCases = workbench?.patient?.visibleUseCases ?? [];
  const hospitalUseCases = workbench?.hospital?.visibleUseCases ?? [];

  useEffect(() => {
    if (!hospitalUseCases.length) return;
    const stillExists = hospitalUseCases.some((item: any) => item.id === selectedHospitalUseCaseId);
    if (!stillExists) {
      setSelectedHospitalUseCaseId(hospitalUseCases[0].id);
    }
  }, [hospitalUseCases, selectedHospitalUseCaseId]);

  const contextCards = useMemo(() => {
    const seen = new Set<ReadinessContext>();
    const cases = isPatient ? patientUseCases : [...patientUseCases, ...hospitalUseCases];
    return cases.filter((item: any) => {
      if (!readinessContextValues.includes(item.context) || seen.has(item.context)) return false;
      seen.add(item.context);
      return true;
    });
  }, [patientUseCases, hospitalUseCases, isPatient]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-4xl">
            <div className="flex items-center gap-2">
              <HeartPulse className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">
                {isPatient ? "เตรียมเอกสารเข้ารับบริการ" : "Prepare for Service"}
              </h1>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {isPatient
                ? "เตรียมเอกสารที่จำเป็นสำหรับการเข้ารับบริการ ระบบจะตรวจสอบความพร้อมของเอกสารในกระเป๋าสุขภาพของคุณโดยอัตโนมัติ"
                : "Core wallet-first readiness for patients and hospitals. Verify incoming packets, onboard walk-in wallets, and issue documents to target wallets."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="gap-1.5">
              <CalendarCheck2 className="h-3.5 w-3.5" />
              {isPatient ? "ตรวจสอบอัตโนมัติ" : "Wallet-first readiness"}
            </Badge>
            <Badge variant="secondary" className="gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              {isPatient ? "ปลอดภัย" : "Contract-driven"}
            </Badge>
          </div>
        </div>

        {/* Mode Tabs - Patient sees only patient tab, Hospital sees all */}
        {isPatient ? (
          <PatientView
            context={context}
            setContext={setContext}
            contextCards={contextCards}
            activeContract={activeContract}
            readiness={readiness}
            workbench={workbench}
            importMutation={importMutation}
            bundleMutation={bundleMutation}
            workbenchQuery={workbenchQuery}
          />
        ) : (
          <Tabs value={mode} onValueChange={value => setMode(value as Mode)}>
            <TabsList className="flex h-auto flex-wrap justify-start">
              <TabsTrigger value="hospital" className="gap-2">
                <Hospital className="h-4 w-4" />
                Hospital Workbench
              </TabsTrigger>
              <TabsTrigger value="patient" className="gap-2">
                <WalletCards className="h-4 w-4" />
                Patient View
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

            <TabsContent value="hospital" className="mt-5 space-y-5">
              <HospitalWorkbench
                context={context}
                setContext={setContext}
                selectedHospitalUseCaseId={selectedHospitalUseCaseId}
                setSelectedHospitalUseCaseId={setSelectedHospitalUseCaseId}
                hospitalUseCases={hospitalUseCases}
                workbench={workbench}
                targetName={targetName}
                setTargetName={setTargetName}
                importNotes={importNotes}
                setImportNotes={setImportNotes}
                deployMutation={deployMutation}
                walkInMutation={walkInMutation}
                workbenchQuery={workbenchQuery}
              />
            </TabsContent>

            <TabsContent value="patient" className="mt-5 space-y-5">
              <PatientView
                context={context}
                setContext={setContext}
                contextCards={contextCards}
                activeContract={activeContract}
                readiness={readiness}
                workbench={workbench}
                importMutation={importMutation}
                bundleMutation={bundleMutation}
                workbenchQuery={workbenchQuery}
              />
            </TabsContent>

            <TabsContent value="contracts" className="mt-5 space-y-5">
              <ContractHubView workbench={workbench} workbenchQuery={workbenchQuery} />
            </TabsContent>

            <TabsContent value="mapping" className="mt-5 space-y-5">
              <DataMappingView workbench={workbench} workbenchQuery={workbenchQuery} />
            </TabsContent>

            <TabsContent value="api" className="mt-5 space-y-5">
              <ApiView workbench={workbench} workbenchQuery={workbenchQuery} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}

// ============================================================
// PATIENT VIEW - Simplified document preparation for patients
// ============================================================
function PatientView({
  context,
  setContext,
  contextCards,
  activeContract,
  readiness,
  workbench,
  importMutation,
  bundleMutation,
  workbenchQuery,
}: any) {
  const [, navigate] = useLocation();
  if (workbenchQuery.isError) {
    return <ErrorCard label="Prepare for Service data could not be loaded." error={workbenchQuery.error?.message} />;
  }

  const packetPolicy = activeContract?.packetTrustPolicy;
  const singleDocumentPolicy = workbench?.singleDocumentVcVp?.policy;

  return (
    <div className="space-y-5">
      {workbenchQuery.isLoading ? (
        <LoadingCard label="กำลังตรวจสอบความพร้อมเอกสาร..." />
      ) : (
        <>
          {/* Step 1: Choose service context */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">1</span>
                เลือกประเภทบริการ
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {contextCards.map((item: any) => {
                  const Icon = contextIcons[item.context as ReadinessContext] ?? ClipboardCheck;
                  const selected = context === item.context;
                  const labels = contextLabels[item.context as ReadinessContext];
                  return (
                    <Button
                      key={item.id}
                      variant={selected ? "default" : "outline"}
                      className="h-auto justify-start rounded-lg p-3 text-left"
                      onClick={() => setContext(item.context)}
                    >
                      <Icon className="mr-3 h-5 w-5 shrink-0" />
                      <span className="min-w-0">
                        <span className="block whitespace-normal text-sm font-semibold">{labels?.th ?? item.label}</span>
                        <span className={`block text-xs ${selected ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                          {labels?.en ?? item.labelEn}
                        </span>
                      </span>
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Step 2: Readiness check */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">2</span>
                ตรวจสอบความพร้อมเอกสาร
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {activeContract?.patientLabel ?? "ระบบตรวจสอบเอกสารที่จำเป็นจากกระเป๋าสุขภาพของคุณ"}
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Score */}
              <div className="space-y-2">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-3xl font-semibold">{readiness?.score ?? 0}%</p>
                    <p className="text-xs text-muted-foreground">ความพร้อมเอกสาร</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    เอกสารจำเป็น {readiness?.requiredReady ?? 0}/{readiness?.requiredTotal ?? 0} รายการ
                  </p>
                </div>
                <Progress value={readiness?.score ?? 0} className={readiness?.score === 100 ? "[&>div]:bg-emerald-500" : ""} />
              </div>

              {/* Ready / Missing lists */}
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-900 dark:bg-emerald-950/20">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                    เอกสารพร้อมแล้ว ({(readiness?.ready ?? []).length})
                  </div>
                  <div className="space-y-2">
                    {(readiness?.ready ?? []).length ? (
                      (readiness.ready as any[]).map((item: any) => (
                        <div key={item.key} className="flex items-center justify-between gap-2 text-sm">
                          <span>{item.label}</span>
                          <Badge variant="outline" className="text-emerald-700 dark:text-emerald-400">พร้อม</Badge>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">ยังไม่มีเอกสารในกระเป๋า</p>
                    )}
                  </div>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900 dark:bg-amber-950/20">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
                    <ShieldAlert className="h-4 w-4" />
                    เอกสารที่ยังขาด ({(readiness?.missing ?? []).length})
                  </div>
                  <div className="space-y-2">
                    {(readiness?.missing ?? []).length ? (
                      (readiness.missing as any[]).map((item: any) => (
                        <div key={item.key} className="flex items-center justify-between gap-2 text-sm">
                          <span>{item.label}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant={item.required ? "destructive" : "secondary"}>
                              {item.required ? "จำเป็น" : "ไม่บังคับ"}
                            </Badge>
                            <UploadDocButton context={context} documentType={item.cardTypes?.[0] ?? item.key} label={item.label} />
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">ครบทุกรายการแล้ว</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Dynamic intake form */}
              {(activeContract?.questionnaire?.item ?? []).length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className="mb-3 text-sm font-medium">แบบฟอร์มข้อมูลเพิ่มเติม</p>
                    <div className="grid gap-2 md:grid-cols-2">
                      {(activeContract.questionnaire.item as any[]).slice(0, 6).map((item: any) => (
                        <div key={item.linkId} className="rounded-md border p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium">{item.text}</p>
                            {item.required && <Badge variant="secondary">จำเป็น</Badge>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Step 3: Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">3</span>
                ดำเนินการ
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-3">
                <ActionPanel
                  icon={UploadCloud}
                  title="นำเข้าเอกสาร"
                  description="อัปโหลด PDF, รูปภาพ, หรือนำเข้าจากระบบอื่น เพื่อเพิ่มเอกสารที่ขาดเข้ากระเป๋า"
                  button="นำเข้าเอกสาร"
                  onClick={() =>
                    importMutation.mutate({
                      context,
                      sourceType: "patient_upload",
                      documentType: readiness?.missing?.[0]?.cardTypes?.[0],
                      consentRef: "urn:trustcare:vc:consent:patient-initiated",
                    })
                  }
                  disabled={importMutation.isPending}
                />
                <ActionPanel
                  icon={FileInput}
                  title="สร้างชุดเอกสาร"
                  description="รวบรวมเอกสารที่พร้อมแล้วเป็นชุดสำหรับนำไปใช้ที่โรงพยาบาล"
                  button="สร้างชุดเอกสาร"
                  onClick={() => bundleMutation.mutate({ context, audience: "patient", receiver: "TrustCare intake" })}
                  disabled={bundleMutation.isPending}
                />
                <CheckinQRPanel context={context} readiness={readiness} />
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <TrustPolicyCard
                  title="Single document"
                  policy={singleDocumentPolicy ?? packetPolicy?.singleDocument}
                />
                <TrustPolicyCard
                  title="Small wallet bundle"
                  policy={packetPolicy?.bundled}
                />
                <TrustPolicyCard
                  title="Large packet"
                  policy={packetPolicy?.shl}
                />
              </div>
              {/* Trust Layer Checklist with Auto-Remediation */}
              {workbench?.singleDocumentVcVp?.checklist && (
                <TrustLayerRemediationPanel
                  checklist={workbench.singleDocumentVcVp.checklist}
                  navigate={navigate}
                />
              )}
            </CardContent>
          </Card>

          {/* Bundle preview if available */}
          {bundleMutation.data && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">ชุดเอกสารที่สร้างล่าสุด</CardTitle>
              </CardHeader>
              <CardContent>
                <BundlePreview bundle={bundleMutation.data} />
              </CardContent>
            </Card>
          )}

          {/* Service Readiness Panel */}
          <ServiceReadinessPanel context={context} />
        </>
      )}
    </div>
  );
}

// ============================================================
// HOSPITAL WORKBENCH - Full hospital operations view
// ============================================================
function HospitalWorkbench({
  context,
  setContext,
  selectedHospitalUseCaseId,
  setSelectedHospitalUseCaseId,
  hospitalUseCases,
  workbench,
  targetName,
  setTargetName,
  importNotes,
  setImportNotes,
  deployMutation,
  walkInMutation,
  workbenchQuery,
}: any) {
  if (workbenchQuery.isError) {
    return <ErrorCard label="Hospital workbench could not be loaded." error={workbenchQuery.error?.message} />;
  }
  const selectedUseCase =
    hospitalUseCases.find((item: any) => item.id === selectedHospitalUseCaseId) ??
    hospitalUseCases[0];
  const selectedUx =
    hospitalUseCaseUx[selectedUseCase?.bundleType] ??
    hospitalUseCaseUx.WalletDeploymentBundle;

  return (
    <div className="space-y-5">
      {workbenchQuery.isLoading ? (
        <LoadingCard label="Loading hospital workbench..." />
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Hospital className="h-5 w-5 text-primary" />
                  Hospital Service Readiness Workbench
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Verify incoming patient packets, manage walk-in wallets, and deploy documents to target wallets.
                </p>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-3 md:grid-cols-2">
                  {hospitalUseCases.map((item: any) => {
                    const Icon = contextIcons[item.context as ReadinessContext] ?? Building2;
                    const selected = selectedUseCase?.id === item.id;
                    const ux = hospitalUseCaseUx[item.bundleType] ?? hospitalUseCaseUx.WalletDeploymentBundle;
                    return (
                      <div key={item.id} className="space-y-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedHospitalUseCaseId(item.id);
                            setContext(item.context);
                          }}
                          className={`w-full rounded-lg border p-3 text-left transition hover:bg-accent ${selected ? "border-primary bg-primary/5 ring-1 ring-primary/20" : ""}`}
                        >
                          <div className="flex items-start gap-3">
                            <Icon className="mt-0.5 h-5 w-5 text-primary" />
                            <div className="min-w-0">
                              <p className="text-sm font-semibold">{item.label}</p>
                              <p className="text-xs text-muted-foreground">{item.labelEn}</p>
                              <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{ux.operatorGoal}</p>
                              <Badge variant="outline" className="mt-2">{item.bundleType}</Badge>
                            </div>
                          </div>
                        </button>
                        {selected && (
                          <div className="md:col-span-2 xl:hidden">
                            <HospitalUseCaseDetail item={item} ux={ux} compact />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {selectedUseCase && (
                  <div className="hidden xl:block">
                    <HospitalUseCaseDetail item={selectedUseCase} ux={selectedUx} />
                  </div>
                )}
                <Separator />
                <div className="grid gap-3 md:grid-cols-3">
                  {(workbench?.hospital?.workQueue ?? []).map((queue: any) => (
                    <div key={queue.queueId} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold">{queue.label}</p>
                        <Badge>{queue.count}</Badge>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Next: {nextActionLabels[queue.nextAction] ?? queue.nextAction}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{selectedUx.primaryAction}</CardTitle>
                <p className="text-xs leading-5 text-muted-foreground">{selectedUx.handoff}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedUseCase && (
                  <div className="rounded-md border bg-muted/30 p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{selectedUseCase.label}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{selectedUseCase.bundleType}</p>
                      </div>
                      <Badge variant="outline">{selectedUseCase.context}</Badge>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Target patient or wallet</Label>
                  <Input value={targetName} onChange={event => setTargetName(event.target.value)} placeholder="ชื่อผู้ป่วยหรือ HN" />
                </div>
                <div className="space-y-2">
                  <Label>Import/review notes</Label>
                  <Textarea value={importNotes} onChange={event => setImportNotes(event.target.value)} placeholder="หมายเหตุสำหรับการส่งเอกสาร" />
                </div>
                <div className="grid gap-2">
                  <Button
                    className="gap-2"
                    onClick={() => deployMutation.mutate({ context: selectedUseCase?.context ?? context, targetWalletMode: "single", targetPatientIds: [1] })}
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
                  <p className="text-xs font-medium text-muted-foreground">Connected wallets</p>
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
              <CardTitle className="text-base">Hospital-only cases (hidden from patient menu)</CardTitle>
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
        </>
      )}
    </div>
  );
}

function HospitalUseCaseDetail({ item, ux, compact = false }: { item: any; ux: any; compact?: boolean }) {
  return (
    <div className={`rounded-lg border bg-muted/30 p-4 ${compact ? "" : "mt-2"}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold">{ux.primaryAction}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{ux.operatorGoal}</p>
        </div>
        <Badge variant="outline">{item.bundleType}</Badge>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <HospitalUseCaseColumn
          icon={FileInput}
          title="Intake evidence"
          items={ux.intake}
        />
        <HospitalUseCaseColumn
          icon={PackageCheck}
          title="Bundle outputs"
          items={ux.outputs}
        />
        <HospitalUseCaseColumn
          icon={CheckCircle2}
          title="Next actions"
          items={ux.nextSteps}
        />
      </div>
      <div className="mt-3 rounded-md border bg-background p-3 text-xs leading-5 text-muted-foreground">
        {ux.handoff}
      </div>
    </div>
  );
}

function HospitalUseCaseColumn({ icon: Icon, title, items }: { icon: any; title: string; items: string[] }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </div>
      <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ============================================================
// CONTRACT HUB VIEW
// ============================================================
function ContractHubView({ workbench, workbenchQuery }: any) {
  if (workbenchQuery.isLoading) return <LoadingCard label="Loading contracts..." />;
  if (workbenchQuery.isError) return <ErrorCard label="Contract Hub could not be loaded." error={workbenchQuery.error?.message} />;
  const contracts = workbench?.contractHub?.contracts ?? [];
  const singleDocumentContracts = workbench?.singleDocumentVcVp?.catalog ?? workbench?.contractHub?.singleDocumentCredentialContracts ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <BookOpenCheck className="h-5 w-5 text-primary" />
          Service Readiness Contract Hub
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          All active contracts governing what documents are required for each service context.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {singleDocumentContracts.length > 0 && (
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold">Single-document VC/VP contracts</p>
                <p className="text-xs text-muted-foreground">
                  Direct VP is preferred for patient cards, prescriptions, certificates, appointments, and eligibility documents.
                </p>
              </div>
              <Badge variant="outline">{singleDocumentContracts.length} types</Badge>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {singleDocumentContracts.map((item: any) => (
                <div key={item.documentType} className="rounded-md border bg-background p-3 text-sm">
                  <div className="font-medium">{item.label}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{item.documentType} - {item.recommendedMode}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {contracts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No contracts loaded. Run seed to populate.</p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {contracts.map((contract: any) => (
              <div key={contract.contractId} className="rounded-lg border p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{contract.patientLabel}</p>
                    <p className="text-xs text-muted-foreground">{contract.patientLabelEn}</p>
                  </div>
                  <Badge variant="outline">{contract.context}</Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <ContractLine label="Requirements" value={`${contract.requirements?.length ?? 0} items`} />
                  <ContractLine label="Consent" value={contract.consentPolicy?.purposeCode ?? "N/A"} />
                  <ContractLine label="Patient bundle" value={contract.bundleTypes?.patient ?? "N/A"} />
                  <ContractLine label="Hospital bundle" value={contract.bundleTypes?.hospital ?? "N/A"} />
                  <ContractLine label="Single VC/VP" value={contract.packetTrustPolicy?.singleDocument?.mode ?? "direct_vp"} />
                  <ContractLine label="Packet share" value={contract.packetTrustPolicy?.shl?.mode ?? "shl_packet"} />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// DATA MAPPING VIEW
// ============================================================
function DataMappingView({ workbench, workbenchQuery }: any) {
  if (workbenchQuery.isLoading) return <LoadingCard label="Loading data mapping..." />;
  if (workbenchQuery.isError) return <ErrorCard label="Data Mapping profiles could not be loaded." error={workbenchQuery.error?.message} />;
  const profiles = workbench?.dataMappingV2?.profiles ?? workbench?.mapping?.profiles ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <DatabaseZap className="h-5 w-5 text-primary" />
          Data Mapping v2 Profiles
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Contract-driven binding between source systems and wallet document types.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {profiles.length === 0 ? (
          <p className="text-sm text-muted-foreground">No mapping profiles loaded.</p>
        ) : (
          profiles.map((profile: any) => (
            <div key={profile.mappingProfileId ?? profile.profileId} className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">{profile.mappingProfileId ?? profile.name}</p>
                <Badge variant="outline">{profile.context ?? profile.sourceSystem}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Contract: {profile.contractId ?? "N/A"} | Validation: {profile.validation ? Object.keys(profile.validation).length : 0} rules
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {((profile.requiredOutputs ?? profile.mappedFields) ?? []).slice(0, 5).map((field: any, idx: number) => (
                  <Badge key={typeof field === 'string' ? field : (field.requirementKey ?? idx)} variant="secondary" className="text-xs">
                    {typeof field === 'string' ? field : (field.documentType ?? field.requirementKey ?? JSON.stringify(field))}
                  </Badge>
                ))}
                {((profile.requiredOutputs ?? profile.mappedFields) ?? []).length > 5 && (
                  <Badge variant="secondary" className="text-xs">
                    +{((profile.requiredOutputs ?? profile.mappedFields) ?? []).length - 5}
                  </Badge>
                )}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// API VIEW
// ============================================================
function ApiView({ workbench, workbenchQuery }: any) {
  if (workbenchQuery.isLoading) return <LoadingCard label="Loading API docs..." />;
  if (workbenchQuery.isError) return <ErrorCard label="Public API examples could not be loaded." error={workbenchQuery.error?.message} />;
  return (
    <Card>
      <CardHeader>
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
  );
}

// ============================================================
// SHARED HELPER COMPONENTS
// ============================================================
// ============================================================
// UPLOAD DOCUMENT BUTTON - Inline upload for missing items
// ============================================================
function UploadDocButton({ context, documentType, label }: { context: string; documentType: string; label: string }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadMutation = trpc.wallet.uploadDocument.useMutation({
    onSuccess: () => {
      toast.success(`อัปโหลดเอกสาร "${label}" สำเร็จ รอตรวจสอบ`);
    },
    onError: (error) => toast.error(error.message),
  });
  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("ไฟล์ต้องมีขนาดไม่เกิน 10MB");
      return;
    }
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("รองรับเฉพาะ PDF, JPEG, PNG, WebP");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadMutation.mutate({
        context: context as any,
        documentType,
        documentCategory: "other" as const,
        title: label,
        fileName: file.name,
        mimeType: file.type,
        fileBase64: base64,
      });
    };
    reader.readAsDataURL(file);
    // Reset input
    event.target.value = "";
  }, [context, documentType, label, uploadMutation]);
  return (
    <>
      <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={handleFileSelect} />
      <Button
        variant="ghost"
        size="sm"
        className="h-6 gap-1 px-2 text-xs text-primary"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploadMutation.isPending}
      >
        <UploadCloud className="h-3 w-3" />
        {uploadMutation.isPending ? "กำลังอัปโหลด..." : "อัปโหลด"}
      </Button>
    </>
  );
}
// ============================================================
// CHECK-IN QR PANEL - Generate SHL-based check-in QR code
// ============================================================
function CheckinQRPanel({ context, readiness }: { context: string; readiness: any }) {
  const [showQR, setShowQR] = useState(false);
  const [qrData, setQrData] = useState<any>(null);
  const checkinMutation = trpc.wallet.generateCheckinQR.useMutation({
    onSuccess: (result) => {
      setQrData(result);
      setShowQR(true);
      toast.success("สร้าง QR Code สำหรับ Check-in สำเร็จ");
    },
    onError: (error) => toast.error(error.message),
  });
  const handleGenerate = () => {
    if (!readiness?.criticalReady) {
      toast.error("เอกสารสำคัญยังไม่ครบ กรุณาอัปโหลดเอกสารที่จำเป็นก่อน");
      return;
    }
    checkinMutation.mutate({
      context: context as any,
      consentAttested: true,
    });
  };
  return (
    <>
      <div className="rounded-lg border p-3">
        <QrCode className="h-5 w-5 text-primary" />
        <p className="mt-2 text-sm font-semibold">สร้าง QR Check-in</p>
        <p className="mt-1 min-h-12 text-xs text-muted-foreground">
          สร้าง QR Code สำหรับแสดงที่จุดรับบริการ ใช้ Smart Health Link มาตรฐาน FHIR
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3 w-full gap-2"
          onClick={handleGenerate}
          disabled={checkinMutation.isPending || !readiness?.criticalReady}
        >
          <QrCode className="h-4 w-4" />
          {checkinMutation.isPending ? "กำลังสร้าง..." : "สร้าง QR Check-in"}
        </Button>
      </div>
      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-primary" />
              QR Code Check-in
            </DialogTitle>
          </DialogHeader>
          {qrData && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="rounded-xl border-2 border-primary/20 bg-white p-4">
                <QRCodeCanvas value={qrData.qrPayload} size={220} level="M" />
              </div>
              <div className="w-full space-y-2 text-center">
                <Badge variant="outline" className="gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Smart Health Link
                </Badge>
                <p className="text-sm text-muted-foreground">
                  หมดอายุ: {new Date(qrData.expiresAt).toLocaleString("th-TH")}
                </p>
                <p className="text-xs text-muted-foreground">
                  สแกนได้สูงสุด {qrData.maxAccessCount} ครั้ง | คะแนนความพร้อม: {qrData.readinessScore}%
                </p>
                <p className="text-xs text-muted-foreground">
                  เอกสาร: {qrData.credentialCount} รายการ
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowQR(false)}>
                ปิด
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
// ============================================================
// TRUST LAYER AUTO-REMEDIATION
// ============================================================
const REMEDIATION_MAP: Record<string, {
  labelTh: string;
  labelEn: string;
  descTh: string;
  descEn: string;
  route: string;
  icon: any;
}> = {
  issuer: {
    labelTh: "ลงทะเบียน Issuer ใน Trust Registry",
    labelEn: "Register Issuer in Trust Registry",
    descTh: "DID ของผู้ออกเอกสารยังไม่ได้ลงทะเบียนใน Trust Registry/TAO",
    descEn: "Issuer DID is not yet registered in Trust Registry/TAO",
    route: "/trust-registry",
    icon: ShieldCheck,
  },
  holder: {
    labelTh: "ออก VC ใหม่ให้ผู้ป่วย",
    labelEn: "Issue new VC for patient",
    descTh: "VP holder DID ไม่ตรงกับ wallet — ต้องออก VC ใหม่ที่ผูกกับ holder ปัจจุบัน",
    descEn: "VP holder DID mismatch — re-issue VC bound to current holder",
    route: "/issuer",
    icon: WalletCards,
  },
  schema: {
    labelTh: "ตรวจสอบ Contract Hub",
    labelEn: "Check Contract Hub",
    descTh: "ประเภท credential หรือ claims ไม่ตรงกับ Contract Hub — ตรวจสอบและแก้ไข contract",
    descEn: "Credential type or claims mismatch — review and fix contract",
    route: "/contract-admin",
    icon: ClipboardCheck,
  },
  status: {
    labelTh: "ออก VC ใหม่ (VC เดิมหมดอายุ/ถูกเพิกถอน)",
    labelEn: "Re-issue VC (expired or revoked)",
    descTh: "VC ปัจจุบันหมดอายุหรือถูกเพิกถอน — ต้องออกใหม่",
    descEn: "Current VC is expired or revoked — must re-issue",
    route: "/issuer",
    icon: RefreshCcw,
  },
  consent: {
    labelTh: "ขอ consent เพิ่มจากผู้ป่วย",
    labelEn: "Request additional consent",
    descTh: "ยังไม่มี consent ที่ครอบคลุมวัตถุประสงค์ ผู้รับ และช่วงเวลา",
    descEn: "No consent covering purpose, recipient, and time period",
    route: "/consent",
    icon: BookOpenCheck,
  },
  manifestCredential: {
    labelTh: "สร้าง SHL Manifest Credential",
    labelEn: "Create SHL Manifest Credential",
    descTh: "ยังไม่มี ShlManifestCredential ผูก manifest hash, source bundle hash, purpose, expiry",
    descEn: "Missing ShlManifestCredential binding manifest hash, source bundle hash, purpose, expiry",
    route: "/shl",
    icon: PackageCheck,
  },
  presentation: {
    labelTh: "สร้าง VP สำหรับ SHL",
    labelEn: "Create VP for SHL",
    descTh: "ยังไม่มี holder VP ผูกกับ SHL manifest",
    descEn: "Missing holder VP bound to SHL manifest",
    route: "/wallet",
    icon: QrCode,
  },
  passcodePolicy: {
    labelTh: "ตั้งค่า Passcode/Access Policy",
    labelEn: "Set Passcode/Access Policy",
    descTh: "SHL ยังไม่มี passcode, expiry, max access, หรือ audit policy",
    descEn: "SHL missing passcode, expiry, max access, or audit policy",
    route: "/shl",
    icon: ShieldAlert,
  },
  fileHashes: {
    labelTh: "ตรวจสอบ Hash ของไฟล์",
    labelEn: "Verify file hashes",
    descTh: "ไฟล์ที่เข้ารหัสไม่ตรงกับ manifest hash record",
    descEn: "Encrypted files do not match manifest hash record",
    route: "/shl",
    icon: DatabaseZap,
  },
  documentReferences: {
    labelTh: "เพิ่ม DocumentReference",
    labelEn: "Add DocumentReference",
    descTh: "ไฟล์ legacy ยังไม่มี FHIR DocumentReference พร้อม hash และ provenance",
    descEn: "Legacy files missing FHIR DocumentReference with hash and provenance",
    route: "/portability",
    icon: FileInput,
  },
};

function TrustLayerRemediationPanel({ checklist, navigate }: { checklist: any[]; navigate: (path: string) => void }) {
  const passedCount = checklist.filter((c: any) => c.status === "present").length;
  const missingItems = checklist.filter((c: any) => c.status === "missing");
  const recommendedItems = checklist.filter((c: any) => c.status === "recommended");
  const allPassed = missingItems.length === 0;

  return (
    <div className="mt-4 rounded-lg border bg-muted/30 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">Trust Layer Verification Checklist</p>
        </div>
        <div className="flex items-center gap-2">
          {!allPassed && (
            <Badge variant="destructive" className="gap-1 text-[10px]">
              <Wrench className="h-3 w-3" />
              {missingItems.length} ต้องแก้ไข
            </Badge>
          )}
          <Badge variant={allPassed ? "secondary" : "outline"}>
            {passedCount}/{checklist.length}
          </Badge>
        </div>
      </div>

      {/* Missing items with remediation actions */}
      {missingItems.length > 0 && (
        <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 p-3">
          <p className="mb-2 text-xs font-semibold text-destructive">รายการที่ต้องแก้ไข (Auto-Remediation)</p>
          <div className="space-y-2">
            {missingItems.map((check: any) => {
              const remedy = REMEDIATION_MAP[check.key];
              const Icon = remedy?.icon || ShieldAlert;
              return (
                <div key={check.key} className="flex items-start justify-between gap-3 rounded-md border bg-background p-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 shrink-0 text-destructive" />
                      <span className="text-xs font-medium">{check.label}</span>
                      <Badge variant="destructive" className="text-[10px] shrink-0">✗ ขาด</Badge>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground pl-5.5">
                      {remedy?.descTh || check.detail}
                    </p>
                  </div>
                  {remedy && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10 text-[11px] h-7"
                      onClick={() => navigate(remedy.route)}
                    >
                      <Wrench className="h-3 w-3" />
                      {remedy.labelTh}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* All passed celebration */}
      {allPassed && (
        <div className="mb-3 rounded-md border border-green-500/30 bg-green-50 dark:bg-green-950/20 p-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <p className="text-xs font-medium text-green-700 dark:text-green-400">Trust Layer ผ่านครบทุกรายการ — พร้อมใช้งาน</p>
          </div>
        </div>
      )}

      {/* Passed and recommended items grid */}
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {checklist.filter((c: any) => c.status !== "missing").map((check: any) => (
          <div key={check.key} className="rounded-md border bg-background p-2.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{check.label}</span>
              <Badge
                variant={check.status === "present" ? "secondary" : "outline"}
              >
                {check.status === "present" ? "✓ ผ่าน" : "แนะนำ"}
              </Badge>
            </div>
            <p className="mt-1 text-muted-foreground">{check.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// SHARED HELPER COMPONENTS
// ============================================================
function LoadingCard({ label }: { label: string }) {
  return (
    <Card>
      <CardContent className="flex min-h-[240px] items-center justify-center text-sm text-muted-foreground">
        {label}
      </CardContent>
    </Card>
  );
}

function ErrorCard({ label, error }: { label: string; error?: string }) {
  return (
    <Card className="border-red-200 bg-red-50/40">
      <CardContent className="flex min-h-[180px] flex-col items-center justify-center gap-2 text-center text-sm">
        <ShieldAlert className="h-6 w-6 text-red-600" />
        <p className="font-medium text-red-800">{label}</p>
        {error && <p className="max-w-xl text-xs text-red-700">{error}</p>}
      </CardContent>
    </Card>
  );
}

function TrustPolicyCard({ title, policy }: { title: string; policy?: any }) {
  if (!policy) return null;
  return (
    <div className="rounded-lg border bg-muted/30 p-3 text-xs">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold">{title}</p>
        <Badge variant="outline">{policy.mode}</Badge>
      </div>
      <p className="mt-1 font-medium">{policy.label}</p>
      <p className="mt-1 text-muted-foreground">{policy.reason}</p>
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
  if (!bundle) return <p className="text-sm text-muted-foreground">ยังไม่มีชุดเอกสาร</p>;
  return (
    <div className="grid gap-3 lg:grid-cols-[340px_1fr]">
      <div className="rounded-lg border p-3 text-sm">
        <p className="font-semibold">{bundle.bundleType}</p>
        <p className="mt-1 text-xs text-muted-foreground">{bundle.bundleId}</p>
        <div className="mt-3 grid gap-2">
          <ContractLine label="สถานะ" value={bundle.status} />
          <ContractLine label="ทิศทาง" value={bundle.direction} />
          <ContractLine label="คะแนน" value={`${bundle.readinessScore}%`} />
          <ContractLine label="Share mode" value={bundle.trustLayer?.transportDecision?.label ?? "N/A"} />
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
      {(bundle.trustLayer?.verificationChecklist ?? []).length > 0 && (
        <div className="rounded-lg border bg-muted/30 p-3 lg:col-span-2">
          <p className="mb-2 text-sm font-semibold">Verifier trust checklist</p>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {bundle.trustLayer.verificationChecklist.map((check: any) => (
              <div key={check.key} className="rounded-md border bg-background p-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{check.label}</span>
                  <Badge variant={check.status === "missing" ? "destructive" : "secondary"}>{check.status}</Badge>
                </div>
                <p className="mt-1 text-muted-foreground">{check.detail}</p>
              </div>
            ))}
          </div>
        </div>
      )}
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
