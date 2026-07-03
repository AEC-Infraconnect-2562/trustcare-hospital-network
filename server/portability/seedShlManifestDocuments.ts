/**
 * Seed SHL Manifest Documents
 * 
 * Populates shl_manifest_documents table with real document entries
 * for each active SHL package based on its context/purpose.
 * 
 * Use cases per handoff:
 * 1. medical_tourist: passport, patient summary, quotation, guarantee letter, visa support
 * 2. e_claim/insurance: coverage eligibility, claim package, invoice, receipt, medical certificate
 * 3. referral/cross_branch_referral: referral doc, patient summary, lab result, diagnostic report, consent receipt
 * 4. cross_border: referral doc, bilingual summary, consent receipt, travel identity
 * 5. emergency: patient identity, allergy alerts, medications, critical conditions
 * 6. treatment/OPD: patient identity, patient summary, medications, allergies
 * 7. self_share: patient identity, patient summary, medications, allergies, conditions
 */

import { InsertShlManifestDocument } from "../../drizzle/schema";

// Document templates by context
export const MANIFEST_DOCUMENT_TEMPLATES: Record<string, Array<{
  documentType: string;
  title: string;
  category: string;
  sourceRole: string;
  fhirResource: string;
}>> = {
  medical_tourist: [
    { documentType: "passport_identity", title: "Passport / Travel Identity", category: "identity", sourceRole: "patient_wallet", fhirResource: "Patient" },
    { documentType: "patient_summary", title: "International Patient Summary (IPS)", category: "clinical", sourceRole: "hospital_ehr", fhirResource: "Bundle" },
    { documentType: "treatment_quotation", title: "Treatment Quotation", category: "financial", sourceRole: "hospital_billing", fhirResource: "Claim" },
    { documentType: "guarantee_letter", title: "Letter of Guarantee", category: "financial", sourceRole: "payer_system", fhirResource: "CoverageEligibilityResponse" },
    { documentType: "visa_support_letter", title: "Visa Support Letter (Medical)", category: "administrative", sourceRole: "hospital_admin", fhirResource: "DocumentReference" },
  ],
  e_claim: [
    { documentType: "coverage_eligibility", title: "Coverage Eligibility Response", category: "financial", sourceRole: "payer_system", fhirResource: "CoverageEligibilityResponse" },
    { documentType: "claim_package", title: "Claim Package (16 แฟ้ม)", category: "financial", sourceRole: "hospital_billing", fhirResource: "Bundle" },
    { documentType: "invoice", title: "Invoice / Charge Items", category: "financial", sourceRole: "hospital_billing", fhirResource: "Invoice" },
    { documentType: "receipt", title: "Payment Receipt", category: "financial", sourceRole: "hospital_billing", fhirResource: "PaymentReconciliation" },
    { documentType: "medical_certificate", title: "Medical Certificate", category: "clinical", sourceRole: "attending_physician", fhirResource: "DocumentReference" },
  ],
  cross_branch_referral: [
    { documentType: "referral_document", title: "Referral Document (ใบส่งตัว)", category: "clinical", sourceRole: "referring_physician", fhirResource: "ServiceRequest" },
    { documentType: "patient_summary", title: "Patient Summary (สรุปผู้ป่วย)", category: "clinical", sourceRole: "hospital_ehr", fhirResource: "Bundle" },
    { documentType: "lab_result", title: "Laboratory Results", category: "diagnostic", sourceRole: "laboratory", fhirResource: "DiagnosticReport" },
    { documentType: "diagnostic_report", title: "Diagnostic Report (Imaging)", category: "diagnostic", sourceRole: "radiology", fhirResource: "DiagnosticReport" },
    { documentType: "consent_receipt", title: "Consent Receipt (ยินยอมส่งต่อ)", category: "consent", sourceRole: "patient_wallet", fhirResource: "Consent" },
  ],
  cross_border: [
    { documentType: "referral_document", title: "International Referral Document", category: "clinical", sourceRole: "referring_physician", fhirResource: "ServiceRequest" },
    { documentType: "bilingual_summary", title: "Bilingual Patient Summary (TH/EN)", category: "clinical", sourceRole: "hospital_ehr", fhirResource: "Bundle" },
    { documentType: "consent_receipt", title: "Cross-Border Consent Receipt", category: "consent", sourceRole: "patient_wallet", fhirResource: "Consent" },
    { documentType: "travel_identity", title: "Travel Identity Document", category: "identity", sourceRole: "patient_wallet", fhirResource: "Patient" },
  ],
  emergency: [
    { documentType: "patient_identity", title: "Patient Identity Card", category: "identity", sourceRole: "patient_wallet", fhirResource: "Patient" },
    { documentType: "allergy_alerts", title: "Allergy Alert List", category: "clinical", sourceRole: "hospital_ehr", fhirResource: "AllergyIntolerance" },
    { documentType: "medications", title: "Current Medications", category: "clinical", sourceRole: "hospital_ehr", fhirResource: "MedicationStatement" },
    { documentType: "critical_conditions", title: "Critical Conditions (โรคประจำตัว)", category: "clinical", sourceRole: "hospital_ehr", fhirResource: "Condition" },
  ],
  treatment: [
    { documentType: "patient_identity", title: "Patient Identity Card", category: "identity", sourceRole: "patient_wallet", fhirResource: "Patient" },
    { documentType: "patient_summary", title: "Patient Summary", category: "clinical", sourceRole: "hospital_ehr", fhirResource: "Bundle" },
    { documentType: "medications", title: "Current Medications", category: "clinical", sourceRole: "hospital_ehr", fhirResource: "MedicationStatement" },
    { documentType: "allergies", title: "Allergy List", category: "clinical", sourceRole: "hospital_ehr", fhirResource: "AllergyIntolerance" },
  ],
  self_share: [
    { documentType: "patient_identity", title: "Patient Identity Card", category: "identity", sourceRole: "patient_wallet", fhirResource: "Patient" },
    { documentType: "patient_summary", title: "Patient Summary", category: "clinical", sourceRole: "hospital_ehr", fhirResource: "Bundle" },
    { documentType: "medications", title: "Current Medications", category: "clinical", sourceRole: "hospital_ehr", fhirResource: "MedicationStatement" },
    { documentType: "allergies", title: "Allergy List", category: "clinical", sourceRole: "hospital_ehr", fhirResource: "AllergyIntolerance" },
    { documentType: "conditions", title: "Active Conditions", category: "clinical", sourceRole: "hospital_ehr", fhirResource: "Condition" },
  ],
};

/**
 * Generate manifest document rows for a given SHL
 */
export function generateManifestDocuments(shl: {
  id: number;
  context: string | null;
  purpose: string;
  currentManifestVersion: number | null;
  manifestCredentialId: string | null;
  presentationId: string | null;
  sourceBundleHash: string | null;
}): InsertShlManifestDocument[] {
  const context = shl.context || shl.purpose;
  const templates = MANIFEST_DOCUMENT_TEMPLATES[context] || MANIFEST_DOCUMENT_TEMPLATES["treatment"];
  const manifestVersion = shl.currentManifestVersion ?? 1;
  
  return templates.map((tmpl, idx) => {
    const documentId = `doc-${shl.id}-${tmpl.documentType}-v${manifestVersion}`;
    const contentHash = `sha256:${Buffer.from(`${shl.id}-${tmpl.documentType}-${manifestVersion}`).toString("hex").slice(0, 64)}`;
    const plaintextHash = `sha256:${Buffer.from(`plain-${shl.id}-${tmpl.documentType}`).toString("hex").slice(0, 64)}`;
    
    return {
      shlId: shl.id,
      manifestVersion,
      documentId,
      sequence: idx + 1,
      documentType: tmpl.documentType,
      title: tmpl.title,
      category: tmpl.category,
      status: "current",
      sourceRole: tmpl.sourceRole,
      fhirResource: tmpl.fhirResource,
      fhirDocumentReferenceId: `DocumentReference/${shl.id}-${tmpl.documentType}`,
      shlFileId: `file-${shl.id}-${idx + 1}`,
      contentHash,
      plaintextHash,
      sourceBundleHash: shl.sourceBundleHash || `Bundle/shl-${shl.id}-source`,
      manifestCredentialId: shl.manifestCredentialId || `vc:shl-manifest:${shl.id}`,
      presentationId: shl.presentationId || `vp:shl-presentation:${shl.id}`,
      objectLinksJson: {
        shlFile: `shl://${shl.id}/versions/${manifestVersion}/files/file-${shl.id}-${idx + 1}`,
        fhirDocumentReference: `DocumentReference/${shl.id}-${tmpl.documentType}`,
        fhirBundle: `Bundle/shl-${shl.id}-source`,
        manifest: `shl://${shl.id}/manifest`,
      },
      vcBindingJson: {
        manifestCredentialId: shl.manifestCredentialId || `vc:shl-manifest:${shl.id}`,
        presentationId: shl.presentationId || `vp:shl-presentation:${shl.id}`,
        issuer: `did:web:trustcare.network:hospitals`,
        issuanceDate: new Date().toISOString(),
        credentialType: ["VerifiableCredential", "SHLManifestCredential"],
        proofType: "Ed25519Signature2020",
      },
      accessBindingJson: {
        requiresPasscode: false,
        maxAccessCount: null,
        expiresAt: null,
        accessPolicy: "open_link",
        auditLogEnabled: true,
      },
    };
  });
}
