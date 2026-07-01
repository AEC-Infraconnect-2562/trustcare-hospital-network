import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { ClipboardCheck, CheckCircle2, XCircle, AlertTriangle, Clock, Eye } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const typeLabels: Record<string, string> = {
  patient_identity: "บัตรประจำตัวผู้ป่วย",
  consent_receipt: "ใบรับรองความยินยอม",
  patient_summary: "สรุปข้อมูลผู้ป่วย",
  allergy_alert: "แจ้งเตือนการแพ้",
  medication_summary: "สรุปยาที่ใช้",
  referral_vc: "ใบส่งต่อ",
  immunization: "ประวัติวัคซีน",
  medical_certificate: "ใบรับรองแพทย์",
  prescription: "ใบสั่งยา",
  claim_package: "แพ็คเกจเคลม",
  sync_receipt: "ใบรับรอง Sync",
};

export default function CheckerQueue() {
  const { data: pendingReviews, isLoading: pendingLoading, refetch: refetchPending } = trpc.makerChecker.pendingReviews.useQuery();
  const { data: myReviews, isLoading: reviewsLoading, refetch: refetchReviews } = trpc.makerChecker.myReviews.useQuery();
  const { data: pendingCount } = trpc.makerChecker.pendingCount.useQuery();
  const { data: templates } = trpc.credential.templates.useQuery({});

  const [reviewDialog, setReviewDialog] = useState<{ open: boolean; request: any | null; action: "approve" | "reject" | null }>({
    open: false, request: null, action: null,
  });
  const [comment, setComment] = useState("");
  const [detailDialog, setDetailDialog] = useState<{ open: boolean; request: any | null }>({ open: false, request: null });

  const approveMutation = trpc.makerChecker.approve.useMutation({
    onSuccess: () => {
      toast.success("อนุมัติคำขอสำเร็จ — VC ถูกออกให้ผู้ป่วยแล้ว");
      setReviewDialog({ open: false, request: null, action: null });
      setComment("");
      refetchPending();
      refetchReviews();
    },
    onError: (e) => toast.error(e.message),
  });

  const rejectMutation = trpc.makerChecker.reject.useMutation({
    onSuccess: () => {
      toast.success("ปฏิเสธคำขอสำเร็จ");
      setReviewDialog({ open: false, request: null, action: null });
      setComment("");
      refetchPending();
      refetchReviews();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleAction = () => {
    if (!reviewDialog.request) return;
    if (reviewDialog.action === "approve") {
      approveMutation.mutate({ id: reviewDialog.request.id, comment: comment || undefined });
    } else if (reviewDialog.action === "reject") {
      if (!comment.trim()) { toast.error("กรุณาระบุเหตุผลในการปฏิเสธ"); return; }
      rejectMutation.mutate({ id: reviewDialog.request.id, comment });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">ตรวจสอบคำขอ VC (Checker)</h1>
            <p className="text-muted-foreground text-sm mt-1">ตรวจสอบและอนุมัติ/ปฏิเสธคำขอออกใบรับรองดิจิทัล</p>
          </div>
          {typeof pendingCount === "number" && pendingCount > 0 && (
            <Badge variant="destructive" className="text-sm px-3 py-1">
              <AlertTriangle className="h-4 w-4 mr-1" />
              {pendingCount} คำขอรอตรวจสอบ
            </Badge>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingReviews?.length || 0}</p>
                <p className="text-xs text-muted-foreground">รอตรวจสอบ</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{myReviews?.filter((r: any) => r.status === "approved" || r.status === "issued").length || 0}</p>
                <p className="text-xs text-muted-foreground">อนุมัติแล้ว</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                <XCircle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{myReviews?.filter((r: any) => r.status === "rejected").length || 0}</p>
                <p className="text-xs text-muted-foreground">ปฏิเสธแล้ว</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending">
              รอตรวจสอบ
              {(pendingReviews?.length || 0) > 0 && (
                <Badge variant="destructive" className="ml-2 text-[10px] h-5 min-w-5 px-1">{pendingReviews?.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="history">ประวัติการตรวจสอบ</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-4">
            {pendingLoading ? (
              <div className="text-center py-8 text-muted-foreground">กำลังโหลด...</div>
            ) : !pendingReviews?.length ? (
              <div className="text-center py-12 text-muted-foreground">
                <ClipboardCheck className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>ไม่มีคำขอรอตรวจสอบ</p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>เลขคำขอ</TableHead>
                      <TableHead>ประเภท</TableHead>
                      <TableHead>ผู้ป่วย ID</TableHead>
                      <TableHead>Maker ID</TableHead>
                      <TableHead>ลำดับความสำคัญ</TableHead>
                      <TableHead>วันที่ส่ง</TableHead>
                      <TableHead>การดำเนินการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingReviews.map((req: any) => {
                      const template = templates?.find((t: any) => t.id === req.templateId);
                      return (
                        <TableRow key={req.id}>
                          <TableCell className="font-mono text-sm">{req.requestNumber}</TableCell>
                          <TableCell>{template?.name || (template?.type ? typeLabels[template.type] : null) || `Template #${req.templateId}`}</TableCell>
                          <TableCell>{req.patientId}</TableCell>
                          <TableCell>{req.makerId}</TableCell>
                          <TableCell>
                            {req.priority === "urgent" ? (
                              <Badge variant="destructive">เร่งด่วน</Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">ปกติ</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {req.submittedAt ? new Date(req.submittedAt).toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "numeric" }) : "-"}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => setDetailDialog({ open: true, request: req })}>
                                <Eye className="h-3 w-3 mr-1" />ดู
                              </Button>
                              <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => { setReviewDialog({ open: true, request: req, action: "approve" }); setComment(""); }}>
                                <CheckCircle2 className="h-3 w-3 mr-1" />อนุมัติ
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => { setReviewDialog({ open: true, request: req, action: "reject" }); setComment(""); }}>
                                <XCircle className="h-3 w-3 mr-1" />ปฏิเสธ
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            {reviewsLoading ? (
              <div className="text-center py-8 text-muted-foreground">กำลังโหลด...</div>
            ) : !myReviews?.length ? (
              <div className="text-center py-8 text-muted-foreground">ยังไม่มีประวัติการตรวจสอบ</div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>เลขคำขอ</TableHead>
                      <TableHead>ประเภท</TableHead>
                      <TableHead>สถานะ</TableHead>
                      <TableHead>ความเห็น</TableHead>
                      <TableHead>วันที่ตรวจ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {myReviews.map((req: any) => {
                      const template = templates?.find((t: any) => t.id === req.templateId);
                      return (
                        <TableRow key={req.id}>
                          <TableCell className="font-mono text-sm">{req.requestNumber}</TableCell>
                          <TableCell>{template?.name || `Template #${req.templateId}`}</TableCell>
                          <TableCell>
                            <Badge variant={req.status === "rejected" ? "destructive" : "default"}>
                              {req.status === "approved" || req.status === "issued" ? "อนุมัติ" : "ปฏิเสธ"}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">{req.checkerComment || "-"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {req.reviewedAt ? new Date(req.reviewedAt).toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "numeric" }) : "-"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Review Action Dialog */}
        <Dialog open={reviewDialog.open} onOpenChange={(open) => { if (!open) setReviewDialog({ open: false, request: null, action: null }); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {reviewDialog.action === "approve" ? "อนุมัติคำขอ" : "ปฏิเสธคำขอ"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {reviewDialog.request && (
                <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
                  <p><strong>เลขคำขอ:</strong> {reviewDialog.request.requestNumber}</p>
                  <p><strong>ผู้ป่วย ID:</strong> {reviewDialog.request.patientId}</p>
                  {reviewDialog.request.makerNotes && (
                    <p><strong>หมายเหตุจาก Maker:</strong> {reviewDialog.request.makerNotes}</p>
                  )}
                </div>
              )}
              <div className="space-y-2">
                <Label>
                  {reviewDialog.action === "approve" ? "ความเห็น (ไม่บังคับ)" : "เหตุผลในการปฏิเสธ *"}
                </Label>
                <Textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder={reviewDialog.action === "approve" ? "ระบุความเห็นเพิ่มเติม..." : "กรุณาระบุเหตุผล..."}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReviewDialog({ open: false, request: null, action: null })}>ยกเลิก</Button>
              {reviewDialog.action === "approve" ? (
                <Button className="bg-green-600 hover:bg-green-700" onClick={handleAction} disabled={approveMutation.isPending}>
                  {approveMutation.isPending ? "กำลังอนุมัติ..." : "ยืนยันอนุมัติ"}
                </Button>
              ) : (
                <Button variant="destructive" onClick={handleAction} disabled={!comment.trim() || rejectMutation.isPending}>
                  {rejectMutation.isPending ? "กำลังปฏิเสธ..." : "ยืนยันปฏิเสธ"}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Detail Dialog */}
        <Dialog open={detailDialog.open} onOpenChange={(open) => { if (!open) setDetailDialog({ open: false, request: null }); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>รายละเอียดคำขอ</DialogTitle>
            </DialogHeader>
            {detailDialog.request && (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div><span className="text-muted-foreground">เลขคำขอ:</span><br /><strong className="font-mono">{detailDialog.request.requestNumber}</strong></div>
                  <div><span className="text-muted-foreground">สถานะ:</span><br /><Badge>{detailDialog.request.status}</Badge></div>
                  <div><span className="text-muted-foreground">ผู้ป่วย ID:</span><br /><strong>{detailDialog.request.patientId}</strong></div>
                  <div><span className="text-muted-foreground">Maker ID:</span><br /><strong>{detailDialog.request.makerId}</strong></div>
                  <div><span className="text-muted-foreground">ลำดับความสำคัญ:</span><br />
                    {detailDialog.request.priority === "urgent" ? <Badge variant="destructive">เร่งด่วน</Badge> : <span>ปกติ</span>}
                  </div>
                  <div><span className="text-muted-foreground">วันที่ส่ง:</span><br />
                    {detailDialog.request.submittedAt ? new Date(detailDialog.request.submittedAt).toLocaleString("th-TH") : "-"}
                  </div>
                </div>
                {detailDialog.request.makerNotes && (
                  <div className="border-t pt-3">
                    <span className="text-muted-foreground">หมายเหตุจาก Maker:</span>
                    <p className="mt-1 bg-muted/50 rounded p-2">{detailDialog.request.makerNotes}</p>
                  </div>
                )}
                {detailDialog.request.credentialData && (
                  <div className="border-t pt-3">
                    <span className="text-muted-foreground">Credential Data:</span>
                    <pre className="mt-1 bg-muted/50 rounded p-2 text-xs overflow-auto max-h-40">
                      {JSON.stringify(detailDialog.request.credentialData, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
