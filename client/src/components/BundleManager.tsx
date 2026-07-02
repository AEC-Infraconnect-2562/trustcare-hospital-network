import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Upload, FileText, Image, File, ChevronDown, ChevronRight, Plus, Trash2, ShieldCheck, Package, Download, Eye, ZoomIn, ZoomOut, RotateCw, X, Scan } from "lucide-react";
import { DicomViewer } from "@/components/DicomViewer";

interface Props {
  caseType: string;
  caseId: number;
}

interface UploadProgress {
  fileName: string;
  progress: number;
  status: "uploading" | "done" | "error";
}

interface PreviewFile {
  fileName: string;
  fileUrl: string;
  mimeType: string;
}

const PREVIEWABLE_IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp", "image/svg+xml", "image/bmp"];
const PREVIEWABLE_PDF_TYPES = ["application/pdf"];
const DICOM_TYPES = ["application/dicom"];

function isPreviewable(mimeType: string, fileName?: string): boolean {
  return PREVIEWABLE_IMAGE_TYPES.includes(mimeType) || PREVIEWABLE_PDF_TYPES.includes(mimeType) || isDicomType(mimeType, fileName);
}

function isImageType(mimeType: string): boolean {
  return PREVIEWABLE_IMAGE_TYPES.includes(mimeType);
}

function isPdfType(mimeType: string): boolean {
  return PREVIEWABLE_PDF_TYPES.includes(mimeType);
}

function isDicomType(mimeType: string, fileName?: string): boolean {
  if (DICOM_TYPES.includes(mimeType)) return true;
  if (fileName && fileName.toLowerCase().endsWith(".dcm")) return true;
  return false;
}

const fileTypeIcon = (mimeType: string, fileName?: string) => {
  if (isDicomType(mimeType, fileName)) return <Scan className="h-4 w-4 text-cyan-600" />;
  if (mimeType?.startsWith("image/")) return <Image className="h-4 w-4 text-blue-500" />;
  if (mimeType?.includes("pdf")) return <FileText className="h-4 w-4 text-red-500" />;
  if (mimeType?.includes("word") || mimeType?.includes("document")) return <FileText className="h-4 w-4 text-blue-700" />;
  return <File className="h-4 w-4 text-muted-foreground" />;
};

const fileTypeBadge = (fileType: string) => {
  const colors: Record<string, string> = {
    general_document: "bg-gray-100 text-gray-700",
    medical_record: "bg-blue-100 text-blue-700",
    lab_result: "bg-purple-100 text-purple-700",
    imaging: "bg-cyan-100 text-cyan-700",
    prescription: "bg-green-100 text-green-700",
    consent_form: "bg-yellow-100 text-yellow-700",
    insurance_document: "bg-orange-100 text-orange-700",
    identity_document: "bg-pink-100 text-pink-700",
    verifiable_credential: "bg-emerald-100 text-emerald-700",
    verifiable_presentation: "bg-teal-100 text-teal-700",
  };
  return colors[fileType] || "bg-gray-100 text-gray-700";
};

/* ─── Image Preview with Zoom & Rotate ─── */
function ImagePreview({ src, alt }: { src: string; alt: string }) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-center gap-2 py-2 border-b bg-muted/30">
        <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))} title="ซูมออก">
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <span className="text-xs font-mono w-12 text-center">{Math.round(zoom * 100)}%</span>
        <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => setZoom((z) => Math.min(4, z + 0.25))} title="ซูมเข้า">
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
        <div className="w-px h-4 bg-border mx-1" />
        <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => setRotation((r) => (r + 90) % 360)} title="หมุน">
          <RotateCw className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => { setZoom(1); setRotation(0); }}>
          รีเซ็ต
        </Button>
      </div>
      {/* Image container */}
      <div className="flex-1 overflow-auto flex items-center justify-center bg-[repeating-conic-gradient(#f3f4f6_0%_25%,#ffffff_0%_50%)] dark:bg-[repeating-conic-gradient(#1f2937_0%_25%,#111827_0%_50%)] bg-[length:20px_20px] min-h-[400px]">
        <img
          src={src}
          alt={alt}
          className="max-w-none transition-transform duration-200 ease-out select-none"
          style={{
            transform: `scale(${zoom}) rotate(${rotation}deg)`,
            transformOrigin: "center center",
          }}
          draggable={false}
        />
      </div>
    </div>
  );
}

/* ─── PDF Preview ─── */
function PdfPreview({ src, fileName }: { src: string; fileName: string }) {
  const [loadError, setLoadError] = useState(false);

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-[500px] gap-4 text-muted-foreground">
        <FileText className="h-12 w-12 opacity-50" />
        <p className="text-sm">ไม่สามารถแสดงตัวอย่าง PDF ได้</p>
        <Button size="sm" variant="outline" asChild>
          <a href={src} target="_blank" rel="noopener noreferrer">
            <Download className="h-3.5 w-3.5 mr-1.5" />ดาวน์โหลด {fileName}
          </a>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-[500px]">
      <iframe
        src={src}
        className="flex-1 w-full min-h-[500px] rounded border"
        title={`Preview: ${fileName}`}
        onError={() => setLoadError(true)}
      />
      <div className="flex items-center justify-between py-2 px-1">
        <span className="text-xs text-muted-foreground">หากไม่แสดงผล กรุณาดาวน์โหลดไฟล์</span>
        <Button size="sm" variant="outline" className="text-xs" asChild>
          <a href={src} target="_blank" rel="noopener noreferrer">
            <Download className="h-3 w-3 mr-1" />เปิดในแท็บใหม่
          </a>
        </Button>
      </div>
    </div>
  );
}

/* ─── Main BundleManager ─── */
export function BundleManager({ caseType, caseId }: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const [newBundleTitle, setNewBundleTitle] = useState("");
  const [newBundleType, setNewBundleType] = useState("mixed");
  const [expandedBundles, setExpandedBundles] = useState<Set<number>>(new Set());
  const [uploads, setUploads] = useState<UploadProgress[]>([]);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [previewFile, setPreviewFile] = useState<PreviewFile | null>(null);

  const { data: bundles, refetch } = trpc.careTransition.getBundles.useQuery({ caseType, caseId });
  const createBundle = trpc.careTransition.createBundle.useMutation({
    onSuccess: () => { refetch(); setShowCreate(false); setNewBundleTitle(""); toast.success("สร้าง Bundle สำเร็จ"); },
    onError: (e) => toast.error(e.message),
  });
  const removeFile = trpc.careTransition.removeBundleFile.useMutation({
    onSuccess: () => { refetch(); toast.success("ลบไฟล์สำเร็จ"); },
    onError: (e) => toast.error(e.message),
  });

  const toggleExpand = (id: number) => {
    setExpandedBundles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const uploadFiles = useCallback(async (bundleId: number, files: FileList | File[]) => {
    const fileArray = Array.from(files);
    for (const file of fileArray) {
      const progressEntry: UploadProgress = { fileName: file.name, progress: 0, status: "uploading" };
      setUploads((prev) => [...prev, progressEntry]);

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("bundleId", String(bundleId));
        formData.append("fileType", guessFileType(file));

        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/upload/bundle-file");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            setUploads((prev) => prev.map((u) => u.fileName === file.name ? { ...u, progress: pct } : u));
          }
        };
        await new Promise<void>((resolve, reject) => {
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              setUploads((prev) => prev.map((u) => u.fileName === file.name ? { ...u, progress: 100, status: "done" } : u));
              resolve();
            } else {
              setUploads((prev) => prev.map((u) => u.fileName === file.name ? { ...u, status: "error" } : u));
              reject(new Error(`Upload failed: ${xhr.status}`));
            }
          };
          xhr.onerror = () => {
            setUploads((prev) => prev.map((u) => u.fileName === file.name ? { ...u, status: "error" } : u));
            reject(new Error("Network error"));
          };
          xhr.send(formData);
        });
      } catch {
        toast.error(`อัพโหลด ${file.name} ล้มเหลว`);
      }
    }
    refetch();
    setTimeout(() => setUploads([]), 3000);
  }, [refetch]);

  const guessFileType = (file: File): string => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (["jpg", "jpeg", "png", "gif", "bmp", "webp", "dicom", "dcm"].includes(ext)) return "imaging";
    if (ext === "pdf" && file.name.toLowerCase().includes("lab")) return "lab_result";
    if (ext === "pdf" && file.name.toLowerCase().includes("consent")) return "consent_form";
    if (["json", "jwt", "vc"].includes(ext)) return "verifiable_credential";
    if (["vp"].includes(ext)) return "verifiable_presentation";
    return "general_document";
  };

  const handleDrop = (bundleId: number, e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(null);
    if (e.dataTransfer.files.length > 0) {
      uploadFiles(bundleId, e.dataTransfer.files);
    }
  };

  const openPreview = (file: any) => {
    if (!file.fileUrl || !file.mimeType) {
      toast.error("ไม่สามารถแสดงตัวอย่างได้ — ไม่มี URL ไฟล์");
      return;
    }
    if (!isPreviewable(file.mimeType, file.fileName)) {
      toast.info("ไฟล์ประเภทนี้ไม่รองรับการแสดงตัวอย่าง กรุณาดาวน์โหลดแทน");
      return;
    }
    setPreviewFile({ fileName: file.fileName, fileUrl: file.fileUrl, mimeType: file.mimeType });
  };

  return (
    <div className="space-y-4">
      {/* Preview Dialog */}
      <Dialog open={!!previewFile} onOpenChange={(open) => { if (!open) setPreviewFile(null); }}>
        <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-4 py-3 border-b flex-shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-sm font-medium flex items-center gap-2 truncate pr-4">
                {previewFile && fileTypeIcon(previewFile.mimeType)}
                <span className="truncate">{previewFile?.fileName}</span>
              </DialogTitle>
              <div className="flex items-center gap-2 flex-shrink-0">
                {previewFile?.fileUrl && (
                  <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
                    <a href={previewFile.fileUrl} target="_blank" rel="noopener noreferrer" download>
                      <Download className="h-3 w-3 mr-1" />ดาวน์โหลด
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {previewFile && isDicomType(previewFile.mimeType, previewFile.fileName) && (
              <DicomViewer src={previewFile.fileUrl} fileName={previewFile.fileName} />
            )}
            {previewFile && isImageType(previewFile.mimeType) && !isDicomType(previewFile.mimeType, previewFile.fileName) && (
              <ImagePreview src={previewFile.fileUrl} alt={previewFile.fileName} />
            )}
            {previewFile && isPdfType(previewFile.mimeType) && (
              <PdfPreview src={previewFile.fileUrl} fileName={previewFile.fileName} />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Package className="h-4 w-4" />
          Document Bundles ({bundles?.length ?? 0})
        </h3>
        <Button size="sm" variant="outline" onClick={() => setShowCreate(!showCreate)}>
          <Plus className="h-3.5 w-3.5 mr-1" />สร้าง Bundle
        </Button>
      </div>

      {showCreate && (
        <Card className="border-dashed">
          <CardContent className="pt-4 space-y-3">
            <div className="space-y-2">
              <Label>ชื่อ Bundle *</Label>
              <Input value={newBundleTitle} onChange={(e) => setNewBundleTitle(e.target.value)} placeholder="เช่น เอกสารส่งต่อ, ผลตรวจ Lab" />
            </div>
            <div className="space-y-2">
              <Label>ประเภท</Label>
              <Select value={newBundleType} onValueChange={setNewBundleType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mixed">ผสม (Mixed)</SelectItem>
                  <SelectItem value="clinical">เอกสารคลินิก (Clinical)</SelectItem>
                  <SelectItem value="administrative">เอกสารบริหาร (Administrative)</SelectItem>
                  <SelectItem value="financial">เอกสารการเงิน (Financial)</SelectItem>
                  <SelectItem value="identity">เอกสารตัวตน (Identity)</SelectItem>
                  <SelectItem value="credential">VC/VP Credentials</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => createBundle.mutate({ caseType, caseId, title: newBundleTitle, bundleType: newBundleType as any })} disabled={!newBundleTitle || createBundle.isPending}>
                {createBundle.isPending ? "กำลังสร้าง..." : "สร้าง"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>ยกเลิก</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload Progress */}
      {uploads.length > 0 && (
        <div className="space-y-2">
          {uploads.filter((u) => u.status === "uploading").map((u) => (
            <div key={u.fileName} className="flex items-center gap-3 text-xs">
              <Upload className="h-3.5 w-3.5 animate-pulse text-primary" />
              <span className="truncate flex-1">{u.fileName}</span>
              <Progress value={u.progress} className="h-1 w-20" />
              <span>{u.progress}%</span>
            </div>
          ))}
        </div>
      )}

      {/* Bundle List */}
      <div className="space-y-2">
        {(bundles ?? []).map((bundle: any) => (
          <Collapsible key={bundle.id} open={expandedBundles.has(bundle.id)} onOpenChange={() => toggleExpand(bundle.id)}>
            <div
              className={`rounded-lg border transition-colors ${dragOver === bundle.id ? "border-primary bg-primary/5" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(bundle.id); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => handleDrop(bundle.id, e)}
            >
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 rounded-t-lg">
                  <div className="flex items-center gap-2">
                    {expandedBundles.has(bundle.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <span className="text-sm font-medium">{bundle.title}</span>
                    <Badge variant="secondary" className="text-xs">{bundle.bundleType}</Badge>
                    <span className="text-xs text-muted-foreground">({bundle.files?.length ?? 0} files)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {bundle.integrityHash && <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />}
                    <Badge variant={bundle.status === "finalized" ? "default" : "outline"}>{bundle.status}</Badge>
                  </div>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="border-t px-3 pb-3 pt-2 space-y-2">
                  {/* Files */}
                  {(bundle.files ?? []).map((file: any) => (
                    <div key={file.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/30 group">
                      <div className="flex items-center gap-2 min-w-0">
                        {fileTypeIcon(file.mimeType)}
                        <span className="text-xs truncate">{file.fileName}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${fileTypeBadge(file.fileType)}`}>
                          {file.fileType?.replace(/_/g, " ")}
                        </span>
                        {file.vcCredentialId && <Badge variant="outline" className="text-[10px]">VC #{file.vcCredentialId}</Badge>}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-[10px] text-muted-foreground">{file.fileSize ? `${(file.fileSize / 1024).toFixed(0)} KB` : ""}</span>
                        {/* Preview button */}
                        {file.fileUrl && isPreviewable(file.mimeType, file.fileName) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-primary hover:text-primary/80"
                            onClick={() => openPreview(file)}
                            title="ดูตัวอย่าง"
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                        )}
                        {file.fileUrl && (
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" asChild>
                            <a href={file.fileUrl} target="_blank" rel="noopener noreferrer"><Download className="h-3 w-3" /></a>
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={() => removeFile.mutate({ fileId: file.id, bundleId: bundle.id })}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {(bundle.files ?? []).length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-3">ลากไฟล์มาวางที่นี่ หรือกดปุ่มอัพโหลด</p>
                  )}
                  {/* Upload button */}
                  <div className="flex items-center gap-2 pt-2">
                    <Button size="sm" variant="outline" className="text-xs" onClick={() => {
                      const input = document.createElement("input");
                      input.type = "file";
                      input.multiple = true;
                      input.onchange = () => { if (input.files) uploadFiles(bundle.id, input.files); };
                      input.click();
                    }}>
                      <Upload className="h-3 w-3 mr-1" />อัพโหลดไฟล์
                    </Button>
                  </div>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        ))}
        {(bundles ?? []).length === 0 && !showCreate && (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">ยังไม่มี Document Bundle</p>
            <p className="text-xs">สร้าง Bundle เพื่อจัดกลุ่มเอกสารสำหรับเคสนี้</p>
          </div>
        )}
      </div>
    </div>
  );
}
