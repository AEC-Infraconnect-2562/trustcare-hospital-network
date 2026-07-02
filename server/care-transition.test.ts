import { describe, expect, it } from "vitest";
import {
  buildCarePackageManifest,
  buildDocumentReference,
  buildServiceRequest,
  defaultTasksForCase,
  validatePartnerConnector,
} from "./careTransition";

describe("care transition and partner portal helpers", () => {
  it("validates partner connectors without pretending manual portal is an API", () => {
    const manual = validatePartnerConnector({
      connectorType: "manual_portal",
      authType: "none",
      supportedDocumentTypes: ["referral_letter"],
    });
    expect(manual.ok).toBe(true);
    expect(manual.capabilities).toContain("document_upload");

    const fhir = validatePartnerConnector({
      connectorType: "fhir_rest",
      endpointUrl: "https://partner.example/fhir",
      authType: "oauth2_client_credentials",
      canonicalMapping: { resources: ["Patient", "ServiceRequest", "DocumentReference"] },
      supportedDocumentTypes: ["referral_letter"],
    });
    expect(fhir.ok).toBe(true);
    expect(fhir.capabilities).toContain("ServiceRequest");

    const invalid = validatePartnerConnector({
      connectorType: "fhir_rest",
      authType: "none",
    });
    expect(invalid.ok).toBe(false);
    expect(invalid.issues[0]).toMatch(/Endpoint URL/);
  });

  it("creates FHIR DocumentReference metadata with stable hash/provenance fields", () => {
    const document = buildDocumentReference({
      id: "doc-1",
      title: "Referral letter",
      documentType: "referral_letter",
      caseType: "external_partner",
      caseId: 44,
      patientId: 7,
      fileName: "referral.pdf",
      fileUrl: "https://partner.example/referral.pdf",
      sourceSystem: "partner_portal",
      sourcePartnerId: 12,
    }) as any;
    expect(document.resourceType).toBe("DocumentReference");
    expect(document.content[0].attachment.hash).toBeTruthy();
    expect(document.extension.some((item: any) => item.valueString === "partner_portal")).toBe(true);
  });

  it("creates ServiceRequest and workflow tasks for real clinical handoff decisions", () => {
    const request = buildServiceRequest({
      id: "sr-1",
      caseType: "cross_border",
      patientId: 7,
      reason: "Cardiology referral",
      priority: "urgent",
    }) as any;
    expect(request.resourceType).toBe("ServiceRequest");
    expect(request.priority).toBe("urgent");

    const tasks = defaultTasksForCase("medical_tourist", { payerRequired: true, translationRequired: true });
    expect(tasks.map((task) => task.taskType)).toEqual(expect.arrayContaining([
      "document_quality",
      "clinical_triage",
      "translation_review",
      "financial_review",
      "discharge_packet",
      "sync_back",
    ]));
  });

  it("builds a care package manifest around FHIR, documents, VC/VP, SHL, and finance references", () => {
    const result = buildCarePackageManifest({
      caseType: "medical_tourist",
      caseId: 99,
      packageType: "medical_tourist",
      documents: [{ id: 1, title: "Passport", documentType: "passport", hash: "sha256-passport", fhirDocumentReferenceId: "docref-1" }],
      credentialIds: ["vc-travel-1"],
      presentationId: "vp-1",
      shlId: 5,
      costEstimate: { amount: "120000", currency: "THB" },
      claimRef: "CLAIM-001",
    });
    expect(result.manifestHash).toBeTruthy();
    expect(result.manifest.trustLayer).toBe("vc-vp-around-care-package");
    expect(result.manifest.items[0].fhirDocumentReferenceId).toBe("docref-1");
    expect(result.manifest.claimRef).toBe("CLAIM-001");
  });
});
