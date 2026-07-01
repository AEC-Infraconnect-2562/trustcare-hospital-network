export const ISSUER_PRIVILEGE_ROLES = ["issuer_maker", "issuer_checker"] as const;

export type IssuerPrivilegeRole = (typeof ISSUER_PRIVILEGE_ROLES)[number];

export type CredentialEntitlements = {
  makerTypes?: string[];
  checkerTypes?: string[];
};

const MAKER_SYSTEM_ROLES = new Set(["system_admin", "hospital_admin", "doctor", "nurse", "integration_engineer", "maker"]);
const CHECKER_SYSTEM_ROLES = new Set(["system_admin", "hospital_admin", "doctor", "nurse", "integration_engineer", "checker"]);

export function isPatientRole(systemRole: unknown): boolean {
  return !systemRole || systemRole === "patient";
}

export function isIssuerPrivilegeRole(role: unknown): role is IssuerPrivilegeRole {
  return ISSUER_PRIVILEGE_ROLES.includes(role as IssuerPrivilegeRole);
}

export function canHoldIssuerPrivileges(systemRole: unknown): boolean {
  return !isPatientRole(systemRole);
}

export function sanitizeAdditionalRolesForSystemRole(systemRole: unknown, additionalRoles: string[] = []): string[] {
  if (isPatientRole(systemRole)) return additionalRoles.filter((role) => !isIssuerPrivilegeRole(role));
  return additionalRoles;
}

export function normalizeActiveRole(systemRole: unknown, requestedRole: unknown, additionalRoles: string[] = []): string {
  const baseRole = typeof systemRole === "string" && systemRole ? systemRole : "patient";
  const requested = typeof requestedRole === "string" && requestedRole ? requestedRole : baseRole;
  const allowedRoles = availableRolesForSystemRole(baseRole, additionalRoles);
  return allowedRoles.includes(requested) ? requested : baseRole;
}

export function availableRolesForSystemRole(systemRole: unknown, additionalRoles: string[] = []): string[] {
  const baseRole = typeof systemRole === "string" && systemRole ? systemRole : "patient";
  const roles = new Set<string>(isPatientRole(baseRole) ? ["patient"] : [baseRole, "patient"]);
  for (const role of sanitizeAdditionalRolesForSystemRole(baseRole, additionalRoles)) {
    roles.add(role);
  }
  return Array.from(roles);
}

export function canActAsCredentialMaker(systemRole: unknown, additionalRoles: string[] = []): boolean {
  if (!canHoldIssuerPrivileges(systemRole)) return false;
  return MAKER_SYSTEM_ROLES.has(String(systemRole)) || additionalRoles.includes("issuer_maker");
}

export function canActAsCredentialChecker(systemRole: unknown, additionalRoles: string[] = []): boolean {
  if (!canHoldIssuerPrivileges(systemRole)) return false;
  return CHECKER_SYSTEM_ROLES.has(String(systemRole)) || additionalRoles.includes("issuer_checker");
}

export function normalizeCredentialEntitlements(
  systemRole: unknown,
  entitlements?: CredentialEntitlements | null,
): Required<CredentialEntitlements> {
  if (!canHoldIssuerPrivileges(systemRole)) {
    return { makerTypes: [], checkerTypes: [] };
  }
  return {
    makerTypes: Array.isArray(entitlements?.makerTypes) ? entitlements!.makerTypes! : [],
    checkerTypes: Array.isArray(entitlements?.checkerTypes) ? entitlements!.checkerTypes! : [],
  };
}
