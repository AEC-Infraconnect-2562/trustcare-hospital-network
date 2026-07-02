import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AvatarPhoto } from "@/components/AvatarPhoto";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Camera, Upload, User, Mail, Phone, IdCard, Building2, Check } from "lucide-react";
import { toast } from "sonner";
import { normalizeAvatarUrl } from "@/lib/avatar";

export default function PatientProfile() {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const uploadPhotoMutation = trpc.users.uploadPhoto.useMutation({
    onSuccess: (data) => {
      toast.success("อัปโหลดรูปถ่ายสำเร็จ", { description: "รูปถ่ายของคุณจะแสดงในเอกสารรับรอง" });
      setPreviewUrl(data.url);
      utils.auth.me.invalidate();
    },
    onError: (err) => {
      toast.error("อัปโหลดไม่สำเร็จ", { description: err.message });
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("รูปแบบไฟล์ไม่ถูกต้อง", { description: "รองรับเฉพาะ JPEG, PNG, WebP" });
      return;
    }

    // Validate file size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("ไฟล์ใหญ่เกินไป", { description: "ขนาดไฟล์ต้องไม่เกิน 2MB" });
      return;
    }

    setUploading(true);
    try {
      // Resize image to 400x400 for optimal credential display
      const resizedBase64 = await resizeImage(file, 400, 400);
      const mimeType = file.type as "image/jpeg" | "image/png" | "image/webp";
      
      await uploadPhotoMutation.mutateAsync({
        photoBase64: resizedBase64,
        mimeType,
      });
    } catch (err: any) {
      toast.error("เกิดข้อผิดพลาด", { description: err.message || "ไม่สามารถอัปโหลดรูปได้" });
    } finally {
      setUploading(false);
    }
  };

  const currentAvatarUrl = normalizeAvatarUrl(previewUrl || (user as any)?.avatarUrl);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back button */}
      <Button variant="ghost" onClick={() => window.history.back()} className="text-muted-foreground hover:text-foreground -ml-2">
        <ArrowLeft className="h-4 w-4 mr-2" />กลับ
      </Button>
      <div>
        <h1 className="text-2xl font-bold">โปรไฟล์ผู้ป่วย</h1>
        <p className="text-muted-foreground mt-1">จัดการข้อมูลส่วนตัวและรูปถ่ายสำหรับเอกสารรับรอง</p>
      </div>

      {/* Photo Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            รูปถ่ายประจำตัว
          </CardTitle>
          <CardDescription>
            รูปถ่ายนี้จะแสดงในบัตรประจำตัวผู้ป่วยและเอกสารรับรองแพทย์ทุกฉบับ
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="relative group">
              <AvatarPhoto
                src={currentAvatarUrl}
                name={user?.name || "User"}
                role={(user as any)?.systemRole || "patient"}
                gender={(user as any)?.gender}
                className="h-28 w-28 border-4 border-muted"
                fallbackClassName="text-2xl bg-primary/10 text-primary"
                fallbackToDefault={false}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                disabled={uploading}
              >
                <Camera className="h-6 w-6 text-white" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium">อัปโหลดรูปถ่ายใหม่</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  JPEG, PNG หรือ WebP • ขนาดไม่เกิน 2MB • จะถูกปรับเป็น 400×400px
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <>
                    <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    กำลังอัปโหลด...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    เลือกรูปถ่าย
                  </>
                )}
              </Button>
              {currentAvatarUrl && (
                <div className="flex items-center gap-1 text-xs text-green-600">
                  <Check className="h-3 w-3" />
                  <span>มีรูปถ่ายแล้ว</span>
                </div>
              )}
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileSelect}
          />
        </CardContent>
      </Card>

      {/* Personal Info Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            ข้อมูลส่วนตัว
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InfoRow icon={User} label="ชื่อ-นามสกุล" value={user?.name || "—"} />
            <InfoRow icon={Mail} label="อีเมล" value={(user as any)?.email || "—"} />
            <InfoRow icon={Phone} label="โทรศัพท์" value={(user as any)?.phone || "—"} />
            <InfoRow icon={IdCard} label="เลขบัตรประชาชน" value={(user as any)?.thaiId ? maskThaiId((user as any).thaiId) : "—"} />
            <InfoRow icon={Building2} label="โรงพยาบาล" value={(user as any)?.hospitalName || "TrustCare Network"} />
          </div>
          <Separator />
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{(user as any)?.systemRole || "patient"}</Badge>
            <span className="text-xs text-muted-foreground">บทบาทในระบบ</span>
          </div>
        </CardContent>
      </Card>

      {/* Photo Usage Info */}
      <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
        <CardContent className="p-4">
          <p className="text-sm font-medium text-blue-900 dark:text-blue-100">รูปถ่ายจะถูกใช้ใน:</p>
          <ul className="mt-2 space-y-1 text-sm text-blue-800 dark:text-blue-200">
            <li>• บัตรประจำตัวผู้ป่วย (Patient Identity Card)</li>
            <li>• ใบรับรองแพทย์ (Medical Certificate)</li>
            <li>• เอกสารส่งต่อผู้ป่วย (Referral Document)</li>
            <li>• Wallet Card แสดงในกระเป๋าสุขภาพ</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium truncate">{value}</p>
      </div>
    </div>
  );
}

function maskThaiId(id: string): string {
  if (id.length < 13) return id;
  return `${id.slice(0, 1)}-${id.slice(1, 5)}-XXXXX-${id.slice(10, 12)}-${id.slice(12)}`;
}

async function resizeImage(file: File, maxWidth: number, maxHeight: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => {
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;

        // Crop to square (center crop)
        const size = Math.min(width, height);
        const sx = (width - size) / 2;
        const sy = (height - size) / 2;

        canvas.width = maxWidth;
        canvas.height = maxHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas not supported"));

        ctx.drawImage(img, sx, sy, size, size, 0, 0, maxWidth, maxHeight);

        // Convert to base64 without the data URL prefix
        const dataUrl = canvas.toDataURL(file.type, 0.85);
        const base64 = dataUrl.split(",")[1];
        resolve(base64);
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
