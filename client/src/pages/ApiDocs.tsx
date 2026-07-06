import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Globe,
  Lock,
  Key,
  FileText,
  Shield,
  Link2,
  Send,
  Copy,
  Check,
  ChevronRight,
  Moon,
  Sun,
  ArrowLeft,
} from "lucide-react";

// ============================================================
// Types
// ============================================================
interface ApiEndpoint {
  id: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  title: string;
  description: string;
  category: string;
  auth: "none" | "api_key" | "bearer";
  scope?: string;
  requestBody?: Record<string, any>;
  responseExample: Record<string, any>;
  parameters?: { name: string; in: "path" | "query" | "header"; required: boolean; type: string; description: string }[];
}

// ============================================================
// API Endpoint Data
// ============================================================
const API_ENDPOINTS: ApiEndpoint[] = [
  {
    id: "info",
    method: "GET",
    path: "/api/v1/info",
    title: "API Information",
    description: "Get API version, capabilities, and supported scopes. No authentication required.",
    category: "General",
    auth: "none",
    responseExample: {
      name: "Trustcare Hospital Network - External Wallet API",
      version: "1.0.0",
      status: "active",
      capabilities: ["credential_exchange", "shl_resolution", "identity_binding", "contract_discovery", "document_exchange"],
      supportedScopes: ["contracts:read", "credentials:present", "credentials:request", "credentials:read", "shl:resolve", "identity:link", "identity:read", "documents:read", "documents:write"],
      authentication: { method: "API Key + Bearer Token", flow: "1. Register app → 2. Get API key → 3. POST /wallet/authenticate → 4. Use Bearer token" },
    },
  },
  {
    id: "authenticate",
    method: "POST",
    path: "/api/v1/wallet/authenticate",
    title: "Authenticate Wallet",
    description: "Exchange API key for a short-lived bearer token. The bearer token is used for all subsequent API calls.",
    category: "Authentication",
    auth: "api_key",
    requestBody: {
      walletDid: "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK",
      scopes: ["contracts:read", "credentials:present", "shl:resolve"],
      sessionDuration: 3600,
    },
    responseExample: {
      sessionToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      expiresAt: "2026-07-06T07:00:00.000Z",
      grantedScopes: ["contracts:read", "credentials:present", "shl:resolve"],
      appId: "app_trustcare_abc123",
    },
  },
  {
    id: "list-contracts",
    method: "GET",
    path: "/api/v1/contracts",
    title: "List Contracts",
    description: "List all available service readiness contracts that external wallets can interact with.",
    category: "Contracts",
    auth: "bearer",
    scope: "contracts:read",
    parameters: [
      { name: "status", in: "query", required: false, type: "string", description: "Filter by status (active, draft, archived)" },
      { name: "limit", in: "query", required: false, type: "number", description: "Max results (default: 50)" },
    ],
    responseExample: {
      contracts: [
        {
          id: 1,
          name: "OPD Walk-in Service Contract",
          version: "2.0",
          status: "active",
          serviceType: "outpatient",
          requiredDocuments: ["patient_identity", "insurance_coverage"],
          createdAt: "2026-06-15T08:00:00.000Z",
        },
      ],
      total: 12,
    },
  },
  {
    id: "get-contract",
    method: "GET",
    path: "/api/v1/contracts/:contractId",
    title: "Get Contract Details",
    description: "Get full contract details including required document schemas, bundle templates, and validation rules.",
    category: "Contracts",
    auth: "bearer",
    scope: "contracts:read",
    parameters: [
      { name: "contractId", in: "path", required: true, type: "string", description: "Contract ID" },
    ],
    responseExample: {
      id: 1,
      name: "OPD Walk-in Service Contract",
      version: "2.0",
      status: "active",
      serviceType: "outpatient",
      requiredDocuments: ["patient_identity", "insurance_coverage"],
      bundleTemplate: { format: "fhir-bundle", profile: "TrustcareServiceBundle" },
      validationRules: { requireSignedVC: true, maxAgeMinutes: 60 },
    },
  },
  {
    id: "present-credential",
    method: "POST",
    path: "/api/v1/credentials/present",
    title: "Present Credential (VP)",
    description: "Present a Verifiable Presentation (VP) containing one or more VCs to the system for verification.",
    category: "Credentials",
    auth: "bearer",
    scope: "credentials:present",
    requestBody: {
      presentationJwt: "eyJhbGciOiJFUzI1NiIsInR5cCI6InZwK0pXVCJ9...",
      purpose: "hospital_intake",
      contractId: 1,
    },
    responseExample: {
      verified: true,
      trustLevel: "green",
      presentationId: "urn:uuid:abc123-def456",
      credentials: [{ type: "PatientIdentityCredential", issuer: "TrustCare Central Hospital", verified: true }],
      checklist: { issuerTrusted: true, holderBinding: true, schemaValid: true, statusActive: true, consentPresent: true },
    },
  },
  {
    id: "request-credential",
    method: "POST",
    path: "/api/v1/credentials/request",
    title: "Request Credential",
    description: "Request a new credential to be issued to the external wallet. Requires prior identity binding.",
    category: "Credentials",
    auth: "bearer",
    scope: "credentials:request",
    requestBody: {
      credentialType: "patient_summary",
      patientId: "P001",
      purpose: "continuity_of_care",
      requestedFields: ["demographics", "allergies", "medications"],
    },
    responseExample: {
      requestId: "req_abc123",
      status: "pending",
      estimatedReady: "2026-07-06T06:05:00.000Z",
      message: "Credential request submitted. Check status endpoint for updates.",
    },
  },
  {
    id: "credential-status",
    method: "GET",
    path: "/api/v1/credentials/status/:credentialId",
    title: "Check Credential Status",
    description: "Check the current status of a credential (active, revoked, expired, pending).",
    category: "Credentials",
    auth: "bearer",
    scope: "credentials:read",
    parameters: [
      { name: "credentialId", in: "path", required: true, type: "string", description: "Credential ID or request ID" },
    ],
    responseExample: {
      credentialId: "urn:trustcare:vc:tcc:p001:patient_identity",
      status: "active",
      issuedAt: "2026-07-01T08:00:00.000Z",
      expiresAt: "2027-07-01T08:00:00.000Z",
      issuer: "did:web:trustcare.network",
      type: "PatientIdentityCredential",
    },
  },
  {
    id: "shl-resolve",
    method: "POST",
    path: "/api/v1/shl/resolve",
    title: "Resolve SHL",
    description: "Resolve a SMART Health Link URL to get the manifest and available files.",
    category: "SHL",
    auth: "bearer",
    scope: "shl:resolve",
    requestBody: {
      shlUrl: "shlink:/eyJsYWJlbCI6IlBhdGllbnQgU3VtbWFyeSIsInVybCI6Imh0dHBzOi8v...",
      passcode: "1234",
    },
    responseExample: {
      manifest: {
        label: "Patient Summary - นายสมชาย ใจดี",
        files: [
          { contentType: "application/fhir+json", location: "https://trustcarehealth.live/api/shl/files/abc123" },
        ],
      },
      accessToken: "shl_access_xyz789",
      expiresAt: "2026-07-06T07:00:00.000Z",
    },
  },
  {
    id: "shl-access",
    method: "POST",
    path: "/api/v1/shl/access",
    title: "Access SHL Files",
    description: "Access files from a resolved SHL manifest using the access token.",
    category: "SHL",
    auth: "bearer",
    scope: "shl:resolve",
    requestBody: {
      shlId: "60043",
      passcode: "1234",
      recipient: "External Wallet App",
    },
    responseExample: {
      files: [
        {
          contentType: "application/fhir+json",
          content: { resourceType: "Bundle", type: "document", entry: [] },
        },
      ],
      accessedAt: "2026-07-06T06:00:00.000Z",
    },
  },
  {
    id: "identity-link",
    method: "POST",
    path: "/api/v1/identity/link",
    title: "Link Identity",
    description: "Link an external wallet DID to a patient identity in the system. Requires patient verification.",
    category: "Identity",
    auth: "bearer",
    scope: "identity:link",
    requestBody: {
      walletDid: "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK",
      patientId: "P001",
      verificationMethod: "national_id",
      verificationData: { nationalId: "1-1234-56789-01-2", dateOfBirth: "1990-05-15" },
    },
    responseExample: {
      linked: true,
      linkId: "link_abc123",
      patientId: "P001",
      walletDid: "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK",
      linkedAt: "2026-07-06T06:00:00.000Z",
    },
  },
  {
    id: "identity-verify",
    method: "GET",
    path: "/api/v1/identity/verify",
    title: "Verify Identity Binding",
    description: "Verify that a DID is properly linked to a patient identity.",
    category: "Identity",
    auth: "bearer",
    scope: "identity:read",
    parameters: [
      { name: "did", in: "query", required: true, type: "string", description: "DID to verify" },
    ],
    responseExample: {
      verified: true,
      patientId: "P001",
      walletDid: "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK",
      linkedAt: "2026-07-06T06:00:00.000Z",
      presentationCount: 5,
    },
  },
  {
    id: "documents-submit",
    method: "POST",
    path: "/api/v1/documents/submit",
    title: "Submit Documents",
    description: "Submit documents (FHIR bundles, signed VCs) to the system from an external wallet.",
    category: "Documents",
    auth: "bearer",
    scope: "documents:write",
    requestBody: {
      patientId: "P001",
      documentType: "patient_summary",
      format: "fhir-bundle",
      content: { resourceType: "Bundle", type: "document", entry: [] },
      metadata: { source: "external_wallet", version: "1.0" },
    },
    responseExample: {
      accepted: true,
      documentId: "doc_abc123",
      status: "processing",
      message: "Document accepted for processing.",
    },
  },
  {
    id: "documents-available",
    method: "GET",
    path: "/api/v1/documents/available",
    title: "List Available Documents",
    description: "List documents available for a patient that can be retrieved by the external wallet.",
    category: "Documents",
    auth: "bearer",
    scope: "documents:read",
    parameters: [
      { name: "patientId", in: "query", required: true, type: "string", description: "Patient ID" },
      { name: "type", in: "query", required: false, type: "string", description: "Filter by document type" },
    ],
    responseExample: {
      documents: [
        { id: "doc_001", type: "patient_summary", title: "Patient Summary", issuedAt: "2026-07-01T08:00:00.000Z", format: "fhir-bundle" },
        { id: "doc_002", type: "prescription", title: "Prescription - July 2026", issuedAt: "2026-07-05T10:00:00.000Z", format: "jwt-vc" },
      ],
      total: 2,
    },
  },
];

const CATEGORIES = ["General", "Authentication", "Contracts", "Credentials", "SHL", "Identity", "Documents"];

const CATEGORY_ICONS: Record<string, any> = {
  General: Globe,
  Authentication: Key,
  Contracts: FileText,
  Credentials: Shield,
  SHL: Link2,
  Identity: Lock,
  Documents: Send,
};

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  POST: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  PUT: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  DELETE: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

// ============================================================
// Code Example Generators
// ============================================================
function generateCurl(endpoint: ApiEndpoint, baseUrl: string): string {
  let cmd = `curl -X ${endpoint.method} "${baseUrl}${endpoint.path}"`;
  if (endpoint.auth === "api_key") {
    cmd += ` \\\n  -H "X-API-Key: YOUR_API_KEY"`;
  } else if (endpoint.auth === "bearer") {
    cmd += ` \\\n  -H "Authorization: Bearer YOUR_TOKEN"`;
  }
  if (endpoint.requestBody) {
    cmd += ` \\\n  -H "Content-Type: application/json"`;
    cmd += ` \\\n  -d '${JSON.stringify(endpoint.requestBody, null, 2)}'`;
  }
  return cmd;
}

function generateJavaScript(endpoint: ApiEndpoint, baseUrl: string): string {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (endpoint.auth === "api_key") headers["X-API-Key"] = "YOUR_API_KEY";
  else if (endpoint.auth === "bearer") headers["Authorization"] = "Bearer YOUR_TOKEN";

  let code = `const response = await fetch("${baseUrl}${endpoint.path}", {\n`;
  code += `  method: "${endpoint.method}",\n`;
  code += `  headers: ${JSON.stringify(headers, null, 4)},\n`;
  if (endpoint.requestBody) {
    code += `  body: JSON.stringify(${JSON.stringify(endpoint.requestBody, null, 4)}),\n`;
  }
  code += `});\n\nconst data = await response.json();\nconsole.log(data);`;
  return code;
}

function generatePython(endpoint: ApiEndpoint, baseUrl: string): string {
  let code = `import requests\n\n`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (endpoint.auth === "api_key") headers["X-API-Key"] = "YOUR_API_KEY";
  else if (endpoint.auth === "bearer") headers["Authorization"] = "Bearer YOUR_TOKEN";

  code += `headers = ${JSON.stringify(headers, null, 4)}\n\n`;
  if (endpoint.requestBody) {
    code += `payload = ${JSON.stringify(endpoint.requestBody, null, 4)}\n\n`;
    code += `response = requests.${endpoint.method.toLowerCase()}(\n    "${baseUrl}${endpoint.path}",\n    headers=headers,\n    json=payload\n)\n`;
  } else {
    code += `response = requests.${endpoint.method.toLowerCase()}(\n    "${baseUrl}${endpoint.path}",\n    headers=headers\n)\n`;
  }
  code += `\nprint(response.json())`;
  return code;
}

// ============================================================
// Components
// ============================================================
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 px-2 text-xs">
      {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  return (
    <div className="relative">
      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-800 dark:bg-zinc-900 rounded-t-md border-b border-zinc-700">
        <span className="text-xs text-zinc-400 font-mono">{language}</span>
        <CopyButton text={code} />
      </div>
      <pre className="p-4 bg-zinc-900 dark:bg-zinc-950 rounded-b-md overflow-x-auto text-sm">
        <code className="text-zinc-100 font-mono whitespace-pre">{code}</code>
      </pre>
    </div>
  );
}

function EndpointDetail({ endpoint, baseUrl }: { endpoint: ApiEndpoint; baseUrl: string }) {
  const [codeTab, setCodeTab] = useState("curl");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <Badge className={`${METHOD_COLORS[endpoint.method]} font-mono text-xs px-2 py-0.5`}>
            {endpoint.method}
          </Badge>
          <code className="text-sm font-mono text-foreground/80">{endpoint.path}</code>
        </div>
        <h2 className="text-xl font-semibold">{endpoint.title}</h2>
        <p className="text-muted-foreground mt-1">{endpoint.description}</p>
      </div>

      {/* Auth & Scope */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Auth:</span>
          <Badge variant="outline" className="text-xs">
            {endpoint.auth === "none" ? "None" : endpoint.auth === "api_key" ? "API Key" : "Bearer Token"}
          </Badge>
        </div>
        {endpoint.scope && (
          <div className="flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Scope:</span>
            <Badge variant="outline" className="text-xs font-mono">{endpoint.scope}</Badge>
          </div>
        )}
      </div>

      <Separator />

      {/* Parameters */}
      {endpoint.parameters && endpoint.parameters.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3">Parameters</h3>
          <div className="border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Name</th>
                  <th className="text-left px-3 py-2 font-medium">In</th>
                  <th className="text-left px-3 py-2 font-medium">Type</th>
                  <th className="text-left px-3 py-2 font-medium">Required</th>
                  <th className="text-left px-3 py-2 font-medium">Description</th>
                </tr>
              </thead>
              <tbody>
                {endpoint.parameters.map((param) => (
                  <tr key={param.name} className="border-t">
                    <td className="px-3 py-2 font-mono text-xs">{param.name}</td>
                    <td className="px-3 py-2"><Badge variant="outline" className="text-xs">{param.in}</Badge></td>
                    <td className="px-3 py-2 text-muted-foreground">{param.type}</td>
                    <td className="px-3 py-2">{param.required ? <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 text-xs">Required</Badge> : <span className="text-muted-foreground text-xs">Optional</span>}</td>
                    <td className="px-3 py-2 text-muted-foreground">{param.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Request Body */}
      {endpoint.requestBody && (
        <div>
          <h3 className="text-sm font-semibold mb-3">Request Body</h3>
          <CodeBlock code={JSON.stringify(endpoint.requestBody, null, 2)} language="json" />
        </div>
      )}

      {/* Response Example */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Response Example</h3>
        <CodeBlock code={JSON.stringify(endpoint.responseExample, null, 2)} language="json" />
      </div>

      <Separator />

      {/* Code Examples */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Code Examples</h3>
        <Tabs value={codeTab} onValueChange={setCodeTab}>
          <TabsList className="mb-3">
            <TabsTrigger value="curl">cURL</TabsTrigger>
            <TabsTrigger value="javascript">JavaScript</TabsTrigger>
            <TabsTrigger value="python">Python</TabsTrigger>
          </TabsList>
          <TabsContent value="curl">
            <CodeBlock code={generateCurl(endpoint, baseUrl)} language="bash" />
          </TabsContent>
          <TabsContent value="javascript">
            <CodeBlock code={generateJavaScript(endpoint, baseUrl)} language="javascript" />
          </TabsContent>
          <TabsContent value="python">
            <CodeBlock code={generatePython(endpoint, baseUrl)} language="python" />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ============================================================
// Main Page Component
// ============================================================
export default function ApiDocs() {
  const [selectedEndpoint, setSelectedEndpoint] = useState<string>("info");
  const [darkMode, setDarkMode] = useState(() => document.documentElement.classList.contains("dark"));
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://trustcarehealth.live";

  const currentEndpoint = useMemo(
    () => API_ENDPOINTS.find((e) => e.id === selectedEndpoint) ?? API_ENDPOINTS[0],
    [selectedEndpoint]
  );

  const toggleDarkMode = () => {
    document.documentElement.classList.toggle("dark");
    setDarkMode(!darkMode);
  };

  const groupedEndpoints = useMemo(() => {
    const groups: Record<string, ApiEndpoint[]> = {};
    for (const cat of CATEGORIES) {
      groups[cat] = API_ENDPOINTS.filter((e) => e.category === cat);
    }
    return groups;
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Sidebar */}
      {sidebarOpen && (
        <aside className="w-72 border-r bg-muted/30 flex flex-col shrink-0">
          <div className="p-4 border-b">
            <div className="flex items-center gap-2 mb-1">
              <a href="/" className="text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="h-4 w-4" />
              </a>
              <h1 className="font-bold text-lg">API Reference</h1>
            </div>
            <p className="text-xs text-muted-foreground">External Wallet Integration v1.0</p>
          </div>
          <ScrollArea className="flex-1 p-3">
            <div className="space-y-4">
              {CATEGORIES.map((category) => {
                const endpoints = groupedEndpoints[category];
                if (!endpoints || endpoints.length === 0) return null;
                const Icon = CATEGORY_ICONS[category] || Globe;
                return (
                  <div key={category}>
                    <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <Icon className="h-3.5 w-3.5" />
                      {category}
                    </div>
                    <div className="space-y-0.5 mt-1">
                      {endpoints.map((endpoint) => (
                        <button
                          key={endpoint.id}
                          onClick={() => setSelectedEndpoint(endpoint.id)}
                          className={`w-full text-left px-2 py-1.5 rounded-md text-sm flex items-center gap-2 transition-colors ${
                            selectedEndpoint === endpoint.id
                              ? "bg-primary/10 text-primary font-medium"
                              : "hover:bg-muted text-foreground/70"
                          }`}
                        >
                          <Badge className={`${METHOD_COLORS[endpoint.method]} text-[10px] px-1.5 py-0 font-mono shrink-0`}>
                            {endpoint.method}
                          </Badge>
                          <span className="truncate">{endpoint.title}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
          <div className="p-3 border-t">
            <div className="text-xs text-muted-foreground">
              Base URL: <code className="text-foreground/80">{baseUrl}</code>
            </div>
          </div>
        </aside>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-14 border-b flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <ChevronRight className={`h-4 w-4 transition-transform ${sidebarOpen ? "rotate-180" : ""}`} />
            </Button>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{currentEndpoint.category}</span>
              <ChevronRight className="h-3 w-3" />
              <span className="text-foreground font-medium">{currentEndpoint.title}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={toggleDarkMode}>
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </header>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="max-w-4xl mx-auto p-8">
            {/* Getting Started Banner */}
            {selectedEndpoint === "info" && (
              <Card className="mb-8 border-primary/20 bg-primary/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Getting Started</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-3">
                  <p className="text-muted-foreground">
                    To integrate your external wallet with Trustcare Hospital Network, follow these steps:
                  </p>
                  <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                    <li><strong className="text-foreground">Register your app</strong> — Contact the system administrator to register your wallet application and receive an API key.</li>
                    <li><strong className="text-foreground">Authenticate</strong> — Use <code className="bg-muted px-1 rounded">POST /api/v1/wallet/authenticate</code> to exchange your API key for a bearer token.</li>
                    <li><strong className="text-foreground">Discover contracts</strong> — Use <code className="bg-muted px-1 rounded">GET /api/v1/contracts</code> to find available service contracts.</li>
                    <li><strong className="text-foreground">Exchange credentials</strong> — Present VPs, request VCs, or resolve SHL links using the appropriate endpoints.</li>
                  </ol>
                  <div className="pt-2">
                    <Badge variant="outline" className="text-xs">Rate Limit: 100 req/min (default)</Badge>
                    <Badge variant="outline" className="text-xs ml-2">Token TTL: 1 hour</Badge>
                    <Badge variant="outline" className="text-xs ml-2">Format: JSON</Badge>
                  </div>
                </CardContent>
              </Card>
            )}

            <EndpointDetail endpoint={currentEndpoint} baseUrl={baseUrl} />
          </div>
        </ScrollArea>
      </main>
    </div>
  );
}
