import type { Express, Request, Response } from "express";
import * as db from "../db";
import { resolveShlManifestAccessPacket, ShlAccessError } from "../shlAccess";

export function registerShlRoutes(app: Express) {
  const handler = async (req: Request, res: Response) => {
    try {
      const shl = await db.getShlByManifestToken(req.params.manifestToken);
      if (!shl) return res.status(404).json({ error: "SHL not found" });
      const body = req.method === "GET" ? req.query : req.body;
      const manifest = await resolveShlManifestAccessPacket({
        shl,
        recipient: String(body.recipient ?? body.accessorOrg ?? body.accessorName ?? "external-viewer"),
        passcode: typeof body.passcode === "string" ? body.passcode : undefined,
        embeddedLengthMax: body.embeddedLengthMax ? Number(body.embeddedLengthMax) : undefined,
        accessorName: typeof body.accessorName === "string" ? body.accessorName : undefined,
        accessorOrg: typeof body.accessorOrg === "string" ? body.accessorOrg : undefined,
        accessorCountry: typeof body.accessorCountry === "string" ? body.accessorCountry.slice(0, 3) : undefined,
        userAgent: req.get("user-agent") ?? undefined,
        ipAddress: req.ip,
      });
      res.set("Cache-Control", "no-store");
      return res.json(manifest);
    } catch (error) {
      if (error instanceof ShlAccessError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      console.error("[SHL] Manifest access failed:", error);
      return res.status(500).json({ error: "SHL manifest access failed" });
    }
  };

  app.post("/api/shl/manifest/:manifestToken", handler);
  app.get("/api/shl/manifest/:manifestToken", handler);
}
