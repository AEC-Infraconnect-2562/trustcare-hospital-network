import DashboardLayout from "@/components/DashboardLayout";
import QRScanner from "@/components/QRScanner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock,
  FileText,
  Heart,
  Pill,
  RotateCcw,
  ScanLine,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Stethoscope,
  Syringe,
  User,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useSearch } from "wouter";
import { toast } from "sonner";

type TrustLevel = "green" | "amber" | "yellow" | "red";

const trustBadgeConfig: Record<
  string,
  { icon: any; bg: string; iconColor: string; title: string; titleTh: string }
> = {
  green: {
    icon: ShieldCheck,
    bg: "bg-emerald-50 border-emerald-300",
    iconColor: "text-emerald-600",
    title: "Verified",
    titleTh: "ตรวจสอบผ่าน",
  },
  amber: {
    icon: ShieldAlert,
    bg: "bg-amber-50 border-amber-300",
    iconColor: "text-amber-600",
    title: "Partially Verified",
    titleTh: "ตรวจสอบบางส่วน",
  },
  yellow: {
    icon: ShieldAlert,
    bg: "bg-amber-50 border-amber-300",
    iconColor: "text-amber-600",
    title: "Verified with warnings",
    titleTh: "ตรวจสอบผ่านมีข้อสังเกต",
  },
  red: {
    icon: ShieldX,
    bg: "bg-red-50 border-red-300",
    iconColor: "text-red-600",
    title: "Not Verified",
    titleTh: "ตรวจสอบไม่ผ่าน",
  },
};

const credentialTypeLabels: Record<
  string,
  { label: string; labelEn: string; icon: any; color: string }
> = {
  allergy_alert: {
    label: "ข้อมูลแพ้ยา/อาหาร",
    labelEn: "Allergy Alert",
    icon: AlertTriangle,
    color: "text-red-600",
  },
  medication_summary: {
    label: "ข้อมูลยาที่ใช้",
    labelEn: "Medication Summary",
    icon: Pill,
    color: "text-purple-600",
  },
  patient_summary: {
    label: "สรุปข้อมูลผู้ป่วย",
    labelEn: "Patient Summary",
    icon: User,
    color: "text-green-600",
  },
  lab_result: {
    label: "ผลตรวจทางห้องปฏิบัติการ",
    labelEn: "Lab Result",
    icon: FileText,
    color: "text-cyan-600",
  },
  diagnostic_report: {
    label: "รายงานวินิจฉัย",
    labelEn: "Diagnostic Report",
    icon: Stethoscope,
    color: "text-cyan-600",
  },
  discharge_summary: {
    label: "สรุปจำหน่ายผู้ป่วย",
    labelEn: "Discharge Summary",
    icon: FileText,
    color: "text-green-600",
  },
  immunization: {
    label: "ประวัติวัคซีน",
    labelEn: "Immunization",
    icon: Syringe,
    color: "text-green-600",
  },
  prescription: {
    label: "ใบสั่งยา",
    labelEn: "Prescription",
    icon: Pill,
    color: "text-purple-600",
  },
  pharmacy_dispense: {
    label: "บันทึกจ่ายยา",
    labelEn: "Pharmacy Dispense",
    icon: Pill,
    color: "text-purple-600",
  },
  referral_vc: {
    label: "ใบส่งต่อ",
    labelEn: "Referral",
    icon: FileText,
    color: "text-orange-600",
  },
  medical_certificate: {
    label: "ใบรับรองแพทย์",
    labelEn: "Medical Certificate",
    icon: FileText,
    color: "text-green-600",
  },
  consent_receipt: {
    label: "ใบยินยอม",
    labelEn: "Consent Receipt",
    icon: ShieldCheck,
    color: "text-indigo-600",
  },
  patient_identity: {
    label: "ข้อมูลตัวตนผู้ป่วย",
    labelEn: "Patient Identity",
    icon: User,
    color: "text-blue-600",
  },
  insurance_eligibility: {
    label: "สิทธิ์ประกัน",
    labelEn: "Insurance Eligibility",
    icon: Heart,
    color: "text-yellow-600",
  },
  claim_package: {
    label: "แพ็คเกจเคลม",
    labelEn: "Claim Package",
    icon: FileText,
    color: "text-yellow-600",
  },
  travel_document_verification: {
    label: "เอกสารเดินทาง",
    labelEn: "Travel Document",
    icon: FileText,
    color: "text-teal-600",
  },
  quotation: {
    label: "ใบเสนอราคา",
    labelEn: "Quotation",
    icon: FileText,
    color: "text-teal-600",
  },
  guarantee_letter: {
    label: "หนังสือค้ำประกัน",
    labelEn: "Guarantee Letter",
    icon: FileText,
    color: "text-teal-600",
  },
  visa_support_letter: {
    label: "หนังสือรับรองวีซ่า",
    labelEn: "Visa Support Letter",
    icon: FileText,
    color: "text-teal-600",
  },
};

const contextLabels: Record<string, { label: string; labelEn: string }> = {
  opd_visit: { label: "ผู้ป่วยนอก (OPD)", labelEn: "OPD Visit" },
  emergency: { label: "ฉุกเฉิน", labelEn: "Emergency" },
  referral: { label: "ส่งต่อ", labelEn: "Referral" },
  cross_border: { label: "ข้ามพรมแดน", labelEn: "Cross-border" },
  medical_tourist: { label: "Medical Tourist", labelEn: "Medical Tourist" },
  insurance_claim: { label: "เคลมประกัน", labelEn: "Insurance Claim" },
  pharmacy_dispense: { label: "จ่ายยา", labelEn: "Pharmacy Dispense" },
};

function extractPresentationId(data: string): string {
  if (!data.startsWith("http")) return data;
  try {
    const url = new URL(data);
    return (
      url.searchParams.get("vp") ||
      url.pathname.split("/").filter(Boolean).pop() ||
      data
    );
  } catch {
    return data;
  }
}

export default function ServiceVerify() {
  const [scanning, setScanning] = useState(true);
  const [presentationId, setPresentationId] = useState<string | null>(null);
  const [manualPresentation, setManualPresentation] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [checkinNotes, setCheckinNotes] = useState("");

  const verifyPacket = trpc.verifier.verifyServicePacket.useMutation({
    onSuccess: data => {
      if (data.verified) {
        toast.success("ตรวจสอบ VP Packet สำเร็จ");
      } else {
        toast.error(data.error || "ตรวจสอบไม่ผ่าน");
      }
    },
    onError: err => toast.error(err.message),
  });

  const confirmCheckin = trpc.verifier.confirmServiceCheckin.useMutation({
    onSuccess: () => {
      toast.success("ยืนยันเข้ารับบริการสำเร็จ");
    },
    onError: err => toast.error(err.message),
  });

  // Auto-verify from URL param (e.g., /service-verify?vp=xxx)
  const searchString = useSearch();
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const vpParam = params.get("vp");
    if (vpParam && !presentationId) {
      const extractedId = extractPresentationId(vpParam);
      setPresentationId(extractedId);
      setScanning(false);
      verifyPacket.mutate({ presentationId: extractedId });
    }
  }, [searchString]);

  const handleQrScan = useCallback(
    (data: string) => {
      setScanning(false);
      const extractedId = extractPresentationId(data);
      setPresentationId(extractedId);
      verifyPacket.mutate({ presentationId: extractedId });
    },
    [verifyPacket]
  );

  const handleManualVerify = () => {
    const trimmed = manualPresentation.trim();
    if (!trimmed) {
      toast.error("Enter a VP presentation URL or ID");
      return;
    }
    const extractedId = extractPresentationId(trimmed);
    setPresentationId(extractedId);
    setScanning(false);
    verifyPacket.mutate({ presentationId: extractedId });
  };

  const handleReset = () => {
    setPresentationId(null);
    setScanning(true);
    setManualPresentation("");
    setServiceName("");
    setCheckinNotes("");
    verifyPacket.reset();
    confirmCheckin.reset();
  };

  const handleConfirmCheckin = () => {
    if (!presentationId) return;
    confirmCheckin.mutate({
      presentationId,
      serviceName: serviceName || undefined,
      notes: checkinNotes || undefined,
    });
  };

  const result = verifyPacket.data;
  const trustLevel = (result?.trustLevel ?? "red") as TrustLevel;
  const badge = trustBadgeConfig[trustLevel] || trustBadgeConfig.red;
  const BadgeIcon = badge.icon;

  return (
    <DashboardLayout>
      <div className="container max-w-4xl py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ScanLine className="h-6 w-6 text-primary" />
              ตรวจสอบจุดบริการ
            </h1>
            <p className="text-muted-foreground mt-1">
              สแกน QR Code จาก VP Service Packet
              ของผู้ป่วยเพื่อตรวจสอบก่อนเข้ารับบริการ
            </p>
          </div>
          {!scanning && (
            <Button variant="outline" onClick={handleReset} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              สแกนใหม่
            </Button>
          )}
        </div>

        {/* Scanner Section */}
        {scanning && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Camera className="h-5 w-5" />
                สแกน QR Code
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-w-md mx-auto">
                <QRScanner
                  onScanSuccess={handleQrScan}
                  onScanError={(err: string) =>
                    toast.error(`Camera error: ${err}`)
                  }
                />
              </div>
              <Separator className="my-5" />
              <div className="mx-auto max-w-md space-y-3">
                <Label htmlFor="manual-presentation">
                  Presentation URL or ID
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="manual-presentation"
                    value={manualPresentation}
                    onChange={event =>
                      setManualPresentation(event.target.value)
                    }
                    placeholder="VP-... or https://.../service-verify?vp=..."
                  />
                  <Button
                    type="button"
                    onClick={handleManualVerify}
                    disabled={verifyPacket.isPending}
                  >
                    Verify
                  </Button>
                </div>
              </div>
              <p className="text-center text-sm text-muted-foreground mt-4">
                ให้ผู้ป่วยแสดง QR Code จากหน้า "เตรียมเข้ารับบริการ" หรือ
                "กระเป๋าสุขภาพ"
              </p>
            </CardContent>
          </Card>
        )}

        {/* Loading State */}
        {verifyPacket.isPending && (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
              <p className="mt-4 text-muted-foreground">
                กำลังตรวจสอบ VP Packet...
              </p>
            </CardContent>
          </Card>
        )}

        {/* Verification Result */}
        {result && !verifyPacket.isPending && (
          <div className="space-y-4">
            {/* Trust Level Banner */}
            <Card className={`border-2 ${badge.bg}`}>
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <BadgeIcon className={`h-8 w-8 ${badge.iconColor}`} />
                  <div>
                    <h2 className="text-lg font-semibold">{badge.titleTh}</h2>
                    <p className="text-sm text-muted-foreground">
                      {badge.title}
                    </p>
                  </div>
                  {result.readiness?.score != null && (
                    <div className="ml-auto text-right">
                      <div className="text-2xl font-bold">
                        {result.readiness.score}%
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Readiness Score
                      </div>
                    </div>
                  )}
                </div>
                {result.error && (
                  <p className="mt-2 text-sm text-red-600">{result.error}</p>
                )}
              </CardContent>
            </Card>

            {/* Patient Info */}
            {result.patient && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="h-4 w-4" />
                    ข้อมูลผู้ป่วย
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        ชื่อ-นามสกุล
                      </p>
                      <p className="font-medium">{result.patient.name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Patient ID
                      </p>
                      <p className="font-medium">#{result.patient.id}</p>
                    </div>
                    {result.presentation?.context && (
                      <div>
                        <p className="text-sm text-muted-foreground">
                          บริบทการรับบริการ
                        </p>
                        <Badge variant="secondary">
                          {contextLabels[result.presentation.context]?.label ||
                            result.presentation.context}
                        </Badge>
                      </div>
                    )}
                    {result.presentation?.expiresAt && (
                      <div>
                        <p className="text-sm text-muted-foreground">หมดอายุ</p>
                        <p className="text-sm flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(
                            result.presentation.expiresAt
                          ).toLocaleString("th-TH")}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Credentials List (Clinical-risk ordered) */}
            {result.credentials && result.credentials.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    เอกสารรับรอง ({result.credentials.length} รายการ)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {result.credentials.map((cred: any, idx: number) => {
                    const typeInfo = credentialTypeLabels[cred.type] || {
                      label: cred.type,
                      labelEn: cred.type,
                      icon: FileText,
                      color: "text-gray-600",
                    };
                    const CredIcon = typeInfo.icon;
                    const isHighPriority = [
                      "allergy_alert",
                      "medication_summary",
                    ].includes(cred.type);
                    return (
                      <div
                        key={cred.id || idx}
                        className={`flex items-start gap-3 p-3 rounded-lg border ${
                          isHighPriority
                            ? "border-red-200 bg-red-50/50"
                            : "border-border"
                        }`}
                      >
                        <CredIcon
                          className={`h-5 w-5 mt-0.5 ${typeInfo.color}`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">
                              {typeInfo.label}
                            </span>
                            {isHighPriority && (
                              <Badge
                                variant="destructive"
                                className="text-xs px-1.5 py-0"
                              >
                                สำคัญ
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {typeInfo.labelEn}
                          </p>
                          {cred.credentialData && (
                            <CredentialDataPreview
                              data={cred.credentialData}
                              type={cred.type}
                            />
                          )}
                        </div>
                        <Badge
                          variant={
                            cred.status === "active" ? "default" : "secondary"
                          }
                          className="text-xs"
                        >
                          {cred.status === "active" ? "Active" : cred.status}
                        </Badge>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* Warnings */}
            {result.warnings && result.warnings.length > 0 && (
              <Card className="border-amber-200">
                <CardContent className="py-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-800">
                        ข้อสังเกต
                      </p>
                      {result.warnings.map((w: string, i: number) => (
                        <p key={i} className="text-xs text-amber-700">
                          {w}
                        </p>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Separator />

            {/* Action Buttons */}
            {result.verified && result.patient && (
              <div className="space-y-3">
                <Card>
                  <CardContent className="grid gap-3 p-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="checkin-service-name">
                        Service / visit name
                      </Label>
                      <Input
                        id="checkin-service-name"
                        value={serviceName}
                        onChange={event => setServiceName(event.target.value)}
                        placeholder={
                          contextLabels[result.presentation?.context]
                            ?.labelEn || "OPD intake"
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="checkin-notes">Check-in notes</Label>
                      <Textarea
                        id="checkin-notes"
                        value={checkinNotes}
                        onChange={event => setCheckinNotes(event.target.value)}
                        rows={2}
                        placeholder="Counter, visit number, or triage note"
                      />
                    </div>
                  </CardContent>
                </Card>
                <div className="flex gap-3">
                  <Button
                    onClick={handleConfirmCheckin}
                    disabled={
                      confirmCheckin.isPending || confirmCheckin.isSuccess
                    }
                    className="flex-1 gap-2"
                    size="lg"
                  >
                    {confirmCheckin.isSuccess ? (
                      <>
                        <CheckCircle2 className="h-5 w-5" />
                        ยืนยันเข้ารับบริการแล้ว
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-5 w-5" />
                        {confirmCheckin.isPending
                          ? "กำลังยืนยัน..."
                          : "ยืนยันเข้ารับบริการ"}
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleReset}
                    className="gap-2"
                  >
                    <RotateCcw className="h-4 w-4" />
                    สแกนคนถัดไป
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

/** Inline preview of credential data for clinical-risk display */
function CredentialDataPreview({ data, type }: { data: any; type: string }) {
  if (!data) return null;

  // Allergy alert - show allergy items
  if (type === "allergy_alert") {
    const allergies = data.critical?.allergies || data.allergies || [];
    if (!allergies.length) return null;
    return (
      <div className="mt-1 space-y-0.5">
        {allergies.slice(0, 3).map((a: any, i: number) => (
          <p key={i} className="text-xs text-red-700 font-medium">
            ⚠️ {a.substance || a.name || a}{" "}
            {a.severity ? `(${a.severity})` : ""}
          </p>
        ))}
        {allergies.length > 3 && (
          <p className="text-xs text-muted-foreground">
            +{allergies.length - 3} รายการ
          </p>
        )}
      </div>
    );
  }

  // Medication - show medication list
  if (type === "medication_summary") {
    const meds = data.clinical?.medications || data.medications || [];
    if (!meds.length) return null;
    return (
      <div className="mt-1 space-y-0.5">
        {meds.slice(0, 3).map((m: any, i: number) => (
          <p key={i} className="text-xs text-purple-700">
            💊 {m.name || m.medication || m} {m.dosage ? `- ${m.dosage}` : ""}
          </p>
        ))}
        {meds.length > 3 && (
          <p className="text-xs text-muted-foreground">
            +{meds.length - 3} รายการ
          </p>
        )}
      </div>
    );
  }

  // Patient summary - show key info
  if (type === "patient_summary") {
    const conditions = data.clinical?.conditions || data.conditions || [];
    if (!conditions.length) return null;
    return (
      <div className="mt-1">
        <p className="text-xs text-green-700">
          โรคประจำตัว:{" "}
          {conditions
            .slice(0, 2)
            .map((c: any) => c.name || c)
            .join(", ")}
          {conditions.length > 2 ? ` +${conditions.length - 2}` : ""}
        </p>
      </div>
    );
  }

  // Lab result - show key values
  if (type === "lab_result") {
    const tests = data.results || data.tests || [];
    if (!tests.length) return null;
    return (
      <div className="mt-1">
        {tests.slice(0, 2).map((t: any, i: number) => (
          <p key={i} className="text-xs text-cyan-700">
            🔬 {t.name || t.test}: {t.value} {t.unit || ""}
          </p>
        ))}
      </div>
    );
  }

  return null;
}
