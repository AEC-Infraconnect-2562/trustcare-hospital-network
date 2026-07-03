import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CredentialRenderer } from "@/components/CredentialRenderer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { DOCUMENT_CATEGORIES, type DocumentCategory } from "@shared/const";
import { classifyPacketTransport } from "@shared/trustLayer";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRightLeft,
  BadgeCheck,
  CalendarDays,
  CreditCard,
  Eye,
  FileBadge,
  FileCheck2,
  FileSearch,
  FileText,
  Fingerprint,
  Globe2,
  History,
  Landmark,
  Link2,
  Microscope,
  PackageCheck,
  Pill,
  Printer,
  QrCode,
  ReceiptText,
  RefreshCcw,
  ScanLine,
  Shield,
  Share2,
  Syringe,
  User,
  Wallet as WalletIcon,
  X,
  HeartPulse,
  KeyRound,
  LockKeyhole,
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
import { PersonPhoto } from "@/components/PersonPhoto";
import { patientPhotoSources } from "@shared/personImages";

const PHOTO_TYPES = ["patient_identity", "staff_identity", "identity", "medical_certificate"];

const categoryIconMap: Record<string, any> = {
  User,
  FileText,
  Pill,
  Microscope,
  ArrowRightLeft,
  ReceiptText,
  Globe2,
  RefreshCcw,
  CalendarDays,
};

const cardTypeConfig: Record<
  string,
  { icon: any; bgGradient: string; label: string }
> = {
  allergy: {
    icon: AlertTriangle,
    bgGradient: "from-red-500 to-red-700",
    label: "แจ้งเตือนการแพ้",
  },
  medication: {
    icon: Pill,
    bgGradient: "from-blue-500 to-blue-700",
    label: "สรุปยาที่ใช้",
  },
  patient_summary: {
    icon: FileText,
    bgGradient: "from-emerald-500 to-emerald-700",
    label: "สรุปข้อมูลผู้ป่วย",
  },
  consent: {
    icon: Shield,
    bgGradient: "from-violet-500 to-violet-700",
    label: "ใบรับรองความยินยอม",
  },
  identity: {
    icon: User,
    bgGradient: "from-slate-600 to-slate-800",
    label: "บัตรประจำตัว",
  },
  immunization: {
    icon: Syringe,
    bgGradient: "from-amber-500 to-amber-700",
    label: "ประวัติวัคซีน",
  },
  referral: {
    icon: FileText,
    bgGradient: "from-cyan-500 to-cyan-700",
    label: "ใบส่งต่อ",
  },
  medical_certificate: {
    icon: FileBadge,
    bgGradient: "from-teal-600 to-teal-800",
    label: "ใบรับรองแพทย์",
  },
  prescription: {
    icon: Pill,
    bgGradient: "from-sky-600 to-sky-800",
    label: "ใบสั่งยา",
  },
  lab_result: {
    icon: Microscope,
    bgGradient: "from-lime-600 to-lime-800",
    label: "ผลตรวจ Lab",
  },
  diagnostic_report: {
    icon: ScanLine,
    bgGradient: "from-indigo-600 to-indigo-800",
    label: "รายงานวินิจฉัย",
  },
  discharge_summary: {
    icon: FileCheck2,
    bgGradient: "from-green-600 to-green-800",
    label: "สรุปจำหน่าย",
  },
  coverage: {
    icon: Shield,
    bgGradient: "from-emerald-600 to-emerald-800",
    label: "สิทธิประกัน",
  },
  claim: {
    icon: ReceiptText,
    bgGradient: "from-rose-600 to-rose-800",
    label: "E-Claim",
  },
  travel_document: {
    icon: Globe2,
    bgGradient: "from-cyan-600 to-cyan-800",
    label: "เอกสารเดินทาง",
  },
  shl_manifest: {
    icon: QrCode,
    bgGradient: "from-zinc-600 to-zinc-800",
    label: "SHL Manifest",
  },
  pharmacy_dispense: {
    icon: PackageCheck,
    bgGradient: "from-blue-600 to-blue-800",
    label: "จ่ายยา",
  },
  appointment: {
    icon: CalendarDays,
    bgGradient: "from-purple-600 to-purple-800",
    label: "ใบนัดหมาย",
  },
  visa_support_letter: {
    icon: BadgeCheck,
    bgGradient: "from-fuchsia-600 to-fuchsia-800",
    label: "หนังสือประกอบวีซ่า",
  },
  quotation: {
    icon: FileText,
    bgGradient: "from-orange-600 to-orange-800",
    label: "ใบเสนอราคา",
  },
  guarantee_letter: {
    icon: Landmark,
    bgGradient: "from-yellow-600 to-yellow-800",
    label: "หนังสือรับรองค่าใช้จ่าย",
  },
  mpi_link_certificate: {
    icon: Link2,
    bgGradient: "from-stone-600 to-stone-800",
    label: "ใบรับรอง MPI",
  },
  sync_receipt: {
    icon: RefreshCcw,
    bgGradient: "from-slate-600 to-slate-800",
    label: "หลักฐาน Sync",
  },
};

export default function Wallet() {
  const { data: grouped, isLoading } = trpc.wallet.cardsByCategory.useQuery();
  const { data: superseded, isLoading: supersededLoading } =
    trpc.wallet.superseded.useQuery();
  const { data: history, isLoading: histLoading } =
    trpc.wallet.history.useQuery();
  const { data: shlLinks, isLoading: shlLoading } = trpc.shl.list.useQuery({});
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

  const [activeCategory, setActiveCategory] = useState<
    DocumentCategory | "all"
  >("all");
  const [selectedCard, setSelectedCard] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [qrMode, setQrMode] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [presentation, setPresentation] = useState<any>(null);
  const [selectedShlId, setSelectedShlId] = useState<number | null>(null);
  const selectedShlQuery = trpc.shl.getById.useQuery(
    { id: selectedShlId! },
    { enabled: Boolean(selectedShlId) }
  );

  useEffect(() => {
    if (!selectedShlId && (shlLinks ?? []).length > 0) {
      setSelectedShlId((shlLinks as any[])[0].id);
    }
  }, [selectedShlId, shlLinks]);

  const presentMutation = trpc.wallet.present.useMutation({
    onSuccess: async data => {
      setPresentation(data);
      const qr = await QRCode.toDataURL(data.qrData, { margin: 1, width: 240 });
      setQrDataUrl(qr);
      setQrMode(true);
      // Cache QR for offline use
      if (selectedCard) {
        offlineWallet.cacheQR(
          selectedCard.id,
          data.qrData,
          data.presentationId,
          data.expiresAt
        );
      }
      toast.success("สร้าง VP QR สำเร็จ");
    },
    onError: error => toast.error(error.message),
  });

  const categoryCounts = useMemo(() => {
    if (!grouped) return {};
    const counts: Record<string, number> = {};
    for (const [cat, cards] of Object.entries(grouped)) {
      counts[cat] = (cards as any[]).length;
    }
    return counts;
  }, [grouped]);

  // Identity-first sort: patient_identity and identity cards always appear at the top
  const sortIdentityFirst = (cards: any[]) => {
    const identityTypes = ["patient_identity", "staff_identity", "identity"];
    const identity = cards.filter(c => identityTypes.includes(c.cardType));
    const rest = cards.filter(c => !identityTypes.includes(c.cardType));
    return [...identity, ...rest];
  };

  const displayCards = useMemo(() => {
    // If offline and no online data, use cached offline cards
    if (!offlineWallet.isOnline && !grouped) {
      if (activeCategory === "all")
        return sortIdentityFirst(offlineWallet.offlineCards);
      return sortIdentityFirst(
        offlineWallet.offlineCards.filter(
          c => c.documentCategory === activeCategory
        )
      );
    }
    if (!grouped) return [];
    if (activeCategory === "all")
      return sortIdentityFirst(Object.values(grouped).flat());
    return sortIdentityFirst((grouped as any)[activeCategory] || []);
  }, [
    grouped,
    activeCategory,
    offlineWallet.isOnline,
    offlineWallet.offlineCards,
  ]);

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
  const [disclosureFields, setDisclosureFields] = useState<
    Record<string, boolean>
  >({});

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
        setPresentation({
          presentationId: cached.presentationId,
          expiresAt: cached.expiresAt,
        });
        setQrMode(true);
        toast.info("แสดง QR จากแคช (Offline)");
        return;
      }
      toast.error(
        "ไม่มี QR ที่แคชไว้ กรุณาเชื่อมต่ออินเทอร์เน็ตแล้วสร้าง QR ใหม่"
      );
      return;
    }
    presentMutation.mutate({ cardId: selectedCard.id });
  }, [selectedCard, presentMutation, webAuthn, offlineWallet]);

  const handleShareClick = useCallback(() => {
    if (!selectedCard) return;
    const data = selectedCard.credentialData || {};
    const fields: Record<string, boolean> = {};
    Object.keys(data).forEach(k => {
      fields[k] = true;
    });
    setDisclosureFields(fields);
    setShareOpen(true);
  }, [selectedCard]);

  const handleShareConfirm = useCallback(() => {
    const selectedFields = Object.entries(disclosureFields)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (selectedFields.length === 0) {
      toast.error("กรุณาเลือกข้อมูลอย่างน้อย 1 รายการ");
      return;
    }
    toast.success(
      `แชร์ข้อมูล ${selectedFields.length} รายการ (Selective Disclosure)`
    );
    setShareOpen(false);
    if (selectedCard) {
      presentMutation.mutate({
        cardId: selectedCard.id,
        selectedFields,
        audience: "TrustCare credential verifier",
      });
    }
  }, [disclosureFields, selectedCard, presentMutation]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Back button */}
        <Button
          variant="ghost"
          onClick={() => window.history.back()}
          className="text-muted-foreground hover:text-foreground -ml-2"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          กลับ
        </Button>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <WalletIcon className="h-6 w-6 text-primary" />
              กระเป๋าสุขภาพ
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Health Cards ทั้งหมด {totalCards} ใบ •{" "}
              {Object.keys(categoryCounts).length} หมวดหมู่
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Offline status indicator */}
            <div
              className={`flex items-center gap-1.5 border rounded-lg px-2.5 py-1.5 text-xs font-medium ${offlineWallet.isOnline ? "border-emerald-200 text-emerald-700 bg-emerald-50" : "border-amber-200 text-amber-700 bg-amber-50"}`}
            >
              {offlineWallet.isOnline ? (
                <Wifi className="h-3.5 w-3.5" />
              ) : (
                <WifiOff className="h-3.5 w-3.5" />
              )}
              {offlineWallet.isOnline ? "Online" : "Offline"}
              {offlineWallet.offlineCardCount > 0 && (
                <span className="ml-1 text-[10px] opacity-70">
                  ({offlineWallet.offlineCardCount} cached)
                </span>
              )}
            </div>
            {webAuthn.isSupported && (
              <div className="hidden sm:flex items-center gap-2 border rounded-lg px-3 py-1.5">
                <Fingerprint
                  className={`h-4 w-4 ${webAuthn.isRegistered ? "text-emerald-600" : "text-muted-foreground"}`}
                />
                <span className="text-xs font-medium">
                  {webAuthn.isRegistered ? "ปกป้องแล้ว" : "ตั้งค่า Biometric"}
                </span>
                <Switch
                  checked={webAuthn.isRegistered}
                  onCheckedChange={async checked => {
                    if (checked) {
                      const ok = await webAuthn.register(
                        String(auth?.id || "user"),
                        auth?.name || "Patient"
                      );
                      if (ok)
                        toast.success(
                          "ลงทะเบียน Biometric สำเร็จ ต่อไปต้องยืนยันตัวตนก่อนแสดง QR"
                        );
                      else
                        toast.error(
                          webAuthn.error || "ไม่สามารถลงทะเบียน Biometric ได้"
                        );
                    } else {
                      webAuthn.unregister();
                      toast.info("ยกเลิกการปกป้องด้วย Biometric");
                    }
                  }}
                  className="h-5 w-9"
                />
              </div>
            )}
            <Button
              onClick={() => {
                window.location.href = "/prepare-service";
              }}
              className="gap-2"
            >
              <HeartPulse className="h-4 w-4" />
              เตรียมเข้ารับบริการ
            </Button>
            <Badge variant="outline" className="text-xs hidden sm:flex">
              <CreditCard className="h-3 w-3 mr-1" />
              {totalCards} Cards
            </Badge>
          </div>
        </div>

        <Tabs defaultValue="cards" className="w-full">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4">
            <TabsTrigger value="cards" className="whitespace-normal text-xs sm:text-sm">Health Cards</TabsTrigger>
            <TabsTrigger value="shl" className="whitespace-normal text-xs sm:text-sm">SHL Packages</TabsTrigger>
            <TabsTrigger value="superseded" className="whitespace-normal text-xs sm:text-sm">ประวัติ (Superseded)</TabsTrigger>
            <TabsTrigger value="history" className="whitespace-normal text-xs sm:text-sm">การแสดงข้อมูล</TabsTrigger>
          </TabsList>

          <TabsContent value="cards" className="mt-4">
            {isLoading ? (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <Skeleton className="h-[400px]" />
                <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {[...Array(6)].map((_, i) => (
                    <Skeleton key={i} className="h-40" />
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-1">
                  <Card className="sticky top-4">
                    <CardContent className="p-3">
                      <ScrollArea className="max-h-[500px]">
                        <div className="space-y-1">
                          <button
                            onClick={() => setActiveCategory("all")}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left text-sm transition-all duration-150 ${activeCategory === "all" ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted"}`}
                          >
                            <span className="flex items-center gap-2">
                              <WalletIcon className="h-4 w-4" />
                              <span className="font-medium">ทั้งหมด</span>
                            </span>
                            <Badge
                              variant="secondary"
                              className="text-[10px] h-5 min-w-[24px] justify-center"
                            >
                              {totalCards}
                            </Badge>
                          </button>
                          <Separator className="my-2" />
                          {(
                            Object.entries(DOCUMENT_CATEGORIES) as [
                              DocumentCategory,
                              (typeof DOCUMENT_CATEGORIES)[DocumentCategory],
                            ][]
                          ).map(([key, cat]) => {
                            const count = categoryCounts[key] || 0;
                            if (count === 0) return null;
                            const IconComp =
                              categoryIconMap[cat.icon] || FileText;
                            return (
                              <button
                                key={key}
                                onClick={() => setActiveCategory(key)}
                                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left text-sm transition-all duration-150 ${activeCategory === key ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted"}`}
                              >
                                <span className="flex items-center gap-2 min-w-0">
                                  <IconComp className="h-4 w-4 shrink-0" />
                                  <span className="font-medium truncate">
                                    {cat.th}
                                  </span>
                                </span>
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] h-5 min-w-[24px] justify-center ml-2 shrink-0"
                                >
                                  {count}
                                </Badge>
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
                        const config =
                          cardTypeConfig[card.cardType] ||
                          cardTypeConfig.identity;
                        const Icon = config.icon;
                        const isRevoked = card.credentialStatus === "revoked";
                        const isExpired = card.credentialStatus === "expired";
                        const showPhoto = PHOTO_TYPES.includes(card.cardType);
                        return (
                          <button
                            key={card.id}
                            onClick={() => handleCardClick(card)}
                            className={`relative overflow-hidden rounded-xl p-4 text-left text-white shadow-lg hover:shadow-xl transition-all duration-200 bg-gradient-to-br ${config.bgGradient} hover:-translate-y-1 active:scale-[0.97] ${isRevoked || isExpired ? "opacity-60" : ""}`}
                            style={{ minHeight: "160px" }}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                {showPhoto ? (
                                  <div className="h-12 w-10 rounded-lg overflow-hidden border-2 border-white/30 shadow-sm shrink-0 bg-white/10 flex items-center justify-center">
                                    <PersonPhoto
                                      sources={patientPhotoSources({
                                        primaryUrl: card.patientAvatarUrl || (auth as any)?.avatarUrl,
                                        credentialData: card.credentialData,
                                      })}
                                      alt=""
                                      className="h-full w-full object-cover"
                                      width={40}
                                      height={48}
                                      loading="eager"
                                      fallback={<User className="h-5 w-5 text-white/80" />}
                                    />
                                  </div>
                                ) : (
                                  <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-sm shrink-0">
                                    <Icon className="h-5 w-5" />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <h3 className="font-semibold text-sm truncate">
                                    {card.displayName}
                                  </h3>
                                  <p className="text-xs opacity-80 truncate">
                                    {card.issuerHospitalName ||
                                      "TrustCare Network"}
                                  </p>
                                </div>
                              </div>
                              {card.isPinned && (
                                <Badge className="bg-white/20 text-white border-0 text-[10px]">
                                  ปักหมุด
                                </Badge>
                              )}
                            </div>
                            <div className="mt-6 flex items-end justify-between gap-4">
                              <div className="min-w-0">
                                <p className="text-[10px] opacity-60 uppercase tracking-wider">
                                  {DOCUMENT_CATEGORIES[
                                    card.documentCategory as DocumentCategory
                                  ]?.th || card.cardType}
                                </p>
                                <p className="text-xs opacity-90 truncate mt-0.5">
                                  {new Date(card.createdAt).toLocaleDateString(
                                    "th-TH",
                                    {
                                      day: "numeric",
                                      month: "short",
                                      year: "2-digit",
                                    }
                                  )}
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5 text-white/80">
                                <QrCode className="h-4 w-4" />
                                <span className="text-[10px] uppercase tracking-wider">
                                  VP
                                </span>
                              </div>
                            </div>
                            {(isRevoked || isExpired) && (
                              <div className="absolute top-2 right-2">
                                <Badge className="bg-red-900/60 text-white border-0 text-[9px]">
                                  {isRevoked ? "ถูกเพิกถอน" : "หมดอายุ"}
                                </Badge>
                              </div>
                            )}
                            <div className="absolute top-3 right-3 opacity-10">
                              <Icon className="h-14 w-14" />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <Card>
                      <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
                        <WalletIcon className="h-12 w-12 text-muted-foreground/30" />
                        <div>
                          <p className="font-medium">
                            {activeCategory === "all"
                              ? "ยังไม่มี Health Card ในกระเป๋า"
                              : "ไม่มีการ์ดในหมวดหมู่นี้"}
                          </p>
                          <p className="mt-1 max-w-md text-sm text-muted-foreground">
                            Request documents from HIS, partner portals, or
                            prior care sources before creating VC/VP packets for
                            hospital service.
                          </p>
                        </div>
                        <div className="flex flex-wrap justify-center gap-2">
                          <Button
                            onClick={() => {
                              window.location.href = "/prepare-service";
                            }}
                            className="gap-2"
                          >
                            <HeartPulse className="h-4 w-4" />
                            Prepare service
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => {
                              window.location.href = "/shl";
                            }}
                            className="gap-2"
                          >
                            <Link2 className="h-4 w-4" />
                            Smart Share
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="shl" className="mt-4">
            <WalletShlPackages
              links={shlLinks as any[] | undefined}
              isLoading={shlLoading}
              selectedId={selectedShlId}
              setSelectedId={setSelectedShlId}
              selected={selectedShlQuery.data as any}
              selectedLoading={selectedShlQuery.isLoading}
            />
          </TabsContent>

          <TabsContent value="superseded" className="mt-4">
            {supersededLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : superseded && superseded.length > 0 ? (
              <Card>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {superseded.map((cred: any) => (
                      <div
                        key={cred.id}
                        className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                            <History className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{cred.type}</p>
                            <p className="text-xs text-muted-foreground">
                              {cred.revocationReason || cred.status} •{" "}
                              {new Date(
                                cred.revokedAt || cred.createdAt
                              ).toLocaleString("th-TH")}
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant={
                            cred.status === "revoked"
                              ? "destructive"
                              : "secondary"
                          }
                          className="text-[10px]"
                        >
                          {cred.status === "revoked" ? "เพิกถอน" : "หมดอายุ"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <History className="h-12 w-12 text-muted-foreground/30 mb-4" />
                  <p className="text-muted-foreground">
                    ไม่มี Credential ที่ถูกแทนที่หรือหมดอายุ
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            {histLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : history && history.length > 0 ? (
              <Card>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {history.map((item: any) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                            <QrCode className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">
                              {item.verifierName || "Verifier"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {item.purpose || "verification"} •{" "}
                              {new Date(
                                item.presentedAt || item.createdAt
                              ).toLocaleString("th-TH")}
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant={
                            item.verificationResult === "valid"
                              ? "default"
                              : "destructive"
                          }
                          className="text-[10px]"
                        >
                          {item.verificationResult || "recorded"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <History className="h-12 w-12 text-muted-foreground/30 mb-4" />
                  <p className="text-muted-foreground">
                    ยังไม่มีประวัติการแสดงข้อมูล
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent
          className="max-w-lg max-h-[90vh] flex flex-col overflow-hidden"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {selectedCard && !qrMode && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {(() => {
                    const Icon = (
                      cardTypeConfig[selectedCard.cardType] ||
                      cardTypeConfig.identity
                    ).icon;
                    return <Icon className="h-5 w-5 text-primary" />;
                  })()}
                  {selectedCard.displayName}
                </DialogTitle>
                <DialogDescription>
                  {selectedCard.displayNameEn || selectedCard.cardType}
                </DialogDescription>
              </DialogHeader>
              <div
                className="space-y-4 py-2 overflow-y-auto flex-1 overscroll-contain touch-pan-y"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
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
                    patientPhotoUrl={selectedCard.patientAvatarUrl || (auth as any)?.avatarUrl}
                  />
                ) : (
                  <div
                    className={`rounded-xl p-4 text-white bg-gradient-to-br ${(cardTypeConfig[selectedCard.cardType] || cardTypeConfig.identity).bgGradient}`}
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center">
                        {(() => {
                          const Icon = (
                            cardTypeConfig[selectedCard.cardType] ||
                            cardTypeConfig.identity
                          ).icon;
                          return <Icon className="h-5 w-5" />;
                        })()}
                      </div>
                      <div>
                        <p className="font-semibold text-sm">
                          {selectedCard.displayName}
                        </p>
                        <p className="text-xs opacity-80">
                          {selectedCard.issuerHospitalName ||
                            "TrustCare Network"}
                        </p>
                      </div>
                    </div>
                    <Separator className="bg-white/20 mb-3" />
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="opacity-60">หมวดหมู่</p>
                        <p className="opacity-90">
                          {DOCUMENT_CATEGORIES[
                            selectedCard.documentCategory as DocumentCategory
                          ]?.th || selectedCard.cardType}
                        </p>
                      </div>
                      <div>
                        <p className="opacity-60">สร้างเมื่อ</p>
                        <p className="opacity-90">
                          {new Date(selectedCard.createdAt).toLocaleDateString(
                            "th-TH"
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="opacity-60">สถานะ</p>
                        <p className="opacity-90">
                          {selectedCard.credentialStatus === "active"
                            ? "ใช้งานได้"
                            : selectedCard.credentialStatus}
                        </p>
                      </div>
                      {selectedCard.expiresAt && (
                        <div>
                          <p className="opacity-60">หมดอายุ</p>
                          <p className="opacity-90">
                            {new Date(
                              selectedCard.expiresAt
                            ).toLocaleDateString("th-TH")}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 rounded-lg border bg-muted/30 p-3 text-xs">
                    <div className="font-medium">
                      {classifyPacketTransport({ credentialCount: 1, documentTypes: [selectedCard.cardType] }).label}
                    </div>
                    <div className="mt-1 text-muted-foreground">
                      {classifyPacketTransport({ credentialCount: 1, documentTypes: [selectedCard.cardType] }).reason}
                    </div>
                  </div>
                  <Button
                    onClick={handleGenerateQR}
                    disabled={
                      presentMutation.isPending ||
                      webAuthn.isAuthenticating ||
                      selectedCard.credentialStatus !== "active"
                    }
                    className="gap-2"
                  >
                    {webAuthn.isRegistered && (
                      <Fingerprint className="h-4 w-4" />
                    )}
                    <QrCode className="h-4 w-4" />
                    {presentMutation.isPending || webAuthn.isAuthenticating
                      ? "กำลังยืนยัน..."
                      : webAuthn.isRegistered
                        ? "ยืนยัน + QR"
                        : "สร้าง VP QR"}
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={handleShareClick}
                  >
                    <Share2 className="h-4 w-4" />
                    แชร์ (Selective)
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => {
                      exportWalletCardPdf({
                        title: selectedCard.displayName || selectedCard.title,
                        type:
                          selectedCard.credentialType || selectedCard.cardType,
                        issuedAt:
                          selectedCard.issuedAt || selectedCard.createdAt,
                        expiresAt: selectedCard.expiresAt,
                        issuerName:
                          selectedCard.issuerHospitalName ||
                          "Trustcare Hospital",
                        credentialId: selectedCard.credentialId,
                        credentialData: (selectedCard.credentialData ||
                          selectedCard.metadata) as Record<string, any> | null,
                      });
                      toast.success("ดาวน์โหลด PDF สำเร็จ");
                    }}
                  >
                    <Download className="h-4 w-4" />
                    PDF
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
                  <p>
                    <span className="font-medium">Credential ID:</span> #
                    {selectedCard.credentialId}
                  </p>
                  <p>
                    <span className="font-medium">Card Type:</span>{" "}
                    {selectedCard.cardType}
                  </p>
                  {selectedCard.lastPresentedAt && (
                    <p>
                      <span className="font-medium">แสดงล่าสุด:</span>{" "}
                      {new Date(selectedCard.lastPresentedAt).toLocaleString(
                        "th-TH"
                      )}
                    </p>
                  )}
                </div>
                {/* Explicit close button for mobile accessibility */}
                <Button
                  variant="outline"
                  onClick={() => setDetailOpen(false)}
                  className="w-full mt-3 gap-2"
                >
                  <X className="h-4 w-4" />
                  ปิด
                </Button>
              </div>
            </>
          )}
          {selectedCard && qrMode && (
            <>
              <DialogHeader>
                <DialogTitle className="text-center">
                  Verifiable Presentation QR
                </DialogTitle>
                <DialogDescription className="text-center">
                  {selectedCard.displayName}
                </DialogDescription>
              </DialogHeader>
              <div
                className="flex flex-col items-center gap-4 py-4 overflow-y-auto flex-1 overscroll-contain touch-pan-y"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                <div className="rounded-lg border p-3 bg-white shadow-sm">
                  <img src={qrDataUrl} alt="VP QR" className="h-56 w-56" />
                </div>
                <div className="text-center space-y-1 max-w-full">
                  <p className="text-sm font-medium">
                    {selectedCard.displayName}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono break-all">
                    {presentation?.presentationId}
                  </p>
                  {presentation?.expiresAt && (
                    <p className="text-xs text-muted-foreground">
                      หมดอายุ:{" "}
                      {new Date(presentation.expiresAt).toLocaleString("th-TH")}
                    </p>
                  )}
                  {presentation?.mode && (
                    <p className="text-xs text-muted-foreground">
                      Mode: {presentation.mode} | Credentials: {presentation.credentialCount ?? 1}
                      {presentation.selectedFields?.length ? ` | Fields: ${presentation.selectedFields.length}` : ""}
                    </p>
                  )}
                </div>
                <div className="flex gap-3 w-full">
                  <Button
                    variant="outline"
                    onClick={() => setQrMode(false)}
                    className="flex-1 gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    ดูรายละเอียด
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      window.print();
                      toast.info("กำลังพิมพ์ VP QR");
                    }}
                    className="flex-1 gap-2"
                  >
                    <Printer className="h-4 w-4" />
                    พิมพ์ QR
                  </Button>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setQrMode(false);
                    setDetailOpen(false);
                  }}
                  className="w-full gap-2"
                >
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
            <DialogDescription>
              เลือกข้อมูลที่ต้องการแชร์ (SD-JWT)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 max-h-[300px] overflow-y-auto">
            {Object.keys(disclosureFields).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                ไม่มีข้อมูลใน Credential นี้
              </p>
            ) : (
              Object.entries(disclosureFields).map(([field, checked]) => (
                <div
                  key={field}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    id={`sd-${field}`}
                    checked={checked}
                    onCheckedChange={v =>
                      setDisclosureFields(prev => ({ ...prev, [field]: !!v }))
                    }
                  />
                  <Label
                    htmlFor={`sd-${field}`}
                    className="text-sm font-medium cursor-pointer flex-1"
                  >
                    {field}
                  </Label>
                </div>
              ))
            )}
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setShareOpen(false)}
              className="flex-1"
            >
              ยกเลิก
            </Button>
            <Button onClick={handleShareConfirm} className="flex-1 gap-2">
              <Share2 className="h-4 w-4" />
              แชร์ VP
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function WalletShlPackages({
  links,
  isLoading,
  selectedId,
  setSelectedId,
  selected,
  selectedLoading,
}: {
  links?: any[];
  isLoading: boolean;
  selectedId: number | null;
  setSelectedId: (id: number) => void;
  selected?: any;
  selectedLoading: boolean;
}) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const files = selected?.files ?? [];
  const documentBundle = selected?.documentBundle ?? buildWalletFallbackDocumentBundle(selected, files);

  useEffect(() => {
    const value = selected?.viewerUrl ?? selected?.qrPayload ?? "";
    if (!value) {
      setQrDataUrl("");
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(value, { margin: 1, width: 220 })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl("");
      });
    return () => {
      cancelled = true;
    };
  }, [selected?.viewerUrl, selected?.qrPayload]);

  if (isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (!links?.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-14 text-center">
          <QrCode className="h-10 w-10 text-muted-foreground/40" />
          <div>
            <p className="font-semibold">No Smart Health Links in this wallet yet.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create a service packet from Prepare for Service or Smart Health Links to see QR, manifest documents, and VC/VP bindings here.
            </p>
          </div>
          <Button className="gap-2" onClick={() => { window.location.href = "/prepare-service"; }}>
            <HeartPulse className="h-4 w-4" />
            Prepare service packet
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
      <div className="space-y-3">
        {links.map((link) => {
          const active = selectedId === link.id;
          return (
            <div key={link.id} className="space-y-3">
              <button
                type="button"
                onClick={() => setSelectedId(link.id)}
                className={`w-full rounded-lg border bg-card p-4 text-left transition hover:border-primary ${active ? "border-primary shadow-sm ring-1 ring-primary/20" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <LockKeyhole className="h-4 w-4 text-primary" />
                      <p className="truncate text-sm font-semibold">
                        {link.label ?? link.purpose ?? "Smart Health Link"}
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {link.context ?? link.purpose} - opened {link.currentAccessCount ?? 0}
                      {link.maxAccessCount ? ` of ${link.maxAccessCount}` : ""}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {link.manifestCredentialId && <Badge variant="outline">Manifest VC</Badge>}
                      {link.presentationId && <Badge variant="outline">Holder VP</Badge>}
                      {link.passcodeRequired && <Badge variant="secondary">Passcode</Badge>}
                    </div>
                  </div>
                  <Badge variant={link.status === "active" ? "secondary" : "outline"}>
                    {link.status}
                  </Badge>
                </div>
              </button>
              {active && (
                <div className="xl:hidden">
                  <WalletShlSelectedInline
                    selected={selected}
                    selectedLoading={selectedLoading}
                    qrDataUrl={qrDataUrl}
                    documentBundle={documentBundle}
                    files={files}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Card className="hidden xl:block">
        <CardContent className="space-y-4 p-4">
          {selectedLoading ? (
            <Skeleton className="h-72" />
          ) : !selected ? (
            <div className="flex min-h-72 items-center justify-center text-sm text-muted-foreground">
              Select an SHL package.
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Link2 className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-semibold">{selected.label ?? selected.purpose}</h2>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    QR opens an SHL manifest. Trust is provided by the associated Manifest VC and Holder VP.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant={selected.status === "active" ? "secondary" : "outline"}>{selected.status}</Badge>
                    <Badge variant="outline">{selected.context}</Badge>
                    <Badge variant="outline">{documentBundle?.documents?.length ?? 0} manifest documents</Badge>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyWalletText(selected.viewerUrl ?? selected.qrPayload)}
                  >
                    <Share2 className="mr-2 h-4 w-4" />
                    Copy link
                  </Button>
                  {selected.presentationId && (
                    <Button
                      size="sm"
                      className="gap-2"
                      onClick={() => { window.location.href = `/verifier?vp=${encodeURIComponent(selected.presentationId)}`; }}
                    >
                      <Shield className="h-4 w-4" />
                      Verify VP
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
                <div className="rounded-lg border bg-white p-3">
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt="SHL QR" className="mx-auto h-52 w-52" />
                  ) : (
                    <div className="flex h-52 items-center justify-center text-xs text-muted-foreground">
                      QR unavailable
                    </div>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <WalletMetric icon={FileText} label="Manifest" value={walletShortHash(selected.manifestHash)} />
                  <WalletMetric icon={PackageCheck} label="FHIR bundle" value={walletShortHash(selected.sourceBundleHash)} />
                  <WalletMetric icon={Eye} label="Access used" value={walletFormatAccess(selected)} />
                  <WalletMetric
                    icon={CalendarDays}
                    label="Expires"
                    value={selected.expiresAt ? new Date(selected.expiresAt).toLocaleString("th-TH") : "No expiry"}
                  />
                </div>
              </div>

              <WalletManifestTrustPanel selected={selected} />

              <Tabs defaultValue="documents">
                <TabsList className="h-auto flex-wrap">
                  <TabsTrigger value="documents">Manifest Documents</TabsTrigger>
                  <TabsTrigger value="files">Manifest Files</TabsTrigger>
                  <TabsTrigger value="technical">Object Links</TabsTrigger>
                </TabsList>
                <TabsContent value="documents" className="space-y-2">
                  <WalletManifestDocuments bundle={documentBundle} />
                </TabsContent>
                <TabsContent value="files" className="space-y-2">
                  {files.length ? files.map((file: any) => (
                    <div key={file.id ?? file.fileId} className="rounded-md border p-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{file.contentType}</p>
                          <p className="truncate text-xs text-muted-foreground">{file.fileId}</p>
                        </div>
                        <Badge variant="outline">{walletShortHash(file.contentHash)}</Badge>
                      </div>
                    </div>
                  )) : (
                    <p className="rounded-md border p-4 text-sm text-muted-foreground">No manifest files loaded yet.</p>
                  )}
                </TabsContent>
                <TabsContent value="technical">
                  <div className="grid gap-2 text-xs">
                    <WalletObjectLink label="Manifest URL" value={selected.manifestUrl} />
                    <WalletObjectLink label="Viewer URL" value={selected.viewerUrl} />
                    <WalletObjectLink label="SHLink payload" value={selected.qrPayload} />
                    <WalletObjectLink label="Manifest Credential ID" value={selected.manifestCredentialId} />
                    <WalletObjectLink label="Holder Presentation ID" value={selected.presentationId} />
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function WalletShlSelectedInline({
  selected,
  selectedLoading,
  qrDataUrl,
  documentBundle,
  files,
}: {
  selected?: any;
  selectedLoading: boolean;
  qrDataUrl: string;
  documentBundle?: any;
  files: any[];
}) {
  if (selectedLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <Skeleton className="h-72" />
        </CardContent>
      </Card>
    );
  }
  if (!selected) {
    return (
      <Card>
        <CardContent className="flex min-h-32 items-center justify-center p-4 text-sm text-muted-foreground">
          Loading selected SHL package...
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">{selected.label ?? selected.purpose}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              QR opens the SHL manifest; Manifest VC and Holder VP verify trust around the packet.
            </p>
          </div>
          <Badge variant="outline">{documentBundle?.documents?.length ?? 0} documents</Badge>
        </div>
        <div className="rounded-lg border bg-white p-3">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="SHL QR" className="mx-auto h-52 w-52" />
          ) : (
            <div className="flex h-52 items-center justify-center text-xs text-muted-foreground">
              QR unavailable
            </div>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <WalletMetric icon={Eye} label="Access used" value={walletFormatAccess(selected)} />
          <WalletMetric
            icon={CalendarDays}
            label="Expires"
            value={selected.expiresAt ? new Date(selected.expiresAt).toLocaleString("th-TH") : "No expiry"}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => copyWalletText(selected.viewerUrl ?? selected.qrPayload)}
          >
            <Share2 className="mr-2 h-4 w-4" />
            Copy link
          </Button>
          {selected.presentationId && (
            <Button
              size="sm"
              className="gap-2"
              onClick={() => { window.location.href = `/verifier?vp=${encodeURIComponent(selected.presentationId)}`; }}
            >
              <Shield className="h-4 w-4" />
              Verify VP
            </Button>
          )}
        </div>
        <WalletManifestTrustPanel selected={selected} />
        <Tabs defaultValue="documents">
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="files">Files</TabsTrigger>
            <TabsTrigger value="links">Links</TabsTrigger>
          </TabsList>
          <TabsContent value="documents" className="space-y-2">
            <WalletManifestDocuments bundle={documentBundle} />
          </TabsContent>
          <TabsContent value="files" className="space-y-2">
            {files.length ? files.map((file: any) => (
              <div key={file.id ?? file.fileId} className="rounded-md border p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{file.contentType}</p>
                    <p className="truncate text-xs text-muted-foreground">{file.fileId}</p>
                  </div>
                  <Badge variant="outline">{walletShortHash(file.contentHash)}</Badge>
                </div>
              </div>
            )) : (
              <p className="rounded-md border p-4 text-sm text-muted-foreground">No manifest files loaded yet.</p>
            )}
          </TabsContent>
          <TabsContent value="links" className="grid gap-2 text-xs">
            <WalletObjectLink label="Manifest URL" value={selected.manifestUrl} />
            <WalletObjectLink label="Viewer URL" value={selected.viewerUrl} />
            <WalletObjectLink label="Manifest Credential ID" value={selected.manifestCredentialId} />
            <WalletObjectLink label="Holder Presentation ID" value={selected.presentationId} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function WalletManifestTrustPanel({ selected }: { selected: any }) {
  const rows = [
    {
      label: "Manifest VC",
      value: selected.manifestCredentialId,
      detail: "Issuer signs manifest hash, source bundle hash, purpose, expiry, and SHL access policy.",
    },
    {
      label: "Holder VP",
      value: selected.presentationId,
      detail: "Patient holder presentation binds consent/holder DID to the manifest packet.",
    },
    {
      label: "Hash integrity",
      value: selected.manifestHash && selected.sourceBundleHash ? "ready" : "",
      detail: "Verifier compares manifest file hashes and source bundle hash before relying on documents.",
    },
    {
      label: "Access policy",
      value: selected.passcodeRequired || selected.expiresAt || selected.maxAccessCount ? "ready" : "",
      detail: "Passcode, expiry, max access, revocation, and logs protect the shared packet.",
    },
  ];
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Verify VC/VP associated with this manifest</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Verifiers should validate the Holder VP, then inspect the Manifest VC and hash bindings around the SHL files.
          </p>
        </div>
        <Badge variant="outline">{rows.filter((row) => row.value).length} of {rows.length} ready</Badge>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="rounded-md border bg-background p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium">{row.label}</p>
              <Badge variant={row.value ? "secondary" : "destructive"}>{row.value ? "bound" : "missing"}</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{row.detail}</p>
            {row.value && row.value !== "ready" && (
              <p className="mt-2 truncate font-mono text-[11px] text-muted-foreground">{row.value}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function WalletManifestDocuments({ bundle }: { bundle?: any }) {
  const documents = bundle?.documents ?? [];
  if (!documents.length) {
    return <p className="rounded-md border p-4 text-sm text-muted-foreground">No manifest documents loaded.</p>;
  }
  return (
    <div className="space-y-2">
      {documents.map((doc: any) => (
        <details key={doc.id ?? doc.documentType} className="rounded-md border p-3" open={Number(doc.sequence ?? 1) === 1}>
          <summary className="cursor-pointer list-none">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <FileSearch className="h-4 w-4 text-primary" />
                  <p className="truncate text-sm font-semibold">{doc.title}</p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {doc.documentType} - {doc.category} - {doc.sourceRole}
                </p>
              </div>
              <Badge variant={doc.status === "available_in_manifest" ? "secondary" : "outline"}>{doc.status}</Badge>
            </div>
          </summary>
          <div className="mt-3 grid gap-2 text-xs md:grid-cols-2 xl:grid-cols-3">
            <WalletObjectLink label="FHIR DocumentReference" value={doc.objectLinks?.fhirDocumentReference} />
            <WalletObjectLink label="SHL file object" value={doc.objectLinks?.shlFile ?? doc.manifestFileId} />
            <WalletObjectLink label="FHIR bundle" value={doc.objectLinks?.fhirBundle} />
            <WalletObjectLink label="Manifest VC" value={doc.objectLinks?.manifestCredential} />
            <WalletObjectLink label="Holder VP" value={doc.objectLinks?.holderPresentation} />
            <WalletObjectLink label="Future object API" value={doc.objectLinks?.futureApi} />
          </div>
          <div className="mt-3 rounded-md border bg-muted/30 p-2 text-xs text-muted-foreground">
            This document is disclosed through the SHL manifest file, and trust is checked through Manifest VC + Holder VP + file hashes.
          </div>
        </details>
      ))}
    </div>
  );
}

function WalletMetric({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-md border p-3 text-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span>{label}</span>
      </div>
      <p className="mt-1 break-words font-medium">{value}</p>
    </div>
  );
}

function WalletObjectLink({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="min-w-0 rounded-md border p-2">
      <p className="text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-mono text-[11px]">{value || "pending"}</p>
    </div>
  );
}

function walletShortHash(value?: string | null) {
  if (!value) return "pending";
  return value.length > 18 ? `${value.slice(0, 10)}...${value.slice(-6)}` : value;
}

function walletFormatAccess(shl: any) {
  const current = Number(shl?.currentAccessCount ?? 0);
  const max = shl?.maxAccessCount ? Number(shl.maxAccessCount) : null;
  return max ? `${current} opens of ${max}` : `${current} opens`;
}

function copyWalletText(value?: string | null) {
  if (!value) return;
  void navigator.clipboard.writeText(value);
  toast.success("Copied");
}

function buildWalletFallbackDocumentBundle(shl: any, files: any[]) {
  if (!shl) return undefined;
  const context = String(shl.context ?? shl.purpose ?? "patient_summary");
  const templates = walletManifestTemplates[context] ?? walletManifestTemplates[String(shl.purpose ?? "")] ?? walletManifestTemplates.treatment;
  const file = files.find((row) => row.contentType === "application/fhir+json") ?? files[0] ?? {};
  const manifestVersion = Number(shl.currentManifestVersion ?? file.manifestVersion ?? 1);
  return {
    bundleId: `wallet-shl-bundle-${shl.id}-v${manifestVersion}`,
    documents: templates.map((template, index) => ({
      ...template,
      id: `wallet-${shl.id}-${template.documentType}`,
      sequence: index + 1,
      status: shl.status === "active" ? "available_in_manifest" : "linked_to_inactive_shl",
      manifestFileId: file.fileId,
      objectLinks: {
        fhirDocumentReference: `DocumentReference/shl-${shl.id}-${manifestVersion}-${template.documentType}`,
        shlFile: file.fileId ? `shl://${shl.id}/versions/${manifestVersion}/files/${file.fileId}` : undefined,
        fhirBundle: shl.sourceBundleHash ? `Bundle/${shl.sourceBundleHash}` : undefined,
        manifestCredential: shl.manifestCredentialId ? `Credential/${shl.manifestCredentialId}` : undefined,
        holderPresentation: shl.presentationId ? `Presentation/${shl.presentationId}` : undefined,
        futureApi: `/api/shl/${shl.id}/manifest-documents/${template.documentType}`,
      },
    })),
  };
}

const walletManifestTemplates: Record<string, Array<{ documentType: string; title: string; category: string; sourceRole: string }>> = {
  medical_tourist: [
    { documentType: "travel_document", title: "Passport / travel identity", category: "identity_and_access", sourceRole: "International desk" },
    { documentType: "patient_summary", title: "Clinical summary for pre-review", category: "clinical_summary", sourceRole: "Referring clinician" },
    { documentType: "quotation", title: "Treatment quotation / estimate", category: "medical_tourism", sourceRole: "International desk" },
    { documentType: "guarantee_letter", title: "Guarantee letter or payer support", category: "medical_tourism", sourceRole: "Payer or facilitator" },
  ],
  e_claim: [
    { documentType: "insurance_eligibility", title: "Coverage eligibility", category: "claims_and_finance", sourceRole: "Payer adapter" },
    { documentType: "claim_package", title: "Verified claim package", category: "claims_and_finance", sourceRole: "Claim center" },
    { documentType: "invoice", title: "Invoice / charge summary", category: "claims_and_finance", sourceRole: "Hospital finance" },
    { documentType: "claim_receipt", title: "Receipt / payment evidence", category: "claims_and_finance", sourceRole: "Hospital finance" },
  ],
  insurance: [
    { documentType: "insurance_eligibility", title: "Coverage eligibility", category: "claims_and_finance", sourceRole: "Payer adapter" },
    { documentType: "claim_package", title: "Verified claim package", category: "claims_and_finance", sourceRole: "Claim center" },
    { documentType: "invoice", title: "Invoice / charge summary", category: "claims_and_finance", sourceRole: "Hospital finance" },
    { documentType: "claim_receipt", title: "Receipt / payment evidence", category: "claims_and_finance", sourceRole: "Hospital finance" },
  ],
  referral: [
    { documentType: "referral_vc", title: "Referral document", category: "care_transition", sourceRole: "Referring hospital" },
    { documentType: "patient_summary", title: "Patient summary", category: "clinical_summary", sourceRole: "Referring clinician" },
    { documentType: "lab_result", title: "Relevant laboratory results", category: "diagnostics_and_results", sourceRole: "LIS" },
    { documentType: "consent_receipt", title: "Referral consent receipt", category: "identity_and_access", sourceRole: "Patient wallet" },
  ],
  cross_branch_referral: [
    { documentType: "referral_vc", title: "Referral document", category: "care_transition", sourceRole: "Referring hospital" },
    { documentType: "patient_summary", title: "Patient summary", category: "clinical_summary", sourceRole: "Referring clinician" },
    { documentType: "lab_result", title: "Relevant laboratory results", category: "diagnostics_and_results", sourceRole: "LIS" },
    { documentType: "consent_receipt", title: "Referral consent receipt", category: "identity_and_access", sourceRole: "Patient wallet" },
  ],
  emergency: [
    { documentType: "patient_identity", title: "Patient identity", category: "identity_and_access", sourceRole: "Patient wallet" },
    { documentType: "allergy_alert", title: "Allergy alerts", category: "clinical_summary", sourceRole: "HIS/EMR" },
    { documentType: "medication_summary", title: "Current medications", category: "medication_and_pharmacy", sourceRole: "Pharmacy" },
    { documentType: "patient_summary", title: "Critical conditions summary", category: "clinical_summary", sourceRole: "HIS/EMR" },
  ],
  treatment: [
    { documentType: "patient_identity", title: "Patient identity", category: "identity_and_access", sourceRole: "Patient wallet" },
    { documentType: "patient_summary", title: "Recent patient summary", category: "clinical_summary", sourceRole: "HIS/EMR" },
    { documentType: "medication_summary", title: "Current medications", category: "medication_and_pharmacy", sourceRole: "Pharmacy" },
    { documentType: "allergy_alert", title: "Allergy alerts", category: "clinical_summary", sourceRole: "HIS/EMR" },
  ],
};
