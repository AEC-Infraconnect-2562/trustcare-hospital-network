import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { compactDecrypt, base64url } from "jose";
import { CheckCircle2, FileJson2, KeyRound, Link2, LockKeyhole, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";

type ShlinkPayload = {
  url: string;
  key: string;
  exp?: number;
  flag?: string;
  label?: string;
};

export default function ShlViewer() {
  const initial = typeof window !== "undefined" ? decodeShlink(window.location.hash.replace(/^#/, "")) : null;
  const [payloadText, setPayloadText] = useState(() => window.location.hash.replace(/^#/, ""));
  const [payload, setPayload] = useState<ShlinkPayload | null>(initial);
  const [passcode, setPasscode] = useState("");
  const [recipient, setRecipient] = useState("Trustcare external viewer");
  const [manifest, setManifest] = useState<any>(null);
  const [bundle, setBundle] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<any>(null);
  const resourceCounts = useMemo(() => countResources(bundle), [bundle]);

  async function loadManifest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setErrorDetails(null);
    setManifest(null);
    setBundle(null);
    const decoded = payload ?? decodeShlink(payloadText);
    if (!decoded) {
      setError("Invalid SHLink payload");
      return;
    }
    setPayload(decoded);
    const response = await fetch(decoded.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ recipient, passcode, embeddedLengthMax: 5_000_000 }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data?.error ?? "Manifest request failed");
      setErrorDetails(data);
      return;
    }
    setManifest(data);
    const fhirFile = data.files?.find((file: any) => file.contentType === "application/fhir+json" && file.embedded);
    if (fhirFile?.embedded) {
      const decrypted = await compactDecrypt(fhirFile.embedded, base64url.decode(decoded.key));
      const plaintext = new TextDecoder().decode(decrypted.plaintext);
      setBundle(JSON.parse(plaintext));
    }
  }

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <Link2 className="h-6 w-6 text-primary" />
              SHL Viewer
            </h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="outline">shlink manifest</Badge>
              <Badge variant="outline">JWE decrypt</Badge>
              <Badge variant="outline">VC/VP evidence</Badge>
            </div>
          </div>
          {payload?.exp && <Badge variant="secondary">Expires {new Date(payload.exp * 1000).toLocaleString()}</Badge>}
        </div>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><LockKeyhole className="h-5 w-5" />Manifest access</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={loadManifest} className="grid gap-4 md:grid-cols-[1fr_220px_180px_auto] md:items-end">
              <div className="space-y-2">
                <Label>SHLink</Label>
                <Input value={payloadText} onChange={(event) => { setPayloadText(event.target.value); setPayload(decodeShlink(event.target.value)); }} />
              </div>
              <div className="space-y-2">
                <Label>Recipient</Label>
                <Input value={recipient} onChange={(event) => setRecipient(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Passcode</Label>
                <Input value={passcode} onChange={(event) => setPasscode(event.target.value)} />
              </div>
              <Button type="submit"><KeyRound className="mr-2 h-4 w-4" />Open</Button>
            </form>
            {error && (
              <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <div>{error}</div>
                {typeof errorDetails?.remainingAttempts === "number" && (
                  <div className="mt-1 font-medium">
                    Remaining passcode attempts: {errorDetails.remainingAttempts}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {manifest && (
          <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" />Trust layer</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <TrustRow label="Manifest VC" value={manifest.trustcare?.manifestCredentialId} />
                <TrustRow label="Presentation" value={manifest.trustcare?.presentationId} />
                <TrustRow label="Manifest hash" value={manifest.trustcare?.manifestHash} />
                <TrustRow label="FHIR hash" value={manifest.trustcare?.sourceBundleHash} />
                <TrustRow label="Access after grant" value={String(manifest.trustcare?.accessCountAfterGrant ?? "")} />
                <TrustRow label="Remaining access" value={String(manifest.trustcare?.remainingAccessCount ?? "unlimited")} />
                <Separator />
                <TrustChecklist manifest={manifest} />
                <div className="flex items-center gap-2 text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{manifest.trustcare?.trustLayer ?? "vc-vp-around-shl"}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><FileJson2 className="h-5 w-5" />FHIR bundle</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {Object.entries(resourceCounts).map(([resourceType, count]) => (
                    <div key={resourceType} className="rounded-md border p-3">
                      <div className="text-xs text-muted-foreground">{resourceType}</div>
                      <div className="text-xl font-semibold">{String(count)}</div>
                    </div>
                  ))}
                </div>
                <pre className="max-h-[520px] overflow-auto rounded-md border bg-muted/30 p-3 text-xs">{JSON.stringify(bundle ?? manifest, null, 2)}</pre>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </main>
  );
}

function TrustChecklist({ manifest }: { manifest: any }) {
  const checks: Array<[string, boolean, string]> = [
    ["SHL transport", Boolean(manifest.files?.length), "Manifest returned encrypted FHIR/health files."],
    ["Manifest VC", Boolean(manifest.trustcare?.manifestCredentialId), "Credential binds manifest hash and context."],
    ["Holder VP", Boolean(manifest.trustcare?.presentationId), "Presentation binds patient holder to packet."],
    ["File hash", Boolean(manifest.trustcare?.manifestHash), "Verifier can compare manifest/file digest."],
    ["Access policy", manifest.trustcare?.status === "active", "Expiry, revocation and max access were enforced."],
  ];
  return (
    <div className="space-y-2">
      {checks.map(([label, ok, detail]) => (
        <div key={String(label)} className="rounded-md border p-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className={`h-3.5 w-3.5 ${ok ? "text-emerald-600" : "text-muted-foreground"}`} />
            <span className="text-xs font-medium">{label}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </div>
      ))}
    </div>
  );
}

function TrustRow({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="break-all font-mono text-xs">{value || "pending"}</div>
    </div>
  );
}

function decodeShlink(value: string): ShlinkPayload | null {
  if (!value) return null;
  try {
    const encoded = value.includes("shlink:/") ? value.slice(value.indexOf("shlink:/") + "shlink:/".length) : value;
    const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), "=");
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function countResources(bundle: any) {
  const counts: Record<string, number> = {};
  for (const entry of bundle?.entry ?? []) {
    const type = entry?.resource?.resourceType ?? "Unknown";
    counts[type] = (counts[type] ?? 0) + 1;
  }
  return counts;
}
