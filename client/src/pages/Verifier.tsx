import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, CheckCircle2, ClipboardCheck, FileText, Pill, RotateCcw, ScanLine, ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type TrustLevel = "green" | "yellow" | "red";

const trustBadgeConfig = {
  green: { icon: ShieldCheck, bg: "bg-emerald-50 border-emerald-300", iconColor: "text-emerald-600", title: "Verified" },
  yellow: { icon: ShieldAlert, bg: "bg-amber-50 border-amber-300", iconColor: "text-amber-600", title: "Verified with warnings" },
  red: { icon: ShieldX, bg: "bg-red-50 border-red-300", iconColor: "text-red-600", title: "Not verified" },
};

export default function Verifier() {
  const [vpInput, setVpInput] = useState("");
  const verify = trpc.verifier.verify.useMutation({
    onSuccess: (data) => toast[data.verified ? "success" : "error"](data.verified ? "ตรวจสอบสำเร็จ" : "ตรวจสอบไม่ผ่าน"),
    onError: (error) => toast.error(error.message),
  });

  const result = verify.data as any;
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">ตรวจสอบใบรับรอง</h1>
            <p className="text-muted-foreground text-sm mt-1">Verify JSON VP or JWT VC/VP using the backend trust pipeline.</p>
          </div>
          {result && (
            <Button variant="outline" onClick={() => { verify.reset(); setVpInput(""); }} className="gap-2">
              <RotateCcw className="h-4 w-4" />ตรวจใหม่
            </Button>
          )}
        </div>

        {!result ? (
          <Card className="max-w-2xl mx-auto">
            <CardContent className="p-8 flex flex-col items-center gap-6">
              <div className="h-28 w-28 rounded-2xl bg-muted flex items-center justify-center border-2 border-dashed border-muted-foreground/20">
                <ScanLine className={`h-12 w-12 text-muted-foreground/50 ${verify.isPending ? "animate-pulse" : ""}`} />
              </div>
              <Textarea
                placeholder="Paste JSON VP, JWT VP, or JWT VC"
                className="min-h-[180px] font-mono text-xs"
                value={vpInput}
                onChange={(event) => setVpInput(event.target.value)}
              />
              <Button onClick={() => verify.mutate({ vpUrl: vpInput })} disabled={!vpInput || verify.isPending} className="w-full gap-2">
                <ClipboardCheck className="h-4 w-4" />
                {verify.isPending ? "กำลังตรวจสอบ..." : "เริ่มตรวจสอบ"}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4 max-w-4xl">
            <TrustBadge level={trustLevel} warnings={result.warnings} errors={result.errors} />

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
