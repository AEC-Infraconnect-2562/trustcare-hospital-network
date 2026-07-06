import { describe, it, expect } from "vitest";

const BASE = "http://localhost:3000";

describe("Well-Known Endpoints", () => {
  describe("GET /.well-known/jwks.json", () => {
    it("should return a valid JWKS with at least one key", async () => {
      const res = await fetch(`${BASE}/.well-known/jwks.json`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("application/json");
      expect(res.headers.get("cache-control")).toContain("max-age=3600");

      const body = await res.json();
      expect(body.keys).toBeDefined();
      expect(Array.isArray(body.keys)).toBe(true);
      expect(body.keys.length).toBeGreaterThan(0);
      expect(body.issuer).toBe("did:web:trustcare.network");

      // Each key should have required JWK fields
      for (const key of body.keys) {
        expect(key.kty).toBeDefined();
        expect(key.kid).toBeDefined();
        expect(key.alg).toBeDefined();
      }
    });

    it("should include the network-level ES256 signing key", async () => {
      const res = await fetch(`${BASE}/.well-known/jwks.json`);
      const body = await res.json();
      const networkKey = body.keys.find((k: any) =>
        k.kid?.includes("did:web:trustcare.network#vc-signing-key")
      );
      expect(networkKey).toBeDefined();
      expect(networkKey.alg).toBe("ES256");
      expect(networkKey.kty).toBe("EC");
      expect(networkKey.crv).toBe("P-256");
      expect(networkKey.x).toBeDefined();
      expect(networkKey.y).toBeDefined();
      // Should NOT expose private key
      expect(networkKey.d).toBeUndefined();
    });
  });

  describe("GET /.well-known/did.json", () => {
    it("should return a valid DID document for did:web:trustcare.network", async () => {
      const res = await fetch(`${BASE}/.well-known/did.json`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("application/did+ld+json");

      const body = await res.json();
      expect(body["@context"]).toContain("https://www.w3.org/ns/did/v1");
      expect(body.id).toBe("did:web:trustcare.network");
      expect(body.verificationMethod).toBeDefined();
      expect(body.verificationMethod.length).toBeGreaterThan(0);
      expect(body.assertionMethod).toBeDefined();
      expect(body.authentication).toBeDefined();
      expect(body.service).toBeDefined();
    });

    it("should include service endpoints for portability, JWKS, and wallet API", async () => {
      const res = await fetch(`${BASE}/.well-known/did.json`);
      const body = await res.json();
      const serviceTypes = body.service.map((s: any) => s.type);
      expect(serviceTypes).toContain("TrustCarePortabilityEndpoint");
      expect(serviceTypes).toContain("JsonWebKeySet");
      expect(serviceTypes).toContain("ExternalWalletAPI");
    });
  });

  describe("GET /hospital/:code/.well-known/did.json", () => {
    it("should return DID document for a known hospital", async () => {
      const res = await fetch(`${BASE}/hospital/tcc/.well-known/did.json`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("application/did+ld+json");

      const body = await res.json();
      expect(body.id).toBe("did:web:trustcare.network:hospital:tcc");
      expect(body.verificationMethod).toBeDefined();
      expect(body.verificationMethod.length).toBeGreaterThan(0);
    });

    it("should return 404 for unknown hospital code", async () => {
      const res = await fetch(`${BASE}/hospital/unknown_xyz/.well-known/did.json`);
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toContain("not found");
    });
  });

  describe("GET /.well-known/did-configuration.json", () => {
    it("should return a valid DID configuration with domain linkage", async () => {
      const res = await fetch(`${BASE}/.well-known/did-configuration.json`);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body["@context"]).toContain("did-configuration");
      expect(body.linked_dids).toBeDefined();
      expect(body.linked_dids.length).toBeGreaterThan(0);
      expect(body.linked_dids[0].issuer).toBe("did:web:trustcare.network");
      expect(body.linked_dids[0].credentialSubject.origin).toBe("https://trustcarehealth.live");
    });
  });
});
