import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScanLine, ShieldCheck, ShieldAlert, ShieldX, AlertTriangle, Pill, FileText, Activity, RotateCcw, ClipboardCheck } from "lucide-react";
import { useState, useCallback } from "react";
import { toast } from "sonner";

type TrustLevel = "green" | "yellow" | "red" | null;

interface VerifiedResult {
  trustLevel: TrustLevel;
  patient: { name: string; id: string };
  allergies: { substance: string; severity: string; reaction: string }[];
  medications: { name: string; frequency: string }[];
  conditions: { name: string; code: string; status: string }[];
  labs: { name: string; value: string; status: string; date: string }[];
  issuer: string;
  issuedAt: string;
  expiresAt?: string;
  reason?: string;
}

export default function Verifier() {
  const [scanning, setScanning] = useState(false);
  const [vpUrl, setVpUrl] = useState("");
  const [verifiedData, setVerifiedData] = useState<VerifiedResult | null>(null);

  const determineTrustLevel = useCallback((data: any): TrustLevel => {
    // Trust badge logic: green = valid & not expiring, yellow = valid but expiring within 30 days, red = invalid/revoked/expired
    if (!data || data.status === "revoked" || data.status === "invalid") return "red";
    if (data.expiresAt) {
      const expiryDate = new Date(data.expiresAt);
      const now = new Date();
      if (expiryDate < now) return "red";
      const daysUntilExpiry = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      if (daysUntilExpiry <= 30) return "yellow";
    }
    return "green";
  }, []);

  const handleVerify = useCallback(async () => {
    setScanning(true);
    try {
      // Simulate VP verification - in production this calls backend verify endpoint
      await new Promise(r => setTimeout(r, 1800));

      // Simulated verified data from VP
      const mockResult = {
        status: "valid",
        expiresAt: "2025-06-15",
        patient: { name: "สมชาย ใจดี", id: "1-3100-12345-67-8" },
        allergies: [
          { substance: "Penicillin", severity: "high", reaction: "Anaphylaxis" },
          { substance: "Sulfonamides", severity: "moderate", reaction: "Skin rash" },
        ],
        medications: [
          { name: "Metformin 500mg", frequency: "วันละ 2 ครั้ง หลังอาหาร" },
          { name: "Amlodipine 5mg", frequency: "วันละ 1 ครั้ง เช้า" },
          { name: "Atorvastatin 20mg", frequency: "วันละ 1 ครั้ง ก่อนนอน" },
        ],
        conditions: [
          { name: "เบาหวานชนิดที่ 2", code: "E11", status: "active" },
          { name: "ความดันโลหิตสูง", code: "I10", status: "active" },
        ],
        labs: [
          { name: "HbA1c", value: "7.8%", status: "abnormal", date: "2024-12-15" },
          { name: "Creatinine", value: "1.1 mg/dL", status: "normal", date: "2024-12-15" },
          { name: "LDL Cholesterol", value: "145 mg/dL", status: "abnormal", date: "2024-12-15" },
        ],
        issuer: "โรงพยาบาล Trustcare Central",
        issuedAt: "2024-12-20",
      };

      const trustLevel = determineTrustLevel(mockResult);
      setVerifiedData({
        trustLevel,
        patient: mockResult.patient,
        allergies: mockResult.allergies,
        medications: mockResult.medications,
        conditions: mockResult.conditions,
        labs: mockResult.labs,
        issuer: mockResult.issuer,
        issuedAt: mockResult.issuedAt,
        expiresAt: mockResult.expiresAt,
      });
      toast.success("ตรวจสอบเสร็จสิ้น");
    } catch {
      toast.error("ไม่สามารถตรวจสอบได้ กรุณาลองใหม่");
    } finally {
      setScanning(false);
    }
  }, [determineTrustLevel]);

  const resetVerification = () => {
    setVerifiedData(null);
    setVpUrl("");
  };

  const trustBadgeConfig = {
    green: { icon: ShieldCheck, bg: "bg-emerald-50 border-emerald-300", iconColor: "text-emerald-600", titleColor: "text-emerald-800", descColor: "text-emerald-600", title: "ใบรับรองถูกต้อง", desc: "ข้อมูลได้รับการยืนยันและยังไม่หมดอายุ" },
    yellow: { icon: ShieldAlert, bg: "bg-amber-50 border-amber-300", iconColor: "text-amber-600", titleColor: "text-amber-800", descColor: "text-amber-600", title: "ใบรับรองใกล้หมดอายุ", desc: "ข้อมูลถูกต้องแต่ใบรับรองจะหมดอายุเร็วๆ นี้" },
    red: { icon: ShieldX, bg: "bg-red-50 border-red-300", iconColor: "text-red-600", titleColor: "text-red-800", descColor: "text-red-600", title: "ใบรับรองไม่ถูกต้อง", desc: "ไม่สามารถยืนยันข้อมูลได้ หรือใบรับรองหมดอายุ/ถูกเพิกถอน" },
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">ตรวจสอบใบรับรอง</h1>
            <p className="text-muted-foreground text-sm mt-1">Verifier Portal — สแกน QR หรือรับ Verifiable Presentation</p>
          </div>
          {verifiedData && (
            <Button variant="outline" onClick={resetVerification} className="gap-2">
              <RotateCcw className="h-4 w-4" />ตรวจสอบรายใหม่
            </Button>
          )}
        </div>

        {!verifiedData ? (
          <Card className="max-w-lg mx-auto">
            <CardContent className="p-8 flex flex-col items-center gap-6">
              <div className="h-32 w-32 rounded-2xl bg-muted flex items-center justify-center border-2 border-dashed border-muted-foreground/20">
                <ScanLine className={`h-12 w-12 text-muted-foreground/50 ${scanning ? "animate-pulse" : ""}`} />
              </div>
              <div className="text-center">
                <h3 className="font-medium">สแกน QR Code ของผู้ป่วย</h3>
                <p className="text-sm text-muted-foreground mt-1">หรือวาง Verifiable Presentation URL</p>
              </div>
              <Input
                placeholder="วาง VP URL ที่นี่..."
                className="text-center"
                value={vpUrl}
                onChange={(e) => setVpUrl(e.target.value)}
              />
              <Button onClick={handleVerify} disabled={scanning} className="w-full gap-2">
                {scanning ? (
                  <>
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    กำลังตรวจสอบ...
                  </>
                ) : (
                  <>
                    <ClipboardCheck className="h-4 w-4" />
                    เริ่มตรวจสอบ
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4 max-w-3xl">
            {/* Trust Badge - Single indicator with exactly 3 states */}
            {verifiedData.trustLevel && (() => {
              const cfg = trustBadgeConfig[verifiedData.trustLevel];
              const TrustIcon = cfg.icon;
              return (
                <Card className={`border-2 ${cfg.bg}`}>
                  <CardContent className="p-5 flex items-center gap-4">
                    <TrustIcon className={`h-10 w-10 ${cfg.iconColor} shrink-0`} />
                    <div className="flex-1">
                      <h3 className={`font-semibold text-lg ${cfg.titleColor}`}>{cfg.title}</h3>
                      <p className={`text-sm ${cfg.descColor}`}>{cfg.desc}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        ออกโดย: {verifiedData.issuer} | วันที่ออก: {verifiedData.issuedAt}
                        {verifiedData.expiresAt && ` | หมดอายุ: ${verifiedData.expiresAt}`}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            {/* Patient Info */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">ข้อมูลผู้ป่วย</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-lg font-semibold text-primary">{verifiedData.patient.name.charAt(0)}</span>
                  </div>
                  <div>
                    <p className="font-medium">{verifiedData.patient.name}</p>
                    <p className="text-sm text-muted-foreground">เลขบัตร: {verifiedData.patient.id}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Clinical Data - Risk Ordered: Allergy → Medications → Conditions → Labs */}
            {verifiedData.allergies?.length > 0 && (
              <Card className="border-red-200 bg-red-50/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2 text-red-700">
                    <AlertTriangle className="h-4 w-4" />
                    การแพ้ยา/สารก่อภูมิแพ้
                    <Badge variant="destructive" className="ml-2 text-[10px]">สำคัญ</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {verifiedData.allergies.map((a, i) => (
                    <div key={i} className="flex items-center justify-between py-2.5 border-b border-red-100 last:border-0">
                      <div>
                        <p className="font-medium text-sm text-red-800">{a.substance}</p>
                        <p className="text-xs text-red-600/80">ปฏิกิริยา: {a.reaction}</p>
                      </div>
                      <Badge variant="destructive" className="text-[10px]">
                        {a.severity === "high" ? "รุนแรง" : "ปานกลาง"}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {verifiedData.medications?.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Pill className="h-4 w-4 text-blue-600" />ยาที่ใช้ปัจจุบัน
                    <Badge variant="secondary" className="ml-2 text-[10px]">{verifiedData.medications.length} รายการ</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {verifiedData.medications.map((m, i) => (
                    <div key={i} className="flex items-center justify-between py-2.5 border-b last:border-0">
                      <p className="text-sm font-medium">{m.name}</p>
                      <p className="text-xs text-muted-foreground">{m.frequency}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {verifiedData.conditions?.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4 text-violet-600" />โรคประจำตัว
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {verifiedData.conditions.map((c, i) => (
                    <div key={i} className="flex items-center justify-between py-2.5 border-b last:border-0">
                      <div>
                        <p className="text-sm font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">ICD-10: {c.code}</p>
                      </div>
                      <Badge variant={c.status === "active" ? "default" : "secondary"} className="text-[10px]">
                        {c.status === "active" ? "กำลังรักษา" : "หายแล้ว"}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {verifiedData.labs?.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Activity className="h-4 w-4 text-amber-600" />ผลตรวจทางห้องปฏิบัติการ
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {verifiedData.labs.map((l, i) => (
                    <div key={i} className="flex items-center justify-between py-2.5 border-b last:border-0">
                      <div>
                        <p className="text-sm font-medium">{l.name}</p>
                        <p className="text-xs text-muted-foreground">{l.date}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-medium ${l.status === "abnormal" ? "text-amber-600" : ""}`}>{l.value}</p>
                        {l.status === "abnormal" && (
                          <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-300">ผิดปกติ</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
