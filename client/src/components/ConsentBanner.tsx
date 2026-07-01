import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, CheckCircle2, Info, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type ConsentPurpose = "treatment" | "referral" | "research" | "insurance" | "public_health" | "emergency";

interface ConsentBannerProps {
  policyId: number;
  purpose: ConsentPurpose;
  grantedToHospitalId?: number;
  grantedToDoctorId?: number;
  title?: string;
  description?: string;
  isBreakGlass?: boolean;
  onGranted?: () => void;
  onDenied?: () => void;
  variant?: "default" | "compact" | "emergency";
}

const purposeLabels: Record<string, string> = {
  treatment: "การรักษาพยาบาล",
  referral: "การส่งต่อผู้ป่วย",
  research: "การวิจัย",
  insurance: "ประกันภัย",
  public_health: "สาธารณสุข",
  emergency: "กรณีฉุกเฉิน",
};

export function ConsentBanner({
  policyId,
  purpose,
  grantedToHospitalId,
  grantedToDoctorId,
  title,
  description,
  isBreakGlass = false,
  onGranted,
  onDenied,
  variant = "default",
}: ConsentBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  const grantMutation = trpc.consent.grant.useMutation({
    onSuccess: () => {
      toast.success("ให้ความยินยอมสำเร็จ");
      onGranted?.();
      setDismissed(true);
    },
    onError: (e) => toast.error(e.message),
  });

  if (dismissed) return null;

  const handleGrant = () => {
    grantMutation.mutate({ policyId, purpose, grantedToHospitalId, grantedToDoctorId, isBreakGlass });
  };

  const handleDeny = () => {
    onDenied?.();
    setDismissed(true);
  };

  if (variant === "emergency") {
    return (
      <Card className="border-red-300 bg-red-50 dark:bg-red-950/20 dark:border-red-800">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm text-red-800 dark:text-red-200">
                {title || "Break-Glass Emergency Access"}
              </h4>
              <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                {description || "การเข้าถึงข้อมูลฉุกเฉินจะถูกบันทึกและตรวจสอบย้อนหลัง ใช้เฉพาะกรณีจำเป็นเร่งด่วนเท่านั้น"}
              </p>
              <div className="flex items-center gap-2 mt-3">
                <Button size="sm" variant="destructive" onClick={handleGrant} disabled={grantMutation.isPending} className="text-xs">
                  {grantMutation.isPending ? "กำลังดำเนินการ..." : "ยืนยันเข้าถึงฉุกเฉิน"}
                </Button>
                <Button size="sm" variant="outline" onClick={handleDeny} className="text-xs">ยกเลิก</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (variant === "compact") {
    return (
      <div className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-muted/50">
        <div className="flex items-center gap-2 min-w-0">
          <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
          <span className="text-xs truncate">{title || `ขอความยินยอมเพื่อ${purposeLabels[purpose]}`}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" variant="outline" onClick={handleDeny} className="h-7 text-xs">ปฏิเสธ</Button>
          <Button size="sm" onClick={handleGrant} disabled={grantMutation.isPending} className="h-7 text-xs">
            {grantMutation.isPending ? "..." : "ยินยอม"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm">{title || `ขอความยินยอมเพื่อ${purposeLabels[purpose]}`}</h4>
            <p className="text-xs text-muted-foreground mt-1">
              {description || "ข้อมูลของคุณจะถูกใช้ตามวัตถุประสงค์ที่ระบุเท่านั้น คุณสามารถถอนความยินยอมได้ตลอดเวลา"}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="text-[10px]">{purposeLabels[purpose]}</Badge>
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Info className="h-3 w-3" />ถอนได้ตลอดเวลา
              </span>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <Button size="sm" variant="outline" onClick={handleDeny} className="text-xs">ปฏิเสธ</Button>
              <Button size="sm" onClick={handleGrant} disabled={grantMutation.isPending} className="text-xs gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {grantMutation.isPending ? "กำลังดำเนินการ..." : "ให้ความยินยอม"}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
