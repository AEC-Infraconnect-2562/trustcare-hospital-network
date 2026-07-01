import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { ShieldCheck, ShieldAlert, Plus, Building2, Globe, Scale, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

// ─── Trust Level Config ───────────────────────────────────────────────
const trustLevelConfig: Record<string, { label: string; labelEn: string; color: string; icon: typeof ShieldCheck }> = {
  accredited: { label: "รับรองแล้ว", labelEn: "Accredited", color: "bg-emerald-100 text-emerald-800 border-emerald-200", icon: ShieldCheck },
  recognized: { label: "ยอมรับ", labelEn: "Recognized", color: "bg-blue-100 text-blue-800 border-blue-200", icon: CheckCircle2 },
  self_declared: { label: "ประกาศตนเอง", labelEn: "Self-declared", color: "bg-amber-100 text-amber-800 border-amber-200", icon: AlertTriangle },
  pending: { label: "รอตรวจสอบ", labelEn: "Pending", color: "bg-gray-100 text-gray-700 border-gray-200", icon: ShieldAlert },
  suspended: { label: "ระงับชั่วคราว", labelEn: "Suspended", color: "bg-orange-100 text-orange-800 border-orange-200", icon: AlertTriangle },
  revoked: { label: "เพิกถอน", labelEn: "Revoked", color: "bg-red-100 text-red-800 border-red-200", icon: XCircle },
};

const trustAnchorLabels: Record<string, string> = {
  etda: "ETDA Digital ID 2.0",
  gdhcn: "WHO GDHCN",
  moph: "กระทรวงสาธารณสุข",
  nhso: "สปสช. (NHSO)",
  self: "Self",
};

const orgTypeLabelsIssuer: Record<string, string> = {
  hospital: "โรงพยาบาล", clinic: "คลินิก", lab: "ห้องปฏิบัติการ",
  pharmacy: "ร้านยา", government: "หน่วยงานรัฐ", insurance: "ประกันภัย", international: "ต่างประเทศ",
};
const orgTypeLabelsVerifier: Record<string, string> = {
  hospital: "โรงพยาบาล", clinic: "คลินิก", insurance: "ประกันภัย",
  government: "หน่วยงานรัฐ", employer: "นายจ้าง", border_control: "ด่านตรวจคนเข้าเมือง", research: "วิจัย",
};
const enforcementLabels: Record<string, { label: string; color: string }> = {
  strict: { label: "บังคับ (Strict)", color: "bg-red-100 text-red-700" },
  advisory: { label: "แนะนำ (Advisory)", color: "bg-amber-100 text-amber-700" },
  off: { label: "ปิด (Off)", color: "bg-gray-100 text-gray-600" },
};

function TrustLevelBadge({ level }: { level: string }) {
  const cfg = trustLevelConfig[level] || trustLevelConfig.pending;
  const Icon = cfg.icon;
  return (
    <Badge variant="outline" className={`${cfg.color} gap-1`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </Badge>
  );
}

// ─── Issuers Tab ──────────────────────────────────────────────────────
function IssuersTab() {
  const { data: issuers, refetch } = trpc.tao.issuers.useQuery({});
  const createIssuer = trpc.tao.createIssuer.useMutation({ onSuccess: () => { refetch(); toast.success("เพิ่ม Issuer สำเร็จ"); setShowCreate(false); } });
  const updateIssuer = trpc.tao.updateIssuer.useMutation({ onSuccess: () => { refetch(); toast.success("อัปเดตสำเร็จ"); } });
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  const filtered = (issuers || []).filter((i: any) => filter === "all" || i.trustLevel === filter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>ทั้งหมด ({issuers?.length || 0})</Button>
          {["accredited", "recognized", "self_declared", "pending"].map(l => (
            <Button key={l} size="sm" variant={filter === l ? "default" : "outline"} onClick={() => setFilter(l)}>
              {trustLevelConfig[l].label} ({(issuers || []).filter((i: any) => i.trustLevel === l).length})
            </Button>
          ))}
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" />เพิ่ม Issuer</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>เพิ่ม Trusted Issuer</DialogTitle></DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              createIssuer.mutate({
                did: fd.get("did") as string,
                name: fd.get("name") as string,
                nameEn: fd.get("nameEn") as string || undefined,
                organizationType: fd.get("organizationType") as any,
                country: fd.get("country") as string || undefined,
                trustLevel: fd.get("trustLevel") as any || undefined,
                trustAnchor: fd.get("trustAnchor") as any || undefined,
                accreditationBody: fd.get("accreditationBody") as string || undefined,
                contactEmail: fd.get("contactEmail") as string || undefined,
              });
            }} className="space-y-3">
              <div><Label>DID</Label><Input name="did" placeholder="did:web:hospital.example.com" required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>ชื่อ (ไทย)</Label><Input name="name" required /></div>
                <div><Label>Name (EN)</Label><Input name="nameEn" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>ประเภทองค์กร</Label>
                  <Select name="organizationType" required>
                    <SelectTrigger><SelectValue placeholder="เลือก" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(orgTypeLabelsIssuer).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>ประเทศ (ISO 3)</Label><Input name="country" defaultValue="THA" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>ระดับความน่าเชื่อถือ</Label>
                  <Select name="trustLevel">
                    <SelectTrigger><SelectValue placeholder="pending" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(trustLevelConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Trust Anchor</Label>
                  <Select name="trustAnchor">
                    <SelectTrigger><SelectValue placeholder="self" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(trustAnchorLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>หน่วยงานรับรอง</Label><Input name="accreditationBody" /></div>
                <div><Label>อีเมลติดต่อ</Label><Input name="contactEmail" type="email" /></div>
              </div>
              <Button type="submit" className="w-full" disabled={createIssuer.isPending}>เพิ่ม Issuer</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">
            <ShieldAlert className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>ไม่มี Issuer ในหมวดนี้</p>
          </CardContent></Card>
        ) : filtered.map((issuer: any) => (
          <Card key={issuer.id} className="hover:shadow-sm transition-shadow">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100">
                    <Building2 className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-semibold">{issuer.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {issuer.nameEn && <span className="mr-2">{issuer.nameEn}</span>}
                      <Badge variant="outline" className="mr-2 text-xs">{orgTypeLabelsIssuer[issuer.organizationType] || issuer.organizationType}</Badge>
                      {issuer.country && <span className="mr-1">🌍 {issuer.country}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono mt-1">{issuer.did}</p>
                    {issuer.accreditationBody && (
                      <p className="text-xs text-muted-foreground mt-0.5">รับรองโดย: {issuer.accreditationBody}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{trustAnchorLabels[issuer.trustAnchor] || issuer.trustAnchor}</Badge>
                  <TrustLevelBadge level={issuer.trustLevel} />
                  {issuer.trustLevel === "pending" && (
                    <Button size="sm" variant="outline" onClick={() => updateIssuer.mutate({ id: issuer.id, trustLevel: "recognized" })}>
                      <CheckCircle2 className="h-3 w-3 mr-1" />รับรอง
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Verifiers Tab ────────────────────────────────────────────────────
function VerifiersTab() {
  const { data: verifiers, refetch } = trpc.tao.verifiers.useQuery({});
  const createVerifier = trpc.tao.createVerifier.useMutation({ onSuccess: () => { refetch(); toast.success("เพิ่ม Verifier สำเร็จ"); setShowCreate(false); } });
  const updateVerifier = trpc.tao.updateVerifier.useMutation({ onSuccess: () => { refetch(); toast.success("อัปเดตสำเร็จ"); } });
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Verifier ที่ได้รับอนุญาตให้ตรวจสอบ VC ในระบบ</p>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" />เพิ่ม Verifier</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>เพิ่ม Trusted Verifier</DialogTitle></DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              createVerifier.mutate({
                did: fd.get("did") as string,
                name: fd.get("name") as string,
                nameEn: fd.get("nameEn") as string || undefined,
                organizationType: fd.get("organizationType") as any,
                country: fd.get("country") as string || undefined,
                trustLevel: fd.get("trustLevel") as any || undefined,
                trustAnchor: fd.get("trustAnchor") as any || undefined,
                contactEmail: fd.get("contactEmail") as string || undefined,
              });
            }} className="space-y-3">
              <div><Label>DID</Label><Input name="did" placeholder="did:web:verifier.example.com" required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>ชื่อ (ไทย)</Label><Input name="name" required /></div>
                <div><Label>Name (EN)</Label><Input name="nameEn" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>ประเภทองค์กร</Label>
                  <Select name="organizationType" required>
                    <SelectTrigger><SelectValue placeholder="เลือก" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(orgTypeLabelsVerifier).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>ประเทศ (ISO 3)</Label><Input name="country" defaultValue="THA" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>ระดับความน่าเชื่อถือ</Label>
                  <Select name="trustLevel">
                    <SelectTrigger><SelectValue placeholder="pending" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(trustLevelConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Trust Anchor</Label>
                  <Select name="trustAnchor">
                    <SelectTrigger><SelectValue placeholder="self" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(trustAnchorLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>อีเมลติดต่อ</Label><Input name="contactEmail" type="email" /></div>
              <Button type="submit" className="w-full" disabled={createVerifier.isPending}>เพิ่ม Verifier</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {(!verifiers || verifiers.length === 0) ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">
            <Globe className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>ไม่มี Verifier ในระบบ</p>
          </CardContent></Card>
        ) : verifiers.map((v: any) => (
          <Card key={v.id} className="hover:shadow-sm transition-shadow">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100">
                    <Globe className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold">{v.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {v.nameEn && <span className="mr-2">{v.nameEn}</span>}
                      <Badge variant="outline" className="mr-2 text-xs">{orgTypeLabelsVerifier[v.organizationType] || v.organizationType}</Badge>
                    </p>
                    <p className="text-xs text-muted-foreground font-mono mt-1">{v.did}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{trustAnchorLabels[v.trustAnchor] || v.trustAnchor}</Badge>
                  <TrustLevelBadge level={v.trustLevel} />
                  {v.trustLevel === "pending" && (
                    <Button size="sm" variant="outline" onClick={() => updateVerifier.mutate({ id: v.id, trustLevel: "recognized" })}>
                      <CheckCircle2 className="h-3 w-3 mr-1" />รับรอง
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Policies Tab ─────────────────────────────────────────────────────
function PoliciesTab() {
  const { data: policies, refetch } = trpc.tao.policies.useQuery({});
  const createPolicy = trpc.tao.createPolicy.useMutation({ onSuccess: () => { refetch(); toast.success("เพิ่ม Policy สำเร็จ"); setShowCreate(false); } });
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">นโยบายความน่าเชื่อถือสำหรับแต่ละประเภท Credential</p>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" />เพิ่ม Policy</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>เพิ่ม Trust Policy</DialogTitle></DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              createPolicy.mutate({
                credentialType: fd.get("credentialType") as string,
                requiredTrustLevel: fd.get("requiredTrustLevel") as any || undefined,
                requiredTrustAnchor: fd.get("requiredTrustAnchor") as any || undefined,
                enforcementMode: fd.get("enforcementMode") as any || undefined,
                description: fd.get("description") as string || undefined,
                descriptionEn: fd.get("descriptionEn") as string || undefined,
              });
            }} className="space-y-3">
              <div><Label>Credential Type</Label><Input name="credentialType" placeholder="e.g. allergy_alert" required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>ระดับที่ต้องการ</Label>
                  <Select name="requiredTrustLevel">
                    <SelectTrigger><SelectValue placeholder="recognized" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="accredited">Accredited</SelectItem>
                      <SelectItem value="recognized">Recognized</SelectItem>
                      <SelectItem value="self_declared">Self-declared</SelectItem>
                      <SelectItem value="any">Any</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Trust Anchor ที่ต้องการ</Label>
                  <Select name="requiredTrustAnchor">
                    <SelectTrigger><SelectValue placeholder="any" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(trustAnchorLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      <SelectItem value="any">ใดก็ได้ (Any)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>โหมดบังคับใช้</Label>
                <Select name="enforcementMode">
                  <SelectTrigger><SelectValue placeholder="advisory" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="strict">บังคับ (Strict)</SelectItem>
                    <SelectItem value="advisory">แนะนำ (Advisory)</SelectItem>
                    <SelectItem value="off">ปิด (Off)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>คำอธิบาย (ไทย)</Label><Input name="description" /></div>
              <div><Label>Description (EN)</Label><Input name="descriptionEn" /></div>
              <Button type="submit" className="w-full" disabled={createPolicy.isPending}>เพิ่ม Policy</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {(!policies || policies.length === 0) ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">
            <Scale className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>ไม่มี Trust Policy</p>
          </CardContent></Card>
        ) : policies.map((p: any) => (
          <Card key={p.id} className="hover:shadow-sm transition-shadow">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-50 to-violet-50 border border-purple-100">
                    <Scale className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-semibold font-mono text-sm">{p.credentialType}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{p.description || p.descriptionEn || "—"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    ≥ {trustLevelConfig[p.requiredTrustLevel]?.label || p.requiredTrustLevel}
                  </Badge>
                  {p.requiredTrustAnchor !== "any" && (
                    <Badge variant="outline" className="text-xs">{trustAnchorLabels[p.requiredTrustAnchor] || p.requiredTrustAnchor}</Badge>
                  )}
                  <Badge className={enforcementLabels[p.enforcementMode]?.color || "bg-gray-100"}>
                    {enforcementLabels[p.enforcementMode]?.label || p.enforcementMode}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────
export default function TrustRegistry() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">TAO Trust Registry</h1>
          <p className="text-muted-foreground mt-1">
            ทะเบียนความน่าเชื่อถือ ตามมาตรฐาน ETSI Trusted List / WHO GDHCN
          </p>
        </div>

        <Tabs defaultValue="issuers" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="issuers" className="gap-1.5">
              <Building2 className="h-4 w-4" />Issuers
            </TabsTrigger>
            <TabsTrigger value="verifiers" className="gap-1.5">
              <Globe className="h-4 w-4" />Verifiers
            </TabsTrigger>
            <TabsTrigger value="policies" className="gap-1.5">
              <Scale className="h-4 w-4" />Policies
            </TabsTrigger>
          </TabsList>

          <TabsContent value="issuers" className="mt-4">
            <IssuersTab />
          </TabsContent>
          <TabsContent value="verifiers" className="mt-4">
            <VerifiersTab />
          </TabsContent>
          <TabsContent value="policies" className="mt-4">
            <PoliciesTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
