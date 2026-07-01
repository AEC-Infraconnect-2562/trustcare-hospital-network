import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle, BadgeCheck, CalendarDays, CreditCard, FileBadge, FileCheck2, FileText, Globe2,
  History, Landmark, Link2, Microscope, PackageCheck, Pill, Printer, QrCode, ReceiptText,
  RefreshCcw, ScanLine, Shield, Syringe, User, Wallet as WalletIcon, Eye, Share2,
} from "lucide-react";
import QRCode from "qrcode";
import { useCallback, useState } from "react";
import { toast } from "sonner";

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
  const { data: cards, isLoading } = trpc.wallet.cards.useQuery();
  const { data: history, isLoading: histLoading } = trpc.wallet.history.useQuery();
  const [selectedCard, setSelectedCard] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [qrMode, setQrMode] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [presentation, setPresentation] = useState<any>(null);

  const presentMutation = trpc.wallet.present.useMutation({
    onSuccess: async (data) => {
      setPresentation(data);
      setQrDataUrl(await QRCode.toDataURL(data.qrData, { margin: 1, width: 240 }));
      setQrMode(true);
      toast.success("สร้าง VP QR สำเร็จ");
    },
    onError: (error) => toast.error(error.message),
  });

  const handleCardClick = useCallback((card: any) => {
    setSelectedCard(card);
    setQrMode(false);
    setQrDataUrl("");
    setPresentation(null);
    setDetailOpen(true);
  }, []);

  const handleGenerateQR = useCallback(() => {
    if (selectedCard) {
      presentMutation.mutate({ cardId: selectedCard.id });
    }
  }, [selectedCard, presentMutation]);

  const handlePrintQR = useCallback(() => {
    window.print();
    toast.info("กำลังพิมพ์ VP QR");
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-3">
            <WalletIcon className="h-6 w-6 text-primary" />
            กระเป๋าสุขภาพ
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Health Wallet — เก็บ Verifiable Credentials และสร้าง VP QR เพื่อแสดงต่อ Verifier</p>
        </div>

        <Tabs defaultValue="cards">
          <TabsList>
            <TabsTrigger value="cards" className="gap-2"><CreditCard className="h-3.5 w-3.5" />การ์ดสุขภาพ</TabsTrigger>
            <TabsTrigger value="history" className="gap-2"><History className="h-3.5 w-3.5" />ประวัติการแสดง</TabsTrigger>
          </TabsList>

          <TabsContent value="cards" className="mt-4">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-44 rounded-xl" />)}
              </div>
            ) : cards && cards.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {cards.map((card: any) => {
                  const config = cardTypeConfig[card.cardType] || cardTypeConfig.identity;
                  const Icon = config.icon;
                  return (
                    <button
                      key={card.id}
                      onClick={() => handleCardClick(card)}
                      className={`relative rounded-xl p-5 text-left text-white shadow-lg hover:shadow-xl transition-all duration-200 bg-gradient-to-br ${config.bgGradient} hover:-translate-y-1 active:scale-[0.97]`}
                      style={{ minHeight: "160px" }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-sm shrink-0">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-semibold text-sm truncate">{card.displayName}</h3>
                            <p className="text-xs opacity-80 truncate">{card.issuerHospitalName || "TrustCare Network"}</p>
                          </div>
                        </div>
                        {card.isPinned && <Badge className="bg-white/20 text-white border-0 text-[10px]">ปักหมุด</Badge>}
                      </div>
                      <div className="mt-8 flex items-end justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-[10px] opacity-60 uppercase tracking-wider">Category</p>
                          <p className="text-xs opacity-90 truncate">{card.documentCategory || card.cardType}</p>
                        </div>
                        <div className="flex items-center gap-1.5 text-white/80">
                          <QrCode className="h-4 w-4" />
                          <span className="text-[10px] uppercase tracking-wider">VP</span>
                        </div>
                      </div>
                      {/* Decorative watermark */}
                      <div className="absolute top-3 right-3 opacity-10">
                        <Icon className="h-16 w-16" />
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <WalletIcon className="h-12 w-12 text-muted-foreground/30 mb-4" />
                  <p className="text-muted-foreground">ยังไม่มี Health Card ในกระเป๋า</p>
                  <p className="text-xs text-muted-foreground mt-1">เมื่อโรงพยาบาลออก VC ให้คุณ การ์ดจะปรากฏที่นี่</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            {histLoading ? (
              <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
            ) : history && history.length > 0 ? (
              <Card>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {history.map((item: any) => (
                      <div key={item.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                            <QrCode className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{item.verifierName || "Verifier"}</p>
                            <p className="text-xs text-muted-foreground">{item.purpose || "verification"} • {new Date(item.createdAt).toLocaleString("th-TH")}</p>
                          </div>
                        </div>
                        <Badge variant={item.verificationResult === "valid" ? "default" : "destructive"} className="text-[10px]">
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
                  <p className="text-muted-foreground">ยังไม่มีประวัติการแสดงข้อมูล</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Credential Detail + QR Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-md">
          {selectedCard && !qrMode && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {(() => {
                    const config = cardTypeConfig[selectedCard.cardType] || cardTypeConfig.identity;
                    const Icon = config.icon;
                    return <Icon className="h-5 w-5 text-primary" />;
                  })()}
                  {selectedCard.displayName}
                </DialogTitle>
                <DialogDescription>{selectedCard.displayNameEn || selectedCard.cardType}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {/* Card Preview */}
                <div className={`rounded-xl p-4 text-white bg-gradient-to-br ${(cardTypeConfig[selectedCard.cardType] || cardTypeConfig.identity).bgGradient}`}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center">
                      {(() => {
                        const Icon = (cardTypeConfig[selectedCard.cardType] || cardTypeConfig.identity).icon;
                        return <Icon className="h-5 w-5" />;
                      })()}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{selectedCard.displayName}</p>
                      <p className="text-xs opacity-80">{selectedCard.issuerHospitalName || "TrustCare Network"}</p>
                    </div>
                  </div>
                  <Separator className="bg-white/20 mb-3" />
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div><p className="opacity-60">ประเภท</p><p className="opacity-90">{selectedCard.documentCategory || selectedCard.cardType}</p></div>
                    <div><p className="opacity-60">สร้างเมื่อ</p><p className="opacity-90">{new Date(selectedCard.createdAt).toLocaleDateString("th-TH")}</p></div>
                  </div>
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-3">
                  <Button onClick={handleGenerateQR} disabled={presentMutation.isPending} className="gap-2">
                    <QrCode className="h-4 w-4" />
                    {presentMutation.isPending ? "กำลังสร้าง..." : "สร้าง VP QR"}
                  </Button>
                  <Button variant="outline" className="gap-2" onClick={() => toast.info("ฟีเจอร์แชร์จะเปิดให้ใช้เร็วๆ นี้")}>
                    <Share2 className="h-4 w-4" />แชร์
                  </Button>
                </div>

                {/* Metadata */}
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
                    <Eye className="h-4 w-4" />ดูรายละเอียด
                  </Button>
                  <Button variant="outline" onClick={handlePrintQR} className="flex-1 gap-2">
                    <Printer className="h-4 w-4" />พิมพ์ QR
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
