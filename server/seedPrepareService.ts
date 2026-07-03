/**
 * Idempotent seed for Prepare for Service v2 Contract Hub.
 * Populates: service_readiness_contracts, service_bundle_templates, contract_artifacts
 * Safe to rerun - uses INSERT ... ON DUPLICATE KEY UPDATE pattern.
 */
import { getDb } from "./db";
import {
  buildServiceReadinessContracts,
  buildAudienceUseCases,
} from "./prepareService";
import {
  serviceReadinessContracts,
  serviceBundleTemplates,
  contractArtifacts,
} from "../drizzle/schema";

export async function seedPrepareServiceContracts() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const contracts = buildServiceReadinessContracts();

  // Seed contracts
  for (const c of contracts) {
    await db
      .insert(serviceReadinessContracts)
      .values({
        contractId: c.contractId,
        context: c.context,
        version: c.version,
        status: "active",
        patientLabel: c.patientLabel,
        patientLabelEn: c.patientLabelEn,
        hospitalLabel: c.hospitalLabel,
        hospitalLabelEn: c.hospitalLabelEn,
        patientVisible: c.patientVisible,
        hospitalVisible: c.hospitalVisible,
        patientBundleType: c.bundleTypes.patient,
        hospitalBundleType: c.bundleTypes.hospital,
        requirementsJson: c.requirements,
        questionnaireJson: c.questionnaire,
        consentPolicyJson: c.consentPolicy,
      })
      .onDuplicateKeyUpdate({
        set: {
          version: c.version,
          patientLabel: c.patientLabel,
          patientLabelEn: c.patientLabelEn,
          hospitalLabel: c.hospitalLabel,
          hospitalLabelEn: c.hospitalLabelEn,
          patientVisible: c.patientVisible,
          hospitalVisible: c.hospitalVisible,
          patientBundleType: c.bundleTypes.patient,
          hospitalBundleType: c.bundleTypes.hospital,
          requirementsJson: c.requirements,
          questionnaireJson: c.questionnaire,
          consentPolicyJson: c.consentPolicy,
        },
      });
  }

  // Seed bundle templates from audience use cases
  const useCases = buildAudienceUseCases();
  for (const uc of useCases.all) {
    const templateId = `tmpl_${uc.id}`;
    const contractId = contracts.find((c) => c.context === uc.context)?.contractId ?? `contract.${uc.context}`;
    await db
      .insert(serviceBundleTemplates)
      .values({
        templateId,
        contractId,
        audience: uc.audience === "hospital" ? "hospital" : "patient",
        bundleType: uc.bundleType,
        direction: uc.direction === "patient_outbound" || uc.direction === "hospital_outbound"
          ? "outbound"
          : uc.direction === "shared" || uc.direction === "post_service"
            ? "bidirectional"
            : "inbound",
        transportPolicyJson: { recommendedTransports: ["vp", "shl"] },
        itemsJson: { exampleDocuments: uc.exampleDocuments, rationale: uc.rationale },
        status: "active",
      })
      .onDuplicateKeyUpdate({
        set: {
          bundleType: uc.bundleType,
          direction: uc.direction === "patient_outbound" || uc.direction === "hospital_outbound"
            ? "outbound"
            : uc.direction === "shared" || uc.direction === "post_service"
              ? "bidirectional"
              : "inbound",
          transportPolicyJson: { recommendedTransports: ["vp", "shl"] },
          itemsJson: { exampleDocuments: uc.exampleDocuments, rationale: uc.rationale },
        },
      });
  }

  // Seed contract artifacts (one per contract per artifact type)
  const artifactTypes: Array<{
    type: "questionnaire" | "questionnaire_response" | "document_reference_profile" | "vc_schema" | "shl_manifest_schema" | "openapi_doc" | "trust_policy" | "consent_template";
    title: string;
    titleEn: string;
  }> = [
    { type: "questionnaire", title: "แบบสอบถามเตรียมรับบริการ", titleEn: "Service Readiness Questionnaire" },
    { type: "document_reference_profile", title: "โปรไฟล์เอกสารอ้างอิง", titleEn: "Document Reference Profile" },
    { type: "vc_schema", title: "VC Schema สำหรับ Credential", titleEn: "VC Schema for Credential" },
    { type: "trust_policy", title: "นโยบายความน่าเชื่อถือ", titleEn: "Trust Policy" },
    { type: "consent_template", title: "แม่แบบความยินยอม PDPA", titleEn: "PDPA Consent Template" },
  ];

  let artifactCount = 0;
  for (const c of contracts) {
    for (const at of artifactTypes) {
      const artifactId = `artifact_${c.context}_${at.type}`;
      await db
        .insert(contractArtifacts)
        .values({
          artifactId,
          contractId: c.contractId,
          artifactType: at.type,
          title: at.title,
          titleEn: at.titleEn,
          version: "1.0.0",
          contentJson: {
            contractContext: c.context,
            generatedFrom: "seedPrepareServiceContracts",
            placeholder: true,
          },
          status: "active",
        })
        .onDuplicateKeyUpdate({
          set: {
            title: at.title,
            titleEn: at.titleEn,
            version: "1.0.0",
            contentJson: {
              contractContext: c.context,
              generatedFrom: "seedPrepareServiceContracts",
              placeholder: true,
            },
          },
        });
      artifactCount++;
    }
  }

  // Also seed global OpenAPI and SHL manifest schema artifacts
  const globalArtifacts = [
    { artifactId: "artifact_global_openapi", type: "openapi_doc" as const, title: "OpenAPI Specification", titleEn: "OpenAPI Specification" },
    { artifactId: "artifact_global_shl_manifest", type: "shl_manifest_schema" as const, title: "SHL Manifest Schema", titleEn: "SHL Manifest Schema" },
  ];
  for (const ga of globalArtifacts) {
    await db
      .insert(contractArtifacts)
      .values({
        artifactId: ga.artifactId,
        contractId: "global",
        artifactType: ga.type,
        title: ga.title,
        titleEn: ga.titleEn,
        version: "1.0.0",
        contentJson: { scope: "global", generatedFrom: "seedPrepareServiceContracts" },
        status: "active",
      })
      .onDuplicateKeyUpdate({
        set: { title: ga.title, version: "1.0.0" },
      });
    artifactCount++;
  }

  return {
    contractsSeeded: contracts.length,
    templatesSeeded: useCases.all.length,
    artifactsSeeded: artifactCount,
  };
}
