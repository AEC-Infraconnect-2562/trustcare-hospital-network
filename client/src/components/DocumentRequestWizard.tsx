import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import type { ReadinessContext } from "@shared/readiness";
import { FilePlus2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

interface Props {
  context: ReadinessContext;
  missing?: {
    key: string;
    label: string;
    category: string;
    sourceHint: string;
  }[];
  onCreated?: () => void;
}

const sourceTypes = [
  ["his", "HIS/EMR"],
  ["lis", "LIS"],
  ["ris", "RIS"],
  ["pacs", "PACS"],
  ["hospital_app", "Hospital app"],
  ["national_app", "National app"],
  ["partner_portal", "Partner Portal"],
  ["payer", "Payer"],
  ["patient_upload", "Patient upload"],
  ["personal_health_app", "Personal health app"],
  ["other", "Other"],
] as const;

export function DocumentRequestWizard({
  context,
  missing = [],
  onCreated,
}: Props) {
  const [selectedKey, setSelectedKey] = useState(
    missing[0]?.key ?? "patient_summary"
  );
  const fallbackOption = {
    key: "patient_summary",
    label: "Latest health summary",
    category: "clinical_summary",
    sourceHint: "HIS/EMR",
  };
  const options = missing.length ? missing : [fallbackOption];
  const selected = options.find(item => item.key === selectedKey);
  const optionSignature = useMemo(
    () => options.map(item => item.key).join("|"),
    [options]
  );
  const [sourceType, setSourceType] =
    useState<(typeof sourceTypes)[number][0]>("his");
  const [sourceName, setSourceName] = useState(selected?.sourceHint ?? "");
  const [notes, setNotes] = useState("");
  const utils = trpc.useUtils();
  const requestDocument = trpc.wallet.requestDocument.useMutation({
    onSuccess: async result => {
      toast.success(`สร้างคำขอเอกสาร ${result.requestId} แล้ว`);
      await utils.wallet.readiness.invalidate();
      await utils.wallet.documentRequests.invalidate();
      onCreated?.();
    },
    onError: error => toast.error(error.message),
  });

  useEffect(() => {
    const first = options[0] ?? fallbackOption;
    if (!options.some(item => item.key === selectedKey)) {
      setSelectedKey(first.key);
      setSourceName(first.sourceHint ?? "");
      return;
    }
    const current = options.find(item => item.key === selectedKey);
    setSourceName(previous => previous || current?.sourceHint || "");
  }, [context, optionSignature, selectedKey]);

  const submit = () => {
    const documentType = selected?.key ?? selectedKey;
    requestDocument.mutate({
      context,
      documentType,
      documentCategory: selected?.category,
      sourceType,
      sourceName: sourceName || selected?.sourceHint,
      notes,
      consentAttested: true,
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FilePlus2 className="h-4 w-4 text-primary" />
          ขอเอกสารเข้ากระเป๋าผู้ป่วย
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label>เอกสารที่ต้องเติม</Label>
            <Select
              value={selectedKey}
              onValueChange={value => {
                setSelectedKey(value);
                const item = missing.find(m => m.key === value);
                if (item?.sourceHint) setSourceName(item.sourceHint);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map(item => (
                  <SelectItem key={item.key} value={item.key}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>แหล่งข้อมูล</Label>
            <Select
              value={sourceType}
              onValueChange={value => setSourceType(value as any)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sourceTypes.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>ชื่อระบบ/หน่วยงานต้นทาง</Label>
          <Input
            value={sourceName}
            onChange={event => setSourceName(event.target.value)}
            placeholder="เช่น HIS โรงพยาบาลเดิม, LIS, Partner Portal"
          />
        </div>
        <div className="space-y-2">
          <Label>หมายเหตุสำหรับเจ้าหน้าที่หรือ partner</Label>
          <Textarea
            value={notes}
            onChange={event => setNotes(event.target.value)}
            placeholder="ระบุช่วงวันที่ visit, HN เดิม, หรือเอกสารที่ต้องการ"
          />
        </div>
        <p className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
          This request records patient consent intent, source system, and
          document purpose before import, FHIR mapping, and VC issuance into the
          patient wallet.
        </p>
        <Button
          onClick={submit}
          disabled={requestDocument.isPending}
          className="w-full md:w-auto"
        >
          {requestDocument.isPending ? "กำลังสร้างคำขอ..." : "สร้างคำขอเอกสาร"}
        </Button>
      </CardContent>
    </Card>
  );
}
