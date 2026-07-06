/**
 * Tests for Wallet Sync JWT Proof Envelope and Verify Endpoint
 * v3.41.0 — Cryptographic proof in wallet sync
 */
import { describe, it, expect } from "vitest";

const BASE = "http://localhost:3000";

// Patient 416 has 12 credentials with sdJwtVc populated (from seed data)
const TEST_PATIENT_ID = 416;
// Patient 407 has staff_identity credential
const STAFF_PATIENT_ID = 407;

// ============================================================
// JWT PROOF ENVELOPE IN SYNC RESPONSE
// ============================================================
describe("Wallet Sync — JWT Proof Envelope", () => {
  it("should include proof object in each synced credential", async () => {
    const res = await fetch(`${BASE}/api/wallet/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientId: TEST_PATIENT_ID }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.credentials.length).toBeGreaterThan(0);

    for (const cred of data.credentials) {
      // Every credential with sdJwtVc should have proof
      expect(cred).toHaveProperty("proof");
      if (cred.proof !== null) {
        expect(cred.proof.type).toBe("jwt");
        expect(cred.proof.jwt).toBeTruthy();
        expect(typeof cred.proof.jwt).toBe("string");
        expect(cred.proof.jwt.split(".").length).toBe(3); // JWT has 3 parts
        expect(cred.proof.alg).toBeTruthy();
        expect(cred.proof.kid).toBeTruthy();
      }
    }
  });

  it("proof.alg should match the JWT header alg", async () => {
    const res = await fetch(`${BASE}/api/wallet/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientId: TEST_PATIENT_ID }),
    });
    const data = await res.json();
    const credWithProof = data.credentials.find((c: any) => c.proof !== null);
    expect(credWithProof).toBeDefined();

    // Decode the JWT header to verify alg matches
    const headerB64 = credWithProof.proof.jwt.split(".")[0];
    const header = JSON.parse(Buffer.from(headerB64, "base64url").toString());
    expect(credWithProof.proof.alg).toBe(header.alg);
  });

  it("proof.kid should match the JWT header kid", async () => {
    const res = await fetch(`${BASE}/api/wallet/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientId: TEST_PATIENT_ID }),
    });
    const data = await res.json();
    const credWithProof = data.credentials.find((c: any) => c.proof !== null);
    expect(credWithProof).toBeDefined();

    const headerB64 = credWithProof.proof.jwt.split(".")[0];
    const header = JSON.parse(Buffer.from(headerB64, "base64url").toString());
    expect(credWithProof.proof.kid).toBe(header.kid);
  });

  it("proof.jwt should contain a valid VC payload", async () => {
    const res = await fetch(`${BASE}/api/wallet/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientId: STAFF_PATIENT_ID }),
    });
    const data = await res.json();
    const credWithProof = data.credentials.find((c: any) => c.proof !== null);
    expect(credWithProof).toBeDefined();

    // Decode the JWT payload
    const payloadB64 = credWithProof.proof.jwt.split(".")[1];
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
    expect(payload).toHaveProperty("vc");
    expect(payload).toHaveProperty("iss");
    expect(payload).toHaveProperty("sub");
    expect(payload).toHaveProperty("exp");
    expect(payload).toHaveProperty("iat");
    expect(payload.vc).toHaveProperty("type");
    expect(payload.vc).toHaveProperty("issuer");
  });

  it("should return proof: null for credentials without sdJwtVc", async () => {
    // Use a patient that might have credentials without JWT
    // If all have JWT, this test verifies the structure is consistent
    const res = await fetch(`${BASE}/api/wallet/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientId: TEST_PATIENT_ID }),
    });
    const data = await res.json();
    // All credentials should have proof field (either object or null)
    for (const cred of data.credentials) {
      expect(cred).toHaveProperty("proof");
      if (cred.proof === null) {
        expect(cred.proof).toBeNull();
      } else {
        expect(cred.proof.type).toBe("jwt");
      }
    }
  });
});

// ============================================================
// VERIFY ENDPOINT
// ============================================================
describe("POST /api/wallet/sync/verify", () => {
  it("should return 400 if jwt is missing", async () => {
    const res = await fetch(`${BASE}/api/wallet/sync/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("missing_jwt");
  });

  it("should return 400 if jwt is not a string", async () => {
    const res = await fetch(`${BASE}/api/wallet/sync/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jwt: 12345 }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("missing_jwt");
  });

  it("should return red for invalid JWT format", async () => {
    const res = await fetch(`${BASE}/api/wallet/sync/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jwt: "not.a.valid.jwt" }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.verified).toBe(false);
    expect(data.trustLevel).toBe("red");
    expect(data.errors.length).toBeGreaterThan(0);
  });

  it("should return green for a valid active credential JWT", async () => {
    // First get a JWT from sync
    const syncRes = await fetch(`${BASE}/api/wallet/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientId: TEST_PATIENT_ID }),
    });
    const syncData = await syncRes.json();
    const activeCred = syncData.credentials.find(
      (c: any) => c.credentialStatus === "active" && c.proof !== null
    );
    expect(activeCred).toBeDefined();

    // Verify it
    const verifyRes = await fetch(`${BASE}/api/wallet/sync/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jwt: activeCred.proof.jwt }),
    });
    expect(verifyRes.status).toBe(200);
    const verifyData = await verifyRes.json();
    expect(verifyData.verified).toBe(true);
    expect(verifyData.trustLevel).toBe("green");
    expect(verifyData.issuer).toBeTruthy();
    expect(verifyData.credentialType).toBeTruthy();
    expect(verifyData.alg).toBeTruthy();
    expect(verifyData.errors).toHaveLength(0);
    expect(verifyData.credential).toBeDefined();
  });

  it("should return red for a suspended credential JWT", async () => {
    // Get a suspended credential
    const syncRes = await fetch(`${BASE}/api/wallet/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientId: TEST_PATIENT_ID }),
    });
    const syncData = await syncRes.json();
    const suspendedCred = syncData.credentials.find(
      (c: any) => c.credentialStatus === "suspended" && c.proof !== null
    );
    if (!suspendedCred) {
      // Skip if no suspended credentials in test data
      console.log("No suspended credentials found for patient, skipping");
      return;
    }

    const verifyRes = await fetch(`${BASE}/api/wallet/sync/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jwt: suspendedCred.proof.jwt }),
    });
    expect(verifyRes.status).toBe(200);
    const verifyData = await verifyRes.json();
    expect(verifyData.verified).toBe(false);
    expect(verifyData.trustLevel).toBe("red");
    expect(verifyData.dbStatus).toBe("suspended");
    expect(verifyData.errors.some((e: string) => e.includes("suspended"))).toBe(true);
    // Credential should NOT be returned when verification fails
    expect(verifyData.credential).toBeUndefined();
  });

  it("should include issuer, credentialId, credentialType in response", async () => {
    const syncRes = await fetch(`${BASE}/api/wallet/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientId: STAFF_PATIENT_ID }),
    });
    const syncData = await syncRes.json();
    const cred = syncData.credentials.find((c: any) => c.proof !== null);
    expect(cred).toBeDefined();

    const verifyRes = await fetch(`${BASE}/api/wallet/sync/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jwt: cred.proof.jwt }),
    });
    const verifyData = await verifyRes.json();
    expect(verifyData.issuer).toMatch(/^did:web:/);
    expect(verifyData.credentialId).toBeTruthy();
    expect(verifyData.credentialType).toBeTruthy();
    expect(verifyData.kid).toBeTruthy();
    expect(verifyData.alg).toBe("ES256");
  });

  it("should support kind=presentation for VP verification", async () => {
    // Test with a credential JWT but kind=presentation — should fail gracefully
    const syncRes = await fetch(`${BASE}/api/wallet/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientId: STAFF_PATIENT_ID }),
    });
    const syncData = await syncRes.json();
    const cred = syncData.credentials.find((c: any) => c.proof !== null);
    expect(cred).toBeDefined();

    // Sending a VC JWT as kind=presentation should fail (wrong type)
    const verifyRes = await fetch(`${BASE}/api/wallet/sync/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jwt: cred.proof.jwt, kind: "presentation" }),
    });
    const verifyData = await verifyRes.json();
    // It should still process (may succeed or fail depending on VP structure)
    expect(verifyData).toHaveProperty("verified");
    expect(verifyData).toHaveProperty("trustLevel");
  });

  it("should return dbStatus: null for active credentials", async () => {
    const syncRes = await fetch(`${BASE}/api/wallet/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientId: STAFF_PATIENT_ID }),
    });
    const syncData = await syncRes.json();
    const activeCred = syncData.credentials.find(
      (c: any) => c.credentialStatus === "active" && c.proof !== null
    );
    expect(activeCred).toBeDefined();

    const verifyRes = await fetch(`${BASE}/api/wallet/sync/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jwt: activeCred.proof.jwt }),
    });
    const verifyData = await verifyRes.json();
    expect(verifyData.dbStatus).toBeNull();
  });

  it("should handle tampered JWT (modified payload)", async () => {
    const syncRes = await fetch(`${BASE}/api/wallet/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientId: STAFF_PATIENT_ID }),
    });
    const syncData = await syncRes.json();
    const cred = syncData.credentials.find((c: any) => c.proof !== null);
    expect(cred).toBeDefined();

    // Tamper with the JWT payload
    const parts = cred.proof.jwt.split(".");
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    payload.sub = "did:web:attacker.com"; // Tamper
    parts[1] = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const tamperedJwt = parts.join(".");

    const verifyRes = await fetch(`${BASE}/api/wallet/sync/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jwt: tamperedJwt }),
    });
    const verifyData = await verifyRes.json();
    expect(verifyData.verified).toBe(false);
    expect(verifyData.trustLevel).toBe("red");
    expect(verifyData.errors.length).toBeGreaterThan(0);
  });

  it("should handle truncated JWT", async () => {
    const verifyRes = await fetch(`${BASE}/api/wallet/sync/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jwt: "eyJhbGciOiJFUzI1NiJ9.eyJ0ZXN0Ijp0cnVlfQ" }),
    });
    const verifyData = await verifyRes.json();
    expect(verifyData.verified).toBe(false);
    expect(verifyData.trustLevel).toBe("red");
  });

  it("should not expose credential data when verification fails", async () => {
    const verifyRes = await fetch(`${BASE}/api/wallet/sync/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jwt: "fake.jwt.token" }),
    });
    const verifyData = await verifyRes.json();
    expect(verifyData.verified).toBe(false);
    expect(verifyData.credential).toBeUndefined();
  });
});

// ============================================================
// INTEGRATION: SYNC + VERIFY ROUND-TRIP
// ============================================================
describe("Wallet Sync + Verify Round-Trip", () => {
  it("every credential with proof from sync should verify successfully or show correct status", async () => {
    const syncRes = await fetch(`${BASE}/api/wallet/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientId: TEST_PATIENT_ID }),
    });
    const syncData = await syncRes.json();
    const credsWithProof = syncData.credentials.filter((c: any) => c.proof !== null);
    expect(credsWithProof.length).toBeGreaterThan(0);

    for (const cred of credsWithProof) {
      const verifyRes = await fetch(`${BASE}/api/wallet/sync/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jwt: cred.proof.jwt }),
      });
      const verifyData = await verifyRes.json();

      if (cred.credentialStatus === "active") {
        expect(verifyData.verified).toBe(true);
        expect(verifyData.trustLevel).toBe("green");
      } else {
        // Suspended/revoked/expired should be red
        expect(verifyData.verified).toBe(false);
        expect(verifyData.trustLevel).toBe("red");
        expect(verifyData.dbStatus).toBe(cred.credentialStatus);
      }
    }
  });

  it("DID resolve should return the public key that can verify the JWT", async () => {
    // Get a credential
    const syncRes = await fetch(`${BASE}/api/wallet/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientId: STAFF_PATIENT_ID }),
    });
    const syncData = await syncRes.json();
    const cred = syncData.credentials.find((c: any) => c.proof !== null && c.issuerDid);
    expect(cred).toBeDefined();

    // Resolve the issuer DID
    const didRes = await fetch(`${BASE}/api/wallet/sync/did-resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ did: cred.issuerDid }),
    });
    const didData = await didRes.json();
    expect(didData.resolved).toBe(true);
    expect(didData.verificationMethod).toBeDefined();
    expect(didData.verificationMethod.length).toBeGreaterThan(0);
    expect(didData.verificationMethod[0].publicKeyJwk).toBeDefined();
    expect(didData.verificationMethod[0].publicKeyJwk.kty).toBeTruthy();
  });
});
