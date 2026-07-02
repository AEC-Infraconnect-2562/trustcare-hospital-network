import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft, ArrowRight, Building2, Check, CheckCircle2, FileCheck2,
  Globe, Key, Mail, MapPin, Shield, Upload, Users,
} from "lucide-react";
import { useState } from "react";
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

export default function PartnerWizard() {
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [formData, setFormData] = useState({
    // Step 1: Hospital Info
    hospitalName: "",
    hospitalNameEn: "",
    country: "",
    jurisdiction: "",
    hospitalType: "",
    bedCount: "",
    accreditation: "",
    // Step 2: Contact
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    contactUrl: "",
    technicalContactName: "",
    technicalContactEmail: "",
    // Step 3: Trust
    did: "",
    publicKeyJwk: "",
    supportedCredentials: [] as string[],
    preferredProtocol: "fhir_rest",
    // Step 4: Documents
    accreditationDoc: "",
    mou: "",
    dataProcessingAgreement: "",
    notes: "",
  });

  const registerMutation = trpc.trustRegistry.create.useMutation({
    onSuccess: () => {
      toast.success("ส่งคำขอลงทะเบียนพันธมิตรสำเร็จ! กรุณารอการตรวจสอบ");
      setCurrentStep(5);
    },
    onError: (e: any) => toast.error(e.message),
  });

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
      },
    });
  };

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
                    <Input value={formData.did} onChange={(e) => updateField("did", e.target.value)} placeholder="did:web:hospital.sg" className="font-mono text-sm" />
                    <p className="text-xs text-muted-foreground">หากยังไม่มี DID ระบบจะสร้างให้อัตโนมัติหลังอนุมัติ</p>
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
                <div className="space-y-4">
                  <div className="p-4 rounded-lg border border-dashed flex items-center gap-3 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => toast.info("อัปโหลดเอกสาร (Feature coming soon)")}>
                    <Upload className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Accreditation Certificate</p>
                      <p className="text-xs text-muted-foreground">JCI, ISO, NABH certificate (PDF)</p>
                    </div>
                  </div>
                  <div className="p-4 rounded-lg border border-dashed flex items-center gap-3 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => toast.info("อัปโหลดเอกสาร (Feature coming soon)")}>
                    <Upload className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">MOU / Partnership Agreement</p>
                      <p className="text-xs text-muted-foreground">บันทึกข้อตกลงความร่วมมือ (PDF)</p>
                    </div>
                  </div>
                  <div className="p-4 rounded-lg border border-dashed flex items-center gap-3 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => toast.info("อัปโหลดเอกสาร (Feature coming soon)")}>
                    <Upload className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Data Processing Agreement (DPA)</p>
                      <p className="text-xs text-muted-foreground">ข้อตกลงประมวลผลข้อมูล PDPA/GDPR (PDF)</p>
                    </div>
                  </div>
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
