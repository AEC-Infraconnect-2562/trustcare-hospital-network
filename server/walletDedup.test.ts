import { describe, it, expect } from "vitest";

/**
 * Wallet Deduplication Logic Tests
 *
 * These tests verify the dedup algorithm used in:
 * - wallet.cardsByCategory (active cards: only latest per cardType+issuer)
 * - wallet.superseded (older duplicates + revoked/expired/suspended)
 *
 * The dedup logic:
 * 1. Sort all cards by issuedAt descending (newest first)
 * 2. For active cards: keep only the first occurrence per dedupeKey (cardType::issuerHospitalName)
 * 3. Revoked/expired/suspended cards always go to superseded
 * 4. Older active duplicates of same type+issuer go to superseded with reason "superseded"
 */

// Replicate the dedup logic from routers.ts for testing
function deduplicateActiveCards(cards: any[]): { activeCards: any[]; supersededCards: any[] } {
  const sortedByDate = [...cards].sort((a, b) => {
    const dateA = new Date(a.issuedAt || a.createdAt).getTime();
    const dateB = new Date(b.issuedAt || b.createdAt).getTime();
    return dateB - dateA; // newest first
  });

  const latestByTypeIssuer = new Map<string, any>();
  const activeCards: any[] = [];

  for (const card of sortedByDate) {
    // Only deduplicate active credentials; revoked/expired already go to superseded
    if (card.credentialStatus !== "active") continue;
    const dedupeKey = `${card.cardType}::${card.issuerHospitalName || "unknown"}`;
    if (!latestByTypeIssuer.has(dedupeKey)) {
      latestByTypeIssuer.set(dedupeKey, card);
      activeCards.push(card);
    }
    // older duplicates are excluded — they'll appear in superseded tab
  }

  return { activeCards, supersededCards: [] };
}

function buildSupersededList(cards: any[]): any[] {
  const sortedByDate = [...cards].sort((a, b) => {
    const dateA = new Date(a.issuedAt || a.createdAt).getTime();
    const dateB = new Date(b.issuedAt || b.createdAt).getTime();
    return dateB - dateA;
  });

  const latestByTypeIssuer = new Map<string, any>();
  const supersededCards: any[] = [];

  for (const card of sortedByDate) {
    if (card.credentialStatus === "revoked" || card.credentialStatus === "expired" || card.credentialStatus === "suspended") {
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

  // Sort superseded by date descending
  supersededCards.sort((a, b) => {
    const dateA = new Date(a.issuedAt || a.createdAt).getTime();
    const dateB = new Date(b.issuedAt || b.createdAt).getTime();
    return dateB - dateA;
  });

  return supersededCards;
}

describe("Wallet Deduplication — Active Cards (cardsByCategory)", () => {
  it("keeps only the latest card per cardType+issuer", () => {
    const cards = [
      { id: 1, cardType: "prescription", issuerHospitalName: "Hospital A", issuedAt: "2026-07-03T00:00:00Z", credentialStatus: "active" },
      { id: 2, cardType: "prescription", issuerHospitalName: "Hospital A", issuedAt: "2026-07-01T00:00:00Z", credentialStatus: "active" },
      { id: 3, cardType: "prescription", issuerHospitalName: "Hospital A", issuedAt: "2026-06-28T00:00:00Z", credentialStatus: "active" },
    ];

    const { activeCards } = deduplicateActiveCards(cards);
    expect(activeCards).toHaveLength(1);
    expect(activeCards[0].id).toBe(1); // Only the newest
  });

  it("keeps one card per issuer even if same cardType", () => {
    const cards = [
      { id: 1, cardType: "prescription", issuerHospitalName: "Hospital A", issuedAt: "2026-07-03T00:00:00Z", credentialStatus: "active" },
      { id: 2, cardType: "prescription", issuerHospitalName: "Hospital B", issuedAt: "2026-07-01T00:00:00Z", credentialStatus: "active" },
      { id: 3, cardType: "prescription", issuerHospitalName: "Hospital C", issuedAt: "2026-06-28T00:00:00Z", credentialStatus: "active" },
    ];

    const { activeCards } = deduplicateActiveCards(cards);
    expect(activeCards).toHaveLength(3); // Different issuers = different dedup keys
    expect(activeCards.map(c => c.id)).toEqual([1, 2, 3]);
  });

  it("keeps different card types from the same issuer", () => {
    const cards = [
      { id: 1, cardType: "prescription", issuerHospitalName: "Hospital A", issuedAt: "2026-07-03T00:00:00Z", credentialStatus: "active" },
      { id: 2, cardType: "lab_result", issuerHospitalName: "Hospital A", issuedAt: "2026-07-02T00:00:00Z", credentialStatus: "active" },
      { id: 3, cardType: "appointment", issuerHospitalName: "Hospital A", issuedAt: "2026-07-01T00:00:00Z", credentialStatus: "active" },
    ];

    const { activeCards } = deduplicateActiveCards(cards);
    expect(activeCards).toHaveLength(3); // Different types = different dedup keys
  });

  it("excludes non-active cards from active list", () => {
    const cards = [
      { id: 1, cardType: "prescription", issuerHospitalName: "Hospital A", issuedAt: "2026-07-03T00:00:00Z", credentialStatus: "active" },
      { id: 2, cardType: "lab_result", issuerHospitalName: "Hospital A", issuedAt: "2026-07-02T00:00:00Z", credentialStatus: "revoked" },
      { id: 3, cardType: "appointment", issuerHospitalName: "Hospital A", issuedAt: "2026-07-01T00:00:00Z", credentialStatus: "expired" },
      { id: 4, cardType: "referral", issuerHospitalName: "Hospital A", issuedAt: "2026-07-01T00:00:00Z", credentialStatus: "suspended" },
    ];

    const { activeCards } = deduplicateActiveCards(cards);
    expect(activeCards).toHaveLength(1);
    expect(activeCards[0].id).toBe(1);
  });

  it("uses 'unknown' as issuer when issuerHospitalName is null", () => {
    const cards = [
      { id: 1, cardType: "prescription", issuerHospitalName: null, issuedAt: "2026-07-03T00:00:00Z", credentialStatus: "active" },
      { id: 2, cardType: "prescription", issuerHospitalName: null, issuedAt: "2026-07-01T00:00:00Z", credentialStatus: "active" },
    ];

    const { activeCards } = deduplicateActiveCards(cards);
    expect(activeCards).toHaveLength(1);
    expect(activeCards[0].id).toBe(1); // Dedup key: "prescription::unknown"
  });

  it("handles empty card list gracefully", () => {
    const { activeCards } = deduplicateActiveCards([]);
    expect(activeCards).toHaveLength(0);
  });

  it("handles cards with createdAt fallback when issuedAt is null", () => {
    const cards = [
      { id: 1, cardType: "prescription", issuerHospitalName: "Hospital A", issuedAt: null, createdAt: "2026-07-03T00:00:00Z", credentialStatus: "active" },
      { id: 2, cardType: "prescription", issuerHospitalName: "Hospital A", issuedAt: null, createdAt: "2026-07-01T00:00:00Z", credentialStatus: "active" },
    ];

    const { activeCards } = deduplicateActiveCards(cards);
    expect(activeCards).toHaveLength(1);
    expect(activeCards[0].id).toBe(1); // Newest by createdAt
  });

  it("complex scenario: multiple types, multiple issuers, mixed statuses", () => {
    const cards = [
      { id: 1, cardType: "prescription", issuerHospitalName: "Hospital A", issuedAt: "2026-07-05T00:00:00Z", credentialStatus: "active" },
      { id: 2, cardType: "prescription", issuerHospitalName: "Hospital A", issuedAt: "2026-07-01T00:00:00Z", credentialStatus: "active" },
      { id: 3, cardType: "prescription", issuerHospitalName: "Hospital B", issuedAt: "2026-07-04T00:00:00Z", credentialStatus: "active" },
      { id: 4, cardType: "lab_result", issuerHospitalName: "Hospital A", issuedAt: "2026-07-03T00:00:00Z", credentialStatus: "active" },
      { id: 5, cardType: "lab_result", issuerHospitalName: "Hospital A", issuedAt: "2026-07-02T00:00:00Z", credentialStatus: "revoked" },
      { id: 6, cardType: "appointment", issuerHospitalName: "Hospital A", issuedAt: "2026-07-01T00:00:00Z", credentialStatus: "active" },
    ];

    const { activeCards } = deduplicateActiveCards(cards);
    // Expected active: id=1 (prescription::Hospital A), id=3 (prescription::Hospital B), id=4 (lab_result::Hospital A), id=6 (appointment::Hospital A)
    expect(activeCards).toHaveLength(4);
    expect(activeCards.map(c => c.id).sort()).toEqual([1, 3, 4, 6]);
  });
});

describe("Wallet Deduplication — Superseded Cards", () => {
  it("includes revoked cards in superseded", () => {
    const cards = [
      { id: 1, cardType: "prescription", issuerHospitalName: "Hospital A", issuedAt: "2026-07-03T00:00:00Z", credentialStatus: "active" },
      { id: 2, cardType: "prescription", issuerHospitalName: "Hospital A", issuedAt: "2026-07-01T00:00:00Z", credentialStatus: "revoked" },
    ];

    const superseded = buildSupersededList(cards);
    expect(superseded).toHaveLength(1);
    expect(superseded[0].id).toBe(2);
  });

  it("includes expired cards in superseded", () => {
    const cards = [
      { id: 1, cardType: "prescription", issuerHospitalName: "Hospital A", issuedAt: "2026-07-03T00:00:00Z", credentialStatus: "active" },
      { id: 2, cardType: "lab_result", issuerHospitalName: "Hospital A", issuedAt: "2026-07-01T00:00:00Z", credentialStatus: "expired" },
    ];

    const superseded = buildSupersededList(cards);
    expect(superseded).toHaveLength(1);
    expect(superseded[0].id).toBe(2);
  });

  it("includes suspended cards in superseded", () => {
    const cards = [
      { id: 1, cardType: "prescription", issuerHospitalName: "Hospital A", issuedAt: "2026-07-03T00:00:00Z", credentialStatus: "active" },
      { id: 2, cardType: "referral", issuerHospitalName: "Hospital B", issuedAt: "2026-07-02T00:00:00Z", credentialStatus: "suspended" },
    ];

    const superseded = buildSupersededList(cards);
    expect(superseded).toHaveLength(1);
    expect(superseded[0].id).toBe(2);
  });

  it("includes older active duplicates as superseded with reason", () => {
    const cards = [
      { id: 1, cardType: "prescription", issuerHospitalName: "Hospital A", issuedAt: "2026-07-03T00:00:00Z", credentialStatus: "active" },
      { id: 2, cardType: "prescription", issuerHospitalName: "Hospital A", issuedAt: "2026-07-01T00:00:00Z", credentialStatus: "active" },
      { id: 3, cardType: "prescription", issuerHospitalName: "Hospital A", issuedAt: "2026-06-28T00:00:00Z", credentialStatus: "active" },
    ];

    const superseded = buildSupersededList(cards);
    expect(superseded).toHaveLength(2);
    expect(superseded.every(c => c.revocationReason === "superseded")).toBe(true);
    expect(superseded.map(c => c.id)).toEqual([2, 3]); // Sorted by date desc
  });

  it("combines revoked + expired + suspended + older duplicates", () => {
    const cards = [
      { id: 1, cardType: "prescription", issuerHospitalName: "Hospital A", issuedAt: "2026-07-05T00:00:00Z", credentialStatus: "active" },
      { id: 2, cardType: "prescription", issuerHospitalName: "Hospital A", issuedAt: "2026-07-03T00:00:00Z", credentialStatus: "active" }, // older dup
      { id: 3, cardType: "lab_result", issuerHospitalName: "Hospital A", issuedAt: "2026-07-04T00:00:00Z", credentialStatus: "revoked" },
      { id: 4, cardType: "appointment", issuerHospitalName: "Hospital B", issuedAt: "2026-07-02T00:00:00Z", credentialStatus: "expired" },
      { id: 5, cardType: "referral", issuerHospitalName: "Hospital A", issuedAt: "2026-07-01T00:00:00Z", credentialStatus: "suspended" },
    ];

    const superseded = buildSupersededList(cards);
    expect(superseded).toHaveLength(4); // id 2 (dup), 3 (revoked), 4 (expired), 5 (suspended)
    expect(superseded.map(c => c.id)).toEqual([3, 2, 4, 5]); // Sorted by date desc
  });

  it("sorts superseded cards by date descending (newest first)", () => {
    const cards = [
      { id: 1, cardType: "prescription", issuerHospitalName: "Hospital A", issuedAt: "2026-07-10T00:00:00Z", credentialStatus: "active" },
      { id: 2, cardType: "prescription", issuerHospitalName: "Hospital A", issuedAt: "2026-06-15T00:00:00Z", credentialStatus: "active" },
      { id: 3, cardType: "lab_result", issuerHospitalName: "Hospital A", issuedAt: "2026-07-08T00:00:00Z", credentialStatus: "revoked" },
      { id: 4, cardType: "appointment", issuerHospitalName: "Hospital A", issuedAt: "2026-06-01T00:00:00Z", credentialStatus: "expired" },
    ];

    const superseded = buildSupersededList(cards);
    // Expected: id=3 (Jul 8, revoked), id=2 (Jun 15, superseded), id=4 (Jun 1, expired)
    expect(superseded).toHaveLength(3);
    const dates = superseded.map(c => new Date(c.issuedAt).getTime());
    for (let i = 0; i < dates.length - 1; i++) {
      expect(dates[i]).toBeGreaterThanOrEqual(dates[i + 1]);
    }
  });

  it("handles all cards being active with no duplicates (empty superseded)", () => {
    const cards = [
      { id: 1, cardType: "prescription", issuerHospitalName: "Hospital A", issuedAt: "2026-07-03T00:00:00Z", credentialStatus: "active" },
      { id: 2, cardType: "lab_result", issuerHospitalName: "Hospital A", issuedAt: "2026-07-02T00:00:00Z", credentialStatus: "active" },
      { id: 3, cardType: "appointment", issuerHospitalName: "Hospital B", issuedAt: "2026-07-01T00:00:00Z", credentialStatus: "active" },
    ];

    const superseded = buildSupersededList(cards);
    expect(superseded).toHaveLength(0);
  });

  it("handles all cards being non-active (all superseded)", () => {
    const cards = [
      { id: 1, cardType: "prescription", issuerHospitalName: "Hospital A", issuedAt: "2026-07-03T00:00:00Z", credentialStatus: "revoked" },
      { id: 2, cardType: "lab_result", issuerHospitalName: "Hospital A", issuedAt: "2026-07-02T00:00:00Z", credentialStatus: "expired" },
      { id: 3, cardType: "appointment", issuerHospitalName: "Hospital B", issuedAt: "2026-07-01T00:00:00Z", credentialStatus: "suspended" },
    ];

    const superseded = buildSupersededList(cards);
    expect(superseded).toHaveLength(3);
  });

  it("dedup key is case-sensitive for hospital names", () => {
    const cards = [
      { id: 1, cardType: "prescription", issuerHospitalName: "Hospital A", issuedAt: "2026-07-03T00:00:00Z", credentialStatus: "active" },
      { id: 2, cardType: "prescription", issuerHospitalName: "hospital a", issuedAt: "2026-07-01T00:00:00Z", credentialStatus: "active" },
    ];

    const superseded = buildSupersededList(cards);
    // Different case = different dedup key, so no superseded
    expect(superseded).toHaveLength(0);
  });
});
