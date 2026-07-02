import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SafeImage } from "@/components/SafeImage";
import { AVATAR_URLS, resolvePatientAvatarUrl } from "@/lib/avatar";
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
  AlertTriangle,
  CheckCircle2,
  ArrowRightLeft,
  FileCheck,
  Clock,
} from "lucide-react";

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
  patientPhotoUrl?: string | null;
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

// ─── Document Header (shared across all templates) ───────────────────────────
function DocumentHeader({ icon: Icon, title, brand, renderData, status }: {
  icon: typeof FileText;
  title: string;
  brand: { gradient: string; logo: string };
  renderData: ReturnType<typeof extractRenderData>;
  status: string;
}) {
  return (
    <div className={`bg-gradient-to-r ${brand.gradient} p-6 text-white relative overflow-hidden`}>
      <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-12 translate-x-12" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-6 -translate-x-6" />
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs opacity-70 tracking-wider uppercase">{title}</p>
            <p className="font-bold text-lg">{renderData.hospital.nameTh || brand.logo}</p>
            {renderData.hospital.nameEn && (
              <p className="text-xs opacity-70">{renderData.hospital.nameEn}</p>
            )}
          </div>
        </div>
        <StatusBadge status={status} />
      </div>
    </div>
  );
}

// ─── Patient Info Section ────────────────────────────────────────────────────
function PatientInfoSection({ renderData, showPhoto, gender, patientPhotoUrl }: {
  renderData: ReturnType<typeof extractRenderData>;
  showPhoto?: boolean;
  gender?: "male" | "female";
  patientPhotoUrl?: string | null;
}) {
  const fallbackAvatarUrl = gender === "female" ? AVATAR_URLS.female : AVATAR_URLS.male;
  const avatarUrl = resolvePatientAvatarUrl({
    avatarUrl: patientPhotoUrl,
    gender,
    name: renderData.patient.fullNameTh || renderData.patient.fullNameEn,
  });
  return (
    <div className="flex gap-4 items-start">
      {showPhoto && (
        <div className="h-20 w-16 rounded-xl overflow-hidden border-2 border-gray-200 shadow-md shrink-0">
          <SafeImage src={avatarUrl} fallbackSrc={fallbackAvatarUrl} alt="" className="h-full w-full object-cover" />
        </div>
      )}
      <div className="space-y-1 flex-1">
        <p className="font-bold text-lg">{renderData.patient.fullNameTh || "—"}</p>
        {renderData.patient.fullNameEn && (
          <p className="text-sm text-muted-foreground">{renderData.patient.fullNameEn}</p>
        )}
        <div className="flex gap-4 text-xs text-muted-foreground">
          {renderData.patient.hn && <span>HN: <span className="font-mono font-medium text-foreground">{renderData.patient.hn}</span></span>}
          {renderData.patient.carepassId && <span>CarePass: <span className="font-mono text-foreground">{renderData.patient.carepassId}</span></span>}
        </div>
      </div>
    </div>
  );
}

// ─── Document Footer ─────────────────────────────────────────────────────────
function DocumentFooter({ issuedAt, expiresAt, documentNo }: {
  issuedAt: string;
  expiresAt?: string | null;
  documentNo?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          <span>ออกเมื่อ: {formatThaiDate(issuedAt)}</span>
        </div>
        {expiresAt && <span>หมดอายุ: {formatThaiDate(expiresAt)}</span>}
      </div>
      {documentNo && (
        <p className="text-[10px] text-muted-foreground font-mono">เลขที่เอกสาร: {documentNo}</p>
      )}
    </div>
  );
}

// ─── Practitioner Section ────────────────────────────────────────────────────
function PractitionerSection({ practitioner, role }: { practitioner: any; role?: string }) {
  if (!practitioner?.name) return null;
  const isFemale = practitioner.name?.includes("พญ.") || practitioner.name?.includes("นพญ.") || practitioner.gender === "female";
  // Determine avatar based on role keywords
  const isNurse = role?.includes("พยาบาล") || practitioner.role === "nurse";
  const isPharmacist = role?.includes("เภสัช") || practitioner.role === "pharmacist";
  const isRadiologist = role?.includes("รังสี") || practitioner.role === "radiologist";
  const isMedTech = role?.includes("เทคนิคการแพทย์") || role?.includes("นักเทคนิค") || practitioner.role === "med_tech";
  const practitionerAvatar = isNurse ? AVATAR_URLS.nurse 
    : isPharmacist ? AVATAR_URLS.pharmacist 
    : isRadiologist ? AVATAR_URLS.radiologist 
    : isMedTech ? AVATAR_URLS.medTech 
    : (isFemale ? AVATAR_URLS.doctorFemale : AVATAR_URLS.doctor);
  return (
    <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
      <SafeImage src={practitionerAvatar} alt="" className="h-12 w-12 rounded-full object-cover border-2 border-white shadow-sm" />
      <div>
        <p className="font-medium">{practitioner.name}</p>
        <p className="text-xs text-muted-foreground">
          {practitioner.licenseNo ? `ว.${practitioner.licenseNo}` : (role || "แพทย์ผู้ออกเอกสาร")}
        </p>
      </div>
    </div>
  );
}

// ─── Clinical Summary Section ────────────────────────────────────────────────
function ClinicalSummarySection({ conditions, allergies, medications }: {
  conditions: any[];
  allergies: string[];
  medications: any[];
}) {
  if (!conditions?.length && !allergies?.length && !medications?.length) return null;
  return (
    <div className="space-y-3">
      {conditions?.length > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <p className="text-xs font-semibold text-blue-800 mb-2 flex items-center gap-1.5">
            <Heart className="h-3.5 w-3.5" /> โรคประจำตัว / การวินิจฉัย
          </p>
          <div className="flex flex-wrap gap-1.5">
            {conditions.map((c: any, i: number) => (
              <span key={i} className="text-xs bg-blue-100 text-blue-800 rounded-lg px-2.5 py-1 font-medium">
                {typeof c === "string" ? c : c.display || c.code}
              </span>
            ))}
          </div>
        </div>
      )}
      {allergies?.length > 0 && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-4">
          <p className="text-xs font-semibold text-red-800 mb-2 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" /> การแพ้ยา / สารที่แพ้
          </p>
          <div className="flex flex-wrap gap-1.5">
            {allergies.map((a: string, i: number) => (
              <span key={i} className="text-xs bg-red-100 text-red-800 rounded-lg px-2.5 py-1 font-medium">
                {a}
              </span>
            ))}
          </div>
        </div>
      )}
      {medications?.length > 0 && (
        <div className="bg-green-50 border border-green-100 rounded-xl p-4">
          <p className="text-xs font-semibold text-green-800 mb-2 flex items-center gap-1.5">
            <Pill className="h-3.5 w-3.5" /> ยาที่ใช้ประจำ
          </p>
          <div className="flex flex-wrap gap-1.5">
            {medications.map((m: any, i: number) => (
              <span key={i} className="text-xs bg-green-100 text-green-800 rounded-lg px-2.5 py-1 font-medium">
                {typeof m === "string" ? m : m.name || m.code}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Patient Identity Card Template ───────────────────────────────────────────
function PatientIdentityCard({ props }: { props: CredentialRendererProps }) {
  const renderData = extractRenderData(props.credentialData);
  const brand = getHospitalBrand(renderData.hospital.code || props.hospitalCode);
  const gender = extractPatientGender(props.credentialData);
  const fallbackAvatarUrl = gender === "female" ? AVATAR_URLS.female : AVATAR_URLS.male;
  const avatarUrl = resolvePatientAvatarUrl({
    avatarUrl: props.patientPhotoUrl,
    gender,
    name: renderData.patient.fullNameTh || renderData.patient.fullNameEn,
  });
  const clinical = extractClinicalInfo(props.credentialData);

  return (
    <Card className="overflow-hidden border-0 shadow-2xl rounded-2xl">
      <DocumentHeader icon={Building2} title="บัตรประจำตัวผู้ป่วย" brand={brand} renderData={renderData} status={props.status} />
      <CardContent className="p-6">
        <div className="flex gap-5">
          <div className="shrink-0">
            <div className="h-32 w-24 rounded-xl overflow-hidden border-2 border-gray-200 shadow-lg ring-2 ring-offset-2 ring-gray-100">
              <SafeImage src={avatarUrl} fallbackSrc={fallbackAvatarUrl} alt="" className="h-full w-full object-cover" />
            </div>
          </div>
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

        {(clinical.conditions.length > 0 || clinical.allergies.length > 0) && (
          <>
            <Separator className="my-4" />
            <ClinicalSummarySection conditions={clinical.conditions} allergies={clinical.allergies} medications={[]} />
          </>
        )}

        <Separator className="my-4" />
        <DocumentFooter issuedAt={props.issuedAt} expiresAt={props.expiresAt} documentNo={renderData.document.no} />
      </CardContent>
    </Card>
  );
}

// ─── Medical Certificate Template ─────────────────────────────────────────────
function MedicalCertificateCard({ props }: { props: CredentialRendererProps }) {
  const renderData = extractRenderData(props.credentialData);
  const brand = getHospitalBrand(renderData.hospital.code || props.hospitalCode);
  const gender = extractPatientGender(props.credentialData);
  const clinical = extractClinicalInfo(props.credentialData);

  return (
    <Card className="overflow-hidden border-0 shadow-2xl rounded-2xl">
      <DocumentHeader icon={Stethoscope} title="ใบรับรองแพทย์" brand={brand} renderData={renderData} status={props.status} />
      <CardContent className="p-6 space-y-4">
        <PatientInfoSection renderData={renderData} showPhoto gender={gender} patientPhotoUrl={props.patientPhotoUrl} />
        <Separator />

        {clinical.diagnosisText && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-amber-800 mb-1 flex items-center gap-1">
              <Heart className="h-3.5 w-3.5" /> การวินิจฉัย
            </p>
            <p className="text-sm text-amber-900">{clinical.diagnosisText}</p>
          </div>
        )}

        {clinical.fitnessForWork && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-blue-800 mb-1">ความสามารถในการทำงาน</p>
            <Badge variant={clinical.fitnessForWork === "fit" ? "default" : "secondary"} className="text-sm">
              {clinical.fitnessForWork === "fit" ? "✓ สามารถทำงานได้ตามปกติ" :
               clinical.fitnessForWork === "unfit" ? "✗ ไม่สามารถทำงานได้" : "△ ทำงานได้จำกัด"}
            </Badge>
          </div>
        )}

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

        <PractitionerSection practitioner={clinical.practitioner} role="แพทย์ผู้ออกใบรับรอง" />
        <Separator />
        <DocumentFooter issuedAt={props.issuedAt} expiresAt={props.expiresAt} documentNo={renderData.document.no} />
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
      <DocumentHeader icon={Pill} title="ใบสั่งยา / PRESCRIPTION" brand={brand} renderData={renderData} status={props.status} />
      <CardContent className="p-6 space-y-4">
        <PatientInfoSection renderData={renderData} />
        <Separator />

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

        <PractitionerSection practitioner={clinical.prescriber} role="แพทย์ผู้สั่งยา" />
        <Separator />
        <DocumentFooter issuedAt={props.issuedAt} expiresAt={props.expiresAt} documentNo={renderData.document.no} />
      </CardContent>
    </Card>
  );
}

// ─── Lab Result Template ─────────────────────────────────────────────────────
function LabResultCard({ props }: { props: CredentialRendererProps }) {
  const renderData = extractRenderData(props.credentialData);
  const brand = getHospitalBrand(renderData.hospital.code || props.hospitalCode);
  const clinical = extractClinicalInfo(props.credentialData);

  return (
    <Card className="overflow-hidden border-0 shadow-2xl rounded-2xl">
      <DocumentHeader icon={FlaskConical} title="ผลตรวจทางห้องปฏิบัติการ" brand={brand} renderData={renderData} status={props.status} />
      <CardContent className="p-6 space-y-4">
        <PatientInfoSection renderData={renderData} />
        <Separator />

        {/* Lab Results Display */}
        <div className="bg-pink-50 border border-pink-100 rounded-xl p-4">
          <p className="text-xs font-semibold text-pink-800 mb-3 flex items-center gap-1.5">
            <FlaskConical className="h-3.5 w-3.5" /> ผลการตรวจ
          </p>
          <div className="space-y-2">
            <div className="flex items-center justify-between bg-white rounded-lg p-3 border border-pink-100">
              <div>
                <p className="font-medium text-sm">HbA1c (น้ำตาลสะสม)</p>
                <p className="text-xs text-muted-foreground">LOINC: 4548-4</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-lg text-pink-700">7.4%</p>
                <p className="text-[10px] text-muted-foreground">ค่าปกติ: 4.0-5.6%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Clinical context */}
        <ClinicalSummarySection conditions={clinical.conditions} allergies={clinical.allergies} medications={clinical.medicationsList} />

        <PractitionerSection practitioner={clinical.practitioner || { name: "พญ. อริสา กลิ่นใจ", licenseNo: "MD-TH-12345" }} role="แพทย์ผู้สั่งตรวจ" />
        <Separator />
        <DocumentFooter issuedAt={props.issuedAt} expiresAt={props.expiresAt} documentNo={renderData.document.no} />
      </CardContent>
    </Card>
  );
}

// ─── Immunization Template ───────────────────────────────────────────────────
function ImmunizationCard({ props }: { props: CredentialRendererProps }) {
  const renderData = extractRenderData(props.credentialData);
  const brand = getHospitalBrand(renderData.hospital.code || props.hospitalCode);

  return (
    <Card className="overflow-hidden border-0 shadow-2xl rounded-2xl">
      <DocumentHeader icon={Syringe} title="บันทึกการฉีดวัคซีน" brand={brand} renderData={renderData} status={props.status} />
      <CardContent className="p-6 space-y-4">
        <PatientInfoSection renderData={renderData} />
        <Separator />

        <div className="bg-lime-50 border border-lime-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-lime-800 mb-3 flex items-center gap-1.5">
            <Syringe className="h-3.5 w-3.5" /> ข้อมูลวัคซีน
          </p>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">ชนิดวัคซีน</span>
              <span className="text-sm">ตามบันทึกของสถานพยาบาล</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">สถานะ</span>
              <Badge className="bg-lime-100 text-lime-800 border-lime-200">ฉีดเรียบร้อย</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">วันที่ฉีด</span>
              <span className="text-sm">{formatThaiDate(props.issuedAt)}</span>
            </div>
          </div>
        </div>

        <PractitionerSection practitioner={{ name: "พญ. อริสา กลิ่นใจ", licenseNo: "MD-TH-12345" }} role="แพทย์ผู้ฉีดวัคซีน" />
        <Separator />
        <DocumentFooter issuedAt={props.issuedAt} expiresAt={props.expiresAt} documentNo={renderData.document.no} />
      </CardContent>
    </Card>
  );
}

// ─── Patient Summary Template ────────────────────────────────────────────────
function PatientSummaryCard({ props }: { props: CredentialRendererProps }) {
  const renderData = extractRenderData(props.credentialData);
  const brand = getHospitalBrand(renderData.hospital.code || props.hospitalCode);
  const gender = extractPatientGender(props.credentialData);
  const clinical = extractClinicalInfo(props.credentialData);

  return (
    <Card className="overflow-hidden border-0 shadow-2xl rounded-2xl">
      <DocumentHeader icon={ClipboardList} title="สรุปข้อมูลผู้ป่วย" brand={brand} renderData={renderData} status={props.status} />
      <CardContent className="p-6 space-y-4">
        <PatientInfoSection renderData={renderData} showPhoto gender={gender} patientPhotoUrl={props.patientPhotoUrl} />
        <Separator />
        <ClinicalSummarySection conditions={clinical.conditions} allergies={clinical.allergies} medications={clinical.medicationsList} />
        <PractitionerSection practitioner={clinical.practitioner || { name: "พญ. อริสา กลิ่นใจ", licenseNo: "MD-TH-12345" }} role="แพทย์เจ้าของไข้" />
        <Separator />
        <DocumentFooter issuedAt={props.issuedAt} expiresAt={props.expiresAt} documentNo={renderData.document.no} />
      </CardContent>
    </Card>
  );
}

// ─── Allergy Alert Template ──────────────────────────────────────────────────
function AllergyAlertCard({ props }: { props: CredentialRendererProps }) {
  const renderData = extractRenderData(props.credentialData);
  const brand = getHospitalBrand(renderData.hospital.code || props.hospitalCode);
  const clinical = extractClinicalInfo(props.credentialData);

  return (
    <Card className="overflow-hidden border-0 shadow-2xl rounded-2xl">
      <DocumentHeader icon={AlertTriangle} title="แจ้งเตือนการแพ้ยา" brand={{ ...brand, gradient: "from-red-700 to-red-500" }} renderData={renderData} status={props.status} />
      <CardContent className="p-6 space-y-4">
        <PatientInfoSection renderData={renderData} />
        <Separator />

        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-5">
          <p className="text-sm font-bold text-red-800 mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> ข้อมูลการแพ้ยา — กรุณาแจ้งแพทย์ทุกครั้ง
          </p>
          {clinical.allergies?.length > 0 ? (
            <div className="space-y-2">
              {clinical.allergies.map((a: string, i: number) => (
                <div key={i} className="flex items-center gap-2 bg-white rounded-lg p-3 border border-red-100">
                  <Shield className="h-4 w-4 text-red-600 shrink-0" />
                  <span className="font-medium text-red-900">{a}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-red-700">ไม่พบข้อมูลการแพ้ยาในระบบ</p>
          )}
        </div>

        <PractitionerSection practitioner={clinical.practitioner || { name: "พญ. อริสา กลิ่นใจ", licenseNo: "MD-TH-12345" }} role="แพทย์ผู้บันทึก" />
        <Separator />
        <DocumentFooter issuedAt={props.issuedAt} expiresAt={props.expiresAt} documentNo={renderData.document.no} />
      </CardContent>
    </Card>
  );
}

// ─── Medication Summary Template ─────────────────────────────────────────────
function MedicationSummaryCard({ props }: { props: CredentialRendererProps }) {
  const renderData = extractRenderData(props.credentialData);
  const brand = getHospitalBrand(renderData.hospital.code || props.hospitalCode);
  const clinical = extractClinicalInfo(props.credentialData);

  return (
    <Card className="overflow-hidden border-0 shadow-2xl rounded-2xl">
      <DocumentHeader icon={Pill} title="สรุปรายการยา" brand={{ ...brand, gradient: "from-green-700 to-green-500" }} renderData={renderData} status={props.status} />
      <CardContent className="p-6 space-y-4">
        <PatientInfoSection renderData={renderData} />
        <Separator />

        <div className="bg-green-50 border border-green-100 rounded-xl p-4">
          <p className="text-xs font-semibold text-green-800 mb-3 flex items-center gap-1.5">
            <Pill className="h-3.5 w-3.5" /> รายการยาที่ใช้ประจำ
          </p>
          {clinical.medicationsList?.length > 0 ? (
            <div className="space-y-2">
              {clinical.medicationsList.map((med: any, i: number) => (
                <div key={i} className="flex items-center gap-3 bg-white rounded-lg p-3 border border-green-100">
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                  <span className="font-medium text-sm">{med.name || med.code}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">ไม่มีข้อมูลรายการยา</p>
          )}
        </div>

        <PractitionerSection practitioner={clinical.practitioner || { name: "พญ. อริสา กลิ่นใจ", licenseNo: "MD-TH-12345" }} role="แพทย์ผู้สั่งยา" />
        <Separator />
        <DocumentFooter issuedAt={props.issuedAt} expiresAt={props.expiresAt} documentNo={renderData.document.no} />
      </CardContent>
    </Card>
  );
}

// ─── Referral Template ───────────────────────────────────────────────────────
function ReferralCard({ props }: { props: CredentialRendererProps }) {
  const renderData = extractRenderData(props.credentialData);
  const brand = getHospitalBrand(renderData.hospital.code || props.hospitalCode);
  const clinical = extractClinicalInfo(props.credentialData);

  return (
    <Card className="overflow-hidden border-0 shadow-2xl rounded-2xl">
      <DocumentHeader icon={ArrowRightLeft} title="ใบส่งต่อผู้ป่วย / REFERRAL" brand={{ ...brand, gradient: "from-blue-700 to-blue-500" }} renderData={renderData} status={props.status} />
      <CardContent className="p-6 space-y-4">
        <PatientInfoSection renderData={renderData} />
        <Separator />

        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <p className="text-xs font-semibold text-blue-800 mb-2 flex items-center gap-1.5">
            <ArrowRightLeft className="h-3.5 w-3.5" /> ข้อมูลการส่งต่อ
          </p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">จากสถานพยาบาล</span>
              <span className="font-medium">{renderData.hospital.nameTh}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">เหตุผลการส่งต่อ</span>
              <span className="font-medium">ต้องการการดูแลเฉพาะทาง</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">ระดับความเร่งด่วน</span>
              <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200">ปานกลาง</Badge>
            </div>
          </div>
        </div>

        <ClinicalSummarySection conditions={clinical.conditions} allergies={clinical.allergies} medications={clinical.medicationsList} />
        <PractitionerSection practitioner={clinical.practitioner || { name: "พญ. อริสา กลิ่นใจ", licenseNo: "MD-TH-12345" }} role="แพทย์ผู้ส่งต่อ" />
        <Separator />
        <DocumentFooter issuedAt={props.issuedAt} expiresAt={props.expiresAt} documentNo={renderData.document.no} />
      </CardContent>
    </Card>
  );
}

// ─── Discharge Summary Template ──────────────────────────────────────────────
function DischargeSummaryCard({ props }: { props: CredentialRendererProps }) {
  const renderData = extractRenderData(props.credentialData);
  const brand = getHospitalBrand(renderData.hospital.code || props.hospitalCode);
  const clinical = extractClinicalInfo(props.credentialData);

  return (
    <Card className="overflow-hidden border-0 shadow-2xl rounded-2xl">
      <DocumentHeader icon={FileCheck} title="สรุปจำหน่ายผู้ป่วย" brand={{ ...brand, gradient: "from-slate-700 to-slate-500" }} renderData={renderData} status={props.status} />
      <CardContent className="p-6 space-y-4">
        <PatientInfoSection renderData={renderData} />
        <Separator />

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
            <FileCheck className="h-3.5 w-3.5" /> สรุปการรักษา
          </p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">สถานะจำหน่าย</span>
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">จำหน่ายกลับบ้าน</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">วันที่จำหน่าย</span>
              <span className="font-medium">{formatThaiDate(props.issuedAt)}</span>
            </div>
          </div>
        </div>

        <ClinicalSummarySection conditions={clinical.conditions} allergies={clinical.allergies} medications={clinical.medicationsList} />
        <PractitionerSection practitioner={clinical.practitioner || { name: "พญ. อริสา กลิ่นใจ", licenseNo: "MD-TH-12345" }} role="แพทย์เจ้าของไข้" />
        <Separator />
        <DocumentFooter issuedAt={props.issuedAt} expiresAt={props.expiresAt} documentNo={renderData.document.no} />
      </CardContent>
    </Card>
  );
}

// ─── Insurance Eligibility Template ──────────────────────────────────────────
function InsuranceEligibilityCard({ props }: { props: CredentialRendererProps }) {
  const renderData = extractRenderData(props.credentialData);
  const brand = getHospitalBrand(renderData.hospital.code || props.hospitalCode);

  return (
    <Card className="overflow-hidden border-0 shadow-2xl rounded-2xl">
      <DocumentHeader icon={CreditCard} title="สิทธิ์ประกันสุขภาพ" brand={{ ...brand, gradient: "from-amber-700 to-amber-500" }} renderData={renderData} status={props.status} />
      <CardContent className="p-6 space-y-4">
        <PatientInfoSection renderData={renderData} />
        <Separator />

        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
          <p className="text-xs font-semibold text-amber-800 mb-3 flex items-center gap-1.5">
            <CreditCard className="h-3.5 w-3.5" /> ข้อมูลสิทธิ์การรักษา
          </p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">สถานะสิทธิ์</span>
              <Badge className="bg-emerald-100 text-emerald-800">ใช้งานได้</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">ประเภทสิทธิ์</span>
              <span className="font-medium">ประกันสุขภาพ</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">ระยะเวลาคุ้มครอง</span>
              <span className="font-medium">{formatThaiDate(props.issuedAt)} - {props.expiresAt ? formatThaiDate(props.expiresAt) : "ไม่จำกัด"}</span>
            </div>
          </div>
        </div>

        <Separator />
        <DocumentFooter issuedAt={props.issuedAt} expiresAt={props.expiresAt} documentNo={renderData.document.no} />
      </CardContent>
    </Card>
  );
}

// ─── Consent Receipt Template ────────────────────────────────────────────────
function ConsentReceiptCard({ props }: { props: CredentialRendererProps }) {
  const renderData = extractRenderData(props.credentialData);
  const brand = getHospitalBrand(renderData.hospital.code || props.hospitalCode);
  const subject = props.credentialData?.credentialSubject || props.credentialData;

  const scopes = subject?.scopes || [];
  const purpose = subject?.purpose || "การรักษาพยาบาล";
  const status = subject?.status || "granted";

  const scopeLabels: Record<string, string> = {
    "Patient.read": "ข้อมูลผู้ป่วย",
    "Condition.read": "โรคประจำตัว",
    "AllergyIntolerance.read": "การแพ้ยา",
    "Medication.read": "ยาที่ใช้",
    "Observation.read": "ผลตรวจ",
    "DocumentReference.read": "เอกสารทางการแพทย์",
  };

  const purposeLabels: Record<string, string> = {
    referral: "การส่งต่อผู้ป่วย",
    claim: "การเคลมประกัน",
    insurance: "การตรวจสอบสิทธิ์ประกัน",
    medical_tourism: "การท่องเที่ยวเชิงการแพทย์",
    treatment: "การรักษาพยาบาล",
  };

  return (
    <Card className="overflow-hidden border-0 shadow-2xl rounded-2xl">
      <DocumentHeader icon={Shield} title="ใบยินยอมเปิดเผยข้อมูล (Consent)" brand={{ ...brand, gradient: "from-violet-700 to-violet-500" }} renderData={renderData} status={props.status} />
      <CardContent className="p-6 space-y-4">
        <PatientInfoSection renderData={renderData} />
        <Separator />

        <div className="bg-violet-50 border border-violet-100 rounded-xl p-4">
          <p className="text-xs font-semibold text-violet-800 mb-3 flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" /> รายละเอียดความยินยอม
          </p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">วัตถุประสงค์</span>
              <span className="font-medium">{purposeLabels[purpose] || purpose}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">สถานะ</span>
              <Badge className={status === "granted" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}>
                {status === "granted" ? "อนุญาตแล้ว" : "ยกเลิก"}
              </Badge>
            </div>
          </div>
        </div>

        {scopes.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">ขอบเขตข้อมูลที่อนุญาต</p>
            <div className="grid grid-cols-2 gap-2">
              {scopes.map((scope: string, i: number) => (
                <div key={i} className="flex items-center gap-2 text-xs bg-muted/30 rounded-lg p-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-violet-600 shrink-0" />
                  <span>{scopeLabels[scope] || scope}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <Separator />
        <DocumentFooter issuedAt={props.issuedAt} expiresAt={props.expiresAt} documentNo={renderData.document.no} />
      </CardContent>
    </Card>
  );
}

// ─── Travel Document Verification Template ───────────────────────────────────
function TravelDocumentCard({ props }: { props: CredentialRendererProps }) {
  const renderData = extractRenderData(props.credentialData);
  const brand = getHospitalBrand(renderData.hospital.code || props.hospitalCode);

  return (
    <Card className="overflow-hidden border-0 shadow-2xl rounded-2xl">
      <DocumentHeader icon={Plane} title="ตรวจสอบเอกสารเดินทาง" brand={{ ...brand, gradient: "from-sky-700 to-sky-500" }} renderData={renderData} status={props.status} />
      <CardContent className="p-6 space-y-4">
        <PatientInfoSection renderData={renderData} />
        <Separator />

        <div className="bg-sky-50 border border-sky-100 rounded-xl p-4">
          <p className="text-xs font-semibold text-sky-800 mb-2 flex items-center gap-1.5">
            <Plane className="h-3.5 w-3.5" /> ข้อมูลเอกสารเดินทาง
          </p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">สถานะการตรวจสอบ</span>
              <Badge className="bg-emerald-100 text-emerald-800">ผ่านการตรวจสอบ</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">ประเภท</span>
              <span className="font-medium">Medical Tourism</span>
            </div>
          </div>
        </div>

        <Separator />
        <DocumentFooter issuedAt={props.issuedAt} expiresAt={props.expiresAt} documentNo={renderData.document.no} />
      </CardContent>
    </Card>
  );
}

// ─── Claim Package / Receipt Template ────────────────────────────────────────
function ClaimCard({ props }: { props: CredentialRendererProps }) {
  const renderData = extractRenderData(props.credentialData);
  const brand = getHospitalBrand(renderData.hospital.code || props.hospitalCode);
  const isReceipt = props.type === "claim_receipt";

  return (
    <Card className="overflow-hidden border-0 shadow-2xl rounded-2xl">
      <DocumentHeader
        icon={FileText}
        title={isReceipt ? "ใบตอบรับเคลม" : "แพ็คเกจเคลมประกัน"}
        brand={{ ...brand, gradient: "from-orange-700 to-orange-500" }}
        renderData={renderData}
        status={props.status}
      />
      <CardContent className="p-6 space-y-4">
        <PatientInfoSection renderData={renderData} />
        <Separator />

        <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
          <p className="text-xs font-semibold text-orange-800 mb-2 flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" /> {isReceipt ? "ข้อมูลการตอบรับ" : "ข้อมูลเคลม"}
          </p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">สถานะ</span>
              <Badge className="bg-emerald-100 text-emerald-800">{isReceipt ? "ตอบรับแล้ว" : "ส่งเรียบร้อย"}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">วันที่ดำเนินการ</span>
              <span className="font-medium">{formatThaiDate(props.issuedAt)}</span>
            </div>
          </div>
        </div>

        <Separator />
        <DocumentFooter issuedAt={props.issuedAt} expiresAt={props.expiresAt} documentNo={renderData.document.no} />
      </CardContent>
    </Card>
  );
}

// ─── MPI Link Certificate Template ───────────────────────────────────────────
function MpiLinkCard({ props }: { props: CredentialRendererProps }) {
  const renderData = extractRenderData(props.credentialData);
  const brand = getHospitalBrand(renderData.hospital.code || props.hospitalCode);

  return (
    <Card className="overflow-hidden border-0 shadow-2xl rounded-2xl">
      <DocumentHeader icon={User} title="ใบเชื่อมโยงตัวตน (MPI)" brand={{ ...brand, gradient: "from-cyan-700 to-cyan-500" }} renderData={renderData} status={props.status} />
      <CardContent className="p-6 space-y-4">
        <PatientInfoSection renderData={renderData} />
        <Separator />

        <div className="bg-cyan-50 border border-cyan-100 rounded-xl p-4">
          <p className="text-xs font-semibold text-cyan-800 mb-2 flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" /> การเชื่อมโยงตัวตนข้ามสถานพยาบาล
          </p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">สถานะ</span>
              <Badge className="bg-emerald-100 text-emerald-800">เชื่อมโยงสำเร็จ</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">CarePass ID</span>
              <span className="font-mono text-xs font-medium">{renderData.patient.carepassId || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">HN ต้นทาง</span>
              <span className="font-mono text-xs font-medium">{renderData.patient.hn || "—"}</span>
            </div>
          </div>
        </div>

        <Separator />
        <DocumentFooter issuedAt={props.issuedAt} expiresAt={props.expiresAt} documentNo={renderData.document.no} />
      </CardContent>
    </Card>
  );
}

// ─── Generic Fallback Template (for types without specific template) ─────────
function GenericDocumentCard({ props }: { props: CredentialRendererProps }) {
  const renderData = extractRenderData(props.credentialData);
  const brand = getHospitalBrand(renderData.hospital.code || props.hospitalCode);
  const clinical = extractClinicalInfo(props.credentialData);
  
  const typeConfig: Record<string, { icon: typeof FileText; label: string; color: string }> = {
    sync_receipt: { icon: Activity, label: "ใบตอบรับ Sync ข้อมูล", color: "from-gray-700 to-gray-500" },
    shl_manifest: { icon: FileText, label: "Smart Health Link", color: "from-emerald-700 to-emerald-500" },
    diagnostic_report: { icon: ClipboardList, label: "รายงานการวินิจฉัย", color: "from-rose-700 to-rose-500" },
    pharmacy_dispense: { icon: Pill, label: "ใบจ่ายยา", color: "from-teal-700 to-teal-500" },
    appointment: { icon: Clock, label: "นัดหมาย", color: "from-purple-700 to-purple-500" },
    visa_support_letter: { icon: Plane, label: "หนังสือรับรองเพื่อวีซ่า", color: "from-blue-800 to-blue-600" },
    quotation: { icon: CreditCard, label: "ใบเสนอราคา", color: "from-yellow-700 to-yellow-500" },
    guarantee_letter: { icon: Shield, label: "หนังสือค้ำประกัน", color: "from-emerald-800 to-emerald-600" },
  };
  
  const config = typeConfig[props.type] || { icon: FileText, label: props.type.replace(/_/g, " "), color: brand.gradient };
  const Icon = config.icon;

  return (
    <Card className="overflow-hidden border-0 shadow-2xl rounded-2xl">
      <DocumentHeader icon={Icon} title={config.label} brand={{ ...brand, gradient: config.color }} renderData={renderData} status={props.status} />
      <CardContent className="p-6 space-y-4">
        <PatientInfoSection renderData={renderData} />
        <Separator />

        {/* Show clinical info if available */}
        {(clinical.conditions?.length > 0 || clinical.allergies?.length > 0 || clinical.medicationsList?.length > 0) && (
          <>
            <ClinicalSummarySection conditions={clinical.conditions} allergies={clinical.allergies} medications={clinical.medicationsList} />
            <Separator />
          </>
        )}

        {/* Simple status card for generic types */}
        <div className="bg-muted/30 border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span className="font-medium">เอกสารนี้ได้รับการรับรองโดย {renderData.hospital.nameTh || brand.logo}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            ออกเมื่อ {formatThaiDate(props.issuedAt)} — ตรวจสอบความถูกต้องได้ผ่าน QR Code
          </p>
        </div>

        <DocumentFooter issuedAt={props.issuedAt} expiresAt={props.expiresAt} documentNo={renderData.document.no} />
      </CardContent>
    </Card>
  );
}

// ─── Watermark Overlay ──────────────────────────────────────────────────────
function CopyWatermark() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-10 select-none" aria-hidden="true">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="rotate-[-30deg] opacity-[0.06]">
          <p className="text-[4rem] font-bold text-gray-900 whitespace-nowrap tracking-[0.2em] leading-none">สำเนา</p>
          <p className="text-[1.5rem] font-medium text-gray-900 text-center mt-2 tracking-wider">COPY</p>
        </div>
      </div>
      {/* Repeated watermark pattern for larger documents */}
      <div className="absolute top-[15%] left-[10%] rotate-[-30deg] opacity-[0.04]">
        <p className="text-[2.5rem] font-bold text-gray-900 whitespace-nowrap">สำเนา</p>
      </div>
      <div className="absolute bottom-[15%] right-[10%] rotate-[-30deg] opacity-[0.04]">
        <p className="text-[2.5rem] font-bold text-gray-900 whitespace-nowrap">สำเนา</p>
      </div>
    </div>
  );
}

// ─── Main Renderer ────────────────────────────────────────────────────────────
export function CredentialRenderer(props: CredentialRendererProps) {
  const { type } = props;

  let content: React.ReactNode;
  switch (type) {
    case "patient_identity": content = <PatientIdentityCard props={props} />; break;
    case "medical_certificate": content = <MedicalCertificateCard props={props} />; break;
    case "prescription": content = <PrescriptionCard props={props} />; break;
    case "lab_result": content = <LabResultCard props={props} />; break;
    case "immunization": content = <ImmunizationCard props={props} />; break;
    case "patient_summary": content = <PatientSummaryCard props={props} />; break;
    case "allergy_alert": content = <AllergyAlertCard props={props} />; break;
    case "medication_summary": content = <MedicationSummaryCard props={props} />; break;
    case "referral_vc": content = <ReferralCard props={props} />; break;
    case "discharge_summary": content = <DischargeSummaryCard props={props} />; break;
    case "insurance_eligibility": content = <InsuranceEligibilityCard props={props} />; break;
    case "consent_receipt": content = <ConsentReceiptCard props={props} />; break;
    case "travel_document_verification": content = <TravelDocumentCard props={props} />; break;
    case "claim_package":
    case "claim_receipt": content = <ClaimCard props={props} />; break;
    case "mpi_link_certificate": content = <MpiLinkCard props={props} />; break;
    default: content = <GenericDocumentCard props={props} />; break;
  }

  return (
    <div className="relative">
      <CopyWatermark />
      {content}
    </div>
  );
}

// ─── Compact Card (for Wallet list) ──────────────────────────────────────────
export function CredentialCompactCard({ props }: { props: CredentialRendererProps }) {
  const renderData = extractRenderData(props.credentialData);
  const brand = getHospitalBrand(renderData.hospital.code || props.hospitalCode);
  const gender = extractPatientGender(props.credentialData);
  const needsPhoto = ["patient_identity", "medical_certificate"].includes(props.type);
  const fallbackAvatarUrl = gender === "female" ? AVATAR_URLS.female : AVATAR_URLS.male;
  const avatarUrl = resolvePatientAvatarUrl({
    avatarUrl: props.patientPhotoUrl,
    gender,
    name: renderData.patient.fullNameTh || renderData.patient.fullNameEn,
  });

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
    claim_receipt: "ใบตอบรับเคลม",
    travel_document_verification: "เอกสารเดินทาง",
    pharmacy_dispense: "ใบจ่ายยา",
    appointment: "นัดหมาย",
    diagnostic_report: "รายงานวินิจฉัย",
    visa_support_letter: "หนังสือรับรองวีซ่า",
    quotation: "ใบเสนอราคา",
    guarantee_letter: "หนังสือค้ำประกัน",
    sync_receipt: "ใบตอบรับ Sync",
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border bg-card hover:shadow-lg transition-all duration-200 cursor-pointer group">
      {needsPhoto ? (
        <div className="h-12 w-10 rounded-lg overflow-hidden border-2 border-gray-200 shadow-sm shrink-0 group-hover:border-primary/30 transition-colors">
          <SafeImage src={avatarUrl} fallbackSrc={fallbackAvatarUrl} alt="" className="h-full w-full object-cover" />
        </div>
      ) : (
        <div className={`h-11 w-11 rounded-xl bg-gradient-to-br ${brand.gradient} flex items-center justify-center shrink-0 shadow-sm`}>
          <FileText className="h-5 w-5 text-white" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{typeLabels[props.type] || props.type.replace(/_/g, " ")}</p>
        <p className="text-xs text-muted-foreground truncate">
          {renderData.hospital.nameTh || props.hospitalName || brand.logo}
        </p>
      </div>

      <StatusBadge status={props.status} />
    </div>
  );
}

export default CredentialRenderer;
