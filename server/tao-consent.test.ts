import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createPatientContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "patient-user",
    email: "patient@trustcare.th",
    name: "Patient User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@trustcare.th",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

describe("TAO Trust Registry", () => {
  const caller = appRouter.createCaller(createAdminContext());

  it("should list TAO trusted issuers", async () => {
    const result = await caller.tao.issuers({});
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it("should list TAO trusted verifiers", async () => {
    const result = await caller.tao.verifiers({});
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it("should list TAO trust policies", async () => {
    const result = await caller.tao.policies({});
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it("should check issuer trust for known DID", async () => {
    const result = await caller.tao.checkIssuerTrust({
      issuerDid: "did:web:siriraj.mahidol.ac.th",
      credentialType: "PatientSummaryCredential",
    });
    expect(result).toBeDefined();
    expect(typeof result.trusted).toBe("boolean");
    expect(typeof result.level).toBe("string");
    expect(typeof result.anchor).toBe("string");
  });

  it("should return untrusted for unknown DID", async () => {
    const result = await caller.tao.checkIssuerTrust({
      issuerDid: "did:web:unknown-hospital.example.com",
      credentialType: "PatientSummaryCredential",
    });
    expect(result.trusted).toBe(false);
    expect(result.level).toBe("unknown");
  });
});

describe("Consent Check & History", () => {
  const patientCaller = appRouter.createCaller(createPatientContext());

  it("should check consent for patient", async () => {
    const result = await patientCaller.consent.check({
      patientId: 2,
      purpose: "treatment",
    });
    expect(result).toBeDefined();
    expect(typeof result.hasConsent).toBe("boolean");
  });

  it("should return consent history for patient", async () => {
    const result = await patientCaller.consent.history({});
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it("should return hasConsent false when no consent exists", async () => {
    const result = await patientCaller.consent.check({
      patientId: 999,
      purpose: "research",
    });
    expect(result.hasConsent).toBe(false);
    expect(result.consentId).toBeNull();
  });
});

describe("Wallet Category Navigation", () => {
  const patientCaller = appRouter.createCaller(createPatientContext());

  it("should return cards grouped by category", async () => {
    const result = await patientCaller.wallet.cardsByCategory();
    expect(result).toBeDefined();
    expect(typeof result).toBe("object");
  });

  it("should return superseded credentials", async () => {
    const result = await patientCaller.wallet.superseded();
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });
});
