import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerClaimRoutes } from "./claimRoutes";
import { registerPrepareServiceRoutes } from "./prepareServiceRoutes";
import { registerShlRoutes } from "./shlRoutes";
import { registerStorageProxy } from "./storageProxy";
import { registerUploadRoutes } from "../uploadRoute";
import { createWellKnownRouter } from "../wellKnownRoutes";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { sql } from "drizzle-orm";
import { ENV } from "./env";
import { storageBackendStatus } from "../storage";

function validateRuntimeConfig() {
  if (!ENV.isProduction) return;
  if (!ENV.databaseUrl) throw new Error("DATABASE_URL is required in production");
  if (!ENV.cookieSecret || ENV.cookieSecret.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters in production");
  }
  if (!ENV.appId) throw new Error("VITE_APP_ID is required in production");
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  validateRuntimeConfig();
  const app = express();
  const server = createServer(app);
  app.set("trust proxy", 1);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // ─── CORS for External Wallet (GitHub Pages + localhost) ───────────────────
  const WALLET_CORS_ORIGINS = [
    "https://aec-infraconnect-2562.github.io",
    /^http:\/\/localhost(:\d+)?$/,
    /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  ];
  const WALLET_CORS_PATHS = [
    "/api/auth/demo-login",
    "/api/wallet/sync",
    "/api/wallet/sync/status",
    "/api/wallet/sync/verify",
    "/api/wallet/sync/verify-selective",
    "/api/wallet/sync/present",
    "/api/wallet/sync/did-resolve",
    "/api/wallet/sync/sd-jwt/issue",
    "/api/wallet/sync/sd-jwt/policy",
    "/api/v1/",
    "/.well-known/",
    "/hospital/",
  ];

  function isAllowedOrigin(origin: string | undefined): string | null {
    if (!origin) return null;
    for (const allowed of WALLET_CORS_ORIGINS) {
      if (typeof allowed === "string" && origin === allowed) return origin;
      if (allowed instanceof RegExp && allowed.test(origin)) return origin;
    }
    return null;
  }

  function isWalletPath(path: string): boolean {
    return WALLET_CORS_PATHS.some(p => path.startsWith(p));
  }

  // CORS middleware — must be before route handlers
  // Sets CORS headers for wallet-related paths from allowed origins.
  // Vary: Origin is ALWAYS set on wallet paths to prevent CDN/proxy caching issues.
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const matchedOrigin = isAllowedOrigin(origin);

    if (isWalletPath(req.path)) {
      // Always set Vary: Origin on wallet paths regardless of origin match
      // This prevents CDN from caching a response without CORS headers and serving it to allowed origins
      res.setHeader("Vary", "Origin");

      if (matchedOrigin) {
        res.setHeader("Access-Control-Allow-Origin", matchedOrigin);
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
        res.setHeader("Access-Control-Allow-Credentials", "true");
        res.setHeader("Access-Control-Max-Age", "86400");

        // Handle preflight — respond immediately
        if (req.method === "OPTIONS") {
          return res.status(204).end();
        }
      }
    }
    next();
  });

  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerClaimRoutes(app);
  registerPrepareServiceRoutes(app);
  registerShlRoutes(app);
  registerUploadRoutes(app);

  app.get("/api/health", async (_req, res) => {
    const storage = storageBackendStatus();
    try {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new Error("Database is not configured");
      await db.execute(sql`select 1`);
      const healthy = storage.configured;
      res.status(healthy ? 200 : 503).json({
        status: healthy ? "ok" : "degraded",
        database: "ok",
        storage,
        version: process.env.RAILWAY_GIT_COMMIT_SHA ?? "local",
      });
    } catch (error) {
      res.status(503).json({
        status: "unavailable",
        database: "error",
        storage,
        error: error instanceof Error ? error.message : "Health check failed",
      });
    }
  });

  // Demo Login Route (bypasses OAuth for testing)
  app.post("/api/auth/demo-login", async (req, res) => {
    try {
      const { openId, activeRole } = req.body;
      if (!openId || typeof openId !== "string") {
        return res.status(400).json({ error: "openId is required" });
      }
      const { getUserByOpenId } = await import("../db");
      const user = await getUserByOpenId(openId);
      if (!user) {
        return res.status(404).json({ error: "Demo user not found. Please run seed first." });
      }
      const { sdk: sdkInstance } = await import("./sdk");
      const token = await sdkInstance.createSessionToken(user.openId, { name: user.name || "Demo User" });
      const { getSessionCookieOptions } = await import("./cookies");
      const { COOKIE_NAME } = await import("../../shared/const");
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: 86400000 });
      // If activeRole is specified (e.g., staff logging in as patient), set it
      if (activeRole && typeof activeRole === "string") {
        res.cookie("trustcare_active_role", activeRole, { ...cookieOptions, maxAge: 86400000 });
      } else {
        // Clear any previous activeRole cookie
        res.clearCookie("trustcare_active_role", cookieOptions);
      }
      res.set("Cache-Control", "no-store, no-cache, must-revalidate");
      res.set("Pragma", "no-cache");
      res.json({ success: true, user, token });
    } catch (err: any) {
      console.error("[DemoLogin] Error:", err.message);
      res.status(500).json({ error: "Login failed" });
    }
  });

  // Seed Route
  app.post("/api/seed", async (_req, res) => {
    if (ENV.isProduction && !ENV.allowPublicDemoSeed) {
      return res.status(403).json({ error: "Demo reseed is disabled in production" });
    }
    try {
      const { seedDatabase } = await import("../seed");
      await seedDatabase();
      res.json({ success: true, message: "Database seeded successfully" });
    } catch (err: any) {
      console.error("[Seed] Error:", err.message);
      res.status(500).json({ error: "Seed failed: " + err.message });
    }
  });



  // Scheduled handlers
  app.post("/api/scheduled/consentExpiryReminder", async (req, res) => {
    const { consentExpiryReminderHandler } = await import("../scheduledHandlers/consentExpiry");
    return consentExpiryReminderHandler(req, res);
  });

  // Document Import Webhook (for HIS/LIS/RIS/PACS external systems)
  app.post("/api/webhook/document-import", async (req, res) => {
    const { handleDocumentImportWebhook } = await import("../webhookDocumentImport");
    return handleDocumentImportWebhook(req, res);
  });
  app.get("/api/webhook/document-import/config", async (req, res) => {
    const { handleWebhookConfigList } = await import("../webhookDocumentImport");
    return handleWebhookConfigList(req, res);
  });

  // Well-Known endpoints (JWKS, DID documents)
  app.use(createWellKnownRouter());

  // External Wallet API (REST endpoints for third-party wallets)
  const { createExternalWalletApiRouter } = await import("../externalWalletApi");
  app.use("/api/v1", createExternalWalletApiRouter());

  // Wallet Sync API (credential pull for external wallets)
  const { createWalletSyncRouter } = await import("../walletSyncApi");
  app.use(createWalletSyncRouter());

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
