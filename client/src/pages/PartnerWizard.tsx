import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft, ArrowRight, Building2, Check, CheckCircle2, FileCheck2,
  FileText, Globe, Key, Loader2, Mail, Shield, Trash2, Upload, Users, X,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

type WizardStep = 1 | 2 | 3 | 4 | 5;

const steps = [
  { id: 1, title: "ข้อมูลโรงพยาบาล", titleEn: "Hospital Info", icon: Building2 },
  { id: 2, title: "ข้อมูลติดต่อ", titleEn: "Contact", icon: Mail },
  { id: 3, title: "Trust Credential", titleEn: "Trust Setup", icon: Key },
  { id: 4, title: "เอกสารรับรอง", titleEn: "Documents", icon: FileCheck2 },
  { id: 5, title: "ยืนยันและส่ง", titleEn: "Confirm", icon: CheckCircle2 },
];

const countries = [
  { code: "TH", name: "Thailand" },
  { code: "SG", name: "Singapore" },
  { code: "MY", name: "Malaysia" },
  { code: "JP", name: "Japan" },
  { code: "KR", name: "South Korea" },
  { code: "AU", name: "Australia" },
  { code: "DE", name: "Germany" },
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "AE", name: "United Arab Emirates" },
];

const credentialTypes = [
  { id: "patient_summary", label: "Patient Summary (IPS)" },
  { id: "referral_vc", label: "Referral Credential" },
  { id: "discharge_summary", label: "Discharge Summary" },
  { id: "lab_result", label: "Lab Results" },
  { id: "immunization", label: "Immunization Records" },
  { id: "insurance_eligibility", label: "Insurance Eligibility" },
];

interface UploadedDoc {
  name: string;
  fileKey: string;
  fileUrl: string;
  size: number;
  category: string;
}

export default function PartnerWizard() {
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [formData, setFormData] = useState({
    hospitalName: "",
    hospitalNameEn: "",
    country: "",
    jurisdiction: "",
    hospitalType: "",
    bedCount: "",
    accreditation: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    contactUrl: "",
    technicalContactName: "",
    technicalContactEmail: "",
    did: "",
    publicKeyJwk: "",
    supportedCredentials: [] as string[],
    preferredProtocol: "fhir_rest",
    notes: "",
  });

  // Trust verification state
  const [trustVerifying, setTrustVerifying] = useState(false);
  const [trustResult, setTrustResult] = useState<{ verified: boolean; message: string } | null>(null);

  // File upload state
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const registerMutation = trpc.trustRegistry.create.useMutation({
    onSuccess: () => {
      toast.success("ส่งคำขอลงทะเบียนพันธมิตรสำเร็จ! กรุณารอการตรวจสอบ");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const checkTrust = trpc.tao.checkIssuerTrust.useQuery(
    { issuerDid: formData.did, credentialType: formData.supportedCredentials[0] || "patient_summary" },
    { enabled: false }
  );

  const updateField = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleCredential = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      supportedCredentials: prev.supportedCredentials.includes(id)
        ? prev.supportedCredentials.filter((c) => c !== id)
        : [...prev.supportedCredentials, id],
    }));
  };

  const verifyDid = async () => {
    if (!formData.did) {
      toast.error("กรุณากรอก DID ก่อนตรวจสอบ");
      return;
    }
    setTrustVerifying(true);
    setTrustResult(null);
    try {
      const result = await checkTrust.refetch();
      if (result.data) {
        const trusted = result.data.trusted;
        setTrustResult({
          verified: trusted,
          message: trusted
            ? `DID ผ่านการตรวจสอบ — Trust Level: ${result.data.level || "verified"}`
            : "DID ยังไม่ได้ลงทะเบียนใน Trust Registry — จะถูกเพิ่มหลังอนุมัติ",
        });
      } else {
        setTrustResult({ verified: false, message: "DID ยังไม่ได้ลงทะเบียนใน Trust Registry" });
      }
    } catch {
      setTrustResult({ verified: false, message: "ไม่สามารถตรวจสอบ DID ได้ — จะถูกตรวจสอบอีกครั้งหลังส่งคำขอ" });
    } finally {
      setTrustVerifying(false);
    }
  };

  const handleFileUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadProgress(0);

    const totalFiles = files.length;
    let uploaded = 0;

    for (const file of Array.from(files)) {
      const formDataUpload = new FormData();
      formDataUpload.append("file", file);
      formDataUpload.append("bundleId", "0"); // placeholder - not tied to a specific bundle
      formDataUpload.append("documentType", "partner_document");
      formDataUpload.append("title", file.name);

      try {
        const resp = await fetch("/api/upload/bundle-file", {
          method: "POST",
          body: formDataUpload,
          credentials: "include",
        });
        if (resp.ok) {
          const data = await resp.json();
          setUploadedDocs((prev) => [...prev, {
            name: file.name,
            fileKey: data.fileKey || "",
            fileUrl: data.fileUrl || "",
            size: file.size,
            category: guessCategory(file.name),
          }]);
        } else {
          toast.error(`อัปโหลด ${file.name} ล้มเหลว`);
        }
      } catch {
        toast.error(`อัปโหลด ${file.name} ล้มเหลว`);
      }
      uploaded++;
      setUploadProgress(Math.round((uploaded / totalFiles) * 100));
    }

    setUploading(false);
    setUploadProgress(0);
  }, []);

  const guessCategory = (name: string): string => {
    const lower = name.toLowerCase();
    if (lower.includes("accredit") || lower.includes("jci") || lower.includes("iso")) return "accreditation";
    if (lower.includes("mou") || lower.includes("agreement") || lower.includes("partner")) return "mou";
    if (lower.includes("dpa") || lower.includes("pdpa") || lower.includes("gdpr") || lower.includes("data")) return "dpa";
    return "other";
  };

  const removeDoc = (idx: number) => {
    setUploadedDocs((prev) => prev.filter((_, i) => i !== idx));
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1: return formData.hospitalName && formData.country;
      case 2: return formData.contactEmail;
      case 3: return formData.supportedCredentials.length > 0;
      case 4: return true;
      default: return true;
    }
  };

  const handleSubmit = () => {
    registerMutation.mutate({
      entityType: "foreign_hospital",
      entityName: formData.hospitalName,
      entityNameEn: formData.hospitalNameEn || formData.hospitalName,
      did: formData.did || undefined,
      country: formData.country,
      jurisdiction: formData.jurisdiction || undefined,
      credentialTypes: formData.supportedCredentials,
      contactEmail: formData.contactEmail,
      contactUrl: formData.contactUrl || undefined,
      metadata: {
        bedCount: formData.bedCount,
        accreditation: formData.accreditation,
        technicalContact: formData.technicalContactEmail,
        preferredProtocol: formData.preferredProtocol,
        notes: formData.notes,
        uploadedDocuments: uploadedDocs.map((d) => ({ name: d.name, fileKey: d.fileKey, category: d.category })),
      },
    });
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    handleFileUpload(e.dataTransfer.files);
  }, [handleFileUpload]);

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Globe className="h-5 w-5 text-primary" />
            </div>
            Cross-border Partner Onboarding
          </h1>
          <p className="text-muted-foreground mt-2">
            ลงทะเบียนโรงพยาบาลพันธมิตรต่างประเทศเข้าร่วม Trustcare Network
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-between px-4">
          {steps.map((step, i) => {
            const StepIcon = step.icon;
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id;
            return (
              <div key={step.id} className="flex items-center gap-2">
                <div className={`flex items-center gap-2 ${isActive ? "text-primary" : isCompleted ? "text-emerald-600" : "text-muted-foreground"}`}>
                  <div className={`h-9 w-9 rounded-full flex items-center justify-center border-2 transition-colors ${
                    isActive ? "border-primary bg-primary/10" : isCompleted ? "border-emerald-500 bg-emerald-50" : "border-muted"
                  }`}>
                    {isCompleted ? <Check className="h-4 w-4" /> : <StepIcon className="h-4 w-4" />}
                  </div>
                  <span className="text-xs font-medium hidden md:block">{step.title}</span>
                </div>
                {i < steps.length - 1 && (
                  <div className={`h-0.5 w-8 md:w-16 ${isCompleted ? "bg-emerald-500" : "bg-muted"}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Step Content */}
        <Card>
          <CardContent className="p-6">
            {currentStep === 1 && (
              <div className="space-y-5">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Building2 className="h-5 w-5" />ข้อมูลโรงพยาบาลพันธมิตร
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>ชื่อโรงพยาบาล (ภาษาท้องถิ่น) *</Label>
                    <Input value={formData.hospitalName} onChange={(e) => updateField("hospitalName", e.target.value)} placeholder="e.g. シンガポール総合病院" />
                  </div>
                  <div className="space-y-2">
                    <Label>Hospital Name (English)</Label>
                    <Input value={formData.hospitalNameEn} onChange={(e) => updateField("hospitalNameEn", e.target.value)} placeholder="e.g. Singapore General Hospital" />
                  </div>
                  <div className="space-y-2">
                    <Label>ประเทศ *</Label>
                    <Select value={formData.country} onValueChange={(v) => updateField("country", v)}>
                      <SelectTrigger><SelectValue placeholder="เลือกประเทศ" /></SelectTrigger>
                      <SelectContent>
                        {countries.map((c) => (
                          <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Jurisdiction / Region</Label>
                    <Input value={formData.jurisdiction} onChange={(e) => updateField("jurisdiction", e.target.value)} placeholder="e.g. Central Region" />
                  </div>
                  <div className="space-y-2">
                    <Label>ประเภทโรงพยาบาล</Label>
                    <Select value={formData.hospitalType} onValueChange={(v) => updateField("hospitalType", v)}>
                      <SelectTrigger><SelectValue placeholder="เลือกประเภท" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="public">Public Hospital</SelectItem>
                        <SelectItem value="private">Private Hospital</SelectItem>
                        <SelectItem value="university">University Hospital</SelectItem>
                        <SelectItem value="military">Military Hospital</SelectItem>
                        <SelectItem value="specialty">Specialty Center</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>จำนวนเตียง</Label>
                    <Input type="number" value={formData.bedCount} onChange={(e) => updateField("bedCount", e.target.value)} placeholder="e.g. 500" />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label>Accreditation (JCI, ISO, NABH, etc.)</Label>
                    <Input value={formData.accreditation} onChange={(e) => updateField("accreditation", e.target.value)} placeholder="e.g. JCI Accredited, ISO 27001" />
                  </div>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-5">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Users className="h-5 w-5" />ข้อมูลผู้ติดต่อ
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>ชื่อผู้ประสานงาน *</Label>
                    <Input value={formData.contactName} onChange={(e) => updateField("contactName", e.target.value)} placeholder="e.g. Dr. Tanaka" />
                  </div>
                  <div className="space-y-2">
                    <Label>อีเมลผู้ประสานงาน *</Label>
                    <Input type="email" value={formData.contactEmail} onChange={(e) => updateField("contactEmail", e.target.value)} placeholder="e.g. tanaka@hospital.sg" />
                  </div>
                  <div className="space-y-2">
                    <Label>เบอร์โทรศัพท์</Label>
                    <Input value={formData.contactPhone} onChange={(e) => updateField("contactPhone", e.target.value)} placeholder="e.g. +65-xxxx-xxxx" />
                  </div>
                  <div className="space-y-2">
                    <Label>Website URL</Label>
                    <Input value={formData.contactUrl} onChange={(e) => updateField("contactUrl", e.target.value)} placeholder="https://www.hospital.sg" />
                  </div>
                </div>
                <Separator />
                <h3 className="font-medium text-sm text-muted-foreground">Technical Contact (สำหรับเชื่อมต่อระบบ)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>ชื่อ Technical Contact</Label>
                    <Input value={formData.technicalContactName} onChange={(e) => updateField("technicalContactName", e.target.value)} placeholder="e.g. IT Manager" />
                  </div>
                  <div className="space-y-2">
                    <Label>อีเมล Technical Contact</Label>
                    <Input type="email" value={formData.technicalContactEmail} onChange={(e) => updateField("technicalContactEmail", e.target.value)} placeholder="e.g. it@hospital.sg" />
                  </div>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-5">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Shield className="h-5 w-5" />Trust Credential Exchange
                </h2>
                <p className="text-sm text-muted-foreground">
                  กำหนดรูปแบบ credential ที่โรงพยาบาลพันธมิตรรองรับ และข้อมูล DID สำหรับ trust verification
                </p>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>DID (Decentralized Identifier)</Label>
                    <div className="flex gap-2">
                      <Input value={formData.did} onChange={(e) => updateField("did", e.target.value)} placeholder="did:web:hospital.sg" className="font-mono text-sm" />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={verifyDid}
                        disabled={trustVerifying || !formData.did}
                        className="shrink-0"
                      >
                        {trustVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                        <span className="ml-1">ตรวจสอบ</span>
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">หากยังไม่มี DID ระบบจะสร้างให้อัตโนมัติหลังอนุมัติ</p>
                    {trustResult && (
                      <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
                        trustResult.verified ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"
                      }`}>
                        {trustResult.verified ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <Shield className="h-4 w-4 shrink-0" />}
                        {trustResult.message}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Preferred Integration Protocol</Label>
                    <Select value={formData.preferredProtocol} onValueChange={(v) => updateField("preferredProtocol", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fhir_rest">FHIR R4 REST API</SelectItem>
                        <SelectItem value="hl7v2">HL7 v2.x MLLP</SelectItem>
                        <SelectItem value="shl">Smart Health Links (SHL)</SelectItem>
                        <SelectItem value="manual">Manual Exchange (Email/Portal)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Separator />
                  <div className="space-y-3">
                    <Label>Supported Credential Types *</Label>
                    <p className="text-xs text-muted-foreground">เลือก credential ที่โรงพยาบาลพันธมิตรสามารถออกหรือรับได้</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {credentialTypes.map((ct) => (
                        <div
                          key={ct.id}
                          onClick={() => toggleCredential(ct.id)}
                          className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                            formData.supportedCredentials.includes(ct.id)
                              ? "border-primary bg-primary/5"
                              : "border-muted hover:border-primary/50"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`h-4 w-4 rounded border flex items-center justify-center ${
                              formData.supportedCredentials.includes(ct.id) ? "bg-primary border-primary" : "border-muted-foreground"
                            }`}>
                              {formData.supportedCredentials.includes(ct.id) && <Check className="h-3 w-3 text-white" />}
                            </div>
                            <span className="text-sm">{ct.label}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 4 && (
              <div className="space-y-5">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <FileCheck2 className="h-5 w-5" />เอกสารรับรอง
                </h2>
                <p className="text-sm text-muted-foreground">
                  อัปโหลดเอกสารที่จำเป็นสำหรับการตรวจสอบและอนุมัติ (ไม่บังคับ สามารถส่งภายหลังได้)
                </p>

                {/* Drop zone */}
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="p-8 rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 transition-colors cursor-pointer text-center"
                >
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">ลากไฟล์มาวาง หรือคลิกเพื่อเลือก</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    รองรับ: PDF, Word, รูปภาพ (สูงสุด 10MB ต่อไฟล์)
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    เอกสารแนะนำ: Accreditation Certificate, MOU, DPA
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e.target.files)}
                />

                {/* Upload progress */}
                {uploading && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      กำลังอัปโหลด...
                    </div>
                    <Progress value={uploadProgress} className="h-2" />
                  </div>
                )}

                {/* Uploaded files list */}
                {uploadedDocs.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm">เอกสารที่อัปโหลดแล้ว ({uploadedDocs.length})</Label>
                    {uploadedDocs.map((doc, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-blue-500" />
                          <div>
                            <p className="text-sm font-medium">{doc.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {(doc.size / 1024).toFixed(1)} KB — {doc.category === "accreditation" ? "Accreditation" : doc.category === "mou" ? "MOU" : doc.category === "dpa" ? "DPA" : "อื่นๆ"}
                            </p>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => removeDoc(idx)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <Separator />
                <div className="space-y-2">
                  <Label>หมายเหตุเพิ่มเติม</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => updateField("notes", e.target.value)}
                    placeholder="ข้อมูลเพิ่มเติมที่ต้องการแจ้ง เช่น ระบบ HIS ที่ใช้, ภาษาที่รองรับ, timezone"
                    rows={3}
                  />
                </div>
              </div>
            )}

            {currentStep === 5 && (
              <div className="space-y-5">
                <div className="text-center py-4">
                  <div className="h-16 w-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                  </div>
                  <h2 className="text-lg font-semibold">ยืนยันข้อมูลและส่งคำขอ</h2>
                  <p className="text-sm text-muted-foreground mt-1">ตรวจสอบข้อมูลด้านล่างก่อนส่งคำขอลงทะเบียน</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">โรงพยาบาล</CardTitle></CardHeader>
                    <CardContent className="text-sm space-y-1">
                      <p><span className="text-muted-foreground">ชื่อ:</span> {formData.hospitalName || "-"}</p>
                      <p><span className="text-muted-foreground">EN:</span> {formData.hospitalNameEn || "-"}</p>
                      <p><span className="text-muted-foreground">ประเทศ:</span> {countries.find(c => c.code === formData.country)?.name || "-"}</p>
                      <p><span className="text-muted-foreground">ประเภท:</span> {formData.hospitalType || "-"}</p>
                      <p><span className="text-muted-foreground">Accreditation:</span> {formData.accreditation || "-"}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">ผู้ติดต่อ</CardTitle></CardHeader>
                    <CardContent className="text-sm space-y-1">
                      <p><span className="text-muted-foreground">ชื่อ:</span> {formData.contactName || "-"}</p>
                      <p><span className="text-muted-foreground">อีเมล:</span> {formData.contactEmail || "-"}</p>
                      <p><span className="text-muted-foreground">โทร:</span> {formData.contactPhone || "-"}</p>
                      <p><span className="text-muted-foreground">Technical:</span> {formData.technicalContactEmail || "-"}</p>
                    </CardContent>
                  </Card>
                  <Card className="md:col-span-2">
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Trust & Integration</CardTitle></CardHeader>
                    <CardContent className="text-sm space-y-2">
                      <p><span className="text-muted-foreground">DID:</span> <code className="text-xs">{formData.did || "(จะสร้างอัตโนมัติ)"}</code></p>
                      <p><span className="text-muted-foreground">Protocol:</span> {formData.preferredProtocol}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {formData.supportedCredentials.map((c) => (
                          <Badge key={c} variant="secondary" className="text-xs">{credentialTypes.find(ct => ct.id === c)?.label || c}</Badge>
                        ))}
                      </div>
                      {uploadedDocs.length > 0 && (
                        <div className="mt-2 pt-2 border-t">
                          <p className="text-muted-foreground">เอกสารแนบ: {uploadedDocs.length} ไฟล์</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {uploadedDocs.map((d, i) => (
                              <Badge key={i} variant="outline" className="text-xs">{d.name}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => setCurrentStep((s) => Math.max(1, s - 1) as WizardStep)}
            disabled={currentStep === 1}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />ย้อนกลับ
          </Button>

          {currentStep < 5 ? (
            <Button
              onClick={() => setCurrentStep((s) => Math.min(5, s + 1) as WizardStep)}
              disabled={!canProceed()}
              className="gap-2"
            >
              ถัดไป<ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={registerMutation.isPending}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              {registerMutation.isPending ? "กำลังส่ง..." : "ส่งคำขอลงทะเบียน"}
              <CheckCircle2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
