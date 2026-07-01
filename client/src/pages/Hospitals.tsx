import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Building2, Plus, MapPin, Phone, Mail, Globe } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Hospitals() {
  const { data: hospitals, isLoading, refetch } = trpc.hospital.list.useQuery();
  const [open, setOpen] = useState(false);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">จัดการเครือข่าย</h1>
            <p className="text-muted-foreground text-sm mt-1">โรงพยาบาลในเครือข่าย Trustcare</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />เพิ่มโรงพยาบาล</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>เพิ่มโรงพยาบาลใหม่</DialogTitle>
              </DialogHeader>
              <AddHospitalForm onSuccess={() => { setOpen(false); refetch(); }} />
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="animate-pulse"><CardContent className="p-6 h-40" /></Card>
            ))}
          </div>
        ) : hospitals && hospitals.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {hospitals.map((h: any) => (
              <Card key={h.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-medium text-sm">{h.name}</h3>
                        {h.nameEn && <p className="text-xs text-muted-foreground">{h.nameEn}</p>}
                      </div>
                    </div>
                    <Badge variant={h.status === "active" ? "default" : "secondary"} className="text-[10px]">
                      {h.status === "active" ? "ใช้งาน" : h.status === "pending" ? "รอดำเนินการ" : "ปิดใช้งาน"}
                    </Badge>
                  </div>
                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2"><MapPin className="h-3 w-3" />{h.province || "ไม่ระบุ"}</div>
                    {h.phone && <div className="flex items-center gap-2"><Phone className="h-3 w-3" />{h.phone}</div>}
                    {h.email && <div className="flex items-center gap-2"><Mail className="h-3 w-3" />{h.email}</div>}
                    {h.fhirEndpoint && <div className="flex items-center gap-2"><Globe className="h-3 w-3" />FHIR Endpoint</div>}
                  </div>
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-[10px] text-muted-foreground font-mono">{h.did || "DID: รอกำหนด"}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Building2 className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">ยังไม่มีโรงพยาบาลในเครือข่าย</p>
              <Button variant="outline" className="mt-4" onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />เพิ่มโรงพยาบาลแรก
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

function AddHospitalForm({ onSuccess }: { onSuccess: () => void }) {
  const [form, setForm] = useState({ name: "", nameEn: "", code: "", province: "", phone: "", email: "", fhirEndpoint: "" });
  const createMutation = trpc.hospital.create.useMutation({
    onSuccess: () => { toast.success("เพิ่มโรงพยาบาลสำเร็จ"); onSuccess(); },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.code) { toast.error("กรุณากรอกชื่อและรหัสโรงพยาบาล"); return; }
    createMutation.mutate(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>ชื่อโรงพยาบาล *</Label>
          <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="โรงพยาบาล..." />
        </div>
        <div className="space-y-2">
          <Label>ชื่อภาษาอังกฤษ</Label>
          <Input value={form.nameEn} onChange={e => setForm(p => ({ ...p, nameEn: e.target.value }))} placeholder="Hospital..." />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>รหัสโรงพยาบาล *</Label>
          <Input value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} placeholder="TC001" />
        </div>
        <div className="space-y-2">
          <Label>จังหวัด</Label>
          <Input value={form.province} onChange={e => setForm(p => ({ ...p, province: e.target.value }))} placeholder="กรุงเทพฯ" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>โทรศัพท์</Label>
          <Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="02-xxx-xxxx" />
        </div>
        <div className="space-y-2">
          <Label>อีเมล</Label>
          <Input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="info@hospital.th" />
        </div>
      </div>
      <div className="space-y-2">
        <Label>FHIR Endpoint</Label>
        <Input value={form.fhirEndpoint} onChange={e => setForm(p => ({ ...p, fhirEndpoint: e.target.value }))} placeholder="https://fhir.hospital.th/r4" />
      </div>
      <Button type="submit" className="w-full" disabled={createMutation.isPending}>
        {createMutation.isPending ? "กำลังบันทึก..." : "เพิ่มโรงพยาบาล"}
      </Button>
    </form>
  );
}
