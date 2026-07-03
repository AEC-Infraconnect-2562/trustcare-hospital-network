import type { Express, Response } from "express";
import { ENV } from "./env";

/**
 * Storage proxy that streams files through the server instead of redirecting.
 * 
 * Why stream instead of 307 redirect:
 * - In production, /manus-storage/* is intercepted by the platform infrastructure
 *   and returns 307 to CloudFront signed URLs (cross-origin)
 * - Service workers and some browsers (Safari ITP, Chrome strict) fail to
 *   render cross-origin redirected images in <img> tags
 * - We provide /api/storage-proxy/* which goes through Express directly,
 *   streaming file bytes same-origin with proper Cache-Control headers
 */
export function registerStorageProxy(app: Express) {
  // Primary route: bypasses platform's 307 redirect handler in production.
  // All frontend image URLs should use this path.
  app.get("/api/storage-proxy/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) { res.status(400).send("Missing storage key"); return; }
    await streamStorageFile(key, res);
  });

  // Legacy route: works in dev (Express handles it before platform).
  // In production this is intercepted by the platform → 307 redirect.
  // Kept for backward compatibility with any direct /manus-storage/ references.
  app.get("/manus-storage/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) { res.status(400).send("Missing storage key"); return; }
    await streamStorageFile(key, res);
  });
}

/** Stream a storage file by key through our server */
async function streamStorageFile(key: string, res: Response): Promise<void> {
  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
    res.status(500).send("Storage proxy not configured");
    return;
  }

  try {
    // Step 1: Get the presigned URL from forge
    const forgeUrl = new URL(
      "v1/storage/presign/get",
      ENV.forgeApiUrl.replace(/\/+$/, "") + "/",
    );
    forgeUrl.searchParams.set("path", key);

    const forgeResp = await fetch(forgeUrl, {
      headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
    });

    if (!forgeResp.ok) {
      const body = await forgeResp.text().catch(() => "");
      console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
      res.status(502).send("Storage backend error");
      return;
    }

    const { url } = (await forgeResp.json()) as { url: string };
    if (!url) {
      res.status(502).send("Empty signed URL from backend");
      return;
    }

    // Step 2: Fetch the actual file from CloudFront and stream it through
    const fileResp = await fetch(url);
    if (!fileResp.ok) {
      console.error(`[StorageProxy] CloudFront error: ${fileResp.status}`);
      res.status(502).send("File fetch error");
      return;
    }

    // Determine content type from response or file extension
    const contentType = fileResp.headers.get("content-type") || getMimeType(key);
    const contentLength = fileResp.headers.get("content-length");

    // Set response headers
    res.set("Content-Type", contentType);
    if (contentLength) {
      res.set("Content-Length", contentLength);
    }

    // Cache images for 1 hour, other files for 5 minutes
    const isImage = contentType.startsWith("image/");
    res.set("Cache-Control", isImage ? "public, max-age=3600, stale-while-revalidate=86400" : "public, max-age=300");
    res.set("X-Content-Type-Options", "nosniff");

    // Stream the response body to the client
    if (fileResp.body) {
      const reader = fileResp.body.getReader();
      const pump = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!res.writableEnded) {
            res.write(Buffer.from(value));
          }
        }
        if (!res.writableEnded) {
          res.end();
        }
      };
      pump().catch((err) => {
        console.error("[StorageProxy] stream error:", err);
        if (!res.headersSent) {
          res.status(502).send("Stream error");
        } else if (!res.writableEnded) {
          res.end();
        }
      });
    } else {
      // Fallback: read entire body as buffer
      const buffer = Buffer.from(await fileResp.arrayBuffer());
      res.set("Content-Length", String(buffer.length));
      res.send(buffer);
    }
  } catch (err) {
    console.error("[StorageProxy] failed:", err);
    if (!res.headersSent) {
      res.status(502).send("Storage proxy error");
    }
  }
}

/** Guess MIME type from file extension */
function getMimeType(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase() || "";
  const mimeMap: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    bmp: "image/bmp",
    pdf: "application/pdf",
    json: "application/json",
    mp3: "audio/mpeg",
    mp4: "video/mp4",
    webm: "video/webm",
  };
  return mimeMap[ext] || "application/octet-stream";
}
