import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { BookOpen, Plus, Sparkles, Check, X, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const codeSystemLabels: Record<string, string> = {
  "icd10": "ICD-10 (โรค)",
  "snomed_ct": "SNOMED CT",
  "loinc": "LOINC (ห้องปฏิบัติการ)",
  "tmt": "TMT (ยา)",
  "cvx": "CVX (วัคซีน)",
};

export default function Terminology() {
  const { data: mappings, isLoading, refetch } = trpc.terminology.list.useQuery({});
  const [addOpen, setAddOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [localCode, setLocalCode] = useState("");
  const [localDisplay, setLocalDisplay] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [suggesting, setSuggesting] = useState(false);

  const [codeSystem, setCodeSystem] = useState<string>("icd10");
  const suggestMutation = trpc.terminology.suggestMapping.useMutation({
    onSuccess: (data: any) => { setSuggestions([data]); setSuggesting(false); },
    onError: (e: any) => { toast.error(e.message); setSuggesting(false); },
  });

  const acceptMutation = trpc.terminology.create.useMutation({
    onSuccess: () => { toast.success("ยอมรับการจับคู่สำเร็จ"); refetch(); setSuggestOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const handleSuggest = () => {
    if (!localCode || !localDisplay) { toast.error("กรุณากรอกรหัสและชื่อท้องถิ่น"); return; }
    setSuggesting(true);
    suggestMutation.mutate({ localCode, localDisplay, codeSystem: codeSystem as any });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">ศัพท์มาตรฐาน</h1>
            <p className="text-muted-foreground text-sm mt-1">จับคู่รหัสท้องถิ่นกับ ICD-10, SNOMED CT, LOINC, TMT</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setSuggestOpen(true)}>
              <Sparkles className="h-4 w-4 mr-2" />AI แนะนำ
            </Button>
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" />เพิ่มการจับคู่</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>เพิ่มการจับคู่ศัพท์ใหม่</DialogTitle></DialogHeader>
                <AddTermForm onSuccess={() => { setAddOpen(false); refetch(); }} />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">ทั้งหมด</TabsTrigger>
            <TabsTrigger value="pending">รอจับคู่</TabsTrigger>
            <TabsTrigger value="approved">อนุมัติแล้ว</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4">
            <MappingTable mappings={mappings} isLoading={isLoading} />
          </TabsContent>
          <TabsContent value="pending" className="mt-4">
            <MappingTable mappings={mappings?.filter((m: any) => m.status === "pending")} isLoading={isLoading} />
          </TabsContent>
          <TabsContent value="approved" className="mt-4">
            <MappingTable mappings={mappings?.filter((m: any) => m.status === "approved")} isLoading={isLoading} />
          </TabsContent>
        </Tabs>

        {/* AI Suggest Dialog */}
        <Dialog open={suggestOpen} onOpenChange={setSuggestOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />AI แนะนำรหัสมาตรฐาน
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>รหัสท้องถิ่น</Label>
                  <Input value={localCode} onChange={e => setLocalCode(e.target.value)} placeholder="LOCAL001" />
                </div>
                <div className="space-y-2">
                  <Label>ชื่อ/คำอธิบาย</Label>
                  <Input value={localDisplay} onChange={e => setLocalDisplay(e.target.value)} placeholder="เบาหวาน" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>ระบบมาตรฐานเป้าหมาย</Label>
                <Select value={codeSystem} onValueChange={setCodeSystem}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(codeSystemLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleSuggest} disabled={suggesting} className="w-full">
                {suggesting ? "กำลังวิเคราะห์..." : "ขอคำแนะนำจาก AI"}
              </Button>

              {suggestions.length > 0 && (
                <div className="space-y-2 mt-4">
                  <p className="text-sm font-medium">ผลการแนะนำ:</p>
                  {suggestions.map((s: any, i: number) => (
                    <Card key={i} className="hover:shadow-sm transition-shadow">
                      <CardContent className="p-3 flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px]">{s.codeSystem}</Badge>
                            <span className="font-mono text-sm font-medium">{s.standardCode}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{s.standardDisplay}</p>
                          <div className="flex items-center gap-1 mt-1">
                            <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full" style={{ width: `${(s.confidence || 0.8) * 100}%` }} />
                            </div>
                            <span className="text-[10px] text-muted-foreground">{Math.round((s.confidence || 0.8) * 100)}%</span>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-emerald-600" onClick={() => acceptMutation.mutate({
                            hospitalId: 4 /* TCC - should use active hospital */, localCode, localDisplay, standardCode: s.standardCode, standardDisplay: s.standardDisplay,
                            codeSystem: codeSystem as any,
                          })}>
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-600">
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

function MappingTable({ mappings, isLoading }: { mappings?: any[]; isLoading: boolean }) {
  if (isLoading) return <div className="text-center py-8 text-muted-foreground">กำลังโหลด...</div>;
  if (!mappings || mappings.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-16">
          <BookOpen className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">ไม่มีข้อมูลการจับคู่</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>รหัสท้องถิ่น</TableHead>
              <TableHead>ชื่อท้องถิ่น</TableHead>
              <TableHead>ระบบมาตรฐาน</TableHead>
              <TableHead>รหัสมาตรฐาน</TableHead>
              <TableHead>ความเชื่อมั่น</TableHead>
              <TableHead>สถานะ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mappings.map((m: any) => (
              <TableRow key={m.id}>
                <TableCell className="font-mono text-xs">{m.localCode}</TableCell>
                <TableCell className="text-sm">{m.localDisplay}</TableCell>
                <TableCell><Badge variant="outline" className="text-[10px]">{m.codeSystem}</Badge></TableCell>
                <TableCell className="font-mono text-xs">{m.standardCode}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <div className="h-1.5 w-12 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${(m.confidence || 0) * 100}%` }} />
                    </div>
                    <span className="text-[10px]">{Math.round((m.confidence || 0) * 100)}%</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={m.status === "approved" ? "default" : m.status === "rejected" ? "destructive" : "secondary"} className="text-[10px]">
                    {m.status === "approved" ? "อนุมัติ" : m.status === "rejected" ? "ปฏิเสธ" : "รอตรวจสอบ"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function AddTermForm({ onSuccess }: { onSuccess: () => void }) {
  const [form, setForm] = useState({ localCode: "", localDisplay: "", codeSystem: "icd10", standardCode: "", standardDisplay: "" });
  const createMutation = trpc.terminology.create.useMutation({
    onSuccess: () => { toast.success("เพิ่มการจับคู่สำเร็จ"); onSuccess(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <form onSubmit={e => { e.preventDefault(); createMutation.mutate({ ...form, hospitalId: 4 /* TCC - should use active hospital */, codeSystem: form.codeSystem as any }); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>รหัสท้องถิ่น</Label>
          <Input value={form.localCode} onChange={e => setForm(p => ({ ...p, localCode: e.target.value }))} placeholder="LOCAL001" />
        </div>
        <div className="space-y-2">
          <Label>ชื่อท้องถิ่น</Label>
          <Input value={form.localDisplay} onChange={e => setForm(p => ({ ...p, localDisplay: e.target.value }))} placeholder="เบาหวาน" />
        </div>
      </div>
      <div className="space-y-2">
        <Label>ระบบมาตรฐาน</Label>
        <Select value={form.codeSystem} onValueChange={v => setForm(p => ({ ...p, codeSystem: v }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(codeSystemLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>รหัสมาตรฐาน</Label>
          <Input value={form.standardCode} onChange={e => setForm(p => ({ ...p, standardCode: e.target.value }))} placeholder="E11" />
        </div>
        <div className="space-y-2">
          <Label>ชื่อมาตรฐาน</Label>
          <Input value={form.standardDisplay} onChange={e => setForm(p => ({ ...p, standardDisplay: e.target.value }))} placeholder="Type 2 DM" />
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={createMutation.isPending}>
        {createMutation.isPending ? "กำลังบันทึก..." : "เพิ่มการจับคู่"}
      </Button>
    </form>
  );
}
