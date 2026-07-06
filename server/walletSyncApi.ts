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
          holderDid: null, // Will be populated from credentialData if available
          patientId,
          sourceSystem: "trustcare_portal",
          issuedAt: cred?.issuedAt?.toISOString() || null,
          expiresAt: cred?.expiresAt?.toISOString() || null,
          createdAt: card.createdAt?.toISOString() || new Date().toISOString(),
          lastPresentedAt: card.lastPresentedAt?.toISOString() || null,
          pinned: card.isPinned || false,
        };
      });

      // Also include credentials that don't have wallet cards yet
      const cardCredIds = new Set(cards.map((c: any) => c.credentialId));
      for (const cred of credentials) {
        if (!cardCredIds.has(cred.id)) {
          const hospital = hospitalMap.get(cred.issuerHospitalId);
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
            issuerDid: hospital?.code ? hospitalDidWeb(hospital.code) : null,
            holderDid: null,
            patientId,
            sourceSystem: "trustcare_portal",
            issuedAt: cred.issuedAt?.toISOString() || null,
            expiresAt: cred.expiresAt?.toISOString() || null,
            createdAt: cred.createdAt?.toISOString() || new Date().toISOString(),
            lastPresentedAt: null,
            pinned: false,
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

  return router;
}
