export * from "./types";
export * from "./fhir";
export * from "./vc";
export * from "./policy";
export * from "./syncBack";
export * from "./clinicalDocuments";

import { buildMedicalCertificateFhir, buildPrescriptionMedicationRequests } from "./clinicalDocuments";
import { canonicalizeHisPayload } from "./fhir";
import { decideAccess, defaultScopesForContext, purposeForContext } from "./policy";
import type {
  ConsentGrant,
  ContextPacket,
  HisIngestionInput,
  IssuedVc,
  IssuerProfile,
  JsonRecord,
  PortabilityContext,
} from "./types";
import {
  consentReceiptClaims,
  createPresentation,
  issueCredential,
  medicalCertificateClaims,
  patientSummaryClaims,
  prescriptionClaims,
} from "./vc";
import { compactId, isoNow, sha256 } from "./utils";

export async function createPortabilityPacket(input: {
  context: PortabilityContext;
  hisInput: HisIngestionInput;
  issuer: IssuerProfile;
  holderDid: string;
  requesterId: string;
  requesterRole: string;
  consent?: ConsentGrant;
  requestedScopes?: string[];
  audience?: string;
  breakGlassReason?: string;
}): Promise<ContextPacket> {
  const canonical = canonicalizeHisPayload(input.hisInput);
  const requestedScopes = input.requestedScopes ?? defaultScopesForContext(input.context);
  const policyDecision = decideAccess({
    context: input.context,
    requestedScopes,
    requesterId: input.requesterId,
    requesterRole: input.requesterRole,
    consent: input.consent,
    breakGlassReason: input.breakGlassReason,
  });

  const outboundCredentials: IssuedVc[] = [];
  if (input.consent) {
    outboundCredentials.push(
      await issueCredential({
        type: "ConsentReceiptCredential",
        issuer: input.issuer,
        subjectId: input.consent.patientId,
        subjectDid: input.holderDid,
        claims: consentReceiptClaims(input.consent),
        validDays: 180,
        audience: input.audience,
      })
    );
  }

  outboundCredentials.push(
    await issueCredential({
      type: "PatientSummaryCredential",
      issuer: input.issuer,
      subjectId: canonical.summary.patientId,
      subjectDid: input.holderDid,
      claims: patientSummaryClaims(canonical),
      evidence: [{ type: "FHIRBundleHash", digest: canonical.summary.bundleHash }],
      validDays: contextValidityDays(input.context),
      audience: input.audience,
    })
  );

  const presentation = await createPresentation({
    holderDid: input.holderDid,
    credentials: outboundCredentials,
    purpose: purposeForContext(input.context),
    audience: input.audience,
  });

  const shlManifest = {
    shl: `shlink:/${sha256(presentation.jwt).slice(0, 64)}`,
    manifestHash: sha256({ bundleHash: canonical.summary.bundleHash, credentialIds: outboundCredentials.map((vc) => vc.id) }),
    encrypted: true,
    passcodeRequired: true,
    expiresAt: presentation.expiresAt,
    files: [
      {
        contentType: "application/fhir+json",
        location: `trustcare://fhir/ips/${canonical.summary.bundleHash}`,
        hash: canonical.summary.bundleHash,
      },
      ...outboundCredentials.map((credential) => ({
        contentType: "application/vc+jwt",
        location: `trustcare://vc/${credential.id}`,
        hash: credential.digest,
      })),
    ],
  };

  return {
    context: input.context,
    canonicalSummary: canonical.summary,
    shlManifest,
    outboundCredentials,
    presentation,
    auditEvent: {
      resourceType: "AuditEvent",
      id: compactId("audit", { presentation: presentation.id, context: input.context }),
      type: { code: "rest" },
      action: "E",
      recorded: isoNow(),
      outcome: policyDecision.allowed ? "0" : "8",
      purposeOfEvent: [{ text: policyDecision.purpose }],
      agent: [{ who: { identifier: { value: input.requesterId }, display: input.requesterRole }, requestor: true }],
      entity: [
        { what: { identifier: { value: canonical.summary.bundleHash }, display: "FHIR IPS Bundle" } },
        ...outboundCredentials.map((credential) => ({ what: { identifier: { value: credential.id }, display: credential.type } })),
      ],
    },
    policyDecision,
  };
}

export async function issueMedicalCertificateVc(input: {
  issuer: IssuerProfile;
  holderDid: string;
  patient: JsonRecord;
  practitioner: JsonRecord;
  organization: JsonRecord;
  diagnosisText?: string;
  fitnessForWork?: "fit" | "unfit" | "restricted";
  recommendations?: string[];
  validFrom?: string;
  validUntil?: string;
  audience?: string;
}): Promise<IssuedVc> {
  const fhir = buildMedicalCertificateFhir(input);
  return issueCredential({
    type: "MedicalCertificateCredential",
    issuer: input.issuer,
    subjectId: String(input.patient.id),
    subjectDid: input.holderDid,
    claims: medicalCertificateClaims({
      patientId: String(input.patient.id),
      patientName: String(input.patient.name ?? "Unknown Patient"),
      practitioner: input.practitioner,
      organization: input.organization,
      diagnosisText: input.diagnosisText,
      fitnessForWork: input.fitnessForWork,
      recommendations: input.recommendations,
      validFrom: input.validFrom,
      validUntil: input.validUntil,
      fhirComposition: fhir.composition,
      documentHash: fhir.documentHash,
    }),
    evidence: [{ type: "FHIRComposition", digest: fhir.documentHash, resourceId: fhir.composition.id }],
    validDays: 90,
    audience: input.audience,
  });
}

export async function issuePrescriptionVc(input: {
  issuer: IssuerProfile;
  holderDid: string;
  patient: JsonRecord;
  prescriber: JsonRecord;
  organization: JsonRecord;
  medications: Parameters<typeof buildPrescriptionMedicationRequests>[0]["medications"];
  authoredOn?: string;
  substitutionAllowed?: boolean;
  repeatsAllowed?: number;
  dispenseWindowDays?: number;
  audience?: string;
}): Promise<IssuedVc> {
  const medicationRequests = buildPrescriptionMedicationRequests({
    patient: input.patient,
    prescriber: input.prescriber,
    organization: input.organization,
    medications: input.medications,
    authoredOn: input.authoredOn,
  });
  return issueCredential({
    type: "PrescriptionCredential",
    issuer: input.issuer,
    subjectId: String(input.patient.id),
    subjectDid: input.holderDid,
    claims: prescriptionClaims({
      patientId: String(input.patient.id),
      patientName: String(input.patient.name ?? "Unknown Patient"),
      prescriber: input.prescriber,
      organization: input.organization,
      authoredOn: input.authoredOn,
      medicationRequests,
      substitutionAllowed: input.substitutionAllowed,
      repeatsAllowed: input.repeatsAllowed,
      dispenseWindowDays: input.dispenseWindowDays,
    }),
    evidence: [{ type: "FHIRMedicationRequestBundle", digest: sha256(medicationRequests), resourceCount: medicationRequests.length }],
    validDays: input.dispenseWindowDays ?? 30,
    audience: input.audience,
  });
}

function contextValidityDays(context: PortabilityContext): number {
  if (context === "e_claim") return 90;
  if (context === "cross_border" || context === "medical_tourist") return 30;
  if (context === "emergency") return 1;
  return 14;
}
