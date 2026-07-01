import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { ShieldAlert, Plus, CheckCircle2, Globe, Building2 } from "lucide-react";
import { toast } from "sonner";

const entityTypeLabels: Record<string, string> = {
  issuer: "ผู้ออกใบรับรอง (Issuer)",
  verifier: "ผู้ตรวจสอบ (Verifier)",
  provider: "ผู้ให้บริการ (Provider)",
  payer: "ผู้จ่าย (Payer)",
  partner_hospital: "โรงพยาบาลพันธมิตร",
  foreign_hospital: "โรงพยาบาลต่างประเทศ",
};

const trustLevelColors: Record<string, string> = {
  verified: "bg-green-100 text-green-700",
  self_declared: "bg-yellow-100 text-yellow-700",
  pending: "bg-blue-100 text-blue-700",
  revoked: "bg-red-100 text-red-700",
};

const trustLevelLabels: Record<string, string> = {
  verified: "ยืนยันแล้ว",
  self_declared: "ประกาศตนเอง",
  pending: "รอตรวจสอบ",
  revoked: "ถูกเพิกถอน",
};

export default function TrustRegistry() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined);

  const { data: entries, refetch } = trpc.trustRegistry.list.useQuery({
    entityType: typeFilter,
  });
  const createEntry = trpc.trustRegistry.create.useMutation({
    onSuccess: () => { refetch(); setShowCreateDialog(false); toast.success("เพิ่มรายการใน Trust Registry สำเร็จ"); }
  });
  const verifyEntry = trpc.trustRegistry.verify.useMutation({
    onSuccess: () => { refetch(); toast.success("ยืนยันความน่าเชื่อถือสำเร็จ"); }
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <ShieldAlert className="h-7 w-7 text-primary" />
              ทะเบียนความน่าเชื่อถือ
            </h1>
            <p className="text-muted-foreground mt-1">จัดการรายชื่อองค์กรที่เชื่อถือได้ในเครือข่าย (Issuer, Verifier, Partner Hospital, Payer)</p>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />เพิ่มรายการ</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>เพิ่มรายการใน Trust Registry</DialogTitle></DialogHeader>
              <form onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                createEntry.mutate({
                  entityType: fd.get("entityType") as any,
                  entityName: fd.get("entityName") as string,
                  entityNameEn: fd.get("entityNameEn") as string || undefined,
                  did: fd.get("did") as string || undefined,
                  country: fd.get("country") as string || undefined,
                  jurisdiction: fd.get("jurisdiction") as string || undefined,
                  contactEmail: fd.get("contactEmail") as string || undefined,
                  contactUrl: fd.get("contactUrl") as string || undefined,
                });
              }} className="space-y-4">
                <div>
                  <Label>ประเภทองค์กร</Label>
                  <Select name="entityType" required>
                    <SelectTrigger><SelectValue placeholder="เลือกประเภท" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(entityTypeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>ชื่อองค์กร (ไทย)</Label><Input name="entityName" required /></div>
                <div><Label>ชื่อองค์กร (English)</Label><Input name="entityNameEn" /></div>
                <div><Label>DID</Label><Input name="did" placeholder="did:web:example.com" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>ประเทศ (ISO 3)</Label><Input name="country" placeholder="THA" /></div>
                  <div><Label>Jurisdiction</Label><Input name="jurisdiction" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>อีเมลติดต่อ</Label><Input name="contactEmail" type="email" /></div>
                  <div><Label>URL</Label><Input name="contactUrl" /></div>
                </div>
                <Button type="submit" className="w-full" disabled={createEntry.isPending}>เพิ่มรายการ</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filter */}
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant={!typeFilter ? "default" : "outline"} onClick={() => setTypeFilter(undefined)}>ทั้งหมด</Button>
          {Object.entries(entityTypeLabels).map(([k, v]) => (
            <Button key={k} size="sm" variant={typeFilter === k ? "default" : "outline"} onClick={() => setTypeFilter(k)}>
              {v}
            </Button>
          ))}
        </div>

        {/* List */}
        <div className="space-y-3">
          {(!entries || entries.length === 0) ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <ShieldAlert className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>ยังไม่มีรายการใน Trust Registry</p>
              </CardContent>
            </Card>
          ) : (
            entries.map((entry: any) => (
              <Card key={entry.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-lg bg-primary/10">
                        {entry.entityType === "foreign_hospital" || entry.entityType === "partner_hospital" ?
                          <Building2 className="h-5 w-5 text-primary" /> :
                          <Globe className="h-5 w-5 text-primary" />}
                      </div>
                      <div>
                        <p className="font-medium">{entry.entityName}</p>
                        <p className="text-sm text-muted-foreground">
                          {entry.entityNameEn && <span className="mr-2">{entry.entityNameEn}</span>}
                          <Badge variant="outline" className="mr-2">{entityTypeLabels[entry.entityType] || entry.entityType}</Badge>
                          {entry.country && <span className="mr-2">🌍 {entry.country}</span>}
                        </p>
                        {entry.did && <p className="text-xs text-muted-foreground font-mono mt-1">{entry.did}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={trustLevelColors[entry.trustLevel] || "bg-gray-100"}>
                        {trustLevelLabels[entry.trustLevel] || entry.trustLevel}
                      </Badge>
                      {entry.trustLevel !== "verified" && entry.trustLevel !== "revoked" && (
                        <Button size="sm" variant="outline" onClick={() => verifyEntry.mutate({ id: entry.id })}>
                          <CheckCircle2 className="h-3 w-3 mr-1" />ยืนยัน
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
