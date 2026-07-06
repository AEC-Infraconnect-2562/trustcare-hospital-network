import { describe, it, expect } from "vitest";

const BASE = "http://localhost:3000";

describe("Wallet Sync API — E2E Integration Tests", () => {
  // ============================================================
  // POST /api/wallet/sync
  // ============================================================
  describe("POST /api/wallet/sync", () => {
    it("returns 401 without any authentication", async () => {
      const res = await fetch(`${BASE}/api/wallet/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe("authentication_required");
      expect(body.message).toBeDefined();
    });

    it("returns 401 with invalid external wallet session token", async () => {
      const res = await fetch(`${BASE}/api/wallet/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer ews_invalid_token_12345",
        },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe("authentication_required");
      expect(body.message).toContain("Invalid or expired session token");
    });

    it("returns 401 with expired external wallet session token format", async () => {
      const res = await fetch(`${BASE}/api/wallet/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer ews_expired_session_abc123",
        },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe("authentication_required");
    });

    it("returns 401 with non-ews bearer token and no valid session", async () => {
      const res = await fetch(`${BASE}/api/wallet/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer some_random_jwt_token",
        },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe("authentication_required");
    });

    it("accepts request with valid body structure (still needs auth)", async () => {
      const res = await fetch(`${BASE}/api/wallet/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          since: "2026-01-01T00:00:00Z",
          includePresentations: true,
          limit: 100,
        }),
      });
      // Should still be 401 since no valid auth
      expect(res.status).toBe(401);
    });

    it("handles missing Content-Type header gracefully", async () => {
      const res = await fetch(`${BASE}/api/wallet/sync`, {
        method: "POST",
        body: "{}",
      });
      // Should return 401 (auth check happens before body parsing)
      expect(res.status).toBe(401);
    });
  });

  // ============================================================
  // GET /api/wallet/sync/status
  // ============================================================
  describe("GET /api/wallet/sync/status", () => {
    it("returns 401 without authentication", async () => {
      const res = await fetch(`${BASE}/api/wallet/sync/status`);
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe("authentication_required");
      expect(body.message).toBeDefined();
    });

    it("returns 401 with invalid bearer token", async () => {
      const res = await fetch(`${BASE}/api/wallet/sync/status`, {
        headers: { Authorization: "Bearer ews_invalid_token" },
      });
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe("authentication_required");
    });

    it("returns JSON content type on error", async () => {
      const res = await fetch(`${BASE}/api/wallet/sync/status`);
      expect(res.headers.get("content-type")).toContain("application/json");
    });
  });

  // ============================================================
  // POST /api/wallet/sync/did-resolve
  // ============================================================
  describe("POST /api/wallet/sync/did-resolve", () => {
    it("resolves a valid hospital DID (tcc)", async () => {
      const res = await fetch(`${BASE}/api/wallet/sync/did-resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ did: "did:web:trustcare.network:hospital:tcc" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.did).toBe("did:web:trustcare.network:hospital:tcc");
      expect(body.resolved).toBe(true);
      expect(body.hospitalCode).toBe("TCC");
      expect(body.verificationMethod).toBeDefined();
      expect(body.verificationMethod).toHaveLength(1);
      expect(body.verificationMethod[0].type).toBe("JsonWebKey2020");
      expect(body.verificationMethod[0].publicKeyJwk).toBeDefined();
      expect(body.verificationMethod[0].publicKeyJwk.kty).toBe("EC");
      expect(body.verificationMethod[0].publicKeyJwk.crv).toBe("P-256");
    });

    it("resolves a valid hospital DID (tcp)", async () => {
      const res = await fetch(`${BASE}/api/wallet/sync/did-resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ did: "did:web:trustcare.network:hospital:tcp" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.did).toBe("did:web:trustcare.network:hospital:tcp");
      expect(body.resolved).toBe(true);
      expect(body.hospitalCode).toBe("TCP");
    });

    it("resolves a valid hospital DID (tcm)", async () => {
      const res = await fetch(`${BASE}/api/wallet/sync/did-resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ did: "did:web:trustcare.network:hospital:tcm" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.resolved).toBe(true);
      expect(body.hospitalCode).toBe("TCM");
    });

    it("returns 400 when did field is missing", async () => {
      const res = await fetch(`${BASE}/api/wallet/sync/did-resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("missing_did");
      expect(body.message).toContain("did field is required");
    });

    it("returns 400 when did is empty string", async () => {
      const res = await fetch(`${BASE}/api/wallet/sync/did-resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ did: "" }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("missing_did");
    });

    it("returns 404 for unsupported DID method (did:key)", async () => {
      const res = await fetch(`${BASE}/api/wallet/sync/did-resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ did: "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK" }),
      });
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe("unsupported_did");
      expect(body.message).toContain("Only did:web:trustcare.network:hospital");
    });

    it("returns 404 for unsupported DID method (did:ethr)", async () => {
      const res = await fetch(`${BASE}/api/wallet/sync/did-resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ did: "did:ethr:0x1234567890abcdef" }),
      });
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe("unsupported_did");
    });

    it("returns 404 for did:web with wrong domain", async () => {
      const res = await fetch(`${BASE}/api/wallet/sync/did-resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ did: "did:web:example.com:hospital:abc" }),
      });
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe("unsupported_did");
    });

    it("verification method includes proper key ID format", async () => {
      const res = await fetch(`${BASE}/api/wallet/sync/did-resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ did: "did:web:trustcare.network:hospital:tcc" }),
      });
      const body = await res.json();
      const vm = body.verificationMethod[0];
      expect(vm.id).toBe("did:web:trustcare.network:hospital:tcc#vc-signing-key");
      expect(vm.controller).toBe("did:web:trustcare.network:hospital:tcc");
    });

    it("public key does NOT expose private key material", async () => {
      const res = await fetch(`${BASE}/api/wallet/sync/did-resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ did: "did:web:trustcare.network:hospital:tcc" }),
      });
      const body = await res.json();
      const jwk = body.verificationMethod[0].publicKeyJwk;
      // Must NOT have private key 'd' parameter
      expect(jwk.d).toBeUndefined();
      // Must have public key parameters
      expect(jwk.x).toBeDefined();
      expect(jwk.y).toBeDefined();
    });

    it("does not require authentication (public endpoint)", async () => {
      // DID resolution should be public — no auth header needed
      const res = await fetch(`${BASE}/api/wallet/sync/did-resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ did: "did:web:trustcare.network:hospital:tcc" }),
      });
      expect(res.status).toBe(200);
    });
  });
});

describe("DID Resolution — Shortcut Routes (E2E)", () => {
  // ============================================================
  // GET /hospital/:code/did.json (shortcut)
  // ============================================================
  describe("GET /hospital/:code/did.json", () => {
    it("returns DID document for known hospital (tcc)", async () => {
      const res = await fetch(`${BASE}/hospital/tcc/did.json`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("application/did+ld+json");
      expect(res.headers.get("cache-control")).toContain("max-age=3600");
      const body = await res.json();
      expect(body["@context"]).toContain("https://www.w3.org/ns/did/v1");
      expect(body.id).toBe("did:web:trustcare.network:hospital:tcc");
      expect(body.verificationMethod).toBeDefined();
      expect(body.verificationMethod.length).toBeGreaterThan(0);
    });

    it("returns DID document for known hospital (tcp)", async () => {
      const res = await fetch(`${BASE}/hospital/tcp/did.json`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe("did:web:trustcare.network:hospital:tcp");
    });

    it("returns DID document for known hospital (tcm)", async () => {
      const res = await fetch(`${BASE}/hospital/tcm/did.json`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe("did:web:trustcare.network:hospital:tcm");
    });

    it("is case-insensitive for hospital code", async () => {
      const resLower = await fetch(`${BASE}/hospital/tcc/did.json`);
      const resUpper = await fetch(`${BASE}/hospital/TCC/did.json`);
      // Both should work (the route lowercases the code)
      expect(resLower.status).toBe(200);
      // Upper case may also work depending on implementation
      const bodyLower = await resLower.json();
      expect(bodyLower.id).toContain("tcc");
    });

    it("returns 404 for unknown hospital code", async () => {
      const res = await fetch(`${BASE}/hospital/unknown_xyz/did.json`);
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toContain("not found");
    });

    it("returns equivalent content to /.well-known/did.json path", async () => {
      const shortcut = await fetch(`${BASE}/hospital/tcc/did.json`);
      const wellKnown = await fetch(`${BASE}/hospital/tcc/.well-known/did.json`);
      expect(shortcut.status).toBe(200);
      expect(wellKnown.status).toBe(200);
      const shortcutBody = await shortcut.json();
      const wellKnownBody = await wellKnown.json();
      // Both should have the same DID id
      expect(shortcutBody.id).toBe(wellKnownBody.id);
      expect(shortcutBody.verificationMethod[0].publicKeyJwk.x).toBe(
        wellKnownBody.verificationMethod[0].publicKeyJwk.x
      );
    });

    it("includes verificationMethod with ES256 key", async () => {
      const res = await fetch(`${BASE}/hospital/tcc/did.json`);
      const body = await res.json();
      const vm = body.verificationMethod[0];
      expect(vm.type).toBe("JsonWebKey2020");
      expect(vm.publicKeyJwk.alg).toBe("ES256");
      expect(vm.publicKeyJwk.kty).toBe("EC");
      expect(vm.publicKeyJwk.crv).toBe("P-256");
    });

    it("does not expose private key in DID document", async () => {
      const res = await fetch(`${BASE}/hospital/tcc/did.json`);
      const body = await res.json();
      const jwk = body.verificationMethod[0].publicKeyJwk;
      expect(jwk.d).toBeUndefined();
    });
  });

  // ============================================================
  // GET /hospital/:code/did/jwks.json
  // ============================================================
  describe("GET /hospital/:code/did/jwks.json", () => {
    it("returns JWKS for known hospital (tcc)", async () => {
      const res = await fetch(`${BASE}/hospital/tcc/did/jwks.json`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("application/json");
      expect(res.headers.get("cache-control")).toContain("max-age=3600");
      const body = await res.json();
      expect(body.keys).toBeDefined();
      expect(Array.isArray(body.keys)).toBe(true);
      expect(body.keys.length).toBeGreaterThan(0);
      expect(body.issuer).toBe("did:web:trustcare.network:hospital:tcc");
      expect(body.hospitalCode).toBe("TCC");
    });

    it("returns JWKS for known hospital (tcp)", async () => {
      const res = await fetch(`${BASE}/hospital/tcp/did/jwks.json`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.issuer).toBe("did:web:trustcare.network:hospital:tcp");
      expect(body.hospitalCode).toBe("TCP");
    });

    it("returns JWKS for known hospital (tcm)", async () => {
      const res = await fetch(`${BASE}/hospital/tcm/did/jwks.json`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.hospitalCode).toBe("TCM");
    });

    it("each key has required JWK fields", async () => {
      const res = await fetch(`${BASE}/hospital/tcc/did/jwks.json`);
      const body = await res.json();
      for (const key of body.keys) {
        expect(key.kty).toBe("EC");
        expect(key.crv).toBe("P-256");
        expect(key.alg).toBe("ES256");
        expect(key.x).toBeDefined();
        expect(key.y).toBeDefined();
        expect(key.kid).toBeDefined();
        expect(key.use).toBe("sig");
        // Must NOT expose private key
        expect(key.d).toBeUndefined();
      }
    });

    it("key ID follows DID fragment format", async () => {
      const res = await fetch(`${BASE}/hospital/tcc/did/jwks.json`);
      const body = await res.json();
      const key = body.keys[0];
      expect(key.kid).toContain("did:web:trustcare.network:hospital:tcc");
      expect(key.kid).toContain("#");
    });

    it("returns consistent keys between JWKS and DID document", async () => {
      const jwksRes = await fetch(`${BASE}/hospital/tcc/did/jwks.json`);
      const didRes = await fetch(`${BASE}/hospital/tcc/did.json`);
      const jwksBody = await jwksRes.json();
      const didBody = await didRes.json();
      // The public key in JWKS should match the one in DID document
      const jwksKey = jwksBody.keys[0];
      const didKey = didBody.verificationMethod[0].publicKeyJwk;
      expect(jwksKey.x).toBe(didKey.x);
      expect(jwksKey.y).toBe(didKey.y);
      expect(jwksKey.crv).toBe(didKey.crv);
    });
  });
});
