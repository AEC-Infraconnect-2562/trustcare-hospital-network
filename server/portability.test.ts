import { describe, expect, it } from "vitest";
import {
  canonicalizeHisPayload,
  createPortabilityPacket,
  createSyncBackPlan,
  issueMedicalCertificateVc,
  issuePrescriptionVc,
  RECOMMENDED_SYNC_TARGETS,
  verifyCredential,
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
  });

  it("plans idempotent sync-back to legacy targets", () => {
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
  });
});
