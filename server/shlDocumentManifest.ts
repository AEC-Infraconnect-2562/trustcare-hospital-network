import { sha256 } from "./portability/utils";

type ShlLike = Record<string, any>;
type ShlFileLike = Record<string, any>;

type DocumentTemplate = {
  documentType: string;
  title: string;
  category: string;
  fhirResource: string;
  sourceRole: string;
  vcType?: string;
};

const templatesByContext: Record<string, DocumentTemplate[]> = {
  medical_tourist: [
    doc("travel_document", "Passport / travel identity", "identity_and_access", "DocumentReference", "International desk"),
    doc("patient_summary", "Clinical summary for pre-review", "clinical_summary", "Composition", "Referring clinician", "PatientSummaryCredential"),
    doc("quotation", "Treatment quotation / estimate", "medical_tourism", "DocumentReference", "International desk", "QuotationCredential"),
    doc("guarantee_letter", "Guarantee letter or payer support", "medical_tourism", "DocumentReference", "Payer or facilitator"),
    doc("visa_support_letter", "Visa support document", "medical_tourism", "DocumentReference", "International desk"),
  ],
  e_claim: [
    doc("insurance_eligibility", "Coverage eligibility", "claims_and_finance", "Coverage", "Payer adapter", "CoverageEligibilityCredential"),
    doc("claim_package", "Verified claim package", "claims_and_finance", "Claim", "Claim center", "ClaimPackageCredential"),
    doc("invoice", "Invoice / charge summary", "claims_and_finance", "Invoice", "Hospital finance"),
    doc("claim_receipt", "Receipt / payment evidence", "claims_and_finance", "DocumentReference", "Hospital finance", "ReceiptCredential"),
    doc("medical_certificate", "Clinical evidence for payer", "clinical_summary", "DocumentReference", "Doctor", "MedicalCertificateCredential"),
  ],
  insurance: [
    doc("insurance_eligibility", "Coverage eligibility", "claims_and_finance", "Coverage", "Payer adapter", "CoverageEligibilityCredential"),
    doc("claim_package", "Verified claim package", "claims_and_finance", "Claim", "Claim center", "ClaimPackageCredential"),
    doc("invoice", "Invoice / charge summary", "claims_and_finance", "Invoice", "Hospital finance"),
    doc("claim_receipt", "Receipt / payment evidence", "claims_and_finance", "DocumentReference", "Hospital finance", "ReceiptCredential"),
    doc("medical_certificate", "Clinical evidence for payer", "clinical_summary", "DocumentReference", "Doctor", "MedicalCertificateCredential"),
  ],
  cross_branch_referral: [
    doc("referral_vc", "Referral document", "care_transition", "ServiceRequest", "Referring hospital", "ReferralCredential"),
    doc("patient_summary", "Patient summary", "clinical_summary", "Composition", "Referring clinician", "PatientSummaryCredential"),
    doc("lab_result", "Relevant laboratory results", "diagnostics_and_results", "DiagnosticReport", "LIS"),
    doc("diagnostic_report", "Imaging or diagnostic report", "diagnostics_and_results", "DiagnosticReport", "RIS/PACS"),
    doc("consent_receipt", "Referral consent receipt", "identity_and_access", "Consent", "Patient wallet", "ConsentReceiptCredential"),
  ],
  referral: [
    doc("referral_vc", "Referral document", "care_transition", "ServiceRequest", "Referring hospital", "ReferralCredential"),
    doc("patient_summary", "Patient summary", "clinical_summary", "Composition", "Referring clinician", "PatientSummaryCredential"),
    doc("lab_result", "Relevant laboratory results", "diagnostics_and_results", "DiagnosticReport", "LIS"),
    doc("diagnostic_report", "Imaging or diagnostic report", "diagnostics_and_results", "DiagnosticReport", "RIS/PACS"),
    doc("consent_receipt", "Referral consent receipt", "identity_and_access", "Consent", "Patient wallet", "ConsentReceiptCredential"),
  ],
  cross_border: [
    doc("referral_vc", "Cross-border referral", "care_transition", "ServiceRequest", "Referring partner", "ReferralCredential"),
    doc("patient_summary", "Bilingual clinical summary", "clinical_summary", "Composition", "Referring clinician", "PatientSummaryCredential"),
    doc("consent_receipt", "Cross-border consent receipt", "identity_and_access", "Consent", "Patient wallet", "ConsentReceiptCredential"),
    doc("travel_document", "Identity / travel document", "identity_and_access", "DocumentReference", "Patient or partner"),
  ],
  emergency: [
    doc("patient_identity", "Patient identity", "identity_and_access", "Patient", "Patient wallet", "PatientIdentityCredential"),
    doc("allergy_alert", "Allergy alerts", "clinical_summary", "AllergyIntolerance", "HIS/EMR"),
    doc("medication_summary", "Current medications", "medication_and_pharmacy", "MedicationStatement", "Pharmacy"),
    doc("patient_summary", "Critical conditions summary", "clinical_summary", "Composition", "HIS/EMR", "PatientSummaryCredential"),
  ],
  treatment: [
    doc("patient_identity", "Patient identity", "identity_and_access", "Patient", "Patient wallet", "PatientIdentityCredential"),
    doc("patient_summary", "Recent patient summary", "clinical_summary", "Composition", "HIS/EMR", "PatientSummaryCredential"),
    doc("medication_summary", "Current medications", "medication_and_pharmacy", "MedicationStatement", "Pharmacy"),
    doc("allergy_alert", "Allergy alerts", "clinical_summary", "AllergyIntolerance", "HIS/EMR"),
  ],
  self_share: [
    doc("patient_identity", "Patient identity", "identity_and_access", "Patient", "Patient wallet", "PatientIdentityCredential"),
    doc("patient_summary", "Selected patient summary", "clinical_summary", "Composition", "Patient wallet", "PatientSummaryCredential"),
    doc("consent_receipt", "Self-share consent receipt", "identity_and_access", "Consent", "Patient wallet", "ConsentReceiptCredential"),
  ],
  patient_summary: [
    doc("patient_identity", "Patient identity", "identity_and_access", "Patient", "Patient wallet", "PatientIdentityCredential"),
    doc("patient_summary", "Patient summary", "clinical_summary", "Composition", "HIS/EMR", "PatientSummaryCredential"),
    doc("allergy_alert", "Allergy alerts", "clinical_summary", "AllergyIntolerance", "HIS/EMR"),
    doc("medication_summary", "Medication summary", "medication_and_pharmacy", "MedicationStatement", "Pharmacy"),
  ],
};

export function buildShlDocumentBundle(shl: ShlLike, files: ShlFileLike[]) {
  const manifestVersion = Number(shl.currentManifestVersion ?? files[0]?.manifestVersion ?? 1);
  const context = String(shl.context ?? shl.purpose ?? "patient_summary");
  const purpose = String(shl.purpose ?? "patient_summary");
  const templates = templatesByContext[context] ?? templatesByContext[purpose] ?? templatesByContext.patient_summary;
  const fhirFile = files.find((file) => file.contentType === "application/fhir+json") ?? files[0];
  const documents = templates.map((template, index) => {
    const seed = `${shl.id}:${manifestVersion}:${template.documentType}:${fhirFile?.fileId ?? "manifest"}`;
    const documentReferenceId = `DocumentReference/shl-${shl.id}-${manifestVersion}-${template.documentType}`;
    return {
      id: `shl-doc-${sha256(seed).slice(0, 16)}`,
      sequence: index + 1,
      title: template.title,
      documentType: template.documentType,
      category: template.category,
      status: shl.status === "active" ? "available_in_manifest" : "linked_to_inactive_shl",
      sourceRole: template.sourceRole,
      fhirResource: template.fhirResource,
      contentType: fhirFile?.contentType ?? "application/fhir+json",
      manifestFileId: fhirFile?.fileId,
      manifestFileDbId: fhirFile?.id,
      manifestVersion,
      hash: {
        contentHash: fhirFile?.contentHash,
        plaintextHash: fhirFile?.plaintextHash,
        sourceBundleHash: shl.sourceBundleHash,
      },
      objectLinks: {
        manifest: shl.manifestUrl,
        shlFile: fhirFile?.fileId ? `shl://${shl.id}/versions/${manifestVersion}/files/${fhirFile.fileId}` : undefined,
        fhirDocumentReference: documentReferenceId,
        fhirBundle: shl.sourceBundleHash ? `Bundle/${shl.sourceBundleHash}` : undefined,
        manifestCredential: shl.manifestCredentialId ? `Credential/${shl.manifestCredentialId}` : undefined,
        holderPresentation: shl.presentationId ? `Presentation/${shl.presentationId}` : undefined,
        futureApi: `/api/shl/${shl.id}/manifest-documents/${template.documentType}`,
      },
      vcBinding: {
        recommendedCredentialType: template.vcType,
        manifestCredentialId: shl.manifestCredentialId,
        presentationId: shl.presentationId,
      },
      accessBinding: {
        passcodeRequired: Boolean(shl.passcodeRequired),
        expiresAt: shl.expiresAt,
        currentAccessCount: shl.currentAccessCount ?? 0,
        maxAccessCount: shl.maxAccessCount,
      },
    };
  });
  return {
    bundleId: `shl-bundle-${shl.id}-v${manifestVersion}`,
    manifestVersion,
    source: "derived_from_shl_manifest_and_fhir_bundle",
    bindingModel: "SHL manifest file -> FHIR Bundle/DocumentReference -> VC/VP trust links",
    standards: ["SMART Health Links files[]", "HL7 FHIR Bundle", "HL7 FHIR DocumentReference", "W3C VC/VP"],
    status: shl.status,
    documents,
    files: files.map((file) => ({
      id: file.id,
      fileId: file.fileId,
      contentType: file.contentType,
      manifestVersion: file.manifestVersion,
      contentHash: file.contentHash,
      plaintextHash: file.plaintextHash,
      location: file.location,
      embedded: Boolean(file.embeddedJwe),
      metadata: file.metadata,
      objectLinks: {
        shlFile: `shl://${shl.id}/versions/${file.manifestVersion ?? manifestVersion}/files/${file.fileId}`,
        manifest: shl.manifestUrl,
        sourceBundle: shl.sourceBundleHash ? `Bundle/${shl.sourceBundleHash}` : undefined,
      },
    })),
  };
}

function doc(
  documentType: string,
  title: string,
  category: string,
  fhirResource: string,
  sourceRole: string,
  vcType?: string,
): DocumentTemplate {
  return { documentType, title, category, fhirResource, sourceRole, vcType };
}
