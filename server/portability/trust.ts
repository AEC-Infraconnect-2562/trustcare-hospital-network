import type { JsonRecord, TrustRegistryVerificationMode, TrustRegistryVerificationPolicy, TrustcareCredentialType } from "./types";

export function buildTrustRegistryPolicy(input: {
  entries?: JsonRecord[];
  mode?: TrustRegistryVerificationMode;
  revokedCredentialIds?: string[];
  revokedStatusIndexes?: string[];
  allowedCredentialTypes?: TrustcareCredentialType[];
}): TrustRegistryVerificationPolicy {
  const policy: TrustRegistryVerificationPolicy = {
    mode: input.mode ?? "advisory",
    trustedIssuers: [],
    issuerJwks: {},
    kidJwks: {},
    revokedCredentialIds: [...(input.revokedCredentialIds ?? [])],
    revokedStatusIndexes: [...(input.revokedStatusIndexes ?? [])],
    allowedCredentialTypes: input.allowedCredentialTypes,
  };

  for (const entry of input.entries ?? []) {
    if (!isTrustedRegistryEntry(entry)) continue;
    const did = typeof entry.did === "string" ? entry.did : undefined;
    if (!did) continue;

    policy.trustedIssuers.push(did);
    const jwks = extractJwks(entry);
    if (jwks.length) {
      policy.issuerJwks[did] = jwks;
      for (const jwk of jwks) {
        if (typeof jwk.kid === "string") policy.kidJwks[jwk.kid] = jwk;
      }
    }

    const metadata = isRecord(entry.metadata) ? entry.metadata : {};
    policy.revokedCredentialIds.push(...stringList(metadata.revokedCredentialIds));
    policy.revokedStatusIndexes.push(...stringList(metadata.revokedStatusIndexes));
  }

  policy.trustedIssuers = unique(policy.trustedIssuers);
  policy.revokedCredentialIds = unique(policy.revokedCredentialIds);
  policy.revokedStatusIndexes = unique(policy.revokedStatusIndexes);
  return policy;
}

export function productionReadinessChecks(policy: TrustRegistryVerificationPolicy): JsonRecord {
  return {
    mode: policy.mode,
    hasTrustedIssuers: policy.trustedIssuers.length > 0,
    hasPublicKeys: Object.keys(policy.kidJwks).length > 0 || Object.keys(policy.issuerJwks).length > 0,
    hasRevocationInputs: policy.revokedCredentialIds.length > 0 || policy.revokedStatusIndexes.length > 0,
    recommendations: [
      policy.trustedIssuers.length === 0 && "Seed verified issuer DIDs in the trust registry before enabling required mode.",
      Object.keys(policy.kidJwks).length === 0 && "Publish issuer public JWKs and expose /.well-known/jwks.json for production verification.",
      policy.mode !== "required" && "Use required mode for cross-border, payer, and medical tourist verification in production.",
    ].filter(Boolean),
  };
}

function isTrustedRegistryEntry(entry: JsonRecord): boolean {
  if (entry.isActive === false) return false;
  return entry.trustLevel === "verified";
}

function extractJwks(entry: JsonRecord): JsonRecord[] {
  const jwks: JsonRecord[] = [];
  if (isRecord(entry.publicKeyJwk)) jwks.push(entry.publicKeyJwk);
  const metadata = isRecord(entry.metadata) ? entry.metadata : {};
  if (Array.isArray(metadata.jwks)) {
    for (const jwk of metadata.jwks) {
      if (isRecord(jwk)) jwks.push(jwk);
    }
  }
  if (isRecord(metadata.publicKeyJwk)) jwks.push(metadata.publicKeyJwk);
  return jwks;
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}
