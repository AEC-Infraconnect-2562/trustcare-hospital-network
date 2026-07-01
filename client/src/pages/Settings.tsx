import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Settings as SettingsIcon, User, Globe, Bell, Shield } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Settings() {
  const { user } = useAuth();
  const [language, setLanguage] = useState("th");
  const [notifications, setNotifications] = useState(true);

  const updateProfile = trpc.auth.updateProfile.useMutation({
    onSuccess: () => toast.success("บันทึกการตั้งค่าสำเร็จ"),
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">ตั้งค่า</h1>
          <p className="text-muted-foreground text-sm mt-1">จัดการโปรไฟล์และการตั้งค่าระบบ</p>
        </div>

        {/* Profile */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />ข้อมูลส่วนตัว
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>ชื่อ</Label>
              <Input defaultValue={user?.name || ""} placeholder="ชื่อ-นามสกุล" />
            </div>
            <div className="space-y-2">
              <Label>อีเมล</Label>
              <Input defaultValue={user?.email || ""} disabled className="bg-muted" />
            </div>
            <Button onClick={() => updateProfile.mutate({ preferredLanguage: language as any })}>
              บันทึก
            </Button>
          </CardContent>
        </Card>

        {/* Language */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" />ภาษา
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">ภาษาที่ใช้แสดงผล</p>
                <p className="text-xs text-muted-foreground">เลือกภาษาสำหรับอินเทอร์เฟซ</p>
              </div>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="th">ไทย</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />การแจ้งเตือน
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">แจ้งเตือนใบรับรองใหม่</p>
                <p className="text-xs text-muted-foreground">เมื่อมีใบรับรองออกให้คุณ</p>
              </div>
              <Switch checked={notifications} onCheckedChange={setNotifications} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">แจ้งเตือนการส่งต่อ</p>
                <p className="text-xs text-muted-foreground">เมื่อมีใบส่งต่อเข้ามา</p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">แจ้งเตือนความยินยอมหมดอายุ</p>
                <p className="text-xs text-muted-foreground">ก่อนความยินยอมหมดอายุ 7 วัน</p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />ความปลอดภัย
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">ยืนยันตัวตนก่อนแสดง QR</p>
                <p className="text-xs text-muted-foreground">ต้องยืนยันทุกครั้งก่อนแสดง Health Card</p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">แจ้งเตือนการเข้าถึงข้อมูล</p>
                <p className="text-xs text-muted-foreground">แจ้งเตือนทุกครั้งที่มีการตรวจสอบข้อมูลของคุณ</p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
