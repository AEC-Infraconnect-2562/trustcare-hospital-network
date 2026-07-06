/**
 * PublicVerify - Cross-device QR verification page
 * 
 * This page is accessible WITHOUT login (no DashboardLayout).
 * When a patient shows a QR code on their phone, the verifier scans it
 * with a different device. The QR encodes a URL like:
 *   https://trustcarehealth-xxx.manus.space/verify?vp=VP-xxx
 * 
 * This page extracts the vp param and calls the public verifyQrScan endpoint.
 * Each credential in the VP is rendered with its own type-specific context
 * extracted from the credentialSubject payload.
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import QRScanner from "@/components/QRScanner";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle, BadgeCheck, CalendarDays, Camera, CheckCircle2, ChevronDown, ChevronUp,
  ClipboardCheck, ExternalLink, FileCheck2, FileDigit, FileHeart, FileSignature, FileText,
  FolderCheck, Globe2, IdCard, Landmark, Link2, Microscope, PackageCheck, Pill, ReceiptText,
  RefreshCcw, RefreshCw, ScanLine, Send, ShieldAlert, ShieldCheck, ShieldX, Syringe,
  TriangleAlert,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearch } from "wouter";
import { toast } from "sonner";

type TrustLevel = "green" | "yellow" | "red";

const trustConfig = {
  green: { icon: ShieldCheck, bg: "bg-emerald-50 border-emerald-200", iconColor: "text-emerald-600", title: "ตรวจสอบผ่าน", titleEn: "Verified" },
  yellow: { icon: ShieldAlert, bg: "bg-amber-50 border-amber-200", iconColor: "text-amber-600", title: "ตรวจสอบผ่านมีข้อสังเกต", titleEn: "Verified with warnings" },
  red: { icon: ShieldX, bg: "bg-red-50 border-red-200", iconColor: "text-red-600", title: "ตรวจสอบไม่ผ่าน", titleEn: "Not Verified" },
};

/* ─── VC Type Metadata ─────────────────────────────────────────────────── */

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
  const types: string[] = Array.isArray(credential?.type) ? credential.type : [];
  const specific = types.find((t: string) => t !== "VerifiableCredential");
  if (specific) return specific;
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

function extractVerificationId(data: string): string {
  if (data.startsWith("http")) {
    try {
      const url = new URL(data);
      return url.searchParams.get("vp") || url.searchParams.get("token") || url.searchParams.get("vc") || data;
    } catch {
      return data;
    }
  }
  return data;
}

/* ─── Main Component ───────────────────────────────────────────────────── */

export default function PublicVerify() {
  const [mode, setMode] = useState<"scan" | "result">("scan");
  const [showScanner, setShowScanner] = useState(false);

  const verifyQr = trpc.verifier.verifyQrScan.useMutation({
    onSuccess: (data) => {
      setMode("result");
      toast[data.verified ? "success" : "error"](data.verified ? "ตรวจสอบสำเร็จ" : "ตรวจสอบไม่ผ่าน");
    },
    onError: (error) => toast.error(error.message),
  });

  const searchString = useSearch();
  const autoVerified = useRef(false);
  useEffect(() => {
    if (autoVerified.current) return;
    const params = new URLSearchParams(searchString);
    const vpId = params.get("vp") || params.get("token") || params.get("vc");
    if (vpId) {
      autoVerified.current = true;
      verifyQr.mutate({ qrData: vpId, source: "camera" });
    } else {
      setShowScanner(true);
    }
  }, [searchString]);

  const handleScanSuccess = useCallback((decodedText: string) => {
    const id = extractVerificationId(decodedText);
    verifyQr.mutate({ qrData: id, source: "camera" });
  }, [verifyQr]);

  const handleReset = () => {
    setMode("scan");
    setShowScanner(true);
    verifyQr.reset();
    autoVerified.current = false;
  };

  const result = verifyQr.data as any;
  const trustLevel = (result?.trustLevel ?? "red") as TrustLevel;
  const config = trustConfig[trustLevel] || trustConfig.red;
  const TrustIcon = config.icon;

  const credentials = useMemo(() => {
    if (!result) return [];
    if (Array.isArray(result.credentials)) return result.credentials;
    if (result.credential) return [result.credential];
    return [];
  }, [result]);

  const subjects = credentials.map(getSubject);
  const patient = subjects.find((s: any) => s.patient)?.patient ?? {};

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container max-w-3xl py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <span className="font-semibold text-sm">TrustCare Verify</span>
          </div>
          <Badge variant="outline" className="text-xs">Public Verification</Badge>
        </div>
      </header>

      <main className="container max-w-3xl py-8 space-y-6">
        {/* Loading state */}
        {verifyQr.isPending && (
          <Card>
            <CardContent className="py-16 text-center">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
              <p className="mt-4 text-muted-foreground">กำลังตรวจสอบ...</p>
              <p className="text-xs text-muted-foreground mt-1">Verifying credential...</p>
            </CardContent>
          </Card>
        )}

        {/* Scanner mode */}
        {mode === "scan" && !verifyQr.isPending && showScanner && (
          <div className="space-y-4">
            <div className="text-center">
              <h1 className="text-xl font-semibold">ตรวจสอบใบรับรองดิจิทัล</h1>
              <p className="text-sm text-muted-foreground mt-1">
                สแกน QR Code จากกระเป๋าสุขภาพของผู้ป่วย
              </p>
            </div>
            <Card>
              <CardContent className="p-6">
                <QRScanner
                  onScanSuccess={handleScanSuccess}
                  onScanError={(err) => toast.error(err)}
                  autoStart
                  fps={10}
                  aspectRatio={1.0}
                />
              </CardContent>
            </Card>
            <p className="text-center text-xs text-muted-foreground">
              หน้านี้ไม่ต้องเข้าสู่ระบบ — ใช้สำหรับตรวจสอบ QR Code ข้ามเครื่อง
            </p>
          </div>
        )}

        {/* Result mode */}
        {mode === "result" && result && (
          <div className="space-y-4">
            {/* Trust Badge */}
            <Card className={`border-2 ${config.bg}`}>
              <CardContent className="py-5">
                <div className="flex items-center gap-3">
                  <TrustIcon className={`h-10 w-10 ${config.iconColor}`} />
                  <div>
                    <h2 className="text-lg font-bold">{config.title}</h2>
                    <p className="text-sm text-muted-foreground">{config.titleEn}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Patient Info */}
            {(patient?.nameTh || patient?.nameEn || patient?.name || patient?.hn) && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">ข้อมูลผู้ป่วย</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {(patient.nameTh || patient.name) && (
                      <div>
                        <p className="text-xs text-muted-foreground">ชื่อ</p>
                        <p className="font-medium">{patient.nameTh || patient.name}</p>
                      </div>
                    )}
                    {patient.nameEn && (
                      <div>
                        <p className="text-xs text-muted-foreground">Name (EN)</p>
                        <p className="font-medium">{patient.nameEn}</p>
                      </div>
                    )}
                    {patient.hn && (
                      <div>
                        <p className="text-xs text-muted-foreground">HN</p>
                        <p className="font-mono">{patient.hn}</p>
                      </div>
                    )}
                    {patient.carepassId && (
                      <div>
                        <p className="text-xs text-muted-foreground">CarePass ID</p>
                        <p className="font-mono text-xs">{patient.carepassId}</p>
                      </div>
                    )}
                    {patient.birthDate && (
                      <div>
                        <p className="text-xs text-muted-foreground">วันเกิด</p>
                        <p>{patient.birthDate}</p>
                      </div>
                    )}
                    {patient.nationality && (
                      <div>
                        <p className="text-xs text-muted-foreground">สัญชาติ</p>
                        <p>{patient.nationality}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Credential-type-specific cards */}
            {credentials.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  ใบรับรองที่ตรวจสอบ ({credentials.length})
                </h3>
                {credentials.map((cred: any, i: number) => (
                  <PublicCredentialCard key={i} credential={cred} index={i} />
                ))}
              </div>
            )}

            {/* Warnings / Errors */}
            {(result.warnings?.length > 0 || result.errors?.length > 0) && (
              <Card>
                <CardContent className="py-4 space-y-2">
                  {result.warnings?.map((w: string, i: number) => (
                    <div key={`w-${i}`} className="flex items-start gap-2 text-sm text-amber-700">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>{w}</span>
                    </div>
                  ))}
                  {result.errors?.map((e: string, i: number) => (
                    <div key={`e-${i}`} className="flex items-start gap-2 text-sm text-red-700">
                      <ShieldX className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>{e}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <div className="flex gap-3 justify-center pt-2">
              <Button variant="outline" onClick={handleReset} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                สแกนใหม่
              </Button>
              <Button variant="ghost" onClick={() => window.location.href = "/verifier"} className="gap-2">
                <ExternalLink className="h-4 w-4" />
                เปิด Verifier เต็มรูปแบบ
              </Button>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="text-center text-xs text-muted-foreground pt-8 pb-4 border-t">
          <p>TrustCare Hospital Network — Verifiable Credential Verification</p>
          <p className="mt-1">หน้านี้ใช้สำหรับตรวจสอบ QR Code ข้ามเครื่องโดยไม่ต้องเข้าสู่ระบบ</p>
        </footer>
      </main>
    </div>
  );
}

/* ─── Per-Credential Card with Expandable Context ──────────────────────── */

function PublicCredentialCard({ credential, index }: { credential: any; index: number }) {
  const [expanded, setExpanded] = useState(index < 3); // auto-expand first 3
  const vcType = resolveVcType(credential);
  const meta = VC_TYPE_META[vcType] ?? { th: vcType, en: vcType, icon: FileText, color: "bg-gray-100 text-gray-800" };
  const TypeIcon = meta.icon;
  const issuer = typeof credential?.issuer === "string" ? credential.issuer : credential?.issuer?.name || credential?.issuer?.id || "Unknown";
  const subject = getSubject(credential);

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors text-left"
      >
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${meta.color}`}>
          <TypeIcon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            <p className="text-sm font-medium truncate">{meta.th}</p>
          </div>
          <p className="text-xs text-muted-foreground truncate">{meta.en} — {issuer}</p>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>
      {expanded && (
        <div className="border-t px-4 py-3">
          <CredentialContextContent vcType={vcType} subject={subject} />
        </div>
      )}
    </Card>
  );
}

/* ─── Credential Context Content (type-specific) ──────────────────────── */

function CredentialContextContent({ vcType, subject }: { vcType: string; subject: any }) {
  switch (vcType) {
    case "PatientSummaryCredential":
      return <PatientSummaryContext subject={subject} />;
    case "AllergyAlertCredential":
      return <AllergyAlertContext subject={subject} />;
    case "MedicationSummaryCredential":
      return <MedicationSummaryContext subject={subject} />;
    case "ConsentReceiptCredential":
      return <ConsentContext subject={subject} />;
    case "MedicalCertificateCredential":
      return <MedCertContext subject={subject} />;
    case "PrescriptionCredential":
      return <PrescriptionContext subject={subject} />;
    case "ReferralCredential":
      return <GenericDocContext subject={subject} label="ใบส่งต่อ" showClinical />;
    case "LabResultCredential":
    case "DiagnosticReportCredential":
      return <GenericDocContext subject={subject} label="ผลตรวจ" showClinical={false} />;
    case "CoverageEligibilityCredential":
      return <GenericDocContext subject={subject} label="สิทธิ์ประกัน" showClinical={false} />;
    case "QuotationCredential":
      return <GenericDocContext subject={subject} label="ใบเสนอราคา" showClinical={false} />;
    case "GuaranteeLetterCredential":
      return <GenericDocContext subject={subject} label="หนังสือค้ำประกัน" showClinical={false} />;
    case "DischargeSummaryCredential":
      return <GenericDocContext subject={subject} label="สรุปจำหน่าย" showClinical />;
    case "ImmunizationCredential":
      return <GenericDocContext subject={subject} label="วัคซีน" showClinical={false} />;
    case "ClaimPackageCredential":
    case "ClaimReceiptCredential":
      return <ClaimContext subject={subject} />;
    case "PatientIdentityCredential":
    case "HospitalStaffIdentityCredential":
      return <IdentityContext subject={subject} />;
    default:
      return <GenericDocContext subject={subject} label="เอกสาร" showClinical />;
  }
}

/* ─── Type-Specific Context Components ─────────────────────────────────── */

function PatientSummaryContext({ subject }: { subject: any }) {
  const allergies = flatten(subject.critical?.allergies ?? subject.clinical?.allergies ?? []);
  const medications = flatten(subject.critical?.medications ?? subject.clinical?.medications ?? []);
  const conditions = flatten(subject.critical?.conditions ?? subject.clinical?.conditions ?? []);

  return (
    <div className="space-y-2.5">
      {conditions.length > 0 && (
        <div className="rounded-md border p-2.5">
          <p className="text-xs font-semibold mb-1">โรค/ภาวะ (Conditions)</p>
          {conditions.map((c: any, i: number) => <p key={i} className="text-sm">{displayItem(c)}</p>)}
        </div>
      )}
      {allergies.length > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50/50 p-2.5">
          <p className="text-xs font-semibold text-red-700 flex items-center gap-1 mb-1"><AlertTriangle className="h-3 w-3" />การแพ้ (Allergies)</p>
          {allergies.map((a: any, i: number) => <p key={i} className="text-sm">{displayItem(a)}</p>)}
        </div>
      )}
      {medications.length > 0 && (
        <div className="rounded-md border p-2.5">
          <p className="text-xs font-semibold text-blue-700 flex items-center gap-1 mb-1"><Pill className="h-3 w-3" />ยาที่ใช้ (Medications)</p>
          {medications.map((m: any, i: number) => <p key={i} className="text-sm">{displayItem(m)}</p>)}
        </div>
      )}
      {subject.fhir?.resourceType && <KV label="FHIR Resource" value={subject.fhir.resourceType} />}
    </div>
  );
}

function AllergyAlertContext({ subject }: { subject: any }) {
  const allergies = flatten(subject.critical?.allergies ?? subject.clinical?.allergies ?? []);
  return (
    <div className="rounded-md border border-red-200 bg-red-50/50 p-2.5">
      <p className="text-xs font-semibold text-red-700 flex items-center gap-1 mb-1"><AlertTriangle className="h-3 w-3" />การแพ้ (Allergies)</p>
      {allergies.length > 0
        ? allergies.map((a: any, i: number) => <p key={i} className="text-sm">{displayItem(a)}</p>)
        : <p className="text-sm text-muted-foreground">ไม่มีข้อมูลการแพ้</p>}
    </div>
  );
}

function MedicationSummaryContext({ subject }: { subject: any }) {
  const medications = flatten(subject.critical?.medications ?? subject.clinical?.medications ?? []);
  return (
    <div className="rounded-md border p-2.5">
      <p className="text-xs font-semibold text-blue-700 flex items-center gap-1 mb-1"><Pill className="h-3 w-3" />ยาที่ใช้ (Medications)</p>
      {medications.length > 0
        ? medications.map((m: any, i: number) => <p key={i} className="text-sm">{displayItem(m)}</p>)
        : <p className="text-sm text-muted-foreground">ไม่มีข้อมูลยา</p>}
    </div>
  );
}

function ConsentContext({ subject }: { subject: any }) {
  return (
    <div className="grid gap-1.5 text-sm">
      <KV label="วัตถุประสงค์" value={subject.purpose} />
      <KV label="สถานะ" value={subject.status} />
      <KV label="ผู้ร้องขอ" value={subject.requesterId} />
      <KV label="บทบาท" value={subject.requesterRole} />
      <KV label="อนุญาตให้" value={subject.grantedToOrganizationId} />
      <KV label="วันที่อนุญาต" value={fmtDate(subject.grantedAt)} />
      <KV label="หมดอายุ" value={fmtDate(subject.expiresAt)} />
      {Array.isArray(subject.scopes) && subject.scopes.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground">ขอบเขต (Scopes)</p>
          <div className="flex flex-wrap gap-1 mt-0.5">
            {subject.scopes.map((s: string, i: number) => <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>)}
          </div>
        </div>
      )}
    </div>
  );
}

function MedCertContext({ subject }: { subject: any }) {
  return (
    <div className="grid gap-1.5 text-sm">
      <KV label="การวินิจฉัย" value={subject.diagnosisText} />
      <KV label="สมรรถภาพในการทำงาน" value={subject.fitnessForWork} />
      <KV label="แพทย์" value={subject.practitioner?.name || subject.practitioner?.nameEn} />
      <KV label="สถานพยาบาล" value={subject.organization?.name || subject.organization?.nameEn} />
      <KV label="ตั้งแต่" value={fmtDate(subject.validFrom)} />
      <KV label="ถึง" value={fmtDate(subject.validUntil)} />
      {Array.isArray(subject.recommendations) && subject.recommendations.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground">คำแนะนำ</p>
          <ul className="list-disc list-inside text-sm mt-0.5">
            {subject.recommendations.map((r: string, i: number) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function PrescriptionContext({ subject }: { subject: any }) {
  const meds = subject.fhir?.medicationRequests ?? [];
  return (
    <div className="space-y-2 text-sm">
      <div className="grid gap-1.5">
        <KV label="แพทย์ผู้สั่ง" value={subject.prescriber?.name || subject.prescriber?.nameEn} />
        <KV label="วันที่สั่ง" value={fmtDate(subject.authoredOn)} />
        <KV label="อนุญาตทดแทน" value={subject.substitutionAllowed ? "ได้" : "ไม่ได้"} />
        <KV label="ระยะจ่ายยา" value={subject.dispenseWindowDays ? `${subject.dispenseWindowDays} วัน` : undefined} />
      </div>
      {meds.length > 0 && (
        <div className="rounded-md border p-2.5 mt-1">
          <p className="text-xs font-semibold text-blue-700 flex items-center gap-1 mb-1"><Pill className="h-3 w-3" />รายการยา ({meds.length})</p>
          {meds.map((med: any, i: number) => (
            <div key={i} className="text-sm py-1 border-b last:border-0">
              <span className="font-medium">{med.medicationCodeableConcept?.text || med.medication?.display || `ยาที่ ${i + 1}`}</span>
              {med.dosageInstruction?.[0]?.text && <span className="text-muted-foreground ml-1">— {med.dosageInstruction[0].text}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ClaimContext({ subject }: { subject: any }) {
  return (
    <div className="grid gap-1.5 text-sm">
      <KV label="เลขที่เอกสาร" value={subject.documentNo} />
      <KV label="สถานพยาบาล" value={subject.organization?.name || subject.organization?.nameEn} />
      <KV label="อ้างอิงเคส" value={subject.claimCaseRef} />
      <KV label="ยอดรวม" value={subject.totalAmount} />
    </div>
  );
}

function IdentityContext({ subject }: { subject: any }) {
  const p = subject.patient ?? subject;
  return (
    <div className="grid gap-1.5 text-sm">
      <KV label="ชื่อ (TH)" value={p.nameTh} />
      <KV label="Name (EN)" value={p.nameEn} />
      <KV label="HN" value={p.hn} />
      <KV label="CarePass ID" value={p.carepassId} />
      <KV label="วันเกิด" value={p.birthDate} />
      <KV label="สัญชาติ" value={p.nationality} />
    </div>
  );
}

function GenericDocContext({ subject, label, showClinical }: { subject: any; label: string; showClinical: boolean }) {
  const clinical = subject.clinical ?? {};
  return (
    <div className="space-y-2">
      <div className="grid gap-1.5 text-sm">
        <KV label="เลขที่เอกสาร" value={subject.documentNo} />
        <KV label="ประเภท" value={subject.documentType} />
        <KV label="สถานพยาบาล" value={subject.organization?.name || subject.organization?.nameEn} />
        <KV label="FHIR Resource" value={subject.fhir?.resourceType} />
      </div>
      {showClinical && clinical.conditions?.length > 0 && (
        <div className="rounded-md border p-2.5">
          <p className="text-xs font-semibold mb-1">โรค/ภาวะ</p>
          {clinical.conditions.map((c: any, i: number) => <p key={i} className="text-sm">{displayItem(c)}</p>)}
        </div>
      )}
      {showClinical && clinical.allergies?.length > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50/50 p-2.5">
          <p className="text-xs font-semibold text-red-700 flex items-center gap-1 mb-1"><AlertTriangle className="h-3 w-3" />การแพ้</p>
          {clinical.allergies.map((a: any, i: number) => <p key={i} className="text-sm">{displayItem(a)}</p>)}
        </div>
      )}
    </div>
  );
}

/* ─── Shared Helpers ───────────────────────────────────────────────────── */

function KV({ label, value }: { label: string; value?: any }) {
  if (value === undefined || value === null || value === "") return null;
  const display = typeof value === "object" ? JSON.stringify(value) : String(value);
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{display}</p>
    </div>
  );
}

function fmtDate(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    return new Date(value).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return value;
  }
}

function displayItem(item: any): string {
  if (typeof item === "string") return item;
  return item?.substance || item?.name || item?.display || item?.code || item?.medicationCodeableConcept?.text || JSON.stringify(item);
}

function flatten(values: unknown[]): any[] {
  return values.flatMap((v) => Array.isArray(v) ? v : v ? [v] : []);
}
