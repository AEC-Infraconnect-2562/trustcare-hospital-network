import type { ConsentGrant, ConsentPurpose, PolicyDecision, PortabilityContext } from "./types";

const CONTEXT_PURPOSE: Record<PortabilityContext, ConsentPurpose> = {
  treatment: "treatment",
  cross_branch_referral: "referral",
  cross_border: "referral",
  e_claim: "claim",
  medical_tourist: "medical_tourism",
  emergency: "emergency",
  self_share: "treatment",
};

const ALLOWED_SCOPE_BY_PURPOSE: Record<ConsentPurpose, string[]> = {
  treatment: ["Patient.read", "Condition.read", "AllergyIntolerance.read", "Medication.read", "Observation.read", "DocumentReference.read"],
  referral: ["Patient.read", "Condition.read", "AllergyIntolerance.read", "Medication.read", "Observation.read", "ServiceRequest.read", "DocumentReference.read"],
  claim: ["Patient.read", "Coverage.read", "Claim.read", "Condition.read", "Procedure.read", "Encounter.read"],
  insurance: ["Patient.read", "Coverage.read", "Claim.read", "Encounter.read"],
  public_health: ["Patient.pseudonymized", "Immunization.read", "Observation.aggregate"],
  research: ["Patient.pseudonymized", "Observation.aggregate", "Condition.aggregate"],
  emergency: ["Patient.read", "AllergyIntolerance.read", "Medication.read", "Condition.read"],
  medical_tourism: ["Patient.read", "Condition.read", "AllergyIntolerance.read", "Medication.read", "Observation.read", "DocumentReference.read", "Coverage.read"],
};

export function purposeForContext(context: PortabilityContext): ConsentPurpose {
  return CONTEXT_PURPOSE[context];
}

export function decideAccess(input: {
  context: PortabilityContext;
  requestedScopes: string[];
  requesterId: string;
  requesterRole: string;
  consent?: ConsentGrant;
  now?: Date;
  breakGlassReason?: string;
}): PolicyDecision {
  const now = input.now ?? new Date();
  const purpose = purposeForContext(input.context);
  const allowedByPurpose = ALLOWED_SCOPE_BY_PURPOSE[purpose] ?? [];
  const requestedWithinPurpose = input.requestedScopes.filter((scope) => allowedByPurpose.includes(scope));
  const reasons: string[] = [];

  if (requestedWithinPurpose.length !== input.requestedScopes.length) {
    reasons.push("Some requested scopes were removed by purpose-based minimization.");
  }

  if (purpose === "emergency" && input.breakGlassReason) {
    return {
      allowed: true,
      purpose,
      requestedScopes: input.requestedScopes,
      grantedScopes: allowedByPurpose,
      minimizedScopes: requestedWithinPurpose.length ? requestedWithinPurpose : allowedByPurpose,
      reasons: [...reasons, "Emergency break-glass allowed with mandatory audit."],
      requiresBreakGlass: true,
    };
  }

  if (!input.consent) {
    return {
      allowed: false,
      purpose,
      requestedScopes: input.requestedScopes,
      grantedScopes: [],
      minimizedScopes: [],
      reasons: [...reasons, "No active consent was supplied."],
      requiresBreakGlass: purpose === "emergency",
    };
  }

  if (input.consent.status !== "granted") reasons.push(`Consent status is ${input.consent.status}.`);
  if (input.consent.purpose !== purpose) reasons.push(`Consent purpose ${input.consent.purpose} does not match requested purpose ${purpose}.`);
  if (input.consent.expiresAt && new Date(input.consent.expiresAt) <= now) reasons.push("Consent is expired.");

  const consentScopes = input.consent.scopes.filter((scope) => allowedByPurpose.includes(scope));
  const minimizedScopes = requestedWithinPurpose.filter((scope) => consentScopes.includes(scope));
  const allowed = reasons.length === 0 && minimizedScopes.length > 0;

  return {
    allowed,
    purpose,
    requestedScopes: input.requestedScopes,
    grantedScopes: consentScopes,
    minimizedScopes,
    reasons: allowed ? [...reasons, "Consent and purpose policy allow access."] : reasons,
    requiresBreakGlass: false,
  };
}

export function defaultScopesForContext(context: PortabilityContext): string[] {
  return [...ALLOWED_SCOPE_BY_PURPOSE[purposeForContext(context)]];
}
