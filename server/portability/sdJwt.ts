/**
 * SD-JWT Selective Disclosure Module
 * Implements IETF SD-JWT (draft-ietf-oauth-selective-disclosure-jwt) for TrustCare
 *
 * Architecture:
 * - Issuer creates disclosures for each selectively-disclosable claim
 * - Each disclosure is: base64url(JSON([salt, claimName, claimValue]))
 * - The SD-JWT contains _sd array with hashes of each disclosure
 * - Holder presents SD-JWT + only the disclosures they want to reveal
 * - Verifier can verify the SD-JWT signature and check disclosed claims against _sd hashes
 */
import { createHash, randomBytes } from "crypto";
import { decodeJwt, decodeProtectedHeader, importJWK, jwtVerify, SignJWT } from "jose";
import type { JsonRecord } from "./types";
import { sha256, stableStringify } from "./utils";
import { getHospitalKeyPair } from "./did";

// ============================================================
// TYPES
// ============================================================

export interface Disclosure {
  /** Base64url-encoded disclosure: [salt, claimName, claimValue] */
  encoded: string;
  /** SHA-256 hash of the encoded disclosure (goes into _sd array) */
  digest: string;
  /** The claim name this disclosure reveals */
  claimName: string;
  /** The claim value */
  claimValue: unknown;
  /** The random salt used */
  salt: string;
}

export interface SdJwtIssueResult {
  /** The compact SD-JWT (issuer-signed JWT with _sd digests) */
  sdJwt: string;
  /** All disclosures created for this credential */
  disclosures: Disclosure[];
  /** Map of claimName → disclosure.encoded for easy lookup */
  disclosureMap: Record<string, string>;
  /** The full SD-JWT with all disclosures appended (for storage) */
  sdJwtFull: string;
}

export interface SdJwtPresentResult {
  /** The derived SD-JWT with only selected disclosures */
  presentation: string;
  /** Which fields were disclosed */
  disclosedFields: string[];
  /** Which fields were withheld */
  withheldFields: string[];
}

export interface SdJwtVerifyResult {
  /** Whether the SD-JWT signature is valid */
  verified: boolean;
  /** Trust level: green/yellow/red */
  trustLevel: "green" | "yellow" | "red";
  /** Fields that were disclosed and verified */
  disclosedClaims: Record<string, unknown>;
  /** Fields that were NOT disclosed (hidden) */
  withheldFields: string[];
  /** Issuer DID */
  issuer: string | null;
  /** Credential type */
  credentialType: string | null;
  /** Warnings */
  warnings: string[];
  /** Errors */
  errors: string[];
}

export interface SelectiveDisclosurePolicy {
  /** Fields that are ALWAYS disclosed (cannot be hidden) */
  alwaysDisclosed: string[];
  /** Fields that the holder CAN selectively disclose */
  selectableFields: string[];
  /** Fields that are NEVER disclosed (always hidden, e.g., internal IDs) */
  neverDisclosed: string[];
}

// ============================================================
// DISCLOSURE POLICIES PER CREDENTIAL TYPE
// ============================================================

/**
 * Default selective disclosure policies for each credential type.
 * - alwaysDisclosed: Fields that verifiers always see (identity, issuer info)
 * - selectableFields: Fields the holder can choose to reveal
 * - neverDisclosed: Internal fields that are never shared
 */
export const DISCLOSURE_POLICIES: Record<string, SelectiveDisclosurePolicy> = {
  // Patient identity
  patient_identity: {
    alwaysDisclosed: ["documentType", "brand", "label"],
    selectableFields: ["patient", "organization", "humanDocument"],
    neverDisclosed: ["trustcareSubjectId", "fontPolicy", "documentHash"],
  },
  // Staff identity
  staff_identity: {
    alwaysDisclosed: ["documentType", "brand", "label", "hospitalCode", "hospitalName"],
    selectableFields: ["fullNameTh", "fullNameEn", "position", "positionEn", "email", "phone", "staffId", "systemRole"],
    neverDisclosed: ["thaiId", "fontPolicy"],
  },
  // Clinical documents
  appointment: {
    alwaysDisclosed: ["documentType", "brand", "label", "organization"],
    selectableFields: ["patient", "clinical", "humanDocument", "fhir"],
    neverDisclosed: ["trustcareSubjectId", "fontPolicy", "documentHash", "sourceOfTruth"],
  },
  prescription: {
    alwaysDisclosed: ["documentType", "brand", "label", "organization"],
    selectableFields: ["patient", "clinical", "humanDocument", "fhir"],
    neverDisclosed: ["trustcareSubjectId", "fontPolicy", "documentHash", "sourceOfTruth"],
  },
  lab_result: {
    alwaysDisclosed: ["documentType", "brand", "label", "organization"],
    selectableFields: ["patient", "clinical", "humanDocument", "fhir"],
    neverDisclosed: ["trustcareSubjectId", "fontPolicy", "documentHash", "sourceOfTruth"],
  },
  diagnostic_report: {
    alwaysDisclosed: ["documentType", "brand", "label", "organization"],
    selectableFields: ["patient", "clinical", "humanDocument", "fhir"],
    neverDisclosed: ["trustcareSubjectId", "fontPolicy", "documentHash", "sourceOfTruth"],
  },
  discharge_summary: {
    alwaysDisclosed: ["documentType", "brand", "label", "organization"],
    selectableFields: ["patient", "clinical", "humanDocument", "fhir"],
    neverDisclosed: ["trustcareSubjectId", "fontPolicy", "documentHash", "sourceOfTruth"],
  },
  medical_certificate: {
    alwaysDisclosed: ["documentType", "brand", "label", "organization"],
    selectableFields: ["patient", "clinical", "humanDocument"],
    neverDisclosed: ["trustcareSubjectId", "fontPolicy", "documentHash", "sourceOfTruth"],
  },
  patient_summary: {
    alwaysDisclosed: ["documentType", "brand", "label", "organization"],
    selectableFields: ["patient", "clinical", "humanDocument", "fhir"],
    neverDisclosed: ["trustcareSubjectId", "fontPolicy", "documentHash", "sourceOfTruth"],
  },
  // Insurance/financial
  insurance_eligibility: {
    alwaysDisclosed: ["documentType", "brand", "label", "organization"],
    selectableFields: ["patient", "clinical", "humanDocument"],
    neverDisclosed: ["trustcareSubjectId", "fontPolicy", "documentHash", "sourceOfTruth"],
  },
  guarantee_letter: {
    alwaysDisclosed: ["documentType", "brand", "label", "organization"],
    selectableFields: ["patient", "clinical", "humanDocument"],
    neverDisclosed: ["trustcareSubjectId", "fontPolicy", "documentHash", "sourceOfTruth"],
  },
  quotation: {
    alwaysDisclosed: ["documentType", "brand", "label", "organization"],
    selectableFields: ["patient", "clinical", "humanDocument"],
    neverDisclosed: ["trustcareSubjectId", "fontPolicy", "documentHash", "sourceOfTruth"],
  },
  // Travel
  visa_support_letter: {
    alwaysDisclosed: ["documentType", "brand", "label", "organization"],
    selectableFields: ["patient", "clinical", "humanDocument"],
    neverDisclosed: ["trustcareSubjectId", "fontPolicy", "documentHash", "sourceOfTruth"],
  },
  travel_document_verification: {
    alwaysDisclosed: ["documentType", "brand", "label", "organization"],
    selectableFields: ["patient", "clinical", "humanDocument"],
    neverDisclosed: ["trustcareSubjectId", "fontPolicy", "documentHash", "sourceOfTruth"],
  },
  // Identity link
  mpi_link_certificate: {
    alwaysDisclosed: ["documentType", "brand", "label"],
    selectableFields: ["patient", "organization", "humanDocument"],
    neverDisclosed: ["trustcareSubjectId", "fontPolicy", "documentHash", "sourceOfTruth"],
  },
  // SHL
  shl_manifest: {
    alwaysDisclosed: ["documentType", "brand", "label"],
    selectableFields: ["patient", "organization", "clinical"],
    neverDisclosed: ["trustcareSubjectId", "fontPolicy", "documentHash", "sourceOfTruth"],
  },
};

/** Get the disclosure policy for a credential type, with fallback */
export function getDisclosurePolicy(credentialType: string): SelectiveDisclosurePolicy {
  return DISCLOSURE_POLICIES[credentialType] ?? {
    alwaysDisclosed: ["documentType", "brand", "label"],
    selectableFields: ["patient", "organization", "clinical", "humanDocument"],
    neverDisclosed: ["trustcareSubjectId", "fontPolicy", "documentHash"],
  };
}

// ============================================================
// SD-JWT CREATION (ISSUER SIDE)
// ============================================================

/** Generate a random salt for a disclosure */
function generateSalt(): string {
  return randomBytes(16).toString("base64url");
}

/** Create a single disclosure: base64url([salt, claimName, claimValue]) */
function createDisclosure(claimName: string, claimValue: unknown): Disclosure {
  const salt = generateSalt();
  const disclosureArray = [salt, claimName, claimValue];
  const encoded = Buffer.from(JSON.stringify(disclosureArray)).toString("base64url");
  const digest = createHash("sha256").update(encoded).digest("base64url");
  return { encoded, digest, claimName, claimValue, salt };
}

/** Decode a disclosure string back to its components */
export function decodeDisclosure(encoded: string): { salt: string; claimName: string; claimValue: unknown } | null {
  try {
    const json = Buffer.from(encoded, "base64url").toString("utf-8");
    const arr = JSON.parse(json);
    if (!Array.isArray(arr) || arr.length !== 3) return null;
    return { salt: arr[0], claimName: arr[1], claimValue: arr[2] };
  } catch {
    return null;
  }
}

/** Verify a disclosure matches its expected digest */
export function verifyDisclosureDigest(encoded: string, expectedDigest: string): boolean {
  const actualDigest = createHash("sha256").update(encoded).digest("base64url");
  return actualDigest === expectedDigest;
}

/**
 * Create SD-JWT disclosures for a credential's claims.
 * Claims in `selectableFields` become individual disclosures.
 * Claims in `alwaysDisclosed` stay in the JWT payload directly.
 * Claims in `neverDisclosed` are excluded entirely.
 */
export function createDisclosures(
  claims: Record<string, unknown>,
  policy: SelectiveDisclosurePolicy
): { disclosures: Disclosure[]; sdDigests: string[]; visibleClaims: Record<string, unknown> } {
  const disclosures: Disclosure[] = [];
  const sdDigests: string[] = [];
  const visibleClaims: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(claims)) {
    if (policy.neverDisclosed.includes(key)) {
      // Skip entirely — not included in JWT or disclosures
      continue;
    }
    if (policy.alwaysDisclosed.includes(key)) {
      // Always visible in the JWT payload
      visibleClaims[key] = value;
    } else if (policy.selectableFields.includes(key)) {
      // Create a disclosure for this field
      const disclosure = createDisclosure(key, value);
      disclosures.push(disclosure);
      sdDigests.push(disclosure.digest);
    } else {
      // Unknown fields default to selectable
      const disclosure = createDisclosure(key, value);
      disclosures.push(disclosure);
      sdDigests.push(disclosure.digest);
    }
  }

  return { disclosures, sdDigests, visibleClaims };
}

/**
 * Issue an SD-JWT for a credential.
 * The JWT payload contains:
 * - Always-disclosed claims directly
 * - _sd array with digests of selectable claims
 * - Standard VC envelope fields
 */
export async function issueSdJwt(input: {
  credentialId: string;
  credentialType: string;
  issuerDid: string;
  subjectDid: string;
  claims: Record<string, unknown>;
  vcEnvelope: JsonRecord;
  hospitalCode?: string;
  validDays?: number;
  now?: Date;
}): Promise<SdJwtIssueResult> {
  const now = input.now ?? new Date();
  const expiresAt = new Date(now.getTime() + (input.validDays ?? 365) * 86400000);
  const policy = getDisclosurePolicy(input.credentialType);

  // Create disclosures for selectable fields
  const { disclosures, sdDigests, visibleClaims } = createDisclosures(input.claims, policy);

  // Build the SD-JWT payload
  const sdPayload: JsonRecord = {
    vc: input.vcEnvelope,
    vct: `${input.credentialType}+sd-jwt`,
    _sd: sdDigests,
    _sd_alg: "sha-256",
    // Include always-disclosed claims at top level for easy access
    trustcare_visible_claims: visibleClaims,
    trustcare_sd_policy: {
      alwaysDisclosed: policy.alwaysDisclosed,
      selectableFields: policy.selectableFields,
    },
  };

  // Resolve signing key
  const hospitalKey = input.hospitalCode ? getHospitalKeyPair(input.hospitalCode) : null;
  let signingKey: any;
  let alg = "ES256";
  let kid: string;

  if (hospitalKey) {
    signingKey = await importJWK(hospitalKey.privateJwk as any, alg);
    kid = hospitalKey.kid;
  } else {
    const privateJwk = parseJwk(process.env.TRUSTCARE_VC_SIGNING_PRIVATE_JWK);
    if (privateJwk) {
      alg = process.env.TRUSTCARE_VC_SIGNING_ALG ?? String(privateJwk.alg ?? "ES256");
      kid = process.env.TRUSTCARE_VC_KEY_ID ?? `${input.issuerDid}#vc-signing-key-1`;
      signingKey = await importJWK({ ...privateJwk, alg, kid }, alg);
    } else {
      // Fallback to HMAC for dev
      alg = "HS256";
      kid = `${input.issuerDid}#dev-sd-signing-key`;
      signingKey = new TextEncoder().encode(process.env.JWT_SECRET ?? "trustcare-dev-sd-secret");
    }
  }

  // Sign the SD-JWT
  const sdJwt = await new SignJWT(sdPayload as any)
    .setProtectedHeader({ alg, typ: "vc+sd-jwt", kid })
    .setIssuer(input.issuerDid)
    .setSubject(input.subjectDid)
    .setJti(input.credentialId)
    .setIssuedAt(Math.floor(now.getTime() / 1000))
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(signingKey);

  // Build disclosure map (claimName → encoded disclosure)
  const disclosureMap: Record<string, string> = {};
  for (const d of disclosures) {
    disclosureMap[d.claimName] = d.encoded;
  }

  // Full SD-JWT = JWT~disclosure1~disclosure2~...~
  const sdJwtFull = sdJwt + "~" + disclosures.map(d => d.encoded).join("~") + "~";

  return { sdJwt, disclosures, disclosureMap, sdJwtFull };
}

// ============================================================
// SD-JWT PRESENTATION (HOLDER/WALLET SIDE)
// ============================================================

/**
 * Create a selective presentation from an SD-JWT.
 * The wallet selects which fields to disclose.
 *
 * @param sdJwtFull - The full SD-JWT with all disclosures (from sync)
 * @param selectedFields - Array of claim names to disclose
 * @returns Derived SD-JWT with only selected disclosures
 */
export function createSelectivePresentation(
  sdJwtFull: string,
  selectedFields: string[]
): SdJwtPresentResult {
  // Parse the SD-JWT: JWT~disclosure1~disclosure2~...~
  const parts = sdJwtFull.split("~");
  const jwtPart = parts[0];
  const allDisclosures = parts.slice(1).filter(d => d.length > 0);

  // Decode each disclosure to find which ones match selected fields
  const disclosedFields: string[] = [];
  const withheldFields: string[] = [];
  const selectedDisclosures: string[] = [];

  for (const encoded of allDisclosures) {
    const decoded = decodeDisclosure(encoded);
    if (!decoded) continue;

    if (selectedFields.includes(decoded.claimName)) {
      selectedDisclosures.push(encoded);
      disclosedFields.push(decoded.claimName);
    } else {
      withheldFields.push(decoded.claimName);
    }
  }

  // Build the presentation: JWT~selectedDisclosure1~selectedDisclosure2~
  const presentation = jwtPart + "~" + selectedDisclosures.join("~") + (selectedDisclosures.length > 0 ? "~" : "");

  return { presentation, disclosedFields, withheldFields };
}

// ============================================================
// SD-JWT VERIFICATION (VERIFIER SIDE)
// ============================================================

/**
 * Verify a selective disclosure presentation.
 * Checks:
 * 1. JWT signature is valid
 * 2. Each disclosed claim's digest matches an entry in _sd
 * 3. No disclosure is duplicated or forged
 */
export async function verifySdJwtPresentation(
  presentation: string,
  options?: {
    trustedIssuers?: string[];
    trustedIssuerJwks?: Record<string, JsonRecord[]>;
  }
): Promise<SdJwtVerifyResult> {
  const warnings: string[] = [];
  const errors: string[] = [];

  try {
    // Parse presentation: JWT~disclosure1~disclosure2~...
    const parts = presentation.split("~");
    const jwtPart = parts[0];
    const presentedDisclosures = parts.slice(1).filter(d => d.length > 0);

    // Decode JWT header and payload
    const header = decodeProtectedHeader(jwtPart);
    const unverifiedPayload = decodeJwt(jwtPart) as JsonRecord;

    // Resolve verification key
    const issuer = String(unverifiedPayload.iss ?? "");
    const verificationKey = await resolveVerificationKeyForSdJwt(issuer, header.kid, String(header.alg ?? "ES256"), options);

    if (!verificationKey) {
      return {
        verified: false,
        trustLevel: "red",
        disclosedClaims: {},
        withheldFields: [],
        issuer,
        credentialType: null,
        warnings,
        errors: ["Could not resolve verification key for issuer."],
      };
    }

    // Verify JWT signature
    const result = await jwtVerify(jwtPart, verificationKey);
    const payload = result.payload as JsonRecord;

    // Extract _sd array from payload
    const sdDigests = (payload._sd as string[]) ?? [];
    const sdAlg = String(payload._sd_alg ?? "sha-256");

    if (sdAlg !== "sha-256") {
      errors.push(`Unsupported SD hash algorithm: ${sdAlg}`);
    }

    // Verify each presented disclosure
    const disclosedClaims: Record<string, unknown> = {};
    const verifiedDigests = new Set<string>();

    for (const encoded of presentedDisclosures) {
      const decoded = decodeDisclosure(encoded);
      if (!decoded) {
        errors.push(`Invalid disclosure format: ${encoded.slice(0, 20)}...`);
        continue;
      }

      // Compute digest and check it's in _sd
      const digest = createHash("sha256").update(encoded).digest("base64url");
      if (!sdDigests.includes(digest)) {
        errors.push(`Disclosure digest not found in _sd array for claim: ${decoded.claimName}`);
        continue;
      }

      if (verifiedDigests.has(digest)) {
        errors.push(`Duplicate disclosure for claim: ${decoded.claimName}`);
        continue;
      }

      verifiedDigests.add(digest);
      disclosedClaims[decoded.claimName] = decoded.claimValue;
    }

    // Determine withheld fields (digests in _sd that weren't disclosed)
    const withheldCount = sdDigests.length - verifiedDigests.size;
    const withheldFields: string[] = [];
    // We can't know the names of withheld fields (that's the point of SD-JWT)
    // but we can report how many are hidden
    for (let i = 0; i < withheldCount; i++) {
      withheldFields.push(`[hidden_field_${i + 1}]`);
    }

    // Include always-visible claims from the payload
    const visibleClaims = (payload.trustcare_visible_claims as Record<string, unknown>) ?? {};

    // Check expiry
    const exp = typeof payload.exp === "number" ? payload.exp * 1000 : undefined;
    if (exp && exp < Date.now()) {
      errors.push("SD-JWT has expired.");
    } else if (exp) {
      const days = (exp - Date.now()) / 86400000;
      if (days <= 30) warnings.push("SD-JWT expires within 30 days.");
    }

    // Check trusted issuers
    if (options?.trustedIssuers?.length && !options.trustedIssuers.includes(issuer)) {
      errors.push("Issuer is not in the trust registry.");
    }

    if (header.alg === "HS256") {
      warnings.push("SD-JWT uses development HMAC signing.");
    }

    const verified = errors.length === 0;
    const credentialType = String(payload.vct ?? "").replace("+sd-jwt", "");

    return {
      verified,
      trustLevel: verified ? (warnings.length ? "yellow" : "green") : "red",
      disclosedClaims: { ...visibleClaims, ...disclosedClaims },
      withheldFields,
      issuer,
      credentialType,
      warnings,
      errors,
    };
  } catch (error) {
    return {
      verified: false,
      trustLevel: "red",
      disclosedClaims: {},
      withheldFields: [],
      issuer: null,
      credentialType: null,
      warnings,
      errors: [error instanceof Error ? error.message : "SD-JWT verification failed."],
    };
  }
}

// ============================================================
// HELPERS
// ============================================================

function parseJwk(envValue: string | undefined): JsonRecord | undefined {
  if (!envValue) return undefined;
  try {
    return JSON.parse(envValue);
  } catch {
    return undefined;
  }
}

async function resolveVerificationKeyForSdJwt(
  issuer: string,
  kid: string | undefined,
  alg: string,
  options?: { trustedIssuers?: string[]; trustedIssuerJwks?: Record<string, JsonRecord[]> }
): Promise<any> {
  // Try hospital keys first
  const hospitalMatch = issuer.match(/did:web:trustcare\.network:hospital:(\w+)/);
  if (hospitalMatch) {
    try {
      const hospitalKey = getHospitalKeyPair(hospitalMatch[1]);
      return await importJWK(hospitalKey.publicJwk as any, alg);
    } catch { /* fall through */ }
  }

  // Try network-level key
  if (issuer.startsWith("did:web:trustcare.network")) {
    const publicJwk = parseJwk(process.env.TRUSTCARE_VC_SIGNING_PUBLIC_JWK);
    if (publicJwk) {
      return await importJWK({ ...publicJwk, alg }, alg);
    }
  }

  // Try trusted issuer JWKs
  if (options?.trustedIssuerJwks?.[issuer]) {
    const jwks = options.trustedIssuerJwks[issuer];
    const matchingKey = kid ? jwks.find(k => k.kid === kid) : jwks[0];
    if (matchingKey) {
      return await importJWK(matchingKey as any, alg);
    }
  }

  // Fallback to HMAC for dev
  if (alg === "HS256") {
    return new TextEncoder().encode(process.env.JWT_SECRET ?? "trustcare-dev-sd-secret");
  }

  return null;
}
