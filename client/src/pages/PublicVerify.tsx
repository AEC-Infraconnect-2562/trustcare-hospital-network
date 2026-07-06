/**
 * PublicVerify - Cross-device QR verification page
 * 
 * This page is accessible WITHOUT login (no DashboardLayout).
 * When a patient shows a QR code on their phone, the verifier scans it
 * with a different device. The QR encodes a URL like:
 *   https://trustcarehealth-xxx.manus.space/verify?vp=VP-xxx
 * 
 * This page extracts the vp param and calls the public verifyQrScan endpoint.
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import QRScanner from "@/components/QRScanner";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ExternalLink,
  FileText,
  Pill,
  RefreshCw,
  ScanLine,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
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

function extractVerificationId(data: string): string {
  // If it's a URL, extract the vp param
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

export default function PublicVerify() {
  const [mode, setMode] = useState<"scan" | "result">("scan");
  const [showScanner, setShowScanner] = useState(false);

  const verifyQr = trpc.verifier.verifyQrScan.useMutation({
    onSuccess: (data) => {
      setMode("result");
      if (data.verified) {
        toast.success("ตรวจสอบสำเร็จ");
      } else {
        toast.error("ตรวจสอบไม่ผ่าน");
      }
    },
    onError: (error) => toast.error(error.message),
  });

  // Auto-verify from URL param (?vp=xxx)
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
      // No param — show scanner
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

  const subjects = credentials.map((c: any) => c?.credentialSubject ?? c?.vc?.credentialSubject ?? {});
  const patient = subjects.find((s: any) => s.patient)?.patient ?? subjects[0]?.patient ?? {};

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
            {patient?.name && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">ข้อมูลผู้ป่วย</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {patient.name && (
                      <div>
                        <p className="text-xs text-muted-foreground">ชื่อ</p>
                        <p className="font-medium">{patient.name}</p>
                      </div>
                    )}
                    {patient.nationalId && (
                      <div>
                        <p className="text-xs text-muted-foreground">เลขบัตร</p>
                        <p className="font-mono">{patient.nationalId.replace(/(\d{1})(\d{4})(\d{5})(\d{2})(\d{1})/, "$1-$2-$3-$4-$5")}</p>
                      </div>
                    )}
                    {patient.dateOfBirth && (
                      <div>
                        <p className="text-xs text-muted-foreground">วันเกิด</p>
                        <p>{patient.dateOfBirth}</p>
                      </div>
                    )}
                    {patient.gender && (
                      <div>
                        <p className="text-xs text-muted-foreground">เพศ</p>
                        <p>{patient.gender === "male" ? "ชาย" : patient.gender === "female" ? "หญิง" : patient.gender}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Credentials */}
            {credentials.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    ใบรับรองที่ตรวจสอบ ({credentials.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {credentials.map((cred: any, i: number) => {
                      const type = cred?.type?.find((t: string) => t !== "VerifiableCredential") || "Credential";
                      const issuer = typeof cred?.issuer === "string" ? cred.issuer : cred?.issuer?.name || cred?.issuer?.id || "Unknown";
                      return (
                        <div key={i} className="flex items-center gap-3 rounded-lg border p-3">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{type}</p>
                            <p className="text-xs text-muted-foreground truncate">Issuer: {issuer}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
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
