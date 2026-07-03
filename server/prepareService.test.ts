import { describe, expect, it } from "vitest";
import {
  buildAudienceUseCases,
  buildContractHubCatalog,
  buildDataMappingV2Profiles,
  buildPrepareServicePublicApiExamples,
  buildPrepareServiceWorkbench,
  buildServiceBundleEnvelope,
  buildServiceReadinessContracts,
  buildWalletDeploymentEnvelope,
  buildWalkInWalletConnection,
  simulatePrepareServiceImport,
} from "./prepareService";

describe("Prepare for Service core workbench", () => {
  it("separates patient and hospital document bundle use cases", () => {
    const useCases = buildAudienceUseCases();

    expect(useCases.patient.length).toBeGreaterThan(7);
    expect(useCases.hospital.length).toBeGreaterThan(7);
    expect(useCases.patient.some((item) => item.id === "hospital.inbound_international_patient")).toBe(false);
    expect(useCases.hospital.some((item) => item.id === "hospital.inbound_international_patient")).toBe(true);
  });

  it("uses outbound care abroad label for patient-side medical tourist context", () => {
    const useCases = buildAudienceUseCases();
    const patientMedical = useCases.patient.find((item) => item.id === "patient.medical_tourist");
    const hospitalMedical = useCases.hospital.find((item) => item.id === "hospital.medical_tourist");

    expect(patientMedical?.labelEn).toBe("Prepare care abroad");
    expect(patientMedical?.bundleType).toBe("OutboundInternationalCareBundle");
    expect(hospitalMedical?.labelEn).toBe("Inbound international patient");
    expect(hospitalMedical?.bundleType).toBe("InboundMedicalTouristBundle");
  });

  it("builds contract hub contracts for every readiness context", () => {
    const contracts = buildServiceReadinessContracts();

    expect(contracts).toHaveLength(7);
    expect(contracts.every((contract) => contract.questionnaire.resourceType === "Questionnaire")).toBe(true);
    expect(contracts.every((contract) => contract.consentPolicy.pdpaControls.includes("data_minimization"))).toBe(true);
    expect(contracts.every((contract) => contract.packetTrustPolicy.singleDocument.mode === "direct_vp")).toBe(true);
    expect(contracts.every((contract) => contract.packetTrustPolicy.shl.mode === "shl_packet")).toBe(true);
  });

  it("creates patient and hospital workbench data from the same contract", () => {
    const workbench = buildPrepareServiceWorkbench({ context: "medical_tourist", now: "2026-07-03T10:00:00.000Z" });

    expect(workbench.simulationMode).toBe(true);
    expect(workbench.activeContract.patientLabelEn).toBe("Prepare care abroad");
    expect(workbench.activeContract.hospitalLabelEn).toBe("Inbound international patient");
    expect(workbench.patient.visibleUseCases.some((item) => item.id === "hospital.inbound_international_patient")).toBe(false);
    expect(workbench.hospital.hiddenFromPatient.some((item) => item.id === "hospital.inbound_international_patient")).toBe(true);
    expect(workbench.singleDocumentVcVp.catalog.length).toBeGreaterThan(4);
    expect(workbench.patient.packetActions).toContain("present_single_document_vp");
  });

  it("builds service bundle envelopes with trust layer and FHIR bundle", () => {
    const bundle = buildServiceBundleEnvelope({
      context: "referral",
      audience: "patient",
      patientId: 1,
      now: "2026-07-03T10:00:00.000Z",
    });

    expect(bundle.bundleType).toBe("ReferralReadinessBundle");
    expect(bundle.fhirBundle.resourceType).toBe("Bundle");
    expect(bundle.trustLayer.integrityHash).toMatch(/^[a-f0-9]{64}$/);
    expect(bundle.trustLayer.transportDecision.mode).toBe("shl_packet");
    expect(bundle.trustLayer.verificationChecklist.length).toBeGreaterThan(5);
    expect(bundle.operationOutcome.resourceType).toBe("OperationOutcome");
  });

  it("simulates deploy-to-wallet and walk-in wallet connection", () => {
    const deployment = buildWalletDeploymentEnvelope({
      context: "opd_visit",
      targetWalletMode: "walk_in",
      targetPatientIds: [1, 2],
      now: "2026-07-03T10:00:00.000Z",
    });
    const walkIn = buildWalkInWalletConnection({
      patientName: "Walk-in Patient",
      consentAttested: true,
      now: "2026-07-03T10:00:00.000Z",
    });

    expect(deployment.targetWalletSelection.supportsWalkInWallet).toBe(true);
    expect(deployment.issuePolicy.makerCheckerRequired).toBe(true);
    expect(walkIn.status).toBe("ready_to_link");
    expect(walkIn.holderDid).toMatch(/^did:key:/);
  });

  it("simulates imports, mapping v2 profiles, and public API examples", () => {
    const importJob = simulatePrepareServiceImport({
      context: "insurance_claim",
      sourceType: "patient_upload",
      documentType: "claim_receipt",
      now: "2026-07-03T10:00:00.000Z",
    });
    const mappings = buildDataMappingV2Profiles();
    const api = buildPrepareServicePublicApiExamples("opd_visit");
    const hub = buildContractHubCatalog();

    expect(importJob.status).toBe("needs_review");
    expect(importJob.documentReference.resourceType).toBe("DocumentReference");
    expect(mappings.profiles).toHaveLength(7);
    expect(api.basePath).toBe("/api/public/prepare-service/v1");
    expect(api.endpoints.map((endpoint) => endpoint.path)).toContain("/wallet-deployments");
    expect(api.endpoints.map((endpoint) => endpoint.path)).toContain("/presentations/single-document");
    expect(hub.singleDocumentCredentialContracts.length).toBeGreaterThan(4);
    expect(hub.compatibilityRules.some((rule) => rule.includes("Inbound international patient"))).toBe(true);
  });
});
