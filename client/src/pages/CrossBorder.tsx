import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CareTransitionWorkspace } from "@/components/CareTransitionWorkspace";
import { CrossBorderCreateWizard } from "@/components/CrossBorderCreateWizard";
import { PartnerTrustVerification } from "@/components/PartnerTrustVerification";
import { trpc } from "@/lib/trpc";
import { useMemo, useState } from "react";
import { Globe, Plus, ArrowRightLeft, Send, FileText, ClipboardList, Package } from "lucide-react";
import { toast } from "sonner";

const statusLabels: Record<string, string> = {
  draft: "ร่าง",
  consent_requested: "ขอความยินยอม",
  consent_granted: "ได้รับความยินยอม",
  packet_generated: "สร้างแพ็กเก็ตข้อมูล",
  sent: "ส่งแล้ว",
  acknowledged: "รับทราบ",
  accepted: "ตอบรับ",
  rejected: "ปฏิเสธ",
  completed: "เสร็จสิ้น",
  counter_referral_received: "ได้รับการส่งกลับ",
  closed: "ปิด",
};

const typeLabels: Record<string, string> = {
  cross_branch: "ข้ามสาขา",
  cross_border_outbound: "ส่งออกข้ามประเทศ",
  cross_border_inbound: "รับเข้าข้ามประเทศ",
  external_partner: "พันธมิตรภายนอก",
};

export default function CrossBorder() {
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedReferralId, setSelectedReferralId] = useState<number>();

  const { data: referrals, refetch } = trpc.crossBorderReferral.list.useQuery({
    referralType: typeFilter === "all" ? undefined : typeFilter,
  });
  const selectedReferral = useMemo(() => {
    if (!referrals?.length) return undefined;
    return referrals.find((item: any) => item.id === selectedReferralId) ?? referrals[0];
  }, [referrals, selectedReferralId]);
  const createReferral = trpc.crossBorderReferral.create.useMutation({
    onSuccess: () => { refetch(); setShowCreateDialog(false); toast.success("สร้างการส่งต่อข้ามเครือข่ายสำเร็จ"); }
  });
  const updateStatus = trpc.crossBorderReferral.updateStatus.useMutation({
    onSuccess: () => { refetch(); toast.success("อัปเดตสถานะสำเร็จ"); }
  });
  const generatePacket = trpc.crossBorderReferral.generatePacket.useMutation({
    onSuccess: (data) => { refetch(); toast.success(`สร้าง SHL แพ็กเก็ตสำเร็จ (ID: ${data.shlId})`); }
  });

  const overview = trpc.careTransition.overview.useQuery();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Globe className="h-7 w-7 text-primary" />
              ส่งต่อข้ามเครือข่าย
            </h1>
            <p className="text-muted-foreground mt-1">จัดการการส่งต่อผู้ป่วยข้ามสาขา ข้ามเครือข่าย และข้ามประเทศ พร้อม SHL packet</p>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />สร้างการส่งต่อ</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>สร้างการส่งต่อข้ามเครือข่าย (Wizard)</DialogTitle></DialogHeader>
              <CrossBorderCreateWizard onSuccess={() => { setShowCreateDialog(false); refetch(); }} onCancel={() => setShowCreateDialog(false)} />
            </DialogContent>
          </Dialog>
        </div>

        {/* KPI Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPI title="เคสทั้งหมด" value={referrals?.length ?? 0} icon={Globe} />
          <KPI title="เอกสาร" value={overview.data?.stats.documents ?? 0} icon={FileText} />
          <KPI title="งานค้าง" value={overview.data?.stats.activeTasks ?? 0} icon={ClipboardList} />
          <KPI title="แพ็กเกจ" value={overview.data?.stats.packages ?? 0} icon={Package} />
        </div>

        {/* Partner Trust Verification */}
        {selectedReferral && (
          <PartnerTrustVerification partnerDid={selectedReferral.partnerOrgName ? `did:web:${selectedReferral.partnerOrgName.toLowerCase().replace(/\s+/g, "-")}` : undefined} />
        )}
        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="pt-4">
              <p className="font-medium text-sm">ข้ามสาขา (Cross-branch)</p>
              <p className="text-xs text-muted-foreground mt-1">ส่งต่อระหว่างโรงพยาบาลในเครือ Trustcare</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500">
            <CardContent className="pt-4">
              <p className="font-medium text-sm">ข้ามประเทศ (Cross-border)</p>
              <p className="text-xs text-muted-foreground mt-1">ส่งต่อไปยังโรงพยาบาลในต่างประเทศ พร้อม IPS + SHL</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-purple-500">
            <CardContent className="pt-4">
              <p className="font-medium text-sm">พันธมิตร (External Partner)</p>
              <p className="text-xs text-muted-foreground mt-1">ส่งต่อไปยังองค์กรพันธมิตรที่ลงทะเบียนใน Trust Registry</p>
            </CardContent>
          </Card>
        </div>

        {/* List */}
        <Tabs defaultValue="all" onValueChange={setTypeFilter}>
          <TabsList>
            <TabsTrigger value="all">ทั้งหมด</TabsTrigger>
            <TabsTrigger value="cross_branch">ข้ามสาขา</TabsTrigger>
            <TabsTrigger value="cross_border_outbound">ส่งออก</TabsTrigger>
            <TabsTrigger value="cross_border_inbound">รับเข้า</TabsTrigger>
            <TabsTrigger value="external_partner">พันธมิตร</TabsTrigger>
          </TabsList>
          <TabsContent value={typeFilter} className="mt-4">
            <Card>
              <CardContent className="pt-6">
                {(!referrals || referrals.length === 0) ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <ArrowRightLeft className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>ยังไม่มีการส่งต่อข้ามเครือข่าย</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {referrals.map(r => (
                      <div
                        key={r.id}
                        className={`flex items-center justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors cursor-pointer ${selectedReferral?.id === r.id ? "border-primary" : ""}`}
                        onClick={() => setSelectedReferralId(r.id)}
                      >
                        <div className="flex items-center gap-4">
                          <div className="p-2 rounded-full bg-primary/10">
                            <Globe className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">#{r.id} — {r.partnerOrgName || "ไม่ระบุ"}</p>
                            <p className="text-sm text-muted-foreground">
                              <Badge variant="outline" className="mr-2">{typeLabels[r.referralType] || r.referralType}</Badge>
                              {r.partnerCountry && <span className="mr-2">🌍 {r.partnerCountry}</span>}
                              {r.translationRequired && <span className="text-orange-600">🌐 ต้องแปล</span>}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{statusLabels[r.status] || r.status}</Badge>
                          {r.status === "packet_generated" && (
                            <Button size="sm" onClick={() => updateStatus.mutate({ id: r.id, status: "sent" })}>
                              <Send className="h-3 w-3 mr-1" />ส่ง
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <CareTransitionWorkspace
          caseType={selectedReferral?.referralType === "external_partner" ? "external_partner" : selectedReferral?.referralType === "cross_branch" ? "cross_branch" : "cross_border"}
          caseId={selectedReferral?.id}
          recipientName={selectedReferral?.partnerOrgName || undefined}
          defaultPackageType="cross_border"
        />
      </div>
    </DashboardLayout>
  );
}

function KPI({ title, value, icon: Icon }: { title: string; value: number; icon: any }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">{title}</p>
      </div>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}
