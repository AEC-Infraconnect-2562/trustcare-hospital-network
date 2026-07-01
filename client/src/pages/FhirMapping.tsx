import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { GitBranch, Plus, ArrowRight, CheckCircle2, XCircle, Clock, Eye, RefreshCw } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { toast } from "sonner";

const validationColors: Record<string, string> = {
  valid: "text-emerald-600 bg-emerald-100",
  invalid: "text-red-600 bg-red-100",
  pending: "text-amber-600 bg-amber-100",
};

export default function FhirMapping() {
  const [selectedHospital, setSelectedHospital] = useState<string>("");
  const { data: hospitals } = trpc.hospital.list.useQuery();
  const { data: mappings, isLoading, refetch } = trpc.fhir.mappings.useQuery(
    { hospitalId: Number(selectedHospital) },
    { enabled: !!selectedHospital }
  );
  const [addOpen, setAddOpen] = useState(false);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">แผนที่ข้อมูล FHIR</h1>
            <p className="text-muted-foreground text-sm mt-1">จับคู่ข้อมูลท้องถิ่นกับมาตรฐาน HL7 FHIR R4</p>
          </div>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button disabled={!selectedHospital}><Plus className="h-4 w-4 mr-2" />เพิ่มการจับคู่</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>เพิ่มการจับคู่ FHIR ใหม่</DialogTitle></DialogHeader>
              <AddMappingForm hospitalId={Number(selectedHospital)} onSuccess={() => { setAddOpen(false); refetch(); }} />
            </DialogContent>
          </Dialog>
        </div>

        {/* Hospital Selector */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <Label className="shrink-0">เลือกโรงพยาบาล:</Label>
              <Select value={selectedHospital} onValueChange={setSelectedHospital}>
                <SelectTrigger className="max-w-xs"><SelectValue placeholder="เลือกโรงพยาบาล..." /></SelectTrigger>
                <SelectContent>
                  {hospitals?.map((h: any) => <SelectItem key={h.id} value={String(h.id)}>{h.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Sync Status */}
        {selectedHospital && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">สถานะการซิงค์: <span className="text-emerald-600">พร้อมใช้งาน</span></p>
                    <p className="text-xs text-muted-foreground">ซิงค์ล่าสุด: {new Date().toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5" />ซิงค์ตอนนี้
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Mapping Table & Preview */}
        {selectedHospital && (
          <Tabs defaultValue="mappings">
            <TabsList>
              <TabsTrigger value="mappings" className="gap-2"><GitBranch className="h-3.5 w-3.5" />การจับคู่</TabsTrigger>
              <TabsTrigger value="preview" className="gap-2"><Eye className="h-3.5 w-3.5" />ตัวอย่างข้อมูล</TabsTrigger>
            </TabsList>
            <TabsContent value="mappings">
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-8 text-center text-muted-foreground">กำลังโหลด...</div>
              ) : mappings && mappings.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ฟิลด์ท้องถิ่น</TableHead>
                      <TableHead className="text-center"><ArrowRight className="h-3 w-3 inline" /></TableHead>
                      <TableHead>FHIR Resource / Path</TableHead>
                      <TableHead>สถานะ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mappings.map((m: any) => (
                      <TableRow key={m.id}>
                        <TableCell>
                          <p className="font-medium text-sm">{m.localFieldName}</p>
                          {m.localFieldPath && <p className="text-xs text-muted-foreground font-mono">{m.localFieldPath}</p>}
                        </TableCell>
                        <TableCell className="text-center"><ArrowRight className="h-3 w-3 text-muted-foreground inline" /></TableCell>
                        <TableCell>
                          <p className="font-medium text-sm">{m.fhirResourceType}</p>
                          <p className="text-xs text-muted-foreground font-mono">{m.fhirFieldPath}</p>
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-[10px] border-0 ${validationColors[m.validationStatus]}`}>
                            {m.validationStatus === "valid" ? "ถูกต้อง" : m.validationStatus === "invalid" ? "ไม่ถูกต้อง" : "รอตรวจสอบ"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center py-16">
                  <GitBranch className="h-12 w-12 text-muted-foreground/30 mb-4" />
                  <p className="text-muted-foreground">ยังไม่มีการจับคู่สำหรับโรงพยาบาลนี้</p>
              </div>
            )}
          </CardContent>
        </Card>
            </TabsContent>
            <TabsContent value="preview">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">ตัวอย่างการแปลงข้อมูล FHIR</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted/50 rounded-lg p-4 font-mono text-xs overflow-auto max-h-[400px]">
                    <pre className="text-foreground">{JSON.stringify({
                      resourceType: "Patient",
                      id: "example-patient-001",
                      meta: { profile: ["http://hl7.org/fhir/StructureDefinition/Patient"] },
                      name: [{ use: "official", text: "สมชาย ใจดี", family: "ใจดี", given: ["สมชาย"] }],
                      gender: "male",
                      birthDate: "1985-03-15",
                      identifier: [{ system: "https://www.dopa.go.th/nid", value: "1-3100-12345-67-8" }],
                      address: [{ text: "123 ถ.สุขุมวิท กรุงเทพ 10110" }],
                    }, null, 2)}</pre>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">ตัวอย่างการแปลงข้อมูลจากระบบท้องถิ่นเป็น FHIR R4 Resource</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
      )}
      </div>
    </DashboardLayout>
  );
}

function AddMappingForm({ hospitalId, onSuccess }: { hospitalId: number; onSuccess: () => void }) {
  const [form, setForm] = useState({ localFieldName: "", localFieldPath: "", fhirResourceType: "Patient", fhirFieldPath: "", transformRule: "" });
  const createMutation = trpc.fhir.createMapping.useMutation({
    onSuccess: () => { toast.success("เพิ่มการจับคู่สำเร็จ"); onSuccess(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <form onSubmit={e => { e.preventDefault(); createMutation.mutate({ hospitalId, ...form }); }} className="space-y-4">
      <div className="space-y-2">
        <Label>ชื่อฟิลด์ท้องถิ่น</Label>
        <Input value={form.localFieldName} onChange={e => setForm(p => ({ ...p, localFieldName: e.target.value }))} placeholder="patient_name" />
      </div>
      <div className="space-y-2">
        <Label>Path ท้องถิ่น</Label>
        <Input value={form.localFieldPath} onChange={e => setForm(p => ({ ...p, localFieldPath: e.target.value }))} placeholder="patient.full_name" />
      </div>
      <div className="space-y-2">
        <Label>FHIR Resource Type</Label>
        <Select value={form.fhirResourceType} onValueChange={v => setForm(p => ({ ...p, fhirResourceType: v }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {["Patient", "Observation", "Condition", "MedicationRequest", "AllergyIntolerance", "Immunization", "Encounter"].map(r => (
              <SelectItem key={r} value={r}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>FHIR Field Path</Label>
        <Input value={form.fhirFieldPath} onChange={e => setForm(p => ({ ...p, fhirFieldPath: e.target.value }))} placeholder="Patient.name[0].text" />
      </div>
      <Button type="submit" className="w-full" disabled={createMutation.isPending}>
        {createMutation.isPending ? "กำลังบันทึก..." : "เพิ่มการจับคู่"}
      </Button>
    </form>
  );
}
