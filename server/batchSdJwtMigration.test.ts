/**
 * Tests for Batch SD-JWT Migration
 * Verifies that all credentials now have sdJwtFull and disclosureMap after migration.
 */
import { describe, it, expect, beforeAll } from "vitest";

const BASE = "http://localhost:3000";

describe("Batch SD-JWT Migration Verification", () => {
  describe("All credentials should have SD-JWT after migration", () => {
    it("patient 416 should have selectiveDisclosure for all credentials", async () => {
      const res = await fetch(`${BASE}/api/wallet/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId: 416 }),
      });
      expect(res.ok).toBe(true);
      const data = await res.json();
      const creds = data.credentials || [];
      expect(creds.length).toBeGreaterThan(0);

      for (const cred of creds) {
        expect(cred.selectiveDisclosure).not.toBeNull();
        expect(cred.selectiveDisclosure.sdJwtFull).toBeDefined();
        expect(cred.selectiveDisclosure.sdJwtFull.length).toBeGreaterThan(100);
        expect(cred.selectiveDisclosure.disclosureMap).toBeDefined();
        expect(Object.keys(cred.selectiveDisclosure.disclosureMap).length).toBeGreaterThan(0);
        expect(cred.selectiveDisclosure.policy).toBeDefined();
        expect(cred.selectiveDisclosure.policy.alwaysDisclosed).toBeInstanceOf(Array);
        expect(cred.selectiveDisclosure.policy.selectableFields).toBeInstanceOf(Array);
      }
    });

    it("patient 407 should have selectiveDisclosure for all credentials", async () => {
      const res = await fetch(`${BASE}/api/wallet/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId: 407 }),
      });
      expect(res.ok).toBe(true);
      const data = await res.json();
      const creds = data.credentials || [];
      expect(creds.length).toBeGreaterThan(0);

      for (const cred of creds) {
        expect(cred.selectiveDisclosure).not.toBeNull();
        expect(cred.selectiveDisclosure.sdJwtFull).toBeDefined();
      }
    });

    it("patient 415 should have selectiveDisclosure for all credentials", async () => {
      const res = await fetch(`${BASE}/api/wallet/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId: 415 }),
      });
      expect(res.ok).toBe(true);
      const data = await res.json();
      const creds = data.credentials || [];
      expect(creds.length).toBeGreaterThan(0);

      for (const cred of creds) {
        expect(cred.selectiveDisclosure).not.toBeNull();
        expect(cred.selectiveDisclosure.sdJwtFull).toBeDefined();
        expect(cred.selectiveDisclosure.disclosureMap).toBeDefined();
      }
    });
  });

  describe("SD-JWT format validation", () => {
    it("sdJwtFull should follow SD-JWT format (JWT~disclosure1~disclosure2~...~)", async () => {
      const res = await fetch(`${BASE}/api/wallet/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId: 416 }),
      });
      const data = await res.json();
      const cred = data.credentials[0];
      const sdJwtFull = cred.selectiveDisclosure.sdJwtFull;

      // SD-JWT format: header.payload.signature~disclosure1~disclosure2~...~
      expect(sdJwtFull).toContain("~");
      const parts = sdJwtFull.split("~");
      // First part is the JWT (has 3 dot-separated parts)
      const jwtPart = parts[0];
      expect(jwtPart.split(".").length).toBe(3);
      // Last part should be empty (trailing ~)
      expect(parts[parts.length - 1]).toBe("");
      // Middle parts are base64url-encoded disclosures
      for (let i = 1; i < parts.length - 1; i++) {
        expect(parts[i].length).toBeGreaterThan(0);
        // Base64url characters only
        expect(parts[i]).toMatch(/^[A-Za-z0-9_-]+$/);
      }
    });

    it("disclosureMap values should be valid base64url-encoded JSON arrays", async () => {
      const res = await fetch(`${BASE}/api/wallet/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId: 416 }),
      });
      const data = await res.json();
      const cred = data.credentials[0];
      const disclosureMap = cred.selectiveDisclosure.disclosureMap;

      for (const [key, value] of Object.entries(disclosureMap)) {
        expect(typeof key).toBe("string");
        expect(typeof value).toBe("string");
        // Each disclosure is base64url-encoded
        expect(value as string).toMatch(/^[A-Za-z0-9_-]+$/);
        // Decode and verify it's a JSON array [salt, claimName, value]
        const decoded = JSON.parse(Buffer.from(value as string, "base64url").toString());
        expect(Array.isArray(decoded)).toBe(true);
        expect(decoded.length).toBe(3);
        // decoded[0] = salt (string), decoded[1] = claim name (string), decoded[2] = value
        expect(typeof decoded[0]).toBe("string"); // salt
        expect(typeof decoded[1]).toBe("string"); // claim name
        expect(decoded[1]).toBe(key); // claim name matches the key
      }
    });
  });

  describe("Selective presentation after migration", () => {
    it("should be able to create a selective presentation from migrated SD-JWT", async () => {
      // Get a credential with SD-JWT
      const syncRes = await fetch(`${BASE}/api/wallet/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId: 416 }),
      });
      const syncData = await syncRes.json();
      const cred = syncData.credentials[0];
      const sd = cred.selectiveDisclosure;

      // Select only a subset of fields to disclose
      const availableFields = Object.keys(sd.disclosureMap);
      const selectedFields = availableFields.slice(0, 2); // Only first 2 fields

      // Create presentation
      const presentRes = await fetch(`${BASE}/api/wallet/sync/present`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sdJwtFull: sd.sdJwtFull,
          selectedFields: selectedFields,
        }),
      });
      expect(presentRes.ok).toBe(true);
      const presentData = await presentRes.json();
      expect(presentData.presentation).toBeDefined();
      expect(presentData.disclosedFields).toEqual(selectedFields);
      expect(presentData.disclosedFields.length).toBe(2);

      // The presentation should be shorter than the full SD-JWT
      // (fewer disclosures appended)
      expect(presentData.presentation.length).toBeLessThan(sd.sdJwtFull.length);
    });

    it("should be able to verify a selective presentation from migrated SD-JWT", async () => {
      // Get an ACTIVE credential with SD-JWT (skip suspended ones)
      const syncRes = await fetch(`${BASE}/api/wallet/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId: 416 }),
      });
      const syncData = await syncRes.json();
      const cred = syncData.credentials.find((c: any) => c.credentialStatus === "active" && c.selectiveDisclosure);
      expect(cred).toBeDefined();
      const sd = cred.selectiveDisclosure;

      // Select fields to disclose
      const availableFields = Object.keys(sd.disclosureMap);
      const selectedFields = availableFields.slice(0, 3);

      // Create presentation
      const presentRes = await fetch(`${BASE}/api/wallet/sync/present`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sdJwtFull: sd.sdJwtFull,
          selectedFields: selectedFields,
        }),
      });
      const presentData = await presentRes.json();

      // Verify the presentation
      const verifyRes = await fetch(`${BASE}/api/wallet/sync/verify-selective`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          presentation: presentData.presentation,
        }),
      });
      expect(verifyRes.ok).toBe(true);
      const verifyData = await verifyRes.json();
      expect(verifyData.verified).toBe(true);
      expect(verifyData.trustLevel).toBe("green");
      expect(verifyData.disclosedClaims).toBeDefined();
      // Disclosed claims include selected fields + alwaysDisclosed fields from policy
      const disclosedKeys = Object.keys(verifyData.disclosedClaims);
      // Should include at least the selected fields
      for (const field of selectedFields) {
        expect(disclosedKeys).toContain(field);
      }
      // Total disclosed should be >= selected (because alwaysDisclosed are included too)
      expect(disclosedKeys.length).toBeGreaterThanOrEqual(selectedFields.length);
    });
  });

  describe("SD-JWT issue endpoint (on-demand) should return cached after migration", () => {
    it("should return cached: true for already-migrated credentials", async () => {
      // Get a credential ID from sync
      const syncRes = await fetch(`${BASE}/api/wallet/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId: 416 }),
      });
      const syncData = await syncRes.json();
      const credentialId = syncData.credentials[0].credentialId;

      // Call the issue endpoint (uses patientId from body as fallback)
      const issueRes = await fetch(`${BASE}/api/wallet/sync/sd-jwt/issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credentialId, patientId: 416 }),
      });
      expect(issueRes.ok).toBe(true);
      const issueData = await issueRes.json();
      expect(issueData.cached).toBe(true);
      expect(issueData.sdJwtFull).toBeDefined();
      expect(issueData.disclosureMap).toBeDefined();
      expect(issueData.policy).toBeDefined();
    });
  });
});
