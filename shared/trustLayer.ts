export type PacketTransportMode = "direct_vp" | "vp_bundle" | "shl_packet";

export interface TrustLayerDecision {
  mode: PacketTransportMode;
  label: string;
  labelEn: string;
  reason: string;
  userAction: string;
  verifierAction: string;
  expectedArtifacts: string[];
}

export interface TrustChecklistItem {
  key: string;
  label: string;
  status: "required" | "present" | "missing" | "recommended";
  detail: string;
}

export interface SingleDocumentCredentialContract {
  documentType: string;
  label: string;
  category: string;
  recommendedMode: PacketTransportMode;
  requiredClaims: string[];
  holderAction: string;
  verifierChecks: string[];
}

export const singleDocumentCredentialContracts: SingleDocumentCredentialContract[] = [
  {
    documentType: "patient_identity",
    label: "Patient identity card",
    category: "identity_and_access",
    recommendedMode: "direct_vp",
    requiredClaims: ["patient name", "HN/identity number", "holder DID", "issuer DID", "validity period"],
    holderAction: "Present one identity credential as a purpose-bound VP QR.",
    verifierChecks: ["issuer trust", "holder binding", "credential status", "expiry", "photo/identifier match"],
  },
  {
    documentType: "prescription",
    label: "Prescription",
    category: "medication_and_pharmacy",
    recommendedMode: "direct_vp",
    requiredClaims: ["prescriber", "medication items", "dose", "dispense validity", "patient"],
    holderAction: "Present one prescription VC to pharmacy or include it in a pharmacy VP.",
    verifierChecks: ["prescriber issuer", "status/revocation", "expiry", "medication safety warnings"],
  },
  {
    documentType: "medical_certificate",
    label: "Medical certificate",
    category: "clinical_summary",
    recommendedMode: "direct_vp",
    requiredClaims: ["certifying doctor", "clinical assertion", "issued date", "patient", "validity/scope"],
    holderAction: "Present the certificate as a single-document VP for the named recipient.",
    verifierChecks: ["doctor/hospital issuer", "schema", "status", "terms of use"],
  },
  {
    documentType: "appointment",
    label: "Appointment",
    category: "operations",
    recommendedMode: "direct_vp",
    requiredClaims: ["service date", "department", "patient", "hospital"],
    holderAction: "Present one appointment VC at service intake.",
    verifierChecks: ["hospital issuer", "appointment status", "time window", "holder binding"],
  },
  {
    documentType: "insurance_eligibility",
    label: "Coverage eligibility",
    category: "claims_and_finance",
    recommendedMode: "direct_vp",
    requiredClaims: ["payer", "coverage class", "eligibility period", "patient", "benefit scope"],
    holderAction: "Present coverage as a single VP or add it to a claim packet.",
    verifierChecks: ["payer/issuer trust", "coverage period", "status", "policy scope"],
  },
  {
    documentType: "shl_manifest",
    label: "SHL manifest credential",
    category: "sharing_and_sync",
    recommendedMode: "shl_packet",
    requiredClaims: ["manifest hash", "source bundle hash", "purpose", "context", "expiry"],
    holderAction: "Share the SHL link/QR while VC/VP proves the manifest integrity around it.",
    verifierChecks: ["manifest hash", "file hashes", "holder VP", "passcode/expiry/access policy"],
  },
];

const shlContexts = new Set(["referral", "cross_border", "medical_tourist"]);

export function classifyPacketTransport(input: {
  documentTypes?: string[];
  credentialCount?: number;
  hasLegacyDocuments?: boolean;
  hasFhirBundle?: boolean;
  estimatedBytes?: number;
  context?: string;
}): TrustLayerDecision {
  const documentTypes = input.documentTypes ?? [];
  const credentialCount = input.credentialCount ?? documentTypes.length;
  const hasLegacy = Boolean(input.hasLegacyDocuments);
  const hasLargeFhir = Boolean(input.hasFhirBundle && (input.estimatedBytes ?? 0) > 40_000);
  const contextNeedsPacket = input.context ? shlContexts.has(input.context) : false;

  if (hasLegacy || hasLargeFhir || credentialCount > 5 || contextNeedsPacket) {
    return {
      mode: "shl_packet",
      label: "SHL packet with VC/VP trust layer",
      labelEn: "SHL packet",
      reason: "Use SHL when the share contains a large FHIR bundle, legacy DocumentReference files, many credentials, or a cross-organization workflow.",
      userAction: "Create a passcode-protected SHL and keep the manifest credential and holder VP bound to it.",
      verifierAction: "Resolve the manifest, decrypt files, verify manifest/file hashes, then verify the bound VC/VP.",
      expectedArtifacts: ["shlink payload", "SHL manifest", "FHIR JSON or DocumentReference files", "ShlManifestCredential", "holder VP", "audit log"],
    };
  }

  if (credentialCount <= 1) {
    return {
      mode: "direct_vp",
      label: "Single-document VP",
      labelEn: "Direct VC/VP",
      reason: "A single high-value credential fits in a purpose-bound VP QR without creating an SHL transport envelope.",
      userAction: "Select one credential and create a short-lived VP QR.",
      verifierAction: "Verify holder, issuer, schema, status, expiry, audience, and consent/terms.",
      expectedArtifacts: ["VC", "holder VP", "verification audit"],
    };
  }

  return {
    mode: "vp_bundle",
    label: "Small VP bundle",
    labelEn: "VP bundle",
    reason: "A small set of wallet credentials can be presented directly as one VP before using SHL.",
    userAction: "Select the minimum necessary credentials and create a purpose-bound VP.",
    verifierAction: "Verify each credential plus the holder presentation envelope.",
    expectedArtifacts: ["multiple VCs", "holder VP", "verification audit"],
  };
}

export function buildTrustLayerChecklist(input: {
  mode: PacketTransportMode;
  hasIssuer?: boolean;
  hasHolder?: boolean;
  hasSchema?: boolean;
  hasStatus?: boolean;
  hasConsent?: boolean;
  hasManifestCredential?: boolean;
  hasPresentation?: boolean;
  hasPasscodePolicy?: boolean;
  hasFileHashes?: boolean;
  hasDocumentReferences?: boolean;
}): TrustChecklistItem[] {
  const base: TrustChecklistItem[] = [
    item("issuer", "Issuer trusted", input.hasIssuer, "Issuer DID must resolve in Trust Registry/TAO."),
    item("holder", "Holder binding", input.hasHolder, "VP holder DID must match the wallet or delegated holder."),
    item("schema", "Schema and claims", input.hasSchema, "Credential type and required claims must match Contract Hub."),
    item("status", "Status and expiry", input.hasStatus, "Verifier must check revocation/status and validity period."),
    item("consent", "Consent and audience", input.hasConsent, "Presentation must be purpose-, recipient-, and time-bound."),
  ];

  if (input.mode === "shl_packet") {
    base.push(
      item("manifestCredential", "Manifest VC", input.hasManifestCredential, "ShlManifestCredential binds manifest hash, source bundle hash, purpose, and expiry."),
      item("presentation", "Holder VP around SHL", input.hasPresentation, "TrustCare-aware receivers should verify the holder VP bound to the manifest."),
      item("passcodePolicy", "Passcode/access policy", input.hasPasscodePolicy, "SHL must enforce passcode, expiry, max access, revocation, and audit."),
      item("fileHashes", "Manifest/file hashes", input.hasFileHashes, "Each encrypted file must match the manifest hash record."),
      item("documentReferences", "DocumentReference provenance", input.hasDocumentReferences, "Legacy files must be represented by FHIR DocumentReference with hash and provenance."),
    );
  }

  return base;
}

function item(key: string, label: string, present: boolean | undefined, detail: string): TrustChecklistItem {
  return {
    key,
    label,
    status: present === undefined ? "recommended" : present ? "present" : "missing",
    detail,
  };
}
