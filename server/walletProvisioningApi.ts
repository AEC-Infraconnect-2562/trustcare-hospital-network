import { Router, Request, Response } from "express";
import crypto from "crypto";
import { importJWK, jwtVerify } from "jose";
import { and, desc, eq } from "drizzle-orm";
import { DEMO_USERS } from "./seed";
import { getDb, getUserById } from "./db";
import { ENV } from "./_core/env";
import { verifyWalletAccessToken, requestSandboxToken, walletOidcDiscovery } from "./walletOidc";
import { walletBindingChallenges, walletHolderBindings } from "../drizzle/schema";
import { patientDidKey } from "./portability/did";
import { DEMO_PATIENT_MAPPING } from "./portability/seedData";

function publicOrigin(req: Request): string {
  const configured = process.env.TRUSTCARE_PUBLIC_ORIGIN?.replace(/\/$/, "");
  if (configured) return configured;
  const forwarded = req.headers["x-forwarded-proto"];
  const protocol = typeof forwarded === "string" ? forwarded.split(",")[0] : req.protocol;
  return `${protocol}://${req.get("host")}`;
}

function jsonError(res: Response, status: number, error: string, message: string) {
  return res.status(status).json({ error, message });
}

async function requireWalletIdentity(req: Request, res: Response) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token || token.startsWith("ews_")) {
    jsonError(res, 401, "authentication_required", "A Keycloak Wallet access token is required");
    return null;
  }
  try {
    return await verifyWalletAccessToken(token);
  } catch (error: any) {
    jsonError(res, 401, "invalid_wallet_token", error?.message || "Wallet access token is invalid");
    return null;
  }
}

function patientIdentities() {
  return DEMO_USERS
    .filter(user => user.systemRole === "patient")
    .map(user => {
      const mapping = DEMO_PATIENT_MAPPING.find(item => item.demoOpenId === user.openId && item.hospitalCode === user.hospitalCode)
        ?? DEMO_PATIENT_MAPPING.find(item => item.demoOpenId === user.openId);
      const carepassId = mapping?.seedId === "P003"
        ? "CP-INT-2026-000003"
        : mapping ? `CP-TH-2026-${mapping.seedId.slice(1).padStart(6, "0")}` : "";
      const holderSeed = mapping ? `${mapping.hospitalCode}:${mapping.seedId}:${carepassId}` : `${user.hospitalCode}:${user.openId}`;
      return {
      identityId: user.openId,
      username: user.openId,
      displayName: user.name,
      email: user.email,
      hospitalCode: user.hospitalCode,
      patientRef: user.openId,
      holderDid: patientDidKey(holderSeed),
      syntheticTestData: true,
      };
    });
}

async function loadBinding(patientId: number, holderDid?: string) {
  const database = await getDb();
  if (!database) return null;
  const conditions = [eq(walletHolderBindings.patientId, patientId), eq(walletHolderBindings.status, "active")];
  if (holderDid) conditions.push(eq(walletHolderBindings.holderDid, holderDid));
  const [binding] = await database.select().from(walletHolderBindings).where(and(...conditions)).orderBy(desc(walletHolderBindings.boundAt)).limit(1);
  return binding || null;
}

export function createWalletProvisioningRouter(): Router {
  const router = Router();

  router.get("/api/wallet/provisioning/configuration", (req, res) => {
    const origin = publicOrigin(req);
    const enabled = Boolean(ENV.keycloakTestLoginEnabled && ENV.walletOidcIssuer);
    res.set("Cache-Control", "no-store");
    res.json({
      schema: "trustcare.wallet.provisioning-configuration.v1",
      appId: "trustcare-wallet-production",
      oidc: {
        issuer: ENV.walletOidcIssuer || null,
        audience: ENV.walletOidcAudience,
        requiredRole: ENV.walletOidcRequiredRole,
        clients: { web: ENV.walletOidcClientId, mobile: "trustcare-wallet-mobile" },
        patientRefClaim: ENV.walletOidcPatientRefClaim,
      },
      endpoints: {
        identity: `${origin}/api/wallet/identity`,
        provisioning: `${origin}/api/wallet/provisioning`,
        holderBindingChallenge: `${origin}/api/wallet/keys/challenges`,
        holderBindingCompletionTemplate: `${origin}/api/wallet/keys/challenges/{challengeId}/complete`,
        sandboxTestLogin: enabled ? `${origin}/api/wallet/test-login` : null,
        sandboxTestIdentities: enabled ? `${origin}/api/wallet/test-identities` : null,
        walletExchangeDiscovery: `${origin}/api/wallet/v2`,
      },
      holder: {
        didMethod: "did:key",
        algorithms: ["EdDSA", "ES256"],
        privateKeyOwner: "wallet",
      },
    });
  });

  router.get("/api/wallet/test-identities", (req, res) => {
    if (!ENV.keycloakTestLoginEnabled) return jsonError(res, 404, "not_found", "Sandbox test login is disabled");
    res.set("Cache-Control", "no-store");
    return res.json({ schema: "trustcare.wallet.sandbox-identities.v1", identities: patientIdentities(), syntheticTestData: true });
  });

  router.post("/api/wallet/test-login", async (req, res) => {
    if (!ENV.keycloakTestLoginEnabled) return jsonError(res, 404, "not_found", "Sandbox test login is disabled");
    const identityId = typeof req.body?.identityId === "string" ? req.body.identityId : "";
    if (!patientIdentities().some(identity => identity.identityId === identityId)) {
      return jsonError(res, 400, "invalid_identity", "Choose an identity from /api/wallet/test-identities");
    }
    try {
      const tokenSet = await requestSandboxToken(identityId);
      return res.json({
        schema: "trustcare.wallet.sandbox-login.v1",
        tokenType: tokenSet.token_type || "Bearer",
        accessToken: tokenSet.access_token,
        refreshToken: tokenSet.refresh_token || null,
        expiresIn: tokenSet.expires_in || null,
        identity: patientIdentities().find(identity => identity.identityId === identityId),
        syntheticTestData: true,
      });
    } catch (error: any) {
      return jsonError(res, 502, "sandbox_login_failed", error?.message || "Keycloak sandbox login failed");
    }
  });

  router.get("/api/wallet/identity", async (req, res) => {
    const identity = await requireWalletIdentity(req, res);
    if (!identity) return;
    const user = await getUserById(identity.patientId);
    const binding = await loadBinding(identity.patientId);
    return res.json({
      schema: "trustcare.wallet.identity.v1",
      patient: user ? { id: user.id, openId: user.openId, name: user.name, email: user.email, avatarUrl: user.avatarUrl } : null,
      patientRef: identity.patientRef,
      holderBinding: binding ? { bindingId: binding.bindingId, holderDid: binding.holderDid, status: binding.status, boundAt: binding.boundAt } : null,
    });
  });

  router.get("/api/wallet/provisioning", async (req, res) => {
    const identity = await requireWalletIdentity(req, res);
    if (!identity) return;
    const binding = await loadBinding(identity.patientId);
    return res.json({
      schema: "trustcare.wallet.provisioning.v1",
      patientRef: identity.patientRef,
      holderBinding: binding ? { bindingId: binding.bindingId, holderDid: binding.holderDid, status: binding.status } : null,
      nextAction: binding ? "sync_credentials" : "create_holder_binding_challenge",
      endpoints: { sync: "/api/wallet/sync", contracts: "/api/v1/contracts" },
    });
  });

  router.post("/api/wallet/keys/challenges", async (req, res) => {
    const identity = await requireWalletIdentity(req, res);
    if (!identity) return;
    const { holderDid, publicKeyJwk } = req.body || {};
    if (typeof holderDid !== "string" || !holderDid.startsWith("did:key:")) return jsonError(res, 400, "invalid_holder_did", "holderDid must be a did:key identifier");
    if (!publicKeyJwk || typeof publicKeyJwk !== "object" || publicKeyJwk.d) return jsonError(res, 400, "invalid_public_key", "publicKeyJwk must contain public key material only");
    if (!publicKeyJwk.kty) return jsonError(res, 400, "invalid_public_key", "publicKeyJwk.kty is required");

    const database = await getDb();
    if (!database) return jsonError(res, 503, "service_unavailable", "Database not available");
    const challengeId = `wbc_${crypto.randomBytes(18).toString("base64url")}`;
    const nonce = crypto.randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await database.insert(walletBindingChallenges).values({ challengeId, patientId: identity.patientId, holderDid, nonce, publicKeyJwk, status: "issued", expiresAt });
    return res.status(201).json({
      schema: "trustcare.wallet.holder-binding-challenge.v1",
      challengeId,
      nonce,
      holderDid,
      patientRef: identity.patientRef,
      expiresAt: expiresAt.toISOString(),
      proof: { type: "JWT", issuer: holderDid, audience: challengeId, requiredClaims: ["challengeId", "nonce", "holderDid"] },
    });
  });

  router.post("/api/wallet/keys/challenges/:challengeId/complete", async (req, res) => {
    const identity = await requireWalletIdentity(req, res);
    if (!identity) return;
    const database = await getDb();
    if (!database) return jsonError(res, 503, "service_unavailable", "Database not available");
    const [challenge] = await database.select().from(walletBindingChallenges).where(eq(walletBindingChallenges.challengeId, req.params.challengeId)).limit(1);
    if (!challenge) return jsonError(res, 404, "challenge_not_found", "Holder binding challenge not found");
    if (challenge.patientId !== identity.patientId) return jsonError(res, 403, "forbidden", "Challenge belongs to another patient");
    if (challenge.status !== "issued") return jsonError(res, 409, "challenge_not_usable", `Challenge status is ${challenge.status}`);
    if (new Date(challenge.expiresAt) <= new Date()) {
      await database.update(walletBindingChallenges).set({ status: "expired" }).where(eq(walletBindingChallenges.id, challenge.id));
      return jsonError(res, 410, "challenge_expired", "Holder binding challenge has expired");
    }
    const proof = typeof req.body?.proof === "string" ? req.body.proof : req.body?.proof?.jwt;
    if (!proof) return jsonError(res, 400, "missing_proof", "proof JWT is required");
    try {
      const publicKeyJwk = challenge.publicKeyJwk as { kty: string; alg?: string; [key: string]: unknown };
      const key = await importJWK(publicKeyJwk as any);
      const verified = await jwtVerify(proof, key, { algorithms: [publicKeyJwk.alg || (publicKeyJwk.kty === "OKP" ? "EdDSA" : "ES256")] });
      const claims = verified.payload as Record<string, unknown>;
      if (claims.challengeId !== challenge.challengeId || claims.nonce !== challenge.nonce || claims.holderDid !== challenge.holderDid) {
        return jsonError(res, 400, "proof_mismatch", "Holder proof does not match the issued challenge");
      }
      const bindingId = `whb_${crypto.randomBytes(18).toString("base64url")}`;
      const completedAt = new Date();
      await database.update(walletBindingChallenges).set({ status: "completed", completedAt }).where(eq(walletBindingChallenges.id, challenge.id));
      await database.insert(walletHolderBindings).values({ bindingId, patientId: identity.patientId, holderDid: challenge.holderDid, publicKeyJwk: challenge.publicKeyJwk, status: "active", boundAt: completedAt, lastVerifiedAt: completedAt, metadata: { challengeId: challenge.challengeId, oidcSubject: identity.subject } });
      return res.json({ schema: "trustcare.wallet.holder-binding.v1", bindingId, patientRef: identity.patientRef, holderDid: challenge.holderDid, status: "active", boundAt: completedAt.toISOString() });
    } catch (error: any) {
      return jsonError(res, 400, "invalid_holder_proof", error?.message || "Holder proof could not be verified");
    }
  });

  router.get("/api/wallet/v2", (_req, res) => res.json({
    schema: "trustcare.wallet.exchange-discovery.v2",
    protocolVersion: "2.0",
    oidc: walletOidcDiscovery(),
    endpoints: {
      configuration: "/api/wallet/provisioning/configuration",
      identity: "/api/wallet/identity",
      provisioning: "/api/wallet/provisioning",
      holderBindingChallenge: "/api/wallet/keys/challenges",
      sync: "/api/wallet/sync",
      verify: "/api/wallet/sync/verify",
      contracts: "/api/v1/contracts",
      requestCredential: "/api/v1/credentials/request",
      submitDocuments: "/api/v1/documents/submit",
    },
    holder: { didMethod: "did:key", privateKeyOwner: "wallet", proofFormat: "JWT" },
  }));

  return router;
}
