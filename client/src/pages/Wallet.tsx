import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { Wallet as WalletIcon, CreditCard, History, QrCode, Shield, AlertTriangle, Pill, FileText, User, Syringe, Printer, Fingerprint, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useCallback } from "react";
import { toast } from "sonner";

const cardTypeConfig: Record<string, { icon: any; color: string; bgGradient: string }> = {
  allergy: { icon: AlertTriangle, color: "text-red-100", bgGradient: "from-red-500 to-red-700" },
  medication: { icon: Pill, color: "text-blue-100", bgGradient: "from-blue-500 to-blue-700" },
  patient_summary: { icon: FileText, color: "text-emerald-100", bgGradient: "from-emerald-500 to-emerald-700" },
  consent: { icon: Shield, color: "text-violet-100", bgGradient: "from-violet-500 to-violet-700" },
  identity: { icon: User, color: "text-slate-100", bgGradient: "from-slate-600 to-slate-800" },
  immunization: { icon: Syringe, color: "text-amber-100", bgGradient: "from-amber-500 to-amber-700" },
  referral: { icon: FileText, color: "text-cyan-100", bgGradient: "from-cyan-500 to-cyan-700" },
};

export default function Wallet() {
  const { data: cards, isLoading } = trpc.wallet.cards.useQuery();
  const { data: history, isLoading: histLoading } = trpc.wallet.history.useQuery();
  const [selectedCard, setSelectedCard] = useState<any>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [biometricVerified, setBiometricVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const handleShowQR = useCallback((card: any) => {
    setSelectedCard(card);
    setBiometricVerified(false);
    setQrOpen(true);
  }, []);

  const handleBiometricConfirm = useCallback(async () => {
    setVerifying(true);
    // Simulate biometric verification (in real app, use WebAuthn API)
    await new Promise(r => setTimeout(r, 1200));
    setBiometricVerified(true);
    setVerifying(false);
    toast.success("ยืนยันตัวตนสำเร็จ");
  }, []);

  const handlePrintQR = useCallback(() => {
    window.print();
    toast.info("กำลังพิมพ์ QR Code สำหรับใช้แบบกระดาษ");
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">กระเป๋าสุขภาพ</h1>
          <p className="text-muted-foreground text-sm mt-1">Health Card ของคุณ — แตะเพื่อแสดง QR Code</p>
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
                    <div
                      key={card.id}
                      onClick={() => handleShowQR(card)}
                      className={`relative rounded-xl p-5 text-white shadow-lg hover:shadow-xl transition-all cursor-pointer bg-gradient-to-br ${config.bgGradient} hover:-translate-y-1 active:scale-[0.97]`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-sm">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="font-medium text-sm">{card.displayName}</h3>
                            <p className="text-xs opacity-80">{card.issuerHospitalName || "Trustcare Network"}</p>
                          </div>
                        </div>
                        {card.isPinned && <Badge className="bg-white/20 text-white border-0 text-[10px]">ปักหมุด</Badge>}
                      </div>
                      <div className="mt-6 flex items-end justify-between">
                        <div>
                          <p className="text-[10px] opacity-60 uppercase tracking-wider">ประเภท</p>
                          <p className="text-xs opacity-90">{card.displayNameEn || card.cardType}</p>
                        </div>
                        <div className="flex items-center gap-1 text-white/80">
                          <QrCode className="h-3.5 w-3.5" />
                          <span className="text-xs">แตะเพื่อแสดง</span>
                        </div>
                      </div>
                      <div className="absolute top-0 right-0 w-24 h-24 opacity-10">
                        <svg viewBox="0 0 100 100" fill="currentColor">
                          <circle cx="80" cy="20" r="40" />
                        </svg>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <WalletIcon className="h-12 w-12 text-muted-foreground/30 mb-4" />
                  <p className="text-muted-foreground">ยังไม่มี Health Card ในกระเป๋า</p>
                  <p className="text-sm text-muted-foreground mt-1">เมื่อโรงพยาบาลออกใบรับรองให้ การ์ดจะปรากฏที่นี่</p>
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
                    {history.map((h: any) => (
                      <div key={h.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <QrCode className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{h.verifierName || "ผู้ตรวจสอบ"}</p>
                            <p className="text-xs text-muted-foreground">{h.purpose || "ตรวจสอบข้อมูล"}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant={h.verificationResult === "valid" ? "default" : "destructive"} className="text-[10px]">
                            {h.verificationResult === "valid" ? "ผ่าน" : h.verificationResult === "expired" ? "หมดอายุ" : "ไม่ผ่าน"}
                          </Badge>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {new Date(h.presentedAt).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}
                          </p>
                        </div>
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

      {/* QR Presentation Modal */}
      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center">แสดงข้อมูลสุขภาพ</DialogTitle>
            <DialogDescription className="text-center">
              {biometricVerified ? "แสดง QR Code ให้เจ้าหน้าที่สแกน" : "กรุณายืนยันตัวตนก่อนแสดงข้อมูล"}
            </DialogDescription>
          </DialogHeader>

          {!biometricVerified ? (
            <div className="flex flex-col items-center gap-6 py-6">
              <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                <Fingerprint className="h-10 w-10 text-primary" />
              </div>
              <div className="text-center space-y-2">
                <p className="text-sm font-medium">ยืนยันตัวตน</p>
                <p className="text-xs text-muted-foreground">
                  เพื่อความปลอดภัย กรุณายืนยันตัวตนก่อนแสดงข้อมูลสุขภาพ
                </p>
              </div>
              <Button
                onClick={handleBiometricConfirm}
                disabled={verifying}
                className="w-full"
                size="lg"
              >
                {verifying ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    กำลังยืนยัน...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Fingerprint className="h-4 w-4" />
                    แตะเพื่อยืนยัน
                  </span>
                )}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="flex items-center gap-2 text-green-600 mb-2">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-xs font-medium">ยืนยันตัวตนแล้ว</span>
              </div>

              {/* QR Code Display */}
              <div className="border-2 border-dashed border-muted-foreground/20 rounded-xl p-4 bg-white">
                <div className="w-48 h-48 bg-gradient-to-br from-gray-100 to-gray-50 rounded-lg flex items-center justify-center relative">
                  {/* Simulated QR pattern */}
                  <div className="grid grid-cols-7 gap-0.5 p-2">
                    {Array.from({ length: 49 }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-5 h-5 rounded-sm ${
                          Math.random() > 0.5 ? "bg-gray-900" : "bg-white"
                        }`}
                      />
                    ))}
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-10 w-10 bg-white rounded-lg shadow-sm flex items-center justify-center">
                      <QrCode className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-center space-y-1">
                <p className="text-sm font-medium">{selectedCard?.displayName}</p>
                <p className="text-xs text-muted-foreground">
                  QR Code นี้มีอายุ 5 นาที
                </p>
              </div>

              {/* Paper QR Fallback */}
              <div className="w-full border-t pt-4 mt-2">
                <Button
                  variant="outline"
                  onClick={handlePrintQR}
                  className="w-full gap-2"
                >
                  <Printer className="h-4 w-4" />
                  พิมพ์ QR Code (สำหรับใช้แบบกระดาษ)
                </Button>
                <p className="text-[10px] text-muted-foreground text-center mt-2">
                  สำหรับผู้ที่ไม่สะดวกใช้โทรศัพท์ สามารถพิมพ์ QR Code ไว้ใช้แทนได้
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
