import DashboardLayout from "@/components/DashboardLayout";
import { ServiceReadinessPanel } from "@/components/ServiceReadinessPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { readinessContextLabels, readinessContextValues, type ReadinessContext } from "@shared/readiness";
import { CalendarCheck2, HeartPulse, PackageCheck, Plane, ReceiptText, RefreshCcw, ShieldAlert, Stethoscope } from "lucide-react";
import { useState } from "react";

const contextIcons: Record<ReadinessContext, any> = {
  opd_visit: Stethoscope,
  emergency: ShieldAlert,
  referral: RefreshCcw,
  cross_border: RefreshCcw,
  medical_tourist: Plane,
  insurance_claim: ReceiptText,
  pharmacy_dispense: PackageCheck,
};

export default function PrepareForService() {
  const [context, setContext] = useState<ReadinessContext>("opd_visit");
  const active = readinessContextLabels[context];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <HeartPulse className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">Prepare for Service</h1>
            </div>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              เตรียมเอกสารและข้อมูลขั้นต่ำใน Patient Wallet ให้พร้อมก่อนเข้ารับบริการ ลดการขอประวัติซ้ำ และสร้าง VP/QR ที่ตรวจสอบได้สำหรับบริบทนี้
            </p>
          </div>
          <Badge variant="outline" className="w-fit gap-1.5">
            <CalendarCheck2 className="h-3.5 w-3.5" />
            Wallet-first service readiness
          </Badge>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {readinessContextValues.map((value) => {
            const Icon = contextIcons[value];
            const item = readinessContextLabels[value];
            const selected = context === value;
            return (
              <Button
                key={value}
                variant={selected ? "default" : "outline"}
                className="h-auto justify-start rounded-lg p-3 text-left"
                onClick={() => setContext(value)}
              >
                <Icon className="mr-3 h-5 w-5 shrink-0" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{item.label}</span>
                  <span className={`block truncate text-xs ${selected ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{item.labelEn}</span>
                </span>
              </Button>
            );
          })}
        </div>

        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <p className="text-sm font-medium">{active.label}</p>
            <p className="mt-1 text-sm text-muted-foreground">{active.purpose}</p>
          </CardContent>
        </Card>

        <ServiceReadinessPanel context={context} />
      </div>
    </DashboardLayout>
  );
}
