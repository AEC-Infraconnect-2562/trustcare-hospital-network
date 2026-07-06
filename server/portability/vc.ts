import { decodeJwt, decodeProtectedHeader, importJWK, jwtVerify, SignJWT } from "jose";
import type {
  CanonicalFhirResult,
  ConsentGrant,
  ConsentPurpose,
  IssuedVc,
  IssuerProfile,
  JsonRecord,
  PresentationPackage,
  TrustRegistryVerificationPolicy,
  TrustcareCredentialType,
} from "./types";
import { addDays, isoNow, sha256, stableStringify, stripUndefined, urnUuid } from "./utils";

const DEFAULT_AUDIENCE = "https://trustcare.network/verifier";
const DEFAULT_STATUS_LIST = "https://trustcare.network/status/revocation-list";

interface VerificationOptions {
  trustedIssuers?: string[];
  trustedIssuerJwks?: Record<string, JsonRecord[]>;
  trustedKidJwks?: Record<string, JsonRecord>;
  requireTrustedIssuer?: boolean;
  audience?: string;
  revokedCredentialIds?: string[];
  revokedStatusIndexes?: string[];
  allowedCredentialTypes?: TrustcareCredentialType[];
  trustPolicy?: TrustRegistryVerificationPolicy;
}

function signingSecret(): Uint8Array {
  const secret = process.env.TRUSTCARE_VC_SIGNING_SECRET ?? process.env.JWT_SECRET ?? "trustcare-dev-vc-secret-change-me";
  return new TextEncoder().encode(secret);
}

async function resolveSigningMaterial(issuerDid: string, purpose: "vc" | "vp"): Promise<{
  alg: string;
  kid: string;
  key: unknown;
  keyMode: IssuedVc["keyMode"];
  publicJwk?: JsonRecord;
}> {
  const privateJwk = parseJwk(process.env.TRUSTCARE_VC_SIGNING_PRIVATE_JWK);
  if (privateJwk) {
    const alg = process.env.TRUSTCARE_VC_SIGNING_ALG ?? String(privateJwk.alg ?? "ES256");
    const kid = process.env.TRUSTCARE_VC_KEY_ID ?? String(privateJwk.kid ?? `${issuerDid}#${purpose}-signing-key`);
    const normalized = { ...privateJwk, alg, kid };
    return {
      alg,
      kid,
      key: await importJWK(normalized, alg),
      keyMode: "asymmetric",
      publicJwk: toPublicJwk(normalized),
    };
  }

  return {
    alg: "HS256",
    kid: `${issuerDid}#dev-${purpose}-signing-key`,
    key: signingSecret(),
    keyMode: "dev-hmac",
  };
}

export async function localIssuerJwks(issuerDid = "did:web:trustcare.network"): Promise<JsonRecord> {
  const privateJwk = parseJwk(process.env.TRUSTCARE_VC_SIGNING_PRIVATE_JWK);
  const publicJwk = parseJwk(process.env.TRUSTCARE_VC_SIGNING_PUBLIC_JWK) ?? (privateJwk ? toPublicJwk(privateJwk) : undefined);
  if (!publicJwk) {
    return {
      keys: [],
      issuer: issuerDid,
      warning: "No asymmetric public JWK configured. Set TRUSTCARE_VC_SIGNING_PRIVATE_JWK and TRUSTCARE_VC_SIGNING_PUBLIC_JWK before production.",
    };
  }
  const alg = process.env.TRUSTCARE_VC_SIGNING_ALG ?? String(publicJwk.alg ?? "ES256");
  const kid = process.env.TRUSTCARE_VC_KEY_ID ?? String(publicJwk.kid ?? `${issuerDid}#vc-signing-key`);
  return {
    keys: [{ ...publicJwk, alg, kid, use: publicJwk.use ?? "sig" }],
    issuer: issuerDid,
  };
}

export async function issueCredential(input: {
  type: TrustcareCredentialType;
  issuer: IssuerProfile;
  subjectId: string;
  subjectDid?: string;
  claims: JsonRecord;
  evidence?: JsonRecord[];
  validDays?: number;
  audience?: string;
  now?: Date;
  credentialId?: string;
}): Promise<IssuedVc> {
  const now = input.now ?? new Date();
  const expiresAt = addDays(now, input.validDays ?? 365);
  const id = input.credentialId ?? urnUuid();
  const signingMaterial = await resolveSigningMaterial(input.issuer.did, "vc");
  const credential = stripUndefined(buildCredentialEnvelope({
    id,
    type: input.type,
    issuer: input.issuer,
    subjectId: input.subjectId,
    subjectDid: input.subjectDid,
    claims: input.claims,
    evidence: input.evidence,
    issuedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  }));
  const disclosureDigests = buildDisclosureDigests(stripUndefined(input.claims));
  const digest = sha256(credential);
  const jwt = await new SignJWT({
    vc: credential,
    vct: input.type,
    trustcare_claim_digest: digest,
    trustcare_disclosure_digests: disclosureDigests,
  })
    .setProtectedHeader({ alg: signingMaterial.alg, typ: "vc+JWT", kid: signingMaterial.kid })
    .setIssuer(input.issuer.did)
    .setSubject(input.subjectDid ?? input.subjectId)
    .setAudience(input.audience ?? DEFAULT_AUDIENCE)
    .setJti(id)
    .setIssuedAt(Math.floor(now.getTime() / 1000))
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(signingMaterial.key as any);

  return {
    id,
    type: input.type,
    format: "jwt-vc",
    jwt,
    credential,
    digest,
    expiresAt: expiresAt.toISOString(),
    disclosureDigests,
    alg: signingMaterial.alg,
    kid: signingMaterial.kid,
    keyMode: signingMaterial.keyMode,
    statusListIndex: credential.credentialStatus?.statusListIndex,
  };
}

export async function verifyCredential(input: VerificationOptions & { jwt: string }): Promise<{
  verified: boolean;
  trustLevel: "green" | "yellow" | "red";
  credential?: JsonRecord;
  issuer?: string;
  credentialId?: string;
  credentialType?: string;
  kid?: string;
  alg?: string;
  warnings: string[];
  errors: string[];
}> {
  const warnings: string[] = [];
  const errors: string[] = [];
  try {
    const protectedHeader = decodeProtectedHeader(input.jwt);
    const unverifiedPayload = decodeJwt(input.jwt) as JsonRecord;
    const effectivePolicy = mergeVerificationPolicy(input);
    const result = await jwtVerify(input.jwt, async () => resolveVerificationKey({
      jwt: input.jwt,
      issuer: String(unverifiedPayload.iss ?? ""),
      kid: typeof protectedHeader.kid === "string" ? protectedHeader.kid : undefined,
      alg: String(protectedHeader.alg ?? ""),
      policy: effectivePolicy,
    }), input.audience ? { audience: input.audience } : {});
    const payload = result.payload as JsonRecord;
    const credential = payload.vc as JsonRecord | undefined;
    const issuer = String(payload.iss ?? "");
    const credentialId = String(payload.jti ?? credential?.id ?? "");
    const credentialType = String(payload.vct ?? (Array.isArray(credential?.type) ? credential.type[credential.type.length - 1] : credential?.type ?? ""));
    const expectedDigest = String(payload.trustcare_claim_digest ?? "");
    if (!credential) errors.push("Missing VC payload.");
    if (credential && expectedDigest && sha256(credential) !== expectedDigest) errors.push("Credential digest mismatch.");
    if (effectivePolicy.trustedIssuers.length && !effectivePolicy.trustedIssuers.includes(issuer)) errors.push("Issuer is not in the trust registry.");
    if (effectivePolicy.requireTrustedIssuer && !effectivePolicy.trustedIssuers.includes(issuer)) errors.push("Production verification requires a verified trust registry issuer.");
    if (effectivePolicy.revokedCredentialIds.includes(credentialId)) errors.push("Credential has been revoked.");
    const statusIndex = String(credential?.credentialStatus?.statusListIndex ?? "");
    if (statusIndex && effectivePolicy.revokedStatusIndexes.includes(statusIndex)) errors.push("Credential status list index is revoked.");
    if (effectivePolicy.allowedCredentialTypes?.length && !effectivePolicy.allowedCredentialTypes.includes(credentialType as TrustcareCredentialType)) {
      errors.push("Credential type is not allowed by verifier policy.");
    }

    const exp = typeof payload.exp === "number" ? payload.exp * 1000 : undefined;
    if (exp) {
      const days = (exp - Date.now()) / 86400000;
      if (days < 0) errors.push("Credential is expired.");
      else if (days <= 30) warnings.push("Credential expires within 30 days.");
    }
    if (protectedHeader.alg === "HS256") warnings.push("Credential uses development HMAC signing; configure asymmetric JWKs before production.");
    if (!credential?.credentialStatus) warnings.push("Credential has no status entry for revocation checks.");

    const verified = errors.length === 0;
    return {
      verified,
      trustLevel: verified ? (warnings.length ? "yellow" : "green") : "red",
      credential,
      issuer,
      credentialId,
      credentialType,
      kid: typeof protectedHeader.kid === "string" ? protectedHeader.kid : undefined,
      alg: String(protectedHeader.alg ?? ""),
      warnings,
      errors,
    };
  } catch (error) {
    return {
      verified: false,
      trustLevel: "red",
      warnings,
      errors: [error instanceof Error ? error.message : "Credential verification failed."],
    };
  }
}

export async function createPresentation(input: {
  holderDid: string;
  credentials: IssuedVc[];
  purpose: ConsentPurpose;
  audience?: string;
  validMinutes?: number;
  now?: Date;
  presentationId?: string;
}): Promise<PresentationPackage> {
  const now = input.now ?? new Date();
  const expiresAt = new Date(now.getTime() + (input.validMinutes ?? 10) * 60_000);
  const id = input.presentationId ?? urnUuid();
  const credentialIds = input.credentials.map((credential) => credential.id);
  const signingMaterial = await resolveSigningMaterial(input.holderDid, "vp");
  const jwt = await new SignJWT({
    vp: {
      "@context": ["https://www.w3.org/ns/credentials/v2"],
      id,
      type: ["VerifiablePresentation", "TrustcarePatientPresentation"],
      holder: input.holderDid,
      verifiableCredential: input.credentials.map((credential) => credential.jwt),
      purpose: input.purpose,
    },
    trustcare_credential_ids: credentialIds,
  })
    .setProtectedHeader({ alg: signingMaterial.alg, typ: "vp+JWT", kid: signingMaterial.kid })
    .setIssuer(input.holderDid)
    .setAudience(input.audience ?? DEFAULT_AUDIENCE)
    .setJti(id)
    .setIssuedAt(Math.floor(now.getTime() / 1000))
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(signingMaterial.key as any);

  return {
    id,
    format: "jwt-vp",
    jwt,
    holderDid: input.holderDid,
    credentialIds,
    purpose: input.purpose,
    audience: input.audience ?? DEFAULT_AUDIENCE,
    expiresAt: expiresAt.toISOString(),
  };
}

export async function verifyPresentation(input: VerificationOptions & { jwt: string }): Promise<{
  verified: boolean;
  trustLevel: "green" | "yellow" | "red";
  holderDid?: string;
  credentials: JsonRecord[];
  warnings: string[];
  errors: string[];
}> {
  const warnings: string[] = [];
  const errors: string[] = [];
  try {
    const protectedHeader = decodeProtectedHeader(input.jwt);
    const unverifiedPayload = decodeJwt(input.jwt) as JsonRecord;
    const effectivePolicy = mergeVerificationPolicy(input);
    const result = await jwtVerify(input.jwt, async () => resolveVerificationKey({
      jwt: input.jwt,
      issuer: String(unverifiedPayload.iss ?? ""),
      kid: typeof protectedHeader.kid === "string" ? protectedHeader.kid : undefined,
      alg: String(protectedHeader.alg ?? ""),
      policy: { ...effectivePolicy, requireTrustedIssuer: false },
    }), input.audience ? { audience: input.audience } : {});
    const payload = result.payload as JsonRecord;
    const vp = payload.vp as JsonRecord | undefined;
    const vcJwtList = Array.isArray(vp?.verifiableCredential) ? (vp.verifiableCredential as string[]) : [];
    if (!vp || vcJwtList.length === 0) errors.push("Presentation does not contain credentials.");
    if (protectedHeader.alg === "HS256") warnings.push("Presentation uses development HMAC signing; configure holder or server wallet keys before production.");

    const credentials: JsonRecord[] = [];
    for (const jwt of vcJwtList) {
      const verification = await verifyCredential({
        jwt,
        trustedIssuers: effectivePolicy.trustedIssuers,
        trustedIssuerJwks: effectivePolicy.trustedIssuerJwks,
        trustedKidJwks: effectivePolicy.trustedKidJwks,
        requireTrustedIssuer: effectivePolicy.requireTrustedIssuer,
        audience: input.audience,
        revokedCredentialIds: effectivePolicy.revokedCredentialIds,
        revokedStatusIndexes: effectivePolicy.revokedStatusIndexes,
        allowedCredentialTypes: effectivePolicy.allowedCredentialTypes,
      });
      warnings.push(...verification.warnings);
      errors.push(...verification.errors);
      if (verification.credential) credentials.push(verification.credential);
    }

    const verified = errors.length === 0;
    return {
      verified,
      trustLevel: verified ? (warnings.length ? "yellow" : "green") : "red",
      holderDid: String(vp?.holder ?? payload.iss ?? ""),
      credentials,
      warnings,
      errors,
    };
  } catch (error) {
    return {
      verified: false,
      trustLevel: "red",
      credentials: [],
      warnings,
      errors: [error instanceof Error ? error.message : "Presentation verification failed."],
    };
  }
}

export function patientSummaryClaims(canonical: CanonicalFhirResult): JsonRecord {
  return {
    patient: {
      id: canonical.summary.patientId,
      name: canonical.summary.patientName,
    },
    fhirVersion: "4.0.1",
    ipsBundleHash: canonical.summary.bundleHash,
    generatedAt: canonical.summary.generatedAt,
    resourceCounts: canonical.summary.resourceCounts,
    critical: extractCriticalClinicalFacts(canonical),
    bundle: canonical.bundle,
  };
}

export function consentReceiptClaims(consent: ConsentGrant): JsonRecord {
  return {
    consentId: consent.id,
    patientId: consent.patientId,
    purpose: consent.purpose,
    requesterId: consent.requesterId,
    requesterRole: consent.requesterRole,
    grantedToOrganizationId: consent.grantedToOrganizationId,
    scopes: consent.scopes,
    status: consent.status,
    grantedAt: consent.grantedAt,
    expiresAt: consent.expiresAt,
  };
}

export function medicalCertificateClaims(input: {
  patientId: string;
  patientName: string;
  practitioner: JsonRecord;
  organization: JsonRecord;
  issuedAt?: string;
  validFrom?: string;
  validUntil?: string;
  diagnosisText?: string;
  fitnessForWork?: "fit" | "unfit" | "restricted";
  recommendations?: string[];
  fhirComposition: JsonRecord;
  documentHash: string;
}): JsonRecord {
  return {
    certificateType: "medical_certificate",
    patient: { id: input.patientId, name: input.patientName },
    practitioner: input.practitioner,
    organization: input.organization,
    issuedAt: input.issuedAt ?? isoNow(),
    validFrom: input.validFrom,
    validUntil: input.validUntil,
    diagnosisText: input.diagnosisText,
    fitnessForWork: input.fitnessForWork,
    recommendations: input.recommendations ?? [],
    fhir: {
      resourceType: "Composition",
      profile: "TrustcareMedicalCertificateComposition",
      composition: input.fhirComposition,
      documentHash: input.documentHash,
    },
  };
}

export function prescriptionClaims(input: {
  patientId: string;
  patientName: string;
  prescriber: JsonRecord;
  organization: JsonRecord;
  authoredOn?: string;
  medicationRequests: JsonRecord[];
  substitutionAllowed?: boolean;
  repeatsAllowed?: number;
  dispenseWindowDays?: number;
}): JsonRecord {
  return {
    prescriptionType: "electronic_prescription",
    patient: { id: input.patientId, name: input.patientName },
    prescriber: input.prescriber,
    organization: input.organization,
    authoredOn: input.authoredOn ?? isoNow(),
    substitutionAllowed: input.substitutionAllowed ?? false,
    repeatsAllowed: input.repeatsAllowed ?? 0,
    dispenseWindowDays: input.dispenseWindowDays ?? 30,
    fhir: {
      resourceType: "Bundle",
      profile: "TrustcarePrescriptionBundle",
      medicationRequests: input.medicationRequests,
      bundleHash: sha256(input.medicationRequests),
    },
  };
}

function buildCredentialEnvelope(input: {
  id: string;
  type: TrustcareCredentialType;
  issuer: IssuerProfile;
  subjectId: string;
  subjectDid?: string;
  claims: JsonRecord;
  evidence?: JsonRecord[];
  issuedAt: string;
  expiresAt: string;
}): JsonRecord {
  return {
    "@context": ["https://www.w3.org/ns/credentials/v2", "https://trustcare.network/contexts/health/v1"],
    id: input.id,
    type: ["VerifiableCredential", input.type],
    issuer: {
      id: input.issuer.did,
      name: input.issuer.name,
      trustDomain: input.issuer.trustDomain ?? "trustcare-network",
      country: input.issuer.country ?? "TH",
    },
    validFrom: input.issuedAt,
    validUntil: input.expiresAt,
    credentialSubject: {
      id: input.subjectDid ?? input.subjectId,
      trustcareSubjectId: input.subjectId,
      ...input.claims,
    },
    evidence: input.evidence ?? [],
    credentialStatus: {
      id: `${statusListCredential()}/${statusListIndex(input.id)}`,
      type: "BitstringStatusListEntry",
      statusPurpose: "revocation",
      statusListIndex: statusListIndex(input.id),
      statusListCredential: statusListCredential(),
    },
  };
}

async function resolveVerificationKey(input: {
  jwt: string;
  issuer: string;
  kid?: string;
  alg: string;
  policy: ReturnType<typeof mergeVerificationPolicy>;
}): Promise<any> {
  if (input.alg.startsWith("HS")) return signingSecret();

  const candidates = [
    input.kid ? input.policy.trustedKidJwks[input.kid] : undefined,
    ...(input.policy.trustedIssuerJwks[input.issuer] ?? []),
    ...(((await localIssuerJwks(input.issuer)).keys as JsonRecord[] | undefined) ?? []),
  ].filter(Boolean) as JsonRecord[];

  const jwk = candidates.find((item) => !input.kid || item.kid === input.kid) ?? candidates[0];
  if (!jwk) throw new Error(`No public JWK available for issuer ${input.issuer || "unknown"} and kid ${input.kid ?? "unknown"}.`);
  return importJWK(jwk, input.alg);
}

function mergeVerificationPolicy(input: VerificationOptions) {
  const trustedIssuers = Array.from(new Set([...(input.trustPolicy?.trustedIssuers ?? []), ...(input.trustedIssuers ?? [])]));
  const revokedCredentialIds = Array.from(new Set([...(input.trustPolicy?.revokedCredentialIds ?? []), ...(input.revokedCredentialIds ?? [])]));
  const revokedStatusIndexes = Array.from(new Set([...(input.trustPolicy?.revokedStatusIndexes ?? []), ...(input.revokedStatusIndexes ?? [])]));
  return {
    trustedIssuers,
    trustedIssuerJwks: input.trustPolicy?.issuerJwks ?? input.trustedIssuerJwks ?? {},
    trustedKidJwks: input.trustPolicy?.kidJwks ?? input.trustedKidJwks ?? {},
    requireTrustedIssuer: input.requireTrustedIssuer ?? (input.trustPolicy?.mode === "required"),
    revokedCredentialIds,
    revokedStatusIndexes,
    allowedCredentialTypes: input.trustPolicy?.allowedCredentialTypes ?? input.allowedCredentialTypes,
  };
}

function parseJwk(value: string | undefined): JsonRecord | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function toPublicJwk(jwk: JsonRecord): JsonRecord {
  const publicJwk = { ...jwk };
  for (const privateField of ["d", "p", "q", "dp", "dq", "qi", "oth", "k"]) delete publicJwk[privateField];
  return publicJwk;
}

function statusListCredential(): string {
  return process.env.TRUSTCARE_STATUS_LIST_URL ?? DEFAULT_STATUS_LIST;
}

function statusListIndex(id: string): string {
  return String(parseInt(sha256(id).slice(0, 10), 16) % 131_072);
}

function buildDisclosureDigests(claims: JsonRecord): Record<string, string> {
  const digests: Record<string, string> = {};
  for (const [key, value] of Object.entries(claims)) {
    digests[key] = sha256(stableStringify(value));
  }
  return digests;
}

function extractCriticalClinicalFacts(canonical: CanonicalFhirResult): JsonRecord {
  const allergies = canonical.clinicalResources
    .filter((resource) => resource.resourceType === "AllergyIntolerance")
    .map((resource) => ({
      substance: resource.code?.text,
      criticality: resource.criticality,
    }));
  const medications = canonical.clinicalResources
    .filter((resource) => resource.resourceType === "MedicationStatement")
    .map((resource) => ({
      name: resource.medicationCodeableConcept?.text,
      status: resource.status,
    }));
  const conditions = canonical.clinicalResources
    .filter((resource) => resource.resourceType === "Condition")
    .map((resource) => ({
      name: resource.code?.text,
      code: resource.code?.coding?.[0]?.code,
    }));
  return { allergies, medications, conditions };
}
