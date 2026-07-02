import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  BookOpen, Code2, Copy, Database, Download, ExternalLink, FileJson2,
  GitBranch, Plug, Server, Shield, Terminal, Zap,
} from "lucide-react";
import { toast } from "sonner";

const sdkVersions = [
  { version: "1.2.0", date: "2024-12-15", notes: "Added CDC connector, improved error handling" },
  { version: "1.1.0", date: "2024-10-01", notes: "HL7v2 MLLP support, batch file processing" },
  { version: "1.0.0", date: "2024-07-01", notes: "Initial release: REST, FHIR R4, Legacy DB" },
];

const connectorTypes = [
  { id: "fhir_rest", name: "FHIR R4 REST", icon: FileJson2, desc: "เชื่อมต่อ HIS ที่รองรับ FHIR R4 REST API โดยตรง", status: "stable" },
  { id: "hl7v2", name: "HL7 v2.x MLLP", icon: Zap, desc: "รับ/ส่ง HL7v2 messages ผ่าน MLLP protocol (ADT, ORM, ORU)", status: "stable" },
  { id: "legacy_db", name: "Legacy Database", icon: Database, desc: "อ่านข้อมูลจาก SQL database (MySQL, PostgreSQL, MSSQL, Oracle)", status: "stable" },
  { id: "cdc", name: "Change Data Capture", icon: GitBranch, desc: "ดักจับ real-time changes จาก database binlog/WAL", status: "beta" },
  { id: "batch_file", name: "Batch File (CSV/SFTP)", icon: Server, desc: "นำเข้าข้อมูลจากไฟล์ CSV/Excel ผ่าน SFTP scheduled job", status: "stable" },
];

const codeExamples = {
  fhir: `// adapter.config.ts - FHIR R4 REST Adapter
import { createAdapter } from "@trustcare/adapter-sdk";

export default createAdapter({
  name: "siriraj-his-fhir",
  type: "fhir_rest",
  config: {
    baseUrl: "https://his.siriraj.ac.th/fhir/r4",
    auth: { type: "oauth2", clientId: "...", clientSecret: "..." },
    resources: ["Patient", "AllergyIntolerance", "MedicationStatement", "Condition"],
    syncInterval: "5m",
    batchSize: 100,
  },
  transforms: {
    Patient: (resource) => ({
      hn: resource.identifier?.find(i => i.system === "urn:oid:2.16.764.1.4.100.1")?.value,
      name: resource.name?.[0]?.text,
      birthDate: resource.birthDate,
      gender: resource.gender,
    }),
  },
  hooks: {
    onSync: async (batch) => console.log(\`Synced \${batch.length} resources\`),
    onError: async (err) => notifyOwner({ title: "Adapter Error", content: err.message }),
  },
});`,
  hl7v2: `// adapter.config.ts - HL7 v2.x MLLP Adapter
import { createAdapter } from "@trustcare/adapter-sdk";

export default createAdapter({
  name: "ramathibodi-adt",
  type: "hl7v2",
  config: {
    listenPort: 2575,
    messageTypes: ["ADT^A01", "ADT^A08", "ORM^O01", "ORU^R01"],
    encoding: "UTF-8",
    ack: true,
  },
  transforms: {
    "ADT^A01": (msg) => ({
      event: "patient_admit",
      hn: msg.PID[3][1],
      name: \`\${msg.PID[5][1]} \${msg.PID[5][2]}\`,
      ward: msg.PV1[3][1],
      admitDate: msg.PV1[44],
    }),
    "ORU^R01": (msg) => ({
      event: "lab_result",
      hn: msg.PID[3][1],
      testCode: msg.OBX[3][1],
      value: msg.OBX[5],
      unit: msg.OBX[6][1],
      status: msg.OBX[11],
    }),
  },
});`,
  legacyDb: `// adapter.config.ts - Legacy Database Adapter
import { createAdapter } from "@trustcare/adapter-sdk";

export default createAdapter({
  name: "bumrungrad-legacy",
  type: "legacy_db",
  config: {
    driver: "mssql",
    host: "10.0.1.50",
    port: 1433,
    database: "HIS_PROD",
    user: "trustcare_reader",
    password: process.env.DB_PASSWORD,
    pollInterval: "10m",
    queries: {
      patients: "SELECT HN, Name, DOB, Gender FROM dbo.Patients WHERE ModifiedDate > @lastSync",
      allergies: "SELECT HN, AllergenCode, Severity, OnsetDate FROM dbo.Allergies WHERE ModifiedDate > @lastSync",
      medications: "SELECT HN, DrugCode, DosageText, StartDate, EndDate FROM dbo.Medications WHERE Active = 1 AND ModifiedDate > @lastSync",
    },
  },
  transforms: {
    patients: (row) => ({
      hn: row.HN,
      name: row.Name,
      birthDate: row.DOB,
      gender: row.Gender === "M" ? "male" : "female",
    }),
  },
});`,
};

function copyCode(code: string) {
  navigator.clipboard.writeText(code);
  toast.success("คัดลอก code สำเร็จ");
}

export default function AdapterSdk() {
  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Hero Section */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Code2 className="h-5 w-5 text-primary" />
              </div>
              Integration Adapter SDK
            </h1>
            <p className="text-muted-foreground mt-2 max-w-2xl">
              SDK สำหรับสร้าง adapter เชื่อมต่อ HIS/EMR/LIS ของโรงพยาบาลเข้ากับ Trustcare Network
              รองรับ FHIR R4, HL7v2, Legacy DB, CDC, และ Batch File
            </p>
          </div>
          <Button className="gap-2" onClick={() => toast.success("ดาวน์โหลด SDK template สำเร็จ (adapter-sdk-template.zip)")}>
            <Download className="h-4 w-4" />ดาวน์โหลด SDK
          </Button>
        </div>

        {/* Quick Start */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Terminal className="h-4 w-4" />Quick Start
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted rounded-lg p-4 font-mono text-sm space-y-1">
              <p className="text-muted-foreground"># Install SDK</p>
              <p>npm install @trustcare/adapter-sdk</p>
              <p className="text-muted-foreground mt-3"># Create new adapter project</p>
              <p>npx @trustcare/adapter-sdk init my-hospital-adapter</p>
              <p className="text-muted-foreground mt-3"># Configure and test</p>
              <p>cd my-hospital-adapter</p>
              <p>cp .env.example .env  # fill in HIS credentials</p>
              <p>npm run test:connection</p>
              <p className="text-muted-foreground mt-3"># Register with Trustcare Network</p>
              <p>npm run register -- --network-url https://trustcare.manus.space/api</p>
            </div>
          </CardContent>
        </Card>

        {/* Connector Types */}
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Plug className="h-5 w-5" />Connector Types
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {connectorTypes.map((ct) => (
              <Card key={ct.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <ct.icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-sm">{ct.name}</h3>
                        <Badge variant={ct.status === "stable" ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                          {ct.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{ct.desc}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Code Examples */}
        <Tabs defaultValue="fhir">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <BookOpen className="h-5 w-5" />Code Examples
            </h2>
            <TabsList>
              <TabsTrigger value="fhir">FHIR R4</TabsTrigger>
              <TabsTrigger value="hl7v2">HL7 v2</TabsTrigger>
              <TabsTrigger value="legacyDb">Legacy DB</TabsTrigger>
            </TabsList>
          </div>

          {Object.entries(codeExamples).map(([key, code]) => (
            <TabsContent key={key} value={key}>
              <Card>
                <CardContent className="p-0 relative">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2 h-8 gap-1 text-xs"
                    onClick={() => copyCode(code)}
                  >
                    <Copy className="h-3 w-3" />คัดลอก
                  </Button>
                  <pre className="p-4 overflow-x-auto text-xs font-mono leading-relaxed bg-muted/50 rounded-lg">
                    <code>{code}</code>
                  </pre>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>

        {/* Architecture */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4" />Architecture & Security
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg border bg-card">
                <h4 className="font-medium text-sm mb-2">🔐 Authentication</h4>
                <p className="text-xs text-muted-foreground">
                  mTLS + OAuth2 client credentials สำหรับ adapter-to-network communication
                  ทุก request ถูก sign ด้วย adapter's private key
                </p>
              </div>
              <div className="p-4 rounded-lg border bg-card">
                <h4 className="font-medium text-sm mb-2">📊 Data Flow</h4>
                <p className="text-xs text-muted-foreground">
                  HIS → Adapter (transform) → FHIR R4 canonical → Trustcare Network → VC issuance
                  ข้อมูลถูก validate ตาม FHIR profile ก่อนเข้าระบบ
                </p>
              </div>
              <div className="p-4 rounded-lg border bg-card">
                <h4 className="font-medium text-sm mb-2">🔄 Sync Modes</h4>
                <p className="text-xs text-muted-foreground">
                  Pull (polling), Push (webhook/MLLP), CDC (binlog), Batch (SFTP/scheduled)
                  เลือกตามความสามารถของ HIS
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Version History */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <GitBranch className="h-4 w-4" />Version History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sdkVersions.map((v, i) => (
                <div key={v.version} className="flex items-start gap-3">
                  <Badge variant={i === 0 ? "default" : "secondary"} className="shrink-0 mt-0.5">
                    v{v.version}
                  </Badge>
                  <div>
                    <p className="text-sm">{v.notes}</p>
                    <p className="text-xs text-muted-foreground">{v.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Resources */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => toast.info("เปิด API Reference (Feature coming soon)")}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
                <FileJson2 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-medium text-sm">API Reference</h3>
                <p className="text-xs text-muted-foreground">เอกสาร API ทั้งหมดของ SDK</p>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground ml-auto" />
            </CardContent>
          </Card>
          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => toast.info("เปิด GitHub Repository (Feature coming soon)")}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-purple-50 flex items-center justify-center">
                <Code2 className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <h3 className="font-medium text-sm">GitHub Repository</h3>
                <p className="text-xs text-muted-foreground">Source code, examples, issues</p>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground ml-auto" />
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
