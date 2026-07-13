import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { ENV } from "./_core/env";
import { getUserById, getUserByOpenId } from "./db";

type WalletOidcClaims = JWTPayload & {
  preferred_username?: string;
  email?: string;
  realm_access?: { roles?: string[] };
  resource_access?: Record<string, { roles?: string[] }>;
  trustcare_patient_ref?: string | number;
};

export type WalletOidcIdentity = {
  claims: WalletOidcClaims;
  patientId: number;
  patientRef: string;
  subject: string;
};

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
let jwksIssuer = "";

function configuredIssuer(): string {
  if (!ENV.walletOidcIssuer) throw new Error("Wallet OIDC issuer is not configured");
  return ENV.walletOidcIssuer.replace(/\/$/, "");
}

function getJwks() {
  const issuer = configuredIssuer();
  if (!jwks || jwksIssuer !== issuer) {
    jwks = createRemoteJWKSet(new URL(`${issuer}/protocol/openid-connect/certs`));
    jwksIssuer = issuer;
  }
  return jwks;
}

function rolesFromClaims(claims: WalletOidcClaims): string[] {
  const realmRoles = claims.realm_access?.roles ?? [];
  const clientRoles = claims.resource_access?.[ENV.walletOidcClientId]?.roles ?? [];
  return Array.from(new Set([...realmRoles, ...clientRoles]));
}

async function resolvePatientRef(patientRef: string): Promise<{ patientId: number; patientRef: string } | null> {
  const numericId = Number(patientRef);
  const user = Number.isInteger(numericId) && numericId > 0
    ? await getUserById(numericId)
    : await getUserByOpenId(patientRef);
  if (!user || user.systemRole !== "patient" || !user.isActive) return null;
  return { patientId: user.id, patientRef: user.openId };
}

export async function verifyWalletAccessToken(token: string): Promise<WalletOidcIdentity | null> {
  if (!token || !ENV.walletOidcIssuer) return null;
  const issuer = configuredIssuer();
  const { payload } = await jwtVerify(token, getJwks(), {
    issuer,
    audience: ENV.walletOidcAudience,
  });
  const claims = payload as WalletOidcClaims;
  const roles = rolesFromClaims(claims);
  if (ENV.walletOidcRequiredRole && !roles.includes(ENV.walletOidcRequiredRole)) {
    throw new Error(`OIDC role '${ENV.walletOidcRequiredRole}' is required`);
  }

  const configuredClaim = claims[ENV.walletOidcPatientRefClaim as keyof WalletOidcClaims];
  const patientRef = String(configuredClaim ?? claims.preferred_username ?? claims.sub ?? "");
  if (!patientRef || !claims.sub) throw new Error("OIDC token has no patient identity claim");
  const patient = await resolvePatientRef(patientRef);
  if (!patient) throw new Error("OIDC identity is not a seeded active patient");

  return { claims, patientId: patient.patientId, patientRef: patient.patientRef, subject: claims.sub };
}

export async function requestSandboxToken(identityId: string): Promise<Record<string, unknown>> {
  if (!ENV.keycloakTestLoginEnabled) throw new Error("Sandbox test login is disabled");
  if (!ENV.walletOidcIssuer) throw new Error("Wallet OIDC issuer is not configured");
  if (!ENV.keycloakTestUserPassword) throw new Error("Sandbox test password is not configured");

  const user = await getUserByOpenId(identityId);
  if (!user || user.systemRole !== "patient" || !user.isActive) {
    throw new Error("Sandbox identity is not an active patient");
  }

  const body = new URLSearchParams({
    grant_type: "password",
    client_id: ENV.walletTestLoginClientId,
    username: user.openId,
    password: ENV.keycloakTestUserPassword,
    scope: "openid profile email",
  });
  const response = await fetch(`${configuredIssuer()}/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Sandbox OIDC login failed (${response.status})`);
  }
  return payload as Record<string, unknown>;
}

export function walletOidcDiscovery() {
  const issuer = ENV.walletOidcIssuer.replace(/\/$/, "");
  return {
    issuer: issuer || null,
    authorizationEndpoint: issuer ? `${issuer}/protocol/openid-connect/auth` : null,
    tokenEndpoint: issuer ? `${issuer}/protocol/openid-connect/token` : null,
    jwksUri: issuer ? `${issuer}/protocol/openid-connect/certs` : null,
    audience: ENV.walletOidcAudience,
    requiredRole: ENV.walletOidcRequiredRole,
    patientRefClaim: ENV.walletOidcPatientRefClaim,
  };
}
