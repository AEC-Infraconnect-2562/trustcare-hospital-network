import { describe, it, expect } from "vitest";

const TEST_BASE_URL = process.env.TRUSTCARE_TEST_BASE_URL ?? "http://localhost:3000";

async function isServerAvailable() {
  try {
    await fetch(TEST_BASE_URL, { method: "HEAD" });
    return true;
  } catch {
    return false;
  }
}

const describeIfServer = (await isServerAvailable()) ? describe : describe.skip;

describeIfServer("Document Bundle Upload Route", () => {
  it("should reject unauthenticated requests", async () => {
    const res = await fetch(`${TEST_BASE_URL}/api/bundles/1/upload`, {
      method: "POST",
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("should reject invalid bundleId", async () => {
    const res = await fetch(`${TEST_BASE_URL}/api/bundles/abc/upload`, {
      method: "POST",
      headers: { Authorization: "Bearer invalid-token" },
    });
    expect(res.status).toBe(401);
  });

  it("should have the upload endpoint registered", async () => {
    // OPTIONS request to check route exists (CORS preflight)
    const res = await fetch(`${TEST_BASE_URL}/api/bundles/999/upload`, {
      method: "POST",
      body: new FormData(),
    });
    // Should get 401 (unauthorized) not 404 (route not found)
    expect(res.status).not.toBe(404);
  });
});

describeIfServer("Document Bundle tRPC Procedures", () => {
  it("getBundles should require authentication", async () => {
    const res = await fetch(`${TEST_BASE_URL}/api/trpc/careTransition.getBundles?input=%7B%22caseType%22%3A%22internal_referral%22%2C%22caseId%22%3A1%7D`, {
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(401);
  });

  it("createBundle should require authentication", async () => {
    const res = await fetch(`${TEST_BASE_URL}/api/trpc/careTransition.createBundle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        caseType: "internal_referral",
        caseId: 1,
        title: "Test Bundle",
        bundleType: "mixed",
      }),
    });
    expect(res.status).toBe(401);
  });

  it("updateBundleStatus should require authentication", async () => {
    const res = await fetch(`${TEST_BASE_URL}/api/trpc/careTransition.updateBundleStatus`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bundleId: 1,
        status: "submitted",
      }),
    });
    expect(res.status).toBe(401);
  });
});
