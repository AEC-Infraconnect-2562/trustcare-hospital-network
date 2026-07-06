/**
 * Wallet Sync API — POST /api/wallet/sync
 *
 * Allows external wallet apps to pull all credentials for a patient.
 * Authentication: Bearer token from external wallet session OR portal session cookie.
 *
 * Request body:
 *   - patientId?: number (optional, from session if not provided)
 *   - since?: string (ISO timestamp for incremental sync)
 *   - includePresentation?: boolean (also return VP records)
 *
 * Response:
 *   - credentials: WalletCard[] (wallet-compatible format)
 *   - presentations: VP[] (if requested)
 *   - syncedAt: string (ISO timestamp)
 *   - total: number
 */
import { Router, Request, Response } from "express";
import * as db from "./db";
import { getHospitalPublicJwk, hospitalDidWeb } from "./portability/did";
import { verifyCredential, verifyPresentation } from "./portability/vc";
import { buildTrustRegistryPolicy } from "./portability/trust";
import { issueSdJwt, createSelectivePresentation, verifySdJwtPresentation, getDisclosurePolicy, decodeDisclosure } from "./portability/sdJwt";
import { issuedCredentials, issuedPresentations, walletCards, hospitals } from "../drizzle/schema";
import { eq, and, gte, desc } from "drizzle-orm";
import { getDb } from "./db";

// ============================================================
// TYPES
// ============================================================
interface WalletSyncRequest {
  patientId?: number;
  since?: string;
  includePresentations?: boolean;
  limit?: number;
}

interface WalletSyncCredential {
  id: number;
  cardType: string;
  displayName: string;
  displayNameEn: string | null;
  documentCategory: string | null;
  credentialId: string;
  credentialStatus: string;
  credentialData: Record<string, unknown> | null;
  credentialType: string;
  issuerHospitalName: string | null;
  issuerDid: string | null;
  holderDid: string | null;
  patientId: number;
  sourceSystem: string;
  issuedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  lastPresentedAt: string | null;
  pinned: boolean;
  /** Signed SD-JWT-VC (ES256) — wallet can verify this cryptographically */
  proof: {
    type: "jwt";
    jwt: string;
    alg: string;
    kid: string;
  } | null;
  /** SD-JWT selective disclosure metadata */
  selectiveDisclosure: {
    /** Full SD-JWT with all disclosures (for holder storage) */
    sdJwtFull: string;
    /** Map of claimName → base64url-encoded disclosure */
    disclosureMap: Record<string, string>;
    /** Policy: which fields are always/selectable/never disclosed */
    policy: {
      alwaysDisclosed: string[];
      selectableFields: string[];
    };
  } | null;
}

interface WalletSyncPresentation {
  presentationId: string;
  context: string;
  purpose: string;
  audience: string | null;
  credentialIds: unknown;
  status: string;
  expiresAt: string | null;
  createdAt: string;
}

interface WalletSyncResponse {
  credentials: WalletSyncCredential[];
  presentations: WalletSyncPresentation[];
  syncedAt: string;
  total: number;
  hasMore: boolean;
  nextSince: string | null;
}

// ============================================================
// AUTHENTICATION HELPERS
// ============================================================

/**
 * Resolve patient ID from the request.
 * Supports:
 * 1. Bearer token from external wallet session (ews_ prefix)
 * 2. Portal session cookie (via tRPC-style auth)
 * 3. Explicit patientId in request body
 */
async function resolvePatientFromRequest(req: Request): Promise<{ patientId: number | null; error?: string }> {
  const authHeader = req.headers.authorization;

  // Check external wallet session token
  if (authHeader) {
    const [scheme, token] = authHeader.split(" ");
    if (scheme === "Bearer" && token?.startsWith("ews_")) {
      const session = await db.getExternalWalletSession(token);
      if (!session) {
        return { patientId: null, error: "Invalid or expired session token" };
      }
      if (session.status !== "active" || new Date(session.expiresAt) < new Date()) {
        return { patientId: null, error: "Session expired" };
      }
      if (session.patientId) {
        return { patientId: session.patientId };
      }
      return { patientId: null, error: "Session not bound to a patient" };
    }

    // Bearer token from portal (JWT session)
    if (scheme === "Bearer" && token) {
      try {
        const { sdk: sdkInstance } = await import("./_core/sdk");
        const payload = await sdkInstance.verifySession(token);
        if (payload?.openId) {
          const user = await db.getUserByOpenId(payload.openId);
          if (user) return { patientId: user.id };
        }
      } catch {
        // Fall through to cookie auth
      }
    }
  }

  // Check cookie-based session (portal auth)
  try {
    const { COOKIE_NAME } = await import("../shared/const");
    const cookieHeader = req.headers.cookie || "";
    const cookies = Object.fromEntries(
      cookieHeader.split(";").map(c => {
        const [k, ...v] = c.trim().split("=");
        return [k, v.join("=")];
      })
    );
    const sessionCookie = cookies[COOKIE_NAME];
    if (sessionCookie) {
      const { sdk: sdkInstance } = await import("./_core/sdk");
      const payload = await sdkInstance.verifySession(sessionCookie);
      if (payload?.openId) {
        const user = await db.getUserByOpenId(payload.openId);
        if (user) return { patientId: user.id };
      }
    }
  } catch {
    // No valid cookie session
  }

  return { patientId: null, error: "Authentication required. Provide Bearer token or valid session." };
}

// ============================================================
// ROUTER
// ============================================================
export function createWalletSyncRouter(): Router {
  const router = Router();

  /**
   * POST /api/wallet/sync
   * Pull all credentials for a patient in wallet-compatible format.
   */
  router.post("/api/wallet/sync", async (req: Request, res: Response) => {
    const start = Date.now();
    try {
      const body: WalletSyncRequest = req.body || {};

      // Resolve patient
      const { patientId: resolvedPatientId, error: authError } = await resolvePatientFromRequest(req);
      const patientId = body.patientId || resolvedPatientId;

      if (!patientId) {
        return res.status(401).json({
          error: "authentication_required",
          message: authError || "Could not determine patient identity",
        });
      }

      const database = await getDb();
      if (!database) {
        return res.status(503).json({ error: "service_unavailable", message: "Database not available" });
      }

      const limit = Math.min(body.limit || 500, 1000);
      const sinceDate = body.since ? new Date(body.since) : null;

      // Fetch wallet cards for the patient
      const cards = await db.listWalletCards(patientId);

      // Fetch issued credentials for the patient
      const conditions: any[] = [eq(issuedCredentials.subjectId, patientId)];
      if (sinceDate) {
        conditions.push(gte(issuedCredentials.issuedAt, sinceDate));
      }
      const credentials = await database
        .select()
        .from(issuedCredentials)
        .where(and(...conditions))
        .orderBy(desc(issuedCredentials.issuedAt))
        .limit(limit);

      // Build credential map for enrichment
      const credMap = new Map(credentials.map(c => [c.id, c]));

      // Fetch hospital info for issuer names
      const hospitalIds = Array.from(new Set(credentials.map(c => c.issuerHospitalId)));
      const hospitalMap = new Map<number, any>();
      for (const hid of hospitalIds) {
        const hospital = await db.getHospitalById(hid);
        if (hospital) hospitalMap.set(hid, hospital);
      }

      // Build wallet-compatible credential array
      const syncCredentials: WalletSyncCredential[] = cards.map((card: any) => {
        const cred = credMap.get(card.credentialId);
        const hospital = cred ? hospitalMap.get(cred.issuerHospitalId) : null;
        const issuerDid = card.issuerDid || (hospital?.code ? hospitalDidWeb(hospital.code) : null);

        // Extract JWT proof from sdJwtVc field
        const jwtToken = cred?.sdJwtVc || null;
        let proof: WalletSyncCredential["proof"] = null;
        if (jwtToken) {
          try {
            const headerB64 = jwtToken.split(".")[0];
            const header = JSON.parse(Buffer.from(headerB64, "base64url").toString());
            proof = {
              type: "jwt",
              jwt: jwtToken,
              alg: header.alg || "ES256",
              kid: header.kid || `${issuerDid}#vc-signing-key`,
            };
          } catch {
            proof = { type: "jwt", jwt: jwtToken, alg: "ES256", kid: `${issuerDid}#vc-signing-key` };
          }
        }

        // Build selective disclosure metadata
        let selectiveDisclosure: WalletSyncCredential["selectiveDisclosure"] = null;
        if (cred?.sdJwtFull && cred?.disclosureMap) {
          const credType = cred.type || card.cardType;
          const policy = getDisclosurePolicy(credType);
          selectiveDisclosure = {
            sdJwtFull: cred.sdJwtFull,
            disclosureMap: cred.disclosureMap as Record<string, string>,
            policy: { alwaysDisclosed: policy.alwaysDisclosed, selectableFields: policy.selectableFields },
          };
        }

        return {
          id: card.id,
          cardType: card.cardType,
          displayName: card.displayName,
          displayNameEn: card.displayNameEn || null,
          documentCategory: card.documentCategory || null,
          credentialId: cred?.credentialId || `card-${card.id}`,
          credentialStatus: cred?.status || "active",
          credentialData: cred?.credentialData as Record<string, unknown> | null,
          credentialType: cred?.type || card.cardType,
          issuerHospitalName: card.issuerHospitalName || hospital?.name || null,
          issuerDid,
          holderDid: null,
          patientId,
          sourceSystem: "trustcare_portal",
          issuedAt: cred?.issuedAt?.toISOString() || null,
          expiresAt: cred?.expiresAt?.toISOString() || null,
          createdAt: card.createdAt?.toISOString() || new Date().toISOString(),
          lastPresentedAt: card.lastPresentedAt?.toISOString() || null,
          pinned: card.isPinned || false,
          proof,
          selectiveDisclosure,
        };
      });

      // Also include credentials that don't have wallet cards yet
      const cardCredIds = new Set(cards.map((c: any) => c.credentialId));
      for (const cred of credentials) {
        if (!cardCredIds.has(cred.id)) {
          const hospital = hospitalMap.get(cred.issuerHospitalId);
          const credIssuerDid = hospital?.code ? hospitalDidWeb(hospital.code) : null;
          // Extract JWT proof
          const jwtToken = cred.sdJwtVc || null;
          let proof: WalletSyncCredential["proof"] = null;
          if (jwtToken) {
            try {
              const headerB64 = jwtToken.split(".")[0];
              const header = JSON.parse(Buffer.from(headerB64, "base64url").toString());
              proof = {
                type: "jwt",
                jwt: jwtToken,
                alg: header.alg || "ES256",
                kid: header.kid || `${credIssuerDid}#vc-signing-key`,
              };
            } catch {
              proof = { type: "jwt", jwt: jwtToken, alg: "ES256", kid: `${credIssuerDid}#vc-signing-key` };
            }
          }
          // Build selective disclosure for non-card credentials
          let selectiveDisclosure: WalletSyncCredential["selectiveDisclosure"] = null;
          if (cred.sdJwtFull && cred.disclosureMap) {
            const policy = getDisclosurePolicy(cred.type);
            selectiveDisclosure = {
              sdJwtFull: cred.sdJwtFull,
              disclosureMap: cred.disclosureMap as Record<string, string>,
              policy: { alwaysDisclosed: policy.alwaysDisclosed, selectableFields: policy.selectableFields },
            };
          }
          syncCredentials.push({
            id: cred.id + 100000, // offset to avoid collision
            cardType: cred.type,
            displayName: cred.type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
            displayNameEn: null,
            documentCategory: cred.documentCategory || null,
            credentialId: cred.credentialId,
            credentialStatus: cred.status,
            credentialData: cred.credentialData as Record<string, unknown> | null,
            credentialType: cred.type,
            issuerHospitalName: hospital?.name || null,
            issuerDid: credIssuerDid,
            holderDid: null,
            patientId,
            sourceSystem: "trustcare_portal",
            issuedAt: cred.issuedAt?.toISOString() || null,
            expiresAt: cred.expiresAt?.toISOString() || null,
            createdAt: cred.createdAt?.toISOString() || new Date().toISOString(),
            lastPresentedAt: null,
            pinned: false,
            proof,
            selectiveDisclosure,
          });
        }
      }

      // Fetch presentations if requested
      let syncPresentations: WalletSyncPresentation[] = [];
      if (body.includePresentations) {
        const presentations = await db.listIssuedPresentations({ patientId, limit: 50 });
        syncPresentations = presentations.map((p: any) => ({
          presentationId: p.presentationId,
          context: p.context,
          purpose: p.purpose,
          audience: p.audience || null,
          credentialIds: p.credentialIds,
          status: p.status,
          expiresAt: p.expiresAt?.toISOString() || null,
          createdAt: p.createdAt?.toISOString() || new Date().toISOString(),
        }));
      }

      const syncedAt = new Date().toISOString();
      const hasMore = credentials.length >= limit;
      const lastCred = credentials[credentials.length - 1];
      const nextSince = hasMore && lastCred ? lastCred.issuedAt?.toISOString() || null : null;

      const response: WalletSyncResponse = {
        credentials: syncCredentials,
        presentations: syncPresentations,
        syncedAt,
        total: syncCredentials.length,
        hasMore,
        nextSince,
      };

      console.log(`[WalletSync] Patient ${patientId}: ${syncCredentials.length} credentials, ${syncPresentations.length} presentations synced in ${Date.now() - start}ms`);
      res.json(response);
    } catch (err: any) {
      console.error("[WalletSync] Error:", err.message);
      res.status(500).json({ error: "internal_error", message: err.message });
    }
  });

  /**
   * GET /api/wallet/sync/status
   * Check sync availability and stats for the authenticated patient.
   */
  router.get("/api/wallet/sync/status", async (req: Request, res: Response) => {
    try {
      const { patientId, error: authError } = await resolvePatientFromRequest(req);
      if (!patientId) {
        return res.status(401).json({
          error: "authentication_required",
          message: authError || "Could not determine patient identity",
        });
      }

      const database = await getDb();
      if (!database) {
        return res.status(503).json({ error: "service_unavailable" });
      }

      const cards = await db.listWalletCards(patientId);
      const credentials = await db.listIssuedCredentials({ subjectId: patientId });
      const activeCredentials = credentials.filter((c: any) => c.status === "active");
      const presentations = await db.listIssuedPresentations({ patientId });

      res.json({
        patientId,
        available: true,
        stats: {
          totalCards: cards.length,
          totalCredentials: credentials.length,
          activeCredentials: activeCredentials.length,
          totalPresentations: presentations.length,
        },
        lastCredentialAt: credentials[0]?.issuedAt?.toISOString() || null,
        lastPresentationAt: presentations[0]?.createdAt?.toISOString() || null,
      });
    } catch (err: any) {
      console.error("[WalletSync:Status] Error:", err.message);
      res.status(500).json({ error: "internal_error", message: err.message });
    }
  });

  /**
   * POST /api/wallet/sync/verify
   * Verify a credential or presentation JWT cryptographically.
   * Returns green/yellow/red trust level.
   * Public endpoint — no authentication required.
   */
  router.post("/api/wallet/sync/verify", async (req: Request, res: Response) => {
    try {
      const { jwt, kind } = req.body || {};
      if (!jwt || typeof jwt !== "string") {
        return res.status(400).json({
          error: "missing_jwt",
          message: "jwt field is required (the signed VC or VP token)",
        });
      }

      // Determine if this is a credential or presentation
      const verifyKind = kind === "presentation" ? "presentation" : "credential";

      // Build trust policy from the registry
      const [entries, revokedCredentialIds, revokedStatus] = await Promise.all([
        db.listTrustRegistry({ isActive: true }),
        db.listRevokedCredentialIds(),
        db.listRevokedCredentialStatus(),
      ]);
      const trustPolicy = buildTrustRegistryPolicy({
        entries: entries as any[],
        mode: "advisory",
        revokedCredentialIds: [...revokedCredentialIds, ...revokedStatus.credentialIds],
        revokedStatusIndexes: [...revokedStatus.statusListIndexes],
      });

      let result: any;
      if (verifyKind === "presentation") {
        result = await verifyPresentation({ jwt, trustPolicy });
      } else {
        result = await verifyCredential({ jwt, trustPolicy });
      }

      // Cross-check credential status in the database (revoked/suspended/expired)
      // This catches cases where the JWT is cryptographically valid but the credential
      // has been administratively suspended or revoked after issuance.
      let dbStatus: string | null = null;
      if (result.credentialId && result.verified) {
        try {
          const credRow = await db.getIssuedCredentialByCredentialId(result.credentialId);
          if (credRow && credRow.status !== "active") {
            dbStatus = credRow.status;
            result.verified = false;
            result.trustLevel = "red";
            result.errors.push(`Credential status is '${credRow.status}' in the issuer registry.`);
          }
        } catch {
          // DB lookup failed — don't block verification, just note it
          result.warnings.push("Could not cross-check credential status with issuer registry.");
          if (result.trustLevel === "green") result.trustLevel = "yellow";
        }
      }

      res.json({
        verified: result.verified,
        trustLevel: result.trustLevel,
        issuer: result.issuer || null,
        credentialId: result.credentialId || null,
        credentialType: result.credentialType || null,
        kid: result.kid || null,
        alg: result.alg || null,
        issuedAt: result.credential?.issuance_date || result.credential?.issuedAt || null,
        expiresAt: result.credential?.expiration_date || result.credential?.expiresAt || null,
        dbStatus,
        warnings: result.warnings || [],
        errors: result.errors || [],
        credential: result.verified ? result.credential : undefined,
      });
    } catch (err: any) {
      console.error("[WalletSync:Verify] Error:", err.message);
      res.status(500).json({
        error: "verification_failed",
        message: err.message,
        verified: false,
        trustLevel: "red",
        warnings: [],
        errors: [err.message],
      });
    }
  });

  /**
   * POST /api/wallet/sync/did-resolve
   * Resolve a DID and return the public keys for verification.
   * Useful for wallets that need to verify a credential issuer.
   */
  router.post("/api/wallet/sync/did-resolve", async (req: Request, res: Response) => {
    try {
      const { did } = req.body || {};
      if (!did || typeof did !== "string") {
        return res.status(400).json({ error: "missing_did", message: "did field is required" });
      }

      // Parse did:web:trustcare.network:hospital:<code>
      const match = did.match(/^did:web:trustcare\.network:hospital:(\w+)$/);
      if (!match) {
        return res.status(404).json({
          error: "unsupported_did",
          message: "Only did:web:trustcare.network:hospital:<code> DIDs are supported",
          did,
        });
      }

      const code = match[1].toUpperCase();
      const publicJwk = getHospitalPublicJwk(code);

      res.json({
        did,
        resolved: true,
        verificationMethod: [{
          id: `${did}#vc-signing-key`,
          type: "JsonWebKey2020",
          controller: did,
          publicKeyJwk: publicJwk,
        }],
        hospitalCode: code,
      });
    } catch (err: any) {
      console.error("[WalletSync:DIDResolve] Error:", err.message);
      res.status(500).json({ error: "internal_error", message: err.message });
    }
  });

  /**
   * POST /api/wallet/sync/present
   * Create a selective disclosure presentation from an SD-JWT.
   * The wallet selects which fields to reveal.
   *
   * Request body:
   *   - sdJwtFull: string (the full SD-JWT with all disclosures)
   *   - selectedFields: string[] (claim names to disclose)
   *
   * Response:
   *   - presentation: string (derived SD-JWT with only selected disclosures)
   *   - disclosedFields: string[]
   *   - withheldFields: string[]
   */
  router.post("/api/wallet/sync/present", async (req: Request, res: Response) => {
    try {
      const { sdJwtFull, selectedFields } = req.body || {};

      if (!sdJwtFull || typeof sdJwtFull !== "string") {
        return res.status(400).json({
          error: "missing_sd_jwt_full",
          message: "sdJwtFull field is required (the full SD-JWT with all disclosures)",
        });
      }

      if (!selectedFields || !Array.isArray(selectedFields) || selectedFields.length === 0) {
        return res.status(400).json({
          error: "missing_selected_fields",
          message: "selectedFields array is required (claim names to disclose)",
        });
      }

      // Validate the SD-JWT format (must have ~ separators)
      if (!sdJwtFull.includes("~")) {
        return res.status(400).json({
          error: "invalid_sd_jwt_format",
          message: "sdJwtFull must be in SD-JWT format: JWT~disclosure1~disclosure2~...~",
        });
      }

      const result = createSelectivePresentation(sdJwtFull, selectedFields);

      res.json({
        presentation: result.presentation,
        disclosedFields: result.disclosedFields,
        withheldFields: result.withheldFields,
        totalDisclosures: result.disclosedFields.length + result.withheldFields.length,
      });
    } catch (err: any) {
      console.error("[WalletSync:Present] Error:", err.message);
      res.status(500).json({ error: "presentation_failed", message: err.message });
    }
  });

  /**
   * POST /api/wallet/sync/verify-selective
   * Verify a selective disclosure presentation (derived SD-JWT).
   * Checks signature validity and disclosed claim integrity.
   *
   * Request body:
   *   - presentation: string (the derived SD-JWT from /present endpoint)
   *
   * Response:
   *   - verified: boolean
   *   - trustLevel: "green" | "yellow" | "red"
   *   - disclosedClaims: Record<string, unknown>
   *   - withheldFields: string[]
   *   - issuer: string | null
   *   - credentialType: string | null
   *   - warnings: string[]
   *   - errors: string[]
   */
  router.post("/api/wallet/sync/verify-selective", async (req: Request, res: Response) => {
    try {
      const { presentation } = req.body || {};

      if (!presentation || typeof presentation !== "string") {
        return res.status(400).json({
          error: "missing_presentation",
          message: "presentation field is required (the derived SD-JWT)",
        });
      }

      // Build trusted issuers from trust registry
      const entries = await db.listTrustRegistry({ isActive: true });
      const trustedIssuers = entries.map((e: any) => e.issuerDid).filter(Boolean);

      const result = await verifySdJwtPresentation(presentation, { trustedIssuers });

      // Cross-check credential status in DB if we can identify it
      let dbStatus: string | null = null;
      if (result.verified) {
        try {
          // Extract credentialId from JWT payload (jti claim)
          const jwtPart = presentation.split("~")[0];
          const payloadB64 = jwtPart.split(".")[1];
          const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
          const credentialId = payload.jti;
          if (credentialId) {
            const credRow = await db.getIssuedCredentialByCredentialId(credentialId);
            if (credRow && credRow.status !== "active") {
              dbStatus = credRow.status;
              result.verified = false;
              result.trustLevel = "red";
              result.errors.push(`Credential status is '${credRow.status}' in the issuer registry.`);
            }
          }
        } catch {
          result.warnings.push("Could not cross-check credential status with issuer registry.");
          if (result.trustLevel === "green") result.trustLevel = "yellow";
        }
      }

      res.json({
        verified: result.verified,
        trustLevel: result.trustLevel,
        disclosedClaims: result.disclosedClaims,
        withheldFields: result.withheldFields,
        issuer: result.issuer,
        credentialType: result.credentialType,
        dbStatus,
        warnings: result.warnings,
        errors: result.errors,
      });
    } catch (err: any) {
      console.error("[WalletSync:VerifySelective] Error:", err.message);
      res.status(500).json({
        error: "verification_failed",
        message: err.message,
        verified: false,
        trustLevel: "red",
        warnings: [],
        errors: [err.message],
      });
    }
  });

  /**
   * POST /api/wallet/sync/sd-jwt/issue
   * Generate SD-JWT for an existing credential (on-demand).
   * Used when a credential doesn't have sdJwtFull yet.
   * Requires authentication.
   */
  router.post("/api/wallet/sync/sd-jwt/issue", async (req: Request, res: Response) => {
    try {
      const { patientId: resolvedPatientId, error: authError } = await resolvePatientFromRequest(req);
      const { credentialId } = req.body || {};

      if (!resolvedPatientId) {
        return res.status(401).json({
          error: "authentication_required",
          message: authError || "Authentication required",
        });
      }

      if (!credentialId || typeof credentialId !== "string") {
        return res.status(400).json({
          error: "missing_credential_id",
          message: "credentialId field is required",
        });
      }

      // Find the credential
      const cred = await db.getIssuedCredentialByCredentialId(credentialId);
      if (!cred) {
        return res.status(404).json({ error: "credential_not_found", message: "Credential not found" });
      }

      // Verify ownership
      if (cred.subjectId !== resolvedPatientId) {
        return res.status(403).json({ error: "forbidden", message: "Credential does not belong to this patient" });
      }

      // If already has SD-JWT, return it
      if (cred.sdJwtFull && cred.disclosureMap) {
        const policy = getDisclosurePolicy(cred.type);
        return res.json({
          credentialId: cred.credentialId,
          sdJwtFull: cred.sdJwtFull,
          disclosureMap: cred.disclosureMap,
          policy: { alwaysDisclosed: policy.alwaysDisclosed, selectableFields: policy.selectableFields },
          cached: true,
        });
      }

      // Generate SD-JWT on demand
      const credData = cred.credentialData as Record<string, unknown> | null;
      if (!credData) {
        return res.status(422).json({ error: "no_credential_data", message: "Credential has no data to create SD-JWT from" });
      }

      // Extract claims from credentialSubject
      const credentialSubject = (credData as any)?.credentialSubject || credData;
      const hospital = await db.getHospitalById(cred.issuerHospitalId);
      const issuerDid = hospital?.code ? hospitalDidWeb(hospital.code) : "did:web:trustcare.network";

      const sdResult = await issueSdJwt({
        credentialId: cred.credentialId,
        credentialType: cred.type,
        issuerDid,
        subjectDid: `did:trustcare:patient:${cred.subjectId}`,
        claims: credentialSubject as Record<string, unknown>,
        vcEnvelope: credData as any,
        hospitalCode: hospital?.code,
      });

      // Store the SD-JWT in the database for future use
      const database = await getDb();
      if (database) {
        await database.update(issuedCredentials)
          .set({
            sdJwtFull: sdResult.sdJwtFull,
            disclosureMap: sdResult.disclosureMap,
          })
          .where(eq(issuedCredentials.id, cred.id));
      }

      const policy = getDisclosurePolicy(cred.type);
      res.json({
        credentialId: cred.credentialId,
        sdJwtFull: sdResult.sdJwtFull,
        disclosureMap: sdResult.disclosureMap,
        policy: { alwaysDisclosed: policy.alwaysDisclosed, selectableFields: policy.selectableFields },
        cached: false,
      });
    } catch (err: any) {
      console.error("[WalletSync:SdJwtIssue] Error:", err.message);
      res.status(500).json({ error: "sd_jwt_issue_failed", message: err.message });
    }
  });

  /**
   * GET /api/wallet/sync/sd-jwt/policy/:credentialType
   * Get the selective disclosure policy for a credential type.
   * Public endpoint.
   */
  router.get("/api/wallet/sync/sd-jwt/policy/:credentialType", async (req: Request, res: Response) => {
    const { credentialType } = req.params;
    const policy = getDisclosurePolicy(credentialType);
    res.json({
      credentialType,
      policy,
    });
  });

  return router;
}
