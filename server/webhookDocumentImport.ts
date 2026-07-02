/**
 * Document Request Import Flow - Webhook Handler
 * 
 * External HIS/LIS/RIS/PACS systems call this webhook to:
 * 1. Import a document (status: requested → imported)
 * 2. Convert an imported document to a VC (status: imported → converted_to_vc)
 * 
 * Security: HMAC-SHA256 signature verification on every request.
 * Header: X-Webhook-Signature = HMAC-SHA256(body, secret)
 */
import type { Request, Response } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import * as db from "./db";
import { issueCredential } from "./portability";
import { nanoid } from "nanoid";

// Webhook secret for HMAC verification (configurable per integration)
const WEBHOOK_SECRET = process.env.WEBHOOK_DOCUMENT_IMPORT_SECRET || "trustcare-webhook-default-secret-change-me";

// Map document types from external systems to VC credential types
const DOCUMENT_TYPE_TO_CREDENTIAL_TYPE: Record<string, string> = {
  // Clinical
  allergy: "allergy_alert",
  allergy_alert: "allergy_alert",
  medication: "medication_summary",
  medication_summary: "medication_summary",
  patient_summary: "patient_summary",
  lab_result: "lab_result",
  diagnostic_report: "diagnostic_report",
  discharge_summary: "discharge_summary",
  medical_certificate: "medical_certificate",
  immunization: "immunization",
  // Pharmacy
  prescription: "prescription",
  pharmacy_dispense: "pharmacy_dispense",
  // Identity & Access
  identity: "patient_identity",
  patient_identity: "patient_identity",
  consent: "consent_receipt",
  consent_receipt: "consent_receipt",
  // Care Transition
  referral: "referral_vc",
  referral_vc: "referral_vc",
  // Claims & Finance
  coverage: "insurance_eligibility",
  insurance_eligibility: "insurance_eligibility",
  claim: "claim_package",
  claim_package: "claim_package",
  claim_receipt: "claim_receipt",
  // Medical Tourism
  quotation: "quotation",
  guarantee_letter: "guarantee_letter",
  visa_support_letter: "visa_support_letter",
  travel_document: "travel_document_verification",
};

// Map document types to wallet card types
const DOCUMENT_TYPE_TO_CARD_TYPE: Record<string, string> = {
  allergy: "allergy",
  allergy_alert: "allergy",
  medication: "medication",
  medication_summary: "medication",
  patient_summary: "patient_summary",
  lab_result: "lab_result",
  diagnostic_report: "diagnostic_report",
  discharge_summary: "discharge_summary",
  medical_certificate: "medical_certificate",
  immunization: "immunization",
  prescription: "prescription",
  pharmacy_dispense: "pharmacy_dispense",
  identity: "identity",
  patient_identity: "identity",
  consent: "consent",
  consent_receipt: "consent",
  referral: "referral",
  referral_vc: "referral",
  coverage: "coverage",
  insurance_eligibility: "coverage",
  claim: "claim",
  claim_package: "claim",
  claim_receipt: "claim",
  quotation: "quotation",
  guarantee_letter: "guarantee_letter",
  visa_support_letter: "visa_support_letter",
  travel_document: "travel_document",
};

// Card color by category
const CARD_COLORS: Record<string, string> = {
  identity: "#1e40af",
  allergy: "#dc2626",
  medication: "#7c3aed",
  patient_summary: "#059669",
  lab_result: "#0891b2",
  diagnostic_report: "#0891b2",
  discharge_summary: "#059669",
  medical_certificate: "#059669",
  immunization: "#16a34a",
  prescription: "#7c3aed",
  pharmacy_dispense: "#7c3aed",
  consent: "#6366f1",
  referral: "#ea580c",
  coverage: "#ca8a04",
  claim: "#ca8a04",
  quotation: "#0d9488",
  guarantee_letter: "#0d9488",
  visa_support_letter: "#0d9488",
  travel_document: "#0d9488",
};

export interface WebhookImportPayload {
  /** The wallet document request ID (wdr_xxx) */
  requestId: string;
  /** Action: "import" (raw document) or "convert" (auto-issue VC) */
  action: "import" | "convert";
  /** Document payload from the external system */
  document?: {
    /** Display name for the document */
    displayName?: string;
    displayNameEn?: string;
    /** FHIR resource or structured clinical data */
    data?: Record<string, any>;
    /** Source system identifier */
    sourceSystemId?: string;
    /** Optional: issuer hospital code (TCC, TCP, TCM) */
    issuerHospitalCode?: string;
    /** Optional: issuer hospital name */
    issuerHospitalName?: string;
    /** Optional: document category */
    category?: string;
  };
  /** Optional notes from the source system */
  notes?: string;
  /** Optional: rejection reason (when action would be "reject") */
  rejectionReason?: string;
}

export interface WebhookRejectPayload {
  requestId: string;
  action: "reject";
  rejectionReason: string;
  notes?: string;
}

export type WebhookPayload = WebhookImportPayload | WebhookRejectPayload;

/**
 * Verify HMAC-SHA256 signature from the webhook request
 */
export function verifyWebhookSignature(body: string, signature: string, secret: string = WEBHOOK_SECRET): boolean {
  if (!signature) return false;
  try {
    const expected = createHmac("sha256", secret).update(body).digest("hex");
    const sigBuffer = Buffer.from(signature, "hex");
    const expectedBuffer = Buffer.from(expected, "hex");
    if (sigBuffer.length !== expectedBuffer.length) return false;
    return timingSafeEqual(sigBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

/**
 * Main webhook handler for document import
 */
export async function handleDocumentImportWebhook(req: Request, res: Response) {
  try {
    // 1. Verify signature
    const signature = req.headers["x-webhook-signature"] as string;
    const rawBody = JSON.stringify(req.body);
    if (!verifyWebhookSignature(rawBody, signature)) {
      return res.status(401).json({
        error: "Invalid webhook signature",
        code: "INVALID_SIGNATURE",
      });
    }

    const payload = req.body as WebhookPayload;

    // 2. Validate required fields
    if (!payload.requestId || !payload.action) {
      return res.status(400).json({
        error: "Missing required fields: requestId, action",
        code: "INVALID_PAYLOAD",
      });
    }

    // 3. Look up the document request
    const request = await db.getWalletDocumentRequestByRequestId(payload.requestId);
    if (!request) {
      return res.status(404).json({
        error: `Document request not found: ${payload.requestId}`,
        code: "REQUEST_NOT_FOUND",
      });
    }

    // 4. Handle rejection
    if (payload.action === "reject") {
      if (request.status !== "requested") {
        return res.status(409).json({
          error: `Cannot reject request in status: ${request.status}. Expected: requested`,
          code: "INVALID_STATUS_TRANSITION",
        });
      }
      await db.updateWalletDocumentRequestStatus(request.id, "rejected", {
        rejectionReason: (payload as WebhookRejectPayload).rejectionReason,
        notes: payload.notes,
        rejectedAt: new Date().toISOString(),
      });
      await db.createAuditEvent({
        action: "webhook.document_request.rejected",
        resourceType: "wallet_document_request",
        resourceId: String(request.id),
        details: { requestId: payload.requestId, reason: (payload as WebhookRejectPayload).rejectionReason },
      });
      // Notify patient
      await db.createNotification({
        userId: request.patientId,
        type: "system",
        title: "เอกสารถูกปฏิเสธ",
        message: `คำขอเอกสาร ${request.documentType} ถูกปฏิเสธ: ${(payload as WebhookRejectPayload).rejectionReason}`,
        metadata: { requestId: payload.requestId, documentType: request.documentType, subType: "document_rejected" },
      });
      return res.json({
        success: true,
        requestId: payload.requestId,
        newStatus: "rejected",
      });
    }

    // 5. Handle import
    if (payload.action === "import") {
      if (request.status !== "requested") {
        return res.status(409).json({
          error: `Cannot import to request in status: ${request.status}. Expected: requested`,
          code: "INVALID_STATUS_TRANSITION",
        });
      }
      const importPayload = payload as WebhookImportPayload;
      await db.updateWalletDocumentRequestStatus(request.id, "imported", {
        notes: importPayload.notes,
        importedAt: new Date().toISOString(),
        importedDocument: importPayload.document,
        sourceSystemId: importPayload.document?.sourceSystemId,
      });
      await db.createAuditEvent({
        action: "webhook.document_request.imported",
        resourceType: "wallet_document_request",
        resourceId: String(request.id),
        details: { requestId: payload.requestId, documentType: request.documentType, sourceSystemId: importPayload.document?.sourceSystemId },
      });
      // Notify patient
      await db.createNotification({
        userId: request.patientId,
        type: "system",
        title: "นำเข้าเอกสารสำเร็จ",
        message: `เอกสาร ${request.documentType} ถูกนำเข้าจาก ${request.sourceName || "ระบบภายนอก"} แล้ว`,
        metadata: { requestId: payload.requestId, documentType: request.documentType, subType: "document_imported" },
      });
      return res.json({
        success: true,
        requestId: payload.requestId,
        newStatus: "imported",
      });
    }

    // 6. Handle convert (import + auto-issue VC + create wallet card)
    if (payload.action === "convert") {
      const importPayload = payload as WebhookImportPayload;
      // Allow convert from "requested" (direct) or "imported" (two-step)
      if (request.status !== "requested" && request.status !== "imported") {
        return res.status(409).json({
          error: `Cannot convert request in status: ${request.status}. Expected: requested or imported`,
          code: "INVALID_STATUS_TRANSITION",
        });
      }

      // Resolve credential type
      const credentialType = DOCUMENT_TYPE_TO_CREDENTIAL_TYPE[request.documentType] || "patient_summary";
      const cardType = DOCUMENT_TYPE_TO_CARD_TYPE[request.documentType] || "patient_summary";

      // Resolve issuer hospital
      const hospitals = await db.listHospitals();
      let issuerHospital = hospitals.find((h: any) => h.code === importPayload.document?.issuerHospitalCode);
      if (!issuerHospital) issuerHospital = hospitals[0]; // Default to first hospital

      // Issue the VC
      const credentialId = `urn:uuid:${nanoid(32)}`;
      const claims = importPayload.document?.data || {
        documentType: request.documentType,
        importedFrom: request.sourceName || "External system",
        importedAt: new Date().toISOString(),
      };

      const issuedVc = await issueCredential({
        type: credentialType as any,
        issuer: {
          id: String(issuerHospital?.id || 1),
          did: issuerHospital?.did || "did:web:trustcare.network",
          name: issuerHospital?.name || "TrustCare Network",
        },
        subjectId: String(request.patientId),
        subjectDid: `did:key:patient:${request.patientId}`,
        claims,
        credentialId,
        validDays: 365,
      });

      // Store the issued credential
      const issuedCredId = await db.createIssuedCredential({
        credentialId: issuedVc.id,
        templateId: 1,
        issuerId: issuerHospital?.id || 1,
        issuerHospitalId: issuerHospital?.id || 1,
        subjectId: request.patientId,
        type: credentialType as any,
        status: "active",
        credentialData: claims,
        sdJwtVc: issuedVc.jwt,
        documentCategory: importPayload.document?.category || request.documentCategory || "clinical_summary",
        issuedAt: new Date(),
        expiresAt: issuedVc.expiresAt ? new Date(issuedVc.expiresAt) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      } as any);

      // Create wallet card
      const walletCardId = await db.createWalletCard({
        patientId: request.patientId,
        credentialId: issuedCredId!,
        cardType: cardType as any,
        displayName: importPayload.document?.displayName || `${request.documentType} (นำเข้าจาก ${request.sourceName || "ระบบภายนอก"})`,
        displayNameEn: importPayload.document?.displayNameEn || `${request.documentType} (imported from ${request.sourceName || "external system"})`,
        issuerHospitalName: importPayload.document?.issuerHospitalName || issuerHospital?.name,
        documentCategory: importPayload.document?.category || request.documentCategory,
        cardColor: CARD_COLORS[cardType] || "#2563eb",
      } as any);

      // Update request status to converted_to_vc
      await db.updateWalletDocumentRequestStatus(request.id, "converted_to_vc", {
        notes: importPayload.notes,
        importedAt: new Date().toISOString(),
        convertedAt: new Date().toISOString(),
        convertedCredentialId: issuedCredId,
        convertedWalletCardId: walletCardId,
        sourceSystemId: importPayload.document?.sourceSystemId,
      });

      await db.createAuditEvent({
        action: "webhook.document_request.converted_to_vc",
        resourceType: "wallet_document_request",
        resourceId: String(request.id),
        details: {
          requestId: payload.requestId,
          documentType: request.documentType,
          credentialId: issuedVc.id,
          walletCardId,
          credentialType,
        },
      });

      // Notify patient
      await db.createNotification({
        userId: request.patientId,
        type: "system",
        title: "เอกสารถูกแปลงเป็น VC สำเร็จ",
        message: `เอกสาร ${request.documentType} ถูกนำเข้าและออกเป็นใบรับรองดิจิทัลในกระเป๋าสุขภาพของคุณแล้ว`,
        metadata: { requestId: payload.requestId, documentType: request.documentType, walletCardId, subType: "document_converted" },
      });

      return res.json({
        success: true,
        requestId: payload.requestId,
        newStatus: "converted_to_vc",
        credentialId: issuedVc.id,
        walletCardId,
      });
    }

    return res.status(400).json({
      error: `Unknown action: ${payload.action}. Supported: import, convert, reject`,
      code: "UNKNOWN_ACTION",
    });
  } catch (err: any) {
    console.error("[Webhook] Document import error:", err.message, err.stack);
    return res.status(500).json({
      error: "Internal server error during document import",
      code: "INTERNAL_ERROR",
      message: err.message,
    });
  }
}

/**
 * Webhook configuration endpoint - list registered integrations
 */
export async function handleWebhookConfigList(req: Request, res: Response) {
  // Return webhook configuration info for integration engineers
  return res.json({
    endpoint: "/api/webhook/document-import",
    method: "POST",
    security: "HMAC-SHA256 (X-Webhook-Signature header)",
    supportedActions: ["import", "convert", "reject"],
    payloadSchema: {
      requestId: "string (required) - The wallet document request ID (wdr_xxx)",
      action: "string (required) - One of: import, convert, reject",
      document: {
        displayName: "string (optional) - Display name for the document",
        displayNameEn: "string (optional) - English display name",
        data: "object (optional) - FHIR resource or structured clinical data",
        sourceSystemId: "string (optional) - Source system identifier",
        issuerHospitalCode: "string (optional) - TCC, TCP, or TCM",
        issuerHospitalName: "string (optional) - Issuer hospital name",
        category: "string (optional) - Document category",
      },
      rejectionReason: "string (required for reject action)",
      notes: "string (optional) - Notes from the source system",
    },
    statusTransitions: {
      import: "requested → imported",
      convert: "requested|imported → converted_to_vc",
      reject: "requested → rejected",
    },
  });
}
