import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { Users as UsersIcon, Shield, User } from "lucide-react";

const roleLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  admin: { label: "ผู้ดูแลระบบ", variant: "default" },
  user: { label: "ผู้ใช้งาน", variant: "secondary" },
};

export default function Users() {
  const { data: users, isLoading } = trpc.users.list.useQuery({});

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">จัดการผู้ใช้</h1>
          <p className="text-muted-foreground text-sm mt-1">ผู้ใช้งานทั้งหมดในระบบ</p>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">กำลังโหลด...</div>
            ) : users && users.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ผู้ใช้</TableHead>
                    <TableHead>อีเมล</TableHead>
                    <TableHead>บทบาท</TableHead>
                    <TableHead>เข้าสู่ระบบล่าสุด</TableHead>
                    <TableHead>วันที่สร้าง</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u: any) => {
                    const role = roleLabels[u.role] || roleLabels.user;
                    return (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                              {u.role === "admin" ? <Shield className="h-4 w-4 text-primary" /> : <User className="h-4 w-4 text-muted-foreground" />}
                            </div>
                            <span className="font-medium text-sm">{u.name || "ไม่ระบุชื่อ"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{u.email || "—"}</TableCell>
                        <TableCell><Badge variant={role.variant} className="text-[10px]">{role.label}</Badge></TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {u.lastSignedIn ? new Date(u.lastSignedIn).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" }) : "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(u.createdAt).toLocaleDateString("th-TH")}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center py-16">
                <UsersIcon className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground">ยังไม่มีผู้ใช้ในระบบ</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
