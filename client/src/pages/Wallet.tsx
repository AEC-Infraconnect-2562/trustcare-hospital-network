import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CredentialRenderer } from "@/components/CredentialRenderer";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { DOCUMENT_CATEGORIES, type DocumentCategory } from "@shared/const";
import {
  AlertTriangle, ArrowRightLeft, BadgeCheck, CalendarDays, CreditCard, Eye,
  FileBadge, FileCheck2, FileText, Fingerprint, Globe2, History, Landmark, Link2, Microscope,
  PackageCheck, Pill, Printer, QrCode, ReceiptText, RefreshCcw, ScanLine,
  Shield, Share2, Syringe, User, Wallet as WalletIcon,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import QRCode from "qrcode";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useWebAuthn } from "@/hooks/useWebAuthn";
import { useOfflineWallet } from "@/hooks/useOfflineWallet";
import { useAuth } from "@/_core/hooks/useAuth";
import { Switch } from "@/components/ui/switch";
import { Wifi, WifiOff, CloudDownload, Download } from "lucide-react";
import { exportWalletCardPdf } from "@/lib/pdfExport";

// Avatar URLs for wallet card thumbnails
const AVATAR_URLS = {
  male: "/manus-storage/patient-avatar-male_c0b881f4.png",
  female: "/manus-storage/patient-avatar-female_838fe3a6.png",
};

const PHOTO_TYPES = ["patient_identity", "identity", "medical_certificate"];

const categoryIconMap: Record<string, any> = {
  User, FileText, Pill, Microscope, ArrowRightLeft, ReceiptText, Globe2, RefreshCcw, CalendarDays,
};

const cardTypeConfig: Record<string, { icon: any; bgGradient: string; label: string }> = {
  allergy: { icon: AlertTriangle, bgGradient: "from-red-500 to-red-700", label: "แจ้งเตือนการแพ้" },
  medication: { icon: Pill, bgGradient: "from-blue-500 to-blue-700", label: "สรุปยาที่ใช้" },
  patient_summary: { icon: FileText, bgGradient: "from-emerald-500 to-emerald-700", label: "สรุปข้อมูลผู้ป่วย" },
  consent: { icon: Shield, bgGradient: "from-violet-500 to-violet-700", label: "ใบรับรองความยินยอม" },
  identity: { icon: User, bgGradient: "from-slate-600 to-slate-800", label: "บัตรประจำตัวผู้ป่วย" },
  immunization: { icon: Syringe, bgGradient: "from-amber-500 to-amber-700", label: "ประวัติวัคซีน" },
  referral: { icon: FileText, bgGradient: "from-cyan-500 to-cyan-700", label: "ใบส่งต่อ" },
  medical_certificate: { icon: FileBadge, bgGradient: "from-teal-600 to-teal-800", label: "ใบรับรองแพทย์" },
  prescription: { icon: Pill, bgGradient: "from-sky-600 to-sky-800", label: "ใบสั่งยา" },
  lab_result: { icon: Microscope, bgGradient: "from-lime-600 to-lime-800", label: "ผลตรวจ Lab" },
  diagnostic_report: { icon: ScanLine, bgGradient: "from-indigo-600 to-indigo-800", label: "รายงานวินิจฉัย" },
  discharge_summary: { icon: FileCheck2, bgGradient: "from-green-600 to-green-800", label: "สรุปจำหน่าย" },
  coverage: { icon: Shield, bgGradient: "from-emerald-600 to-emerald-800", label: "สิทธิประกัน" },
  claim: { icon: ReceiptText, bgGradient: "from-rose-600 to-rose-800", label: "E-Claim" },
  travel_document: { icon: Globe2, bgGradient: "from-cyan-600 to-cyan-800", label: "เอกสารเดินทาง" },
  shl_manifest: { icon: QrCode, bgGradient: "from-zinc-600 to-zinc-800", label: "SHL Manifest" },
  pharmacy_dispense: { icon: PackageCheck, bgGradient: "from-blue-600 to-blue-800", label: "จ่ายยา" },
  appointment: { icon: CalendarDays, bgGradient: "from-purple-600 to-purple-800", label: "ใบนัดหมาย" },
  visa_support_letter: { icon: BadgeCheck, bgGradient: "from-fuchsia-600 to-fuchsia-800", label: "หนังสือประกอบวีซ่า" },
  quotation: { icon: FileText, bgGradient: "from-orange-600 to-orange-800", label: "ใบเสนอราคา" },
  guarantee_letter: { icon: Landmark, bgGradient: "from-yellow-600 to-yellow-800", label: "หนังสือรับรองค่าใช้จ่าย" },
  mpi_link_certificate: { icon: Link2, bgGradient: "from-stone-600 to-stone-800", label: "ใบรับรอง MPI" },
  sync_receipt: { icon: RefreshCcw, bgGradient: "from-slate-600 to-slate-800", label: "หลักฐาน Sync" },
};

export default function Wallet() {
  const { data: grouped, isLoading } = trpc.wallet.cardsByCategory.useQuery();
  const { data: superseded, isLoading: supersededLoading } = trpc.wallet.superseded.useQuery();
  const { data: history, isLoading: histLoading } = trpc.wallet.history.useQuery();
  const webAuthn = useWebAuthn();
  const { user: auth } = useAuth();
  const offlineWallet = useOfflineWallet();

  // Auto-sync cards to IndexedDB when online data loads
  const allOnlineCards = useMemo(() => {
    if (!grouped) return [];
    return Object.values(grouped).flat();
  }, [grouped]);

  // Sync to offline storage when cards load (useEffect for side-effects)
  useEffect(() => {
    if (allOnlineCards.length > 0 && offlineWallet.isOnline) {
      offlineWallet.syncCards(allOnlineCards);
    }
  }, [allOnlineCards.length, offlineWallet.isOnline]);

  const [activeCategory, setActiveCategory] = useState<DocumentCategory | "all">("all");
  const [selectedCard, setSelectedCard] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [qrMode, setQrMode] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [presentation, setPresentation] = useState<any>(null);

  const presentMutation = trpc.wallet.present.useMutation({
    onSuccess: async (data) => {
      setPresentation(data);
      const qr = await QRCode.toDataURL(data.qrData, { margin: 1, width: 240 });
      setQrDataUrl(qr);
      setQrMode(true);
      // Cache QR for offline use
      if (selectedCard) {
        offlineWallet.cacheQR(selectedCard.id, data.qrData, data.presentationId, data.expiresAt);
      }
      toast.success("สร้าง VP QR สำเร็จ");
    },
    onError: (error) => toast.error(error.message),
  });

  const categoryCounts = useMemo(() => {
    if (!grouped) return {};
    const counts: Record<string, number> = {};
    for (const [cat, cards] of Object.entries(grouped)) {
      counts[cat] = (cards as any[]).length;
    }
    return counts;
  }, [grouped]);

  const displayCards = useMemo(() => {
    // If offline and no online data, use cached offline cards
    if (!offlineWallet.isOnline && !grouped) {
      if (activeCategory === "all") return offlineWallet.offlineCards;
      return offlineWallet.offlineCards.filter(c => c.documentCategory === activeCategory);
    }
    if (!grouped) return [];
    if (activeCategory === "all") return Object.values(grouped).flat();
    return (grouped as any)[activeCategory] || [];
  }, [grouped, activeCategory, offlineWallet.isOnline, offlineWallet.offlineCards]);

  const totalCards = useMemo(() => {
    if (!grouped) return 0;
    return Object.values(grouped).flat().length;
  }, [grouped]);

  const handleCardClick = useCallback((card: any) => {
    setSelectedCard(card);
    setQrMode(false);
    setQrDataUrl("");
    setPresentation(null);
    setDetailOpen(true);
  }, []);

  const [shareOpen, setShareOpen] = useState(false);
  const [disclosureFields, setDisclosureFields] = useState<Record<string, boolean>>({});

  const handleGenerateQR = useCallback(async () => {
    if (!selectedCard) return;
    // If WebAuthn is registered, require biometric confirmation before showing QR
    if (webAuthn.isRegistered) {
      const ok = await webAuthn.authenticate();
      if (!ok) {
        toast.error(webAuthn.error || "ยืนยันตัวตนไม่สำเร็จ กรุณาลองอีกครั้ง");
        return;
      }
    }
    // If offline, try to load cached QR
    if (!offlineWallet.isOnline) {
      const cached = await offlineWallet.getOfflineQR(selectedCard.id);
      if (cached) {
        setQrDataUrl(cached.qrDataUrl);
        setPresentation({ presentationId: cached.presentationId, expiresAt: cached.expiresAt });
        setQrMode(true);
        toast.info("แสดง QR จากแคช (Offline)");
        return;
      }
      toast.error("ไม่มี QR ที่แคชไว้ กรุณาเชื่อมต่ออินเทอร์เน็ตแล้วสร้าง QR ใหม่");
      return;
    }
    presentMutation.mutate({ cardId: selectedCard.id });
  }, [selectedCard, presentMutation, webAuthn, offlineWallet]);

  const handleShareClick = useCallback(() => {
    if (!selectedCard) return;
    const data = selectedCard.credentialData || {};
    const fields: Record<string, boolean> = {};
    Object.keys(data).forEach(k => { fields[k] = true; });
    setDisclosureFields(fields);
    setShareOpen(true);
  }, [selectedCard]);

  const handleShareConfirm = useCallback(() => {
    const selectedFields = Object.entries(disclosureFields).filter(([, v]) => v).map(([k]) => k);
    if (selectedFields.length === 0) { toast.error("กรุณาเลือกข้อมูลอย่างน้อย 1 รายการ"); return; }
    toast.success(`แชร์ข้อมูล ${selectedFields.length} รายการ (Selective Disclosure)`);
    setShareOpen(false);
    if (selectedCard) presentMutation.mutate({ cardId: selectedCard.id });
  }, [disclosureFields, selectedCard, presentMutation]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <WalletIcon className="h-6 w-6 text-primary" />กระเป๋าสุขภาพ
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Health Cards ทั้งหมด {totalCards} ใบ • {Object.keys(categoryCounts).length} หมวดหมู่</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Offline status indicator */}
            <div className={`flex items-center gap-1.5 border rounded-lg px-2.5 py-1.5 text-xs font-medium ${offlineWallet.isOnline ? "border-emerald-200 text-emerald-700 bg-emerald-50" : "border-amber-200 text-amber-700 bg-amber-50"}`}>
              {offlineWallet.isOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
              {offlineWallet.isOnline ? "Online" : "Offline"}
              {offlineWallet.offlineCardCount > 0 && (
                <span className="ml-1 text-[10px] opacity-70">({offlineWallet.offlineCardCount} cached)</span>
              )}
            </div>
            {webAuthn.isSupported && (
              <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5">
                <Fingerprint className={`h-4 w-4 ${webAuthn.isRegistered ? "text-emerald-600" : "text-muted-foreground"}`} />
                <span className="text-xs font-medium">{webAuthn.isRegistered ? "ปกป้องแล้ว" : "ตั้งค่า Biometric"}</span>
                <Switch
                  checked={webAuthn.isRegistered}
                  onCheckedChange={async (checked) => {
                    if (checked) {
                      const ok = await webAuthn.register(String(auth?.id || "user"), auth?.name || "Patient");
                      if (ok) toast.success("ลงทะเบียน Biometric สำเร็จ ต่อไปต้องยืนยันตัวตนก่อนแสดง QR");
                      else toast.error(webAuthn.error || "ไม่สามารถลงทะเบียน Biometric ได้");
                    } else {
                      webAuthn.unregister();
                      toast.info("ยกเลิกการปกป้องด้วย Biometric");
                    }
                  }}
                  className="h-5 w-9"
                />
              </div>
            )}
            <Badge variant="outline" className="text-xs"><CreditCard className="h-3 w-3 mr-1" />{totalCards} Cards</Badge>
          </div>
        </div>

        <Tabs defaultValue="cards" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="cards">Health Cards</TabsTrigger>
            <TabsTrigger value="superseded">ประวัติ (Superseded)</TabsTrigger>
            <TabsTrigger value="history">การแสดงข้อมูล</TabsTrigger>
          </TabsList>

          <TabsContent value="cards" className="mt-4">
            {isLoading ? (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <Skeleton className="h-[400px]" />
                <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-40" />)}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-1">
                  <Card className="sticky top-4">
                    <CardContent className="p-3">
                      <ScrollArea className="max-h-[500px]">
                        <div className="space-y-1">
                          <button onClick={() => setActiveCategory("all")} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left text-sm transition-all duration-150 ${activeCategory === "all" ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted"}`}>
                            <span className="flex items-center gap-2"><WalletIcon className="h-4 w-4" /><span className="font-medium">ทั้งหมด</span></span>
                            <Badge variant="secondary" className="text-[10px] h-5 min-w-[24px] justify-center">{totalCards}</Badge>
                          </button>
                          <Separator className="my-2" />
                          {(Object.entries(DOCUMENT_CATEGORIES) as [DocumentCategory, typeof DOCUMENT_CATEGORIES[DocumentCategory]][]).map(([key, cat]) => {
                            const count = categoryCounts[key] || 0;
                            if (count === 0) return null;
                            const IconComp = categoryIconMap[cat.icon] || FileText;
                            return (
                              <button key={key} onClick={() => setActiveCategory(key)} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left text-sm transition-all duration-150 ${activeCategory === key ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted"}`}>
                                <span className="flex items-center gap-2 min-w-0"><IconComp className="h-4 w-4 shrink-0" /><span className="font-medium truncate">{cat.th}</span></span>
                                <Badge variant="secondary" className="text-[10px] h-5 min-w-[24px] justify-center ml-2 shrink-0">{count}</Badge>
                              </button>
                            );
                          })}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </div>
                <div className="lg:col-span-3">
                  {displayCards.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                      {displayCards.map((card: any) => {
                        const config = cardTypeConfig[card.cardType] || cardTypeConfig.identity;
                        const Icon = config.icon;
                        const isRevoked = card.credentialStatus === "revoked";
                        const isExpired = card.credentialStatus === "expired";
                        const showPhoto = PHOTO_TYPES.includes(card.cardType);
                        return (
                          <button key={card.id} onClick={() => handleCardClick(card)} className={`relative overflow-hidden rounded-xl p-4 text-left text-white shadow-lg hover:shadow-xl transition-all duration-200 bg-gradient-to-br ${config.bgGradient} hover:-translate-y-1 active:scale-[0.97] ${isRevoked || isExpired ? "opacity-60" : ""}`} style={{ minHeight: "160px" }}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                {showPhoto ? (
                                  <div className="h-12 w-10 rounded-lg overflow-hidden border-2 border-white/30 shadow-sm shrink-0">
                                    <img src={(() => {
                                      const subject = card.credentialData?.credentialSubject || card.credentialData;
                                      const patient = subject?.patient || {};
                                      if (patient.gender === "female" || patient.sex === "F") return AVATAR_URLS.female;
                                      const name = patient.nameTh || patient.fullNameTh || patient.nameEn || card.displayName || "";
                                      if (name.startsWith("นาง") || name.startsWith("Ms.") || name.startsWith("Mrs.")) return AVATAR_URLS.female;
                                      return AVATAR_URLS.male;
                                    })()} alt="" className="h-full w-full object-cover" />
                                  </div>
                                ) : (
                                  <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-sm shrink-0"><Icon className="h-5 w-5" /></div>
                                )}
                                <div className="min-w-0">
                                  <h3 className="font-semibold text-sm truncate">{card.displayName}</h3>
                                  <p className="text-xs opacity-80 truncate">{card.issuerHospitalName || "TrustCare Network"}</p>
                                </div>
                              </div>
                              {card.isPinned && <Badge className="bg-white/20 text-white border-0 text-[10px]">ปักหมุด</Badge>}
                            </div>
                            <div className="mt-6 flex items-end justify-between gap-4">
                              <div className="min-w-0">
                                <p className="text-[10px] opacity-60 uppercase tracking-wider">{DOCUMENT_CATEGORIES[card.documentCategory as DocumentCategory]?.th || card.cardType}</p>
                                <p className="text-xs opacity-90 truncate mt-0.5">{new Date(card.createdAt).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })}</p>
                              </div>
                              <div className="flex items-center gap-1.5 text-white/80"><QrCode className="h-4 w-4" /><span className="text-[10px] uppercase tracking-wider">VP</span></div>
                            </div>
                            {(isRevoked || isExpired) && <div className="absolute top-2 right-2"><Badge className="bg-red-900/60 text-white border-0 text-[9px]">{isRevoked ? "ถูกเพิกถอน" : "หมดอายุ"}</Badge></div>}
                            <div className="absolute top-3 right-3 opacity-10"><Icon className="h-14 w-14" /></div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <Card><CardContent className="flex flex-col items-center justify-center py-16"><WalletIcon className="h-12 w-12 text-muted-foreground/30 mb-4" /><p className="text-muted-foreground">{activeCategory === "all" ? "ยังไม่มี Health Card ในกระเป๋า" : "ไม่มีการ์ดในหมวดหมู่นี้"}</p></CardContent></Card>
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="superseded" className="mt-4">
            {supersededLoading ? <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div> : superseded && superseded.length > 0 ? (
              <Card><CardContent className="p-0"><div className="divide-y">
                {superseded.map((cred: any) => (
                  <div key={cred.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center"><History className="h-4 w-4 text-muted-foreground" /></div>
                      <div><p className="text-sm font-medium">{cred.type}</p><p className="text-xs text-muted-foreground">{cred.revocationReason || cred.status} • {new Date(cred.revokedAt || cred.createdAt).toLocaleString("th-TH")}</p></div>
                    </div>
                    <Badge variant={cred.status === "revoked" ? "destructive" : "secondary"} className="text-[10px]">{cred.status === "revoked" ? "เพิกถอน" : "หมดอายุ"}</Badge>
                  </div>
                ))}
              </div></CardContent></Card>
            ) : <Card><CardContent className="flex flex-col items-center justify-center py-16"><History className="h-12 w-12 text-muted-foreground/30 mb-4" /><p className="text-muted-foreground">ไม่มี Credential ที่ถูกแทนที่หรือหมดอายุ</p></CardContent></Card>}
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            {histLoading ? <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div> : history && history.length > 0 ? (
              <Card><CardContent className="p-0"><div className="divide-y">
                {history.map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center"><QrCode className="h-4 w-4 text-primary" /></div>
                      <div><p className="text-sm font-medium">{item.verifierName || "Verifier"}</p><p className="text-xs text-muted-foreground">{item.purpose || "verification"} • {new Date(item.presentedAt || item.createdAt).toLocaleString("th-TH")}</p></div>
                    </div>
                    <Badge variant={item.verificationResult === "valid" ? "default" : "destructive"} className="text-[10px]">{item.verificationResult || "recorded"}</Badge>
                  </div>
                ))}
              </div></CardContent></Card>
            ) : <Card><CardContent className="flex flex-col items-center justify-center py-16"><History className="h-12 w-12 text-muted-foreground/30 mb-4" /><p className="text-muted-foreground">ยังไม่มีประวัติการแสดงข้อมูล</p></CardContent></Card>}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          {selectedCard && !qrMode && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {(() => { const Icon = (cardTypeConfig[selectedCard.cardType] || cardTypeConfig.identity).icon; return <Icon className="h-5 w-5 text-primary" />; })()}
                  {selectedCard.displayName}
                </DialogTitle>
                <DialogDescription>{selectedCard.displayNameEn || selectedCard.cardType}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                {/* Rendered Document View */}
                {selectedCard.credentialData ? (
                  <CredentialRenderer
                    credentialData={selectedCard.credentialData}
                    type={selectedCard.credentialType || selectedCard.cardType}
                    status={selectedCard.credentialStatus || "active"}
                    credentialId={String(selectedCard.credentialId)}
                    issuedAt={selectedCard.issuedAt || selectedCard.createdAt}
                    expiresAt={selectedCard.expiresAt}
                    hospitalName={selectedCard.issuerHospitalName}
                  />
                ) : (
                  <div className={`rounded-xl p-4 text-white bg-gradient-to-br ${(cardTypeConfig[selectedCard.cardType] || cardTypeConfig.identity).bgGradient}`}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center">{(() => { const Icon = (cardTypeConfig[selectedCard.cardType] || cardTypeConfig.identity).icon; return <Icon className="h-5 w-5" />; })()}</div>
                      <div><p className="font-semibold text-sm">{selectedCard.displayName}</p><p className="text-xs opacity-80">{selectedCard.issuerHospitalName || "TrustCare Network"}</p></div>
                    </div>
                    <Separator className="bg-white/20 mb-3" />
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div><p className="opacity-60">หมวดหมู่</p><p className="opacity-90">{DOCUMENT_CATEGORIES[selectedCard.documentCategory as DocumentCategory]?.th || selectedCard.cardType}</p></div>
                      <div><p className="opacity-60">สร้างเมื่อ</p><p className="opacity-90">{new Date(selectedCard.createdAt).toLocaleDateString("th-TH")}</p></div>
                      <div><p className="opacity-60">สถานะ</p><p className="opacity-90">{selectedCard.credentialStatus === "active" ? "ใช้งานได้" : selectedCard.credentialStatus}</p></div>
                      {selectedCard.expiresAt && <div><p className="opacity-60">หมดอายุ</p><p className="opacity-90">{new Date(selectedCard.expiresAt).toLocaleDateString("th-TH")}</p></div>}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <Button onClick={handleGenerateQR} disabled={presentMutation.isPending || webAuthn.isAuthenticating || selectedCard.credentialStatus !== "active"} className="gap-2">
                    {webAuthn.isRegistered && <Fingerprint className="h-4 w-4" />}
                    <QrCode className="h-4 w-4" />
                    {presentMutation.isPending || webAuthn.isAuthenticating ? "กำลังยืนยัน..." : webAuthn.isRegistered ? "ยืนยัน + QR" : "สร้าง VP QR"}
                  </Button>
                  <Button variant="outline" className="gap-2" onClick={handleShareClick}><Share2 className="h-4 w-4" />แชร์ (Selective)</Button>
                  <Button variant="outline" className="gap-2" onClick={() => {
                    exportWalletCardPdf({
                      title: selectedCard.displayName || selectedCard.title,
                      type: selectedCard.credentialType || selectedCard.cardType,
                      issuedAt: selectedCard.issuedAt || selectedCard.createdAt,
                      expiresAt: selectedCard.expiresAt,
                      issuerName: selectedCard.issuerHospitalName || "Trustcare Hospital",
                      credentialId: selectedCard.credentialId,
                      credentialData: (selectedCard.credentialData || selectedCard.metadata) as Record<string, any> | null,
                    });
                    toast.success("ดาวน์โหลด PDF สำเร็จ");
                  }}><Download className="h-4 w-4" />PDF</Button>
                </div>
                <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
                  <p><span className="font-medium">Credential ID:</span> #{selectedCard.credentialId}</p>
                  <p><span className="font-medium">Card Type:</span> {selectedCard.cardType}</p>
                  {selectedCard.lastPresentedAt && <p><span className="font-medium">แสดงล่าสุด:</span> {new Date(selectedCard.lastPresentedAt).toLocaleString("th-TH")}</p>}
                </div>
              </div>
            </>
          )}
          {selectedCard && qrMode && (
            <>
              <DialogHeader>
                <DialogTitle className="text-center">Verifiable Presentation QR</DialogTitle>
                <DialogDescription className="text-center">{selectedCard.displayName}</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="rounded-lg border p-3 bg-white shadow-sm"><img src={qrDataUrl} alt="VP QR" className="h-56 w-56" /></div>
                <div className="text-center space-y-1 max-w-full">
                  <p className="text-sm font-medium">{selectedCard.displayName}</p>
                  <p className="text-xs text-muted-foreground font-mono break-all">{presentation?.presentationId}</p>
                  {presentation?.expiresAt && <p className="text-xs text-muted-foreground">หมดอายุ: {new Date(presentation.expiresAt).toLocaleString("th-TH")}</p>}
                </div>
                <div className="flex gap-3 w-full">
                  <Button variant="outline" onClick={() => setQrMode(false)} className="flex-1 gap-2"><Eye className="h-4 w-4" />ดูรายละเอียด</Button>
                  <Button variant="outline" onClick={() => { window.print(); toast.info("กำลังพิมพ์ VP QR"); }} className="flex-1 gap-2"><Printer className="h-4 w-4" />พิมพ์ QR</Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      {/* Selective Disclosure Dialog */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-primary" />Selective Disclosure</DialogTitle>
            <DialogDescription>เลือกข้อมูลที่ต้องการแชร์ (SD-JWT)</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 max-h-[300px] overflow-y-auto">
            {Object.keys(disclosureFields).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">ไม่มีข้อมูลใน Credential นี้</p>
            ) : (
              Object.entries(disclosureFields).map(([field, checked]) => (
                <div key={field} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                  <Checkbox id={`sd-${field}`} checked={checked} onCheckedChange={(v) => setDisclosureFields(prev => ({ ...prev, [field]: !!v }))} />
                  <Label htmlFor={`sd-${field}`} className="text-sm font-medium cursor-pointer flex-1">{field}</Label>
                </div>
              ))
            )}
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setShareOpen(false)} className="flex-1">ยกเลิก</Button>
            <Button onClick={handleShareConfirm} className="flex-1 gap-2"><Share2 className="h-4 w-4" />แชร์ VP</Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
