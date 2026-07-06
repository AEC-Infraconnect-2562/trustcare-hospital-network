/**
 * External Wallet API - REST endpoints for third-party wallet applications
 * 
 * This module provides:
 * - API key authentication middleware
 * - Bearer token session management
 * - Rate limiting per app
 * - Scope-based access control
 * - REST endpoints for credential exchange, SHL resolution, identity linking
 */

import { Router, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import * as db from "./db";

// ============================================================
// TYPES
// ============================================================

export interface ExternalWalletContext {
  appId: string;
  keyId: string;
  sessionToken?: string;
  scopes: string[];
  patientId?: number;
  patientDid?: string;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// ============================================================
// UTILITIES
// ============================================================

function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const key = `ewk_${crypto.randomBytes(32).toString("hex")}`;
  const prefix = key.slice(0, 12);
  const hash = hashApiKey(key);
  return { key, prefix, hash };
}

function generateSessionToken(): string {
  return `ews_${crypto.randomBytes(48).toString("hex")}`;
}

export function generateAppId(): string {
  return `app_${crypto.randomBytes(16).toString("hex")}`;
}

export function generateKeyId(): string {
  return `key_${crypto.randomBytes(12).toString("hex")}`;
}

// ============================================================
// RATE LIMITER (in-memory, per-app)
// ============================================================

const rateLimitStore = new Map<string, RateLimitEntry>();

function checkRateLimit(appId: string, limitPerMinute: number): boolean {
  const now = Date.now();
  const key = `rl:${appId}`;
  const entry = rateLimitStore.get(key);
  
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  
  if (entry.count >= limitPerMinute) {
    return false;
  }
  
  entry.count++;
  return true;
}

// ============================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================

async function authenticateApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    res.status(401).json({ error: "missing_authorization", message: "Authorization header required" });
    return;
  }

  // Support both "Bearer <session_token>" and "ApiKey <api_key>"
  const [scheme, token] = authHeader.split(" ");
  
  if (scheme === "Bearer" && token?.startsWith("ews_")) {
    // Session token auth
    const session = await db.getExternalWalletSession(token);
    if (!session) {
      res.status(401).json({ error: "invalid_session", message: "Session token invalid or expired" });
      return;
    }
    if (session.status !== "active" || new Date(session.expiresAt) < new Date()) {
      res.status(401).json({ error: "session_expired", message: "Session has expired" });
      return;
    }

    const app = await db.getExternalWalletApp(session.appId);
    if (!app || app.status !== "active") {
      res.status(403).json({ error: "app_inactive", message: "Wallet application is not active" });
      return;
    }

    // Rate limit check
    if (!checkRateLimit(app.appId, app.rateLimitPerMinute)) {
      await db.createExternalWalletAuditLog({
        appId: app.appId, keyId: session.keyId, sessionToken: token,
        action: "rate_limited", endpoint: req.path, method: req.method,
        statusCode: 429, responseStatus: "rate_limited",
        ipAddress: req.ip || null, userAgent: req.headers["user-agent"] || null,
      });
      res.status(429).json({ error: "rate_limited", message: "Rate limit exceeded" });
      return;
    }

    // Update session activity
    await db.updateExternalWalletSessionActivity(token);

    (req as any).walletCtx = {
      appId: app.appId,
      keyId: session.keyId,
      sessionToken: token,
      scopes: (session.scopes as string[]) || [],
      patientId: session.patientId ?? undefined,
      patientDid: session.patientDid ?? undefined,
    } satisfies ExternalWalletContext;

    next();
    return;
  }

  if (scheme === "ApiKey" || (scheme === "Bearer" && token?.startsWith("ewk_"))) {
    const apiKey = token;
    if (!apiKey) {
      res.status(401).json({ error: "invalid_key", message: "API key required" });
      return;
    }

    const keyHash = hashApiKey(apiKey);
    const keyRecord = await db.getExternalWalletApiKeyByHash(keyHash);
    if (!keyRecord || keyRecord.status !== "active") {
      res.status(401).json({ error: "invalid_key", message: "API key invalid or revoked" });
      return;
    }

    if (keyRecord.expiresAt && new Date(keyRecord.expiresAt) < new Date()) {
      res.status(401).json({ error: "key_expired", message: "API key has expired" });
      return;
    }

    const app = await db.getExternalWalletApp(keyRecord.appId);
    if (!app || app.status !== "active") {
      res.status(403).json({ error: "app_inactive", message: "Wallet application is not active" });
      return;
    }

    // Rate limit check
    if (!checkRateLimit(app.appId, app.rateLimitPerMinute)) {
      res.status(429).json({ error: "rate_limited", message: "Rate limit exceeded" });
      return;
    }

    // Update usage
    await db.incrementApiKeyUsage(keyRecord.keyId);

    (req as any).walletCtx = {
      appId: app.appId,
      keyId: keyRecord.keyId,
      scopes: (keyRecord.scopes as string[]) || (app.scopes as string[]) || [],
    } satisfies ExternalWalletContext;

    next();
    return;
  }

  res.status(401).json({ error: "invalid_scheme", message: "Use 'Bearer <session_token>' or 'ApiKey <api_key>'" });
}

function requireScope(scope: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ctx = (req as any).walletCtx as ExternalWalletContext | undefined;
    if (!ctx) {
      res.status(401).json({ error: "unauthenticated", message: "Authentication required" });
      return;
    }
    if (!ctx.scopes.includes(scope) && !ctx.scopes.includes("*")) {
      res.status(403).json({ error: "insufficient_scope", message: `Scope '${scope}' required`, requiredScope: scope });
      return;
    }
    next();
  };
}

// ============================================================
// AUDIT HELPER
// ============================================================

async function auditLog(req: Request, action: string, statusCode: number, responseStatus: "success" | "error" | "denied" | "rate_limited", extra?: Partial<{ errorMessage: string; patientId: number; resourceType: string; resourceId: string; durationMs: number }>) {
  const ctx = (req as any).walletCtx as ExternalWalletContext | undefined;
  if (!ctx) return;
  await db.createExternalWalletAuditLog({
    appId: ctx.appId,
    keyId: ctx.keyId,
    sessionToken: ctx.sessionToken || null,
    action,
    endpoint: req.path,
    method: req.method,
    statusCode,
    responseStatus,
    ipAddress: req.ip || null,
    userAgent: req.headers["user-agent"] || null,
    ...extra,
  });
}

// ============================================================
// ROUTER
// ============================================================

export function createExternalWalletApiRouter(): Router {
  const r = Router();

  // ─── Authentication ─────────────────────────────────────────
  
  /**
   * POST /api/v1/wallet/authenticate
   * Exchange API key for a session bearer token
   */
  r.post("/wallet/authenticate", async (req: Request, res: Response) => {
    const start = Date.now();
    try {
      const { apiKey, patientDid, patientId } = req.body || {};
      if (!apiKey) {
        res.status(400).json({ error: "missing_api_key", message: "apiKey is required" });
        return;
      }

      const keyHash = hashApiKey(apiKey);
      const keyRecord = await db.getExternalWalletApiKeyByHash(keyHash);
      if (!keyRecord || keyRecord.status !== "active") {
        res.status(401).json({ error: "invalid_key", message: "API key invalid or revoked" });
        return;
      }

      const app = await db.getExternalWalletApp(keyRecord.appId);
      if (!app || app.status !== "active") {
        res.status(403).json({ error: "app_inactive", message: "Wallet application is not active" });
        return;
      }

      const sessionToken = generateSessionToken();
      const expiresAt = new Date(Date.now() + 3600_000); // 1 hour

      await db.createExternalWalletSession({
        sessionToken,
        appId: app.appId,
        keyId: keyRecord.keyId,
        patientDid: patientDid || null,
        patientId: patientId || null,
        scopes: (keyRecord.scopes as string[]) || (app.scopes as string[]) || [],
        ipAddress: req.ip || null,
        userAgent: req.headers["user-agent"] || null,
        expiresAt,
        status: "active",
      });

      await db.createExternalWalletAuditLog({
        appId: app.appId, keyId: keyRecord.keyId, sessionToken,
        action: "authenticate", endpoint: "/wallet/authenticate", method: "POST",
        statusCode: 200, responseStatus: "success",
        ipAddress: req.ip || null, userAgent: req.headers["user-agent"] || null,
        durationMs: Date.now() - start,
      });

      res.json({
        token: sessionToken,
        tokenType: "Bearer",
        expiresIn: 3600,
        expiresAt: expiresAt.toISOString(),
        scopes: (keyRecord.scopes as string[]) || (app.scopes as string[]),
        app: { appId: app.appId, name: app.name, walletType: app.walletType },
      });
    } catch (err: any) {
      res.status(500).json({ error: "internal_error", message: err.message });
    }
  });

  // ─── Contract Discovery ─────────────────────────────────────

  /**
   * GET /api/v1/contracts
   * List available service contracts for external wallets
   */
  r.get("/contracts", authenticateApiKey, requireScope("contracts:read"), async (req: Request, res: Response) => {
    const start = Date.now();
    try {
      const ctx = (req as any).walletCtx as ExternalWalletContext;
      const contracts = await db.listAllContracts();
      
      // Filter by allowed contracts if app has restrictions
      const app = await db.getExternalWalletApp(ctx.appId);
      const allowedIds = app?.allowedContractIds as string[] | null;
      
      const filtered = allowedIds
        ? contracts.filter((c: any) => allowedIds.includes(c.contractId))
        : contracts.filter((c: any) => c.status === "active");

      const result = filtered.map((c: any) => ({
        contractId: c.contractId,
        context: c.context,
        version: c.version,
        status: c.status,
        patientLabel: c.patientLabel,
        patientLabelEn: c.patientLabelEn,
        hospitalLabel: c.hospitalLabel,
        hospitalLabelEn: c.hospitalLabelEn,
        patientVisible: c.patientVisible,
        hospitalVisible: c.hospitalVisible,
        patientBundleType: c.patientBundleType,
        hospitalBundleType: c.hospitalBundleType,
      }));

      await auditLog(req, "contracts.list", 200, "success", { durationMs: Date.now() - start });
      res.json({ contracts: result, total: result.length });
    } catch (err: any) {
      await auditLog(req, "contracts.list", 500, "error", { errorMessage: err.message });
      res.status(500).json({ error: "internal_error", message: err.message });
    }
  });

  /**
   * GET /api/v1/contracts/:contractId
   * Get contract details including requirements and schema
   */
  r.get("/contracts/:contractId", authenticateApiKey, requireScope("contracts:read"), async (req: Request, res: Response) => {
    const start = Date.now();
    try {
      const contract = await db.getContractByContractId(req.params.contractId);
      if (!contract) {
        await auditLog(req, "contracts.get", 404, "error", { errorMessage: "Contract not found" });
        res.status(404).json({ error: "not_found", message: "Contract not found" });
        return;
      }

      const templates = await db.listBundleTemplates(contract.contractId);
      const artifacts = await db.listContractArtifacts(contract.contractId);

      await auditLog(req, "contracts.get", 200, "success", { resourceType: "contract", resourceId: contract.contractId, durationMs: Date.now() - start });
      res.json({
        contract: {
          contractId: contract.contractId,
          context: contract.context,
          version: contract.version,
          status: contract.status,
          patientLabel: contract.patientLabel,
          patientLabelEn: contract.patientLabelEn,
          hospitalLabel: contract.hospitalLabel,
          hospitalLabelEn: contract.hospitalLabelEn,
          requirements: contract.requirementsJson,
          questionnaire: contract.questionnaireJson,
          consentPolicy: contract.consentPolicyJson,
        },
        templates: templates.map((t: any) => ({
          templateId: t.templateId,
          audience: t.audience,
          bundleType: t.bundleType,
          direction: t.direction,
          transportPolicy: t.transportPolicyJson,
          items: t.itemsJson,
        })),
        artifacts: artifacts.map((a: any) => ({
          artifactId: a.artifactId,
          artifactType: a.artifactType,
          title: a.title,
          titleEn: a.titleEn,
          version: a.version,
          status: a.status,
        })),
      });
    } catch (err: any) {
      await auditLog(req, "contracts.get", 500, "error", { errorMessage: err.message });
      res.status(500).json({ error: "internal_error", message: err.message });
    }
  });

  // ─── Credential Exchange ────────────────────────────────────

  /**
   * POST /api/v1/credentials/present
   * Present a Verifiable Presentation to the system
   */
  r.post("/credentials/present", authenticateApiKey, requireScope("credentials:present"), async (req: Request, res: Response) => {
    const start = Date.now();
    try {
      const ctx = (req as any).walletCtx as ExternalWalletContext;
      const { verifiablePresentation, context, recipientDid, purpose } = req.body || {};
      
      if (!verifiablePresentation) {
        res.status(400).json({ error: "missing_vp", message: "verifiablePresentation is required" });
        return;
      }

      // Basic VP structure validation
      const vp = typeof verifiablePresentation === "string" ? JSON.parse(verifiablePresentation) : verifiablePresentation;
      if (!vp.type || !vp.verifiableCredential) {
        res.status(400).json({ error: "invalid_vp", message: "VP must contain type and verifiableCredential" });
        return;
      }

      // Store the presentation
      const presentationId = `vp_ext_${crypto.randomBytes(12).toString("hex")}`;
      await db.createIssuedPresentation({
        presentationId,
        patientId: ctx.patientId || 0,
        holderDid: ctx.patientDid || vp.holder || "unknown",
        credentialIds: vp.verifiableCredential.map((_: any, i: number) => `ext_vc_${i}`),
        context: context || "opd_visit",
        purpose: purpose || "external_wallet_presentation",
        audience: recipientDid || ctx.appId,
        verifier: ctx.appId,
        presentationJwt: typeof verifiablePresentation === "string" ? verifiablePresentation : JSON.stringify(verifiablePresentation),
        status: "active",
        metadata: { source: "external_wallet", verificationStatus: "pending" },
      });

      await auditLog(req, "credentials.present", 200, "success", {
        patientId: ctx.patientId || undefined,
        resourceType: "presentation",
        resourceId: presentationId,
        durationMs: Date.now() - start,
      });

      res.json({
        presentationId,
        status: "accepted",
        verificationStatus: "pending",
        credentialCount: vp.verifiableCredential?.length || 0,
        message: "Presentation received and queued for verification",
      });
    } catch (err: any) {
      await auditLog(req, "credentials.present", 500, "error", { errorMessage: err.message });
      res.status(500).json({ error: "internal_error", message: err.message });
    }
  });

  /**
   * POST /api/v1/credentials/request
   * Request credentials from the system (e.g., patient requests their health records)
   */
  r.post("/credentials/request", authenticateApiKey, requireScope("credentials:request"), async (req: Request, res: Response) => {
    const start = Date.now();
    try {
      const ctx = (req as any).walletCtx as ExternalWalletContext;
      const { credentialTypes, patientId, purpose, consentRef } = req.body || {};

      if (!credentialTypes || !Array.isArray(credentialTypes) || credentialTypes.length === 0) {
        res.status(400).json({ error: "missing_types", message: "credentialTypes array is required" });
        return;
      }

      const targetPatientId = patientId || ctx.patientId;
      if (!targetPatientId) {
        res.status(400).json({ error: "missing_patient", message: "patientId required (in body or session)" });
        return;
      }

      // Find matching credentials
      const credentials = await db.listIssuedCredentials({ subjectId: targetPatientId });
      const matching = credentials.filter((c: any) => 
        credentialTypes.includes(c.type) && c.status === "active"
      );

      const requestId = `req_${crypto.randomBytes(12).toString("hex")}`;

      await auditLog(req, "credentials.request", 200, "success", {
        patientId: targetPatientId,
        resourceType: "credential_request",
        resourceId: requestId,
        durationMs: Date.now() - start,
      });

      res.json({
        requestId,
        status: matching.length > 0 ? "available" : "not_found",
        availableCredentials: matching.map((c: any) => ({
          credentialId: c.credentialId,
          type: c.type,
          issuedAt: c.issuedAt,
          expiresAt: c.expiresAt,
          issuerName: c.issuerName,
          status: c.status,
        })),
        total: matching.length,
        message: matching.length > 0
          ? "Credentials available. Use /credentials/download to retrieve."
          : "No matching credentials found for the requested types.",
      });
    } catch (err: any) {
      await auditLog(req, "credentials.request", 500, "error", { errorMessage: err.message });
      res.status(500).json({ error: "internal_error", message: err.message });
    }
  });

  /**
   * GET /api/v1/credentials/status/:credentialId
   * Check the status of a specific credential
   */
  r.get("/credentials/status/:credentialId", authenticateApiKey, requireScope("credentials:read"), async (req: Request, res: Response) => {
    const start = Date.now();
    try {
      const credential = await db.getIssuedCredentialByCredentialId(req.params.credentialId);
      if (!credential) {
        await auditLog(req, "credentials.status", 404, "error", { errorMessage: "Credential not found" });
        res.status(404).json({ error: "not_found", message: "Credential not found" });
        return;
      }

      await auditLog(req, "credentials.status", 200, "success", {
        resourceType: "credential",
        resourceId: req.params.credentialId,
        durationMs: Date.now() - start,
      });

      res.json({
        credentialId: credential.credentialId,
        type: credential.type,
        status: credential.status,
        issuedAt: credential.issuedAt,
        expiresAt: credential.expiresAt,
        issuerId: credential.issuerId,
        issuerHospitalId: credential.issuerHospitalId,
        revoked: credential.status === "revoked",
        revokedAt: credential.revokedAt || null,
      });
    } catch (err: any) {
      await auditLog(req, "credentials.status", 500, "error", { errorMessage: err.message });
      res.status(500).json({ error: "internal_error", message: err.message });
    }
  });

  // ─── SHL Integration ────────────────────────────────────────

  /**
   * POST /api/v1/shl/resolve
   * Resolve a SMART Health Link and get the manifest
   */
  r.post("/shl/resolve", authenticateApiKey, requireScope("shl:resolve"), async (req: Request, res: Response) => {
    const start = Date.now();
    try {
      const ctx = (req as any).walletCtx as ExternalWalletContext;
      const { shlUrl, manifestToken, passcode, recipient } = req.body || {};

      let token = manifestToken;
      if (shlUrl && !token) {
        // Extract manifest token from SHL URL (shlink:/ format)
        const match = shlUrl.match(/[?&]manifest=([^&]+)/);
        if (match) token = match[1];
      }

      if (!token) {
        res.status(400).json({ error: "missing_token", message: "manifestToken or shlUrl is required" });
        return;
      }

      const shl = await db.getShlByManifestToken(token);
      if (!shl) {
        await auditLog(req, "shl.resolve", 404, "error", { errorMessage: "SHL not found" });
        res.status(404).json({ error: "not_found", message: "Smart Health Link not found or expired" });
        return;
      }

      // Check expiry
      if (shl.expiresAt && new Date(shl.expiresAt) < new Date()) {
        res.status(410).json({ error: "expired", message: "Smart Health Link has expired" });
        return;
      }

      // Check passcode
      if (shl.passcodeHash && !passcode) {
        res.status(401).json({ error: "passcode_required", message: "This SHL requires a passcode", requiresPasscode: true });
        return;
      }

      if (shl.passcodeHash && passcode) {
        const inputHash = hashApiKey(passcode);
        if (inputHash !== shl.passcodeHash) {
          res.status(401).json({ error: "invalid_passcode", message: "Incorrect passcode" });
          return;
        }
      }

      // Log access
      await db.createShlAccessLog({
        shlId: shl.id,
        accessorName: ctx.appId,
        accessorOrg: recipient || ctx.appId,
        result: "external_wallet_resolve",
        ipAddress: req.ip || undefined,
      });

      // Get manifest documents
      const manifestDocs = await db.listShlManifestDocuments(shl.id);
      const files = await db.listShlFiles(shl.id);

      await auditLog(req, "shl.resolve", 200, "success", {
        patientId: shl.patientId || undefined,
        resourceType: "shl",
        resourceId: String(shl.id),
        durationMs: Date.now() - start,
      });

      res.json({
        shlId: shl.id,
        label: shl.label,
        patientId: shl.patientId,
        status: shl.status,
        createdAt: shl.createdAt,
        expiresAt: shl.expiresAt,
        fileCount: files.length,
        manifestDocuments: manifestDocs.map((doc: any) => ({
          documentId: doc.documentId,
          documentType: doc.documentType,
          title: doc.title,
          category: doc.category,
          status: doc.status,
          sourceRole: doc.sourceRole,
          fhirResource: doc.fhirResource,
          contentHash: doc.contentHash,
        })),
        files: files.map((f: any) => ({
          fileId: f.fileId,
          contentType: f.contentType,
          label: f.label,
          embedded: f.contentType === "application/smart-health-card" ? undefined : null,
        })),
      });
    } catch (err: any) {
      await auditLog(req, "shl.resolve", 500, "error", { errorMessage: err.message });
      res.status(500).json({ error: "internal_error", message: err.message });
    }
  });

  /**
   * POST /api/v1/shl/access
   * Access specific SHL files (download content)
   */
  r.post("/shl/access", authenticateApiKey, requireScope("shl:resolve"), async (req: Request, res: Response) => {
    const start = Date.now();
    try {
      const { shlId, fileIds, passcode } = req.body || {};

      if (!shlId) {
        res.status(400).json({ error: "missing_shl_id", message: "shlId is required" });
        return;
      }

      const shl = await db.getShlById(shlId);
      if (!shl) {
        res.status(404).json({ error: "not_found", message: "SHL not found" });
        return;
      }

      // Check passcode if required
      if (shl.passcodeHash && passcode) {
        const inputHash = hashApiKey(passcode);
        if (inputHash !== shl.passcodeHash) {
          res.status(401).json({ error: "invalid_passcode", message: "Incorrect passcode" });
          return;
        }
      }

      const allFiles = await db.listShlFiles(shlId);
      const targetFiles = fileIds && fileIds.length > 0
        ? allFiles.filter((f: any) => fileIds.includes(f.fileId))
        : allFiles;

      await auditLog(req, "shl.access", 200, "success", {
        resourceType: "shl",
        resourceId: String(shlId),
        durationMs: Date.now() - start,
      });

      res.json({
        shlId,
        files: targetFiles.map((f: any) => ({
          fileId: f.fileId,
          contentType: f.contentType,
          label: f.label,
          content: f.contentJson, // FHIR Bundle or JWS
        })),
      });
    } catch (err: any) {
      await auditLog(req, "shl.access", 500, "error", { errorMessage: err.message });
      res.status(500).json({ error: "internal_error", message: err.message });
    }
  });

  // ─── Patient Identity ───────────────────────────────────────

  /**
   * POST /api/v1/identity/link
   * Link an external wallet DID to a patient in the system
   */
  r.post("/identity/link", authenticateApiKey, requireScope("identity:link"), async (req: Request, res: Response) => {
    const start = Date.now();
    try {
      const ctx = (req as any).walletCtx as ExternalWalletContext;
      const { patientId, did, identifierType, identifierValue, verificationProof } = req.body || {};

      if (!did) {
        res.status(400).json({ error: "missing_did", message: "DID is required" });
        return;
      }

      if (!patientId && !identifierValue) {
        res.status(400).json({ error: "missing_patient_ref", message: "Either patientId or identifierValue (HN/CID) required" });
        return;
      }

      // Find patient
      let resolvedPatientId = patientId;
      if (!resolvedPatientId && identifierValue) {
        const identifier = await db.findPatientByIdentifier(identifierType || "citizen_id", identifierValue);
        if (identifier) resolvedPatientId = identifier.patientId;
      }

      if (!resolvedPatientId) {
        res.status(404).json({ error: "patient_not_found", message: "Could not resolve patient from provided identifiers" });
        return;
      }

      // Create or update wallet connection
      const connectionId = await db.createWalkInWalletConnection({
        connectionId: `conn_ext_${crypto.randomBytes(8).toString("hex")}`,
        holderDid: did,
        patientId: resolvedPatientId,
        walletStatus: verificationProof ? "active" : "invitation_sent",
        identityConfidence: verificationProof ? "high" : "low",
        connectedBy: undefined,
        connectedAt: verificationProof ? new Date() : undefined,
      });

      await auditLog(req, "identity.link", 200, "success", {
        patientId: resolvedPatientId,
        resourceType: "wallet_connection",
        resourceId: String(connectionId),
        durationMs: Date.now() - start,
      });

      res.json({
        connectionId,
        patientId: resolvedPatientId,
        did,
        status: verificationProof ? "identity_confirmed" : "pending_verification",
        message: verificationProof
          ? "Identity linked successfully with verification proof"
          : "Identity link initiated. Verification required to complete.",
      });
    } catch (err: any) {
      await auditLog(req, "identity.link", 500, "error", { errorMessage: err.message });
      res.status(500).json({ error: "internal_error", message: err.message });
    }
  });

  /**
   * GET /api/v1/identity/verify
   * Verify DID-patient binding status
   */
  r.get("/identity/verify", authenticateApiKey, requireScope("identity:read"), async (req: Request, res: Response) => {
    const start = Date.now();
    try {
      const ctx = (req as any).walletCtx as ExternalWalletContext;
      const did = req.query.did as string;
      const patientId = req.query.patientId ? Number(req.query.patientId) : undefined;

      if (!did && !patientId) {
        res.status(400).json({ error: "missing_params", message: "Either did or patientId query param required" });
        return;
      }

      const connections = await db.listWalkInWalletConnections();
      const filtered = connections.filter((c: any) => {
        if (did && c.holderDid !== did) return false;
        if (patientId && c.patientId !== patientId) return false;
        return true;
      });

      await auditLog(req, "identity.verify", 200, "success", { durationMs: Date.now() - start });

      res.json({
        bindings: filtered.map((c: any) => ({
          connectionId: c.connectionId,
          patientId: c.patientId,
          holderDid: c.holderDid,
          walletStatus: c.walletStatus,
          identityConfidence: c.identityConfidence,
          connectedAt: c.connectedAt,
        })),
        total: filtered.length,
      });
    } catch (err: any) {
      await auditLog(req, "identity.verify", 500, "error", { errorMessage: err.message });
      res.status(500).json({ error: "internal_error", message: err.message });
    }
  });

  // ─── Document Exchange ──────────────────────────────────────

  /**
   * POST /api/v1/documents/submit
   * Submit documents to the system from external wallet
   */
  r.post("/documents/submit", authenticateApiKey, requireScope("documents:write"), async (req: Request, res: Response) => {
    const start = Date.now();
    try {
      const ctx = (req as any).walletCtx as ExternalWalletContext;
      const { patientId, documents, context, consentRef } = req.body || {};

      const targetPatientId = patientId || ctx.patientId;
      if (!targetPatientId) {
        res.status(400).json({ error: "missing_patient", message: "patientId required" });
        return;
      }

      if (!documents || !Array.isArray(documents) || documents.length === 0) {
        res.status(400).json({ error: "missing_documents", message: "documents array is required" });
        return;
      }

      const results = [];
      for (const doc of documents) {
        const importId = `imp_ext_${crypto.randomBytes(8).toString("hex")}`;
        await db.createWalletImportJob({
          importId,
          patientId: targetPatientId,
          context: context || "opd_visit",
          sourceType: "patient_upload",
          documentType: doc.documentType || "other",
          consentRef: consentRef || null,
          status: "queued",
          documentReferenceJson: doc.fhirDocumentReference || null,
          hash: doc.hash || null,
          createdBy: null,
        });
        results.push({ importId, documentType: doc.documentType, status: "queued" });
      }

      await auditLog(req, "documents.submit", 200, "success", {
        patientId: targetPatientId,
        resourceType: "document_import",
        durationMs: Date.now() - start,
      });

      res.json({
        status: "accepted",
        imports: results,
        total: results.length,
        message: `${results.length} document(s) queued for processing`,
      });
    } catch (err: any) {
      await auditLog(req, "documents.submit", 500, "error", { errorMessage: err.message });
      res.status(500).json({ error: "internal_error", message: err.message });
    }
  });

  /**
   * GET /api/v1/documents/available
   * List available documents for a patient
   */
  r.get("/documents/available", authenticateApiKey, requireScope("documents:read"), async (req: Request, res: Response) => {
    const start = Date.now();
    try {
      const ctx = (req as any).walletCtx as ExternalWalletContext;
      const patientId = req.query.patientId ? Number(req.query.patientId) : ctx.patientId;

      if (!patientId) {
        res.status(400).json({ error: "missing_patient", message: "patientId query param or session binding required" });
        return;
      }

      const credentials = await db.listIssuedCredentials({ subjectId: patientId });
      const activeCredentials = credentials.filter((c: any) => c.status === "active");

      await auditLog(req, "documents.available", 200, "success", {
        patientId,
        durationMs: Date.now() - start,
      });

      res.json({
        patientId,
        documents: activeCredentials.map((c: any) => ({
          credentialId: c.credentialId,
          type: c.type,
          documentCategory: c.documentCategory || "clinical",
          title: c.title || c.type,
          issuedAt: c.issuedAt,
          expiresAt: c.expiresAt,
          issuerName: c.issuerName,
          status: c.status,
        })),
        total: activeCredentials.length,
      });
    } catch (err: any) {
      await auditLog(req, "documents.available", 500, "error", { errorMessage: err.message });
      res.status(500).json({ error: "internal_error", message: err.message });
    }
  });

  // ─── API Info ───────────────────────────────────────────────

  /**
   * GET /api/v1/info
   * Public endpoint - API information and capabilities
   */
  r.get("/info", (_req: Request, res: Response) => {
    res.json({
      name: "Trustcare Hospital Network - External Wallet API",
      version: "1.0.0",
      description: "REST API for third-party wallet applications to connect to the Trustcare Hospital Network",
      endpoints: {
        authentication: "POST /api/v1/wallet/authenticate",
        contracts: "GET /api/v1/contracts",
        contractDetail: "GET /api/v1/contracts/:contractId",
        credentialPresent: "POST /api/v1/credentials/present",
        credentialRequest: "POST /api/v1/credentials/request",
        credentialStatus: "GET /api/v1/credentials/status/:credentialId",
        shlResolve: "POST /api/v1/shl/resolve",
        shlAccess: "POST /api/v1/shl/access",
        identityLink: "POST /api/v1/identity/link",
        identityVerify: "GET /api/v1/identity/verify",
        documentsSubmit: "POST /api/v1/documents/submit",
        documentsAvailable: "GET /api/v1/documents/available",
      },
      scopes: [
        "contracts:read",
        "credentials:read",
        "credentials:present",
        "credentials:request",
        "shl:resolve",
        "identity:link",
        "identity:read",
        "documents:read",
        "documents:write",
      ],
      authentication: {
        method: "API Key + Bearer Token",
        flow: "1. Register app → 2. Get API key → 3. POST /wallet/authenticate → 4. Use Bearer token",
      },
    });
  });

  return r;
}

// ============================================================
// EXPORTS FOR ADMIN USE (tRPC router)
// ============================================================


