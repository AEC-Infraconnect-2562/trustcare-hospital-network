import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ShieldCheck, ShieldAlert, Search, CheckCircle, XCircle, Loader2 } from "lucide-react";

interface Props {
  partnerId?: number;
  partnerDid?: string;
}

export function PartnerTrustVerification({ partnerId, partnerDid }: Props) {
  const [didInput, setDidInput] = useState(partnerDid || "");
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleVerify = async () => {
    if (!didInput) { toast.error("กรุณาระบุ DID"); return; }
    setIsVerifying(true);
    setVerificationResult(null);
    try {
      const input = JSON.stringify({ issuerDid: didInput, credentialType: "VerifiableCredential" });
      const res = await fetch(`/api/trpc/trustRegistry.checkIssuerTrust?input=${encodeURIComponent(input)}`, { credentials: "include" });
      const json = await res.json();
      const data = json?.result?.data;
      setVerificationResult(data);
      if (data?.trusted) {
        toast.success("องค์กรนี้ได้รับการยืนยันใน Trust Registry");
      } else {
        toast.warning("ไม่พบองค์กรนี้ใน Trust Registry");
      }
    } catch (e: any) {
      toast.error(e.message || "ตรวจสอบล้มเหลว");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" />
          ตรวจสอบความน่าเชื่อถือพันธมิตร
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>DID ขององค์กรพันธมิตร</Label>
          <div className="flex gap-2">
            <Input
              value={didInput}
              onChange={(e) => setDidInput(e.target.value)}
              placeholder="did:web:example.hospital.org"
              className="flex-1"
            />
            <Button onClick={handleVerify} disabled={isVerifying || !didInput} size="sm">
              {isVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {verificationResult && (
          <div className={`rounded-lg border p-4 ${verificationResult.trusted ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
            <div className="flex items-center gap-2 mb-2">
              {verificationResult.trusted ? (
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              ) : (
                <XCircle className="h-5 w-5 text-amber-600" />
              )}
              <span className="font-medium text-sm">
                {verificationResult.trusted ? "ผ่านการตรวจสอบ" : "ไม่พบใน Trust Registry"}
              </span>
            </div>
            {verificationResult.trusted && verificationResult.entry && (
              <div className="space-y-1 text-xs">
                <p><span className="text-muted-foreground">ชื่อ:</span> {verificationResult.entry.name}</p>
                <p><span className="text-muted-foreground">ระดับ:</span> <Badge variant="secondary">{verificationResult.entry.level}</Badge></p>
                <p><span className="text-muted-foreground">สถานะ:</span> <Badge variant={verificationResult.entry.status === "active" ? "default" : "outline"}>{verificationResult.entry.status}</Badge></p>
              </div>
            )}
            {!verificationResult.trusted && (
              <p className="text-xs text-amber-700">
                องค์กรนี้ยังไม่ได้ลงทะเบียนใน TrustCare Trust Registry กรุณาตรวจสอบ DID หรือติดต่อผู้ดูแลระบบ
              </p>
            )}
          </div>
        )}

        {!verificationResult && !isVerifying && (
          <div className="text-center py-4 text-muted-foreground">
            <ShieldAlert className="h-6 w-6 mx-auto mb-1 opacity-50" />
            <p className="text-xs">ระบุ DID แล้วกดตรวจสอบเพื่อยืนยันความน่าเชื่อถือ</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
