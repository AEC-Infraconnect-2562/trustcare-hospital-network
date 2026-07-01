import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle, BadgeCheck, CalendarDays, CreditCard, FileBadge, FileCheck2, FileText, Globe2,
  History, Landmark, Link2, Microscope, PackageCheck, Pill, Printer, QrCode, ReceiptText,
  RefreshCcw, ScanLine, Shield, Syringe, User, Wallet as WalletIcon,
} from "lucide-react";
import QRCode from "qrcode";
import { useCallback, useState } from "react";
import { toast } from "sonner";

const cardTypeConfig: Record<string, { icon: any; bgGradient: string }> = {
  allergy: { icon: AlertTriangle, bgGradient: "from-red-500 to-red-700" },
  medication: { icon: Pill, bgGradient: "from-blue-500 to-blue-700" },
  patient_summary: { icon: FileText, bgGradient: "from-emerald-500 to-emerald-700" },
  consent: { icon: Shield, bgGradient: "from-violet-500 to-violet-700" },
  identity: { icon: User, bgGradient: "from-slate-600 to-slate-800" },
  immunization: { icon: Syringe, bgGradient: "from-amber-500 to-amber-700" },
  referral: { icon: FileText, bgGradient: "from-cyan-500 to-cyan-700" },
  medical_certificate: { icon: FileBadge, bgGradient: "from-teal-600 to-teal-800" },
  prescription: { icon: Pill, bgGradient: "from-sky-600 to-sky-800" },
  lab_result: { icon: Microscope, bgGradient: "from-lime-600 to-lime-800" },
  diagnostic_report: { icon: ScanLine, bgGradient: "from-indigo-600 to-indigo-800" },
  discharge_summary: { icon: FileCheck2, bgGradient: "from-green-600 to-green-800" },
  coverage: { icon: Shield, bgGradient: "from-emerald-600 to-emerald-800" },
  claim: { icon: ReceiptText, bgGradient: "from-rose-600 to-rose-800" },
  travel_document: { icon: Globe2, bgGradient: "from-cyan-600 to-cyan-800" },
  shl_manifest: { icon: QrCode, bgGradient: "from-zinc-600 to-zinc-800" },
  pharmacy_dispense: { icon: PackageCheck, bgGradient: "from-blue-600 to-blue-800" },
  appointment: { icon: CalendarDays, bgGradient: "from-purple-600 to-purple-800" },
  visa_support_letter: { icon: BadgeCheck, bgGradient: "from-fuchsia-600 to-fuchsia-800" },
  quotation: { icon: FileText, bgGradient: "from-orange-600 to-orange-800" },
  guarantee_letter: { icon: Landmark, bgGradient: "from-yellow-600 to-yellow-800" },
  mpi_link_certificate: { icon: Link2, bgGradient: "from-stone-600 to-stone-800" },
  sync_receipt: { icon: RefreshCcw, bgGradient: "from-slate-600 to-slate-800" },
};

export default function Wallet() {
  const { data: cards, isLoading } = trpc.wallet.cards.useQuery();
  const { data: history, isLoading: histLoading } = trpc.wallet.history.useQuery();
  const [selectedCard, setSelectedCard] = useState<any>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [presentation, setPresentation] = useState<any>(null);

  const presentMutation = trpc.wallet.present.useMutation({
    onSuccess: async (data) => {
      setPresentation(data);
      setQrDataUrl(await QRCode.toDataURL(data.qrData, { margin: 1, width: 224 }));
      toast.success("สร้าง VP QR สำเร็จ");
    },
    onError: (error) => toast.error(error.message),
  });

  const handleShowQR = useCallback((card: any) => {
    setSelectedCard(card);
    setQrDataUrl("");
    setPresentation(null);
    setQrOpen(true);
  }, []);

  const handlePrintQR = useCallback(() => {
    window.print();
    toast.info("กำลังพิมพ์ VP QR");
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">กระเป๋าสุขภาพ</h1>
          <p className="text-muted-foreground text-sm mt-1">Health cards backed by issued VC/VP records.</p>
        </div>

        <Tabs defaultValue="cards">
          <TabsList>
            <TabsTrigger value="cards" className="gap-2"><CreditCard className="h-3.5 w-3.5" />การ์ดสุขภาพ</TabsTrigger>
            <TabsTrigger value="history" className="gap-2"><History className="h-3.5 w-3.5" />ประวัติการแสดง</TabsTrigger>
          </TabsList>

          <TabsContent value="cards" className="mt-4">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-44 rounded-xl" />)}
              </div>
            ) : cards && cards.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {cards.map((card: any) => {
                  const config = cardTypeConfig[card.cardType] || cardTypeConfig.identity;
                  const Icon = config.icon;
                  return (
                    <button
                      key={card.id}
                      onClick={() => handleShowQR(card)}
                      className={`relative rounded-lg p-5 text-left text-white shadow-lg hover:shadow-xl transition-all bg-gradient-to-br ${config.bgGradient} hover:-translate-y-1 active:scale-[0.98]`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-sm shrink-0">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-medium text-sm truncate">{card.displayName}</h3>
                            <p className="text-xs opacity-80 truncate">{card.issuerHospitalName || "TrustCare Network"}</p>
                          </div>
                        </div>
                        {card.isPinned && <Badge className="bg-white/20 text-white border-0 text-[10px]">ปักหมุด</Badge>}
                      </div>
                      <div className="mt-6 flex items-end justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-[10px] opacity-60 uppercase tracking-wider">Type</p>
                          <p className="text-xs opacity-90 truncate">{card.displayNameEn || card.cardType}</p>
                        </div>
                        <div className="flex items-center gap-1 text-white/80">
                          <QrCode className="h-3.5 w-3.5" />
                          <span className="text-xs">VP QR</span>
                        </div>
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
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <QrCode className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{item.verifierName || "Verifier"}</p>
                            <p className="text-xs text-muted-foreground">{item.purpose || "verification"}</p>
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

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center">Verifiable Presentation QR</DialogTitle>
            <DialogDescription className="text-center">{selectedCard?.displayName}</DialogDescription>
          </DialogHeader>

          {!qrDataUrl ? (
            <div className="flex flex-col items-center gap-5 py-6">
              <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                <QrCode className="h-10 w-10 text-primary" />
              </div>
              <Button
                onClick={() => selectedCard && presentMutation.mutate({ cardId: selectedCard.id })}
                disabled={!selectedCard || presentMutation.isPending}
                className="w-full"
                size="lg"
              >
                {presentMutation.isPending ? "กำลังสร้าง QR..." : "สร้าง VP QR"}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="rounded-lg border p-3 bg-white">
                <img src={qrDataUrl} alt="Verifiable Presentation QR" className="h-56 w-56" />
              </div>
              <div className="text-center space-y-1 max-w-full">
                <p className="text-sm font-medium">{selectedCard?.displayName}</p>
                <p className="text-xs text-muted-foreground break-all">{presentation?.presentationId}</p>
                {presentation?.expiresAt && <p className="text-xs text-muted-foreground">Expires {new Date(presentation.expiresAt).toLocaleString("th-TH")}</p>}
              </div>
              <Button variant="outline" onClick={handlePrintQR} className="w-full gap-2">
                <Printer className="h-4 w-4" />
                พิมพ์ QR
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
