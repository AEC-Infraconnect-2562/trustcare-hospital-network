import { describe, expect, it } from "vitest";
import {
  buildTrustLayerChecklist,
  classifyPacketTransport,
  singleDocumentCredentialContracts,
} from "@shared/trustLayer";

describe("SHL and VC/VP packet trust layer", () => {
  it("uses direct VP for single-document wallet credentials", () => {
    const decision = classifyPacketTransport({
      credentialCount: 1,
      documentTypes: ["medical_certificate"],
    });

    expect(decision.mode).toBe("direct_vp");
    expect(decision.expectedArtifacts).toContain("holder VP");
  });

  it("uses a VP bundle for a small set of wallet credentials", () => {
    const decision = classifyPacketTransport({
      credentialCount: 3,
      documentTypes: ["patient_identity", "prescription", "appointment"],
    });

    expect(decision.mode).toBe("vp_bundle");
  });

  it("uses SHL packet transport for cross-organization and legacy-heavy shares", () => {
    expect(classifyPacketTransport({ credentialCount: 1, context: "cross_border" }).mode).toBe("shl_packet");
    expect(classifyPacketTransport({ credentialCount: 2, hasLegacyDocuments: true }).mode).toBe("shl_packet");
    expect(classifyPacketTransport({ credentialCount: 1, hasFhirBundle: true, estimatedBytes: 45_000 }).mode).toBe("shl_packet");
  });

  it("defines contracts for high-value single-document credentials", () => {
    expect(singleDocumentCredentialContracts.map((contract) => contract.documentType)).toEqual(
      expect.arrayContaining([
        "patient_identity",
        "prescription",
        "medical_certificate",
        "insurance_eligibility",
        "shl_manifest",
      ]),
    );
  });

  it("builds SHL trust checklist with manifest, holder VP, file hash, and access policy checks", () => {
    const checklist = buildTrustLayerChecklist({
      mode: "shl_packet",
      hasIssuer: true,
      hasHolder: true,
      hasSchema: true,
      hasStatus: true,
      hasConsent: true,
      hasManifestCredential: true,
      hasPresentation: true,
      hasPasscodePolicy: false,
      hasFileHashes: true,
      hasDocumentReferences: true,
    });

    expect(checklist.map((item) => item.key)).toEqual(
      expect.arrayContaining(["manifestCredential", "presentation", "passcodePolicy", "fileHashes", "documentReferences"]),
    );
    expect(checklist.find((item) => item.key === "passcodePolicy")?.status).toBe("missing");
  });
});
