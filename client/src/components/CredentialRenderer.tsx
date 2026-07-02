import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Building2,
  Calendar,
  FileText,
  Heart,
  Pill,
  Shield,
  Stethoscope,
  User,
  Syringe,
  FlaskConical,
  ClipboardList,
  Plane,
  CreditCard,
  Activity,
} from "lucide-react";

// Avatar URLs for demo (uploaded to manus-storage)
const AVATAR_URLS = {
  male: "/manus-storage/patient-avatar-male_c0b881f4.png",
  female: "/manus-storage/patient-avatar-female_838fe3a6.png",
  doctor: "/manus-storage/doctor-avatar-male_7aa3faf7.png",
};

// Hospital brand colors based on actual TrustCare network hospitals
const HOSPITAL_COLORS: Record<string, { primary: string; gradient: string; logo: string; accent: string }> = {
  TCC: { primary: "#0f766e", gradient: "from-teal-800 to-teal-600", logo: "TrustCare Central", accent: "#f59e0b" },
  TCP: { primary: "#1d4ed8", gradient: "from-blue-800 to-blue-600", logo: "TrustCare Phuket", accent: "#06b6d4" },
  TCM: { primary: "#7c3aed", gradient: "from-purple-800 to-purple-600", logo: "TrustCare Chiang Mai", accent: "#22c55e" },
  SRR: { primary: "#1e40af", gradient: "from-blue-900 to-blue-700", logo: "ศิริราช", accent: "#fbbf24" },
  RMT: { primary: "#7c3aed", gradient: "from-purple-900 to-purple-700", logo: "รามาธิบดี", accent: "#a78bfa" },
  BMG: { primary: "#0d9488", gradient: "from-teal-800 to-teal-600", logo: "บำรุงราษฎร์", accent: "#14b8a6" },
  BNH: { primary: "#dc2626", gradient: "from-red-800 to-red-600", logo: "BNH", accent: "#f87171" },
  default: { primary: "#1d4ed8", gradient: "from-slate-800 to-slate-600", logo: "TrustCare", accent: "#3b82f6" },
};

interface CredentialRendererProps {
  credentialData: any;
  type: string;
  status: string;
  credentialId: string;
  issuedAt: string;
  expiresAt?: string | null;
  hospitalCode?: string;
  hospitalName?: string;
  patientName?: string;
  compact?: boolean;
}

function getHospitalBrand(code?: string) {
  if (!code) return HOSPITAL_COLORS.default;
  return HOSPITAL_COLORS[code] || HOSPITAL_COLORS.default;
}

// Extract from humanDocument.renderData (preferred) or fallback to credentialSubject
function extractRenderData(credentialData: any) {
  const subject = credentialData?.credentialSubject || credentialData;
  const renderData = subject?.humanDocument?.renderData;
  
  if (renderData) {
    return {
      hospital: {
        code: renderData.hospital?.code || "",
        nameTh: renderData.hospital?.nameTh || "",
        nameEn: renderData.hospital?.nameEn || "",
        hcode: renderData.hospital?.hcode || "",
      },
      patient: {
        fullNameTh: renderData.patient?.fullNameTh || "",
        fullNameEn: renderData.patient?.fullNameEn || "",
        hn: renderData.patient?.hn || "",
        carepassId: renderData.patient?.carepassId || "",
      },
      document: {
        no: renderData.document?.no || "",
        hashShort: renderData.document?.hashShort || "",
        qrLabel: renderData.document?.qrLabel || "",
      },
      issuer: {
        did: renderData.issuer?.did || "",
      },
    };
  }
  
  // Fallback to credentialSubject fields
  const patient = subject?.patient || {};
  const org = subject?.organization || {};
  return {
    hospital: {
      code: org.code || org.id || "",
      nameTh: org.name || "",
      nameEn: org.nameEn || "",
      hcode: org.id || "",
    },
    patient: {
      fullNameTh: patient.nameTh || patient.name || "",
      fullNameEn: patient.nameEn || "",
      hn: patient.hn || "",
      carepassId: patient.carepassId || "",
    },
    document: { no: "", hashShort: "", qrLabel: "" },
    issuer: { did: subject?.id || "" },
  };
}

function extractPatientGender(credentialData: any): "male" | "female" {
  const subject = credentialData?.credentialSubject || credentialData;
  const patient = subject?.patient || {};
  if (patient.gender === "female" || patient.sex === "F") return "female";
  // Check name prefix
  const name = patient.nameTh || patient.fullNameTh || patient.nameEn || "";
  if (name.startsWith("นาง") || name.startsWith("Ms.") || name.startsWith("Mrs.")) return "female";
  return "male";
}

function extractClinicalInfo(credentialData: any) {
  const subject = credentialData?.credentialSubject || credentialData;
  return {
    diagnosisText: subject?.diagnosisText || "",
    fitnessForWork: subject?.fitnessForWork || "",
    recommendations: subject?.recommendations || [],
    practitioner: subject?.practitioner || {},
    medications: subject?.fhir?.medicationRequests || [],
    prescriber: subject?.prescriber || {},
    clinical: subject?.clinical || {},
    conditions: subject?.clinical?.conditions || [],
    allergies: subject?.clinical?.allergies || [],
    medicationsList: subject?.clinical?.medications || [],
  };
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-800 border-emerald-200",
    revoked: "bg-red-100 text-red-800 border-red-200",
    expired: "bg-amber-100 text-amber-800 border-amber-200",
    suspended: "bg-gray-100 text-gray-800 border-gray-200",
  };
  const labels: Record<string, string> = {
    active: "ใช้งาน",
    revoked: "เพิกถอน",
    expired: "หมดอายุ",
    suspended: "ระงับ",
  };
  return (
    <Badge variant="outline" className={`${colors[status] || colors.active} text-xs font-medium`}>
      {labels[status] || status}
    </Badge>
  );
}

function formatThaiDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });
  } catch { return dateStr; }
}

// ─── Patient Identity Card Template ───────────────────────────────────────────
function PatientIdentityCard({ props }: { props: CredentialRendererProps }) {
  const renderData = extractRenderData(props.credentialData);
  const brand = getHospitalBrand(renderData.hospital.code || props.hospitalCode);
  const gender = extractPatientGender(props.credentialData);
  const avatarUrl = gender === "female" ? AVATAR_URLS.female : AVATAR_URLS.male;
  const clinical = extractClinicalInfo(props.credentialData);

  return (
    <Card className="overflow-hidden border-0 shadow-2xl rounded-2xl">
      {/* Hospital Header - like a real patient ID card */}
      <div className={`bg-gradient-to-r ${brand.gradient} p-6 text-white relative overflow-hidden`}>
        {/* Decorative pattern */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-8 translate-x-8" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-6 -translate-x-6" />
        
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs opacity-70 tracking-wider uppercase">บัตรประจำตัวผู้ป่วย</p>
              <p className="font-bold text-lg">{renderData.hospital.nameTh || props.hospitalName || brand.logo}</p>
              {renderData.hospital.nameEn && (
                <p className="text-xs opacity-70">{renderData.hospital.nameEn}</p>
              )}
            </div>
          </div>
          <StatusBadge status={props.status} />
        </div>
      </div>

      <CardContent className="p-6">
        <div className="flex gap-5">
          {/* Photo - realistic ID card style */}
          <div className="shrink-0">
            <div className="h-32 w-24 rounded-xl overflow-hidden border-2 border-gray-200 shadow-lg ring-2 ring-offset-2 ring-gray-100">
              <img
                src={avatarUrl}
                alt="Patient photo"
                className="h-full w-full object-cover"
              />
            </div>
          </div>

          {/* Patient info */}
          <div className="flex-1 space-y-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">ชื่อ-นามสกุล</p>
              <p className="font-bold text-xl leading-tight">{renderData.patient.fullNameTh || "—"}</p>
              {renderData.patient.fullNameEn && (
                <p className="text-sm text-muted-foreground">{renderData.patient.fullNameEn}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/40 rounded-lg p-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">HN</p>
                <p className="font-mono text-sm font-bold">{renderData.patient.hn || "—"}</p>
              </div>
              <div className="bg-muted/40 rounded-lg p-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">CarePass ID</p>
                <p className="font-mono text-xs font-medium">{renderData.patient.carepassId || "—"}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Clinical Summary (if available) */}
        {(clinical.conditions.length > 0 || clinical.allergies.length > 0) && (
          <>
            <Separator className="my-4" />
            <div className="grid grid-cols-2 gap-4">
              {clinical.conditions.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
                    <Activity className="h-3 w-3" /> โรคประจำตัว
                  </p>
                  <div className="space-y-1">
                    {clinical.conditions.map((c: any, i: number) => (
                      <p key={i} className="text-xs bg-blue-50 text-blue-700 rounded px-2 py-0.5 inline-block mr-1">
                        {typeof c === "string" ? c : c.display || c.code}
                      </p>
                    ))}
                  </div>
                </div>
              )}
              {clinical.allergies.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
                    <Shield className="h-3 w-3" /> การแพ้ยา
                  </p>
                  <div className="space-y-1">
                    {clinical.allergies.map((a: string, i: number) => (
                      <p key={i} className="text-xs bg-red-50 text-red-700 rounded px-2 py-0.5 inline-block mr-1">
                        {a}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        <Separator className="my-4" />

        {/* Footer with document info */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>ออกเมื่อ: {formatThaiDate(props.issuedAt)}</span>
          </div>
          {props.expiresAt && (
            <span>หมดอายุ: {formatThaiDate(props.expiresAt)}</span>
          )}
        </div>
        {renderData.document.no && (
          <div className="mt-2 flex items-center justify-between">
            <p className="text-[10px] text-muted-foreground font-mono">เลขที่: {renderData.document.no}</p>
            {renderData.document.hashShort && (
              <p className="text-[10px] text-muted-foreground font-mono">Hash: {renderData.document.hashShort}</p>
            )}
          </div>
        )}
        <p className="text-[9px] text-muted-foreground mt-1 font-mono truncate opacity-60">DID: {renderData.issuer.did}</p>
      </CardContent>
    </Card>
  );
}

// ─── Medical Certificate Template ─────────────────────────────────────────────
function MedicalCertificateCard({ props }: { props: CredentialRendererProps }) {
  const renderData = extractRenderData(props.credentialData);
  const brand = getHospitalBrand(renderData.hospital.code || props.hospitalCode);
  const gender = extractPatientGender(props.credentialData);
  const avatarUrl = gender === "female" ? AVATAR_URLS.female : AVATAR_URLS.male;
  const clinical = extractClinicalInfo(props.credentialData);

  return (
    <Card className="overflow-hidden border-0 shadow-2xl rounded-2xl">
      {/* Header */}
      <div className={`bg-gradient-to-r ${brand.gradient} p-6 text-white relative overflow-hidden`}>
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-12 translate-x-12" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
              <Stethoscope className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs opacity-70 tracking-wider uppercase">ใบรับรองแพทย์</p>
              <p className="font-bold text-lg">{renderData.hospital.nameTh || props.hospitalName || brand.logo}</p>
              {renderData.hospital.nameEn && (
                <p className="text-xs opacity-70">{renderData.hospital.nameEn}</p>
              )}
            </div>
          </div>
          <StatusBadge status={props.status} />
        </div>
      </div>

      <CardContent className="p-6 space-y-4">
        {/* Patient section with photo */}
        <div className="flex gap-4 items-start">
          <div className="h-20 w-16 rounded-xl overflow-hidden border-2 border-gray-200 shadow-md shrink-0">
            <img src={avatarUrl} alt="Patient" className="h-full w-full object-cover" />
          </div>
          <div className="space-y-1">
            <p className="font-bold text-lg">{renderData.patient.fullNameTh || "—"}</p>
            {renderData.patient.fullNameEn && (
              <p className="text-sm text-muted-foreground">{renderData.patient.fullNameEn}</p>
            )}
            <p className="text-xs text-muted-foreground">HN: {renderData.patient.hn}</p>
          </div>
        </div>

        <Separator />

        {/* Diagnosis */}
        {clinical.diagnosisText && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-amber-800 mb-1 flex items-center gap-1">
              <Heart className="h-3.5 w-3.5" /> การวินิจฉัย
            </p>
            <p className="text-sm text-amber-900">{clinical.diagnosisText}</p>
          </div>
        )}

        {/* Fitness for Work */}
        {clinical.fitnessForWork && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-blue-800 mb-1">ความสามารถในการทำงาน</p>
            <Badge variant={clinical.fitnessForWork === "fit" ? "default" : "secondary"} className="text-sm">
              {clinical.fitnessForWork === "fit" ? "✓ สามารถทำงานได้ตามปกติ" :
               clinical.fitnessForWork === "unfit" ? "✗ ไม่สามารถทำงานได้" : "△ ทำงานได้จำกัด"}
            </Badge>
          </div>
        )}

        {/* Recommendations */}
        {clinical.recommendations?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">คำแนะนำแพทย์</p>
            <ul className="space-y-1.5">
              {clinical.recommendations.map((rec: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-primary font-bold mt-0.5">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Practitioner */}
        {clinical.practitioner?.name && (
          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
            <img src={AVATAR_URLS.doctor} alt="Doctor" className="h-12 w-12 rounded-full object-cover border-2 border-white shadow-sm" />
            <div>
              <p className="font-medium">{clinical.practitioner.name}</p>
              <p className="text-xs text-muted-foreground">
                {clinical.practitioner.license ? `ว.${clinical.practitioner.license}` : "แพทย์ผู้ออกใบรับรอง"}
              </p>
            </div>
          </div>
        )}

        <Separator />

        {/* Dates & Document No */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>ออกเมื่อ: {formatThaiDate(props.issuedAt)}</span>
          </div>
          {props.expiresAt && <span>หมดอายุ: {formatThaiDate(props.expiresAt)}</span>}
        </div>
        {renderData.document.no && (
          <p className="text-[10px] text-muted-foreground font-mono">เลขที่: {renderData.document.no}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Prescription Template ────────────────────────────────────────────────────
function PrescriptionCard({ props }: { props: CredentialRendererProps }) {
  const renderData = extractRenderData(props.credentialData);
  const brand = getHospitalBrand(renderData.hospital.code || props.hospitalCode);
  const clinical = extractClinicalInfo(props.credentialData);

  return (
    <Card className="overflow-hidden border-0 shadow-2xl rounded-2xl">
      {/* Header */}
      <div className={`bg-gradient-to-r ${brand.gradient} p-6 text-white relative overflow-hidden`}>
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-12 translate-x-12" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
              <Pill className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs opacity-70 tracking-wider uppercase">ใบสั่งยา / Prescription</p>
              <p className="font-bold text-lg">{renderData.hospital.nameTh || props.hospitalName || brand.logo}</p>
              {renderData.hospital.nameEn && (
                <p className="text-xs opacity-70">{renderData.hospital.nameEn}</p>
              )}
            </div>
          </div>
          <StatusBadge status={props.status} />
        </div>
      </div>

      <CardContent className="p-6 space-y-4">
        {/* Patient */}
        <div className="flex items-center gap-3 bg-muted/30 rounded-xl p-3">
          <User className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="font-bold">{renderData.patient.fullNameTh || "—"}</p>
            <p className="text-xs text-muted-foreground">HN: {renderData.patient.hn}</p>
          </div>
        </div>

        <Separator />

        {/* Medications */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
            <Pill className="h-3.5 w-3.5" /> รายการยาที่สั่ง
          </p>
          {clinical.medications?.length > 0 ? (
            <div className="space-y-2">
              {clinical.medications.map((med: any, i: number) => (
                <div key={i} className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-sm text-green-900">
                        {med.medicationCodeableConcept?.text || med.name || med.code || `ยารายการที่ ${i + 1}`}
                      </p>
                      {(med.dosageInstruction?.[0]?.text || med.instructions) && (
                        <p className="text-xs text-green-700 mt-1">
                          💊 {med.dosageInstruction?.[0]?.text || med.instructions}
                        </p>
                      )}
                    </div>
                    {med.dispenseRequest?.expectedSupplyDuration?.value && (
                      <Badge variant="outline" className="text-[10px] bg-white">
                        {med.dispenseRequest.expectedSupplyDuration.value} วัน
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : clinical.medicationsList?.length > 0 ? (
            <div className="space-y-2">
              {clinical.medicationsList.map((med: any, i: number) => (
                <div key={i} className="bg-green-50 border border-green-200 rounded-xl p-3">
                  <p className="font-medium text-sm text-green-900">{med.name || med.code || `ยารายการที่ ${i + 1}`}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic bg-muted/30 rounded-lg p-3">ไม่มีข้อมูลรายการยา</p>
          )}
        </div>

        {/* Prescriber */}
        {clinical.prescriber?.name && (
          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
            <img src={AVATAR_URLS.doctor} alt="Doctor" className="h-12 w-12 rounded-full object-cover border-2 border-white shadow-sm" />
            <div>
              <p className="font-medium">{clinical.prescriber.name}</p>
              <p className="text-xs text-muted-foreground">
                {clinical.prescriber.license ? `ว.${clinical.prescriber.license}` : "แพทย์ผู้สั่งยา"}
              </p>
            </div>
          </div>
        )}

        <Separator />

        {/* Dates */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>ออกเมื่อ: {formatThaiDate(props.issuedAt)}</span>
          </div>
          {props.expiresAt && <span>หมดอายุ: {formatThaiDate(props.expiresAt)}</span>}
        </div>
        {renderData.document.no && (
          <p className="text-[10px] text-muted-foreground font-mono">เลขที่: {renderData.document.no}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Generic Document Template ────────────────────────────────────────────────
function GenericDocumentCard({ props }: { props: CredentialRendererProps }) {
  const renderData = extractRenderData(props.credentialData);
  const brand = getHospitalBrand(renderData.hospital.code || props.hospitalCode);
  
  const typeConfig: Record<string, { icon: typeof FileText; label: string; color: string }> = {
    patient_summary: { icon: ClipboardList, label: "สรุปข้อมูลผู้ป่วย", color: "from-indigo-700 to-indigo-500" },
    allergy_alert: { icon: Shield, label: "แจ้งเตือนการแพ้ยา", color: "from-red-700 to-red-500" },
    medication_summary: { icon: Pill, label: "สรุปรายการยา", color: "from-green-700 to-green-500" },
    consent_receipt: { icon: Shield, label: "ใบยินยอม (Consent)", color: "from-violet-700 to-violet-500" },
    mpi_link_certificate: { icon: User, label: "ใบเชื่อมโยงตัวตน (MPI)", color: "from-cyan-700 to-cyan-500" },
    travel_document_verification: { icon: Plane, label: "ตรวจสอบเอกสารเดินทาง", color: "from-sky-700 to-sky-500" },
    insurance_eligibility: { icon: CreditCard, label: "สิทธิ์ประกันสุขภาพ", color: "from-amber-700 to-amber-500" },
    claim_package: { icon: FileText, label: "แพ็คเกจเคลม", color: "from-orange-700 to-orange-500" },
    claim_receipt: { icon: FileText, label: "ใบตอบรับเคลม", color: "from-orange-700 to-orange-500" },
    sync_receipt: { icon: Activity, label: "ใบตอบรับ Sync", color: "from-gray-700 to-gray-500" },
    shl_manifest: { icon: FileText, label: "Smart Health Link", color: "from-emerald-700 to-emerald-500" },
    immunization: { icon: Syringe, label: "บันทึกการฉีดวัคซีน", color: "from-lime-700 to-lime-500" },
    lab_result: { icon: FlaskConical, label: "ผลตรวจทางห้องปฏิบัติการ", color: "from-pink-700 to-pink-500" },
    diagnostic_report: { icon: ClipboardList, label: "รายงานการวินิจฉัย", color: "from-rose-700 to-rose-500" },
    discharge_summary: { icon: FileText, label: "สรุปจำหน่ายผู้ป่วย", color: "from-slate-700 to-slate-500" },
    referral_vc: { icon: FileText, label: "ใบส่งต่อผู้ป่วย", color: "from-blue-700 to-blue-500" },
    pharmacy_dispense: { icon: Pill, label: "ใบจ่ายยา", color: "from-teal-700 to-teal-500" },
    appointment: { icon: Calendar, label: "นัดหมาย", color: "from-purple-700 to-purple-500" },
    visa_support_letter: { icon: Plane, label: "หนังสือรับรองเพื่อวีซ่า", color: "from-blue-800 to-blue-600" },
    quotation: { icon: CreditCard, label: "ใบเสนอราคา", color: "from-yellow-700 to-yellow-500" },
    guarantee_letter: { icon: Shield, label: "หนังสือค้ำประกัน", color: "from-emerald-800 to-emerald-600" },
  };
  
  const config = typeConfig[props.type] || { icon: FileText, label: props.type.replace(/_/g, " "), color: brand.gradient };
  const Icon = config.icon;

  return (
    <Card className="overflow-hidden border-0 shadow-2xl rounded-2xl">
      {/* Header */}
      <div className={`bg-gradient-to-r ${config.color} p-6 text-white relative overflow-hidden`}>
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-12 translate-x-12" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs opacity-70 tracking-wider uppercase">{config.label}</p>
              <p className="font-bold text-lg">{renderData.hospital.nameTh || props.hospitalName || brand.logo}</p>
              {renderData.hospital.nameEn && (
                <p className="text-xs opacity-70">{renderData.hospital.nameEn}</p>
              )}
            </div>
          </div>
          <StatusBadge status={props.status} />
        </div>
      </div>

      <CardContent className="p-6 space-y-4">
        {/* Patient */}
        <div className="flex items-center gap-3 bg-muted/30 rounded-xl p-3">
          <User className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="font-bold">{renderData.patient.fullNameTh || "—"}</p>
            {renderData.patient.fullNameEn && renderData.patient.fullNameEn !== renderData.patient.fullNameTh && (
              <p className="text-xs text-muted-foreground">{renderData.patient.fullNameEn}</p>
            )}
            {renderData.patient.hn && <p className="text-xs text-muted-foreground">HN: {renderData.patient.hn}</p>}
          </div>
        </div>

        <Separator />

        {/* Key fields from credential subject */}
        <CredentialSubjectFields credentialData={props.credentialData} type={props.type} />

        <Separator />

        {/* Dates */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>ออกเมื่อ: {formatThaiDate(props.issuedAt)}</span>
          </div>
          {props.expiresAt && <span>หมดอายุ: {formatThaiDate(props.expiresAt)}</span>}
        </div>
        {renderData.document.no && (
          <p className="text-[10px] text-muted-foreground font-mono">เลขที่: {renderData.document.no}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Credential Subject Fields (formatted key-value) ──────────────────────────
function CredentialSubjectFields({ credentialData, type }: { credentialData: any; type: string }) {
  const subject = credentialData?.credentialSubject || credentialData;
  if (!subject) return null;

  // Skip technical/meta fields
  const skipKeys = new Set([
    "@context", "type", "id", "credentialStatus", "issuer", "validFrom", "validUntil",
    "evidence", "makerChecker", "trustcareSeed", "trustcareSubjectId", "fhir",
    "sourceOfTruth", "fontPolicy", "brand", "label", "documentHash", "documentNo",
    "humanDocument", "patient", "organization",
  ]);

  const fieldLabels: Record<string, string> = {
    practitioner: "แพทย์",
    prescriber: "แพทย์ผู้สั่งยา",
    diagnosisText: "การวินิจฉัย",
    fitnessForWork: "ความสามารถทำงาน",
    recommendations: "คำแนะนำ",
    clinical: "ข้อมูลทางคลินิก",
    documentType: "ประเภทเอกสาร",
    certificateType: "ประเภทใบรับรอง",
    prescriptionType: "ประเภทใบสั่งยา",
    authoredOn: "วันที่สั่ง",
    substitutionAllowed: "อนุญาตเปลี่ยนยา",
    repeatsAllowed: "จำนวนครั้งที่สั่งซ้ำ",
    dispenseWindowDays: "ระยะเวลาจ่ายยา (วัน)",
    purpose: "วัตถุประสงค์",
    scopes: "ขอบเขตข้อมูล",
    status: "สถานะ",
  };

  const entries = Object.entries(subject).filter(([key]) => !skipKeys.has(key));
  if (entries.length === 0) return null;

  return (
    <div className="space-y-2.5">
      {entries.slice(0, 6).map(([key, value]) => (
        <div key={key} className="flex items-start gap-3">
          <span className="text-[11px] text-muted-foreground min-w-[90px] shrink-0 pt-0.5 font-medium">
            {fieldLabels[key] || key}
          </span>
          <span className="text-sm flex-1 text-foreground">
            {renderValue(value)}
          </span>
        </div>
      ))}
      {entries.length > 6 && (
        <p className="text-xs text-muted-foreground italic">+{entries.length - 6} รายการเพิ่มเติม...</p>
      )}
    </div>
  );
}

function renderValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "ใช่" : "ไม่";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      try { return formatThaiDate(value); } catch { return value; }
    }
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "—";
    if (typeof value[0] === "string") return value.join(", ");
    return `[${value.length} รายการ]`;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (obj.name) return String(obj.name);
    if (obj.display) return String(obj.display);
    if (obj.text) return String(obj.text);
    return JSON.stringify(value).slice(0, 80) + "...";
  }
  return String(value);
}

// ─── Main Renderer ────────────────────────────────────────────────────────────
export function CredentialRenderer(props: CredentialRendererProps) {
  const { type } = props;

  if (type === "patient_identity") {
    return <PatientIdentityCard props={props} />;
  }
  if (type === "medical_certificate") {
    return <MedicalCertificateCard props={props} />;
  }
  if (type === "prescription") {
    return <PrescriptionCard props={props} />;
  }
  return <GenericDocumentCard props={props} />;
}

// ─── Compact Card (for Wallet list) ──────────────────────────────────────────
export function CredentialCompactCard({ props }: { props: CredentialRendererProps }) {
  const renderData = extractRenderData(props.credentialData);
  const brand = getHospitalBrand(renderData.hospital.code || props.hospitalCode);
  const gender = extractPatientGender(props.credentialData);
  const needsPhoto = ["patient_identity", "medical_certificate"].includes(props.type);
  const avatarUrl = gender === "female" ? AVATAR_URLS.female : AVATAR_URLS.male;

  const typeLabels: Record<string, string> = {
    patient_identity: "บัตรประจำตัวผู้ป่วย",
    medical_certificate: "ใบรับรองแพทย์",
    prescription: "ใบสั่งยา",
    patient_summary: "สรุปข้อมูลผู้ป่วย",
    allergy_alert: "แจ้งเตือนการแพ้",
    medication_summary: "สรุปรายการยา",
    consent_receipt: "ใบยินยอม",
    mpi_link_certificate: "ใบเชื่อมโยงตัวตน",
    shl_manifest: "Smart Health Link",
    immunization: "บันทึกวัคซีน",
    lab_result: "ผลแล็บ",
    referral_vc: "ใบส่งต่อ",
    discharge_summary: "สรุปจำหน่าย",
    insurance_eligibility: "สิทธิ์ประกัน",
    claim_package: "แพ็คเกจเคลม",
    travel_document_verification: "เอกสารเดินทาง",
    pharmacy_dispense: "ใบจ่ายยา",
    appointment: "นัดหมาย",
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border bg-card hover:shadow-lg transition-all duration-200 cursor-pointer group">
      {/* Mini avatar or branded icon */}
      {needsPhoto ? (
        <div className="h-12 w-10 rounded-lg overflow-hidden border-2 border-gray-200 shadow-sm shrink-0 group-hover:border-primary/30 transition-colors">
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
        </div>
      ) : (
        <div className={`h-11 w-11 rounded-xl bg-gradient-to-br ${brand.gradient} flex items-center justify-center shrink-0 shadow-sm`}>
          <FileText className="h-5 w-5 text-white" />
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{typeLabels[props.type] || props.type.replace(/_/g, " ")}</p>
        <p className="text-xs text-muted-foreground truncate">
          {renderData.hospital.nameTh || props.hospitalName || brand.logo}
        </p>
      </div>

      {/* Status */}
      <StatusBadge status={props.status} />
    </div>
  );
}

export default CredentialRenderer;
