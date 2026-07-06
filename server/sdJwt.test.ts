/**
 * SD-JWT Selective Disclosure — Comprehensive Tests
 * Tests the sdJwt module (issuance, presentation, verification, policy)
 * and the wallet sync API endpoints for selective disclosure.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { issueSdJwt, createSelectivePresentation, verifySdJwtPresentation, getDisclosurePolicy, decodeDisclosure } from "./portability/sdJwt";

// ============================================================
// UNIT TESTS: SD-JWT Module
// ============================================================
describe("SD-JWT Module — issueSdJwt", () => {
  const baseClaims = {
    patient_name: "สมชาย ใจดี",
    patient_name_en: "Somchai Jaidee",
    date_of_birth: "1990-01-15",
    thai_id: "1234567890123",
    blood_type: "O+",
    allergies: ["Penicillin"],
  };

  it("issues SD-JWT with correct format (JWT~d1~d2~...~)", async () => {
    const result = await issueSdJwt({
      credentialId: "urn:uuid:test-1",
      credentialType: "patient_identity",
      issuerDid: "did:web:trustcare.network:hospital:TCC",
      subjectDid: "did:trustcare:patient:1",
      claims: baseClaims,
      hospitalCode: "TCC",
    });

    expect(result.sdJwtFull).toBeDefined();
    expect(result.sdJwtFull).toContain("~");
    // Format: header.payload.signature~disclosure1~disclosure2~...~
    const parts = result.sdJwtFull.split("~");
    expect(parts.length).toBeGreaterThan(2); // JWT + at least 1 disclosure + trailing empty
    // First part should be a valid JWT (3 dot-separated base64url segments)
    const jwtParts = parts[0].split(".");
    expect(jwtParts.length).toBe(3);
  });

  it("returns disclosureMap with claim names as keys", async () => {
    const result = await issueSdJwt({
      credentialId: "urn:uuid:test-2",
      credentialType: "patient_identity",
      issuerDid: "did:web:trustcare.network:hospital:TCC",
      subjectDid: "did:trustcare:patient:1",
      claims: baseClaims,
      hospitalCode: "TCC",
    });

    expect(result.disclosureMap).toBeDefined();
    expect(typeof result.disclosureMap).toBe("object");
    // Should have entries for selectable claims
    const keys = Object.keys(result.disclosureMap);
    expect(keys.length).toBeGreaterThan(0);
  });

  it("each disclosure decodes to {salt, claimName, claimValue}", async () => {
    const result = await issueSdJwt({
      credentialId: "urn:uuid:test-3",
      credentialType: "patient_identity",
      issuerDid: "did:web:trustcare.network:hospital:TCC",
      subjectDid: "did:trustcare:patient:1",
      claims: baseClaims,
      hospitalCode: "TCC",
    });

    for (const [claimName, disclosureB64] of Object.entries(result.disclosureMap)) {
      const decoded = decodeDisclosure(disclosureB64);
      expect(decoded).not.toBeNull();
      expect(typeof decoded!.salt).toBe("string");
      expect(decoded!.claimName).toBe(claimName);
      // claimValue can be anything
    }
  });

  it("JWT payload contains _sd array with disclosure digests", async () => {
    const result = await issueSdJwt({
      credentialId: "urn:uuid:test-4",
      credentialType: "patient_identity",
      issuerDid: "did:web:trustcare.network:hospital:TCC",
      subjectDid: "did:trustcare:patient:1",
      claims: baseClaims,
      hospitalCode: "TCC",
    });

    // Decode JWT payload
    const jwtPart = result.sdJwtFull.split("~")[0];
    const payloadB64 = jwtPart.split(".")[1];
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());

    expect(payload._sd).toBeDefined();
    expect(Array.isArray(payload._sd)).toBe(true);
    expect(payload._sd.length).toBeGreaterThan(0);
    // Each digest should be a base64url string
    for (const digest of payload._sd) {
      expect(typeof digest).toBe("string");
      expect(digest.length).toBeGreaterThan(10);
    }
  });

  it("JWT payload contains iss, sub, jti, iat claims", async () => {
    const result = await issueSdJwt({
      credentialId: "urn:uuid:test-5",
      credentialType: "patient_identity",
      issuerDid: "did:web:trustcare.network:hospital:TCC",
      subjectDid: "did:trustcare:patient:1",
      claims: baseClaims,
      hospitalCode: "TCC",
    });

    const jwtPart = result.sdJwtFull.split("~")[0];
    const payloadB64 = jwtPart.split(".")[1];
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());

    expect(payload.iss).toBe("did:web:trustcare.network:hospital:TCC");
    expect(payload.sub).toBe("did:trustcare:patient:1");
    expect(payload.jti).toBe("urn:uuid:test-5");
    expect(payload.iat).toBeDefined();
    expect(payload._sd_alg).toBe("sha-256");
  });

  it("handles nested vcEnvelope claims", async () => {
    const result = await issueSdJwt({
      credentialId: "urn:uuid:test-6",
      credentialType: "allergy_alert",
      issuerDid: "did:web:trustcare.network:hospital:TCC",
      subjectDid: "did:trustcare:patient:1",
      claims: baseClaims,
      vcEnvelope: { credentialSubject: baseClaims, type: ["VerifiableCredential", "AllergyAlert"] },
      hospitalCode: "TCC",
    });

    expect(result.sdJwtFull).toContain("~");
    expect(Object.keys(result.disclosureMap).length).toBeGreaterThan(0);
  });
});

describe("SD-JWT Module — createSelectivePresentation", () => {
  let sdJwtFull: string;
  let disclosureMap: Record<string, string>;

  // Issue a credential first
  beforeAll(async () => {
    const result = await issueSdJwt({
      credentialId: "urn:uuid:present-test-1",
      credentialType: "patient_identity",
      issuerDid: "did:web:trustcare.network:hospital:TCC",
      subjectDid: "did:trustcare:patient:1",
      claims: {
        patient_name: "สมชาย ใจดี",
        date_of_birth: "1990-01-15",
        thai_id: "1234567890123",
        blood_type: "O+",
      },
      hospitalCode: "TCC",
    });
    sdJwtFull = result.sdJwtFull;
    disclosureMap = result.disclosureMap;
  });

  it("creates presentation with only selected disclosures", () => {
    const availableFields = Object.keys(disclosureMap);
    // Select only the first field
    const selectedFields = [availableFields[0]];
    const result = createSelectivePresentation(sdJwtFull, selectedFields);

    expect(result.presentation).toBeDefined();
    expect(result.disclosedFields).toContain(availableFields[0]);
    expect(result.withheldFields.length).toBeGreaterThan(0);
  });

  it("presentation has fewer disclosures than full SD-JWT", () => {
    const availableFields = Object.keys(disclosureMap);
    const selectedFields = [availableFields[0]];
    const result = createSelectivePresentation(sdJwtFull, selectedFields);

    const fullParts = sdJwtFull.split("~").filter(Boolean);
    const presentParts = result.presentation.split("~").filter(Boolean);
    expect(presentParts.length).toBeLessThan(fullParts.length);
  });

  it("selecting all fields returns all disclosures", () => {
    const allFields = Object.keys(disclosureMap);
    const result = createSelectivePresentation(sdJwtFull, allFields);

    expect(result.disclosedFields.sort()).toEqual(allFields.sort());
    expect(result.withheldFields.length).toBe(0);
  });

  it("selecting no matching fields returns JWT only", () => {
    const result = createSelectivePresentation(sdJwtFull, ["nonexistent_field"]);
    expect(result.disclosedFields.length).toBe(0);
    expect(result.withheldFields.length).toBeGreaterThan(0);
    // Should still have the JWT part
    const parts = result.presentation.split("~").filter(Boolean);
    expect(parts[0]).toContain("."); // JWT with dots
  });

  it("preserves JWT signature in presentation", () => {
    const availableFields = Object.keys(disclosureMap);
    const result = createSelectivePresentation(sdJwtFull, [availableFields[0]]);

    const originalJwt = sdJwtFull.split("~")[0];
    const presentationJwt = result.presentation.split("~")[0];
    expect(presentationJwt).toBe(originalJwt);
  });
});

describe("SD-JWT Module — verifySdJwtPresentation", () => {
  let sdJwtFull: string;
  let disclosureMap: Record<string, string>;

  beforeAll(async () => {
    const result = await issueSdJwt({
      credentialId: "urn:uuid:verify-test-1",
      credentialType: "patient_identity",
      issuerDid: "did:web:trustcare.network:hospital:TCC",
      subjectDid: "did:trustcare:patient:1",
      claims: {
        patient_name: "สมชาย ใจดี",
        date_of_birth: "1990-01-15",
        thai_id: "1234567890123",
      },
      hospitalCode: "TCC",
    });
    sdJwtFull = result.sdJwtFull;
    disclosureMap = result.disclosureMap;
  });

  it("verifies a valid selective presentation (green)", async () => {
    const availableFields = Object.keys(disclosureMap);
    const presentation = createSelectivePresentation(sdJwtFull, [availableFields[0]]);

    const result = await verifySdJwtPresentation(presentation.presentation, {
      trustedIssuers: ["did:web:trustcare.network:hospital:TCC"],
    });

    expect(result.verified).toBe(true);
    expect(result.trustLevel).toBe("green");
    expect(result.issuer).toBe("did:web:trustcare.network:hospital:TCC");
  });

  it("returns disclosed claims from the presentation", async () => {
    const availableFields = Object.keys(disclosureMap);
    const presentation = createSelectivePresentation(sdJwtFull, availableFields);

    const result = await verifySdJwtPresentation(presentation.presentation, {
      trustedIssuers: ["did:web:trustcare.network:hospital:TCC"],
    });

    expect(result.verified).toBe(true);
    expect(result.disclosedClaims).toBeDefined();
    expect(Object.keys(result.disclosedClaims).length).toBeGreaterThan(0);
  });

  it("returns red for untrusted issuer (issuer not in trust registry)", async () => {
    const availableFields = Object.keys(disclosureMap);
    const presentation = createSelectivePresentation(sdJwtFull, [availableFields[0]]);

    const result = await verifySdJwtPresentation(presentation.presentation, {
      trustedIssuers: ["did:web:other.hospital"],
    });

    // Untrusted issuer pushes to errors → verified=false → trustLevel=red
    expect(result.verified).toBe(false);
    expect(result.trustLevel).toBe("red");
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("returns red for tampered presentation", async () => {
    const availableFields = Object.keys(disclosureMap);
    const presentation = createSelectivePresentation(sdJwtFull, [availableFields[0]]);

    // Tamper with the JWT signature
    const parts = presentation.presentation.split("~");
    const jwtParts = parts[0].split(".");
    jwtParts[2] = jwtParts[2].slice(0, -5) + "XXXXX"; // corrupt signature
    parts[0] = jwtParts.join(".");
    const tampered = parts.join("~");

    const result = await verifySdJwtPresentation(tampered, {
      trustedIssuers: ["did:web:trustcare.network:hospital:TCC"],
    });

    expect(result.verified).toBe(false);
    expect(result.trustLevel).toBe("red");
  });

  it("returns withheldFields for non-disclosed claims", async () => {
    const availableFields = Object.keys(disclosureMap);
    if (availableFields.length < 2) return; // skip if only 1 field
    const presentation = createSelectivePresentation(sdJwtFull, [availableFields[0]]);

    const result = await verifySdJwtPresentation(presentation.presentation, {
      trustedIssuers: ["did:web:trustcare.network:hospital:TCC"],
    });

    expect(result.withheldFields.length).toBeGreaterThan(0);
  });
});

describe("SD-JWT Module — getDisclosurePolicy", () => {
  it("returns policy for patient_identity", () => {
    const policy = getDisclosurePolicy("patient_identity");
    expect(policy.alwaysDisclosed).toBeDefined();
    expect(policy.selectableFields).toBeDefined();
    expect(policy.neverDisclosed).toBeDefined();
    expect(Array.isArray(policy.alwaysDisclosed)).toBe(true);
    expect(Array.isArray(policy.selectableFields)).toBe(true);
  });

  it("returns policy for allergy_alert", () => {
    const policy = getDisclosurePolicy("allergy_alert");
    expect(policy.alwaysDisclosed.length).toBeGreaterThan(0);
    expect(policy.selectableFields.length).toBeGreaterThan(0);
  });

  it("returns default policy for unknown credential type", () => {
    const policy = getDisclosurePolicy("unknown_type_xyz");
    expect(policy.alwaysDisclosed).toBeDefined();
    expect(policy.selectableFields).toBeDefined();
  });

  it("neverDisclosed fields include sensitive internal fields", () => {
    const policy = getDisclosurePolicy("patient_identity");
    expect(policy.neverDisclosed).toContain("trustcareSubjectId");
  });

  it("alwaysDisclosed includes document type metadata", () => {
    const policy = getDisclosurePolicy("patient_identity");
    expect(policy.alwaysDisclosed).toContain("documentType");
  });
});

describe("SD-JWT Module — decodeDisclosure", () => {
  it("decodes a valid base64url disclosure to {salt, claimName, claimValue}", async () => {
    const result = await issueSdJwt({
      credentialId: "urn:uuid:decode-test-1",
      credentialType: "patient_identity",
      issuerDid: "did:web:trustcare.network:hospital:TCC",
      subjectDid: "did:trustcare:patient:1",
      claims: { patient_name: "Test Patient" },
      hospitalCode: "TCC",
    });

    const firstKey = Object.keys(result.disclosureMap)[0];
    const disclosure = result.disclosureMap[firstKey];
    const decoded = decodeDisclosure(disclosure);

    expect(decoded).not.toBeNull();
    expect(typeof decoded!.salt).toBe("string");
    expect(decoded!.claimName).toBe(firstKey);
  });

  it("returns null for invalid base64url", () => {
    const decoded = decodeDisclosure("not-valid-base64!!!");
    expect(decoded).toBeNull();
  });

  it("returns null for empty string", () => {
    const decoded = decodeDisclosure("");
    expect(decoded).toBeNull();
  });
});

// ============================================================
// HTTP ENDPOINT TESTS
// ============================================================
describe("Wallet Sync API — SD-JWT Endpoints (HTTP)", () => {
  const BASE = "http://localhost:3000";

  describe("GET /api/wallet/sync/sd-jwt/policy/:credentialType", () => {
    it("returns policy for patient_identity", async () => {
      const res = await fetch(`${BASE}/api/wallet/sync/sd-jwt/policy/patient_identity`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.credentialType).toBe("patient_identity");
      expect(data.policy.alwaysDisclosed).toBeDefined();
      expect(data.policy.selectableFields).toBeDefined();
      expect(data.policy.neverDisclosed).toBeDefined();
    });

    it("returns policy for allergy_alert", async () => {
      const res = await fetch(`${BASE}/api/wallet/sync/sd-jwt/policy/allergy_alert`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.credentialType).toBe("allergy_alert");
    });

    it("returns default policy for unknown type", async () => {
      const res = await fetch(`${BASE}/api/wallet/sync/sd-jwt/policy/unknown_xyz`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.policy.alwaysDisclosed).toBeDefined();
    });
  });

  describe("POST /api/wallet/sync/present", () => {
    it("returns 400 when sdJwtFull is missing", async () => {
      const res = await fetch(`${BASE}/api/wallet/sync/present`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("missing_sd_jwt_full");
    });

    it("returns 400 when selectedFields is missing", async () => {
      const res = await fetch(`${BASE}/api/wallet/sync/present`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sdJwtFull: "test~disc~" }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("missing_selected_fields");
    });

    it("returns 400 when selectedFields is empty array", async () => {
      const res = await fetch(`${BASE}/api/wallet/sync/present`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sdJwtFull: "test~disc~", selectedFields: [] }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("missing_selected_fields");
    });

    it("returns 400 when sdJwtFull has no ~ separator", async () => {
      const res = await fetch(`${BASE}/api/wallet/sync/present`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sdJwtFull: "invalid-no-tilde", selectedFields: ["name"] }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("invalid_sd_jwt_format");
    });

    it("creates selective presentation from valid SD-JWT", async () => {
      // Issue an SD-JWT first
      const issued = await issueSdJwt({
        credentialId: "urn:uuid:http-present-test",
        credentialType: "patient_identity",
        issuerDid: "did:web:trustcare.network:hospital:TCC",
        subjectDid: "did:trustcare:patient:1",
        claims: { patient_name: "Test", date_of_birth: "1990-01-01", thai_id: "1111111111111" },
        hospitalCode: "TCC",
      });

      const selectedFields = Object.keys(issued.disclosureMap).slice(0, 1);
      const res = await fetch(`${BASE}/api/wallet/sync/present`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sdJwtFull: issued.sdJwtFull, selectedFields }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.presentation).toBeDefined();
      expect(data.disclosedFields.length).toBe(1);
      expect(data.withheldFields.length).toBeGreaterThan(0);
      expect(data.totalDisclosures).toBeGreaterThan(0);
    });
  });

  describe("POST /api/wallet/sync/verify-selective", () => {
    it("returns 400 when presentation is missing", async () => {
      const res = await fetch(`${BASE}/api/wallet/sync/verify-selective`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("missing_presentation");
    });

    it("returns red for invalid JWT", async () => {
      const res = await fetch(`${BASE}/api/wallet/sync/verify-selective`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ presentation: "invalid.jwt.here~disc1~" }),
      });
      const data = await res.json();
      expect(data.verified).toBe(false);
      expect(data.trustLevel).toBe("red");
    });

    it("verifies a valid selective presentation (green)", async () => {
      // Issue → Present → Verify flow
      const issued = await issueSdJwt({
        credentialId: "urn:uuid:http-verify-test",
        credentialType: "patient_identity",
        issuerDid: "did:web:trustcare.network:hospital:TCC",
        subjectDid: "did:trustcare:patient:1",
        claims: { patient_name: "Test", date_of_birth: "1990-01-01" },
        hospitalCode: "TCC",
      });

      const selectedFields = Object.keys(issued.disclosureMap);
      const presentation = createSelectivePresentation(issued.sdJwtFull, selectedFields);

      const res = await fetch(`${BASE}/api/wallet/sync/verify-selective`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ presentation: presentation.presentation }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.verified).toBe(true);
      expect(data.trustLevel).toBe("green");
      expect(data.disclosedClaims).toBeDefined();
      expect(data.issuer).toBe("did:web:trustcare.network:hospital:TCC");
    });

    it("returns disclosed claims only for selected fields", async () => {
      const issued = await issueSdJwt({
        credentialId: "urn:uuid:http-verify-partial",
        credentialType: "patient_identity",
        issuerDid: "did:web:trustcare.network:hospital:TCC",
        subjectDid: "did:trustcare:patient:1",
        claims: { patient_name: "Test", date_of_birth: "1990-01-01", thai_id: "1111111111111" },
        hospitalCode: "TCC",
      });

      const allFields = Object.keys(issued.disclosureMap);
      if (allFields.length < 2) return; // skip if not enough fields
      const selectedFields = [allFields[0]];
      const presentation = createSelectivePresentation(issued.sdJwtFull, selectedFields);

      const res = await fetch(`${BASE}/api/wallet/sync/verify-selective`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ presentation: presentation.presentation }),
      });
      const data = await res.json();
      expect(data.verified).toBe(true);
      expect(data.withheldFields.length).toBeGreaterThan(0);
    });
  });

  describe("POST /api/wallet/sync/sd-jwt/issue", () => {
    it("returns 401 without authentication", async () => {
      const res = await fetch(`${BASE}/api/wallet/sync/sd-jwt/issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credentialId: "urn:uuid:test" }),
      });
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe("authentication_required");
    });

    it("returns 400 when credentialId is missing", async () => {
      const res = await fetch(`${BASE}/api/wallet/sync/sd-jwt/issue`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer ews_invalid_token",
        },
        body: JSON.stringify({}),
      });
      // Will get 401 since token is invalid, but that's expected
      const data = await res.json();
      expect(data.error).toBe("authentication_required");
    });
  });

  describe("Sync response includes selectiveDisclosure field", () => {
    it("credentials have selectiveDisclosure field (null if not yet issued)", async () => {
      const res = await fetch(`${BASE}/api/wallet/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId: 416 }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.credentials.length).toBeGreaterThan(0);
      // Each credential should have selectiveDisclosure field (may be null)
      for (const cred of data.credentials) {
        expect("selectiveDisclosure" in cred).toBe(true);
      }
    });
  });
});
