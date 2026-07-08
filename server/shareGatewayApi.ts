/**
 * Share Gateway API — production resolver for external wallet QR payloads.
 *
 * Wallets POST a bounded share artifact here first. The QR code then contains
 * only the resolver URL returned by this API. VP artifacts are signed by the
 * Portal backend as vp+JWT so verifiers can resolve and validate them with JWKS.
 */
import { Router, type Request } from "express";
import { and, eq } from "drizzle-orm";
import { importJWK, SignJWT, type JWK } from "jose";
import { shareGatewayArtifacts } from "../drizzle/schema";
import { getDb } from "./db";
import { sha256 } from "./portability/utils";
import type { JsonRecord } from "./portability/types";

const SHARE_GATEWAY_BASE_PATH = "/api/share-gateway";
const DEFAULT_VP_TTL_MS = 10 * 60 * 1000;

const SHARE_GATEWAY_KINDS = [
  "vp",
  "standard_shl_manifest",
  "certified_shl_manifest",
  "manifest_vp",
  "manifest_credential",
  "holder_authorization",
  "shl_file",
] as const;

type ShareGatewayArtifactKind = (typeof SHARE_GATEWAY_KINDS)[number];

type ShareGatewayPublicationRequest = {
  artifactId: string;
  kind: ShareGatewayArtifactKind;
  contentType: string;
  payload: unknown;
  ownerUserId?: string | number;
  holderDid?: string;
  context?: string;
  purpose?: string;
  recipient?: string;
  expiresAt?: string;
  accessPolicy?: JsonRecord;
  trustcare?: JsonRecord;
};

type ShareGatewayPublicationResponse = {
  ok: boolean;
  mode: "portal_backend";
  artifactId: string;
  kind: ShareGatewayArtifactKind;
  publicUrl?: string;
  qrPayload?: string;
  manifestUrl?: string;
  jwksUrl?: string;
  warnings: string[];
  errors: string[];
};

type ShareGatewayPublication = {
  response: ShareGatewayPublicationResponse;
  signedJwt: string | null;
  publicUrl: string;
  qrPayload: string;
  jwksUrl: string;
  expiresAt: Date;
  payloadHash: string;
};

type ShareGatewaySigningMaterial = {
  alg: string;
  kid: string;
  issuer: string;
  privateJwk: JsonRecord;
  publicJwk: JsonRecord;
};

export function createShareGatewayRouter(): Router {
  const router = Router();

  router.get(`${SHARE_GATEWAY_BASE_PATH}/.well-known/jwks.json`, async (req, res) => {
    try {
      const material = resolveShareGatewaySigningMaterial();
      res.set("Cache-Control", "public, max-age=3600");
      res.set("Content-Type", "application/json");
      res.json({
        keys: [material.publicJwk],
        issuer: material.issuer,
        gateway: publicGatewayBaseUrl(req),
      });
    } catch (err: any) {
      const status = err instanceof ShareGatewayRequestError ? err.status : 500;
      console.error("[ShareGateway:JWKS] Error:", err.message);
      res.status(status).json({ error: "share_gateway_jwks_failed", message: err.message });
    }
  });

  router.post(`${SHARE_GATEWAY_BASE_PATH}/artifacts`, async (req, res) => {
    try {
      const database = await getDb();
      if (!database) {
        return res.status(503).json({
          ok: false,
          mode: "portal_backend",
          errors: ["Share Gateway database is unavailable."],
          warnings: [],
        });
      }
      const request = normalizePublicationRequest(req.body);
      const publication = await createShareGatewayPublication({
        request,
        gatewayBaseUrl: publicGatewayBaseUrl(req),
        now: new Date(),
      });

      await database
        .insert(shareGatewayArtifacts)
        .values({
          artifactId: request.artifactId,
          kind: request.kind,
          contentType: request.contentType,
          payloadJson: request.payload,
          signedJwt: publication.signedJwt,
          payloadHash: publication.payloadHash,
          ownerUserId:
            request.ownerUserId === undefined
              ? null
              : String(request.ownerUserId),
          holderDid: request.holderDid ?? null,
          context: request.context ?? null,
          purpose: request.purpose ?? null,
          recipient: request.recipient ?? null,
          publicUrl: publication.publicUrl,
          qrPayload: publication.qrPayload,
          accessPolicyJson: request.accessPolicy ?? null,
          trustcareJson: request.trustcare ?? null,
          status: "active",
          expiresAt: publication.expiresAt,
        })
        .onDuplicateKeyUpdate({
          set: {
            contentType: request.contentType,
            payloadJson: request.payload,
            signedJwt: publication.signedJwt,
            payloadHash: publication.payloadHash,
            ownerUserId:
              request.ownerUserId === undefined
                ? null
                : String(request.ownerUserId),
            holderDid: request.holderDid ?? null,
            context: request.context ?? null,
            purpose: request.purpose ?? null,
            recipient: request.recipient ?? null,
            publicUrl: publication.publicUrl,
            qrPayload: publication.qrPayload,
            accessPolicyJson: request.accessPolicy ?? null,
            trustcareJson: request.trustcare ?? null,
            status: "active",
            expiresAt: publication.expiresAt,
            updatedAt: new Date(),
          },
        });

      res.status(201).json(publication.response);
    } catch (err: any) {
      const status = err instanceof ShareGatewayRequestError ? err.status : 500;
      console.error("[ShareGateway:Publish] Error:", err.message);
      res.status(status).json({
        ok: false,
        mode: "portal_backend",
        errors: [err.message],
        warnings: [],
      });
    }
  });

  router.get(`${SHARE_GATEWAY_BASE_PATH}/presentations/:artifactId.jwt`, async (req, res) => {
    const artifact = await findArtifact(req.params.artifactId, "vp");
    if (!artifact || !artifact.signedJwt) {
      return res.status(404).json({ error: "presentation_not_found" });
    }
    if (artifactExpired(artifact.expiresAt)) {
      return res.status(410).json({ error: "presentation_expired" });
    }
    res.set("Cache-Control", "no-store");
    res.set("Content-Type", "application/vp+jwt");
    res.send(artifact.signedJwt);
  });

  router.get(`${SHARE_GATEWAY_BASE_PATH}/manifests/:artifactId.json`, async (req, res) => {
    const artifact =
      (await findArtifact(req.params.artifactId, "certified_shl_manifest")) ??
      (await findArtifact(req.params.artifactId, "standard_shl_manifest"));
    return sendJsonArtifact(res, artifact, "manifest_not_found");
  });

  router.get(`${SHARE_GATEWAY_BASE_PATH}/manifest-vps/:artifactId.json`, async (req, res) => {
    return sendJsonArtifact(
      res,
      await findArtifact(req.params.artifactId, "manifest_vp"),
      "manifest_vp_not_found",
    );
  });

  router.get(`${SHARE_GATEWAY_BASE_PATH}/manifest-credentials/:artifactId.json`, async (req, res) => {
    return sendJsonArtifact(
      res,
      await findArtifact(req.params.artifactId, "manifest_credential"),
      "manifest_credential_not_found",
    );
  });

  router.get(`${SHARE_GATEWAY_BASE_PATH}/holder-authorizations/:artifactId.json`, async (req, res) => {
    return sendJsonArtifact(
      res,
      await findArtifact(req.params.artifactId, "holder_authorization"),
      "holder_authorization_not_found",
    );
  });

  router.get(`${SHARE_GATEWAY_BASE_PATH}/files/:artifactId`, async (req, res) => {
    return sendJsonArtifact(
      res,
      await findArtifact(req.params.artifactId, "shl_file"),
      "file_not_found",
    );
  });

  return router;
}

export async function createShareGatewayPublication(input: {
  request: ShareGatewayPublicationRequest;
  gatewayBaseUrl: string;
  now?: Date;
}): Promise<ShareGatewayPublication> {
  const now = input.now ?? new Date();
  const gatewayBaseUrl = input.gatewayBaseUrl.replace(/\/+$/, "");
  const expiresAt = parseExpiresAt(input.request.expiresAt, now);
  const publicUrl = publicUrlForArtifact(
    gatewayBaseUrl,
    input.request.kind,
    input.request.artifactId,
  );
  const jwksUrl = `${gatewayBaseUrl}/.well-known/jwks.json`;
  const payloadHash = `sha256:${sha256(input.request.payload)}`;
  const signedJwt =
    input.request.kind === "vp"
      ? await signVpArtifact({
          request: input.request,
          publicUrl,
          jwksUrl,
          payloadHash,
          now,
          expiresAt,
        })
      : null;
  const qrPayload = publicUrl;
  return {
    signedJwt,
    publicUrl,
    qrPayload,
    jwksUrl,
    expiresAt,
    payloadHash,
    response: {
      ok: true,
      mode: "portal_backend",
      artifactId: input.request.artifactId,
      kind: input.request.kind,
      publicUrl,
      qrPayload,
      manifestUrl: input.request.kind.includes("shl_manifest") ? publicUrl : undefined,
      jwksUrl: input.request.kind === "vp" ? jwksUrl : undefined,
      warnings: [],
      errors: [],
    },
  };
}

export function normalizePublicationRequest(value: unknown): ShareGatewayPublicationRequest {
  const body = recordValue(value);
  if (!body) throw new ShareGatewayRequestError(400, "Request body must be a JSON object.");
  const artifactId = nonEmptyString(body.artifactId);
  const kind = nonEmptyString(body.kind);
  const contentType = nonEmptyString(body.contentType);
  if (!artifactId) throw new ShareGatewayRequestError(400, "artifactId is required.");
  if (!isShareGatewayKind(kind)) {
    throw new ShareGatewayRequestError(400, "Unsupported share gateway artifact kind.");
  }
  if (!contentType) throw new ShareGatewayRequestError(400, "contentType is required.");
  if (body.payload === undefined || body.payload === null) {
    throw new ShareGatewayRequestError(400, "payload is required.");
  }
  return {
    artifactId,
    kind,
    contentType,
    payload: body.payload,
    ownerUserId:
      typeof body.ownerUserId === "string" || typeof body.ownerUserId === "number"
        ? body.ownerUserId
        : undefined,
    holderDid: nonEmptyString(body.holderDid),
    context: nonEmptyString(body.context),
    purpose: nonEmptyString(body.purpose),
    recipient: nonEmptyString(body.recipient),
    expiresAt: nonEmptyString(body.expiresAt),
    accessPolicy: recordValue(body.accessPolicy) ?? undefined,
    trustcare: recordValue(body.trustcare) ?? undefined,
  };
}

export function publicUrlForArtifact(
  gatewayBaseUrl: string,
  kind: ShareGatewayArtifactKind,
  artifactId: string,
): string {
  const encoded = encodeURIComponent(artifactId);
  const base = gatewayBaseUrl.replace(/\/+$/, "");
  switch (kind) {
    case "vp":
      return `${base}/presentations/${encoded}.jwt`;
    case "standard_shl_manifest":
    case "certified_shl_manifest":
      return `${base}/manifests/${encoded}.json`;
    case "manifest_vp":
      return `${base}/manifest-vps/${encoded}.json`;
    case "manifest_credential":
      return `${base}/manifest-credentials/${encoded}.json`;
    case "holder_authorization":
      return `${base}/holder-authorizations/${encoded}.json`;
    case "shl_file":
      return `${base}/files/${encoded}`;
  }
}

async function signVpArtifact(input: {
  request: ShareGatewayPublicationRequest;
  publicUrl: string;
  jwksUrl: string;
  payloadHash: string;
  now: Date;
  expiresAt: Date;
}): Promise<string> {
  const material = resolveShareGatewaySigningMaterial();
  const signingKey = await importJWK(material.privateJwk as JWK, material.alg);
  const issuedAt = Math.floor(input.now.getTime() / 1000);
  const expiresAt = Math.floor(input.expiresAt.getTime() / 1000);
  const vp = normalizeVpPayload(input.request.payload, input.request);
  return new SignJWT({
    vp,
    trustcare_share_gateway: {
      artifactId: input.request.artifactId,
      kind: input.request.kind,
      source: "trustcare_portal_share_gateway",
      payloadHash: input.payloadHash,
      resolver: input.publicUrl,
      purpose: input.request.purpose,
      context: input.request.context,
      recipient: input.request.recipient,
      holderDid: input.request.holderDid,
    },
  })
    .setProtectedHeader({
      alg: material.alg,
      typ: "vp+JWT",
      kid: material.kid,
      jku: input.jwksUrl,
    })
    .setIssuer(material.issuer)
    .setSubject(input.request.holderDid ?? material.issuer)
    .setAudience(input.request.recipient ?? "https://trustcare.network/verifier")
    .setJti(input.request.artifactId)
    .setIssuedAt(issuedAt)
    .setExpirationTime(expiresAt)
    .sign(signingKey);
}

function normalizeVpPayload(
  payload: unknown,
  request: ShareGatewayPublicationRequest,
): JsonRecord {
  const record = recordValue(payload);
  const nestedVp = recordValue(record?.vp);
  const candidate = nestedVp ?? record;
  if (candidate && isVerifiablePresentation(candidate)) return candidate;
  return {
    "@context": ["https://www.w3.org/ns/credentials/v2"],
    id: request.artifactId,
    type: ["VerifiablePresentation", "TrustcarePatientPresentation"],
    holder: request.holderDid ?? "did:unknown:holder",
    purpose: request.purpose,
    verifiableCredential: [],
    trustcare: {
      originalPayload: payload,
      context: request.context,
    },
  };
}

function resolveShareGatewaySigningMaterial(): ShareGatewaySigningMaterial {
  const envPrivateJwk = parseJwk(process.env.TRUSTCARE_SHARE_GATEWAY_PRIVATE_JWK) ??
    parseJwk(process.env.TRUSTCARE_VC_SIGNING_PRIVATE_JWK);
  if (envPrivateJwk) {
    const alg = process.env.TRUSTCARE_SHARE_GATEWAY_SIGNING_ALG ??
      process.env.TRUSTCARE_VC_SIGNING_ALG ??
      String(envPrivateJwk.alg ?? "ES256");
    const issuer = process.env.TRUSTCARE_SHARE_GATEWAY_ISSUER_DID ??
      "did:web:trustcare.network";
    const kid = process.env.TRUSTCARE_SHARE_GATEWAY_KEY_ID ??
      process.env.TRUSTCARE_VC_KEY_ID ??
      String(envPrivateJwk.kid ?? `${issuer}#share-gateway-signing-key`);
    const privateJwk = { ...envPrivateJwk, alg, kid };
    return {
      alg,
      kid,
      issuer,
      privateJwk,
      publicJwk: toPublicJwk(privateJwk),
    };
  }

  throw new ShareGatewayRequestError(
    503,
    "Share Gateway signing key is not configured.",
  );
}

async function findArtifact(artifactId: string, kind: ShareGatewayArtifactKind) {
  const database = await getDb();
  if (!database) return null;
  const [artifact] = await database
    .select()
    .from(shareGatewayArtifacts)
    .where(
      and(
        eq(shareGatewayArtifacts.artifactId, artifactId),
        eq(shareGatewayArtifacts.kind, kind),
        eq(shareGatewayArtifacts.status, "active"),
      ),
    )
    .limit(1);
  return artifact ?? null;
}

function sendJsonArtifact(res: any, artifact: Awaited<ReturnType<typeof findArtifact>>, notFoundCode: string) {
  if (!artifact) return res.status(404).json({ error: notFoundCode });
  if (artifactExpired(artifact.expiresAt)) {
    return res.status(410).json({ error: "artifact_expired" });
  }
  res.set("Cache-Control", "no-store");
  res.set("Content-Type", artifact.contentType || "application/json");
  return res.json(artifact.payloadJson);
}

function publicGatewayBaseUrl(req: Request): string {
  const configured = process.env.TRUSTCARE_SHARE_GATEWAY_PUBLIC_URL;
  if (configured) return configured.replace(/\/+$/, "");
  const forwardedProto = String(req.headers["x-forwarded-proto"] ?? "").split(",")[0]?.trim();
  const proto = forwardedProto || (process.env.NODE_ENV === "production" ? "https" : req.protocol);
  const host = String(req.headers["x-forwarded-host"] ?? req.headers.host ?? "").split(",")[0]?.trim();
  return `${proto}://${host}${SHARE_GATEWAY_BASE_PATH}`;
}

function parseExpiresAt(value: string | undefined, now: Date): Date {
  if (!value) return new Date(now.getTime() + DEFAULT_VP_TTL_MS);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new ShareGatewayRequestError(400, "expiresAt must be an ISO date string.");
  }
  if (parsed.getTime() <= now.getTime()) {
    throw new ShareGatewayRequestError(400, "expiresAt must be in the future.");
  }
  return parsed;
}

function artifactExpired(value: Date | string | null): boolean {
  if (!value) return false;
  return new Date(value).getTime() <= Date.now();
}

function isVerifiablePresentation(value: JsonRecord): boolean {
  const type = value.type;
  return Array.isArray(type)
    ? type.map(String).includes("VerifiablePresentation")
    : type === "VerifiablePresentation";
}

function isShareGatewayKind(value: string | undefined): value is ShareGatewayArtifactKind {
  return Boolean(value && SHARE_GATEWAY_KINDS.includes(value as ShareGatewayArtifactKind));
}

function recordValue(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function parseJwk(value: string | undefined): JsonRecord | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value);
    return recordValue(parsed) ?? undefined;
  } catch {
    return undefined;
  }
}

function toPublicJwk(jwk: JsonRecord): JsonRecord {
  const { d: _d, p: _p, q: _q, dp: _dp, dq: _dq, qi: _qi, ...publicJwk } = jwk;
  return publicJwk;
}

class ShareGatewayRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
