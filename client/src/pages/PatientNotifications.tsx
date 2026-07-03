import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { Bell, BellOff, CheckCheck, FileCheck2, CalendarClock, ShieldCheck, AlertCircle, Info, Loader2 } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

const typeConfig: Record<string, { icon: typeof Bell; label: string; labelEn: string; color: string }> = {
  vc_issued: { icon: FileCheck2, label: "VC ออกแล้ว", labelEn: "VC Issued", color: "text-green-600" },
  vc_approved: { icon: FileCheck2, label: "VC อนุมัติแล้ว", labelEn: "VC Approved", color: "text-blue-600" },
  vc_rejected: { icon: AlertCircle, label: "VC ถูกปฏิเสธ", labelEn: "VC Rejected", color: "text-red-600" },
  vc_revoked: { icon: AlertCircle, label: "VC ถูกเพิกถอน", labelEn: "VC Revoked", color: "text-red-600" },
  vc_request_created: { icon: FileCheck2, label: "คำขอ VC ใหม่", labelEn: "VC Request Created", color: "text-purple-600" },
  vc_submitted_for_review: { icon: FileCheck2, label: "ส่งตรวจสอบ", labelEn: "Submitted for Review", color: "text-indigo-600" },
  consent_request: { icon: ShieldCheck, label: "ขอความยินยอม", labelEn: "Consent Request", color: "text-amber-600" },
  consent_expiry_reminder: { icon: CalendarClock, label: "ความยินยอมใกล้หมดอายุ", labelEn: "Consent Expiring", color: "text-amber-600" },
  referral_update: { icon: Info, label: "อัปเดตการส่งต่อ", labelEn: "Referral Update", color: "text-teal-600" },
  system: { icon: Bell, label: "ระบบ", labelEn: "System", color: "text-gray-600" },
  hospital_onboarded: { icon: Info, label: "โรงพยาบาลเข้าร่วม", labelEn: "Hospital Onboarded", color: "text-blue-600" },
  break_glass: { icon: AlertCircle, label: "เข้าถึงฉุกเฉิน", labelEn: "Break Glass", color: "text-red-600" },
  data_quality: { icon: Info, label: "คุณภาพข้อมูล", labelEn: "Data Quality", color: "text-orange-600" },
};

type NotifCategory = "all" | "vc" | "consent" | "system";

export default function PatientNotifications() {
  const [category, setCategory] = useState<NotifCategory>("all");
  const { data: notifications, isLoading, refetch } = trpc.notification.list.useQuery();
  const { data: unreadCount } = trpc.notification.unreadCount.useQuery();
  const markRead = trpc.notification.markRead.useMutation({ onSuccess: () => refetch() });
  const markAllRead = trpc.notification.markAllRead.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("อ่านทั้งหมดแล้ว");
    },
  });

  const filtered = useMemo(() => {
    if (!notifications) return [];
    if (category === "all") return notifications;
    if (category === "vc") return notifications.filter((n: any) => n.type.startsWith("vc_"));
    if (category === "consent") return notifications.filter((n: any) => n.type.startsWith("consent_"));
    return notifications.filter((n: any) => ["system", "hospital_onboarded", "break_glass", "data_quality", "referral_update"].includes(n.type));
  }, [notifications, category]);

  const handleMarkRead = (id: number) => {
    markRead.mutate({ id });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">แจ้งเตือน</h1>
            <p className="text-sm text-muted-foreground mt-1">
              การแจ้งเตือนเกี่ยวกับใบรับรอง ความยินยอม และระบบ
            </p>
          </div>
          {unreadCount && unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
            >
              <CheckCheck className="h-4 w-4 mr-2" />
              อ่านทั้งหมด ({unreadCount})
            </Button>
          )}
        </div>

        {/* Category Tabs */}
        <Tabs value={category} onValueChange={(v) => setCategory(v as NotifCategory)}>
          <TabsList>
            <TabsTrigger value="all">ทั้งหมด</TabsTrigger>
            <TabsTrigger value="vc">ใบรับรอง</TabsTrigger>
            <TabsTrigger value="consent">ความยินยอม</TabsTrigger>
            <TabsTrigger value="system">ระบบ</TabsTrigger>
          </TabsList>

          <TabsContent value={category} className="mt-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <BellOff className="h-12 w-12 text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground">ไม่มีการแจ้งเตือน</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {filtered.map((notif: any) => {
                  const config = typeConfig[notif.type] || { icon: Bell, label: notif.type, labelEn: notif.type, color: "text-gray-600" };
                  const Icon = config.icon;
                  return (
                    <Card
                      key={notif.id}
                      className={`transition-colors cursor-pointer ${!notif.isRead ? "bg-primary/5 border-primary/20" : "hover:bg-muted/50"}`}
                      onClick={() => !notif.isRead && handleMarkRead(notif.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 shrink-0 ${config.color}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className={`text-sm font-medium ${!notif.isRead ? "text-foreground" : "text-muted-foreground"}`}>
                                {notif.title}
                              </p>
                              {!notif.isRead && (
                                <Badge variant="default" className="text-[10px] px-1.5 py-0">ใหม่</Badge>
                              )}
                            </div>
                            {notif.message && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{notif.message}</p>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline" className="text-[10px]">{config.label}</Badge>
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(notif.createdAt).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
