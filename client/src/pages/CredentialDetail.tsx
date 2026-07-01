import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft, BadgeCheck, Ban, Calendar, Clock, Copy, ExternalLink, FileJson2,
  Hospital, Printer, QrCode, ShieldCheck, User,
} from "lucide-react";
import QRCode from "qrcode";
import { useCallback, useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { toast } from "sonner";

const typeLabels: Record<string, string> = {
  patient_identity: "บัตรประจำตัวผู้ป่วย",
  consent_receipt: "ใบรับรองความยินยอม",
  patient_summary: "สรุปข้อมูลผู้ป่วย",
  allergy_alert: "แจ้งเตือนการแพ้",
  medication_summary: "สรุปยาที่ใช้",
  referral_vc: "ใบส่งต่อ",
  immunization: "ประวัติวัคซีน",
  medical_certificate: "ใบรับรองแพทย์",
  prescription: "ใบสั่งยา",
  lab_result: "ผลตรวจห้องปฏิบัติการ",
  diagnostic_report: "รายงานวินิจฉัย",
  discharge_summary: "สรุปจำหน่าย",
  insurance_eligibility: "ตรวจสอบสิทธิประกัน",
  claim_package: "ชุดเอกสาร E-Claim",
  claim_receipt: "ใบรับเรื่องเคลม",
  travel_document_verification: "เอกสารยืนยันเพื่อเดินทาง",
  shl_manifest: "Smart Health Link Manifest",
  pharmacy_dispense: "จ่ายยา",
  appointment: "ใบนัดหมาย",
  visa_support_letter: "หนังสือประกอบวีซ่า",
  quotation: "ใบเสนอราคา",
  guarantee_letter: "หนังสือรับรองค่าใช้จ่าย",
  mpi_link_certificate: "ใบรับรองการเชื่อม MPI",
  sync_receipt: "หลักฐาน Sync กลับ HIS",
};

const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  active: { label: "ใช้งาน", color: "text-emerald-700", bgColor: "bg-emerald-50" },
  revoked: { label: "เพิกถอน", color: "text-red-700", bgColor: "bg-red-50" },
  expired: { label: "หมดอายุ", color: "text-amber-700", bgColor: "bg-amber-50" },
  suspended: { label: "ระงับ", color: "text-slate-700", bgColor: "bg-slate-50" },
};

export default function CredentialDetail() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/issuer/:id");
  const credentialId = params?.id ? parseInt(params.id) : 0;

  const { data: credential, isLoading, refetch } = trpc.credential.getById.useQuery(
    { id: credentialId },
    { enabled: credentialId > 0 }
  );

  const [revokeOpen, setRevokeOpen] = useState(false);
  const [revokeReason, setRevokeReason] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [vpDialogOpen, setVpDialogOpen] = useState(false);

  const revokeMutation = trpc.credential.revoke.useMutation({
    onSuccess: () => {
      toast.success("เพิกถอนใบรับรองสำเร็จ");
      setRevokeOpen(false);
      setRevokeReason("");
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const generateQR = useCallback(async () => {
    if (!credential?.sdJwtVc) {
      toast.error("ไม่มี SD-JWT VC สำหรับสร้าง QR");
      return;
    }
    try {
      const url = await QRCode.toDataURL(credential.sdJwtVc.slice(0, 2000), { margin: 1, width: 280 });
      setQrDataUrl(url);
      setVpDialogOpen(true);
    } catch {
      toast.error("VC ขนาดใหญ่เกินไปสำหรับ QR — ใช้ SHL แทน");
    }
  }, [credential]);

  const copyToClipboard = useCallback((text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`คัดลอก ${label} แล้ว`);
  }, []);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </DashboardLayout>
    );
  }

  if (!credential) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <p className="text-red-600 mb-4">ไม่พบข้อมูล Credential</p>
            <Button variant="outline" onClick={() => setLocation("/issuer")}>
              <ArrowLeft className="h-4 w-4 mr-2" />กลับหน้าออกใบรับรอง
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const status = statusConfig[credential.status] || statusConfig.active;
  const credData = credential.credentialData as Record<string, any> | null;

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Back button */}
        <Button variant="ghost" onClick={() => setLocation("/issuer")} className="text-muted-foreground hover:text-foreground -ml-2">
          <ArrowLeft className="h-4 w-4 mr-2" />กลับหน้าออกใบรับรอง
        </Button>

        {/* Header Card */}
        <Card className="overflow-hidden border-0 shadow-md">
          <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                  <BadgeCheck className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold">{typeLabels[credential.type] || credential.type}</h1>
                  <p className="text-sm text-muted-foreground font-mono mt-1">{credential.credentialId}</p>
                </div>
              </div>
              <Badge className={`${status.bgColor} ${status.color} border-0 text-xs px-3 py-1`}>
                {status.label}
              </Badge>
            </div>
          </div>

          <CardContent className="p-6 pt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <InfoItem icon={Calendar} label="วันที่ออก" value={new Date(credential.issuedAt).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" })} />
              <InfoItem icon={Clock} label="หมดอายุ" value={credential.expiresAt ? new Date(credential.expiresAt).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" }) : "ไม่มีวันหมดอายุ"} />
              <InfoItem icon={Hospital} label="โรงพยาบาล" value={`Hospital #${credential.issuerHospitalId}`} />
              <InfoItem icon={User} label="ผู้ป่วย" value={`Patient #${credential.subjectId}`} />
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <Button onClick={generateQR} className="gap-2">
            <QrCode className="h-4 w-4" />สร้าง QR Code
          </Button>
          <Button variant="outline" onClick={() => copyToClipboard(credential.credentialId, "Credential ID")} className="gap-2">
            <Copy className="h-4 w-4" />คัดลอก ID
          </Button>
          {credential.sdJwtVc && (
            <Button variant="outline" onClick={() => copyToClipboard(credential.sdJwtVc!, "SD-JWT VC")} className="gap-2">
              <FileJson2 className="h-4 w-4" />คัดลอก SD-JWT
            </Button>
          )}
          {credential.status === "active" && (
            <Button variant="outline" className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/5" onClick={() => setRevokeOpen(true)}>
              <Ban className="h-4 w-4" />เพิกถอน
            </Button>
          )}
        </div>

        {/* Tabs: Credential Data / SD-JWT / Metadata */}
        <Tabs defaultValue="data">
          <TabsList>
            <TabsTrigger value="data" className="gap-2"><FileJson2 className="h-3.5 w-3.5" />ข้อมูล Credential</TabsTrigger>
            <TabsTrigger value="jwt" className="gap-2"><ShieldCheck className="h-3.5 w-3.5" />SD-JWT VC</TabsTrigger>
            <TabsTrigger value="meta" className="gap-2"><ExternalLink className="h-3.5 w-3.5" />Metadata</TabsTrigger>
          </TabsList>

          <TabsContent value="data" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Credential Subject Data</CardTitle>
              </CardHeader>
              <CardContent>
                {credData ? (
                  <div className="space-y-3">
                    {Object.entries(credData).map(([key, value]) => (
                      <div key={key} className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
                        <span className="text-xs font-mono text-muted-foreground min-w-[140px] pt-0.5">{key}</span>
                        <span className="text-sm break-all">
                          {typeof value === "object" ? (
                            <pre className="text-xs bg-muted/50 rounded p-2 overflow-auto max-h-32">{JSON.stringify(value, null, 2)}</pre>
                          ) : (
                            String(value)
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">ไม่มีข้อมูล Credential Subject</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="jwt" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  SD-JWT Verifiable Credential
                </CardTitle>
              </CardHeader>
              <CardContent>
                {credential.sdJwtVc ? (
                  <div className="space-y-3">
                    <div className="relative">
                      <pre className="max-h-[400px] overflow-auto rounded-lg bg-muted/50 p-4 text-xs font-mono break-all whitespace-pre-wrap">
                        {credential.sdJwtVc}
                      </pre>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="absolute top-2 right-2 h-7 text-xs"
                        onClick={() => copyToClipboard(credential.sdJwtVc!, "SD-JWT VC")}
                      >
                        <Copy className="h-3 w-3 mr-1" />คัดลอก
                      </Button>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                      <span>SD-JWT VC format — สามารถ verify ได้โดย Verifier ที่รองรับ SD-JWT</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">ไม่มี SD-JWT VC สำหรับ Credential นี้</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="meta" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Metadata & Provenance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <MetaItem label="Credential ID" value={credential.credentialId} mono />
                  <MetaItem label="Template ID" value={String(credential.templateId)} />
                  <MetaItem label="Issuer ID" value={String(credential.issuerId)} />
                  <MetaItem label="Hospital ID" value={String(credential.issuerHospitalId)} />
                  <MetaItem label="Subject ID" value={String(credential.subjectId)} />
                  <MetaItem label="Schema Version" value={(credential as any).schemaVersion || "1.0.0"} />
                  <MetaItem label="Document Category" value={credential.documentCategory || "-"} />
                  <MetaItem label="Document Subcategory" value={credential.documentSubcategory || "-"} />
                  {credential.fhirResourceId && <MetaItem label="FHIR Resource ID" value={credential.fhirResourceId} mono />}
                  {credential.revokedAt && <MetaItem label="เพิกถอนเมื่อ" value={new Date(credential.revokedAt).toLocaleString("th-TH")} />}
                  {credential.revocationReason && <MetaItem label="เหตุผลเพิกถอน" value={credential.revocationReason} />}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Revoke Dialog */}
        <Dialog open={revokeOpen} onOpenChange={setRevokeOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>เพิกถอนใบรับรอง</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">กรุณาระบุเหตุผลในการเพิกถอน Credential นี้</p>
              <Input value={revokeReason} onChange={e => setRevokeReason(e.target.value)} placeholder="เหตุผลในการเพิกถอน..." />
              <Button
                variant="destructive"
                className="w-full"
                disabled={!revokeReason || revokeMutation.isPending}
                onClick={() => revokeMutation.mutate({ id: credentialId, reason: revokeReason })}
              >
                {revokeMutation.isPending ? "กำลังดำเนินการ..." : "ยืนยันเพิกถอน"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* QR Dialog */}
        <Dialog open={vpDialogOpen} onOpenChange={setVpDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-center">Credential QR Code</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center gap-4 py-4">
              {qrDataUrl && (
                <div className="rounded-lg border p-3 bg-white">
                  <img src={qrDataUrl} alt="Credential QR" className="h-64 w-64" />
                </div>
              )}
              <p className="text-xs text-muted-foreground text-center max-w-[260px]">
                สแกน QR นี้เพื่อ verify credential — หาก VC ขนาดใหญ่ แนะนำใช้ Smart Health Link แทน
              </p>
              <Button variant="outline" onClick={() => window.print()} className="w-full gap-2">
                <Printer className="h-4 w-4" />พิมพ์ QR
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

function InfoItem({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

function MetaItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="py-2 border-b border-border/50">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{label}</p>
      <p className={`text-sm ${mono ? "font-mono text-xs break-all" : ""}`}>{value}</p>
    </div>
  );
}
