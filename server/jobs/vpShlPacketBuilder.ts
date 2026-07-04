import { classifyPacketTransport, type PacketTransportMode } from "../../shared/trustLayer";
import {
  buildManifestResponse,
  buildShlinkPayload,
  encryptShlFile,
  manifestFileDigest,
  randomBase64UrlBytes,
  type ShlContentType,
  type ShlManifestFile,
} from "../portability/shl";
import { sha256, stableStringify, stripUndefined } from "../portability/utils";
import type { DataQualityIssue, JsonRecord } from "../portability/types";
import type { IntegrationJobHandler, IntegrationJobHandlerRegistry } from "./runtime";

export interface VpShlPacketBuilderResult {
  status: "ready" | "needs_review";
  jobId?: string;
  mode: PacketTransportMode;
  transportDecision: JsonRecord;
  packetMetadata: JsonRecord;
  vpPackage?: JsonRecord;
  shlPacket?: JsonRecord;
  artifacts: JsonRecord[];
  operationOutcome: JsonRecord;
  issues: DataQualityIssue[];
}

export interface VpShlPacketBuilderOptions {
  jobId?: string;
  forceMode?: PacketTransportMode;
  now?: () => Date;
}

interface PacketInput {
  credentials: JsonRecord[];
  documentReferences: JsonRecord[];
  fhirBundle?: JsonRecord;
  holderDid?: string;
  purpose: string;
  audience: string;
  context?: string;
  estimatedBytes: number;
  manifestBaseUrl: string;
  viewerBaseUrl?: string;
  passcodeRequired: boolean;
  longTerm: boolean;
  expiresAt?: string;
}

export function registerVpShlPacketBuilderHandlers(registry: IntegrationJobHandlerRegistry): void {
  registry.register("vp.build", buildVpShlPacketBuilderHandler());
  registry.register("shl.build_packet", buildVpShlPacketBuilderHandler({ forceMode: "shl_packet" }));
}

export function buildVpShlPacketBuilderHandler(options: VpShlPacketBuilderOptions = {}): IntegrationJobHandler {
  return async ({ job, emitEvent }) => {
    const result = await buildVpShlPacket(job.payload, {
      ...options,
      jobId: job.jobId,
      forceMode: job.jobType === "shl.build_packet" ? "shl_packet" : options.forceMode,
    });

    emitEvent({
      eventType: result.status === "ready" ? "packet_builder_ready" : "packet_builder_needs_review",
      level: result.status === "ready" ? "info" : "warning",
      status: result.status === "ready" ? "running" : "needs_review",
      message: result.status === "ready" ? "VP/SHL packet metadata built" : "VP/SHL packet requires review",
      metadata: {
        mode: result.mode,
        artifactCount: result.artifacts.length,
        issueCount: result.issues.length,
        manifestHash: result.shlPacket?.manifestHash,
        presentationId: result.vpPackage?.presentationId,
      },
    });

    return {
      status: result.status === "ready" ? "succeeded" : "needs_review",
      result,
      metadata: {
        mode: result.mode,
        artifactCount: result.artifacts.length,
      },
    };
  };
}

export async function buildVpShlPacket(
  payload: unknown,
  options: VpShlPacketBuilderOptions = {},
): Promise<VpShlPacketBuilderResult> {
  const input = normalizePacketInput(payload);
  const documentTypes = inferDocumentTypes(input);
  const decision = classifyPacketTransport({
    documentTypes,
    credentialCount: input.credentials.length,
    hasLegacyDocuments: input.documentReferences.length > 0,
    hasFhirBundle: Boolean(input.fhirBundle),
    estimatedBytes: input.estimatedBytes,
    context: input.context,
  });
  const mode = options.forceMode ?? decision.mode;
  const issues = validatePacketInput(input, mode);
  const operationOutcome = buildOperationOutcome(issues);

  if (issues.some((item) => item.severity === "error")) {
    return {
      status: "needs_review",
      jobId: options.jobId,
      mode,
      transportDecision: decision as unknown as JsonRecord,
      packetMetadata: {
        mode,
        nextAction: "fix_packet_inputs",
        rawSecretReturned: false,
      },
      artifacts: [{
        artifactType: "operation_outcome",
        artifactId: `artifact-operation-outcome-${sha256(operationOutcome).slice(0, 16)}`,
        hash: sha256(operationOutcome),
        metadata: { operationOutcome, noPlaintextStored: true },
      }],
      operationOutcome,
      issues,
    };
  }

  if (mode === "shl_packet") {
    const shlPacket = await buildShlPacket(input, options);
    return {
      status: "ready",
      jobId: options.jobId,
      mode,
      transportDecision: decision as unknown as JsonRecord,
      packetMetadata: shlPacket.packetMetadata,
      shlPacket: shlPacket.packet,
      artifacts: shlPacket.artifacts,
      operationOutcome,
      issues,
    };
  }

  const vpPackage = buildVpPackage(input, mode, options);
  return {
    status: "ready",
    jobId: options.jobId,
    mode,
    transportDecision: decision as unknown as JsonRecord,
    packetMetadata: {
      mode,
      presentationId: vpPackage.presentationId,
      credentialCount: input.credentials.length,
      rawJwtReturned: false,
      nextAction: "create_short_lived_vp_at_share_time",
    },
    vpPackage,
    artifacts: [{
      artifactType: "vp_package",
      artifactId: `artifact-vp-package-${vpPackage.presentationId}`,
      hash: sha256(vpPackage),
      metadata: vpPackage,
    }],
    operationOutcome,
    issues,
  };
}

async function buildShlPacket(input: PacketInput, options: VpShlPacketBuilderOptions): Promise<{
  packet: JsonRecord;
  packetMetadata: JsonRecord;
  artifacts: JsonRecord[];
}> {
  const now = options.now?.() ?? new Date();
  const manifestToken = `manifest-${sha256({ input, jobId: options.jobId, now: now.toISOString() }).slice(0, 24)}`;
  const manifestUrl = `${input.manifestBaseUrl.replace(/\/$/, "")}/${manifestToken}`;
  const shlKey = randomBase64UrlBytes(32);
  const shlink = buildShlinkPayload({
    manifestUrl,
    key: shlKey,
    expiresAt: input.expiresAt,
    passcodeRequired: input.passcodeRequired,
    longTerm: input.longTerm,
    label: input.context ? `TrustCare ${input.context}` : "TrustCare packet",
    viewerBaseUrl: input.viewerBaseUrl,
  });
  const files = await buildEncryptedPacketFiles(input, shlKey, manifestToken);
  const manifestHash = manifestFileDigest(files);
  const sourceBundleHash = input.fhirBundle ? sha256(input.fhirBundle) : undefined;
  const documentReferenceBundleHash = input.documentReferences.length ? sha256(buildDocumentReferenceBundle(input.documentReferences)) : undefined;
  const trustcare = stripUndefined({
    manifestToken,
    manifestHash,
    sourceBundleHash,
    documentReferenceBundleHash,
    credentialCount: input.credentials.length,
    purpose: input.purpose,
    context: input.context,
    holderDid: input.holderDid,
    shlContextVersioningReviewed: true,
    manifestCredential: {
      credentialType: "ShlManifestCredential",
      status: "metadata_only_not_issued",
      manifestHash,
      sourceBundleHash,
      documentReferenceBundleHash,
      vcIssuance: "maker_checker_required",
    },
  });
  const manifest = buildManifestResponse({ files, embeddedLengthMax: 0, trustcare });
  const packet = {
    transport: "shlink",
    mode: "shl_packet",
    manifestToken,
    manifestUrl,
    manifestHash,
    sourceBundleHash,
    documentReferenceBundleHash,
    files: files.map((file) => stripUndefined({
      fileId: file.fileId,
      contentType: file.contentType,
      location: file.location,
      contentHash: file.contentHash,
      plaintextHash: file.plaintextHash,
      version: file.version,
    })),
    manifest,
    shlink: {
      scheme: "shlink",
      flag: shlink.payload.flag,
      exp: shlink.payload.exp,
      label: shlink.payload.label,
      keyRef: `shl-key-${sha256(shlKey).slice(0, 16)}`,
      rawKeyReturned: false,
      qrPayloadReturned: false,
      passcodeRequired: input.passcodeRequired,
      passcodeReturned: false,
    },
    holderVp: {
      status: "metadata_only_not_signed",
      holderDid: input.holderDid,
      audience: input.audience,
      purpose: input.purpose,
      credentialRefs: credentialRefs(input.credentials),
    },
    manifestCredential: trustcare.manifestCredential,
  };
  const artifacts = [
    {
      artifactType: "shl_packet",
      artifactId: `artifact-shl-packet-${manifestToken}`,
      hash: manifestHash,
      metadata: packet,
    },
    {
      artifactType: "object_reference",
      artifactId: `artifact-shl-files-${manifestToken}`,
      hash: manifestHash,
      metadata: {
        files: packet.files,
        noPlaintextStored: true,
        rawShlKeyReturned: false,
        rawPasscodeReturned: false,
      },
    },
  ];
  return {
    packet,
    packetMetadata: {
      mode: "shl_packet",
      manifestToken,
      manifestHash,
      fileCount: files.length,
      shlContextVersioningReviewed: true,
      rawShlKeyReturned: false,
      rawPasscodeReturned: false,
      nextAction: "persist_packet_and_submit_manifest_vc_for_checker_review",
    },
    artifacts,
  };
}

async function buildEncryptedPacketFiles(input: PacketInput, shlKey: string, manifestToken: string): Promise<ShlManifestFile[]> {
  const files: ShlManifestFile[] = [];
  let version = 1;
  if (input.fhirBundle) {
    files.push(await encryptedFile({
      key: shlKey,
      manifestToken,
      fileId: "fhir-bundle",
      contentType: "application/fhir+json",
      payload: input.fhirBundle,
      version: version++,
    }));
  }
  if (input.documentReferences.length > 0) {
    files.push(await encryptedFile({
      key: shlKey,
      manifestToken,
      fileId: "document-reference-bundle",
      contentType: "application/fhir+json",
      payload: buildDocumentReferenceBundle(input.documentReferences),
      version: version++,
    }));
  }
  if (input.credentials.length > 0) {
    files.push(await encryptedFile({
      key: shlKey,
      manifestToken,
      fileId: "credential-reference-bundle",
      contentType: "application/fhir+json",
      payload: {
        resourceType: "Bundle",
        type: "collection",
        entry: credentialRefs(input.credentials).map((credential) => ({ resource: credential })),
      },
      version: version++,
    }));
  }
  return files;
}

async function encryptedFile(input: {
  key: string;
  manifestToken: string;
  fileId: string;
  contentType: ShlContentType;
  payload: unknown;
  version: number;
}): Promise<ShlManifestFile> {
  const encrypted = await encryptShlFile({
    key: input.key,
    contentType: input.contentType,
    payload: input.payload,
  });
  return {
    fileId: input.fileId,
    contentType: input.contentType,
    location: `mock://shl-packet/${input.manifestToken}/${input.fileId}.jwe`,
    contentHash: encrypted.contentHash,
    plaintextHash: encrypted.plaintextHash,
    version: input.version,
  };
}

function buildVpPackage(input: PacketInput, mode: PacketTransportMode, options: VpShlPacketBuilderOptions): JsonRecord {
  const now = options.now?.() ?? new Date();
  const presentationId = `vp-packet-${sha256({
    credentials: credentialRefs(input.credentials),
    holderDid: input.holderDid,
    audience: input.audience,
    purpose: input.purpose,
    mode,
  }).slice(0, 24)}`;
  return {
    presentationId,
    mode,
    format: "jwt-vp",
    status: "metadata_only_not_signed",
    holderDid: input.holderDid,
    audience: input.audience,
    purpose: input.purpose,
    credentialRefs: credentialRefs(input.credentials),
    issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 10 * 60_000).toISOString(),
    rawJwtReturned: false,
  };
}

function normalizePacketInput(payload: unknown): PacketInput {
  const record = asRecord(payload);
  const credentials = arrayOfRecords(record.credentials ?? record.credentialRefs ?? record.vcs);
  const documentReferences = arrayOfRecords(record.documentReferences ?? record.documents)
    .filter((item) => item.resourceType === "DocumentReference" || item.fhirDocumentReference)
    .map((item) => asRecord(item.fhirDocumentReference ?? item));
  const fhirBundle = asRecord(record.fhirBundle ?? record.bundle ?? record.canonicalFhir?.bundle);
  const hasFhirBundle = fhirBundle.resourceType === "Bundle";
  const estimatedBytes = numberValue(record.estimatedBytes)
    ?? Buffer.byteLength(stableStringify({ credentials, documentReferences, fhirBundle: hasFhirBundle ? fhirBundle : undefined }), "utf8");
  return {
    credentials,
    documentReferences,
    fhirBundle: hasFhirBundle ? fhirBundle : undefined,
    holderDid: optionalString(record.holderDid) ?? "did:web:wallet.trustcare.example:holder",
    purpose: optionalString(record.purpose) ?? "treatment",
    audience: optionalString(record.audience) ?? "https://trustcare.network/verifier",
    context: optionalString(record.context),
    estimatedBytes,
    manifestBaseUrl: optionalString(record.manifestBaseUrl) ?? "https://trustcare.example/shl/manifest",
    viewerBaseUrl: optionalString(record.viewerBaseUrl),
    passcodeRequired: record.passcodeRequired !== false,
    longTerm: Boolean(record.longTerm),
    expiresAt: optionalString(record.expiresAt),
  };
}

function validatePacketInput(input: PacketInput, mode: PacketTransportMode): DataQualityIssue[] {
  const issues: DataQualityIssue[] = [];
  if (!input.holderDid) issues.push(issue("PACKET-001", "error", "Holder DID is required for VP/SHL packet metadata."));
  if (mode === "direct_vp" || mode === "vp_bundle") {
    if (input.credentials.length === 0) issues.push(issue("PACKET-002", "error", "Direct VP packets require at least one credential reference."));
  }
  if (mode === "shl_packet") {
    if (!input.fhirBundle && input.documentReferences.length === 0 && input.credentials.length === 0) {
      issues.push(issue("PACKET-003", "error", "SHL packets require a FHIR bundle, DocumentReference bundle, or credential reference bundle."));
    }
  }
  return issues;
}

function inferDocumentTypes(input: PacketInput): string[] {
  const credentialTypes = input.credentials.map((item) => optionalString(item.type ?? item.credentialType)).filter(Boolean) as string[];
  const documentTypes = input.documentReferences
    .map((item) => optionalString(asRecord(item.type).text) ?? optionalString(firstCodingCode(asRecord(item.type))))
    .filter(Boolean) as string[];
  return [...credentialTypes, ...documentTypes];
}

function buildDocumentReferenceBundle(documentReferences: JsonRecord[]): JsonRecord {
  return {
    resourceType: "Bundle",
    type: "collection",
    entry: documentReferences.map((resource) => ({ resource })),
  };
}

function credentialRefs(credentials: JsonRecord[]): JsonRecord[] {
  return credentials.map((credential) => stripUndefined({
    id: optionalString(credential.id ?? credential.credentialId),
    type: optionalString(credential.type ?? credential.credentialType),
    digest: optionalString(credential.digest) ?? (credential.credential ? sha256(credential.credential) : undefined),
    format: optionalString(credential.format),
    jwtAvailable: Boolean(credential.jwt),
  }));
}

function buildOperationOutcome(issues: DataQualityIssue[]): JsonRecord {
  return {
    resourceType: "OperationOutcome",
    issue: issues.map((item) => ({
      severity: item.severity,
      code: "processing",
      diagnostics: item.message,
      details: { text: item.ruleId },
    })),
  };
}

function firstCodingCode(type: JsonRecord): string | undefined {
  const coding = Array.isArray(type.coding) ? asRecord(type.coding[0]) : {};
  return optionalString(coding.code);
}

function issue(ruleId: string, severity: "error" | "warning", message: string): DataQualityIssue {
  return { ruleId, severity, message };
}

function arrayOfRecords(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.map(asRecord).filter((item) => Object.keys(item).length > 0) : [];
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function optionalString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return undefined;
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}
