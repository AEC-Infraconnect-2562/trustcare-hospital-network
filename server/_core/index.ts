import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerClaimRoutes } from "./claimRoutes";
import { registerShlRoutes } from "./shlRoutes";
import { registerStorageProxy } from "./storageProxy";
import { registerUploadRoutes } from "../uploadRoute";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

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
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerClaimRoutes(app);
  registerShlRoutes(app);
  registerUploadRoutes(app);

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

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
