import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, FileText, Clock, Shield, CreditCard, Activity, AlertCircle } from "lucide-react";

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  validating: "bg-blue-100 text-blue-700",
  correction_required: "bg-orange-100 text-orange-700",
  ready_to_submit: "bg-cyan-100 text-cyan-700",
  submitted: "bg-indigo-100 text-indigo-700",
  accepted: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  more_info_requested: "bg-amber-100 text-amber-700",
  appeal: "bg-purple-100 text-purple-700",
  paid: "bg-emerald-100 text-emerald-700",
  closed: "bg-slate-100 text-slate-700",
};

function money(amount: string | number | null | undefined, currency = "THB") {
  const num = Number(amount ?? 0);
  return new Intl.NumberFormat("th-TH", { style: "currency", currency }).format(num);
}

function formatDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
}

export default function ClaimDetail() {
  const [, params] = useRoute("/claim-center/:id");
  const [, navigate] = useLocation();
  const id = Number(params?.id);

  const { data, isLoading, error } = trpc.claim.getClaimDetail.useQuery(
    { id },
    { enabled: !!id && !isNaN(id) }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">กำลังโหลดข้อมูล Claim...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">ไม่พบข้อมูล Claim #{id}</p>
        <Button variant="outline" onClick={() => navigate("/claim-center")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> กลับหน้า Claim Center
        </Button>
      </div>
    );
  }

  const timeline = buildTimeline(data);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/claim-center")}>
          <ArrowLeft className="mr-1 h-4 w-4" /> กลับ
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-bold">Claim #{data.id}</h1>
            <Badge className={statusColors[data.status] ?? "bg-gray-100 text-gray-700"}>
              {data.status.replace(/_/g, " ")}
            </Badge>
            <Badge variant="outline">{data.claimType?.toUpperCase()}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {data.patientName ?? `Patient #${data.patientId}`} • {data.hospitalName ?? `Hospital #${data.hospitalId}`} • {data.payerName ?? "Unknown Payer"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold">{money(data.totalAmount)}</p>
          {data.approvedAmount && Number(data.approvedAmount) > 0 && (
            <p className="text-sm text-green-600">อนุมัติ: {money(data.approvedAmount)}</p>
          )}
        </div>
      </div>

      <Separator />

      {/* Tabs */}
      <Tabs defaultValue="timeline" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5">
          <TabsTrigger value="timeline" className="gap-1"><Clock className="h-3.5 w-3.5" /> Timeline</TabsTrigger>
          <TabsTrigger value="documents" className="gap-1"><FileText className="h-3.5 w-3.5" /> เอกสาร</TabsTrigger>
          <TabsTrigger value="fhir" className="gap-1"><Activity className="h-3.5 w-3.5" /> FHIR</TabsTrigger>
          <TabsTrigger value="payer" className="gap-1"><Shield className="h-3.5 w-3.5" /> Payer</TabsTrigger>
          <TabsTrigger value="payment" className="gap-1"><CreditCard className="h-3.5 w-3.5" /> Payment</TabsTrigger>
        </TabsList>

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Claim Timeline</CardTitle></CardHeader>
            <CardContent>
              <div className="relative pl-6 space-y-6">
                {timeline.map((event, idx) => (
                  <div key={idx} className="relative">
                    <div className={`absolute -left-6 top-1 h-3 w-3 rounded-full border-2 ${
                      idx === 0 ? "bg-primary border-primary" : "bg-background border-muted-foreground/40"
                    }`} />
                    {idx < timeline.length - 1 && (
                      <div className="absolute -left-[18px] top-4 h-full w-px bg-border" />
                    )}
                    <div>
                      <p className="font-medium text-sm">{event.label}</p>
                      <p className="text-xs text-muted-foreground">{event.time}</p>
                      {event.detail && <p className="text-xs text-muted-foreground mt-0.5">{event.detail}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">เอกสารประกอบ ({data.documents?.length ?? 0})</CardTitle></CardHeader>
            <CardContent>
              {(!data.documents || data.documents.length === 0) ? (
                <p className="text-sm text-muted-foreground">ยังไม่มีเอกสารประกอบ</p>
              ) : (
                <div className="space-y-3">
                  {data.documents.map((doc: any) => (
                    <div key={doc.id} className="flex items-start justify-between gap-3 rounded-md border p-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm">{doc.documentType?.replace(/_/g, " ") ?? "Document"}</p>
                        <p className="text-xs text-muted-foreground truncate">{doc.sourceRef ?? doc.fileUrl ?? "—"}</p>
                      </div>
                      <Badge variant="outline" className="shrink-0">
                        {doc.status ?? "unknown"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* FHIR Tab */}
        <TabsContent value="fhir" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">FHIR Claim Payload</CardTitle></CardHeader>
            <CardContent>
              {data.packages && data.packages.length > 0 ? (
                <div className="space-y-4">
                  {data.packages.map((pkg: any) => (
                    <div key={pkg.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">Package v{pkg.version} — {pkg.status}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(pkg.createdAt)}</p>
                      </div>
                      {pkg.fhirClaim && (
                        <pre className="rounded-md bg-muted p-3 text-xs overflow-auto max-h-80 font-mono">
                          {typeof pkg.fhirClaim === "string" ? pkg.fhirClaim : JSON.stringify(pkg.fhirClaim, null, 2)}
                        </pre>
                      )}
                      {pkg.credentialPayload && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs text-primary">View Credential Payload</summary>
                          <pre className="mt-1 rounded-md bg-muted p-3 text-xs overflow-auto max-h-60 font-mono">
                            {typeof pkg.credentialPayload === "string" ? pkg.credentialPayload : JSON.stringify(pkg.credentialPayload, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">ยังไม่มี FHIR Package</p>
                  {data.diagnosisCodes != null && (
                    <div>
                      <p className="text-xs font-medium mb-1">Diagnosis Codes:</p>
                      <pre className="rounded-md bg-muted p-2 text-xs overflow-auto max-h-40 font-mono">
                        {JSON.stringify(data.diagnosisCodes, null, 2)}
                      </pre>
                    </div>
                  )}
                  {data.serviceItems != null && (
                    <div>
                      <p className="text-xs font-medium mb-1">Service Items:</p>
                      <pre className="rounded-md bg-muted p-2 text-xs overflow-auto max-h-40 font-mono">
                        {JSON.stringify(data.serviceItems, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payer Response Tab */}
        <TabsContent value="payer" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Payer Submission & Response</CardTitle></CardHeader>
            <CardContent>
              {(!data.submissions || data.submissions.length === 0) ? (
                <p className="text-sm text-muted-foreground">ยังไม่มีการส่งเคลมไปยัง Payer</p>
              ) : (
                <div className="space-y-4">
                  {data.submissions.map((sub: any) => (
                    <div key={sub.id} className="rounded-md border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">Submission #{sub.id}</p>
                        <Badge variant="outline">{sub.eventType ?? sub.status ?? "submitted"}</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <span>Channel: {sub.channel ?? "—"}</span>
                        <span>Sent: {formatDate(sub.createdAt)}</span>
                      </div>
                      {sub.responsePayload && (
                        <details>
                          <summary className="cursor-pointer text-xs text-primary">View Response</summary>
                          <pre className="mt-1 rounded-md bg-muted p-2 text-xs overflow-auto max-h-40 font-mono">
                            {typeof sub.responsePayload === "string" ? sub.responsePayload : JSON.stringify(sub.responsePayload, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {data.rejectionReason && (
                <div className="mt-4 rounded-md border-l-4 border-red-400 bg-red-50 p-3">
                  <p className="text-sm font-medium text-red-700">Rejection Reason</p>
                  <p className="text-xs text-red-600 mt-1">{data.rejectionReason}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payment Tab */}
        <TabsContent value="payment" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Payment & Reconciliation</CardTitle></CardHeader>
            <CardContent>
              {(!data.payments || data.payments.length === 0) ? (
                <p className="text-sm text-muted-foreground">ยังไม่มีข้อมูลการชำระเงิน</p>
              ) : (
                <div className="space-y-4">
                  {data.payments.map((pay: any) => (
                    <div key={pay.id} className="rounded-md border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">Payment #{pay.id}</p>
                        <Badge className="bg-emerald-100 text-emerald-700">{pay.status ?? "paid"}</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">จำนวนเงิน</p>
                          <p className="font-medium">{money(pay.paidAmount ?? pay.amount)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">วันที่ชำระ</p>
                          <p>{formatDate(pay.paidAt ?? pay.createdAt)}</p>
                        </div>
                        {pay.paymentMethod && (
                          <div>
                            <p className="text-xs text-muted-foreground">วิธีชำระ</p>
                            <p>{pay.paymentMethod}</p>
                          </div>
                        )}
                        {pay.referenceNumber && (
                          <div>
                            <p className="text-xs text-muted-foreground">Ref</p>
                            <p className="font-mono text-xs">{pay.referenceNumber}</p>
                          </div>
                        )}
                      </div>
                      {pay.reconciliationData && (
                        <details>
                          <summary className="cursor-pointer text-xs text-primary">View Reconciliation</summary>
                          <pre className="mt-1 rounded-md bg-muted p-2 text-xs overflow-auto max-h-40 font-mono">
                            {typeof pay.reconciliationData === "string" ? pay.reconciliationData : JSON.stringify(pay.reconciliationData, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function buildTimeline(data: any) {
  const events: Array<{ label: string; time: string; detail?: string }> = [];

  events.push({ label: "สร้าง Claim Case", time: formatDate(data.createdAt) });

  if (data.documents && data.documents.length > 0) {
    events.push({
      label: `รวบรวมเอกสาร (${data.documents.length} รายการ)`,
      time: formatDate(data.documents[data.documents.length - 1]?.createdAt),
    });
  }

  if (data.packages && data.packages.length > 0) {
    const latest = data.packages[0];
    events.push({
      label: `สร้าง FHIR Claim Package v${latest.version}`,
      time: formatDate(latest.createdAt),
      detail: `Status: ${latest.status}`,
    });
  }

  if (data.submittedAt) {
    events.push({ label: "ส่งเคลมไปยัง Payer", time: formatDate(data.submittedAt) });
  }

  if (data.submissions && data.submissions.length > 0) {
    const latest = data.submissions[0];
    events.push({
      label: `Payer Response: ${latest.eventType ?? latest.status ?? "received"}`,
      time: formatDate(latest.createdAt),
    });
  }

  if (data.respondedAt) {
    events.push({ label: "ได้รับคำตอบจาก Payer", time: formatDate(data.respondedAt) });
  }

  if (data.payments && data.payments.length > 0) {
    const latest = data.payments[0];
    events.push({
      label: `ชำระเงิน: ${money(latest.paidAmount ?? latest.amount)}`,
      time: formatDate(latest.paidAt ?? latest.createdAt),
    });
  }

  if (data.paidAt) {
    events.push({ label: "Claim ปิดเรียบร้อย (Paid)", time: formatDate(data.paidAt) });
  }

  return events.reverse(); // newest first
}
