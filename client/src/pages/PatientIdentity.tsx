import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Fingerprint, Link2, Plus, Search, Building2, UserCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function PatientIdentity() {
  const { user } = useAuth();
  const [showLink, setShowLink] = useState(false);
  const [formData, setFormData] = useState({
    identifierType: "" as string,
    identifierValue: "",
    hospitalId: "",
    issuerOrg: "",
  });

  // Query patient identity links
  const identities = trpc.patientIdentity.listIdentifiers.useQuery(
    { patientId: (user as any)?.id ?? 0 },
    { enabled: !!(user as any)?.id }
  );

  // Query MPI matches for admin
  const mpiMatches = trpc.patientIdentity.listMpiMatches.useQuery(
    { status: "pending" },
    { enabled: (user as any)?.systemRole === "system_admin" || (user as any)?.systemRole === "hospital_admin" }
  );

  // Query hospitals for dropdown
  const hospitals = trpc.hospital.list.useQuery();

  // Add identifier mutation
  const addIdentifier = trpc.patientIdentity.addIdentifier.useMutation({
    onSuccess: () => {
      toast.success("เพิ่มรหัสผู้ป่วยสำเร็จ");
      setShowLink(false);
      setFormData({ identifierType: "", identifierValue: "", hospitalId: "", issuerOrg: "" });
      identities.refetch();
    },
    onError: (err) => {
      toast.error("เกิดข้อผิดพลาด: " + err.message);
    },
  });

  // Resolve MPI match mutation
  const resolveMpi = trpc.patientIdentity.resolveMpiMatch.useMutation({
    onSuccess: () => {
      toast.success("ยืนยันการจับคู่สำเร็จ");
      mpiMatches.refetch();
    },
  });

  const handleSubmit = () => {
    if (!formData.identifierType || !formData.identifierValue) {
      toast.error("กรุณากรอกข้อมูลให้ครบ");
      return;
    }
    addIdentifier.mutate({
      patientId: (user as any)?.id ?? 0,
      identifierType: formData.identifierType as any,
      identifierValue: formData.identifierValue,
      hospitalId: formData.hospitalId ? Number(formData.hospitalId) : undefined,
      issuerOrg: formData.issuerOrg || undefined,
    });
  };

  const confirmedCount = identities.data?.filter((i: any) => i.verified).length ?? 0;
  const pendingCount = (identities.data?.length ?? 0) - confirmedCount;

  return (
    <DashboardLayout>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Fingerprint className="h-7 w-7 text-primary" />
            ระบบเชื่อมโยงตัวตนผู้ป่วย (MPI)
          </h1>
          <p className="text-muted-foreground mt-1">
            เชื่อมโยง HN/MRN ข้ามสาขา เพื่อให้ข้อมูลผู้ป่วยเป็นหนึ่งเดียวในเครือข่าย
          </p>
        </div>
        <Dialog open={showLink} onOpenChange={setShowLink}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              เพิ่มรหัสผู้ป่วย
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>เพิ่มรหัสผู้ป่วยข้ามสาขา</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>ประเภทรหัส</Label>
                <Select value={formData.identifierType} onValueChange={(v) => setFormData(p => ({ ...p, identifierType: v }))}>
                  <SelectTrigger><SelectValue placeholder="เลือกประเภทรหัส" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="thai_id">เลขบัตรประชาชน</SelectItem>
                    <SelectItem value="passport">หนังสือเดินทาง</SelectItem>
                    <SelectItem value="health_id">Health ID</SelectItem>
                    <SelectItem value="hn">HN (Hospital Number)</SelectItem>
                    <SelectItem value="mrn">MRN (Medical Record Number)</SelectItem>
                    <SelectItem value="carepass_id">CarePass ID</SelectItem>
                    <SelectItem value="insurance_id">เลขประกัน</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>รหัส/หมายเลข</Label>
                <Input
                  placeholder="เช่น HN-001234 หรือ 1-1234-56789-01-0"
                  value={formData.identifierValue}
                  onChange={(e) => setFormData(p => ({ ...p, identifierValue: e.target.value }))}
                />
              </div>
              <div>
                <Label>โรงพยาบาล (ถ้ามี)</Label>
                <Select value={formData.hospitalId} onValueChange={(v) => setFormData(p => ({ ...p, hospitalId: v }))}>
                  <SelectTrigger><SelectValue placeholder="เลือกโรงพยาบาล" /></SelectTrigger>
                  <SelectContent>
                    {hospitals.data?.map((h: any) => (
                      <SelectItem key={h.id} value={String(h.id)}>{h.name}</SelectItem>
                    ))}
                    {(!hospitals.data || hospitals.data.length === 0) && (
                      <SelectItem value="none" disabled>ยังไม่มีโรงพยาบาล</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>หน่วยงานที่ออก (ถ้ามี)</Label>
                <Input
                  placeholder="เช่น สปสช., กรมการปกครอง"
                  value={formData.issuerOrg}
                  onChange={(e) => setFormData(p => ({ ...p, issuerOrg: e.target.value }))}
                />
              </div>
              <Button className="w-full" onClick={handleSubmit} disabled={addIdentifier.isPending}>
                <Link2 className="h-4 w-4 mr-2" />
                {addIdentifier.isPending ? "กำลังบันทึก..." : "บันทึกรหัสผู้ป่วย"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Info Card */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <UserCheck className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-medium text-sm">Master Patient Index (MPI)</p>
              <p className="text-sm text-muted-foreground mt-1">
                ระบบ MPI ช่วยเชื่อมโยง HN/MRN ของผู้ป่วยคนเดียวกันที่มีหลายรหัสในหลายโรงพยาบาล
                ทำให้สามารถดึงข้อมูลข้ามสาขาได้ โดยใช้ Patient Identity VC เป็นหลักฐานยืนยัน
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{identities.data?.length ?? 0}</p>
            <p className="text-xs text-muted-foreground">รายการเชื่อมโยง</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{confirmedCount}</p>
            <p className="text-xs text-muted-foreground">ยืนยันแล้ว</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{pendingCount}</p>
            <p className="text-xs text-muted-foreground">รอการยืนยัน</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{mpiMatches.data?.length ?? 0}</p>
            <p className="text-xs text-muted-foreground">MPI Match รอตรวจสอบ</p>
          </CardContent>
        </Card>
      </div>

      {/* Identity Links Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">รหัสผู้ป่วยที่เชื่อมโยง</CardTitle>
        </CardHeader>
        <CardContent>
          {(!identities.data || identities.data.length === 0) ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Fingerprint className="h-12 w-12 mb-3 opacity-30" />
              <p>ยังไม่มีรายการเชื่อมโยงตัวตน</p>
              <p className="text-sm mt-1">เพิ่มรหัส HN/MRN จากโรงพยาบาลต่างๆ เพื่อเชื่อมโยงข้อมูล</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium">ประเภท</th>
                    <th className="pb-2 font-medium">รหัส/หมายเลข</th>
                    <th className="pb-2 font-medium">โรงพยาบาล</th>
                    <th className="pb-2 font-medium">หน่วยงานที่ออก</th>
                    <th className="pb-2 font-medium">สถานะ</th>
                    <th className="pb-2 font-medium">วันที่เพิ่ม</th>
                  </tr>
                </thead>
                <tbody>
                  {identities.data.map((item: any) => (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="py-2">
                        <Badge variant="outline" className="text-xs">
                          {item.identifierType === "thai_id" ? "บัตรประชาชน" :
                           item.identifierType === "hn" ? "HN" :
                           item.identifierType === "mrn" ? "MRN" :
                           item.identifierType === "passport" ? "Passport" :
                           item.identifierType === "health_id" ? "Health ID" :
                           item.identifierType === "carepass_id" ? "CarePass" :
                           item.identifierType === "insurance_id" ? "ประกัน" :
                           item.identifierType}
                        </Badge>
                      </td>
                      <td className="py-2 font-mono text-xs">{item.identifierValue}</td>
                      <td className="py-2">
                        {item.hospitalId ? (
                          <div className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            <span className="text-xs">ID: {item.hospitalId}</span>
                          </div>
                        ) : "-"}
                      </td>
                      <td className="py-2 text-xs">{item.issuerOrg || "-"}</td>
                      <td className="py-2">
                        <Badge variant={item.verified ? "default" : "secondary"}>
                          {item.verified ? "ยืนยันแล้ว" : "รอยืนยัน"}
                        </Badge>
                      </td>
                      <td className="py-2 text-xs text-muted-foreground">
                        {new Date(item.createdAt).toLocaleDateString("th-TH")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* MPI Matches (Admin only) */}
      {mpiMatches.data && mpiMatches.data.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">MPI Match รอตรวจสอบ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mpiMatches.data.map((match: any) => (
                <div key={match.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="text-sm font-medium">Patient #{match.patientIdA} ↔ Patient #{match.patientIdB}</p>
                    <p className="text-xs text-muted-foreground">
                      วิธี: {match.matchMethod} | ความมั่นใจ: {match.confidenceScore ? `${(match.confidenceScore * 100).toFixed(0)}%` : "-"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => resolveMpi.mutate({ id: match.id, matchStatus: "rejected" })}
                    >
                      ปฏิเสธ
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => resolveMpi.mutate({ id: match.id, matchStatus: "confirmed" })}
                    >
                      ยืนยัน
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
    </DashboardLayout>
  );
}
