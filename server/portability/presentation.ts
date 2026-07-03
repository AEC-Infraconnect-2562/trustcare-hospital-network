import type { JsonRecord } from "./types";
import { sha256 } from "./utils";

export function verifyJsonPresentation(input: {
  presentation: JsonRecord;
  trustedIssuers?: string[];
  revokedCredentialIds?: string[];
  requiredCredentialTypes?: string[];
  now?: string;
}): JsonRecord {
  const warnings: string[] = [];
  const errors: string[] = [];
  const presentation = input.presentation;
  const credentials = Array.isArray(presentation.verifiableCredential) ? presentation.verifiableCredential as JsonRecord[] : [];
  if (!Array.isArray(presentation.type) || !presentation.type.includes("VerifiablePresentation")) {
    errors.push("Presentation type must include VerifiablePresentation.");
  }
  if (!presentation.holder || typeof presentation.holder !== "string") errors.push("Presentation holder DID is required.");
  if (!credentials.length) errors.push("Presentation does not include verifiable credentials.");

  const disclosedTypes = new Set<string>();
  for (const credential of credentials) {
    const credentialId = String(credential.id ?? "");
    const types = Array.isArray(credential.type) ? credential.type.map(String) : [String(credential.type ?? "")];
    types.forEach((type) => disclosedTypes.add(normalizeCredentialType(type)));
    const issuerDid = typeof credential.issuer === "string" ? credential.issuer : String(credential.issuer?.id ?? "");
    if (input.trustedIssuers?.length && !input.trustedIssuers.includes(issuerDid)) {
      errors.push(`Issuer ${issuerDid || "unknown"} is not trusted.`);
    }
    if (input.revokedCredentialIds?.includes(credentialId)) errors.push(`Credential ${credentialId} is revoked.`);
    const validUntil = credential.validUntil ? new Date(String(credential.validUntil)).getTime() : undefined;
    const now = new Date(input.now ?? new Date()).getTime();
    if (validUntil && validUntil < now) errors.push(`Credential ${credentialId} is expired.`);
    if (hasFixtureProof(credential.proof)) {
      warnings.push(`Credential ${credentialId} uses fixture proof placeholder.`);
    }
  }

  for (const required of input.requiredCredentialTypes ?? []) {
    if (!disclosedTypes.has(normalizeCredentialType(required))) errors.push(`Missing required credential ${required}.`);
  }

  const highPriority = priorityClinicalFindings(credentials);
  const verified = errors.length === 0;
  return {
    verified,
    trustLevel: verified ? (warnings.length ? "yellow" : "green") : "red",
    presentationId: presentation.id,
    holderDid: presentation.holder,
    purpose: presentation.purpose,
    credentialCount: credentials.length,
    disclosedCredentialTypes: Array.from(disclosedTypes),
    highPriority,
    digest: `sha256:${sha256(presentation)}`,
    warnings,
    errors,
  };
}

function hasFixtureProof(proof: unknown): boolean {
  if (!proof || typeof proof !== "object") return false;
  const text = Object.values(proof as Record<string, unknown>).map((value) => String(value).toLowerCase()).join(" ");
  return text.includes("placeholder") || text.includes("test_proof_value_only_replace_with_real_signature");
}

function normalizeCredentialType(type: string): string {
  return type
    .replace(/^VerifiableCredential$/, "")
    .replace(/Credential$/, "")
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/-/g, "_")
    .toLowerCase()
    .replace(/^patient_identity$/, "patient_identity")
    .replace(/^hospital_staff_identity$/, "staff_identity")
    .replace(/^consent_receipt$/, "consent_receipt")
    .replace(/^coverage_eligibility$/, "insurance_eligibility");
}

function priorityClinicalFindings(credentials: JsonRecord[]): JsonRecord[] {
  const findings: JsonRecord[] = [];
  for (const credential of credentials) {
    const subject = credential.credentialSubject ?? {};
    if (Array.isArray(subject.allergies)) {
      for (const allergy of subject.allergies) {
        findings.push({ priority: "critical", type: "allergy", ...allergy });
      }
    }
    if (Array.isArray(subject.items)) {
      findings.push({ priority: "medication", type: "prescription", count: subject.items.length, rxNo: subject.rxNo });
    }
  }
  return findings;
}
