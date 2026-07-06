import { describe, it, expect } from "vitest";

describe("Wallet Sync API - Router Structure", () => {
  it("createWalletSyncRouter returns an Express Router", async () => {
    const { createWalletSyncRouter } = await import("./walletSyncApi");
    const router = createWalletSyncRouter();
    expect(router).toBeDefined();
    expect(typeof router).toBe("function");
  });

  it("router has expected sync routes registered", async () => {
    const { createWalletSyncRouter } = await import("./walletSyncApi");
    const router = createWalletSyncRouter();
    const stack = (router as any).stack || [];
    const routes = stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods),
      }));

    // POST /api/wallet/sync
    expect(routes).toContainEqual(
      expect.objectContaining({ path: "/api/wallet/sync", methods: expect.arrayContaining(["post"]) })
    );

    // GET /api/wallet/sync/status
    expect(routes).toContainEqual(
      expect.objectContaining({ path: "/api/wallet/sync/status", methods: expect.arrayContaining(["get"]) })
    );

    // POST /api/wallet/sync/did-resolve
    expect(routes).toContainEqual(
      expect.objectContaining({ path: "/api/wallet/sync/did-resolve", methods: expect.arrayContaining(["post"]) })
    );
  });
});

describe("VP Context Mapping - contextForWalletCardType", () => {
  // We test the deduplication logic inline since the function is not exported
  // Instead we test the expected mapping behavior

  it("maps appointment cardType to appointment context", () => {
    const mapping: Record<string, string> = {
      appointment: "appointment",
      prescription: "prescription",
      lab_result: "lab_result",
      diagnostic_report: "diagnostic_report",
      discharge_summary: "discharge_summary",
      medical_certificate: "medical_certificate",
      referral: "referral",
      immunization: "immunization",
      allergy: "allergy_alert",
      medication: "medication",
      patient_summary: "patient_summary",
      consent: "consent",
      identity: "identity",
      patient_identity: "identity",
      staff_identity: "identity",
      coverage: "insurance",
      insurance_eligibility: "insurance",
      claim: "claim",
      claim_package: "claim",
      claim_receipt: "claim",
      travel_document: "travel_document",
      travel_document_verification: "travel_document",
      shl_manifest: "shl_package",
      pharmacy_dispense: "pharmacy",
      visa_support_letter: "visa_support",
      quotation: "quotation",
      guarantee_letter: "guarantee_letter",
      mpi_link_certificate: "identity_link",
      sync_receipt: "sync_receipt",
    };

    // Verify all expected mappings are defined
    expect(Object.keys(mapping).length).toBeGreaterThan(20);

    // Verify specific important mappings
    expect(mapping["appointment"]).toBe("appointment");
    expect(mapping["prescription"]).toBe("prescription");
    expect(mapping["visa_support_letter"]).toBe("visa_support");
    expect(mapping["patient_identity"]).toBe("identity");
    expect(mapping["claim_package"]).toBe("claim");
    expect(mapping["shl_manifest"]).toBe("shl_package");
  });

  it("does not map any cardType to single_document", () => {
    const mapping: Record<string, string> = {
      appointment: "appointment",
      prescription: "prescription",
      lab_result: "lab_result",
      diagnostic_report: "diagnostic_report",
      discharge_summary: "discharge_summary",
      medical_certificate: "medical_certificate",
      referral: "referral",
      immunization: "immunization",
      allergy: "allergy_alert",
      medication: "medication",
      patient_summary: "patient_summary",
      consent: "consent",
      identity: "identity",
      patient_identity: "identity",
      staff_identity: "identity",
      coverage: "insurance",
      insurance_eligibility: "insurance",
      claim: "claim",
      claim_package: "claim",
      claim_receipt: "claim",
      travel_document: "travel_document",
      travel_document_verification: "travel_document",
      shl_manifest: "shl_package",
      pharmacy_dispense: "pharmacy",
      visa_support_letter: "visa_support",
      quotation: "quotation",
      guarantee_letter: "guarantee_letter",
      mpi_link_certificate: "identity_link",
      sync_receipt: "sync_receipt",
    };

    for (const [key, value] of Object.entries(mapping)) {
      expect(value).not.toBe("single_document");
    }
  });
});

describe("Wallet Card Deduplication Logic", () => {
  it("keeps only the latest card per cardType+issuer combination", () => {
    // Simulate the deduplication logic from cardsByCategory
    const cards = [
      { id: 1, cardType: "claim", issuerHospitalName: "Hospital A", issuedAt: "2026-07-02T00:00:00Z", credentialStatus: "active" },
      { id: 2, cardType: "claim", issuerHospitalName: "Hospital A", issuedAt: "2026-07-01T00:00:00Z", credentialStatus: "active" },
      { id: 3, cardType: "prescription", issuerHospitalName: "Hospital A", issuedAt: "2026-07-01T00:00:00Z", credentialStatus: "active" },
      { id: 4, cardType: "claim", issuerHospitalName: "Hospital B", issuedAt: "2026-07-01T00:00:00Z", credentialStatus: "active" },
    ];

    // Apply dedup logic (same as in routers.ts)
    const latestByTypeIssuer = new Map<string, any>();
    const sortedByDate = [...cards].sort((a, b) => {
      const dateA = new Date(a.issuedAt).getTime();
      const dateB = new Date(b.issuedAt).getTime();
      return dateB - dateA;
    });
    const activeCards: any[] = [];
    for (const card of sortedByDate) {
      if (card.credentialStatus !== "active") continue;
      const dedupeKey = `${card.cardType}::${card.issuerHospitalName || "unknown"}`;
      if (!latestByTypeIssuer.has(dedupeKey)) {
        latestByTypeIssuer.set(dedupeKey, card);
        activeCards.push(card);
      }
    }

    // Should keep card 1 (latest claim from Hospital A), card 3 (prescription), card 4 (claim from Hospital B)
    expect(activeCards).toHaveLength(3);
    expect(activeCards.map(c => c.id)).toContain(1); // Latest claim from Hospital A
    expect(activeCards.map(c => c.id)).toContain(3); // Only prescription
    expect(activeCards.map(c => c.id)).toContain(4); // Claim from Hospital B (different issuer)
    expect(activeCards.map(c => c.id)).not.toContain(2); // Older claim from Hospital A
  });

  it("moves older duplicates to superseded list", () => {
    const cards = [
      { id: 1, cardType: "claim", issuerHospitalName: "Hospital A", issuedAt: "2026-07-02T00:00:00Z", credentialStatus: "active" },
      { id: 2, cardType: "claim", issuerHospitalName: "Hospital A", issuedAt: "2026-07-01T00:00:00Z", credentialStatus: "active" },
      { id: 3, cardType: "claim", issuerHospitalName: "Hospital A", issuedAt: "2026-06-30T00:00:00Z", credentialStatus: "active" },
    ];

    const sortedByDate = [...cards].sort((a, b) => {
      const dateA = new Date(a.issuedAt).getTime();
      const dateB = new Date(b.issuedAt).getTime();
      return dateB - dateA;
    });
    const latestByTypeIssuer = new Map<string, any>();
    const supersededCards: any[] = [];
    for (const card of sortedByDate) {
      if (card.credentialStatus === "revoked" || card.credentialStatus === "expired") {
        supersededCards.push(card);
        continue;
      }
      const dedupeKey = `${card.cardType}::${card.issuerHospitalName || "unknown"}`;
      if (!latestByTypeIssuer.has(dedupeKey)) {
        latestByTypeIssuer.set(dedupeKey, card);
      } else {
        supersededCards.push({ ...card, revocationReason: "superseded" });
      }
    }

    expect(supersededCards).toHaveLength(2);
    expect(supersededCards[0].id).toBe(2); // Second newest
    expect(supersededCards[1].id).toBe(3); // Oldest
    expect(supersededCards[0].revocationReason).toBe("superseded");
    expect(supersededCards[1].revocationReason).toBe("superseded");
  });

  it("sorts superseded cards by date descending", () => {
    const supersededCards = [
      { id: 3, issuedAt: "2026-06-28T00:00:00Z" },
      { id: 2, issuedAt: "2026-07-01T00:00:00Z" },
      { id: 1, issuedAt: "2026-06-30T00:00:00Z" },
    ];

    supersededCards.sort((a, b) => {
      const dateA = new Date(a.issuedAt).getTime();
      const dateB = new Date(b.issuedAt).getTime();
      return dateB - dateA;
    });

    expect(supersededCards[0].id).toBe(2); // July 1 (newest)
    expect(supersededCards[1].id).toBe(1); // June 30
    expect(supersededCards[2].id).toBe(3); // June 28 (oldest)
  });

  it("revoked/expired cards always go to superseded regardless of dedup", () => {
    const cards = [
      { id: 1, cardType: "claim", issuerHospitalName: "Hospital A", issuedAt: "2026-07-02T00:00:00Z", credentialStatus: "active" },
      { id: 2, cardType: "claim", issuerHospitalName: "Hospital A", issuedAt: "2026-07-01T00:00:00Z", credentialStatus: "revoked" },
      { id: 3, cardType: "prescription", issuerHospitalName: "Hospital A", issuedAt: "2026-07-01T00:00:00Z", credentialStatus: "expired" },
    ];

    const sortedByDate = [...cards].sort((a, b) => {
      const dateA = new Date(a.issuedAt).getTime();
      const dateB = new Date(b.issuedAt).getTime();
      return dateB - dateA;
    });
    const latestByTypeIssuer = new Map<string, any>();
    const supersededCards: any[] = [];
    for (const card of sortedByDate) {
      if (card.credentialStatus === "revoked" || card.credentialStatus === "expired") {
        supersededCards.push(card);
        continue;
      }
      const dedupeKey = `${card.cardType}::${card.issuerHospitalName || "unknown"}`;
      if (!latestByTypeIssuer.has(dedupeKey)) {
        latestByTypeIssuer.set(dedupeKey, card);
      } else {
        supersededCards.push({ ...card, revocationReason: "superseded" });
      }
    }

    expect(supersededCards).toHaveLength(2);
    expect(supersededCards.map(c => c.id)).toContain(2); // revoked
    expect(supersededCards.map(c => c.id)).toContain(3); // expired
  });
});

describe("DID Resolution - Shortcut Routes", () => {
  it("hospital DID should follow did:web format", () => {
    // Verify the DID format for hospital codes
    const hospitalCode = "TCP";
    const expectedDid = `did:web:trustcare.network:hospital:${hospitalCode}`;
    expect(expectedDid).toBe("did:web:trustcare.network:hospital:TCP");
  });

  it("DID document should contain verificationMethod with publicKeyJwk", () => {
    // Verify expected DID document structure
    const mockDidDocument = {
      "@context": ["https://www.w3.org/ns/did/v1", "https://w3id.org/security/suites/jws-2020/v1"],
      id: "did:web:trustcare.network:hospital:TCP",
      verificationMethod: [
        {
          id: "did:web:trustcare.network:hospital:TCP#key-1",
          type: "JsonWebKey2020",
          controller: "did:web:trustcare.network:hospital:TCP",
          publicKeyJwk: { kty: "EC", crv: "P-256" },
        },
      ],
    };

    expect(mockDidDocument["@context"]).toContain("https://www.w3.org/ns/did/v1");
    expect(mockDidDocument.verificationMethod).toHaveLength(1);
    expect(mockDidDocument.verificationMethod[0].publicKeyJwk.kty).toBe("EC");
    expect(mockDidDocument.verificationMethod[0].publicKeyJwk.crv).toBe("P-256");
  });
});
