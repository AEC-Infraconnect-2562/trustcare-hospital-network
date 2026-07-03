import { ContextualConsentDialog } from "@/components/ContextualConsentDialog";
import { DocumentRequestWizard } from "@/components/DocumentRequestWizard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { DOCUMENT_CATEGORIES } from "@shared/const";
import type { ReadinessContext } from "@shared/readiness";
import QRCode from "qrcode";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  FileSearch,
  QrCode,
  Send,
  ShieldCheck,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

interface Props {
  context: ReadinessContext;
}

export function ServiceReadinessPanel({ context }: Props) {
  const [receiverName, setReceiverName] = useState("TrustCare hospital intake");
  const [serviceName, setServiceName] = useState("");
  const [consentOpen, setConsentOpen] = useState(false);
  const [packetOpen, setPacketOpen] = useState(false);
  const [packet, setPacket] = useState<any>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const readinessQuery = trpc.wallet.readiness.useQuery({ context });
  const buildPacket = trpc.wallet.buildServicePacket.useMutation({
    onSuccess: async result => {
      setPacket(result);
      setQrDataUrl(
        await QRCode.toDataURL(result.qrData, { margin: 1, width: 260 })
      );
      setConsentOpen(false);
      setPacketOpen(true);
      toast.success("สร้าง service packet เป็น VP แล้ว");
      await readinessQuery.refetch();
    },
    onError: error => toast.error(error.message),
  });

  const readiness = readinessQuery.data?.readiness;
  const missing = readiness?.missing ?? [];
  const ready = readiness?.ready ?? [];
  const requests = readinessQuery.data?.requests ?? [];
  const requiredMissing = missing.filter((item: any) => item.required);
  const packetButtonLabel = readiness?.criticalReady
    ? "สร้าง VP service packet"
    : "สร้าง partial VP service packet";
  const categories = useMemo(() => {
    const keys = new Set<string>();
    ready.forEach((item: any) => keys.add(item.category));
    missing.forEach((item: any) => keys.add(item.category));
    return Array.from(keys).map(
      key =>
        DOCUMENT_CATEGORIES[key as keyof typeof DOCUMENT_CATEGORIES]?.en ?? key
    );
  }, [ready, missing]);

  const createPacket = () => {
    buildPacket.mutate({
      context,
      receiverName,
      serviceName,
      consentAttested: true,
    });
  };

  if (readinessQuery.isLoading || !readiness) {
    return (
      <Card>
        <CardContent className="flex min-h-[280px] items-center justify-center text-sm text-muted-foreground">
          กำลังตรวจ readiness จาก Wallet...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-lg">{readiness.label}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {readiness.labelEn}
                </p>
              </div>
              <Badge
                variant={readiness.criticalReady ? "default" : "secondary"}
              >
                {readiness.criticalReady ? "Ready" : "Needs documents"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-3xl font-semibold">{readiness.score}%</p>
                  <p className="text-xs text-muted-foreground">
                    Service readiness score
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Required {readiness.requiredReady}/{readiness.requiredTotal}
                </p>
              </div>
              <Progress value={readiness.score} />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-md border p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  พร้อมใช้
                </div>
                <div className="space-y-2">
                  {ready.length ? (
                    ready.map((item: any) => (
                      <div
                        key={item.key}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <span>{item.label}</span>
                        <Badge variant="outline">
                          {item.matchedCards.length}
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      ยังไม่มีเอกสารที่ตรงบริบท
                    </p>
                  )}
                </div>
              </div>
              <div className="rounded-md border p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  ต้องเติม
                </div>
                <div className="space-y-2">
                  {missing.length ? (
                    missing.map((item: any) => (
                      <div
                        key={item.key}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <span>{item.label}</span>
                        <Badge
                          variant={item.required ? "destructive" : "secondary"}
                        >
                          {item.required ? "required" : "optional"}
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      ครบตามบริบทนี้แล้ว
                    </p>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {!readiness.criticalReady && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-medium">Partial service packet</p>
                <p className="mt-1 text-xs">
                  Required documents still missing:{" "}
                  {requiredMissing.map((item: any) => item.label).join(", ") ||
                    "none"}
                  . You can request documents first or share a partial VP packet
                  for triage.
                </p>
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>ผู้รับข้อมูล/จุดบริการ</Label>
                <Input
                  value={receiverName}
                  onChange={event => setReceiverName(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>ชื่อบริการหรือ visit</Label>
                <Input
                  value={serviceName}
                  onChange={event => setServiceName(event.target.value)}
                  placeholder="เช่น OPD เบาหวาน, ส่งต่อศูนย์หัวใจ"
                />
              </div>
            </div>
            <Button
              onClick={() => setConsentOpen(true)}
              disabled={!ready.length}
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              {packetButtonLabel}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-4 w-4 text-primary" />
              Active document requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {requests.length ? (
                requests.slice(0, 6).map((request: any) => (
                  <div
                    key={request.id}
                    className="rounded-md border p-3 text-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium">{request.documentType}</p>
                      <Badge variant="outline">{request.status}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {request.sourceName || request.sourceType} ·{" "}
                      {request.requestId}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  ยังไม่มีคำขอเอกสารสำหรับบริบทนี้
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="request">
        <TabsList>
          <TabsTrigger value="request" className="gap-2">
            <FileSearch className="h-4 w-4" />
            Request
          </TabsTrigger>
          <TabsTrigger value="trust" className="gap-2">
            <ShieldCheck className="h-4 w-4" />
            Trust view
          </TabsTrigger>
        </TabsList>
        <TabsContent value="request" className="mt-4">
          <DocumentRequestWizard
            context={context}
            missing={missing as any}
            onCreated={() => readinessQuery.refetch()}
          />
        </TabsContent>
        <TabsContent value="trust" className="mt-4">
          <Card>
            <CardContent className="grid gap-3 p-4 md:grid-cols-3">
              <TrustTile
                label="Data categories"
                value={categories.join(", ") || "-"}
              />
              <TrustTile label="VP holder" value="did:key patient wallet" />
              <TrustTile
                label="Storage principle"
                value="Source feeds wallet; HIS remains encounter source"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ContextualConsentDialog
        open={consentOpen}
        onOpenChange={setConsentOpen}
        contextLabel={readiness.label}
        recipient={receiverName}
        dataCategories={categories}
        expiryLabel="24 ชั่วโมง"
        onConfirm={createPacket}
        isLoading={buildPacket.isPending}
      />

      <Dialog open={packetOpen} onOpenChange={setPacketOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-primary" />
              VP Service Packet
            </DialogTitle>
            <DialogDescription>
              ให้โรงพยาบาลสแกน QR นี้เพื่อ verify VP และเริ่ม intake ได้เร็วขึ้น
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4">
            {qrDataUrl && (
              <img
                src={qrDataUrl}
                alt="VP service packet QR"
                className="h-64 w-64 rounded-md border bg-white p-2"
              />
            )}
            <div className="w-full rounded-md bg-muted p-3 text-xs text-muted-foreground">
              <p>Presentation ID: {packet?.presentationId}</p>
              <p>Credentials: {packet?.credentialCount}</p>
              <p>
                Expires:{" "}
                {packet?.expiresAt
                  ? new Date(packet.expiresAt).toLocaleString("th-TH")
                  : "-"}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TrustTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
