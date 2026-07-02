/**
 * Express multipart file upload route for Document Bundles.
 * POST /api/bundles/:bundleId/upload
 *
 * Accepts multipart/form-data with field "files" (up to 10 files per request).
 * Authenticates via session cookie, stores files to S3 via storagePut,
 * then links each file to the specified bundle via addFileToBundle.
 */
import { Express, Request, Response } from "express";
import multer from "multer";
import crypto from "crypto";
import { sdk } from "./_core/sdk";
import { storagePut } from "./storage";
import * as db from "./db";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB per file
    files: 10,
  },
});

function computeSha256(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export function registerUploadRoutes(app: Express) {
  app.post(
    "/api/bundles/:bundleId/upload",
    upload.array("files", 10),
    async (req: Request, res: Response) => {
      try {
        // Authenticate
        const user = await sdk.authenticateRequest(req as any);
        if (!user) {
          return res.status(401).json({ error: "Unauthorized" });
        }
        // Check staff role (patient blocked)
        const role = (user as any).systemRole || (user as any).role;
        if (role === "patient") {
          return res.status(403).json({ error: "Patient role cannot upload bundle files" });
        }

        const bundleId = parseInt(req.params.bundleId, 10);
        if (isNaN(bundleId)) {
          return res.status(400).json({ error: "Invalid bundleId" });
        }

        // Verify bundle exists
        const bundle = await db.getBundleWithFiles(bundleId);
        if (!bundle) {
          return res.status(404).json({ error: "Bundle not found" });
        }

        // Only allow uploads to draft bundles
        if ((bundle as any).status !== "draft") {
          return res.status(400).json({ error: "Can only upload files to draft bundles" });
        }

        const files = req.files as Express.Multer.File[];
        if (!files || files.length === 0) {
          return res.status(400).json({ error: "No files provided" });
        }

        // Read form fields for metadata
        const caseType = req.body.caseType || (bundle as any).caseType;
        const caseId = parseInt(req.body.caseId || String((bundle as any).caseId), 10);
        const documentType = req.body.documentType || "other";
        const direction = req.body.direction || "inbound";

        const results: Array<{
          fileId: number;
          fileName: string;
          fileUrl: string;
          fileKey: string;
          fileSize: number;
          hash: string;
          mimeType: string;
        }> = [];

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const hash = computeSha256(file.buffer);
          const safeFileName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
          const relKey = `bundles/${bundleId}/${safeFileName}`;

          // Upload to S3
          const { key, url } = await storagePut(relKey, file.buffer, file.mimetype);

          // Add file to bundle in DB
          const fileRecord = await db.addFileToBundle(bundleId, {
            caseType,
            caseId,
            documentType,
            title: file.originalname,
            fileName: file.originalname,
            fileUrl: url,
            fileKey: key,
            mimeType: file.mimetype,
            fileSize: file.size,
            hash,
            direction,
            sortOrder: i,
            receivedBy: user.id,
          });

          results.push({
            fileId: (fileRecord as any).id || (fileRecord as any).insertId,
            fileName: file.originalname,
            fileUrl: url,
            fileKey: key,
            fileSize: file.size,
            hash,
            mimeType: file.mimetype,
          });
        }

        res.json({
          success: true,
          bundleId,
          filesUploaded: results.length,
          files: results,
        });
      } catch (err: any) {
        console.error("[Upload] Error:", err.message);
        if (err.message?.includes("Invalid session") || err.message?.includes("Forbidden")) {
          return res.status(401).json({ error: "Unauthorized" });
        }
        res.status(500).json({ error: "Upload failed: " + err.message });
      }
    }
  );
}
