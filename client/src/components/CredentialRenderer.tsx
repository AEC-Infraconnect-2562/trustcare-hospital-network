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
  AlertTriangle,
  CheckCircle2,
  ArrowRightLeft,
  FileCheck,
  Clock,
} from "lucide-react";
import { PersonPhoto } from "@/components/PersonPhoto";
import { patientPhotoSources, practitionerPhotoSources } from "@shared/personImages";

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
function PatientInfoSection({ renderData, showPhoto, gender, patientPhotoUrl, credentialData }: {
  renderData: ReturnType<typeof extractRenderData>;
  showPhoto?: boolean;
  gender?: "male" | "female";
  patientPhotoUrl?: string | null;
  credentialData?: any;
}) {
  const photoSources = patientPhotoSources({ primaryUrl: patientPhotoUrl, credentialData, gender });
  return (
    <div className="flex gap-4 items-start">
      {showPhoto && (
        <div className="h-20 w-16 rounded-xl overflow-hidden border-2 border-gray-200 shadow-md shrink-0 bg-muted flex items-center justify-center">
          <PersonPhoto
            sources={photoSources}
            alt=""
            className="h-full w-full object-cover"
            fallback={<User className="h-6 w-6 text-muted-foreground" />}
          />
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
  const practitionerRole = isNurse ? "nurse"
    : isPharmacist ? "pharmacist"
    : isRadiologist ? "radiologist"
    : isMedTech ? "med_tech"
    : practitioner.role || role;
  const photoSources = practitionerPhotoSources({
    primaryUrl: practitioner.avatarUrl || practitioner.photoUrl || practitioner.profilePhotoUrl,
    practitioner,
    role: practitionerRole,
    gender: isFemale ? "female" : "male",
  });
  return (
    <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
      <div className="h-12 w-12 rounded-full overflow-hidden border-2 border-white shadow-sm bg-muted flex items-center justify-center shrink-0">
        <PersonPhoto
          sources={photoSources}
          alt=""
          className="h-full w-full object-cover"
          fallback={<User className="h-5 w-5 text-muted-foreground" />}
        />
      </div>
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

// ─── Staff Identity Card Template ────────────────────────────────────────────
function StaffIdentityCard({ props }: { props: CredentialRendererProps }) {
  const credData = props.credentialData || {};
  const subject = credData?.credentialSubject || credData;
  const renderData = extractRenderData(credData);
  const humanDoc = credData?.humanDocument || {};
  const staffRender = humanDoc?.renderData?.staff || {};

  // Extract staff-specific fields
  const fullNameTh = staffRender.fullNameTh || subject?.fullNameTh || subject?.staffId || "—";
  const position = staffRender.position || subject?.position || "เจ้าหน้าที่";
  const positionEn = staffRender.positionEn || subject?.positionEn || "Staff";
  const licenseNo = staffRender.licenseNo || subject?.licenseNo;
  const hospitalCode = renderData.hospital.code || subject?.hospitalCode || props.hospitalCode || "";
  const hospitalNameTh = renderData.hospital.nameTh || subject?.hospitalNameTh || subject?.hospitalName || props.hospitalName || "TrustCare Network";
  const hospitalNameEn = renderData.hospital.nameEn || subject?.hospitalName || "";
  const systemRole = subject?.systemRole || "";
  const employeeId = humanDoc?.renderData?.document?.no || subject?.staffId || "—";
  const department = subject?.department || "";
  const email = subject?.email || "";
  const phone = subject?.phone || "";

  const brand = getHospitalBrand(hospitalCode);

  // Determine gender from name prefix for photo
  const isFemale = fullNameTh.startsWith("นาง") || fullNameTh.startsWith("พญ.") || fullNameTh.includes("Ms.") || fullNameTh.includes("Mrs.");
  const photoSources = practitionerPhotoSources({
    primaryUrl: props.patientPhotoUrl,
    practitioner: { name: fullNameTh, role: systemRole },
    role: systemRole,
    gender: isFemale ? "female" : "male",
  });

  return (
    <Card className="overflow-hidden border-0 shadow-2xl rounded-2xl">
      {/* Header */}
      <div className={`bg-gradient-to-r ${brand.gradient} p-6 text-white relative overflow-hidden`}>
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-12 translate-x-12" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-6 -translate-x-6" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs opacity-70 tracking-wider uppercase">บัตรประจำตัวเจ้าหน้าที่</p>
              <p className="font-bold text-lg">{hospitalNameTh}</p>
              {hospitalNameEn && <p className="text-xs opacity-70">{hospitalNameEn}</p>}
            </div>
          </div>
          <StatusBadge status={props.status} />
        </div>
      </div>

      {/* Body */}
      <CardContent className="p-6">
        <div className="flex gap-5">
          {/* Photo */}
          <div className="shrink-0">
            <div className="h-32 w-24 rounded-xl overflow-hidden border-2 border-gray-200 shadow-lg ring-2 ring-offset-2 ring-gray-100 bg-muted flex items-center justify-center">
              <PersonPhoto
                sources={photoSources}
                alt=""
                className="h-full w-full object-cover"
                fallback={<User className="h-8 w-8 text-muted-foreground" />}
              />
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 space-y-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">ชื่อ-นามสกุล</p>
              <p className="font-bold text-xl leading-tight">{fullNameTh}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/40 rounded-lg p-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">ตำแหน่ง</p>
                <p className="text-sm font-bold">{position}</p>
                {positionEn && <p className="text-[10px] text-muted-foreground">{positionEn}</p>}
              </div>
              <div className="bg-muted/40 rounded-lg p-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">รหัสพนักงาน</p>
                <p className="font-mono text-xs font-bold">{employeeId}</p>
              </div>
            </div>
            {licenseNo && (
              <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-2">
                <p className="text-[10px] uppercase tracking-wider text-emerald-700">เลขที่ใบอนุญาต</p>
                <p className="font-mono text-sm font-bold text-emerald-800">{licenseNo}</p>
              </div>
            )}
          </div>
        </div>

        {/* Additional Info */}
        {(department || email || phone) && (
          <>
            <Separator className="my-4" />
            <div className="grid grid-cols-2 gap-3 text-sm">
              {department && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">แผนก</p>
                  <p className="font-medium">{department}</p>
                </div>
              )}
              {email && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">อีเมล</p>
                  <p className="font-medium text-xs">{email}</p>
                </div>
              )}
              {phone && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">โทรศัพท์</p>
                  <p className="font-medium">{phone}</p>
                </div>
              )}
            </div>
          </>
        )}

        <Separator className="my-4" />
        <DocumentFooter
          issuedAt={props.issuedAt}
          expiresAt={props.expiresAt}
          documentNo={humanDoc?.renderData?.document?.no || employeeId}
        />
      </CardContent>
    </Card>
  );
}

// ─── Patient Identity Card Template ───────────────────────────────────────────
function PatientIdentityCard({ props }: { props: CredentialRendererProps }) {
  const renderData = extractRenderData(props.credentialData);
  const brand = getHospitalBrand(renderData.hospital.code || props.hospitalCode);
  const gender = extractPatientGender(props.credentialData);
  const photoSources = patientPhotoSources({
    primaryUrl: props.patientPhotoUrl,
    credentialData: props.credentialData,
    gender,
  });
  const clinical = extractClinicalInfo(props.credentialData);

  return (
    <Card className="overflow-hidden border-0 shadow-2xl rounded-2xl">
      <DocumentHeader icon={Building2} title="บัตรประจำตัวผู้ป่วย" brand={brand} renderData={renderData} status={props.status} />
      <CardContent className="p-6">
        <div className="flex gap-5">
          <div className="shrink-0">
            <div className="h-32 w-24 rounded-xl overflow-hidden border-2 border-gray-200 shadow-lg ring-2 ring-offset-2 ring-gray-100 bg-muted flex items-center justify-center">
              <PersonPhoto
                sources={photoSources}
                alt=""
                className="h-full w-full object-cover"
                fallback={<User className="h-8 w-8 text-muted-foreground" />}
              />
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
        <PatientInfoSection renderData={renderData} showPhoto gender={gender} patientPhotoUrl={props.patientPhotoUrl} credentialData={props.credentialData} />
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
  const subject = props.credentialData?.credentialSubject || props.credentialData;
  const observations: any[] = subject?.observations || [];
  const specimen = subject?.specimen || {};
  const orderingPractitioner = subject?.orderingPractitioner || subject?.verifiedBy || {};
  const performedBy = subject?.performedBy || {};
  const reportStatus = subject?.reportStatus || "final";
  const clinicalNote = subject?.clinicalNote || "";

  return (
    <Card className="overflow-hidden border-0 shadow-2xl rounded-2xl">
      <DocumentHeader icon={FlaskConical} title="ผลตรวจทางห้องปฏิบัติการ" brand={brand} renderData={renderData} status={props.status} />
      <CardContent className="p-6 space-y-4">
        <PatientInfoSection renderData={renderData} />
        <Separator />

        {/* Specimen Info */}
        {specimen.accessionNo && (
          <div className="flex items-center gap-4 text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
            <span>Accession: <span className="font-mono font-medium text-foreground">{specimen.accessionNo}</span></span>
            {specimen.collectedAt && <span>เก็บตัวอย่าง: {formatThaiDate(specimen.collectedAt)}</span>}
            <span className="ml-auto">สถานะ: <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">{reportStatus}</Badge></span>
          </div>
        )}

        {/* Lab Results Display */}
        <div className="bg-pink-50 border border-pink-100 rounded-xl p-4">
          <p className="text-xs font-semibold text-pink-800 mb-3 flex items-center gap-1.5">
            <FlaskConical className="h-3.5 w-3.5" /> ผลการตรวจ ({observations.length} รายการ)
          </p>
          <div className="space-y-2">
            {observations.map((obs: any, i: number) => (
              <div key={i} className="flex items-center justify-between bg-white rounded-lg p-3 border border-pink-100">
                <div>
                  <p className="font-medium text-sm">{obs.nameTh || obs.name}</p>
                  <p className="text-xs text-muted-foreground">LOINC: {obs.loincCode} • {obs.category}</p>
                </div>
                <div className="text-right">
                  <p className={`font-bold text-lg ${obs.interpretation === "normal" ? "text-emerald-700" : "text-pink-700"}`}>
                    {obs.value}{obs.unit}
                  </p>
                  {obs.referenceRange && <p className="text-[10px] text-muted-foreground">ค่าปกติ: {obs.referenceRange}</p>}
                </div>
              </div>
            ))}
            {observations.length === 0 && <p className="text-sm text-muted-foreground italic">ไม่มีข้อมูลผลตรวจ</p>}
          </div>
        </div>

        {clinicalNote && (
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
            <p className="text-xs font-semibold text-blue-800 mb-1">หมายเหตุทางคลินิก</p>
            <p className="text-sm text-blue-900">{clinicalNote}</p>
          </div>
        )}

        <PractitionerSection practitioner={orderingPractitioner} role="แพทย์ผู้สั่งตรวจ" />
        {performedBy?.name && <PractitionerSection practitioner={performedBy} role="นักเทคนิคการแพทย์" />}
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
  const subject = props.credentialData?.credentialSubject || props.credentialData;
  const vaccine = subject?.vaccine || {};
  const administeredBy = subject?.administeredBy || {};
  const doseNumber = subject?.doseNumber || 1;
  const route = subject?.route || "";
  const site = subject?.siteTh || subject?.site || "";
  const seriesName = subject?.seriesName || "";
  const nextDoseDate = subject?.nextDoseDate || "";
  const adverseReaction = subject?.adverseReactionTh || subject?.adverseReaction || "";
  const administrationDate = subject?.administrationDate || props.issuedAt;

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
              <span className="text-sm font-bold">{vaccine.nameTh || vaccine.name || "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">ผู้ผลิต</span>
              <span className="text-sm">{vaccine.manufacturer || "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Lot Number</span>
              <span className="font-mono text-xs">{vaccine.lotNumber || "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">เข็มที่</span>
              <Badge className="bg-lime-100 text-lime-800 border-lime-200">เข็มที่ {doseNumber} ({seriesName})</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">วันที่ฉีด</span>
              <span className="text-sm">{formatThaiDate(administrationDate)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">ตำแหน่งที่ฉีด</span>
              <span className="text-sm">{site} ({route})</span>
            </div>
            {nextDoseDate && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">นัดฉีดครั้งถัดไป</span>
                <span className="text-sm text-blue-700 font-medium">{formatThaiDate(nextDoseDate)}</span>
              </div>
            )}
          </div>
        </div>

        {adverseReaction && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-amber-800 mb-1">อาการข้างเคียง</p>
            <p className="text-sm text-amber-900">{adverseReaction}</p>
          </div>
        )}

        <PractitionerSection practitioner={administeredBy} role="แพทย์ผู้ฉีดวัคซีน" />
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
        <PatientInfoSection renderData={renderData} showPhoto gender={gender} patientPhotoUrl={props.patientPhotoUrl} credentialData={props.credentialData} />
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
  const subject = props.credentialData?.credentialSubject || props.credentialData;
  const reasonForReferral = subject?.reasonForReferralTh || subject?.reasonForReferral || "";
  const priority = subject?.priority || "routine";
  const referringTo = subject?.referringTo || subject?.receivingFacility || {};
  const clinicalSummary: any = subject?.clinicalSummary || "";
  const referringPractitioner = subject?.referringPractitioner || {};
  const requestedService = subject?.requestedServiceTh || subject?.requestedService || (Array.isArray(subject?.requestedServices) ? subject.requestedServices.join(", ") : "");

  const priorityColors: Record<string, string> = {
    urgent: "bg-red-100 text-red-800 border-red-200",
    routine: "bg-blue-100 text-blue-800 border-blue-200",
    stat: "bg-red-200 text-red-900 border-red-300",
  };
  const priorityLabels: Record<string, string> = { urgent: "เร่งด่วน", routine: "ปกติ", stat: "ฉุกเฉิน" };

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
            {referringTo?.name && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">ส่งต่อไปยัง</span>
                <span className="font-medium">{referringTo.nameTh || referringTo.name}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">เหตุผลการส่งต่อ</span>
              <span className="font-medium">{reasonForReferral || "ต้องการการดูแลเฉพาะทาง"}</span>
            </div>
            {requestedService && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">บริการที่ต้องการ</span>
                <span className="font-medium">{requestedService}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">ระดับความเร่งด่วน</span>
              <Badge variant="outline" className={priorityColors[priority] || priorityColors.routine}>{priorityLabels[priority] || priority}</Badge>
            </div>
          </div>
        </div>

        {clinicalSummary && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-slate-700 mb-1">สรุปทางคลินิก</p>
            {typeof clinicalSummary === "string" ? (
              <p className="text-sm">{clinicalSummary}</p>
            ) : (
              <div className="space-y-1.5 text-sm">
                {clinicalSummary.chiefComplaint && <p><span className="text-muted-foreground">อาการสำคัญ:</span> {clinicalSummary.chiefComplaint}</p>}
                {clinicalSummary.relevantHistory && <p><span className="text-muted-foreground">ประวัติ:</span> {String(clinicalSummary.relevantHistory)}</p>}
                {Array.isArray(clinicalSummary.allergies) && clinicalSummary.allergies.length > 0 && (
                  <p><span className="text-muted-foreground">การแพ้:</span> {clinicalSummary.allergies.join(", ")}</p>
                )}
                {Array.isArray(clinicalSummary.currentMedications) && clinicalSummary.currentMedications.length > 0 && (
                  <p><span className="text-muted-foreground">ยาปัจจุบัน:</span> {clinicalSummary.currentMedications.map((m: any) => m.name || m.code || String(m)).join(", ")}</p>
                )}
              </div>
            )}
          </div>
        )}

        <PractitionerSection practitioner={referringPractitioner} role="แพทย์ผู้ส่งต่อ" />
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
  const subject = props.credentialData?.credentialSubject || props.credentialData;
  const admissionDate = subject?.admissionDate || "";
  const dischargeDate = subject?.dischargeDate || props.issuedAt;
  const admittingDiagnosis = subject?.admittingDiagnosis || "";
  const dischargeDiagnosis = subject?.dischargeDiagnosis || "";
  const dischargeCondition = subject?.dischargeConditionTh || subject?.dischargeCondition || "";
  const attendingPhysician = subject?.attendingPhysician || {};
  const ward = subject?.ward || subject?.wardEn || "";
  const lengthOfStay = subject?.lengthOfStay || "";
  const principalProcedure = subject?.principalProcedure || "";
  const dischargeMedications: any[] = subject?.dischargeMedications || [];
  const followUpInstructions = subject?.followUpInstructions || "";
  const followUpDate = subject?.followUpDate || "";
  const activityRestrictions = subject?.activityRestrictions || "";
  const dietaryAdvice = subject?.dietaryAdvice || "";

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
              <span className="text-muted-foreground">วันที่รับไว้</span>
              <span className="font-medium">{admissionDate ? formatThaiDate(admissionDate) : "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">วันที่จำหน่าย</span>
              <span className="font-medium">{formatThaiDate(dischargeDate)}</span>
            </div>
            {lengthOfStay && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">ระยะเวลานอน</span>
                <span className="font-medium">{lengthOfStay} วัน</span>
              </div>
            )}
            {ward && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">หอผู้ป่วย</span>
                <span className="font-medium">{ward}</span>
              </div>
            )}
            {admittingDiagnosis && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">การวินิจฉัยแรกรับ</span>
                <span className="font-medium">{admittingDiagnosis}</span>
              </div>
            )}
            {dischargeDiagnosis && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">การวินิจฉัยสุดท้าย</span>
                <span className="font-medium">{dischargeDiagnosis}</span>
              </div>
            )}
            {principalProcedure && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">หัตถการหลัก</span>
                <span className="font-medium">{principalProcedure}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">สภาพขณะจำหน่าย</span>
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">{dischargeCondition || "ดีขึ้น"}</Badge>
            </div>
          </div>
        </div>

        {dischargeMedications.length > 0 && (
          <div className="bg-green-50 border border-green-100 rounded-xl p-4">
            <p className="text-xs font-semibold text-green-800 mb-2">ยากลับบ้าน</p>
            <div className="space-y-1.5">
              {dischargeMedications.map((med: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <Pill className="h-3.5 w-3.5 text-green-600 shrink-0" />
                  <span className="font-medium">{med.name}</span>
                  {med.instructions && <span className="text-xs text-muted-foreground ml-auto">{med.instructions}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {(followUpInstructions || activityRestrictions || dietaryAdvice) && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold text-blue-800">คำแนะนำหลังจำหน่าย</p>
            {followUpInstructions && <p className="text-sm">{followUpInstructions}</p>}
            {followUpDate && <p className="text-xs text-blue-700">นัดติดตาม: {formatThaiDate(followUpDate)}</p>}
            {activityRestrictions && <p className="text-sm">ข้อจำกัดกิจกรรม: {activityRestrictions}</p>}
            {dietaryAdvice && <p className="text-sm">คำแนะนำอาหาร: {dietaryAdvice}</p>}
          </div>
        )}

        <PractitionerSection practitioner={attendingPhysician} role="แพทย์เจ้าของไข้" />
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
  const subject = props.credentialData?.credentialSubject || props.credentialData;
  const payer = subject?.payer || {};
  const planName = subject?.planName || "";
  const memberId = subject?.memberId || "";
  const eligStatus = subject?.status || "eligible";
  const benefits = subject?.benefits || {};
  const copay = subject?.copay || {};
  const validFrom = subject?.validFrom || "";
  const validUntil = subject?.validUntil || "";
  const preAuthRequired = subject?.preAuthorizationRequired;

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
              <Badge className={eligStatus === "eligible" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}>
                {eligStatus === "eligible" ? "ใช้งานได้" : "ไม่มีสิทธิ์"}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">บริษัทประกัน</span>
              <span className="font-medium">{payer.name || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">แผนประกัน</span>
              <span className="font-medium">{planName || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">เลขสมาชิก</span>
              <span className="font-mono text-xs font-medium">{memberId || "—"}</span>
            </div>
            {(validFrom || validUntil) && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">ระยะเวลาคุ้มครอง</span>
                <span className="font-medium">{validFrom} — {validUntil}</span>
              </div>
            )}
            {benefits.annualLimit && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">วงเงินคุ้มครองต่อปี</span>
                <span className="font-bold">{Number(benefits.annualLimit).toLocaleString()} {benefits.annualLimitCurrency || "THB"}</span>
              </div>
            )}
            {copay.percentage && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Copay</span>
                <span className="font-medium">{copay.percentage}% (สูงสุด {copay.maxPerVisit?.toLocaleString()} บ./ครั้ง)</span>
              </div>
            )}
            {preAuthRequired && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pre-authorization</span>
                <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200">ต้องขออนุมัติก่อน</Badge>
              </div>
            )}
            {benefits.directBilling && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Direct Billing</span>
                <Badge className="bg-emerald-100 text-emerald-800">รองรับ</Badge>
              </div>
            )}
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
  const subject = props.credentialData?.credentialSubject || props.credentialData;
  const passportNumber = subject?.passportNumber || "";
  const nationality = subject?.nationality || "";
  const issuingCountry = subject?.issuingCountry || "";
  const expiryDate = subject?.expiryDate || "";
  const verificationStatus = subject?.verificationStatus || "verified";
  const purposeOfVisit = subject?.purposeOfVisitTh || subject?.purposeOfVisit || "";
  const visaType = subject?.visaTypeTh || subject?.visaType || "";
  const verifiedBy = subject?.verifiedByTh || subject?.verifiedBy || "";
  const mrzLine1 = subject?.mrzLine1 || "";
  const mrzLine2 = subject?.mrzLine2 || "";

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
              <Badge className={verificationStatus === "verified" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}>
                {verificationStatus === "verified" ? "ผ่านการตรวจสอบ" : "ไม่ผ่าน"}
              </Badge>
            </div>
            {passportNumber && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">เลขหนังสือเดินทาง</span>
                <span className="font-mono font-bold">{passportNumber}</span>
              </div>
            )}
            {nationality && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">สัญชาติ</span>
                <span className="font-medium">{nationality}</span>
              </div>
            )}
            {issuingCountry && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">ประเทศที่ออก</span>
                <span className="font-medium">{issuingCountry}</span>
              </div>
            )}
            {expiryDate && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">วันหมดอายุ</span>
                <span className="font-medium">{expiryDate}</span>
              </div>
            )}
            {visaType && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">ประเภทวีซ่า</span>
                <span className="font-medium">{visaType}</span>
              </div>
            )}
            {purposeOfVisit && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">วัตถุประสงค์</span>
                <span className="font-medium">{purposeOfVisit}</span>
              </div>
            )}
            {verifiedBy && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">ตรวจสอบโดย</span>
                <span className="font-medium">{verifiedBy}</span>
              </div>
            )}
          </div>
        </div>

        {(mrzLine1 || mrzLine2) && (
          <div className="bg-slate-900 rounded-lg p-3 font-mono text-xs text-green-400 space-y-0.5">
            {mrzLine1 && <p>{mrzLine1}</p>}
            {mrzLine2 && <p>{mrzLine2}</p>}
          </div>
        )}

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
  const subject = props.credentialData?.credentialSubject || props.credentialData;

  // Claim Package fields
  const claimRef = subject?.claimRef || "";
  const claimStatus = subject?.claimStatus || "submitted";
  const claimType = subject?.claimType || "opd";
  const totalAmount = subject?.totalAmount || 0;
  const currency = subject?.currency || "THB";
  const serviceItems: any[] = subject?.serviceItems || [];
  const diagnosisCodes: string[] = subject?.diagnosisCodes || [];

  // Claim Receipt fields
  const adjudicationOutcome = subject?.adjudicationOutcome || "approved";
  const totalClaimed = subject?.totalClaimed || 0;
  const approvedAmount = subject?.approvedAmount || 0;
  const patientResponsibility = subject?.patientResponsibility || 0;
  const breakdown: any[] = subject?.breakdown || [];
  const paymentMethod = subject?.paymentMethod || "";
  const paymentStatus = subject?.paymentStatus || "";
  const receiptNo = subject?.receiptNo || "";
  const invoiceNo = subject?.invoiceNo || "";

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
            {claimRef && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">เลขอ้างอิงเคลม</span>
                <span className="font-mono text-xs font-medium">{claimRef}</span>
              </div>
            )}
            {isReceipt ? (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ผลการพิจารณา</span>
                  <Badge className={adjudicationOutcome === "approved" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}>
                    {adjudicationOutcome === "approved" ? "อนุมัติ" : "ปฏิเสธ"}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ยอดเคลมทั้งหมด</span>
                  <span className="font-medium">{Number(totalClaimed).toLocaleString()} {currency}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ยอดอนุมัติ</span>
                  <span className="font-bold text-emerald-700">{Number(approvedAmount).toLocaleString()} {currency}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ส่วนผู้ป่วยรับผิดชอบ</span>
                  <span className="font-medium text-orange-700">{Number(patientResponsibility).toLocaleString()} {currency}</span>
                </div>
                {paymentMethod && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ช่องทางชำระ</span>
                    <span className="font-medium">{paymentMethod === "direct_billing" ? "Direct Billing" : paymentMethod}</span>
                  </div>
                )}
                {paymentStatus && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">สถานะการชำระ</span>
                    <Badge className="bg-emerald-100 text-emerald-800">{paymentStatus === "paid" ? "ชำระแล้ว" : paymentStatus}</Badge>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">สถานะ</span>
                  <Badge className="bg-blue-100 text-blue-800">{claimStatus === "submitted" ? "ส่งแล้ว" : claimStatus}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ประเภท</span>
                  <span className="font-medium">{claimType === "opd" ? "OPD" : claimType === "ipd" ? "IPD" : claimType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ยอดรวม</span>
                  <span className="font-bold">{Number(totalAmount).toLocaleString()} {currency}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Service Items or Breakdown */}
        {!isReceipt && serviceItems.length > 0 && (
          <div className="bg-muted/30 rounded-xl p-4">
            <p className="text-xs font-semibold text-muted-foreground mb-2">รายการบริการ</p>
            <div className="space-y-1.5">
              {serviceItems.map((item: any, i: number) => (
                <div key={i} className="flex justify-between text-sm">
                  <span>{item.description || item.descriptionEn}</span>
                  <span className="font-medium">{Number(item.amount).toLocaleString()} {currency}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {isReceipt && breakdown.length > 0 && (
          <div className="bg-muted/30 rounded-xl p-4">
            <p className="text-xs font-semibold text-muted-foreground mb-2">รายละเอียดการพิจารณา</p>
            <div className="space-y-1.5">
              {breakdown.map((item: any, i: number) => (
                <div key={i} className="flex justify-between text-sm">
                  <span>{item.category || item.categoryEn}</span>
                  <span className="font-medium">
                    <span className="text-muted-foreground">{Number(item.claimed).toLocaleString()}</span>
                    {" "}→{" "}
                    <span className="text-emerald-700">{Number(item.approved).toLocaleString()}</span>
                  </span>
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

// ─── MPI Link Certificate Template ───────────────────────────────────────────
function MpiLinkCard({ props }: { props: CredentialRendererProps }) {
  const renderData = extractRenderData(props.credentialData);
  const brand = getHospitalBrand(renderData.hospital.code || props.hospitalCode);
  const subject = props.credentialData?.credentialSubject || props.credentialData;
  const linkStatus = subject?.linkStatus || "active";
  const goldenRecordId = subject?.goldenRecordId || "";
  const linkConfidence = subject?.linkConfidence || "high";
  const crossReferenceCount = subject?.crossReferenceCount || 0;
  const linkedIdentifiers: any[] = subject?.linkedIdentifiers || [];
  const matchAlgorithm = subject?.matchAlgorithm || "";
  const linkedBy = subject?.linkedBy || "";
  const lastVerifiedAt = subject?.lastVerifiedAt || "";

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
              <Badge className={linkStatus === "active" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}>
                {linkStatus === "active" ? "เชื่อมโยงสำเร็จ" : linkStatus}
              </Badge>
            </div>
            {goldenRecordId && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Golden Record ID</span>
                <span className="font-mono text-xs font-medium">{goldenRecordId}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">ความเชื่อมั่น</span>
              <Badge variant="outline" className="bg-cyan-50 text-cyan-800 border-cyan-200">{linkConfidence}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">จำนวนการอ้างอิงข้าม</span>
              <span className="font-medium">{crossReferenceCount} รายการ</span>
            </div>
            {matchAlgorithm && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">วิธีการจับคู่</span>
                <span className="text-xs">{matchAlgorithm.replace(/_/g, " ")}</span>
              </div>
            )}
            {lastVerifiedAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">ตรวจสอบล่าสุด</span>
                <span className="font-medium">{formatThaiDate(lastVerifiedAt)}</span>
              </div>
            )}
          </div>
        </div>

        {linkedIdentifiers.length > 0 && (
          <div className="bg-muted/30 rounded-xl p-4">
            <p className="text-xs font-semibold text-muted-foreground mb-2">ตัวระบุที่เชื่อมโยง</p>
            <div className="space-y-1.5">
              {linkedIdentifiers.map((id: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{id.system?.replace("https://", "")}</span>
                  <span className="font-mono font-medium">{id.value}{id.isPrimary ? " ★" : ""}</span>
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

// ─── Generic Fallback Template (for types without specific template) ─────────
function GenericDocumentCard({ props }: { props: CredentialRendererProps }) {
  const renderData = extractRenderData(props.credentialData);
  const brand = getHospitalBrand(renderData.hospital.code || props.hospitalCode);
  const subject = props.credentialData?.credentialSubject || props.credentialData;

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

  // Type-specific rendering based on credentialSubject fields
  const renderTypeSpecificContent = () => {
    switch (props.type) {
      case "diagnostic_report": {
        const reportType = subject?.reportType || "";
        const conclusion = subject?.conclusionTh || subject?.conclusion || "";
        const findings: any[] = subject?.findings || [];
        const imagingModality = subject?.imagingModality || "";
        const bodyRegion = subject?.bodyRegionTh || subject?.bodyRegion || "";
        const reportingRadiologist = subject?.reportingRadiologist || {};
        return (
          <>
            <div className="bg-rose-50 border border-rose-100 rounded-xl p-4">
              <p className="text-xs font-semibold text-rose-800 mb-2 flex items-center gap-1.5">
                <ClipboardList className="h-3.5 w-3.5" /> รายงานการวินิจฉัย
              </p>
              <div className="space-y-2 text-sm">
                {reportType && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ประเภทรายงาน</span>
                    <span className="font-medium">{reportType}</span>
                  </div>
                )}
                {imagingModality && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">วิธีตรวจ</span>
                    <span className="font-medium">{imagingModality}</span>
                  </div>
                )}
                {bodyRegion && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">บริเวณที่ตรวจ</span>
                    <span className="font-medium">{bodyRegion}</span>
                  </div>
                )}
              </div>
            </div>
            {findings.length > 0 && (
              <div className="bg-muted/30 rounded-xl p-4">
                <p className="text-xs font-semibold text-muted-foreground mb-2">ผลการตรวจ</p>
                <div className="space-y-1.5">
                  {findings.map((f: any, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-rose-500 mt-0.5">•</span>
                      <span>{f.descriptionTh || f.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {conclusion && (
              <div className="bg-rose-50 border border-rose-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-rose-800 mb-1">สรุปผล</p>
                <p className="text-sm font-medium">{conclusion}</p>
              </div>
            )}
            {reportingRadiologist?.name && <PractitionerSection practitioner={reportingRadiologist} role="รังสีแพทย์ผู้รายงาน" />}
          </>
        );
      }
      case "pharmacy_dispense": {
        const dispensedMedications: any[] = subject?.dispensedMedications || [];
        const pharmacist = subject?.pharmacist || {};
        const dispensingDate = subject?.dispensingDate || props.issuedAt;
        const prescriptionRef = subject?.prescriptionRef || "";
        const totalItems = subject?.totalItems || dispensedMedications.length;
        return (
          <>
            <div className="bg-teal-50 border border-teal-100 rounded-xl p-4">
              <p className="text-xs font-semibold text-teal-800 mb-2 flex items-center gap-1.5">
                <Pill className="h-3.5 w-3.5" /> รายการยาที่จ่าย ({totalItems} รายการ)
              </p>
              <div className="space-y-2">
                {dispensedMedications.map((med: any, i: number) => (
                  <div key={i} className="flex items-center justify-between bg-white rounded-lg p-3 border border-teal-100">
                    <div>
                      <p className="font-medium text-sm">{med.nameTh || med.name}</p>
                      <p className="text-xs text-muted-foreground">{med.strength} • {med.form}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm">{med.quantity} {med.quantityUnit}</p>
                      {med.instructions && <p className="text-[10px] text-muted-foreground">{med.instructions}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {prescriptionRef && (
              <div className="text-xs text-muted-foreground">อ้างอิงใบสั่งยา: {prescriptionRef}</div>
            )}
            {pharmacist?.name && <PractitionerSection practitioner={pharmacist} role="เภสัชกรผู้จ่ายยา" />}
          </>
        );
      }
      case "appointment": {
        const appointmentDate = subject?.appointmentDate || "";
        const appointmentTime = subject?.appointmentTime || "";
        const department = subject?.departmentTh || subject?.department || "";
        const appointmentType = subject?.appointmentTypeTh || subject?.appointmentType || "";
        const practitioner = subject?.practitioner || {};
        const appointmentStatus = subject?.appointmentStatus || "booked";
        const instructions = subject?.instructionsTh || subject?.instructions || "";
        const location = subject?.locationTh || subject?.location || "";
        return (
          <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
            <p className="text-xs font-semibold text-purple-800 mb-2 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> รายละเอียดการนัดหมาย
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">สถานะ</span>
                <Badge className={appointmentStatus === "booked" ? "bg-purple-100 text-purple-800" : "bg-emerald-100 text-emerald-800"}>
                  {appointmentStatus === "booked" ? "ยืนยัน" : appointmentStatus}
                </Badge>
              </div>
              {appointmentDate && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">วันที่นัด</span>
                  <span className="font-bold">{formatThaiDate(appointmentDate)}</span>
                </div>
              )}
              {appointmentTime && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">เวลา</span>
                  <span className="font-bold">{appointmentTime} น.</span>
                </div>
              )}
              {department && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">แผนก</span>
                  <span className="font-medium">{department}</span>
                </div>
              )}
              {appointmentType && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ประเภท</span>
                  <span className="font-medium">{appointmentType}</span>
                </div>
              )}
              {location && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">สถานที่</span>
                  <span className="font-medium">{location}</span>
                </div>
              )}
              {practitioner?.name && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">แพทย์</span>
                  <span className="font-medium">{practitioner.name}</span>
                </div>
              )}
              {instructions && (
                <div className="mt-2 pt-2 border-t border-purple-100">
                  <p className="text-xs text-purple-700">คำแนะนำ: {instructions}</p>
                </div>
              )}
            </div>
          </div>
        );
      }
      case "visa_support_letter": {
        const treatmentPlan = subject?.treatmentPlanTh || subject?.treatmentPlan || "";
        const estimatedStay = subject?.estimatedStay || "";
        const estimatedCost = subject?.estimatedCost || 0;
        const costCurrency = subject?.costCurrency || "THB";
        const attendingDoctor = subject?.attendingDoctor || {};
        const medicalCondition = subject?.medicalConditionTh || subject?.medicalCondition || "";
        const travelDates = subject?.travelDates || {};
        const embassy = subject?.targetEmbassy || "";
        return (
          <>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <p className="text-xs font-semibold text-blue-800 mb-2 flex items-center gap-1.5">
                <Plane className="h-3.5 w-3.5" /> รายละเอียดหนังสือรับรอง
              </p>
              <div className="space-y-2 text-sm">
                {medicalCondition && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">อาการ/โรค</span>
                    <span className="font-medium">{medicalCondition}</span>
                  </div>
                )}
                {treatmentPlan && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">แผนการรักษา</span>
                    <span className="font-medium">{treatmentPlan}</span>
                  </div>
                )}
                {estimatedStay && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ระยะเวลาพักรักษา</span>
                    <span className="font-medium">{estimatedStay}</span>
                  </div>
                )}
                {estimatedCost > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ค่าใช้จ่ายประมาณการ</span>
                    <span className="font-bold">{Number(estimatedCost).toLocaleString()} {costCurrency}</span>
                  </div>
                )}
                {travelDates?.from && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ช่วงเวลา</span>
                    <span className="font-medium">{travelDates.from} — {travelDates.to || ""}</span>
                  </div>
                )}
                {embassy && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">สถานทูต</span>
                    <span className="font-medium">{embassy}</span>
                  </div>
                )}
              </div>
            </div>
            {attendingDoctor?.name && <PractitionerSection practitioner={attendingDoctor} role="แพทย์ผู้รับรอง" />}
          </>
        );
      }
      case "quotation": {
        const treatmentPackage = subject?.treatmentPackageTh || subject?.treatmentPackage || "";
        const items: any[] = subject?.items || [];
        const totalEstimate = subject?.totalEstimate || 0;
        const qCurrency = subject?.currency || "THB";
        const validityDays = subject?.validityDays || 30;
        const paymentTerms = subject?.paymentTermsTh || subject?.paymentTerms || "";
        const inclusions: string[] = subject?.inclusions || [];
        const exclusions: string[] = subject?.exclusions || [];
        return (
          <>
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-yellow-800 mb-2 flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5" /> ใบเสนอราคาการรักษา
              </p>
              <div className="space-y-2 text-sm">
                {treatmentPackage && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">แพ็คเกจการรักษา</span>
                    <span className="font-medium">{treatmentPackage}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ราคารวมประมาณการ</span>
                  <span className="font-bold text-lg">{Number(totalEstimate).toLocaleString()} {qCurrency}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ใช้ได้ภายใน</span>
                  <span className="font-medium">{validityDays} วัน</span>
                </div>
                {paymentTerms && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">เงื่อนไขการชำระ</span>
                    <span className="font-medium">{paymentTerms}</span>
                  </div>
                )}
              </div>
            </div>
            {items.length > 0 && (
              <div className="bg-muted/30 rounded-xl p-4">
                <p className="text-xs font-semibold text-muted-foreground mb-2">รายการ</p>
                <div className="space-y-1.5">
                  {items.map((item: any, i: number) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span>{item.descriptionTh || item.description}</span>
                      <span className="font-medium">{Number(item.amount).toLocaleString()} {qCurrency}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {(inclusions.length > 0 || exclusions.length > 0) && (
              <div className="grid grid-cols-2 gap-3">
                {inclusions.length > 0 && (
                  <div className="bg-emerald-50 rounded-lg p-3">
                    <p className="text-xs font-semibold text-emerald-800 mb-1">รวม</p>
                    {inclusions.map((inc, i) => <p key={i} className="text-xs text-emerald-700">✓ {inc}</p>)}
                  </div>
                )}
                {exclusions.length > 0 && (
                  <div className="bg-red-50 rounded-lg p-3">
                    <p className="text-xs font-semibold text-red-800 mb-1">ไม่รวม</p>
                    {exclusions.map((exc, i) => <p key={i} className="text-xs text-red-700">✗ {exc}</p>)}
                  </div>
                )}
              </div>
            )}
          </>
        );
      }
      case "guarantee_letter": {
        const guaranteeAmount = subject?.guaranteeAmount || 0;
        const gCurrency = subject?.currency || "THB";
        const beneficiary = subject?.beneficiary || {};
        const guarantor = subject?.guarantor || {};
        const guaranteeType = subject?.guaranteeTypeTh || subject?.guaranteeType || "";
        const coverageScope = subject?.coverageScopeTh || subject?.coverageScope || "";
        const conditions: string[] = subject?.conditions || [];
        const validFrom = subject?.validFrom || "";
        const validUntil = subject?.validUntil || "";
        const authorizedBy = subject?.authorizedBy || {};
        return (
          <>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-emerald-800 mb-2 flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5" /> รายละเอียดหนังสือค้ำประกัน
              </p>
              <div className="space-y-2 text-sm">
                {guaranteeType && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ประเภท</span>
                    <span className="font-medium">{guaranteeType}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">วงเงินค้ำประกัน</span>
                  <span className="font-bold text-lg text-emerald-800">{Number(guaranteeAmount).toLocaleString()} {gCurrency}</span>
                </div>
                {beneficiary?.name && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ผู้รับผลประโยชน์</span>
                    <span className="font-medium">{beneficiary.name}</span>
                  </div>
                )}
                {guarantor?.name && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ผู้ค้ำประกัน</span>
                    <span className="font-medium">{guarantor.name}</span>
                  </div>
                )}
                {coverageScope && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ขอบเขตความคุ้มครอง</span>
                    <span className="font-medium">{coverageScope}</span>
                  </div>
                )}
                {(validFrom || validUntil) && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ระยะเวลา</span>
                    <span className="font-medium">{validFrom} — {validUntil}</span>
                  </div>
                )}
              </div>
            </div>
            {conditions.length > 0 && (
              <div className="bg-muted/30 rounded-xl p-4">
                <p className="text-xs font-semibold text-muted-foreground mb-2">เงื่อนไข</p>
                <div className="space-y-1">
                  {conditions.map((c, i) => <p key={i} className="text-xs text-muted-foreground">{i + 1}. {c}</p>)}
                </div>
              </div>
            )}
            {authorizedBy?.name && <PractitionerSection practitioner={authorizedBy} role="ผู้อนุมัติ" />}
          </>
        );
      }
      default:
        return (
          <div className="bg-muted/30 border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span className="font-medium">เอกสารนี้ได้รับการรับรองโดย {renderData.hospital.nameTh || brand.logo}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              ออกเมื่อ {formatThaiDate(props.issuedAt)} — ตรวจสอบความถูกต้องได้ผ่าน QR Code
            </p>
          </div>
        );
    }
  };

  return (
    <Card className="overflow-hidden border-0 shadow-2xl rounded-2xl">
      <DocumentHeader icon={Icon} title={config.label} brand={{ ...brand, gradient: config.color }} renderData={renderData} status={props.status} />
      <CardContent className="p-6 space-y-4">
        <PatientInfoSection renderData={renderData} />
        <Separator />
        {renderTypeSpecificContent()}
        <Separator />
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
    case "staff_identity": content = <StaffIdentityCard props={props} />; break;
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
  const needsPhoto = ["patient_identity", "staff_identity", "medical_certificate"].includes(props.type);
  const photoSources = patientPhotoSources({
    primaryUrl: props.patientPhotoUrl,
    credentialData: props.credentialData,
    gender,
  });

  const typeLabels: Record<string, string> = {
    patient_identity: "บัตรประจำตัวผู้ป่วย",
    staff_identity: "บัตรประจำตัวเจ้าหน้าที่โรงพยาบาล",
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
        <div className="h-12 w-10 rounded-lg overflow-hidden border-2 border-gray-200 shadow-sm shrink-0 group-hover:border-primary/30 transition-colors bg-muted flex items-center justify-center">
          <PersonPhoto
            sources={photoSources}
            alt=""
            className="h-full w-full object-cover"
            fallback={<User className="h-5 w-5 text-muted-foreground" />}
          />
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
