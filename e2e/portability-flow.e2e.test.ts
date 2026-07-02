import { describe, expect, it } from "vitest";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";
import { issueMedicalCertificateVc, issuePrescriptionVc } from "../server/portability";

function createContext(overrides: Partial<TrpcContext["user"]> = {}): TrpcContext {
  return {
    user: {
      id: 77,
      openId: "doctor-e2e",
      email: "doctor@trustcare.th",
      name: "Doctor E2E",
      loginMethod: "test",
      role: "admin",
      systemRole: "doctor",
      credentialEntitlements: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      preferredLanguage: "th",
      isActive: true,
      ...overrides,
    },
    req: { protocol: "https", headers: {}, ip: "127.0.0.1" } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

describe("portability E2E contract", () => {
  it("creates a cross-border VP, verifies it, issues clinical document VCs, and closes HIS sync-back with a receipt VC", async () => {
    const caller = appRouter.createCaller(createContext());
    const hisInput = {
      sourceFormat: "db_view" as const,
      sourceSystem: "e2e-his",
      sourceOrganizationId: "TH-HCODE-E2E",
      sourceOrganizationName: "Trustcare E2E Hospital",
      mapperVersion: "e2e",
      payload: {
        patient: { hn: "HN-E2E-001", cid: "1101700203456", name: "Somchai Jaidee", birthDate: "1985-03-15", sex: "M" },
        allergies: [{ substance: "Penicillin", severity: "high", reaction: "Anaphylaxis" }],
        medications: [{ code: "TMT-123", name: "Metformin 500mg", frequency: "1 tab twice daily" }],
        diagnoses: [{ code: "E11", display: "Type 2 diabetes mellitus" }],
      },
    };

    const packet = await caller.portability.createPacket({
      context: "cross_border",
      hisInput,
      holderDid: "did:key:e2e-patient",
      consent: {
        id: "consent-e2e",
        patientId: "patient-e2e",
        purpose: "referral",
        requesterId: "doctor-e2e",
        requesterRole: "doctor",
        scopes: ["Patient.read", "Condition.read", "AllergyIntolerance.read", "Medication.read"],
        status: "granted",
        grantedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      },
    });

    expect(packet.policyDecision.allowed).toBe(true);
    expect(packet.presentation.jwt).toMatch(/^eyJ/);

    const verifiedPacket = await caller.portability.verify({ jwt: packet.presentation.jwt, kind: "presentation" });
    if (!verifiedPacket.verified) {
      console.log("[DEBUG] VP verification failed:", JSON.stringify({ errors: verifiedPacket.errors, warnings: verifiedPacket.warnings }, null, 2));
    }
    expect(verifiedPacket.verified).toBe(true);

    const readiness = await caller.portability.productionReadiness();
    expect(readiness.syncAdapters.adapters.length).toBeGreaterThan(0);

    const makerCaller = appRouter.createCaller(createContext({
      id: 88,
      openId: "maker-e2e",
      systemRole: "maker",
      credentialEntitlements: { makerTypes: ["medical_certificate", "prescription"], checkerTypes: [] },
    } as any));
    const certificateRequest = await makerCaller.portability.issueMedicalCertificate({
      holderDid: "did:key:e2e-patient",
      issuerHospitalId: 1,
      subjectId: 101,
      patient: { id: "patient-e2e", name: "Somchai Jaidee" },
      practitioner: { id: "doctor-e2e", name: "Doctor E2E", licenseNo: "MD-E2E" },
      organization: { id: "TH-HCODE-E2E", name: "Trustcare E2E Hospital" },
      diagnosisText: "Clinically stable.",
      fitnessForWork: "restricted",
      recommendations: ["Rest for two days"],
    });

    const prescriptionRequest = await makerCaller.portability.issuePrescription({
      holderDid: "did:key:e2e-patient",
      issuerHospitalId: 1,
      subjectId: 101,
      patient: { id: "patient-e2e", name: "Somchai Jaidee" },
      prescriber: { id: "doctor-e2e", name: "Doctor E2E", licenseNo: "MD-E2E" },
      organization: { id: "TH-HCODE-E2E", name: "Trustcare E2E Hospital" },
      medications: [{ code: "TMT-123", name: "Metformin 500mg", instructions: "Take one tablet twice daily.", daysSupply: 30 }],
    });

    expect(certificateRequest.status).toBe("submitted");
    expect(prescriptionRequest.status).toBe("submitted");

    const issuer = { id: "TH-HCODE-E2E", name: "Trustcare E2E Hospital", did: "did:web:trustcare.network:hospital:tcc", country: "TH" };
    const certificate = await issueMedicalCertificateVc({
      issuer,
      holderDid: "did:key:e2e-patient",
      patient: { id: "patient-e2e", name: "Somchai Jaidee" },
      practitioner: { id: "doctor-e2e", name: "Doctor E2E", licenseNo: "MD-E2E" },
      organization: { id: "TH-HCODE-E2E", name: "Trustcare E2E Hospital" },
      diagnosisText: "Clinically stable.",
      fitnessForWork: "restricted",
      recommendations: ["Rest for two days"],
    });
    const prescription = await issuePrescriptionVc({
      issuer,
      holderDid: "did:key:e2e-patient",
      patient: { id: "patient-e2e", name: "Somchai Jaidee" },
      prescriber: { id: "doctor-e2e", name: "Doctor E2E", licenseNo: "MD-E2E" },
      organization: { id: "TH-HCODE-E2E", name: "Trustcare E2E Hospital" },
      medications: [{ code: "TMT-123", name: "Metformin 500mg", instructions: "Take one tablet twice daily.", daysSupply: 30 }],
    });

    expect((await caller.portability.verify({ jwt: certificate.jwt, kind: "credential" })).verified).toBe(true);
    expect((await caller.portability.verify({ jwt: prescription.jwt, kind: "credential" })).verified).toBe(true);

    const targets = await caller.portability.syncTargets();
    const plan = await caller.portability.planSyncBack({
      target: targets[0] as any,
      operation: "upsert",
      resource: prescription.credential.credentialSubject.fhir.medicationRequests[0],
      sourceEventId: "e2e-prescription-issued",
      patientBusinessKey: "HN-E2E-001",
      expectedVersion: 'W/"1"',
      reason: "Prescription VC issued and needs HIS consistency",
    });

    expect(plan.status).toBe("ready");
    expect(plan.outboundPayload.protocol).toBe("FHIR REST");

    const syncReceipt = await caller.portability.executeSyncBack({
      plan,
      holderDid: "did:key:e2e-patient",
      subjectId: "patient-e2e",
    });

    expect(syncReceipt.execution.status).toBe("accepted");
    expect(syncReceipt.execution.reconciliation?.status).toBe("not_required");
    expect(syncReceipt.syncReceiptCredential.type).toBe("SyncReceiptCredential");
    expect((await caller.portability.verify({ jwt: syncReceipt.syncReceiptCredential.jwt, kind: "credential" })).verified).toBe(true);
  });

  it("blocks Maker users who are not entitled to make a requested document type", async () => {
    const caller = appRouter.createCaller(createContext({
      id: 89,
      openId: "limited-maker-e2e",
      role: "user",
      systemRole: "maker",
      credentialEntitlements: { makerTypes: ["patient_identity"], checkerTypes: [] },
    } as any));

    await expect(caller.portability.issuePrescription({
      issuerHospitalId: 1,
      subjectId: 101,
      holderDid: "did:key:e2e-patient",
      patient: { id: "patient-e2e", name: "Somchai Jaidee" },
      prescriber: { id: "doctor-e2e", name: "Doctor E2E" },
      organization: { id: "TH-HCODE-E2E", name: "Trustcare E2E Hospital" },
      medications: [{ name: "Metformin 500mg" }],
    })).rejects.toThrow("not entitled");
  });
});
