import DashboardLayout from "@/components/DashboardLayout";
import QRScanner from "@/components/QRScanner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, Camera, CheckCircle2, ClipboardCheck, FileText, Pill, RotateCcw, ScanLine, ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearch } from "wouter";
import { toast } from "sonner";

type TrustLevel = "green" | "yellow" | "red";

const trustBadgeConfig = {
  green: { icon: ShieldCheck, bg: "bg-emerald-50 border-emerald-300", iconColor: "text-emerald-600", title: "Verified" },
  yellow: { icon: ShieldAlert, bg: "bg-amber-50 border-amber-300", iconColor: "text-amber-600", title: "Verified with warnings" },
  red: { icon: ShieldX, bg: "bg-red-50 border-red-300", iconColor: "text-red-600", title: "Not verified" },
};

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
  const subjects = credentials.map((credential: any) => credential?.credentialSubject ?? credential?.vc?.credentialSubject ?? {});
  const patient = subjects.find((subject: any) => subject.patient)?.patient ?? subjects[0]?.patient ?? {};
  const allergies = flatten(subjects.map((subject: any) => subject.critical?.allergies ?? subject.clinical?.allergies ?? []));
  const medications = flatten(subjects.map((subject: any) => subject.critical?.medications ?? subject.clinical?.medications ?? []));

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

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Subject</CardTitle></CardHeader>
              <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
                <div><span className="text-muted-foreground">Name</span><p className="font-medium">{patient.nameTh || patient.name || patient.nameEn || subjects[0]?.trustcareSubjectId || "Unknown"}</p></div>
                <div><span className="text-muted-foreground">Holder DID</span><p className="font-mono text-xs break-all">{result.holderDid || subjects[0]?.id || "-"}</p></div>
                <div><span className="text-muted-foreground">Issuer</span><p className="font-medium">{result.issuer || credentials[0]?.issuer?.name || credentials[0]?.issuer?.id || "-"}</p></div>
                <div><span className="text-muted-foreground">Credentials</span><p className="font-medium">{credentials.length}</p></div>
              </CardContent>
            </Card>

            {allergies.length > 0 && (
              <Card className="border-red-200 bg-red-50/30">
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2 text-red-700"><AlertTriangle className="h-4 w-4" />Allergies</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {allergies.map((item: any, index) => <p key={index} className="text-sm">{item.substance || item.name || JSON.stringify(item)}</p>)}
                </CardContent>
              </Card>
            )}

            {medications.length > 0 && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Pill className="h-4 w-4 text-blue-600" />Medications</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {medications.map((item: any, index) => <p key={index} className="text-sm">{item.name || item.medicationCodeableConcept?.text || JSON.stringify(item)}</p>)}
                </CardContent>
              </Card>
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
