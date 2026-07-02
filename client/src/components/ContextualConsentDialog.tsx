import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contextLabel: string;
  recipient: string;
  dataCategories: string[];
  expiryLabel: string;
  onConfirm: () => void;
  isLoading?: boolean;
}

export function ContextualConsentDialog({
  open,
  onOpenChange,
  contextLabel,
  recipient,
  dataCategories,
  expiryLabel,
  onConfirm,
  isLoading,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            ยืนยันการใช้ข้อมูลในบริบทนี้
          </DialogTitle>
          <DialogDescription>
            ระบบจะสร้าง VP service packet สำหรับ {contextLabel} และบันทึก audit ว่าผู้ป่วยอนุญาตให้ใช้ข้อมูลชุดนี้ในบริบทนี้
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2 text-sm">
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">ผู้รับข้อมูล</p>
            <p className="font-medium">{recipient || "TrustCare hospital intake"}</p>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">หมวดข้อมูลที่จะใช้</p>
            <div className="flex flex-wrap gap-2">
              {dataCategories.map((category) => (
                <Badge key={category} variant="secondary">{category}</Badge>
              ))}
            </div>
          </div>
          <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
            หมดอายุ: {expiryLabel}. ผู้ป่วยสามารถยกเลิกหรือสร้าง packet ใหม่เมื่อบริบทเปลี่ยนได้
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
          <Button onClick={onConfirm} disabled={isLoading}>
            {isLoading ? "กำลังสร้าง..." : "ยินยอมและสร้าง VP"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
