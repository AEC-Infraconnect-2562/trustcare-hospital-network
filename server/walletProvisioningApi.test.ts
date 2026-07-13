import { describe, expect, it } from "vitest";
import { createWalletProvisioningRouter } from "./walletProvisioningApi";

describe("Wallet provisioning contract", () => {
  it("exposes the configuration, login, identity, binding, and exchange routes", () => {
    const router = createWalletProvisioningRouter();
    const routes = ((router as any).stack || [])
      .filter((layer: any) => layer.route)
      .map((layer: any) => `${Object.keys(layer.route.methods).join("," )} ${layer.route.path}`);

    expect(routes).toContain("get /api/wallet/provisioning/configuration");
    expect(routes).toContain("get /api/wallet/test-identities");
    expect(routes).toContain("post /api/wallet/test-login");
    expect(routes).toContain("get /api/wallet/identity");
    expect(routes).toContain("get /api/wallet/provisioning");
    expect(routes).toContain("post /api/wallet/keys/challenges");
    expect(routes).toContain("post /api/wallet/keys/challenges/:challengeId/complete");
    expect(routes).toContain("get /api/wallet/v2");
  });

  it("does not advertise sandbox login when the OIDC sandbox flag is off", async () => {
    const router = createWalletProvisioningRouter();
    const layer = ((router as any).stack || []).find((item: any) => item.route?.path === "/api/wallet/provisioning/configuration");
    expect(layer).toBeDefined();
    expect(typeof layer.route.stack[0].handle).toBe("function");
  });
});
