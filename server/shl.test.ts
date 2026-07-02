import { describe, expect, it } from "vitest";
import {
  buildManifestResponse,
  buildShlinkPayload,
  buildSimulatedHisPayload,
  canonicalizeHisPayload,
  decodeShlinkPayload,
  decryptShlFile,
  encryptShlFile,
  hashPasscode,
  manifestFileDigest,
  randomBase64UrlBytes,
  scenarioForShlPurpose,
  verifyPasscode,
} from "./portability";

describe("Smart Health Links transport and trust helpers", () => {
  it("builds a shlink payload that points to a manifest URL", () => {
    const key = randomBase64UrlBytes(32);
    const link = buildShlinkPayload({
      manifestUrl: "https://trustcare.example/api/shl/manifest/token-123",
      key,
      passcodeRequired: true,
      expiresAt: new Date("2026-07-31T00:00:00.000Z"),
      label: "Referral SHL",
      viewerBaseUrl: "https://trustcare.example/shl-viewer",
    });

    expect(link.qrPayload.startsWith("shlink:/")).toBe(true);
    expect(link.viewerUrl).toContain("#shlink:/");
    const decoded = decodeShlinkPayload(link.qrPayload);
    expect(decoded.url).toBe("https://trustcare.example/api/shl/manifest/token-123");
    expect(decoded.key).toBe(key);
    expect(decoded.flag).toContain("P");
  });

  it("hashes passcodes and rejects incorrect values", () => {
    const hashed = hashPasscode("493821");
    expect(verifyPasscode("493821", hashed.salt, hashed.hash)).toBe(true);
    expect(verifyPasscode("000000", hashed.salt, hashed.hash)).toBe(false);
  });

  it("encrypts and decrypts FHIR JSON files using direct JWE", async () => {
    const key = randomBase64UrlBytes(32);
    const payload = { resourceType: "Bundle", type: "document", entry: [] };
    const encrypted = await encryptShlFile({ key, contentType: "application/fhir+json", payload });
    const decrypted = await decryptShlFile({ key, jwe: encrypted.jwe });

    expect(decrypted.protectedHeader.cty).toBe("application/fhir+json");
    expect(decrypted.payload).toEqual(payload);
    expect(encrypted.contentHash).not.toBe(encrypted.plaintextHash);
  });

  it("builds a standard SHL manifest without forcing the shlink itself to be a VC", () => {
    const files = [
      {
        fileId: "fhir-1",
        contentType: "application/fhir+json" as const,
        embeddedJwe: "jwe.payload",
        contentHash: "hash-1",
        plaintextHash: "plain-1",
        version: 1,
      },
    ];
    const manifest = buildManifestResponse({
      files,
      trustcare: { trustLayer: "vc-vp-around-shl", manifestCredentialId: "vc-1", presentationId: "vp-1" },
    });

    expect(manifest.files).toEqual([{ contentType: "application/fhir+json", embedded: "jwe.payload" }]);
    expect(manifest.trustcare.trustLayer).toBe("vc-vp-around-shl");
    expect(manifestFileDigest(files)).not.toBe(manifestFileDigest([{ ...files[0], contentHash: "hash-2" }]));
  });

  it("generates realistic simulator payloads that canonicalize to FHIR bundles", () => {
    const payload = buildSimulatedHisPayload({
      patient: { id: 7, name: "Demo Patient", hn: "HN-0007" },
      hospital: { id: 4, code: "TCC", nameEn: "TrustCare Central Hospital" },
      purpose: "insurance",
      context: "e_claim",
      credentials: [{ credentialId: "vc-claim-001", type: "claim_package", credentialData: { total: 4200 } }],
    });
    const canonical = canonicalizeHisPayload({
      sourceFormat: "db_view",
      payload,
      sourceSystem: "TCC-SHL-SIM",
      sourceOrganizationId: "TCC",
    });

    expect(scenarioForShlPurpose("insurance", "e_claim")).toBe("e_claim");
    expect(canonical.bundle.resourceType).toBe("Bundle");
    expect(canonical.summary.resourceCounts.Patient).toBe(1);
    expect(canonical.summary.resourceCounts.DocumentReference).toBeGreaterThan(0);
    expect(canonical.issues.filter((issue) => issue.severity === "error")).toHaveLength(0);
  });
});
