import DashboardLayout from "@/components/DashboardLayout";
import QRScanner from "@/components/QRScanner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle, BadgeCheck, CalendarDays, Camera, CheckCircle2, ClipboardCheck,
  FileCheck2, FileDigit, FileHeart, FileSignature, FileText, FolderCheck, Globe2,
  IdCard, Landmark, Link2, Microscope, PackageCheck, Pill, ReceiptText, RefreshCcw,
  RotateCcw, ScanLine, Send, ShieldAlert, ShieldCheck, ShieldX, Syringe, TriangleAlert,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearch } from "wouter";
import { toast } from "sonner";

type TrustLevel = "green" | "yellow" | "red";

const trustBadgeConfig = {
  green: { icon: ShieldCheck, bg: "bg-emerald-50 border-emerald-300", iconColor: "text-emerald-600", title: "Verified" },
  yellow: { icon: ShieldAlert, bg: "bg-amber-50 border-amber-300", iconColor: "text-amber-600", title: "Verified with warnings" },
  red: { icon: ShieldX, bg: "bg-red-50 border-red-300", iconColor: "text-red-600", title: "Not verified" },
};

/* ─── Credential Type Metadata ─────────────────────────────────────────── */

const VC_TYPE_META: Record<string, { th: string; en: string; icon: any; color: string }> = {
  PatientIdentityCredential:            { th: "บัตรประจำตัวผู้ป่วย", en: "Patient Identity", icon: BadgeCheck, color: "bg-blue-100 text-blue-800" },
  HospitalStaffIdentityCredential:      { th: "บัตรเจ้าหน้าที่", en: "Staff Identity", icon: IdCard, color: "bg-indigo-100 text-indigo-800" },
  ConsentReceiptCredential:             { th: "ใบยินยอม", en: "Consent Receipt", icon: ClipboardCheck, color: "bg-purple-100 text-purple-800" },
  PatientSummaryCredential:             { th: "สรุปข้อมูลผู้ป่วย", en: "Patient Summary", icon: FileHeart, color: "bg-rose-100 text-rose-800" },
  AllergyAlertCredential:               { th: "แจ้งเตือนการแพ้", en: "Allergy Alert", icon: TriangleAlert, color: "bg-red-100 text-red-800" },
  MedicationSummaryCredential:          { th: "สรุปรายการยา", en: "Medication Summary", icon: Pill, color: "bg-cyan-100 text-cyan-800" },
  ReferralCredential:                   { th: "ใบส่งต่อผู้ป่วย", en: "Referral", icon: Send, color: "bg-orange-100 text-orange-800" },
  ImmunizationCredential:               { th: "ประวัติวัคซีน", en: "Immunization", icon: Syringe, color: "bg-lime-100 text-lime-800" },
  MedicalCertificateCredential:         { th: "ใบรับรองแพทย์", en: "Medical Certificate", icon: FileCheck2, color: "bg-teal-100 text-teal-800" },
  PrescriptionCredential:               { th: "ใบสั่งยา", en: "Prescription", icon: Pill, color: "bg-sky-100 text-sky-800" },
  LabResultCredential:                  { th: "ผลตรวจแล็บ", en: "Lab Result", icon: Microscope, color: "bg-violet-100 text-violet-800" },
  DiagnosticReportCredential:           { th: "รายงานวินิจฉัย", en: "Diagnostic Report", icon: ScanLine, color: "bg-fuchsia-100 text-fuchsia-800" },
  DischargeSummaryCredential:           { th: "สรุปจำหน่าย", en: "Discharge Summary", icon: FileCheck2, color: "bg-emerald-100 text-emerald-800" },
  CoverageEligibilityCredential:        { th: "สิทธิ์ประกัน", en: "Coverage Eligibility", icon: ShieldCheck, color: "bg-green-100 text-green-800" },
  ClaimPackageCredential:               { th: "ชุดเอกสารเคลม", en: "Claim Package", icon: FolderCheck, color: "bg-amber-100 text-amber-800" },
  ClaimReceiptCredential:               { th: "ใบตอบรับเคลม", en: "Claim Receipt", icon: ReceiptText, color: "bg-yellow-100 text-yellow-800" },
  TravelDocumentVerificationCredential: { th: "เอกสารเดินทาง", en: "Travel Document", icon: Globe2, color: "bg-blue-100 text-blue-800" },
  ShlManifestCredential:                { th: "Smart Health Link", en: "SHL Manifest", icon: ScanLine, color: "bg-indigo-100 text-indigo-800" },
  PharmacyDispenseCredential:           { th: "ใบจ่ายยา", en: "Pharmacy Dispense", icon: PackageCheck, color: "bg-teal-100 text-teal-800" },
  AppointmentCredential:                { th: "ใบนัดหมาย", en: "Appointment", icon: CalendarDays, color: "bg-sky-100 text-sky-800" },
  VisaSupportLetterCredential:          { th: "หนังสือรับรองวีซ่า", en: "Visa Support Letter", icon: FileSignature, color: "bg-purple-100 text-purple-800" },
  QuotationCredential:                  { th: "ใบเสนอราคา", en: "Treatment Quotation", icon: FileDigit, color: "bg-orange-100 text-orange-800" },
  GuaranteeLetterCredential:            { th: "หนังสือค้ำประกัน", en: "Guarantee Letter", icon: Landmark, color: "bg-amber-100 text-amber-800" },
  MpiLinkCertificateCredential:         { th: "ใบเชื่อมโยงตัวตน", en: "MPI Link Certificate", icon: Link2, color: "bg-cyan-100 text-cyan-800" },
  SyncReceiptCredential:                { th: "ใบตอบรับ Sync", en: "Sync Receipt", icon: RefreshCcw, color: "bg-gray-100 text-gray-800" },
};

function resolveVcType(credential: any): string {
  // From the vc envelope: type: ["VerifiableCredential", "QuotationCredential"]
  const types: string[] = Array.isArray(credential?.type) ? credential.type : [];
  const specific = types.find((t: string) => t !== "VerifiableCredential");
  if (specific) return specific;
  // Fallback: check credentialSubject.documentType mapped to vcType
  const docType = credential?.credentialSubject?.documentType;
  if (docType) {
    const map: Record<string, string> = {
      patient_identity: "PatientIdentityCredential", staff_identity: "HospitalStaffIdentityCredential",
      consent_receipt: "ConsentReceiptCredential", patient_summary: "PatientSummaryCredential",
      allergy_alert: "AllergyAlertCredential", medication_summary: "MedicationSummaryCredential",
      referral_vc: "ReferralCredential", immunization: "ImmunizationCredential",
      medical_certificate: "MedicalCertificateCredential", prescription: "PrescriptionCredential",
      lab_result: "LabResultCredential", diagnostic_report: "DiagnosticReportCredential",
      discharge_summary: "DischargeSummaryCredential", insurance_eligibility: "CoverageEligibilityCredential",
      claim_package: "ClaimPackageCredential", claim_receipt: "ClaimReceiptCredential",
      travel_document_verification: "TravelDocumentVerificationCredential",
      shl_manifest: "ShlManifestCredential", pharmacy_dispense: "PharmacyDispenseCredential",
      appointment: "AppointmentCredential", visa_support_letter: "VisaSupportLetterCredential",
      quotation: "QuotationCredential", guarantee_letter: "GuaranteeLetterCredential",
      mpi_link_certificate: "MpiLinkCertificateCredential", sync_receipt: "SyncReceiptCredential",
    };
    return map[docType] ?? "VerifiableCredential";
  }
  return "VerifiableCredential";
}

function getSubject(credential: any): any {
  return credential?.credentialSubject ?? credential?.vc?.credentialSubject ?? {};
}

/* ─── Main Component ───────────────────────────────────────────────────── */

export default function Verifier() {
  const [vpInput, setVpInput] = useState("");
  const [scanMode, setScanMode] = useState<"paste" | "camera">("paste");

  const verify = trpc.verifier.verify.useMutation({
    onSuccess: (data) => toast[data.verified ? "success" : "error"](data.verified ? "ตรวจสอบสำเร็จ" : "ตรวจสอบไม่ผ่าน"),
    onError: (error) => toast.error(error.message),
  });

  const verifyQr = trpc.verifier.verifyQrScan.useMutation({
    onSuccess: (data) => toast[data.verified ? "success" : "error"](data.verified ? "ตรวจสอบสำเร็จ" : "ตรวจสอบไม่ผ่าน"),
    onError: (error) => toast.error(error.message),
  });

  const result = (scanMode === "camera" ? verifyQr.data : verify.data) as any;
  const trustLevel = (result?.trustLevel ?? "red") as TrustLevel;
  const credentials = useMemo(() => {
    if (!result) return [];
    if (Array.isArray(result.credentials)) return result.credentials;
    if (result.credential) return [result.credential];
    return [];
  }, [result]);

  // Auto-verify when opened via QR URL with ?vp= param
  const searchString = useSearch();
  const autoVerified = useRef(false);
  useEffect(() => {
    if (autoVerified.current) return;
    const params = new URLSearchParams(searchString);
    const vpId = params.get("vp");
    if (vpId) {
      autoVerified.current = true;
      verifyQr.mutate({ qrData: vpId, source: "camera" });
      setScanMode("camera");
    }
  }, [searchString]);

  const handleScanSuccess = useCallback((decodedText: string) => {
    verifyQr.mutate({ qrData: decodedText, source: "camera" });
  }, [verifyQr]);

  const handleScanError = useCallback((error: string) => {
    toast.error(error);
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">ตรวจสอบใบรับรอง</h1>
            <p className="text-muted-foreground text-sm mt-1">Verify VC/VP by scanning QR code or pasting JSON/JWT directly.</p>
          </div>
          {result && (
            <Button variant="outline" onClick={() => { verify.reset(); verifyQr.reset(); setVpInput(""); }} className="gap-2">
              <RotateCcw className="h-4 w-4" />ตรวจใหม่
            </Button>
          )}
        </div>

        {!result ? (
          <Card className="max-w-2xl mx-auto">
            <CardContent className="p-6">
              <Tabs value={scanMode} onValueChange={(v) => setScanMode(v as "paste" | "camera")} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="paste" className="gap-2">
                    <ClipboardCheck className="h-4 w-4" />
                    วาง Token/JSON
                  </TabsTrigger>
                  <TabsTrigger value="camera" className="gap-2">
                    <Camera className="h-4 w-4" />
                    สแกน QR Code
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="paste" className="space-y-4">
                  <div className="flex flex-col items-center gap-4">
                    <div className="h-20 w-20 rounded-2xl bg-muted flex items-center justify-center border-2 border-dashed border-muted-foreground/20">
                      <ScanLine className={`h-10 w-10 text-muted-foreground/50 ${verify.isPending ? "animate-pulse" : ""}`} />
                    </div>
                    <Textarea
                      placeholder="Paste VP URL, presentation ID, JSON VP, JWT VP, or JWT VC here..."
                      className="min-h-[180px] font-mono text-xs"
                      value={vpInput}
                      onChange={(event) => setVpInput(event.target.value)}
                    />
                    {vpInput.trim().startsWith("shlink:/") && (
                      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                        This is an SHL transport link. Open it in Smart Health Link Viewer to resolve the manifest and passcode, then verify the bound Manifest VC and Holder VP here if needed.
                      </div>
                    )}
                    <Button onClick={() => verify.mutate({ vpUrl: vpInput })} disabled={!vpInput || verify.isPending} className="w-full gap-2">
                      <ClipboardCheck className="h-4 w-4" />
                      {verify.isPending ? "กำลังตรวจสอบ..." : "เริ่มตรวจสอบ"}
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="camera" className="space-y-4">
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-sm text-muted-foreground text-center mb-2">
                      เปิดกล้องเพื่อสแกน QR Code จาก Patient Wallet หรือเอกสาร VC/VP
                    </p>
                    <QRScanner
                      onScanSuccess={handleScanSuccess}
                      onScanError={handleScanError}
                      fps={10}
                      aspectRatio={1.0}
                      autoStart={scanMode === "camera"}
                    />
                    {verifyQr.isPending && (
                      <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
                        <ScanLine className="h-4 w-4 animate-pulse" />
                        กำลังตรวจสอบข้อมูลจาก QR Code...
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4 max-w-4xl">
            {/* Source indicator */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {scanMode === "camera" ? (
                <><Camera className="h-3.5 w-3.5" /><span>ตรวจสอบจากการสแกน QR Code</span></>
              ) : (
                <><ClipboardCheck className="h-3.5 w-3.5" /><span>ตรวจสอบจาก Token/JSON ที่วาง</span></>
              )}
            </div>

            <TrustBadge level={trustLevel} warnings={result.warnings} errors={result.errors} />
            <VerifierTrustLayer result={result} />

            {/* Subject overview */}
            <SubjectOverview result={result} credentials={credentials} />

            {/* Credential-type-specific context cards */}
            {credentials.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Credentials ({credentials.length})
                </h3>
                {credentials.map((credential: any, index: number) => (
                  <CredentialContextCard key={index} credential={credential} index={index} />
                ))}
              </div>
            )}

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4" />Verification Payload</CardTitle></CardHeader>
              <CardContent>
                <pre className="max-h-[420px] overflow-auto rounded-md bg-muted/50 p-3 text-xs">{JSON.stringify(result, null, 2)}</pre>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

/* ─── Subject Overview ─────────────────────────────────────────────────── */

function SubjectOverview({ result, credentials }: { result: any; credentials: any[] }) {
  // Find patient info from the first credential that has it
  const subjects = credentials.map(getSubject);
  const patient = subjects.find((s: any) => s.patient)?.patient ?? {};

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">Subject</CardTitle></CardHeader>
      <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
        <div><span className="text-muted-foreground">Name</span><p className="font-medium">{patient.nameTh || patient.name || patient.nameEn || subjects[0]?.trustcareSubjectId || "Unknown"}</p></div>
        <div><span className="text-muted-foreground">Holder DID</span><p className="font-mono text-xs break-all">{result.holderDid || subjects[0]?.id || "-"}</p></div>
        <div><span className="text-muted-foreground">Issuer</span><p className="font-medium">{result.issuer || credentials[0]?.issuer?.name || credentials[0]?.issuer?.id || "-"}</p></div>
        <div><span className="text-muted-foreground">Credentials</span><p className="font-medium">{credentials.length}</p></div>
      </CardContent>
    </Card>
  );
}

/* ─── Per-Credential Context Card ──────────────────────────────────────── */

function CredentialContextCard({ credential, index }: { credential: any; index: number }) {
  const vcType = resolveVcType(credential);
  const meta = VC_TYPE_META[vcType] ?? { th: vcType, en: vcType, icon: FileText, color: "bg-gray-100 text-gray-800" };
  const TypeIcon = meta.icon;
  const subject = getSubject(credential);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <TypeIcon className="h-4 w-4" />
            <span>{meta.th}</span>
            <span className="text-muted-foreground font-normal">({meta.en})</span>
          </CardTitle>
          <Badge className={`${meta.color} border-0 text-xs`}>{vcType.replace("Credential", "")}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <CredentialTypeContent vcType={vcType} subject={subject} credential={credential} />
      </CardContent>
    </Card>
  );
}

/* ─── Type-Specific Content Renderer ───────────────────────────────────── */

function CredentialTypeContent({ vcType, subject, credential }: { vcType: string; subject: any; credential: any }) {
  switch (vcType) {
    case "PatientSummaryCredential":
      return <PatientSummaryContent subject={subject} />;
    case "AllergyAlertCredential":
      return <AllergyAlertContent subject={subject} />;
    case "MedicationSummaryCredential":
      return <MedicationSummaryContent subject={subject} />;
    case "ConsentReceiptCredential":
      return <ConsentReceiptContent subject={subject} />;
    case "MedicalCertificateCredential":
      return <MedicalCertificateContent subject={subject} />;
    case "PrescriptionCredential":
      return <PrescriptionContent subject={subject} />;
    case "ReferralCredential":
      return <ReferralContent subject={subject} />;
    case "LabResultCredential":
    case "DiagnosticReportCredential":
      return <LabResultContent subject={subject} />;
    case "CoverageEligibilityCredential":
      return <InsuranceEligibilityContent subject={subject} />;
    case "QuotationCredential":
      return <QuotationContent subject={subject} />;
    case "GuaranteeLetterCredential":
      return <GuaranteeLetterContent subject={subject} />;
    case "ImmunizationCredential":
      return <ImmunizationContent subject={subject} />;
    case "ClaimPackageCredential":
    case "ClaimReceiptCredential":
      return <ClaimContent subject={subject} />;
    case "DischargeSummaryCredential":
      return <DischargeSummaryContent subject={subject} />;
    case "PatientIdentityCredential":
    case "HospitalStaffIdentityCredential":
      return <IdentityContent subject={subject} />;
    case "TravelDocumentVerificationCredential":
    case "VisaSupportLetterCredential":
      return <TravelDocumentContent subject={subject} />;
    case "AppointmentCredential":
      return <AppointmentContent subject={subject} />;
    default:
      return <GenericContent subject={subject} credential={credential} />;
  }
}

/* ─── Type-Specific Content Components ─────────────────────────────────── */

function PatientSummaryContent({ subject }: { subject: any }) {
  const allergies = flatten(subject.critical?.allergies ?? subject.clinical?.allergies ?? []);
  const medications = flatten(subject.critical?.medications ?? subject.clinical?.medications ?? []);
  const conditions = flatten(subject.critical?.conditions ?? subject.clinical?.conditions ?? []);

  return (
    <div className="space-y-3">
      {allergies.length > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50/50 p-3">
          <p className="text-xs font-semibold text-red-700 flex items-center gap-1.5 mb-1.5"><AlertTriangle className="h-3.5 w-3.5" />Allergies</p>
          {allergies.map((item: any, i: number) => <p key={i} className="text-sm">{typeof item === "string" ? item : item.substance || item.name || JSON.stringify(item)}</p>)}
        </div>
      )}
      {medications.length > 0 && (
        <div className="rounded-md border p-3">
          <p className="text-xs font-semibold text-blue-700 flex items-center gap-1.5 mb-1.5"><Pill className="h-3.5 w-3.5" />Medications</p>
          {medications.map((item: any, i: number) => <p key={i} className="text-sm">{item.name || item.medicationCodeableConcept?.text || (typeof item === "string" ? item : JSON.stringify(item))}</p>)}
        </div>
      )}
      {conditions.length > 0 && (
        <div className="rounded-md border p-3">
          <p className="text-xs font-semibold mb-1.5">Conditions</p>
          {conditions.map((item: any, i: number) => <p key={i} className="text-sm">{item.display || item.code || (typeof item === "string" ? item : JSON.stringify(item))}</p>)}
        </div>
      )}
      {subject.resourceCounts && <KeyValueRow label="FHIR Resources" value={JSON.stringify(subject.resourceCounts)} />}
      {subject.generatedAt && <KeyValueRow label="Generated" value={subject.generatedAt} />}
    </div>
  );
}

function AllergyAlertContent({ subject }: { subject: any }) {
  const allergies = flatten(subject.critical?.allergies ?? subject.clinical?.allergies ?? []);
  return (
    <div className="rounded-md border border-red-200 bg-red-50/50 p-3">
      <p className="text-xs font-semibold text-red-700 flex items-center gap-1.5 mb-1.5"><AlertTriangle className="h-3.5 w-3.5" />Allergies</p>
      {allergies.length > 0
        ? allergies.map((item: any, i: number) => <p key={i} className="text-sm">{typeof item === "string" ? item : item.substance || item.name || JSON.stringify(item)}</p>)
        : <p className="text-sm text-muted-foreground">No allergy data in credential</p>}
    </div>
  );
}

function MedicationSummaryContent({ subject }: { subject: any }) {
  const medications = flatten(subject.critical?.medications ?? subject.clinical?.medications ?? []);
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs font-semibold text-blue-700 flex items-center gap-1.5 mb-1.5"><Pill className="h-3.5 w-3.5" />Medications</p>
      {medications.length > 0
        ? medications.map((item: any, i: number) => <p key={i} className="text-sm">{item.name || item.medicationCodeableConcept?.text || (typeof item === "string" ? item : JSON.stringify(item))}</p>)
        : <p className="text-sm text-muted-foreground">No medication data in credential</p>}
    </div>
  );
}

function ConsentReceiptContent({ subject }: { subject: any }) {
  return (
    <div className="grid gap-2 text-sm sm:grid-cols-2">
      <KeyValueRow label="Purpose" value={subject.purpose} />
      <KeyValueRow label="Status" value={subject.status} />
      <KeyValueRow label="Requester" value={subject.requesterId} />
      <KeyValueRow label="Requester Role" value={subject.requesterRole} />
      <KeyValueRow label="Granted To" value={subject.grantedToOrganizationId} />
      <KeyValueRow label="Granted At" value={formatDate(subject.grantedAt)} />
      <KeyValueRow label="Expires At" value={formatDate(subject.expiresAt)} />
      {Array.isArray(subject.scopes) && subject.scopes.length > 0 && (
        <div className="sm:col-span-2">
          <span className="text-muted-foreground text-xs">Scopes</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {subject.scopes.map((scope: string, i: number) => (
              <Badge key={i} variant="secondary" className="text-xs">{scope}</Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MedicalCertificateContent({ subject }: { subject: any }) {
  return (
    <div className="grid gap-2 text-sm sm:grid-cols-2">
      <KeyValueRow label="Diagnosis" value={subject.diagnosisText} />
      <KeyValueRow label="Fitness for Work" value={subject.fitnessForWork} />
      <KeyValueRow label="Valid From" value={formatDate(subject.validFrom)} />
      <KeyValueRow label="Valid Until" value={formatDate(subject.validUntil)} />
      <KeyValueRow label="Practitioner" value={subject.practitioner?.name || subject.practitioner?.nameEn} />
      <KeyValueRow label="Organization" value={subject.organization?.name || subject.organization?.nameEn} />
      {Array.isArray(subject.recommendations) && subject.recommendations.length > 0 && (
        <div className="sm:col-span-2">
          <span className="text-muted-foreground text-xs">Recommendations</span>
          <ul className="list-disc list-inside mt-1 text-sm">
            {subject.recommendations.map((r: string, i: number) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function PrescriptionContent({ subject }: { subject: any }) {
  const meds = subject.fhir?.medicationRequests ?? [];
  return (
    <div className="space-y-2 text-sm">
      <div className="grid gap-2 sm:grid-cols-2">
        <KeyValueRow label="Prescriber" value={subject.prescriber?.name || subject.prescriber?.nameEn} />
        <KeyValueRow label="Authored On" value={formatDate(subject.authoredOn)} />
        <KeyValueRow label="Substitution Allowed" value={subject.substitutionAllowed ? "Yes" : "No"} />
        <KeyValueRow label="Dispense Window" value={subject.dispenseWindowDays ? `${subject.dispenseWindowDays} days` : undefined} />
      </div>
      {meds.length > 0 && (
        <div className="rounded-md border p-3 mt-2">
          <p className="text-xs font-semibold text-blue-700 flex items-center gap-1.5 mb-1.5"><Pill className="h-3.5 w-3.5" />Prescribed Medications ({meds.length})</p>
          {meds.map((med: any, i: number) => (
            <div key={i} className="text-sm py-1 border-b last:border-0">
              <span className="font-medium">{med.medicationCodeableConcept?.text || med.medication?.display || `Medication ${i + 1}`}</span>
              {med.dosageInstruction?.[0]?.text && <span className="text-muted-foreground ml-2">— {med.dosageInstruction[0].text}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReferralContent({ subject }: { subject: any }) {
  const clinical = subject.clinical ?? {};
  return (
    <div className="space-y-2">
      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <KeyValueRow label="Document No." value={subject.documentNo} />
        <KeyValueRow label="Document Type" value={subject.documentType} />
        <KeyValueRow label="Organization" value={subject.organization?.name || subject.organization?.nameEn} />
        <KeyValueRow label="FHIR Resource" value={subject.fhir?.resourceType} />
      </div>
      {clinical.conditions?.length > 0 && (
        <div className="rounded-md border p-3">
          <p className="text-xs font-semibold mb-1.5">Conditions</p>
          {clinical.conditions.map((c: any, i: number) => <p key={i} className="text-sm">{c.display || c.code || JSON.stringify(c)}</p>)}
        </div>
      )}
      {clinical.allergies?.length > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50/50 p-3">
          <p className="text-xs font-semibold text-red-700 flex items-center gap-1.5 mb-1.5"><AlertTriangle className="h-3.5 w-3.5" />Allergies</p>
          {clinical.allergies.map((a: any, i: number) => <p key={i} className="text-sm">{typeof a === "string" ? a : a.substance || JSON.stringify(a)}</p>)}
        </div>
      )}
    </div>
  );
}

function LabResultContent({ subject }: { subject: any }) {
  const clinical = subject.clinical ?? {};
  return (
    <div className="space-y-2">
      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <KeyValueRow label="Document No." value={subject.documentNo} />
        <KeyValueRow label="FHIR Resource" value={subject.fhir?.resourceType} />
        <KeyValueRow label="Organization" value={subject.organization?.name || subject.organization?.nameEn} />
      </div>
      {clinical.conditions?.length > 0 && (
        <div className="rounded-md border p-3">
          <p className="text-xs font-semibold mb-1.5">Related Conditions</p>
          {clinical.conditions.map((c: any, i: number) => <p key={i} className="text-sm">{c.display || c.code || JSON.stringify(c)}</p>)}
        </div>
      )}
    </div>
  );
}

function InsuranceEligibilityContent({ subject }: { subject: any }) {
  return (
    <div className="grid gap-2 text-sm sm:grid-cols-2">
      <KeyValueRow label="Document No." value={subject.documentNo} />
      <KeyValueRow label="Organization" value={subject.organization?.name || subject.organization?.nameEn} />
      <KeyValueRow label="FHIR Resource" value={subject.fhir?.resourceType} />
      <KeyValueRow label="Document Type" value={subject.documentType} />
    </div>
  );
}

function QuotationContent({ subject }: { subject: any }) {
  return (
    <div className="grid gap-2 text-sm sm:grid-cols-2">
      <KeyValueRow label="Document No." value={subject.documentNo} />
      <KeyValueRow label="Organization" value={subject.organization?.name || subject.organization?.nameEn} />
      <KeyValueRow label="FHIR Resource" value={subject.fhir?.resourceType} />
      <KeyValueRow label="Document Type" value={subject.documentType} />
    </div>
  );
}

function GuaranteeLetterContent({ subject }: { subject: any }) {
  return (
    <div className="grid gap-2 text-sm sm:grid-cols-2">
      <KeyValueRow label="Document No." value={subject.documentNo} />
      <KeyValueRow label="Organization" value={subject.organization?.name || subject.organization?.nameEn} />
      <KeyValueRow label="FHIR Resource" value={subject.fhir?.resourceType} />
      <KeyValueRow label="Document Type" value={subject.documentType} />
    </div>
  );
}

function ImmunizationContent({ subject }: { subject: any }) {
  return (
    <div className="grid gap-2 text-sm sm:grid-cols-2">
      <KeyValueRow label="Document No." value={subject.documentNo} />
      <KeyValueRow label="Organization" value={subject.organization?.name || subject.organization?.nameEn} />
      <KeyValueRow label="FHIR Resource" value={subject.fhir?.resourceType} />
    </div>
  );
}

function ClaimContent({ subject }: { subject: any }) {
  return (
    <div className="grid gap-2 text-sm sm:grid-cols-2">
      <KeyValueRow label="Document No." value={subject.documentNo} />
      <KeyValueRow label="Organization" value={subject.organization?.name || subject.organization?.nameEn} />
      <KeyValueRow label="Claim Case Ref" value={subject.claimCaseRef} />
      <KeyValueRow label="Total Amount" value={subject.totalAmount} />
    </div>
  );
}

function DischargeSummaryContent({ subject }: { subject: any }) {
  const clinical = subject.clinical ?? {};
  return (
    <div className="space-y-2">
      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <KeyValueRow label="Document No." value={subject.documentNo} />
        <KeyValueRow label="Organization" value={subject.organization?.name || subject.organization?.nameEn} />
      </div>
      {clinical.conditions?.length > 0 && (
        <div className="rounded-md border p-3">
          <p className="text-xs font-semibold mb-1.5">Discharge Conditions</p>
          {clinical.conditions.map((c: any, i: number) => <p key={i} className="text-sm">{c.display || c.code || JSON.stringify(c)}</p>)}
        </div>
      )}
    </div>
  );
}

function IdentityContent({ subject }: { subject: any }) {
  const patient = subject.patient ?? {};
  return (
    <div className="grid gap-2 text-sm sm:grid-cols-2">
      <KeyValueRow label="Name (TH)" value={patient.nameTh || subject.nameTh} />
      <KeyValueRow label="Name (EN)" value={patient.nameEn || subject.nameEn} />
      <KeyValueRow label="HN" value={patient.hn || subject.hn} />
      <KeyValueRow label="CarePass ID" value={patient.carepassId || subject.carepassId} />
      <KeyValueRow label="Birth Date" value={patient.birthDate || subject.birthDate} />
      <KeyValueRow label="Nationality" value={patient.nationality || subject.nationality} />
    </div>
  );
}

function TravelDocumentContent({ subject }: { subject: any }) {
  return (
    <div className="grid gap-2 text-sm sm:grid-cols-2">
      <KeyValueRow label="Document No." value={subject.documentNo} />
      <KeyValueRow label="Document Type" value={subject.documentType} />
      <KeyValueRow label="Organization" value={subject.organization?.name || subject.organization?.nameEn} />
    </div>
  );
}

function AppointmentContent({ subject }: { subject: any }) {
  return (
    <div className="grid gap-2 text-sm sm:grid-cols-2">
      <KeyValueRow label="Document No." value={subject.documentNo} />
      <KeyValueRow label="Organization" value={subject.organization?.name || subject.organization?.nameEn} />
      <KeyValueRow label="FHIR Resource" value={subject.fhir?.resourceType} />
    </div>
  );
}

function GenericContent({ subject, credential }: { subject: any; credential: any }) {
  const clinical = subject.clinical ?? {};
  const org = subject.organization;
  return (
    <div className="space-y-2">
      <div className="grid gap-2 text-sm sm:grid-cols-2">
        {subject.documentNo && <KeyValueRow label="Document No." value={subject.documentNo} />}
        {subject.documentType && <KeyValueRow label="Document Type" value={subject.documentType} />}
        {org && <KeyValueRow label="Organization" value={org.name || org.nameEn} />}
        {subject.fhir?.resourceType && <KeyValueRow label="FHIR Resource" value={subject.fhir.resourceType} />}
      </div>
      {clinical.conditions?.length > 0 && (
        <div className="rounded-md border p-3">
          <p className="text-xs font-semibold mb-1.5">Conditions</p>
          {clinical.conditions.map((c: any, i: number) => <p key={i} className="text-sm">{c.display || c.code || JSON.stringify(c)}</p>)}
        </div>
      )}
      {clinical.allergies?.length > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50/50 p-3">
          <p className="text-xs font-semibold text-red-700 flex items-center gap-1.5 mb-1.5"><AlertTriangle className="h-3.5 w-3.5" />Allergies</p>
          {clinical.allergies.map((a: any, i: number) => <p key={i} className="text-sm">{typeof a === "string" ? a : a.substance || JSON.stringify(a)}</p>)}
        </div>
      )}
      {clinical.medications?.length > 0 && (
        <div className="rounded-md border p-3">
          <p className="text-xs font-semibold text-blue-700 flex items-center gap-1.5 mb-1.5"><Pill className="h-3.5 w-3.5" />Medications</p>
          {clinical.medications.map((m: any, i: number) => <p key={i} className="text-sm">{m.name || (typeof m === "string" ? m : JSON.stringify(m))}</p>)}
        </div>
      )}
    </div>
  );
}

/* ─── Shared UI Helpers ────────────────────────────────────────────────── */

function KeyValueRow({ label, value }: { label: string; value?: any }) {
  if (value === undefined || value === null || value === "") return null;
  const display = typeof value === "object" ? JSON.stringify(value) : String(value);
  return (
    <div>
      <span className="text-muted-foreground text-xs">{label}</span>
      <p className="font-medium text-sm">{display}</p>
    </div>
  );
}

function formatDate(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    return new Date(value).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return value;
  }
}

/* ─── Trust Layer & Badge (unchanged) ──────────────────────────────────── */

function VerifierTrustLayer({ result }: { result: any }) {
  const decision = result?.transportDecision;
  const checklist = result?.verificationChecklist ?? [];
  if (!decision && checklist.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Trust layer decision
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {decision && (
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{decision.mode}</Badge>
              <span className="font-medium">{decision.label}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{decision.reason}</p>
          </div>
        )}
        {checklist.length > 0 && (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {checklist.map((check: any) => (
              <div key={check.key} className="rounded-md border p-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{check.label}</span>
                  <Badge variant={check.status === "missing" ? "destructive" : "secondary"}>{check.status}</Badge>
                </div>
                <p className="mt-1 text-muted-foreground">{check.detail}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TrustBadge({ level, warnings, errors }: { level: TrustLevel; warnings?: string[]; errors?: string[] }) {
  const cfg = trustBadgeConfig[level];
  const Icon = cfg.icon;
  return (
    <Card className={`border-2 ${cfg.bg}`}>
      <CardContent className="p-5 flex items-start gap-4">
        <Icon className={`h-9 w-9 ${cfg.iconColor} shrink-0`} />
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{cfg.title}</h3>
            <Badge variant={level === "red" ? "destructive" : "secondary"}>{level}</Badge>
          </div>
          {warnings?.map((warning) => <p key={warning} className="text-sm text-amber-700">{warning}</p>)}
          {errors?.map((error) => <p key={error} className="text-sm text-red-700">{error}</p>)}
          {level !== "red" && !warnings?.length && !errors?.length && (
            <p className="text-sm text-emerald-700 flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />Signature, status, and trust checks passed.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function flatten(values: unknown[]): any[] {
  return values.flatMap((value) => Array.isArray(value) ? value : value ? [value] : []);
}
