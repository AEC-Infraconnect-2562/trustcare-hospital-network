import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";

const AVAILABLE_SCOPES = [
  { id: "contracts:read", label: "Contracts Read", desc: "View service contracts" },
  { id: "credentials:read", label: "Credentials Read", desc: "View credential status" },
  { id: "credentials:present", label: "Credentials Present", desc: "Present VPs to system" },
  { id: "credentials:request", label: "Credentials Request", desc: "Request credentials" },
  { id: "shl:resolve", label: "SHL Resolve", desc: "Resolve SMART Health Links" },
  { id: "identity:link", label: "Identity Link", desc: "Link DID to patient" },
  { id: "identity:read", label: "Identity Read", desc: "Verify identity bindings" },
  { id: "documents:read", label: "Documents Read", desc: "List available documents" },
  { id: "documents:write", label: "Documents Write", desc: "Submit documents" },
];

const WALLET_TYPES = [
  { value: "personal_health", label: "Personal Health" },
  { value: "insurance", label: "Insurance" },
  { value: "government", label: "Government" },
  { value: "employer", label: "Employer" },
  { value: "pharmacy", label: "Pharmacy" },
  { value: "research", label: "Research" },
  { value: "other", label: "Other" },
];

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  pending_review: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  suspended: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  revoked: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

const TRUST_COLORS: Record<string, string> = {
  unverified: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  basic: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  verified: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  certified: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
};

export default function ContractHub() {
  const [activeTab, setActiveTab] = useState("apps");
  const [showRegister, setShowRegister] = useState(false);
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const [showKeyResult, setShowKeyResult] = useState<{ apiKey: string; keyId: string } | null>(null);

  const appsQuery = trpc.externalWallet.listApps.useQuery({});
  const auditQuery = trpc.externalWallet.auditLogs.useQuery({ limit: 50 });
  const utils = trpc.useUtils();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contract Hub</h1>
          <p className="text-muted-foreground mt-1">Manage external wallet application connections and API access</p>
        </div>
        <Button onClick={() => setShowRegister(true)}>
          + Register Wallet App
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="apps">Registered Apps</TabsTrigger>
          <TabsTrigger value="audit">Audit Logs</TabsTrigger>
          <TabsTrigger value="docs">API Documentation</TabsTrigger>
        </TabsList>

        <TabsContent value="apps" className="mt-4">
          <AppsList
            apps={appsQuery.data || []}
            isLoading={appsQuery.isLoading}
            onSelect={setSelectedApp}
          />
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <AuditLogViewer logs={auditQuery.data || []} isLoading={auditQuery.isLoading} />
        </TabsContent>

        <TabsContent value="docs" className="mt-4">
          <ApiDocumentation />
        </TabsContent>
      </Tabs>

      {showRegister && (
        <RegisterAppDialog
          open={showRegister}
          onClose={() => setShowRegister(false)}
          onSuccess={(result) => {
            setShowRegister(false);
            setShowKeyResult(result);
            utils.externalWallet.listApps.invalidate();
          }}
        />
      )}

      {selectedApp && (
        <AppDetailDialog
          appId={selectedApp}
          open={!!selectedApp}
          onClose={() => setSelectedApp(null)}
          onUpdate={() => utils.externalWallet.listApps.invalidate()}
        />
      )}

      {showKeyResult && (
        <Dialog open={!!showKeyResult} onOpenChange={() => setShowKeyResult(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>API Key Generated</DialogTitle>
              <DialogDescription>
                Copy this API key now. It will not be shown again.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">API Key</Label>
                <div className="font-mono text-sm bg-muted p-3 rounded break-all select-all">
                  {showKeyResult.apiKey}
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Key ID</Label>
                <div className="font-mono text-sm bg-muted p-2 rounded">{showKeyResult.keyId}</div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => { navigator.clipboard.writeText(showKeyResult.apiKey); toast.success("Copied!"); }}>
                Copy Key
              </Button>
              <Button variant="outline" onClick={() => setShowKeyResult(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────

function AppsList({ apps, isLoading, onSelect }: { apps: any[]; isLoading: boolean; onSelect: (id: string) => void }) {
  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
  if (apps.length === 0) return (
    <Card>
      <CardContent className="py-12 text-center">
        <p className="text-muted-foreground">No external wallet apps registered yet.</p>
        <p className="text-sm text-muted-foreground mt-1">Click "Register Wallet App" to get started.</p>
      </CardContent>
    </Card>
  );

  return (
    <div className="grid gap-4">
      {apps.map((app: any) => (
        <Card key={app.appId} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => onSelect(app.appId)}>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                  {app.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-semibold">{app.name}</h3>
                  <p className="text-sm text-muted-foreground">{app.organizationName}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={WALLET_TYPES.find(t => t.value === app.walletType)?.label ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300" : ""}>
                  {WALLET_TYPES.find(t => t.value === app.walletType)?.label || app.walletType}
                </Badge>
                <Badge className={STATUS_COLORS[app.status] || ""}>
                  {app.status}
                </Badge>
                <Badge className={TRUST_COLORS[app.trustLevel] || ""}>
                  {app.trustLevel}
                </Badge>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
              <span>Platform: {app.platformType}</span>
              <span>Rate: {app.rateLimitPerMinute}/min</span>
              <span>Scopes: {(app.scopes as string[])?.length || 0}</span>
              <span>Contact: {app.contactEmail}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function AppDetailDialog({ appId, open, onClose, onUpdate }: { appId: string; open: boolean; onClose: () => void; onUpdate: () => void }) {
  const appQuery = trpc.externalWallet.getApp.useQuery({ appId });
  const updateMut = trpc.externalWallet.updateApp.useMutation({ onSuccess: () => { appQuery.refetch(); onUpdate(); toast.success("Updated"); } });
  const revokeMut = trpc.externalWallet.revokeApp.useMutation({ onSuccess: () => { onUpdate(); onClose(); toast.success("App revoked"); } });
  const rotateMut = trpc.externalWallet.rotateKey.useMutation();
  const revokeKeyMut = trpc.externalWallet.revokeKey.useMutation({ onSuccess: () => { appQuery.refetch(); toast.success("Key revoked"); } });
  const [newKeyResult, setNewKeyResult] = useState<{ apiKey: string; keyId: string } | null>(null);

  const app = appQuery.data?.app;
  const keys = appQuery.data?.keys || [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{app?.name || "Loading..."}</DialogTitle>
          <DialogDescription>{app?.organizationName} • {app?.appId}</DialogDescription>
        </DialogHeader>

        {app && (
          <div className="space-y-4">
            {/* Status & Trust */}
            <div className="flex gap-2">
              <Badge className={STATUS_COLORS[app.status] || ""}>{app.status}</Badge>
              <Badge className={TRUST_COLORS[app.trustLevel] || ""}>{app.trustLevel}</Badge>
              <Badge variant="outline">{app.walletType}</Badge>
              <Badge variant="outline">{app.platformType}</Badge>
            </div>

            {/* Details */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">Email:</span> {app.contactEmail}</div>
              <div><span className="text-muted-foreground">Phone:</span> {app.contactPhone || "—"}</div>
              <div><span className="text-muted-foreground">Rate Limit:</span> {app.rateLimitPerMinute}/min, {app.rateLimitPerDay}/day</div>
              <div><span className="text-muted-foreground">DID:</span> {app.organizationDid || "—"}</div>
            </div>

            {/* Scopes */}
            <div>
              <Label className="text-xs text-muted-foreground">Scopes</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {(app.scopes as string[])?.map((s: string) => (
                  <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                ))}
              </div>
            </div>

            {/* API Keys */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs text-muted-foreground">API Keys</Label>
                <Button size="sm" variant="outline" onClick={async () => {
                  const result = await rotateMut.mutateAsync({ appId });
                  setNewKeyResult({ apiKey: result.apiKey, keyId: result.keyId });
                  appQuery.refetch();
                }}>
                  + New Key
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Prefix</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead>Last Used</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keys.map((k: any) => (
                    <TableRow key={k.keyId}>
                      <TableCell className="font-mono text-xs">{k.keyPrefix}...</TableCell>
                      <TableCell>{k.label}</TableCell>
                      <TableCell><Badge className={STATUS_COLORS[k.status] || ""}>{k.status}</Badge></TableCell>
                      <TableCell>{k.usageCount}</TableCell>
                      <TableCell className="text-xs">{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : "Never"}</TableCell>
                      <TableCell>
                        {k.status === "active" && (
                          <Button size="sm" variant="ghost" className="text-red-500 text-xs" onClick={() => revokeKeyMut.mutate({ keyId: k.keyId })}>
                            Revoke
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {newKeyResult && (
                <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-200 dark:border-amber-800">
                  <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">New API Key (copy now, shown only once):</p>
                  <code className="text-xs break-all select-all">{newKeyResult.apiKey}</code>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2 border-t">
              {app.status === "active" && (
                <Button variant="outline" size="sm" onClick={() => updateMut.mutate({ appId, status: "suspended" })}>
                  Suspend
                </Button>
              )}
              {app.status === "suspended" && (
                <Button variant="outline" size="sm" onClick={() => updateMut.mutate({ appId, status: "active" })}>
                  Reactivate
                </Button>
              )}
              {app.status !== "revoked" && (
                <Button variant="destructive" size="sm" onClick={() => revokeMut.mutate({ appId })}>
                  Revoke App
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RegisterAppDialog({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: (result: { apiKey: string; keyId: string }) => void }) {
  const [form, setForm] = useState({
    name: "",
    nameEn: "",
    organizationName: "",
    organizationDid: "",
    contactEmail: "",
    contactPhone: "",
    walletType: "personal_health" as any,
    platformType: "cross_platform" as any,
    scopes: ["contracts:read", "credentials:read"] as string[],
    description: "",
  });

  const registerMut = trpc.externalWallet.registerApp.useMutation({
    onSuccess: (data) => {
      onSuccess({ apiKey: data.apiKey, keyId: data.keyId });
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Register External Wallet App</DialogTitle>
          <DialogDescription>Register a new third-party wallet application to connect to the system.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>App Name (TH) *</Label>
              <Input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} placeholder="ชื่อแอป" />
            </div>
            <div>
              <Label>App Name (EN)</Label>
              <Input value={form.nameEn} onChange={(e) => setForm(p => ({ ...p, nameEn: e.target.value }))} placeholder="App Name" />
            </div>
          </div>

          <div>
            <Label>Organization *</Label>
            <Input value={form.organizationName} onChange={(e) => setForm(p => ({ ...p, organizationName: e.target.value }))} placeholder="Organization name" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Contact Email *</Label>
              <Input type="email" value={form.contactEmail} onChange={(e) => setForm(p => ({ ...p, contactEmail: e.target.value }))} />
            </div>
            <div>
              <Label>Contact Phone</Label>
              <Input value={form.contactPhone} onChange={(e) => setForm(p => ({ ...p, contactPhone: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Wallet Type *</Label>
              <Select value={form.walletType} onValueChange={(v) => setForm(p => ({ ...p, walletType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WALLET_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Platform</Label>
              <Select value={form.platformType} onValueChange={(v) => setForm(p => ({ ...p, platformType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ios">iOS</SelectItem>
                  <SelectItem value="android">Android</SelectItem>
                  <SelectItem value="web">Web</SelectItem>
                  <SelectItem value="cross_platform">Cross Platform</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Organization DID (optional)</Label>
            <Input value={form.organizationDid} onChange={(e) => setForm(p => ({ ...p, organizationDid: e.target.value }))} placeholder="did:web:example.com" />
          </div>

          <div>
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} rows={2} />
          </div>

          <div>
            <Label className="mb-2 block">API Scopes *</Label>
            <div className="grid grid-cols-2 gap-2">
              {AVAILABLE_SCOPES.map(scope => (
                <label key={scope.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.scopes.includes(scope.id)}
                    onCheckedChange={(checked) => {
                      setForm(p => ({
                        ...p,
                        scopes: checked
                          ? [...p.scopes, scope.id]
                          : p.scopes.filter(s => s !== scope.id),
                      }));
                    }}
                  />
                  <span>{scope.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => registerMut.mutate(form)}
            disabled={!form.name || !form.organizationName || !form.contactEmail || form.scopes.length === 0 || registerMut.isPending}
          >
            {registerMut.isPending ? "Registering..." : "Register & Generate Key"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AuditLogViewer({ logs, isLoading }: { logs: any[]; isLoading: boolean }) {
  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;

  const statusColors: Record<string, string> = {
    success: "text-emerald-600",
    error: "text-red-600",
    denied: "text-orange-600",
    rate_limited: "text-amber-600",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">API Access Audit Logs</CardTitle>
        <CardDescription>Recent API calls from external wallet applications</CardDescription>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">No audit logs yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>App</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Endpoint</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Duration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log: any) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs">{new Date(log.createdAt).toLocaleString()}</TableCell>
                  <TableCell className="font-mono text-xs">{log.appId.slice(0, 16)}...</TableCell>
                  <TableCell>{log.action}</TableCell>
                  <TableCell className="text-xs">{log.method} {log.endpoint}</TableCell>
                  <TableCell>
                    <span className={statusColors[log.responseStatus] || ""}>
                      {log.responseStatus}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs">{log.durationMs ? `${log.durationMs}ms` : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function ApiDocumentation() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">External Wallet API Documentation</CardTitle>
        <CardDescription>REST API reference for third-party wallet integration</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h3 className="font-semibold text-base mb-2">Base URL</h3>
          <code className="bg-muted px-3 py-1.5 rounded text-sm">/api/v1</code>
        </div>

        <div>
          <h3 className="font-semibold text-base mb-2">Authentication Flow</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
            <li>Register your wallet app through this admin panel</li>
            <li>Receive an API key (shown once)</li>
            <li><code>POST /api/v1/wallet/authenticate</code> with your API key to get a bearer token</li>
            <li>Use <code>Authorization: Bearer &lt;token&gt;</code> for subsequent requests</li>
          </ol>
        </div>

        <div>
          <h3 className="font-semibold text-base mb-3">Endpoints</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Method</TableHead>
                <TableHead>Endpoint</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                ["GET", "/info", "—", "API info & capabilities (public)"],
                ["POST", "/wallet/authenticate", "—", "Exchange API key for bearer token"],
                ["GET", "/contracts", "contracts:read", "List service contracts"],
                ["GET", "/contracts/:id", "contracts:read", "Get contract details"],
                ["POST", "/credentials/present", "credentials:present", "Present VP to system"],
                ["POST", "/credentials/request", "credentials:request", "Request credentials"],
                ["GET", "/credentials/status/:id", "credentials:read", "Check credential status"],
                ["POST", "/shl/resolve", "shl:resolve", "Resolve SMART Health Link"],
                ["POST", "/shl/access", "shl:resolve", "Access SHL files"],
                ["POST", "/identity/link", "identity:link", "Link DID to patient"],
                ["GET", "/identity/verify", "identity:read", "Verify DID-patient binding"],
                ["POST", "/documents/submit", "documents:write", "Submit documents"],
                ["GET", "/documents/available", "documents:read", "List available documents"],
              ].map(([method, endpoint, scope, desc]) => (
                <TableRow key={endpoint}>
                  <TableCell><Badge variant="outline" className="font-mono text-xs">{method}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">{endpoint}</TableCell>
                  <TableCell className="text-xs">{scope}</TableCell>
                  <TableCell className="text-sm">{desc}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div>
          <h3 className="font-semibold text-base mb-2">Rate Limits</h3>
          <p className="text-sm text-muted-foreground">
            Default: 60 requests/minute, 10,000 requests/day per app. Configurable per app during registration.
            Exceeding limits returns HTTP 429.
          </p>
        </div>

        <div>
          <h3 className="font-semibold text-base mb-2">Error Format</h3>
          <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">{`{
  "error": "error_code",
  "message": "Human-readable description"
}`}</pre>
        </div>
      </CardContent>
    </Card>
  );
}
