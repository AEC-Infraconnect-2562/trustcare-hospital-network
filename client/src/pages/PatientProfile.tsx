import { useState, useRef, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { CredentialRenderer } from "@/components/CredentialRenderer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Camera,
  Upload,
  User,
  Mail,
  Phone,
  IdCard,
  Building2,
  Check,
  QrCode,
  ChevronDown,
  ChevronUp,
  Eye,
  Printer,
  Download,
  Share2,
  Shield,
  Fingerprint,
  X,
  BadgeCheck,
  Stethoscope,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode";
import { useWebAuthn } from "@/hooks/useWebAuthn";
import { exportWalletCardPdf } from "@/lib/pdfExport";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

// Role-based identity card type mapping
const ROLE_IDENTITY_TYPES: Record<string, { cardTypes: string[]; label: string; icon: any }> = {
  patient: { cardTypes: ["identity"], label: "บัตรประจำตัวผู้ป่วย", icon: BadgeCheck },
  doctor: { cardTypes: ["identity"], label: "บัตรประจำตัวแพทย์", icon: Stethoscope },
  nurse: { cardTypes: ["identity"], label: "บัตรประจำตัวพยาบาล", icon: ShieldCheck },
  system_admin: { cardTypes: ["identity"], label: "บัตรประจำตัวผู้ดูแลระบบ", icon: Shield },
  hospital_admin: { cardTypes: ["identity"], label: "บัตรประจำตัวผู้ดูแลโรงพยาบาล", icon: Building2 },
  maker: { cardTypes: ["identity"], label: "บัตรประจำตัว Maker", icon: BadgeCheck },
  checker: { cardTypes: ["identity"], label: "บัตรประจำตัว Checker", icon: BadgeCheck },
  integration_engineer: { cardTypes: ["identity"], label: "บัตรประจำตัววิศวกรระบบ", icon: Shield },
};

const ROLE_LABELS: Record<string, string> = {
  system_admin: "ผู้ดูแลระบบ",
  hospital_admin: "ผู้ดูแลโรงพยาบาล",
  maker: "Maker",
  checker: "Checker",
  doctor: "แพทย์",
  nurse: "พยาบาล",
  integration_engineer: "วิศวกรระบบ",
  patient: "ผู้ป่วย",
};

export default function PatientProfile() {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  // VC/VP State
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
  const [selectedCard, setSelectedCard] = useState<any>(null);
  const [qrMode, setQrMode] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [presentation, setPresentation] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [disclosureFields, setDisclosureFields] = useState<Record<string, boolean>>({});

  const webAuthn = useWebAuthn();

  const uploadPhotoMutation = trpc.users.uploadPhoto.useMutation({
    onSuccess: (data) => {
      toast.success("อัปโหลดรูปถ่ายสำเร็จ", { description: "รูปถ่ายของคุณจะแสดงในเอกสารรับรอง" });
      setPreviewUrl(data.url);
      utils.auth.me.invalidate();
    },
    onError: (err) => {
      toast.error("อัปโหลดไม่สำเร็จ", { description: err.message });
    },
  });

  // Fetch wallet cards (identity cards only)
  const { data: grouped, isLoading: cardsLoading } = trpc.wallet.cardsByCategory.useQuery();

  const presentMutation = trpc.wallet.present.useMutation({
    onSuccess: async (data) => {
      setPresentation(data);
      const qr = await QRCode.toDataURL(data.qrData, { margin: 1, width: 240 });
      setQrDataUrl(qr);
      setQrMode(true);
      toast.success("สร้าง VP QR สำเร็จ");
    },
    onError: (error) => toast.error(error.message),
  });

  // Filter only identity cards based on user's role
  const identityCards = useMemo(() => {
    if (!grouped) return [];
    const allCards = Object.values(grouped).flat() as any[];
    const systemRole = (user as any)?.systemRole || "patient";
    const roleConfig = ROLE_IDENTITY_TYPES[systemRole] || ROLE_IDENTITY_TYPES.patient;
    return allCards.filter((card: any) => roleConfig.cardTypes.includes(card.cardType));
  }, [grouped, user]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("รูปแบบไฟล์ไม่ถูกต้อง", { description: "รองรับเฉพาะ JPEG, PNG, WebP" });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("ไฟล์ใหญ่เกินไป", { description: "ขนาดไฟล์ต้องไม่เกิน 2MB" });
      return;
    }

    setUploading(true);
    try {
      const resizedBase64 = await resizeImage(file, 400, 400);
      const mimeType = file.type as "image/jpeg" | "image/png" | "image/webp";
      await uploadPhotoMutation.mutateAsync({ photoBase64: resizedBase64, mimeType });
    } catch (err: any) {
      toast.error("เกิดข้อผิดพลาด", { description: err.message || "ไม่สามารถอัปโหลดรูปได้" });
    } finally {
      setUploading(false);
    }
  };

  const handleGenerateQR = useCallback(async () => {
    if (!selectedCard) return;
    if (webAuthn.isRegistered) {
      const ok = await webAuthn.authenticate();
      if (!ok) {
        toast.error(webAuthn.error || "ยืนยันตัวตนไม่สำเร็จ กรุณาลองอีกครั้ง");
        return;
      }
    }
    presentMutation.mutate({ cardId: selectedCard.id });
  }, [selectedCard, presentMutation, webAuthn]);

  const handleShareClick = useCallback(() => {
    if (!selectedCard) return;
    const data = selectedCard.credentialData || {};
    const fields: Record<string, boolean> = {};
    Object.keys(data).forEach((k) => { fields[k] = true; });
    setDisclosureFields(fields);
    setShareOpen(true);
  }, [selectedCard]);

  const handleShareConfirm = useCallback(() => {
    const selectedFields = Object.entries(disclosureFields).filter(([, v]) => v).map(([k]) => k);
    if (selectedFields.length === 0) {
      toast.error("กรุณาเลือกข้อมูลอย่างน้อย 1 รายการ");
      return;
    }
    toast.success(`แชร์ข้อมูล ${selectedFields.length} รายการ (Selective Disclosure)`);
    setShareOpen(false);
    if (selectedCard) presentMutation.mutate({ cardId: selectedCard.id });
  }, [disclosureFields, selectedCard, presentMutation]);

  const toggleExpand = (cardId: number) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  };

  const currentAvatarUrl = previewUrl || (user as any)?.avatarUrl;
  const systemRole = (user as any)?.systemRole || "patient";
  const roleConfig = ROLE_IDENTITY_TYPES[systemRole] || ROLE_IDENTITY_TYPES.patient;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <User className="h-6 w-6 text-primary" />
            โปรไฟล์
          </h1>
          <p className="text-muted-foreground mt-1">จัดการข้อมูลส่วนตัว รูปถ่าย และบัตรประจำตัว</p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left Column: Profile Info */}
          <div className="xl:col-span-1 space-y-6">
            {/* Photo Upload Section */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Camera className="h-4 w-4" />
                  รูปถ่ายประจำตัว
                </CardTitle>
                <CardDescription className="text-xs">
                  แสดงในบัตรประจำตัวและเอกสารรับรอง
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center gap-4">
                  <div className="relative group">
                    <Avatar className="h-28 w-28 border-4 border-muted">
                      {currentAvatarUrl && <AvatarImage src={currentAvatarUrl} alt="Profile photo" />}
                      <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                        {user?.name?.charAt(0)?.toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      disabled={uploading}
                    >
                      <Camera className="h-6 w-6 text-white" />
                    </button>
                  </div>
                  <div className="text-center space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      {uploading ? (
                        <>
                          <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          กำลังอัปโหลด...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          เลือกรูปถ่าย
                        </>
                      )}
                    </Button>
                    {currentAvatarUrl && (
                      <div className="flex items-center justify-center gap-1 text-xs text-green-600">
                        <Check className="h-3 w-3" />
                        <span>มีรูปถ่ายแล้ว</span>
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground">
                      JPEG, PNG, WebP • ไม่เกิน 2MB
                    </p>
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </CardContent>
            </Card>

            {/* Personal Info Section */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <User className="h-4 w-4" />
                  ข้อมูลส่วนตัว
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <InfoRow icon={User} label="ชื่อ-นามสกุล" value={user?.name || "—"} />
                <InfoRow icon={Mail} label="อีเมล" value={(user as any)?.email || "—"} />
                <InfoRow icon={Phone} label="โทรศัพท์" value={(user as any)?.phone || "—"} />
                <InfoRow icon={IdCard} label="เลขบัตรประชาชน" value={(user as any)?.thaiId ? maskThaiId((user as any).thaiId) : "—"} />
                <InfoRow icon={Building2} label="โรงพยาบาล" value={(user as any)?.hospitalName || "TrustCare Network"} />
                <Separator className="my-2" />
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{ROLE_LABELS[systemRole] || systemRole}</Badge>
                  <span className="text-xs text-muted-foreground">บทบาทในระบบ</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Identity VC/VP Cards */}
          <div className="xl:col-span-2 space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <roleConfig.icon className="h-4 w-4 text-primary" />
                  {roleConfig.label}
                </CardTitle>
                <CardDescription className="text-xs">
                  Verifiable Credential (VC) บัตรประจำตัวของคุณ — กด Expand เพื่อดูรายละเอียดและสร้าง QR Code
                </CardDescription>
              </CardHeader>
              <CardContent>
                {cardsLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-32 w-full rounded-xl" />
                    <Skeleton className="h-32 w-full rounded-xl" />
                  </div>
                ) : identityCards.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <BadgeCheck className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">ยังไม่มีบัตรประจำตัวในระบบ</p>
                    <p className="text-xs mt-1">บัตรจะถูกออกให้เมื่อลงทะเบียนเข้ารับบริการ</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {identityCards.map((card: any) => (
                      <IdentityCardItem
                        key={card.id}
                        card={card}
                        expanded={expandedCards.has(card.id)}
                        onToggle={() => toggleExpand(card.id)}
                        onGenerateQR={() => {
                          setSelectedCard(card);
                          setQrMode(false);
                          setQrDataUrl("");
                          setPresentation(null);
                          setDetailOpen(true);
                        }}
                        avatarUrl={currentAvatarUrl}
                        systemRole={systemRole}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Photo Usage Info */}
            <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
              <CardContent className="p-4">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">รูปถ่ายจะถูกใช้ใน:</p>
                <ul className="mt-2 space-y-1 text-sm text-blue-800 dark:text-blue-200">
                  <li>• บัตรประจำตัว (Identity Card VC)</li>
                  <li>• ใบรับรองแพทย์ (Medical Certificate)</li>
                  <li>• เอกสารส่งต่อผู้ป่วย (Referral Document)</li>
                  <li>• Wallet Card แสดงในกระเป๋าสุขภาพ</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Card Detail / QR Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
          {selectedCard && !qrMode && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <BadgeCheck className="h-5 w-5 text-primary" />
                  {selectedCard.displayName}
                </DialogTitle>
                <DialogDescription>
                  Verifiable Credential — {selectedCard.credentialStatus === "active" ? "ใช้งานได้" : selectedCard.credentialStatus}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2 overflow-y-auto flex-1 overscroll-contain touch-pan-y" style={{ WebkitOverflowScrolling: "touch" }}>
                {selectedCard.credentialData ? (
                  <CredentialRenderer
                    credentialData={selectedCard.credentialData}
                    type={selectedCard.credentialType || selectedCard.cardType}
                    status={selectedCard.credentialStatus || "active"}
                    credentialId={String(selectedCard.credentialId)}
                    issuedAt={selectedCard.issuedAt || selectedCard.createdAt}
                    expiresAt={selectedCard.expiresAt}
                    hospitalName={selectedCard.issuerHospitalName}
                    patientPhotoUrl={currentAvatarUrl}
                  />
                ) : (
                  <div className="rounded-xl p-4 text-white bg-gradient-to-br from-blue-600 to-blue-800">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center">
                        <BadgeCheck className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{selectedCard.displayName}</p>
                        <p className="text-xs opacity-80">{selectedCard.issuerHospitalName || "TrustCare Network"}</p>
                      </div>
                    </div>
                    <Separator className="bg-white/20 mb-3" />
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="opacity-60">สถานะ</p>
                        <p className="opacity-90">{selectedCard.credentialStatus === "active" ? "ใช้งานได้" : selectedCard.credentialStatus}</p>
                      </div>
                      <div>
                        <p className="opacity-60">สร้างเมื่อ</p>
                        <p className="opacity-90">{new Date(selectedCard.createdAt).toLocaleDateString("th-TH")}</p>
                      </div>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={handleGenerateQR}
                    disabled={presentMutation.isPending || webAuthn.isAuthenticating || selectedCard.credentialStatus !== "active"}
                    className="gap-2"
                  >
                    {webAuthn.isRegistered && <Fingerprint className="h-4 w-4" />}
                    <QrCode className="h-4 w-4" />
                    {presentMutation.isPending || webAuthn.isAuthenticating ? "กำลังยืนยัน..." : webAuthn.isRegistered ? "ยืนยัน + QR" : "สร้าง VP QR"}
                  </Button>
                  <Button variant="outline" className="gap-2" onClick={handleShareClick}>
                    <Share2 className="h-4 w-4" />
                    แชร์ (Selective)
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => {
                      exportWalletCardPdf({
                        title: selectedCard.displayName || selectedCard.title,
                        type: selectedCard.credentialType || selectedCard.cardType,
                        issuedAt: selectedCard.issuedAt || selectedCard.createdAt,
                        expiresAt: selectedCard.expiresAt,
                        issuerName: selectedCard.issuerHospitalName || "Trustcare Hospital",
                        credentialId: selectedCard.credentialId,
                        credentialData: selectedCard.credentialData as Record<string, any> | null,
                      });
                      toast.success("ดาวน์โหลด PDF สำเร็จ");
                    }}
                  >
                    <Download className="h-4 w-4" />
                    PDF
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
                  <p><span className="font-medium">Credential ID:</span> #{selectedCard.credentialId}</p>
                  <p><span className="font-medium">Card Type:</span> {selectedCard.cardType}</p>
                  {selectedCard.lastPresentedAt && (
                    <p><span className="font-medium">แสดงล่าสุด:</span> {new Date(selectedCard.lastPresentedAt).toLocaleString("th-TH")}</p>
                  )}
                </div>
                <Button variant="outline" onClick={() => setDetailOpen(false)} className="w-full mt-3 gap-2">
                  <X className="h-4 w-4" />
                  ปิด
                </Button>
              </div>
            </>
          )}
          {selectedCard && qrMode && (
            <>
              <DialogHeader>
                <DialogTitle className="text-center">Verifiable Presentation QR</DialogTitle>
                <DialogDescription className="text-center">{selectedCard.displayName}</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col items-center gap-4 py-4 overflow-y-auto flex-1 overscroll-contain touch-pan-y" style={{ WebkitOverflowScrolling: "touch" }}>
                <div className="rounded-lg border p-3 bg-white shadow-sm">
                  <img src={qrDataUrl} alt="VP QR" className="h-56 w-56" />
                </div>
                <div className="text-center space-y-1 max-w-full">
                  <p className="text-sm font-medium">{selectedCard.displayName}</p>
                  <p className="text-xs text-muted-foreground font-mono break-all">{presentation?.presentationId}</p>
                  {presentation?.expiresAt && (
                    <p className="text-xs text-muted-foreground">หมดอายุ: {new Date(presentation.expiresAt).toLocaleString("th-TH")}</p>
                  )}
                </div>
                <div className="flex gap-3 w-full">
                  <Button variant="outline" onClick={() => setQrMode(false)} className="flex-1 gap-2">
                    <Eye className="h-4 w-4" />
                    ดูรายละเอียด
                  </Button>
                  <Button variant="outline" onClick={() => { window.print(); toast.info("กำลังพิมพ์ VP QR"); }} className="flex-1 gap-2">
                    <Printer className="h-4 w-4" />
                    พิมพ์ QR
                  </Button>
                </div>
                <Button variant="outline" onClick={() => { setQrMode(false); setDetailOpen(false); }} className="w-full gap-2">
                  <X className="h-4 w-4" />
                  ปิด
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Selective Disclosure Dialog */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Selective Disclosure
            </DialogTitle>
            <DialogDescription>เลือกข้อมูลที่ต้องการแชร์ (SD-JWT)</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 max-h-[300px] overflow-y-auto">
            {Object.keys(disclosureFields).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">ไม่มีข้อมูลใน Credential นี้</p>
            ) : (
              Object.entries(disclosureFields).map(([field, checked]) => (
                <div key={field} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                  <Checkbox
                    id={`field-${field}`}
                    checked={checked}
                    onCheckedChange={(v) => setDisclosureFields((prev) => ({ ...prev, [field]: !!v }))}
                  />
                  <Label htmlFor={`field-${field}`} className="text-sm cursor-pointer flex-1">{field}</Label>
                </div>
              ))
            )}
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setShareOpen(false)} className="flex-1">ยกเลิก</Button>
            <Button onClick={handleShareConfirm} className="flex-1 gap-2">
              <Share2 className="h-4 w-4" />
              แชร์
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

// ─── Identity Card Expandable Item ────────────────────────────────────────────
function IdentityCardItem({
  card,
  expanded,
  onToggle,
  onGenerateQR,
  avatarUrl,
  systemRole,
}: {
  card: any;
  expanded: boolean;
  onToggle: () => void;
  onGenerateQR: () => void;
  avatarUrl: string | null;
  systemRole: string;
}) {
  const isActive = card.credentialStatus === "active";
  const isExpired = card.credentialStatus === "expired";
  const isRevoked = card.credentialStatus === "revoked";

  return (
    <Collapsible open={expanded} onOpenChange={onToggle}>
      <div className={`rounded-xl border overflow-hidden transition-all ${isRevoked ? "opacity-60 border-red-200" : isExpired ? "opacity-70 border-amber-200" : "border-border hover:border-primary/30"}`}>
        {/* Card Header (always visible) */}
        <CollapsibleTrigger asChild>
          <button className="w-full p-4 flex items-center gap-4 text-left hover:bg-muted/30 transition-colors">
            <div className="h-14 w-11 rounded-lg overflow-hidden border border-gray-200 shadow-sm shrink-0 bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              ) : (
                <User className="h-5 w-5 text-white" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{card.displayName}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant={isActive ? "default" : isRevoked ? "destructive" : "secondary"} className="text-[10px] h-5">
                  {isActive ? "Active" : isRevoked ? "Revoked" : "Expired"}
                </Badge>
                <span className="text-[10px] text-muted-foreground">
                  {card.issuerHospitalName || "TrustCare Network"}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                ออกเมื่อ: {new Date(card.issuedAt || card.createdAt).toLocaleDateString("th-TH")}
                {card.expiresAt && ` • หมดอายุ: ${new Date(card.expiresAt).toLocaleDateString("th-TH")}`}
              </p>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => { e.stopPropagation(); onGenerateQR(); }}
                disabled={!isActive}
              >
                <QrCode className="h-4 w-4 text-primary" />
              </Button>
              {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </div>
          </button>
        </CollapsibleTrigger>

        {/* Expanded Content */}
        <CollapsibleContent>
          <div className="px-4 pb-4 border-t">
            <div className="pt-4">
              {card.credentialData ? (
                <CredentialRenderer
                  credentialData={card.credentialData}
                  type={card.credentialType || card.cardType}
                  status={card.credentialStatus || "active"}
                  credentialId={String(card.credentialId)}
                  issuedAt={card.issuedAt || card.createdAt}
                  expiresAt={card.expiresAt}
                  hospitalName={card.issuerHospitalName}
                  patientPhotoUrl={avatarUrl}
                />
              ) : (
                <div className="rounded-xl p-4 text-white bg-gradient-to-br from-blue-600 to-blue-800">
                  <div className="flex items-center gap-3">
                    <BadgeCheck className="h-8 w-8" />
                    <div>
                      <p className="font-semibold">{card.displayName}</p>
                      <p className="text-xs opacity-80">Credential ID: #{card.credentialId}</p>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex gap-2 mt-4">
                <Button size="sm" className="gap-1.5" onClick={onGenerateQR} disabled={!isActive}>
                  <QrCode className="h-3.5 w-3.5" />
                  สร้าง VP QR
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={onGenerateQR} disabled={!isActive}>
                  <Eye className="h-3.5 w-3.5" />
                  ดูรายละเอียด
                </Button>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// ─── Helper Components ────────────────────────────────────────────────────────
function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 p-2.5 rounded-lg bg-muted/50">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-sm font-medium truncate">{value}</p>
      </div>
    </div>
  );
}

function maskThaiId(id: string): string {
  if (id.length < 13) return id;
  return `${id.slice(0, 1)}-${id.slice(1, 5)}-XXXXX-${id.slice(10, 12)}-${id.slice(12)}`;
}

async function resizeImage(file: File, maxWidth: number, maxHeight: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => {
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const size = Math.min(img.width, img.height);
        const sx = (img.width - size) / 2;
        const sy = (img.height - size) / 2;
        canvas.width = maxWidth;
        canvas.height = maxHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas not supported"));
        ctx.drawImage(img, sx, sy, size, size, 0, 0, maxWidth, maxHeight);
        const dataUrl = canvas.toDataURL(file.type, 0.85);
        const base64 = dataUrl.split(",")[1];
        resolve(base64);
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
