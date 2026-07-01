import { describe, expect, it } from "vitest";
import {
  canonicalizeHisPayload,
  buildTrustRegistryPolicy,
  createPortabilityPacket,
  createSyncBackPlan,
  executeSyncBackPlan,
  documentStorageMetadata,
  generateTrustcareDemoSeed,
  hospitalDidWeb,
  issueMedicalCertificateVc,
  issuePrescriptionVc,
  issueSyncReceiptVc,
  patientDidKey,
  RECOMMENDED_SYNC_TARGETS,
  reviewCsvForCanonicalMapping,
  canonicalizeReviewedDraft,
  standardLabelCatalog,
  verifyCredential,
  verifyJsonPresentation,
  verifyPresentation,
} from "./portability";

const issuer = {
  id: "trustcare-demo",
  name: "Trustcare Demo Hospital",
  did: "did:web:trustcare.network:demo",
  country: "TH",
};

const objectPayload = {
  patient: {
    hn: "HN-10045",
    cid: "1101700203456",
    name: "Somchai Jaidee",
    birthDate: "1985-03-15",
    sex: "M",
  },
  allergies: [{ substance: "Penicillin", severity: "high", reaction: "Anaphylaxis" }],
  medications: [{ code: "TMT-123", name: "Metformin 500mg", frequency: "1 tab twice daily" }],
  diagnoses: [{ code: "E11", display: "Type 2 diabetes mellitus" }],
  labs: [{ loinc: "4548-4", name: "HbA1c", value: "7.8", unit: "%", specimenDate: "2026-06-30" }],
};

describe("Patient Data Portability Layer", () => {
  it("canonicalizes DB-view style HIS payload into FHIR Bundle with Provenance", () => {
    const result = canonicalizeHisPayload({
      sourceFormat: "db_view",
      payload: objectPayload,
      sourceSystem: "demo-his",
      sourceOrganizationId: "TH-HCODE-99999",
      sourceOrganizationName: "Trustcare Demo Hospital",
    });

    expect(result.bundle.resourceType).toBe("Bundle");
    expect(result.summary.resourceCounts.Patient).toBe(1);
    expect(result.summary.resourceCounts.AllergyIntolerance).toBe(1);
    expect(result.summary.resourceCounts.MedicationStatement).toBe(1);
    expect(result.provenanceResources).toHaveLength(5);
    expect(result.issues.filter((issue) => issue.severity === "error")).toHaveLength(0);
  });

  it("canonicalizes HL7 v2 payload as a second source format", () => {
    const hl7 = [
      "MSH|^~\\&|HIS|TRUSTCARE|PORTABILITY|TRUSTCARE|202607010900||ORU^R01|MSG0001|P|2.5",
      "PID|1||HN-20001^^^TRUSTCARE^MR||JAIDEE^SOMCHAI||19850315|M|||Bangkok||0812345678",
      "AL1|1||PEN^Penicillin||Anaphylaxis",
      "DG1|1||E11^Type 2 diabetes mellitus||20260701",
      "OBX|1|NM|4548-4^HbA1c||7.8|%|4.0-6.0|H|||F|||20260630",
    ].join("\r");

    const result = canonicalizeHisPayload({
      sourceFormat: "hl7v2",
      payload: hl7,
      sourceSystem: "legacy-hl7",
      sourceOrganizationId: "TH-HCODE-88888",
    });

    expect(result.summary.resourceCounts.Patient).toBe(1);
    expect(result.summary.resourceCounts.Observation).toBe(1);
    expect(result.summary.patientName).toContain("SOMCHAI");
  });

  it("creates a consent-gated portability packet with verifiable presentation", async () => {
    const packet = await createPortabilityPacket({
      context: "cross_border",
      hisInput: {
        sourceFormat: "db_view",
        payload: objectPayload,
        sourceSystem: "demo-his",
        sourceOrganizationId: "TH-HCODE-99999",
      },
      issuer,
      holderDid: "did:key:patient-demo",
      requesterId: "doctor-demo",
      requesterRole: "doctor",
      consent: {
        id: "consent-001",
        patientId: "patient-demo",
        purpose: "referral",
        requesterId: "doctor-demo",
        requesterRole: "doctor",
        scopes: ["Patient.read", "Condition.read", "AllergyIntolerance.read", "Medication.read", "Observation.read"],
        status: "granted",
        grantedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      },
    });

    expect(packet.policyDecision.allowed).toBe(true);
    expect(packet.outboundCredentials.map((credential) => credential.type)).toContain("PatientSummaryCredential");
    expect(packet.shlManifest.files.every((file: any) => file.hash)).toBe(true);

    const verification = await verifyPresentation({ jwt: packet.presentation.jwt });
    expect(verification.verified).toBe(true);
    expect(verification.credentials.length).toBeGreaterThan(0);
  });

  it("issues and verifies medical certificate and prescription credentials", async () => {
    const certificate = await issueMedicalCertificateVc({
      issuer,
      holderDid: "did:key:patient-demo",
      patient: { id: "patient-demo", name: "Somchai Jaidee" },
      practitioner: { id: "doctor-demo", name: "Dr. Arisa Klinjai", licenseNo: "MD-TH-12345" },
      organization: { id: "TH-HCODE-99999", name: "Trustcare Demo Hospital" },
      diagnosisText: "Upper respiratory tract infection.",
      fitnessForWork: "restricted",
      recommendations: ["Rest for two days"],
    });
    const prescription = await issuePrescriptionVc({
      issuer,
      holderDid: "did:key:patient-demo",
      patient: { id: "patient-demo", name: "Somchai Jaidee" },
      prescriber: { id: "doctor-demo", name: "Dr. Arisa Klinjai", licenseNo: "MD-TH-12345" },
      organization: { id: "TH-HCODE-99999", name: "Trustcare Demo Hospital" },
      medications: [{ code: "TMT-123", name: "Metformin 500mg", instructions: "Take one tablet twice daily.", daysSupply: 30 }],
    });

    expect(certificate.type).toBe("MedicalCertificateCredential");
    expect(prescription.type).toBe("PrescriptionCredential");
    expect((await verifyCredential({ jwt: certificate.jwt })).verified).toBe(true);
    expect((await verifyCredential({ jwt: prescription.jwt })).verified).toBe(true);

    const policy = buildTrustRegistryPolicy({
      entries: [{ did: issuer.did, trustLevel: "verified", isActive: true }],
      mode: "required",
    });
    expect((await verifyCredential({ jwt: certificate.jwt, trustPolicy: policy })).verified).toBe(true);
    expect((await verifyCredential({ jwt: certificate.jwt, trustPolicy: buildTrustRegistryPolicy({ entries: [], mode: "required" }) })).verified).toBe(false);

    const statusListIndex = String(certificate.credential.credentialStatus.statusListIndex);
    const revoked = await verifyCredential({ jwt: certificate.jwt, revokedStatusIndexes: [statusListIndex] });
    expect(revoked.verified).toBe(false);
    expect(revoked.errors).toContain("Credential status list index is revoked.");
  });

  it("plans idempotent sync-back to legacy targets and issues a receipt VC", async () => {
    const target = RECOMMENDED_SYNC_TARGETS.find((item) => item.kind === "fhir_rest")!;
    const plan = createSyncBackPlan({
      target,
      operation: "upsert",
      resource: {
        resourceType: "MedicationRequest",
        id: "rx-demo-001",
        status: "active",
        intent: "order",
        medicationCodeableConcept: { text: "Metformin 500mg" },
        subject: { reference: "Patient/HN-10045" },
      },
      sourceEventId: "event-001",
      patientBusinessKey: "HN-10045",
      expectedVersion: 'W/"1"',
      reason: "Prescription VC issued",
      actorId: "doctor-demo",
    });

    expect(plan.status).toBe("ready");
    expect(plan.idempotencyKey).toHaveLength(64);
    expect(plan.consistencyKey).toHaveLength(64);
    expect(plan.preconditions.some((item) => item.type === "optimistic_version")).toBe(true);

    const execution = executeSyncBackPlan(plan, { actorId: "doctor-demo" });
    expect(execution.status).toBe("accepted");
    expect(execution.targetReference).toBe("MedicationRequest/rx-demo-001");
    expect(execution.consistency.matched).toBe(true);
    expect(execution.reconciliation?.status).toBe("not_required");

    const receipt = await issueSyncReceiptVc({
      issuer,
      holderDid: "did:key:patient-demo",
      subjectId: "patient-demo",
      plan,
      execution,
    });
    expect(receipt.type).toBe("SyncReceiptCredential");
    expect((await verifyCredential({ jwt: receipt.jwt })).verified).toBe(true);

    const hl7Target = RECOMMENDED_SYNC_TARGETS.find((item) => item.kind === "hl7v2")!;
    const hl7Plan = createSyncBackPlan({
      target: hl7Target,
      operation: "append",
      resource: { resourceType: "Observation", id: "lab-demo-001", code: { text: "HbA1c" }, valueQuantity: { value: 7.8, unit: "%" } },
      sourceEventId: "event-002",
      patientBusinessKey: "HN-10045",
      reason: "Lab result accepted",
      actorId: "doctor-demo",
    });
    const hl7Execution = executeSyncBackPlan(hl7Plan, { actorId: "doctor-demo" });
    expect(hl7Execution.reconciliation?.status).toBe("scheduled");
    expect(hl7Execution.reconciliation?.runMode).toBe("ack_replay");
  });

  it("generates DID-bound seed data, reviews CSV through canonical mapping, and classifies VC documents for storage", () => {
    const seed = generateTrustcareDemoSeed({ patientsPerHospital: 4 });
    expect(seed.counts.hospitals).toBe(3);
    expect(seed.counts.patients).toBe(12);
    expect(seed.hospitals.every((hospital: any) => String(hospital.did).startsWith("did:web:"))).toBe(true);
    expect(seed.patients.every((patient: any) => String(patient.holderDid).startsWith("did:key:"))).toBe(true);

    expect(hospitalDidWeb("TCC")).toBe("did:web:trustcare.network:hospital:tcc");
    expect(patientDidKey("TCC:P001:CP-TH-2026-000001")).toMatch(/^did:key:z/);

    const review = reviewCsvForCanonicalMapping({
      csvText: seed.sourceTruth.csv.csvText,
      sourceSystem: "TCC-HIS",
      sourceOrganizationId: "HCODE-TCC-99991",
    });
    expect(review.ready).toBeGreaterThan(0);
    const canonical = canonicalizeReviewedDraft(review.drafts[0]);
    expect(canonical.makeVcReady).toBe(true);
    expect(canonical.canonical.bundle.resourceType).toBe("Bundle");

    const labels = standardLabelCatalog();
    expect(labels.documentCategories.medication_and_pharmacy.en).toBe("Medication and Pharmacy");
    const storage = documentStorageMetadata({
      documentType: "prescription",
      hospitalCode: "TCC",
      patientKey: "HN-TCC-0001",
      credentialId: "urn:trustcare:vc:test",
    });
    expect(storage.category).toBe("medication_and_pharmacy");
    expect(storage.storagePath).toContain("/prescription/");
  });

  it("verifies JSON VP fixtures structurally without accepting placeholder proof as green trust", () => {
    const issuerDid = "did:web:trustcare.network:hospital:tcc";
    const holderDid = "did:key:z6MkTrustCarePatientP001";
    const result = verifyJsonPresentation({
      presentation: {
        id: "vp-test",
        type: ["VerifiablePresentation"],
        holder: holderDid,
        purpose: "pharmacy",
        verifiableCredential: [
          {
            id: "vc-prescription-test",
            type: ["VerifiableCredential", "PrescriptionCredential"],
            issuer: { id: issuerDid },
            credentialSubject: {
              id: holderDid,
              patient: { name: "Somchai Jaidee" },
              clinical: { medications: [{ name: "Metformin 500mg" }] },
            },
            proof: { type: "DataIntegrityProof", proofValue: "placeholder" },
          },
        ],
      },
      trustedIssuers: [issuerDid],
      requiredCredentialTypes: ["prescription"],
    });
    expect(result.verified).toBe(true);
    expect(result.trustLevel).toBe("yellow");
    expect(result.warnings.join(" ")).toContain("placeholder");
  });
});
