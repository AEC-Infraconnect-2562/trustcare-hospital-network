import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { hospitalDidWeb } from "./portability/did";
import { PERSON_IMAGE_URLS } from "../shared/personImages";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.resetModules();
});

describe("Railway deployment contract", () => {
  it("contains valid config-as-code commands", () => {
    const config = JSON.parse(fs.readFileSync(path.resolve("railway.json"), "utf8"));
    expect(config.build.builder).toBe("RAILPACK");
    expect(config.deploy.preDeployCommand).toHaveLength(1);
    expect(config.deploy.preDeployCommand[0]).toContain("corepack pnpm@10.4.1 db:migrate:production");
    expect(config.deploy.preDeployCommand[0]).toContain("corepack pnpm@10.4.1 bootstrap:railway");
    expect(config.deploy.healthcheckPath).toBe("/api/health");
  });

  it("keeps a clean production migration stream for fresh MySQL installs", () => {
    const journalPath = path.resolve("drizzle-production/meta/_journal.json");
    expect(fs.existsSync(journalPath)).toBe(true);
    const journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));
    expect(journal.dialect).toBe("mysql");
    expect(journal.entries).toHaveLength(1);
  });

  it("supports did:web on a Railway-generated domain", () => {
    expect(hospitalDidWeb("TCC", "trustcare-portal.up.railway.app"))
      .toBe("did:web:trustcare-portal.up.railway.app:hospital:tcc");
  });

  it("ships every default person image as an application asset", () => {
    for (const imageUrl of Object.values(PERSON_IMAGE_URLS)) {
      expect(imageUrl.startsWith("/seed-avatars/")).toBe(true);
      expect(fs.existsSync(path.resolve("client/public", imageUrl.slice(1)))).toBe(true);
    }
  });

  it("detects Railway S3 credentials without contacting the bucket", async () => {
    process.env.STORAGE_BACKEND = "s3";
    process.env.BUCKET = "trustcare-files-test";
    process.env.ACCESS_KEY_ID = "test-access-key";
    process.env.SECRET_ACCESS_KEY = "test-secret-key";
    process.env.REGION = "auto";
    process.env.ENDPOINT = "https://storage.railway.app";
    vi.resetModules();

    const { storageBackendStatus } = await import("./storage");
    expect(storageBackendStatus()).toEqual({ configured: true, backend: "s3" });
  });
});
