import { describe, expect, it } from "vitest";
import { buildShlDocumentBundle } from "./shlDocumentManifest";

describe("SHL document manifest bundle", () => {
  it("associates manifest documents with SHL files and VC/VP trust artifacts", () => {
    const bundle = buildShlDocumentBundle(
      {
        id: 42,
        purpose: "insurance",
        context: "e_claim",
        status: "active",
        currentManifestVersion: 2,
        manifestUrl: "https://trustcare.example/api/shl/manifest/token",
        manifestCredentialId: "urn:trustcare:vc:shl:abc",
        presentationId: "urn:trustcare:vp:holder:def",
        sourceBundleHash: "bundle-hash",
        passcodeRequired: true,
        currentAccessCount: 2,
        maxAccessCount: 5,
      },
      [
        {
          id: 7,
          fileId: "fhir-bundle-abc",
          manifestVersion: 2,
          contentType: "application/fhir+json",
          contentHash: "encrypted-hash",
          plaintextHash: "plain-hash",
          metadata: { scenario: "e_claim" },
        },
      ],
    );

    expect(bundle.bundleId).toBe("shl-bundle-42-v2");
    expect(bundle.documents.length).toBeGreaterThan(3);
    expect(bundle.documents[0].objectLinks.manifestCredential).toBe("Credential/urn:trustcare:vc:shl:abc");
    expect(bundle.documents[0].objectLinks.holderPresentation).toBe("Presentation/urn:trustcare:vp:holder:def");
    expect(bundle.documents[0].objectLinks.shlFile).toBe("shl://42/versions/2/files/fhir-bundle-abc");
    expect(bundle.documents[0].hash.contentHash).toBe("encrypted-hash");
    expect(bundle.files[0].objectLinks.sourceBundle).toBe("Bundle/bundle-hash");
  });
});
