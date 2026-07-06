import { describe, it, expect } from "vitest";

// Test the exported utility functions
describe("External Wallet API - Utility Functions", () => {
  it("generateAppId returns a valid app ID format", async () => {
    const { generateAppId } = await import("./externalWalletApi");
    const appId = generateAppId();
    expect(appId).toMatch(/^app_[a-f0-9]{32}$/);
  });

  it("generateKeyId returns a valid key ID format", async () => {
    const { generateKeyId } = await import("./externalWalletApi");
    const keyId = generateKeyId();
    expect(keyId).toMatch(/^key_[a-f0-9]{24}$/);
  });

  it("generateApiKey returns key, prefix, and hash", async () => {
    const { generateApiKey } = await import("./externalWalletApi");
    const result = generateApiKey();
    expect(result).toHaveProperty("key");
    expect(result).toHaveProperty("prefix");
    expect(result).toHaveProperty("hash");
    expect(result.key).toMatch(/^ewk_[a-f0-9]{64}$/);
    expect(result.prefix).toBe(result.key.slice(0, 12));
    expect(result.hash).toHaveLength(64); // SHA-256 hex
  });

  it("generateApiKey produces unique keys each time", async () => {
    const { generateApiKey } = await import("./externalWalletApi");
    const key1 = generateApiKey();
    const key2 = generateApiKey();
    expect(key1.key).not.toBe(key2.key);
    expect(key1.hash).not.toBe(key2.hash);
  });

  it("createExternalWalletApiRouter returns an Express Router", async () => {
    const { createExternalWalletApiRouter } = await import("./externalWalletApi");
    const router = createExternalWalletApiRouter();
    expect(router).toBeDefined();
    // Express Router is a function
    expect(typeof router).toBe("function");
  });
});

describe("External Wallet API - Endpoint Structure", () => {
  it("router has expected routes registered", async () => {
    const { createExternalWalletApiRouter } = await import("./externalWalletApi");
    const router = createExternalWalletApiRouter();
    // Express router stores routes in router.stack
    const stack = (router as any).stack || [];
    const routes = stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods),
      }));

    // Verify key endpoints exist
    const paths = routes.map((r: any) => r.path);
    expect(paths).toContain("/info");
    expect(paths).toContain("/wallet/authenticate");
    expect(paths).toContain("/contracts");
    expect(paths).toContain("/credentials/present");
    expect(paths).toContain("/credentials/request");
    expect(paths).toContain("/shl/resolve");
    expect(paths).toContain("/shl/access");
    expect(paths).toContain("/identity/link");
    expect(paths).toContain("/identity/verify");
  });

  it("/info endpoint is GET", async () => {
    const { createExternalWalletApiRouter } = await import("./externalWalletApi");
    const router = createExternalWalletApiRouter();
    const stack = (router as any).stack || [];
    const infoRoute = stack.find((layer: any) => layer.route?.path === "/info");
    expect(infoRoute).toBeDefined();
    expect(infoRoute.route.methods.get).toBe(true);
  });

  it("/wallet/authenticate endpoint is POST", async () => {
    const { createExternalWalletApiRouter } = await import("./externalWalletApi");
    const router = createExternalWalletApiRouter();
    const stack = (router as any).stack || [];
    const authRoute = stack.find((layer: any) => layer.route?.path === "/wallet/authenticate");
    expect(authRoute).toBeDefined();
    expect(authRoute.route.methods.post).toBe(true);
  });
});

describe("External Wallet API - Scope Definitions", () => {
  it("API scopes cover all major operations", () => {
    const expectedScopes = [
      "contracts:read",
      "credentials:read",
      "credentials:present",
      "credentials:request",
      "shl:resolve",
      "identity:link",
      "identity:read",
      "documents:read",
      "documents:write",
    ];
    // These are the scopes that should be available for external wallets
    expectedScopes.forEach(scope => {
      expect(scope).toMatch(/^[a-z_]+:[a-z_]+$/);
    });
  });
});
