import { jwtVerify, SignJWT } from "jose";
import type {
  CanonicalFhirResult,
  ConsentGrant,
  ConsentPurpose,
  IssuedVc,
  IssuerProfile,
  JsonRecord,
  PresentationPackage,
  TrustcareCredentialType,
} from "./types";
import { addDays, isoNow, sha256, stableStringify, stripUndefined, urnUuid } from "./utils";

const DEFAULT_AUDIENCE = "https://trustcare.network/verifier";

function signingSecret(): Uint8Array {
  const secret = process.env.TRUSTCARE_VC_SIGNING_SECRET ?? process.env.JWT_SECRET ?? "trustcare-dev-vc-secret-change-me";
  return new TextEncoder().encode(secret);
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
}): Promise<IssuedVc> {
  const now = input.now ?? new Date();
  const expiresAt = addDays(now, input.validDays ?? 365);
  const id = urnUuid();
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
    .setProtectedHeader({ alg: "HS256", typ: "vc+JWT", kid: `${input.issuer.did}#dev-signing-key` })
    .setIssuer(input.issuer.did)
    .setSubject(input.subjectDid ?? input.subjectId)
    .setAudience(input.audience ?? DEFAULT_AUDIENCE)
    .setJti(id)
    .setIssuedAt(Math.floor(now.getTime() / 1000))
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(signingSecret());

  return {
    id,
    type: input.type,
    format: "jwt-vc",
    jwt,
    credential,
    digest,
    expiresAt: expiresAt.toISOString(),
    disclosureDigests,
  };
}

export async function verifyCredential(input: {
  jwt: string;
  trustedIssuers?: string[];
  audience?: string;
  revokedCredentialIds?: string[];
}): Promise<{
  verified: boolean;
  trustLevel: "green" | "yellow" | "red";
  credential?: JsonRecord;
  issuer?: string;
  credentialId?: string;
  warnings: string[];
  errors: string[];
}> {
  const warnings: string[] = [];
  const errors: string[] = [];
  try {
    const result = await jwtVerify(input.jwt, signingSecret(), { audience: input.audience ?? DEFAULT_AUDIENCE });
    const payload = result.payload as JsonRecord;
    const credential = payload.vc as JsonRecord | undefined;
    const issuer = String(payload.iss ?? "");
    const credentialId = String(payload.jti ?? credential?.id ?? "");
    const expectedDigest = String(payload.trustcare_claim_digest ?? "");
    if (!credential) errors.push("Missing VC payload.");
    if (credential && expectedDigest && sha256(credential) !== expectedDigest) errors.push("Credential digest mismatch.");
    if (input.trustedIssuers?.length && !input.trustedIssuers.includes(issuer)) errors.push("Issuer is not in the trust registry.");
    if (input.revokedCredentialIds?.includes(credentialId)) errors.push("Credential has been revoked.");

    const exp = typeof payload.exp === "number" ? payload.exp * 1000 : undefined;
    if (exp) {
      const days = (exp - Date.now()) / 86400000;
      if (days < 0) errors.push("Credential is expired.");
      else if (days <= 30) warnings.push("Credential expires within 30 days.");
    }

    const verified = errors.length === 0;
    return {
      verified,
      trustLevel: verified ? (warnings.length ? "yellow" : "green") : "red",
      credential,
      issuer,
      credentialId,
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
}): Promise<PresentationPackage> {
  const now = input.now ?? new Date();
  const expiresAt = new Date(now.getTime() + (input.validMinutes ?? 10) * 60_000);
  const id = urnUuid();
  const credentialIds = input.credentials.map((credential) => credential.id);
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
    .setProtectedHeader({ alg: "HS256", typ: "vp+JWT", kid: `${input.holderDid}#wallet-dev-key` })
    .setIssuer(input.holderDid)
    .setAudience(input.audience ?? DEFAULT_AUDIENCE)
    .setJti(id)
    .setIssuedAt(Math.floor(now.getTime() / 1000))
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(signingSecret());

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

export async function verifyPresentation(input: {
  jwt: string;
  trustedIssuers?: string[];
  audience?: string;
  revokedCredentialIds?: string[];
}): Promise<{
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
    const result = await jwtVerify(input.jwt, signingSecret(), { audience: input.audience ?? DEFAULT_AUDIENCE });
    const payload = result.payload as JsonRecord;
    const vp = payload.vp as JsonRecord | undefined;
    const vcJwtList = Array.isArray(vp?.verifiableCredential) ? (vp.verifiableCredential as string[]) : [];
    if (!vp || vcJwtList.length === 0) errors.push("Presentation does not contain credentials.");

    const credentials: JsonRecord[] = [];
    for (const jwt of vcJwtList) {
      const verification = await verifyCredential({
        jwt,
        trustedIssuers: input.trustedIssuers,
        audience: input.audience,
        revokedCredentialIds: input.revokedCredentialIds,
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
      type: "StatusList2021Entry",
      statusPurpose: "revocation",
      statusListIndex: sha256(input.id).slice(0, 8),
      statusListCredential: "https://trustcare.network/status/dev-list",
    },
  };
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
