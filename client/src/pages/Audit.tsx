import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { ScrollText, Search, AlertTriangle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useState } from "react";

const actionLabels: Record<string, string> = {
  "hospital.created": "เพิ่มโรงพยาบาล",
  "hospital.updated": "แก้ไขโรงพยาบาล",
  "credential.issued": "ออกใบรับรอง",
  "credential.revoked": "เพิกถอนใบรับรอง",
  "credential.verified": "ตรวจสอบใบรับรอง",
  "consent.granted": "ให้ความยินยอม",
  "consent.revoked": "ถอนความยินยอม",
  "referral.created": "สร้างใบส่งต่อ",
  "referral.accepted": "รับใบส่งต่อ",
  "referral.completed": "ส่งต่อเสร็จสิ้น",
  "referral.rejected": "ปฏิเสธใบส่งต่อ",
  "user.login": "เข้าสู่ระบบ",
  "user.logout": "ออกจากระบบ",
  "data.accessed": "เข้าถึงข้อมูล",
  "data.exported": "ส่งออกข้อมูล",
};

export default function Audit() {
  const [filter, setFilter] = useState({ action: "", hospitalId: "", search: "" });
  const { data: logs, isLoading } = trpc.audit.list.useQuery({
    action: filter.action || undefined,
    hospitalId: filter.hospitalId ? Number(filter.hospitalId) : undefined,
    limit: 100,
  });
  const { data: hospitals } = trpc.hospital.list.useQuery();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">บันทึกตรวจสอบ</h1>
            <p className="text-muted-foreground text-sm mt-1">Audit Trail — ประวัติการเข้าถึงและดำเนินการทั้งหมด</p>
          </div>
          <Button variant="outline" className="gap-2" onClick={() => {
            if (!logs || logs.length === 0) { toast.error("ไม่มีข้อมูลให้ส่งออก"); return; }
            const csv = ["เวลา,กิจกรรม,ทรัพยากร,ผู้ดำเนินการ,IP,Break-glass",
              ...logs.map((l: any) => `${new Date(l.createdAt).toISOString()},${l.action},${l.resourceType || ""},${l.actorId},${l.ipAddress || ""},${l.isBreakGlass ? "Yes" : "No"}`)
            ].join("\n");
            const blob = new Blob([csv], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a"); a.href = url; a.download = `audit-log-${Date.now()}.csv`; a.click();
            URL.revokeObjectURL(url);
            toast.success("ส่งออกข้อมูลสำเร็จ");
          }}>
            <Download className="h-4 w-4" />ส่งออก CSV
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                <Input
                  placeholder="ค้นหาผู้ดำเนินการ, ทรัพยากร..."
                  value={filter.search}
                  onChange={e => setFilter(p => ({ ...p, search: e.target.value }))}
                  className="h-9"
                />
              </div>
              <div className="flex items-center gap-2">
                <Select value={filter.action} onValueChange={v => setFilter(p => ({ ...p, action: v }))}>
                  <SelectTrigger className="w-[200px]"><SelectValue placeholder="ทุกกิจกรรม" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกกิจกรรม</SelectItem>
                    {Object.entries(actionLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Select value={filter.hospitalId} onValueChange={v => setFilter(p => ({ ...p, hospitalId: v }))}>
                <SelectTrigger className="w-[200px]"><SelectValue placeholder="ทุกโรงพยาบาล" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกโรงพยาบาล</SelectItem>
                  {hospitals?.map((h: any) => <SelectItem key={h.id} value={String(h.id)}>{h.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Audit Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">กำลังโหลด...</div>
            ) : logs && logs.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>เวลา</TableHead>
                    <TableHead>กิจกรรม</TableHead>
                    <TableHead>ทรัพยากร</TableHead>
                    <TableHead>ผู้ดำเนินการ</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>หมายเหตุ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log: any) => (
                    <TableRow key={log.id} className={log.isBreakGlass ? "bg-red-50" : ""}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "medium" })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {log.isBreakGlass && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
                          <span className="text-sm">{actionLabels[log.action] || log.action}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        <span className="text-muted-foreground">{log.resourceType}</span>
                        {log.resourceId && <span className="font-mono ml-1">#{log.resourceId.slice(0, 8)}</span>}
                      </TableCell>
                      <TableCell className="text-sm">{log.actorName || `User #${log.actorId}`}</TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">{log.ipAddress || "—"}</TableCell>
                      <TableCell>
                        {log.isBreakGlass && <Badge variant="destructive" className="text-[10px]">Break-glass</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center py-16">
                <ScrollText className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground">ไม่มีบันทึกที่ตรงกับเงื่อนไข</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
