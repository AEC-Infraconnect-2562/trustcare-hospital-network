import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import { nanoid } from "nanoid";
import { notifyOwner } from "./_core/notification";
import {
  canonicalizeHisPayload,
  buildTrustRegistryPolicy,
  canonicalizeReviewedDraft,
  createPortabilityPacket,
  createSyncBackPlan,
  didKeyDocument,
  didWebDocument,
  documentStorageMetadata,
  executeSyncBackPlan,
  generateTrustcareDemoSeed,
  hospitalDidWeb,
  issueMedicalCertificateVc,
  issueCredential,
  issuePrescriptionVc,
  issueSyncReceiptVc,
  localIssuerJwks,
  patientDidKey,
  productionReadinessChecks,
  reseedTrustcareVcVpDatabase,
  reviewCsvForCanonicalMapping,
  RECOMMENDED_SYNC_TARGETS,
  sourceTruthConnectors,
  standardLabelCatalog,
  syncAdapterManifest,
  verifyCredential,
  verifyJsonPresentation,
  verifyPresentation,
} from "./portability";
import { sha256 } from "./portability/utils";

const credentialTypeValues = [
  "patient_identity", "consent_receipt", "patient_summary", "allergy_alert", "medication_summary", "referral_vc", "immunization",
  "medical_certificate", "prescription", "lab_result", "diagnostic_report", "discharge_summary", "insurance_eligibility",
  "claim_package", "claim_receipt", "travel_document_verification", "shl_manifest", "pharmacy_dispense", "appointment",
  "visa_support_letter", "quotation", "guarantee_letter", "mpi_link_certificate", "sync_receipt",
] as const;

const trustcareCredentialTypeValues = [
  "PatientIdentityCredential", "ConsentReceiptCredential", "PatientSummaryCredential", "AllergyAlertCredential",
  "MedicationSummaryCredential", "ReferralCredential", "ImmunizationCredential", "CoverageEligibilityCredential", "MedicalCertificateCredential",
  "PrescriptionCredential", "LabResultCredential", "DiagnosticReportCredential", "DischargeSummaryCredential",
  "ClaimPackageCredential", "ClaimReceiptCredential", "TravelDocumentVerificationCredential", "ShlManifestCredential",
  "PharmacyDispenseCredential", "AppointmentCredential", "VisaSupportLetterCredential", "QuotationCredential",
  "GuaranteeLetterCredential", "MpiLinkCertificateCredential", "SyncReceiptCredential",
] as const;

// Admin-only guard
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin" && (ctx.user as any).systemRole !== "system_admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(async (opts) => {
      if (!opts.ctx.user) return null;
      const additionalRoles = await db.getUserAdditionalRoles(opts.ctx.user.id);
      const activeRoleCookie = opts.ctx.req.cookies?.["trustcare_active_role"];
      return { ...opts.ctx.user, additionalRoles: additionalRoles.map(r => r.role), activeRole: activeRoleCookie || (opts.ctx.user as any).systemRole || "patient" };
    }),
    getDemoUsers: publicProcedure.query(async () => {
      return db.getDemoUsers();
    }),
    switchRole: protectedProcedure.input(z.object({ role: z.string() })).mutation(async ({ ctx, input }) => {
      const user = ctx.user as any;
      const additionalRoles = await db.getUserAdditionalRoles(ctx.user.id);
      const allRoles = [user.systemRole, "patient", ...additionalRoles.map((r: any) => r.role)];
      if (!allRoles.includes(input.role)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "ไม่สามารถสลับไปบทบาทนี้ได้" });
      }
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie("trustcare_active_role", input.role, { ...cookieOptions, maxAge: 86400000 });
      return { success: true, activeRole: input.role };
    }),
    getAvailableRoles: protectedProcedure.query(async ({ ctx }) => {
      const user = ctx.user as any;
      const additionalRoles = await db.getUserAdditionalRoles(ctx.user.id);
      const roles = new Set([user.systemRole, "patient", ...additionalRoles.map((r: any) => r.role)]);
      return Array.from(roles);
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      ctx.res.clearCookie("trustcare_active_role", { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    updateProfile: protectedProcedure.input(z.object({
      name: z.string().optional(),
      phone: z.string().optional(),
      preferredLanguage: z.enum(["th", "en"]).optional(),
    })).mutation(async ({ ctx, input }) => {
      await db.updateUserProfile(ctx.user.id, input as any);
      return { success: true };
    }),
  }),
  // ============================================================
  // SEED
  // ============================================================
  seed: router({
    run: publicProcedure.mutation(async () => {
      const { seedDatabase } = await import("./seed");
      await seedDatabase();
      return { success: true };
    }),
  }),
  // ============================================================
  // MAKER/CHECKER WORKFLOW (v2.2)
  // ============================================================
  makerChecker: router({
    myRequests: protectedProcedure.query(async ({ ctx }) => {
      return db.listCredentialRequests({ requesterId: ctx.user.id });
    }),
    pendingReviews: protectedProcedure.query(async ({ ctx }) => {
      const user = ctx.user as any;
      if (user.systemRole !== "checker" && user.systemRole !== "system_admin" && user.systemRole !== "hospital_admin") {
        const additionalRoles = await db.getUserAdditionalRoles(ctx.user.id);
        if (!additionalRoles.some(r => r.role === "issuer_checker")) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Checker role required" });
        }
      }
      return db.listCredentialRequests({ status: "pending_review" });
    }),
    myReviews: protectedProcedure.query(async ({ ctx }) => {
      return db.listCredentialRequests({ reviewerId: ctx.user.id });
    }),
    pendingCount: protectedProcedure.query(async () => {
      const pending = await db.listCredentialRequests({ status: "pending_review" });
      return pending.length;
    }),
    createRequest: protectedProcedure.input(z.object({
      templateId: z.number().optional(),
      patientId: z.number(),
      hospitalId: z.number(),
      credentialType: z.string(),
      requestData: z.any().optional(),
      priority: z.enum(["normal", "urgent"]).optional(),
      makerNotes: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const result = await db.createCredentialRequest({
        requesterId: ctx.user.id,
        templateId: input.templateId ?? null,
        patientId: input.patientId,
        hospitalId: input.hospitalId,
        credentialType: input.credentialType,
        status: "draft",
        requestData: input.requestData,
        priority: input.priority ?? "normal",
        makerNotes: input.makerNotes,
      });
      await db.createNotification({
        userId: ctx.user.id,
        type: "vc_request_created" as any,
        title: "สร้างคำขอ VC ใหม่",
        message: `สร้างคำขอ ${input.credentialType} สำเร็จ`,
      });
      return result;
    }),
    submitForReview: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      const request = await db.getCredentialRequestById(input.id);
      if (!request) throw new TRPCError({ code: "NOT_FOUND" });
      if (request.requesterId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      await db.updateCredentialRequest(input.id, { status: "pending_review" });
      await db.createNotification({
        userId: ctx.user.id,
        type: "vc_submitted_for_review" as any,
        title: "ส่งคำขอตรวจสอบ",
        message: `คำขอ #${input.id} ถูกส่งตรวจสอบแล้ว`,
      });
      return { success: true };
    }),
    cancelRequest: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      const request = await db.getCredentialRequestById(input.id);
      if (!request) throw new TRPCError({ code: "NOT_FOUND" });
      if (request.requesterId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      await db.updateCredentialRequest(input.id, { status: "cancelled" });
      return { success: true };
    }),
    approve: protectedProcedure.input(z.object({ id: z.number(), comment: z.string().optional() })).mutation(async ({ ctx, input }) => {
      const request = await db.getCredentialRequestById(input.id);
      if (!request) throw new TRPCError({ code: "NOT_FOUND" });
      if (request.requesterId === ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "ไม่สามารถอนุมัติคำขอตัวเองได้" });
      await db.updateCredentialRequest(input.id, { status: "approved", reviewerId: ctx.user.id, reviewComment: input.comment });
      // Auto-issue VC
      const credential = await db.createIssuedCredential({
        credentialId: `vc-${nanoid(12)}`,
        type: request.credentialType as any,
        subjectId: request.patientId,
        issuerHospitalId: request.hospitalId,
        issuerId: ctx.user.id,
        templateId: request.templateId ?? 0,
        credentialData: request.requestData as any,
        status: "active",
      });
      await db.updateCredentialRequest(input.id, { status: "issued", issuedCredentialId: (credential as any)?.id });
      await db.createNotification({
        userId: request.requesterId,
        type: "vc_approved" as any,
        title: "คำขอ VC ได้รับอนุมัติ",
        message: `คำขอ #${input.id} ได้รับอนุมัติและออก VC แล้ว`,
      });
      return { success: true };
    }),
    reject: protectedProcedure.input(z.object({ id: z.number(), comment: z.string() })).mutation(async ({ ctx, input }) => {
      const request = await db.getCredentialRequestById(input.id);
      if (!request) throw new TRPCError({ code: "NOT_FOUND" });
      await db.updateCredentialRequest(input.id, { status: "rejected", reviewerId: ctx.user.id, reviewComment: input.comment });
      await db.createNotification({
        userId: request.requesterId,
        type: "vc_rejected" as any,
        title: "คำขอ VC ถูกปฏิเสธ",
        message: `คำขอ #${input.id} ถูกปฏิเสธ: ${input.comment}`,
      });
      return { success: true };
    }),
  }),

  // ============================================================
  // HOSPITAL MANAGEMENT
  // ============================================================
  hospital: router({
    list: protectedProcedure.query(async () => {
      return db.listHospitals();
    }),
    getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return db.getHospitalById(input.id);
    }),
    create: adminProcedure.input(z.object({
      name: z.string().min(1),
      nameEn: z.string().optional(),
      code: z.string().min(1),
      address: z.string().optional(),
      province: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
      fhirEndpoint: z.string().optional(),
    })).mutation(async ({ input }) => {
      const did = `did:web:trustcare.network:hospital:${input.code}`;
      const id = await db.createHospital({ ...input, did, status: "active" });
      await db.createAuditEvent({
        action: "hospital.created",
        resourceType: "hospital",
        resourceId: String(id),
        details: { name: input.name, code: input.code },
      });
      await notifyOwner({ title: "โรงพยาบาลใหม่เข้าร่วมเครือข่าย", content: `${input.name} (${input.code}) ได้เข้าร่วมเครือข่าย Trustcare แล้ว` });
      return { id, success: true };
    }),
    update: adminProcedure.input(z.object({
      id: z.number(),
      name: z.string().optional(),
      nameEn: z.string().optional(),
      address: z.string().optional(),
      province: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
      status: z.enum(["active", "inactive", "pending"]).optional(),
      fhirEndpoint: z.string().optional(),
    })).mutation(async ({ input }) => {
      const { id, ...data } = input;
      await db.updateHospital(id, data);
      return { success: true };
    }),
    delete: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await db.deleteHospital(input.id);
      return { success: true };
    }),
    departments: protectedProcedure.input(z.object({ hospitalId: z.number() })).query(async ({ input }) => {
      return db.listDepartments(input.hospitalId);
    }),
    createDepartment: adminProcedure.input(z.object({
      hospitalId: z.number(),
      name: z.string().min(1),
      nameEn: z.string().optional(),
      code: z.string().optional(),
    })).mutation(async ({ input }) => {
      const id = await db.createDepartment(input);
      return { id, success: true };
    }),
  }),

  // ============================================================
  // CREDENTIAL MANAGEMENT (ISSUER)
  // ============================================================
  credential: router({
    templates: protectedProcedure.input(z.object({ hospitalId: z.number().optional() })).query(async ({ input }) => {
      return db.listCredentialTemplates(input.hospitalId);
    }),
    createTemplate: adminProcedure.input(z.object({
      hospitalId: z.number().optional(),
      name: z.string().min(1),
      nameEn: z.string().optional(),
      type: z.enum(credentialTypeValues),
      fhirResourceType: z.string().optional(),
      validityDays: z.number().optional(),
      schema: z.any().optional(),
    })).mutation(async ({ input }) => {
      const id = await db.createCredentialTemplate(input as any);
      return { id, success: true };
    }),
    list: protectedProcedure.input(z.object({
      hospitalId: z.number().optional(),
      subjectId: z.number().optional(),
      type: z.string().optional(),
      status: z.string().optional(),
      documentCategory: z.string().optional(),
    })).query(async ({ input }) => {
      return db.listIssuedCredentials(input);
    }),
    issuanceRequests: protectedProcedure.input(z.object({
      hospitalId: z.number().optional(),
      subjectId: z.number().optional(),
      status: z.string().optional(),
      makerId: z.number().optional(),
      checkerId: z.number().optional(),
      limit: z.number().min(1).max(200).default(100),
    }).optional()).query(async ({ input }) => {
      return db.listCredentialIssuanceRequests(input);
    }),
    submitIssuanceRequest: protectedProcedure.input(z.object({
      templateId: z.number().optional(),
      issuerHospitalId: z.number(),
      subjectId: z.number(),
      type: z.enum(credentialTypeValues),
      holderDid: z.string().optional(),
      issuerDid: z.string().optional(),
      documentData: z.any(),
      canonicalReview: z.any().optional(),
    })).mutation(async ({ ctx, input }) => {
      requireMaker(ctx.user, input.type);
      const request = await submitMakerCredentialRequest({
        maker: ctx.user,
        templateId: input.templateId,
        issuerHospitalId: input.issuerHospitalId,
        subjectId: input.subjectId,
        type: input.type,
        holderDid: input.holderDid,
        issuerDid: input.issuerDid,
        documentData: input.documentData,
        canonicalReview: input.canonicalReview,
      });
      return request;
    }),
    approveIssuanceRequest: protectedProcedure.input(z.object({
      id: z.number(),
      checkerNotes: z.string().optional(),
      audience: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const request = await db.getCredentialIssuanceRequestById(input.id);
      if (!request) throw new TRPCError({ code: "NOT_FOUND", message: "Issuance request not found" });
      requireChecker(ctx.user, String(request.type));
      if (!["submitted", "changes_requested", "approved"].includes(request.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Request status ${request.status} cannot be issued` });
      }
      if (request.checkerId && request.checkerId !== ctx.user.id && request.status === "issued") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Request already issued" });
      }
      const issued = await issueCredentialFromRequest({
        checkerId: ctx.user.id,
        checkerRole: (ctx.user as any).systemRole ?? ctx.user.role,
        request: request as any,
        checkerNotes: input.checkerNotes,
        audience: input.audience,
      });
      return issued;
    }),
    rejectIssuanceRequest: protectedProcedure.input(z.object({
      id: z.number(),
      checkerNotes: z.string().min(1),
    })).mutation(async ({ ctx, input }) => {
      const request = await db.getCredentialIssuanceRequestById(input.id);
      if (!request) throw new TRPCError({ code: "NOT_FOUND", message: "Issuance request not found" });
      requireChecker(ctx.user, String(request.type));
      await db.updateCredentialIssuanceRequest(input.id, {
        status: "rejected",
        checkerId: ctx.user.id,
        checkerRole: (ctx.user as any).systemRole ?? ctx.user.role,
        checkerNotes: input.checkerNotes,
        checkedAt: new Date(),
      } as any);
      await db.createAuditEvent({
        actorId: ctx.user.id,
        actorRole: (ctx.user as any).systemRole,
        hospitalId: request.issuerHospitalId,
        action: "credential.request.rejected",
        resourceType: "credential_issuance_request",
        resourceId: request.requestId,
        details: { type: request.type, reason: input.checkerNotes },
      });
      return { success: true, status: "rejected" };
    }),
    issue: protectedProcedure.input(z.object({
      templateId: z.number().optional(),
      subjectId: z.number(),
      issuerHospitalId: z.number(),
      type: z.enum(credentialTypeValues),
      credentialData: z.any(),
      expiresAt: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      requireMaker(ctx.user, input.type);
      return submitMakerCredentialRequest({
        maker: ctx.user,
        templateId: input.templateId,
        issuerHospitalId: input.issuerHospitalId,
        subjectId: input.subjectId,
        type: input.type,
        documentData: { ...input.credentialData, expiresAt: input.expiresAt },
      });
    }),
    revoke: protectedProcedure.input(z.object({
      id: z.number(),
      reason: z.string().min(1),
    })).mutation(async ({ ctx, input }) => {
      await db.revokeCredential(input.id, input.reason);
      await db.createAuditEvent({
        actorId: ctx.user.id,
        actorRole: (ctx.user as any).systemRole,
        action: "credential.revoked",
        resourceType: "credential",
        resourceId: String(input.id),
        details: { reason: input.reason },
      });
      await notifyOwner({ title: "VC ถูกเพิกถอน", content: `Credential #${input.id} ถูกเพิกถอน เหตุผล: ${input.reason}` });
      return { success: true };
    }),
    getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return db.getCredentialById(input.id);
    }),
  }),

  // ============================================================
  // PATIENT WALLET
  // ============================================================
  wallet: router({
    cards: protectedProcedure.query(async ({ ctx }) => {
      return db.listWalletCards(ctx.user.id);
    }),
    history: protectedProcedure.query(async ({ ctx }) => {
      return db.listPresentationHistory(ctx.user.id);
    }),
    present: protectedProcedure.input(z.object({
      cardId: z.number(),
    })).mutation(async ({ ctx, input }) => {
      const cards = await db.listWalletCards(ctx.user.id);
      const card = cards.find((item: any) => item.id === input.cardId);
      if (!card) throw new TRPCError({ code: "NOT_FOUND", message: "Wallet card not found" });
      const [presentation] = await db.listIssuedPresentations({ patientId: ctx.user.id, status: "active", limit: 1 });
      if (!presentation) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No active verifiable presentation is available for this patient. Issue or reseed a VP first." });
      }
      await db.createAuditEvent({
        actorId: ctx.user.id,
        actorRole: (ctx.user as any).systemRole,
        action: "credential.presented",
        resourceType: "wallet_card",
        resourceId: String(input.cardId),
        details: { presentationId: presentation.presentationId, credentialIds: presentation.credentialIds },
      });
      return {
        presentationId: presentation.presentationId,
        format: "jwt-vp",
        expiresAt: presentation.expiresAt?.toISOString(),
        qrData: presentation.presentationJwt,
      };
    }),
  }),

  // ============================================================
  // VERIFIER
  // ============================================================
  verifier: router({
    verify: publicProcedure.input(z.object({
      token: z.string().optional(),
      vpUrl: z.string().optional(),
    })).mutation(async ({ input }) => {
      const presented = input.vpUrl || input.token;
      if (presented?.trim().startsWith("{")) {
        const presentation = JSON.parse(presented);
        const result = verifyJsonPresentation({ presentation });
        await db.createAuditEvent({
          action: "verifier.vp_json.verified",
          resourceType: "verifiable_presentation",
          resourceId: String(result.presentationId ?? "json-vp"),
          details: { trustLevel: result.trustLevel, verified: result.verified, purpose: result.purpose },
        });
        return {
          trustLevel: result.trustLevel,
          verified: result.verified,
          issuer: "TrustCare JSON VP",
          holderDid: result.holderDid,
          credentials: presentation.verifiableCredential ?? [],
          highPriority: result.highPriority,
          warnings: result.warnings,
          errors: result.errors,
        };
      }
      if (presented?.startsWith("eyJ")) {
        const result = await verifyPresentation({ jwt: presented });
        if (result.verified || result.credentials.length > 0) {
          return {
            trustLevel: result.trustLevel,
            verified: result.verified,
            issuer: result.credentials[0]?.issuer?.name ?? result.credentials[0]?.issuer?.id ?? "Unknown issuer",
            holderDid: result.holderDid,
            credentials: result.credentials,
            warnings: result.warnings,
            errors: result.errors,
          };
        }
        const credentialResult = await verifyCredential({ jwt: presented });
        return {
          trustLevel: credentialResult.trustLevel,
          verified: credentialResult.verified,
          issuer: credentialResult.issuer,
          credential: credentialResult.credential,
          warnings: credentialResult.warnings,
          errors: credentialResult.errors,
        };
      }
      return {
        trustLevel: "red",
        verified: false,
        issuer: "TrustCare Verifier",
        warnings: [],
        errors: [presented ? "Unsupported presentation format. Use JSON VP or JWT VC/VP." : "No token or presentation was supplied."],
      };
    }),
  }),

  // ============================================================
  // CONSENT MANAGEMENT
  // ============================================================
  consent: router({
    policies: protectedProcedure.input(z.object({ hospitalId: z.number().optional() })).query(async ({ input }) => {
      return db.listConsentPolicies(input.hospitalId);
    }),
    createPolicy: adminProcedure.input(z.object({
      hospitalId: z.number().optional(),
      name: z.string().min(1),
      nameEn: z.string().optional(),
      description: z.string().optional(),
      purpose: z.enum(["treatment", "referral", "research", "insurance", "public_health", "emergency"]),
      dataCategories: z.any().optional(),
      retentionDays: z.number().optional(),
      isRequired: z.boolean().optional(),
    })).mutation(async ({ input }) => {
      const id = await db.createConsentPolicy(input as any);
      return { id, success: true };
    }),
    records: protectedProcedure.input(z.object({ patientId: z.number().optional() })).query(async ({ ctx, input }) => {
      const patientId = input.patientId || ctx.user.id;
      return db.listConsentRecords(patientId);
    }),
    grant: protectedProcedure.input(z.object({
      policyId: z.number(),
      grantedToHospitalId: z.number().optional(),
      grantedToDoctorId: z.number().optional(),
      purpose: z.enum(["treatment", "referral", "research", "insurance", "public_health", "emergency"]),
      dataScope: z.any().optional(),
      expiresAt: z.string().optional(),
      isBreakGlass: z.boolean().optional(),
    })).mutation(async ({ ctx, input }) => {
      const id = await db.createConsentRecord({
        patientId: ctx.user.id,
        policyId: input.policyId,
        grantedToHospitalId: input.grantedToHospitalId,
        grantedToDoctorId: input.grantedToDoctorId,
        purpose: input.purpose,
        dataScope: input.dataScope,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
      });
      await db.createAuditEvent({
        actorId: ctx.user.id,
        action: "consent.granted",
        resourceType: "consent",
        resourceId: String(id),
        details: { purpose: input.purpose },
        isBreakGlass: input.isBreakGlass,
      });
      // Notify owner on break-glass emergency access
      if (input.isBreakGlass) {
        await notifyOwner({ title: "\u26a0\ufe0f Break-Glass Emergency Access", content: `User #${ctx.user.id} used break-glass emergency access. Consent #${id}, Purpose: ${input.purpose}` });
      }
      return { id, success: true };
    }),
    revoke: protectedProcedure.input(z.object({
      id: z.number(),
      reason: z.string(),
    })).mutation(async ({ ctx, input }) => {
      await db.revokeConsent(input.id, input.reason);
      await db.createAuditEvent({
        actorId: ctx.user.id,
        action: "consent.revoked",
        resourceType: "consent",
        resourceId: String(input.id),
        details: { reason: input.reason },
      });
      return { success: true };
    }),
  }),

  // ============================================================
  // REFERRAL MANAGEMENT
  // ============================================================
  referral: router({
    list: protectedProcedure.input(z.object({
      fromHospitalId: z.number().optional(),
      toHospitalId: z.number().optional(),
      patientId: z.number().optional(),
      status: z.string().optional(),
    })).query(async ({ input }) => {
      return db.listReferrals(input);
    }),
    getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return db.getReferralById(input.id);
    }),
    create: protectedProcedure.input(z.object({
      patientId: z.number(),
      fromHospitalId: z.number(),
      toHospitalId: z.number(),
      priority: z.enum(["routine", "urgent", "emergency"]).optional(),
      reason: z.string(),
      clinicalNotes: z.string().optional(),
      diagnosis: z.string().optional(),
      icdCode: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const referralCode = `REF-${nanoid(8).toUpperCase()}`;
      const id = await db.createReferral({
        referralCode,
        patientId: input.patientId,
        fromHospitalId: input.fromHospitalId,
        toHospitalId: input.toHospitalId,
        fromDoctorId: ctx.user.id,
        priority: input.priority || "routine",
        reason: input.reason,
        clinicalNotes: input.clinicalNotes,
        diagnosis: input.diagnosis,
        icdCode: input.icdCode,
      });
      await db.createAuditEvent({
        actorId: ctx.user.id,
        hospitalId: input.fromHospitalId,
        action: "referral.created",
        resourceType: "referral",
        resourceId: referralCode,
        details: { toHospitalId: input.toHospitalId, priority: input.priority },
      });
      return { id, referralCode, success: true };
    }),
    updateStatus: protectedProcedure.input(z.object({
      id: z.number(),
      status: z.enum(["accepted", "in_progress", "completed", "replied", "rejected"]),
      responseNotes: z.string().optional(),
      rejectionReason: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const extra: Record<string, unknown> = {};
      if (input.responseNotes) extra.responseNotes = input.responseNotes;
      if (input.rejectionReason) extra.rejectionReason = input.rejectionReason;
      if (input.status === "accepted" || input.status === "in_progress") extra.toDoctorId = ctx.user.id;
      await db.updateReferralStatus(input.id, input.status, extra);
      await db.createAuditEvent({
        actorId: ctx.user.id,
        action: `referral.${input.status}`,
        resourceType: "referral",
        resourceId: String(input.id),
      });
      return { success: true };
    }),
  }),

  // ============================================================
  // FHIR MAPPING
  // ============================================================
  fhir: router({
    mappings: protectedProcedure.input(z.object({ hospitalId: z.number() })).query(async ({ input }) => {
      return db.listFhirMappings(input.hospitalId);
    }),
    createMapping: protectedProcedure.input(z.object({
      hospitalId: z.number(),
      localFieldName: z.string(),
      localFieldPath: z.string().optional(),
      fhirResourceType: z.string(),
      fhirFieldPath: z.string(),
      transformRule: z.string().optional(),
    })).mutation(async ({ input }) => {
      const id = await db.createFhirMapping(input as any);
      return { id, success: true };
    }),
    updateMapping: protectedProcedure.input(z.object({
      id: z.number(),
      localFieldName: z.string().optional(),
      fhirFieldPath: z.string().optional(),
      transformRule: z.string().optional(),
      validationStatus: z.enum(["valid", "invalid", "pending"]).optional(),
    })).mutation(async ({ input }) => {
      const { id, ...data } = input;
      await db.updateFhirMapping(id, data as any);
      return { success: true };
    }),
  }),

  // ============================================================
  // TERMINOLOGY MAPPING
  // ============================================================
  terminology: router({
    list: protectedProcedure.input(z.object({
      hospitalId: z.number().optional(),
      codeSystem: z.string().optional(),
      status: z.string().optional(),
    })).query(async ({ input }) => {
      return db.listTerminologyMappings(input);
    }),
    create: protectedProcedure.input(z.object({
      hospitalId: z.number(),
      localCode: z.string(),
      localDisplay: z.string().optional(),
      codeSystem: z.enum(["icd10", "snomed_ct", "loinc", "tmt", "cvx"]),
      standardCode: z.string().optional(),
      standardDisplay: z.string().optional(),
    })).mutation(async ({ input }) => {
      const id = await db.createTerminologyMapping(input as any);
      return { id, success: true };
    }),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      standardCode: z.string().optional(),
      standardDisplay: z.string().optional(),
      status: z.enum(["pending", "accepted", "rejected"]).optional(),
      confidence: z.number().optional(),
    })).mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      if (input.status === "accepted" || input.status === "rejected") {
        (data as any).reviewedBy = ctx.user.id;
        (data as any).reviewedAt = new Date();
      }
      await db.updateTerminologyMapping(id, data as any);
      return { success: true };
    }),
    suggestMapping: protectedProcedure.input(z.object({
      localCode: z.string(),
      localDisplay: z.string(),
      codeSystem: z.enum(["icd10", "snomed_ct", "loinc", "tmt", "cvx"]),
    })).mutation(async ({ input }) => {
      // LLM-assisted suggestion - uses built-in LLM
      const { invokeLLM } = await import("./_core/llm");
      const systemMap: Record<string, string> = {
        icd10: "ICD-10",
        snomed_ct: "SNOMED CT",
        loinc: "LOINC",
        tmt: "Thai Medicines Terminology (TMT)",
        cvx: "CVX (Vaccine codes)",
      };
      const response = await invokeLLM({
        messages: [
          { role: "system", content: `You are a medical terminology mapping expert. Given a local hospital code and display name, suggest the most appropriate standard code from ${systemMap[input.codeSystem]}. Return JSON with fields: standardCode, standardDisplay, confidence (0-100).` },
          { role: "user", content: `Local code: ${input.localCode}\nLocal display: ${input.localDisplay}\nTarget system: ${systemMap[input.codeSystem]}` },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "terminology_suggestion",
            strict: true,
            schema: {
              type: "object",
              properties: {
                standardCode: { type: "string", description: "The suggested standard code" },
                standardDisplay: { type: "string", description: "The display name for the standard code" },
                confidence: { type: "integer", description: "Confidence score 0-100" },
              },
              required: ["standardCode", "standardDisplay", "confidence"],
              additionalProperties: false,
            },
          },
        },
      });
      const content = response.choices[0].message.content;
      const suggestion = JSON.parse(typeof content === 'string' ? content : '{}');
      return suggestion;
    }),
  }),

  // ============================================================
  // AUDIT TRAIL
  // ============================================================
  audit: router({
    list: protectedProcedure.input(z.object({
      hospitalId: z.number().optional(),
      actorId: z.number().optional(),
      action: z.string().optional(),
      limit: z.number().optional(),
    })).query(async ({ input }) => {
      return db.listAuditEvents(input);
    }),
    export: protectedProcedure.input(z.object({
      hospitalId: z.number().optional(),
      action: z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
    })).query(async ({ input }) => {
      return db.listAuditEvents({ ...input, limit: 10000 });
    }),
    stats: protectedProcedure.query(async () => {
      const events = await db.listAuditEvents({ limit: 1000 });
      const actionCounts: Record<string, number> = {};
      (events || []).forEach((e: any) => { actionCounts[e.action] = (actionCounts[e.action] || 0) + 1; });
      return { total: events?.length || 0, actionCounts };
    }),
  }),

  // ============================================================
  // NOTIFICATIONS
  // ============================================================
  notification: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.listNotifications(ctx.user.id);
    }),
    markRead: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await db.markNotificationRead(input.id);
      return { success: true };
    }),
  }),

  // ============================================================
  // DASHBOARD
  // ============================================================
  dashboard: router({
    stats: protectedProcedure.query(async () => {
      return db.getDashboardStats();
    }),
    recentActivity: protectedProcedure.query(async () => {
      return db.listAuditEvents({ limit: 10 });
    }),
  }),

  // ============================================================
  // USERS MANAGEMENT
  // ============================================================
  users: router({
    list: adminProcedure.input(z.object({
      hospitalId: z.number().optional(),
      systemRole: z.string().optional(),
    })).query(async ({ input }) => {
      return db.listUsers(input);
    }),
    updateRole: adminProcedure.input(z.object({
      id: z.number(),
      systemRole: z.enum(["system_admin", "hospital_admin", "maker", "checker", "doctor", "nurse", "integration_engineer", "patient"]),
      hospitalId: z.number().optional(),
      credentialEntitlements: z.object({
        makerTypes: z.array(z.enum(credentialTypeValues)).optional(),
        checkerTypes: z.array(z.enum(credentialTypeValues)).optional(),
      }).optional(),
    })).mutation(async ({ input }) => {
      await db.updateUserProfile(input.id, {
        systemRole: input.systemRole,
        hospitalId: input.hospitalId,
        credentialEntitlements: input.credentialEntitlements,
      } as any);
      return { success: true };
    }),
  }),

  // ============================================================
  // PATIENT IDENTITY / MPI
  // ============================================================
  patientIdentity: router({
    listIdentifiers: protectedProcedure.input(z.object({ patientId: z.number() })).query(async ({ input }) => {
      return db.listPatientIdentifiers(input.patientId);
    }),
    addIdentifier: protectedProcedure.input(z.object({
      patientId: z.number(),
      hospitalId: z.number().optional(),
      identifierType: z.enum(["thai_id", "passport", "health_id", "hn", "mrn", "carepass_id", "insurance_id"]),
      identifierValue: z.string().min(1),
      issuerOrg: z.string().optional(),
    })).mutation(async ({ input }) => {
      const id = await db.createPatientIdentifier(input as any);
      return { id };
    }),
    listMpiMatches: adminProcedure.input(z.object({ status: z.string().optional() })).query(async ({ input }) => {
      return db.listMpiMatches(input);
    }),
    resolveMpiMatch: adminProcedure.input(z.object({
      id: z.number(),
      matchStatus: z.enum(["confirmed", "rejected"]),
    })).mutation(async ({ ctx, input }) => {
      await db.updateMpiMatch(input.id, { matchStatus: input.matchStatus, reviewedBy: ctx.user.id });
      return { success: true };
    }),
  }),

  // ============================================================
  // INTEGRATION & ADAPTER LAYER
  // ============================================================
  integration: router({
    listAdapters: protectedProcedure.input(z.object({ hospitalId: z.number().optional() })).query(async ({ input }) => {
      return db.listIntegrationAdapters(input.hospitalId);
    }),
    getAdapter: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return db.getIntegrationAdapterById(input.id);
    }),
    createAdapter: adminProcedure.input(z.object({
      hospitalId: z.number(),
      name: z.string().min(1),
      systemType: z.enum(["his", "emr", "lis", "ris", "pacs", "erp", "crm", "claim_system", "legacy_db"]),
      connectorPattern: z.enum(["api_rest", "api_graphql", "hl7v2", "db_view", "cdc", "batch_file", "dicomweb", "portal_adapter"]),
      authMethod: z.enum(["oauth2", "api_key", "mtls", "basic", "vpn", "none"]).optional(),
      connectionConfig: z.any().optional(),
    })).mutation(async ({ input }) => {
      const id = await db.createIntegrationAdapter(input as any);
      await db.createAuditEvent({ action: "adapter.created", resourceType: "integration_adapter", resourceId: String(id), details: { name: input.name } });
      return { id };
    }),
    updateAdapter: adminProcedure.input(z.object({
      id: z.number(),
      status: z.enum(["active", "inactive", "testing", "error"]).optional(),
      connectionConfig: z.any().optional(),
      name: z.string().optional(),
    })).mutation(async ({ input }) => {
      const { id, ...data } = input;
      await db.updateIntegrationAdapter(id, data as any);
      return { success: true };
    }),
    testConnection: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      const adapter = await db.getIntegrationAdapterById(input.id);
      if (!adapter) throw new TRPCError({ code: "NOT_FOUND" });
      const config = adapter.connectionConfig as Record<string, unknown> | null | undefined;
      const health = evaluateAdapterHealth(adapter as any, config);
      await db.createAdapterHealthLog({
        adapterId: input.id,
        status: health.healthy ? "healthy" : "degraded",
        responseTimeMs: health.responseTimeMs,
        errorMessage: health.errorMessage,
      });
      await db.updateIntegrationAdapter(input.id, {
        healthStatus: health.healthy ? "healthy" : "degraded",
        lastHealthCheck: new Date(),
      } as any);
      return health;
    }),
    healthLogs: protectedProcedure.input(z.object({ adapterId: z.number() })).query(async ({ input }) => {
      return db.listAdapterHealthLogs(input.adapterId);
    }),
    listMappingVersions: protectedProcedure.input(z.object({ adapterId: z.number() })).query(async ({ input }) => {
      return db.listMappingVersions(input.adapterId);
    }),
    createMappingVersion: adminProcedure.input(z.object({
      adapterId: z.number(),
      resourceType: z.string().min(1),
      version: z.string().min(1),
      mappingConfig: z.any().optional(),
    })).mutation(async ({ input }) => {
      const id = await db.createMappingVersion(input as any);
      return { id };
    }),
    publishMappingVersion: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await db.updateMappingVersion(input.id, { status: "published", publishedAt: new Date() } as any);
      return { success: true };
    }),
    listEvents: protectedProcedure.input(z.object({
      adapterId: z.number().optional(),
      status: z.string().optional(),
      limit: z.number().optional(),
    })).query(async ({ input }) => {
      return db.listIntegrationEvents(input);
    }),
  }),

  // ============================================================
  // TRUST REGISTRY
  // ============================================================
  trustRegistry: router({
    list: protectedProcedure.input(z.object({
      entityType: z.string().optional(),
      isActive: z.boolean().optional(),
    })).query(async ({ input }) => {
      return db.listTrustRegistry(input);
    }),
    create: adminProcedure.input(z.object({
      entityType: z.enum(["issuer", "verifier", "provider", "payer", "partner_hospital", "foreign_hospital"]),
      entityName: z.string().min(1),
      entityNameEn: z.string().optional(),
      did: z.string().optional(),
      publicKeyJwk: z.any().optional(),
      x509Certificate: z.string().optional(),
      country: z.string().optional(),
      jurisdiction: z.string().optional(),
      credentialTypes: z.any().optional(),
      contactEmail: z.string().optional(),
      contactUrl: z.string().optional(),
      metadata: z.any().optional(),
    })).mutation(async ({ input }) => {
      const id = await db.createTrustRegistryEntry(input as any);
      await db.createAuditEvent({ action: "trust_registry.created", resourceType: "trust_registry", resourceId: String(id), details: { entityName: input.entityName } });
      return { id };
    }),
    update: adminProcedure.input(z.object({
      id: z.number(),
      trustLevel: z.enum(["verified", "self_declared", "pending", "revoked"]).optional(),
      isActive: z.boolean().optional(),
      did: z.string().optional(),
      publicKeyJwk: z.any().optional(),
      x509Certificate: z.string().optional(),
      contactEmail: z.string().optional(),
      credentialTypes: z.any().optional(),
      metadata: z.any().optional(),
    })).mutation(async ({ input }) => {
      const { id, ...data } = input;
      await db.updateTrustRegistryEntry(id, data as any);
      return { success: true };
    }),
    verify: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      await db.updateTrustRegistryEntry(input.id, { trustLevel: "verified", verifiedAt: new Date(), verifiedBy: ctx.user.id } as any);
      return { success: true };
    }),
  }),

  // ============================================================
  // SMART HEALTH LINKS (SHL)
  // ============================================================
  shl: router({
    list: protectedProcedure.input(z.object({ patientId: z.number() })).query(async ({ input }) => {
      return db.listSmartHealthLinks(input.patientId);
    }),
    create: protectedProcedure.input(z.object({
      patientId: z.number(),
      hospitalId: z.number(),
      purpose: z.enum(["referral", "patient_summary", "discharge", "cross_border", "medical_tourist", "insurance", "self_share"]),
      scope: z.any().optional(),
      maxAccessCount: z.number().optional(),
      expiresInDays: z.number().optional(),
    })).mutation(async ({ ctx, input }) => {
      const expiresAt = input.expiresInDays ? new Date(Date.now() + input.expiresInDays * 86400000) : undefined;
      const shlData: any = {
        patientId: input.patientId,
        issuedBy: ctx.user.id,
        hospitalId: input.hospitalId,
        purpose: input.purpose,
        scope: input.scope,
        maxAccessCount: input.maxAccessCount,
        expiresAt,
        manifestHash: nanoid(32),
        shlUrl: `https://shl.trustcare.network/${nanoid(16)}`,
        qrPayload: `shlink:/${nanoid(64)}`,
      };
      const id = await db.createSmartHealthLink(shlData);
      await db.createAuditEvent({ actorId: ctx.user.id, action: "shl.created", resourceType: "smart_health_link", resourceId: String(id), details: { purpose: input.purpose } });
      return { id, shlUrl: shlData.shlUrl, qrPayload: shlData.qrPayload };
    }),
    revoke: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      await db.revokeShl(input.id);
      await db.createAuditEvent({ actorId: ctx.user.id, action: "shl.revoked", resourceType: "smart_health_link", resourceId: String(input.id) });
      return { success: true };
    }),
    accessLogs: protectedProcedure.input(z.object({ shlId: z.number() })).query(async ({ input }) => {
      return db.listShlAccessLogs(input.shlId);
    }),
    access: publicProcedure.input(z.object({
      shlId: z.number(),
      accessorName: z.string().optional(),
      accessorOrg: z.string().optional(),
      accessorCountry: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const shl = await db.getShlById(input.shlId);
      if (!shl) throw new TRPCError({ code: "NOT_FOUND", message: "SHL not found" });
      if (shl.status !== "active") throw new TRPCError({ code: "FORBIDDEN", message: "SHL is no longer active" });
      if (shl.expiresAt && new Date(shl.expiresAt) < new Date()) throw new TRPCError({ code: "FORBIDDEN", message: "SHL has expired" });
      if (shl.maxAccessCount && shl.currentAccessCount >= shl.maxAccessCount) throw new TRPCError({ code: "FORBIDDEN", message: "SHL access limit reached" });
      await db.incrementShlAccessCount(input.shlId);
      await db.createShlAccessLog({ shlId: input.shlId, accessorName: input.accessorName, accessorOrg: input.accessorOrg, accessorCountry: input.accessorCountry, ipAddress: ctx.req?.ip });
      return { scope: shl.scope, manifestHash: shl.manifestHash };
    }),
  }),

  // ============================================================
  // E-CLAIM CENTER
  // ============================================================
  claim: router({
    listPayers: protectedProcedure.query(async () => {
      return db.listPayerAdapters();
    }),
    createPayer: adminProcedure.input(z.object({
      name: z.string().min(1),
      payerType: z.enum(["nhso", "sso", "csmbs", "private_insurance", "corporate", "self_pay"]),
      apiEndpoint: z.string().optional(),
      submissionFormat: z.enum(["api", "portal", "batch_file", "email", "rpa"]).optional(),
    })).mutation(async ({ input }) => {
      const id = await db.createPayerAdapter(input as any);
      return { id };
    }),
    checkEligibility: protectedProcedure.input(z.object({
      patientId: z.number(),
      payerAdapterId: z.number(),
      memberId: z.string().optional(),
    })).mutation(async ({ input }) => {
      const payer = await db.getPayerAdapterById(input.payerAdapterId);
      if (!payer) throw new TRPCError({ code: "NOT_FOUND", message: "Payer adapter not found" });
      const eligibility = evaluateEligibility(payer as any, input.memberId);
      const data: any = {
        patientId: input.patientId,
        payerAdapterId: input.payerAdapterId,
        memberId: input.memberId,
        status: eligibility.eligible ? "eligible" : "ineligible",
        coverageType: eligibility.coverageType,
        benefits: eligibility.eligible ? eligibility.benefits : null,
        limitations: eligibility.limitations,
        validUntil: eligibility.eligible ? new Date(Date.now() + 30 * 86400000) : null,
      };
      const id = await db.checkCoverageEligibility(data);
      return { id, ...eligibility };
    }),
    listEligibility: protectedProcedure.input(z.object({ patientId: z.number() })).query(async ({ input }) => {
      return db.listCoverageEligibility(input.patientId);
    }),
    listCases: protectedProcedure.input(z.object({
      hospitalId: z.number().optional(),
      status: z.string().optional(),
      patientId: z.number().optional(),
    })).query(async ({ input }) => {
      return db.listClaimCases(input);
    }),
    getCase: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return db.getClaimCaseById(input.id);
    }),
    createCase: protectedProcedure.input(z.object({
      patientId: z.number(),
      hospitalId: z.number(),
      payerAdapterId: z.number(),
      encounterRef: z.string().optional(),
      claimType: z.enum(["opd", "ipd", "dental", "pharmacy", "rehabilitation", "emergency"]),
      totalAmount: z.string().optional(),
      diagnosisCodes: z.any().optional(),
      procedureCodes: z.any().optional(),
      serviceItems: z.any().optional(),
    })).mutation(async ({ input }) => {
      const id = await db.createClaimCase(input as any);
      return { id };
    }),
    updateStatus: protectedProcedure.input(z.object({
      id: z.number(),
      status: z.enum(["draft", "validating", "correction_required", "ready_to_submit", "submitted", "accepted", "rejected", "more_info_requested", "appeal", "paid", "closed"]),
      rejectionReason: z.string().optional(),
      approvedAmount: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      if (data.status === "submitted") (data as any).submittedAt = new Date();
      if (data.status === "paid") (data as any).paidAt = new Date();
      if (data.status === "rejected" || data.status === "accepted") (data as any).respondedAt = new Date();
      await db.updateClaimCase(id, data as any);
      await db.createAuditEvent({ actorId: ctx.user.id, action: `claim.${data.status}`, resourceType: "claim_case", resourceId: String(id) });
      return { success: true };
    }),
    validate: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      const claimCase = await db.getClaimCaseById(input.id);
      if (!claimCase) throw new TRPCError({ code: "NOT_FOUND", message: "Claim case not found" });
      const issues = validateClaimCase(claimCase as any);
      await db.updateClaimCase(input.id, {
        status: issues.length === 0 ? "ready_to_submit" : "correction_required",
        validationIssues: issues,
      } as any);
      return { valid: issues.length === 0, issues };
    }),
  }),

  // ============================================================
  // MEDICAL TOURIST / INTERNATIONAL PATIENT CENTER
  // ============================================================
  international: router({
    listCases: protectedProcedure.input(z.object({
      status: z.string().optional(),
      assignedCoordinatorId: z.number().optional(),
    })).query(async ({ input }) => {
      return db.listInternationalCases(input);
    }),
    getCase: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return db.getInternationalCaseById(input.id);
    }),
    createCase: protectedProcedure.input(z.object({
      country: z.string().optional(),
      language: z.enum(["en", "zh", "ja", "ar", "ru", "ko", "de", "fr", "other"]).optional(),
      passportNumber: z.string().optional(),
      passportCountry: z.string().optional(),
      insuranceProvider: z.string().optional(),
      insurancePolicyNumber: z.string().optional(),
      serviceLine: z.string().optional(),
      preferredBranchId: z.number().optional(),
      contactEmail: z.string().optional(),
      contactPhone: z.string().optional(),
      contactMessenger: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const id = await db.createInternationalCase({ ...input, patientId: ctx.user.id } as any);
      await notifyOwner({ title: "New Medical Tourist Inquiry", content: `New international case from ${input.country || "unknown"} for ${input.serviceLine || "general"}` });
      return { id };
    }),
    updateStatus: protectedProcedure.input(z.object({
      id: z.number(),
      status: z.enum(["inquiry", "profile_created", "documents_uploaded", "identity_verified", "clinical_pre_review", "more_info_requested", "quotation_prepared", "insurance_review", "appointment_confirmed", "arrival_ready", "patient_arrived", "treatment_in_progress", "discharge_prepared", "follow_up_scheduled", "closed"]),
    })).mutation(async ({ ctx, input }) => {
      await db.updateInternationalCase(input.id, { status: input.status } as any);
      await db.createAuditEvent({ actorId: ctx.user.id, action: `international.${input.status}`, resourceType: "international_case", resourceId: String(input.id) });
      return { success: true };
    }),
    updateCase: protectedProcedure.input(z.object({
      id: z.number(),
      assignedCoordinatorId: z.number().optional(),
      assignedInterpreterId: z.number().optional(),
      quotationAmount: z.string().optional(),
      quotationCurrency: z.string().optional(),
      appointmentDate: z.string().optional(),
      clinicalNotes: z.string().optional(),
    })).mutation(async ({ input }) => {
      const { id, ...data } = input;
      if (data.appointmentDate) (data as any).appointmentDate = new Date(data.appointmentDate);
      await db.updateInternationalCase(id, data as any);
      return { success: true };
    }),
    listDocuments: protectedProcedure.input(z.object({ caseId: z.number() })).query(async ({ input }) => {
      return db.listTravelDocuments(input.caseId);
    }),
    addDocument: protectedProcedure.input(z.object({
      caseId: z.number(),
      documentType: z.enum(["passport", "insurance_card", "referral_letter", "lab_report", "imaging_report", "medication_list", "medical_certificate", "visa_support_letter", "quotation", "guarantee_letter", "other"]),
      fileName: z.string().optional(),
      fileUrl: z.string().optional(),
      fileKey: z.string().optional(),
    })).mutation(async ({ input }) => {
      const id = await db.createTravelDocument(input as any);
      return { id };
    }),
    verifyDocument: protectedProcedure.input(z.object({
      id: z.number(),
      verificationStatus: z.enum(["verified", "unverified", "rejected"]),
      notes: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      await db.updateTravelDocument(input.id, {
        verificationStatus: input.verificationStatus,
        verifiedBy: ctx.user.id,
        verifiedAt: new Date(),
        notes: input.notes,
      } as any);
      return { success: true };
    }),
  }),

  // ============================================================
  // CROSS-BORDER REFERRAL
  // ============================================================
  crossBorderReferral: router({
    list: protectedProcedure.input(z.object({
      referralType: z.string().optional(),
      status: z.string().optional(),
    })).query(async ({ input }) => {
      return db.listCrossBorderReferrals(input);
    }),
    getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return db.getCrossBorderReferralById(input.id);
    }),
    create: protectedProcedure.input(z.object({
      referralId: z.number().optional(),
      referralType: z.enum(["cross_branch", "cross_border_outbound", "cross_border_inbound", "external_partner"]),
      partnerOrgId: z.number().optional(),
      partnerOrgName: z.string().optional(),
      partnerCountry: z.string().optional(),
      language: z.enum(["th", "en", "zh", "ja", "other"]).optional(),
      jurisdiction: z.string().optional(),
      translationRequired: z.boolean().optional(),
    })).mutation(async ({ ctx, input }) => {
      const id = await db.createCrossBorderReferral(input as any);
      await db.createAuditEvent({ actorId: ctx.user.id, action: "cross_border_referral.created", resourceType: "cross_border_referral", resourceId: String(id), details: { referralType: input.referralType } });
      return { id };
    }),
    updateStatus: protectedProcedure.input(z.object({
      id: z.number(),
      status: z.enum(["draft", "consent_requested", "consent_granted", "packet_generated", "sent", "acknowledged", "accepted", "rejected", "completed", "counter_referral_received", "closed"]),
    })).mutation(async ({ ctx, input }) => {
      await db.updateCrossBorderReferral(input.id, { status: input.status } as any);
      await db.createAuditEvent({ actorId: ctx.user.id, action: `cross_border_referral.${input.status}`, resourceType: "cross_border_referral", resourceId: String(input.id) });
      return { success: true };
    }),
    generatePacket: protectedProcedure.input(z.object({
      id: z.number(),
      patientId: z.number(),
      hospitalId: z.number(),
    })).mutation(async ({ ctx, input }) => {
      // Create SHL for the referral packet
      const shlData: any = {
        patientId: input.patientId,
        issuedBy: ctx.user.id,
        hospitalId: input.hospitalId,
        purpose: "cross_border",
        scope: { type: "referral_packet" },
        manifestHash: nanoid(32),
        shlUrl: `https://shl.trustcare.network/${nanoid(16)}`,
        qrPayload: `shlink:/${nanoid(64)}`,
      };
      const shlId = await db.createSmartHealthLink(shlData);
      await db.updateCrossBorderReferral(input.id, { status: "packet_generated", ipsShlId: shlId } as any);
      return { shlId, shlUrl: shlData.shlUrl };
    }),
  }),

  // ============================================================
  // PATIENT DATA PORTABILITY LAYER
  // ============================================================
  portability: router({
    jwks: publicProcedure.query(async () => {
      return localIssuerJwks(defaultIssuerProfile().did);
    }),

    productionReadiness: protectedProcedure.query(async () => {
      const policy = await buildPortabilityTrustPolicy({ mode: "advisory" });
      return {
        trust: productionReadinessChecks(policy),
        syncAdapters: syncAdapterManifest(),
        localJwks: await localIssuerJwks(defaultIssuerProfile().did),
      };
    }),

    standardLabels: publicProcedure.query(() => {
      return standardLabelCatalog();
    }),

    didDocuments: publicProcedure.input(z.object({
      hospitalCode: z.string().default("TCC"),
      patientSeed: z.string().default("P001"),
      carepassId: z.string().default("CP-TH-2026-000001"),
    }).optional()).query(({ input }) => {
      const hospitalCode = input?.hospitalCode ?? "TCC";
      const patientSeed = input?.patientSeed ?? "P001";
      const carepassId = input?.carepassId ?? "CP-TH-2026-000001";
      return {
        hospital: {
          did: hospitalDidWeb(hospitalCode),
          didDocument: didWebDocument({
            hospitalCode,
            name: `TrustCare ${hospitalCode}`,
            nameEn: `TrustCare ${hospitalCode}`,
          }),
        },
        patient: {
          did: patientDidKey(`${hospitalCode}:${patientSeed}:${carepassId}`),
          didDocument: didKeyDocument({
            seed: `${hospitalCode}:${patientSeed}:${carepassId}`,
            patientRef: `Patient/${patientSeed.toLowerCase()}`,
            carepassId,
          }),
        },
      };
    }),

    demoSeed: protectedProcedure.input(z.object({
      patientsPerHospital: z.number().min(1).max(100).default(12),
    }).optional()).query(({ input }) => {
      return generateTrustcareDemoSeed({ patientsPerHospital: input?.patientsPerHospital ?? 12 });
    }),

    sourceTruthConnectors: protectedProcedure.query(() => {
      return sourceTruthConnectors();
    }),

    seedBatches: protectedProcedure.input(z.object({
      limit: z.number().min(1).max(100).default(20),
    }).optional()).query(({ input }) => {
      return db.listVcVpSeedBatches(input?.limit ?? 20);
    }),

    issuedPresentations: protectedProcedure.input(z.object({
      patientId: z.number().optional(),
      status: z.string().optional(),
      limit: z.number().min(1).max(100).default(50),
    }).optional()).query(({ input }) => {
      return db.listIssuedPresentations(input);
    }),

    reseedDb: adminProcedure.input(z.object({
      patientsPerHospital: z.number().min(1).max(100).default(12),
      resetExistingSeed: z.boolean().default(true),
    }).optional()).mutation(async ({ ctx, input }) => {
      return reseedTrustcareVcVpDatabase({
        actorId: ctx.user.id,
        patientsPerHospital: input?.patientsPerHospital ?? 12,
        resetExistingSeed: input?.resetExistingSeed ?? true,
      });
    }),

    reviewCsvImport: protectedProcedure.input(z.object({
      csvText: z.string().min(1),
      sourceSystem: z.string().default("CSV-UPLOAD"),
      sourceOrganizationId: z.string().default("TCC"),
      sourceOrganizationName: z.string().optional(),
      mapperVersion: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const review = reviewCsvForCanonicalMapping(input);
      await db.createAuditEvent({
        actorId: ctx.user.id,
        actorRole: (ctx.user as any).systemRole,
        action: "portability.csv.reviewed",
        resourceType: "canonical_import",
        resourceId: String(review.id),
        details: { rowCount: review.rowCount, ready: review.ready, needsReview: review.needsReview },
      });
      return review;
    }),

    canonicalizeDraft: protectedProcedure.input(z.object({
      draft: z.any(),
    })).mutation(({ input }) => {
      return canonicalizeReviewedDraft(input.draft);
    }),

    canonicalizeHis: protectedProcedure.input(z.object({
      sourceFormat: z.enum(["db_view", "csv", "hl7v2", "rest_api", "fhir_native", "document"]),
      payload: z.any(),
      sourceSystem: z.string().min(1),
      sourceOrganizationId: z.string().min(1),
      sourceOrganizationName: z.string().optional(),
      mapperVersion: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const result = canonicalizeHisPayload(input);
      await db.createAuditEvent({
        actorId: ctx.user.id,
        actorRole: (ctx.user as any).systemRole,
        action: "portability.fhir.canonicalized",
        resourceType: "fhir_bundle",
        resourceId: result.summary.bundleHash,
        details: { sourceFormat: input.sourceFormat, issues: result.issues },
      });
      return result;
    }),

    createPacket: protectedProcedure.input(z.object({
      context: z.enum(["treatment", "cross_branch_referral", "cross_border", "e_claim", "medical_tourist", "emergency", "self_share"]),
      hisInput: z.object({
        sourceFormat: z.enum(["db_view", "csv", "hl7v2", "rest_api", "fhir_native", "document"]),
        payload: z.any(),
        sourceSystem: z.string().min(1),
        sourceOrganizationId: z.string().min(1),
        sourceOrganizationName: z.string().optional(),
        mapperVersion: z.string().optional(),
      }),
      consent: z.object({
        id: z.string(),
        patientId: z.string(),
        purpose: z.enum(["treatment", "referral", "claim", "insurance", "public_health", "research", "emergency", "medical_tourism"]),
        requesterId: z.string(),
        requesterRole: z.string(),
        grantedToOrganizationId: z.string().optional(),
        scopes: z.array(z.string()),
        status: z.enum(["granted", "revoked", "expired"]),
        grantedAt: z.string(),
        expiresAt: z.string().optional(),
        vcCredentialId: z.string().optional(),
      }).optional(),
      requestedScopes: z.array(z.string()).optional(),
      issuer: z.object({
        id: z.string(),
        name: z.string(),
        did: z.string(),
        country: z.string().optional(),
        trustDomain: z.string().optional(),
      }).optional(),
      holderDid: z.string().optional(),
      audience: z.string().optional(),
      breakGlassReason: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const packet = await createPortabilityPacket({
        context: input.context,
        hisInput: input.hisInput,
        issuer: input.issuer ?? defaultIssuerProfile(),
        holderDid: input.holderDid ?? defaultHolderDid(ctx.user.id),
        requesterId: String(ctx.user.id),
        requesterRole: (ctx.user as any).systemRole ?? ctx.user.role,
        consent: input.consent as any,
        requestedScopes: input.requestedScopes,
        audience: input.audience,
        breakGlassReason: input.breakGlassReason,
      });
      await db.createAuditEvent({
        actorId: ctx.user.id,
        actorRole: (ctx.user as any).systemRole,
        action: "portability.packet.created",
        resourceType: "verifiable_presentation",
        resourceId: packet.presentation.id,
        details: { context: input.context, credentialIds: packet.outboundCredentials.map((credential) => credential.id), policy: packet.policyDecision },
        isBreakGlass: packet.policyDecision.requiresBreakGlass,
      });
      return packet;
    }),

    issueMedicalCertificate: protectedProcedure.input(z.object({
      templateId: z.number().optional(),
      issuerHospitalId: z.number().optional(),
      subjectId: z.number().optional(),
      issuer: z.object({
        id: z.string(),
        name: z.string(),
        did: z.string(),
        country: z.string().optional(),
        trustDomain: z.string().optional(),
      }).optional(),
      holderDid: z.string().optional(),
      patient: z.object({ id: z.string(), name: z.string() }).passthrough(),
      practitioner: z.object({ id: z.string(), name: z.string() }).passthrough(),
      organization: z.object({ id: z.string(), name: z.string() }).passthrough(),
      diagnosisText: z.string().optional(),
      fitnessForWork: z.enum(["fit", "unfit", "restricted"]).optional(),
      recommendations: z.array(z.string()).optional(),
      validFrom: z.string().optional(),
      validUntil: z.string().optional(),
      audience: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      requireMaker(ctx.user, "medical_certificate");
      const issuer = input.issuer ?? defaultIssuerProfile();
      const request = await submitMakerCredentialRequest({
        maker: ctx.user,
        templateId: input.templateId,
        issuerHospitalId: input.issuerHospitalId ?? (ctx.user as any).hospitalId ?? 0,
        subjectId: input.subjectId ?? numericSubjectId(input.patient.id, ctx.user.id),
        type: "medical_certificate",
        holderDid: input.holderDid ?? defaultHolderDid(ctx.user.id),
        issuerDid: issuer.did,
        documentData: {
          issuer,
          patient: input.patient,
          practitioner: input.practitioner,
          organization: input.organization,
          diagnosisText: input.diagnosisText,
          fitnessForWork: input.fitnessForWork,
          recommendations: input.recommendations,
          validFrom: input.validFrom,
          validUntil: input.validUntil,
          audience: input.audience,
        },
        canonicalReview: { status: "pending_checker_review", requiredBeforeIssue: true, documentType: "medical_certificate" },
      });
      return { ...request, nextStep: "checker_review_required" };
    }),

    issuePrescription: protectedProcedure.input(z.object({
      templateId: z.number().optional(),
      issuerHospitalId: z.number().optional(),
      subjectId: z.number().optional(),
      issuer: z.object({
        id: z.string(),
        name: z.string(),
        did: z.string(),
        country: z.string().optional(),
        trustDomain: z.string().optional(),
      }).optional(),
      holderDid: z.string().optional(),
      patient: z.object({ id: z.string(), name: z.string() }).passthrough(),
      prescriber: z.object({ id: z.string(), name: z.string() }).passthrough(),
      organization: z.object({ id: z.string(), name: z.string() }).passthrough(),
      medications: z.array(z.object({
        code: z.string().optional(),
        codeSystem: z.string().optional(),
        name: z.string().min(1),
        doseText: z.string().optional(),
        quantity: z.string().optional(),
        daysSupply: z.number().optional(),
        instructions: z.string().optional(),
        repeatsAllowed: z.number().optional(),
      })).min(1),
      authoredOn: z.string().optional(),
      substitutionAllowed: z.boolean().optional(),
      repeatsAllowed: z.number().optional(),
      dispenseWindowDays: z.number().optional(),
      audience: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      requireMaker(ctx.user, "prescription");
      const issuer = input.issuer ?? defaultIssuerProfile();
      const request = await submitMakerCredentialRequest({
        maker: ctx.user,
        templateId: input.templateId,
        issuerHospitalId: input.issuerHospitalId ?? (ctx.user as any).hospitalId ?? 0,
        subjectId: input.subjectId ?? numericSubjectId(input.patient.id, ctx.user.id),
        type: "prescription",
        holderDid: input.holderDid ?? defaultHolderDid(ctx.user.id),
        issuerDid: issuer.did,
        documentData: {
          issuer,
          patient: input.patient,
          prescriber: input.prescriber,
          organization: input.organization,
          medications: input.medications,
          authoredOn: input.authoredOn,
          substitutionAllowed: input.substitutionAllowed,
          repeatsAllowed: input.repeatsAllowed,
          dispenseWindowDays: input.dispenseWindowDays,
          audience: input.audience,
        },
        canonicalReview: { status: "pending_checker_review", requiredBeforeIssue: true, documentType: "prescription" },
      });
      return { ...request, nextStep: "checker_review_required" };
    }),

    verify: publicProcedure.input(z.object({
      jwt: z.string().min(1),
      kind: z.enum(["credential", "presentation"]).default("presentation"),
      trustedIssuers: z.array(z.string()).optional(),
      revokedCredentialIds: z.array(z.string()).optional(),
      revokedStatusIndexes: z.array(z.string()).optional(),
      allowedCredentialTypes: z.array(z.enum(trustcareCredentialTypeValues)).optional(),
      trustRegistryMode: z.enum(["off", "advisory", "required"]).default("advisory"),
      audience: z.string().optional(),
    })).mutation(async ({ input }) => {
      const trustPolicy = input.trustRegistryMode === "off"
        ? undefined
        : await buildPortabilityTrustPolicy({
          mode: input.trustRegistryMode,
          trustedIssuers: input.trustedIssuers,
          revokedCredentialIds: input.revokedCredentialIds,
          revokedStatusIndexes: input.revokedStatusIndexes,
          allowedCredentialTypes: input.allowedCredentialTypes as any,
        });
      if (input.kind === "credential") {
        return verifyCredential({
          jwt: input.jwt,
          trustedIssuers: input.trustedIssuers,
          revokedCredentialIds: input.revokedCredentialIds,
          revokedStatusIndexes: input.revokedStatusIndexes,
          allowedCredentialTypes: input.allowedCredentialTypes as any,
          trustPolicy,
          audience: input.audience,
        });
      }
      return verifyPresentation({
        jwt: input.jwt,
        trustedIssuers: input.trustedIssuers,
        revokedCredentialIds: input.revokedCredentialIds,
        revokedStatusIndexes: input.revokedStatusIndexes,
        allowedCredentialTypes: input.allowedCredentialTypes as any,
        trustPolicy,
        audience: input.audience,
      });
    }),

    verifyJsonPresentation: publicProcedure.input(z.object({
      presentation: z.any(),
      trustedIssuers: z.array(z.string()).optional(),
      revokedCredentialIds: z.array(z.string()).optional(),
      requiredCredentialTypes: z.array(z.string()).optional(),
    })).mutation(({ input }) => {
      return verifyJsonPresentation(input);
    }),

    syncTargets: protectedProcedure.query(() => {
      return RECOMMENDED_SYNC_TARGETS;
    }),

    syncAdapterManifest: protectedProcedure.query(() => {
      return syncAdapterManifest();
    }),

    credentialStatusEvents: protectedProcedure.input(z.object({
      credentialId: z.string().optional(),
      status: z.string().optional(),
      limit: z.number().optional(),
    })).query(async ({ input }) => {
      return db.listCredentialStatusEvents(input);
    }),

    recordCredentialStatus: protectedProcedure.input(z.object({
      credentialId: z.string().min(1),
      statusListIndex: z.string().optional(),
      statusPurpose: z.enum(["revocation", "suspension"]).default("revocation"),
      status: z.enum(["active", "revoked", "suspended"]),
      reason: z.string().optional(),
      metadata: z.any().optional(),
    })).mutation(async ({ ctx, input }) => {
      const eventHash = sha256({ ...input, actorId: ctx.user.id, recordedAt: new Date().toISOString() });
      const id = await db.createCredentialStatusEvent({
        credentialId: input.credentialId,
        statusListIndex: input.statusListIndex,
        statusPurpose: input.statusPurpose,
        status: input.status,
        reason: input.reason,
        actorId: ctx.user.id,
        eventHash,
        metadata: input.metadata,
      } as any);
      await db.createAuditEvent({
        actorId: ctx.user.id,
        actorRole: (ctx.user as any).systemRole,
        action: "portability.credential_status.recorded",
        resourceType: "credential_status_event",
        resourceId: String(id ?? input.credentialId),
        details: { credentialId: input.credentialId, status: input.status, statusListIndex: input.statusListIndex, eventHash },
      });
      return { id, eventHash };
    }),

    reconciliationJobs: protectedProcedure.input(z.object({
      status: z.string().optional(),
      targetId: z.string().optional(),
      limit: z.number().optional(),
    })).query(async ({ input }) => {
      return db.listSyncReconciliationJobs(input);
    }),

    planSyncBack: protectedProcedure.input(z.object({
      target: z.object({
        id: z.string(),
        name: z.string(),
        kind: z.enum(["fhir_rest", "hl7v2", "db_view", "rest_api", "csv_batch", "manual_queue"]),
        writeMode: z.enum(["system_of_record", "system_of_reference", "mirror_only"]),
        supportedResources: z.array(z.string()),
        supportsTransactions: z.boolean(),
        supportsVersionCheck: z.boolean(),
        idempotencyStrategy: z.enum(["business_key", "source_event_id", "content_hash"]),
      }),
      operation: z.enum(["create", "update", "upsert", "append", "revoke"]),
      resource: z.any(),
      sourceEventId: z.string().min(1),
      patientBusinessKey: z.string().min(1),
      expectedVersion: z.string().optional(),
      reason: z.string().min(1),
    })).mutation(async ({ ctx, input }) => {
      const plan = createSyncBackPlan({
        target: input.target,
        operation: input.operation,
        resource: input.resource,
        sourceEventId: input.sourceEventId,
        patientBusinessKey: input.patientBusinessKey,
        expectedVersion: input.expectedVersion,
        reason: input.reason,
        actorId: String(ctx.user.id),
      });
      await db.createAuditEvent({
        actorId: ctx.user.id,
        actorRole: (ctx.user as any).systemRole,
        action: "portability.sync_back.planned",
        resourceType: "sync_back_plan",
        resourceId: plan.id,
        details: { status: plan.status, targetId: plan.targetId, issues: plan.issues },
      });
      return plan;
    }),

    executeSyncBack: protectedProcedure.input(z.object({
      plan: z.object({
        id: z.string(),
        targetId: z.string(),
        targetKind: z.enum(["fhir_rest", "hl7v2", "db_view", "rest_api", "csv_batch", "manual_queue"]),
        operation: z.enum(["create", "update", "upsert", "append", "revoke"]),
        idempotencyKey: z.string(),
        consistencyKey: z.string(),
        outboundPayload: z.any(),
        preconditions: z.array(z.any()),
        rollbackHint: z.string().optional(),
        status: z.enum(["ready", "manual_review_required", "blocked"]),
        issues: z.array(z.object({
          ruleId: z.string(),
          severity: z.enum(["error", "warning"]),
          resourceType: z.string().optional(),
          resourceId: z.string().optional(),
          message: z.string(),
        })),
      }).passthrough(),
      issuer: z.object({
        id: z.string(),
        name: z.string(),
        did: z.string(),
        country: z.string().optional(),
        trustDomain: z.string().optional(),
      }).optional(),
      holderDid: z.string().optional(),
      subjectId: z.string().optional(),
      accepted: z.boolean().optional(),
      targetVersion: z.string().optional(),
      targetReference: z.string().optional(),
      message: z.string().optional(),
      allowManualReview: z.boolean().optional(),
      audience: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const execution = executeSyncBackPlan(input.plan as any, {
        actorId: String(ctx.user.id),
        accepted: input.accepted,
        targetVersion: input.targetVersion,
        targetReference: input.targetReference,
        message: input.message,
        allowManualReview: input.allowManualReview ?? true,
      });
      const syncReceiptCredential = await issueSyncReceiptVc({
        issuer: input.issuer ?? defaultIssuerProfile(),
        holderDid: input.holderDid ?? defaultHolderDid(ctx.user.id),
        subjectId: input.subjectId ?? syncReceiptSubjectId(input.plan, defaultHolderDid(ctx.user.id)),
        plan: input.plan as any,
        execution,
        audience: input.audience,
      });
      if (execution.reconciliation && execution.reconciliation.status !== "not_required") {
        await db.createSyncReconciliationJob({
          jobId: execution.reconciliation.id,
          planId: execution.reconciliation.planId,
          executionId: execution.reconciliation.executionId,
          targetId: execution.reconciliation.targetId,
          targetKind: execution.reconciliation.targetKind,
          status: execution.reconciliation.status,
          runMode: execution.reconciliation.runMode,
          reason: execution.reconciliation.reason,
          checks: execution.reconciliation.checks,
          attempts: execution.reconciliation.attempts,
          dueAt: execution.reconciliation.dueAt ? new Date(execution.reconciliation.dueAt) : undefined,
        } as any);
      }
      await db.createIntegrationEvent({
        adapterId: 0,
        eventType: "portability.sync_back.executed",
        direction: "outbound",
        resourceType: String(input.plan.outboundPayload?.body?.resourceType ?? input.plan.outboundPayload?.row?.resource_type ?? "SyncBackPlan"),
        resourceId: input.plan.id,
        status: execution.accepted ? "success" : "error",
        payload: { execution, syncReceiptCredentialId: syncReceiptCredential.id },
        correlationId: input.plan.idempotencyKey,
        processedAt: new Date(execution.executedAt),
      } as any);
      await db.createAuditEvent({
        actorId: ctx.user.id,
        actorRole: (ctx.user as any).systemRole,
        action: "portability.sync_back.executed",
        resourceType: "sync_receipt_credential",
        resourceId: syncReceiptCredential.id,
        details: {
          planId: input.plan.id,
          status: execution.status,
          targetId: execution.targetId,
          targetReference: execution.targetReference,
          reconciliationJobId: execution.reconciliation?.id,
          credentialDigest: syncReceiptCredential.digest,
        },
      });
      return { execution, syncReceiptCredential };
    }),
  }),

  // ============================================================
  // EXECUTIVE DASHBOARD
  // ============================================================
  executiveDashboard: router({
    stats: protectedProcedure.query(async () => {
      return db.getExecutiveDashboardStats();
    }),
  }),
});

export type AppRouter = typeof appRouter;

// Helper
function requireMaker(user: any, credentialType: string) {
  if (user?.systemRole !== "maker") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Document creation requires Maker role." });
  }
  if (!hasCredentialEntitlement(user, "makerTypes", credentialType)) {
    throw new TRPCError({ code: "FORBIDDEN", message: `Maker is not entitled to create ${credentialType}.` });
  }
}

function requireChecker(user: any, credentialType: string) {
  if (user?.systemRole !== "checker") {
    throw new TRPCError({ code: "FORBIDDEN", message: "VC issuance requires Checker role." });
  }
  if (!hasCredentialEntitlement(user, "checkerTypes", credentialType)) {
    throw new TRPCError({ code: "FORBIDDEN", message: `Checker is not entitled to issue ${credentialType}.` });
  }
}

function hasCredentialEntitlement(user: any, key: "makerTypes" | "checkerTypes", credentialType: string): boolean {
  const entitlements = user?.credentialEntitlements ?? {};
  const allowed = Array.isArray(entitlements[key]) ? entitlements[key] : [];
  return allowed.includes("*") || allowed.includes(credentialType);
}

async function submitMakerCredentialRequest(input: {
  maker: any;
  templateId?: number;
  issuerHospitalId: number;
  subjectId: number;
  type: (typeof credentialTypeValues)[number];
  holderDid?: string;
  issuerDid?: string;
  documentData: any;
  canonicalReview?: any;
}) {
  requireMaker(input.maker, input.type);
  const requestId = `urn:trustcare:issuance-request:${nanoid(32)}`;
  const id = await db.createCredentialIssuanceRequest({
    requestId,
    templateId: input.templateId,
    issuerHospitalId: input.issuerHospitalId,
    subjectId: input.subjectId,
    type: input.type,
    status: "submitted",
    makerId: input.maker.id,
    makerRole: input.maker.systemRole ?? input.maker.role,
    holderDid: input.holderDid,
    issuerDid: input.issuerDid,
    documentData: {
      ...input.documentData,
      makerFlow: {
        makerId: input.maker.id,
        makerRole: input.maker.systemRole ?? input.maker.role,
        submittedAt: new Date().toISOString(),
      },
    },
    canonicalReview: input.canonicalReview ?? { status: "pending_checker_review", requiredBeforeIssue: true },
  } as any);
  await db.createAuditEvent({
    actorId: input.maker.id,
    actorRole: input.maker.systemRole ?? input.maker.role,
    hospitalId: input.issuerHospitalId,
    action: "credential.request.submitted",
    resourceType: "credential_issuance_request",
    resourceId: requestId,
    details: { id, type: input.type, subjectId: input.subjectId, makerFlow: true },
  });
  return { id, requestId, status: "submitted", makerFlow: true };
}

async function issueCredentialFromRequest(input: {
  checkerId: number;
  checkerRole: string;
  request: any;
  checkerNotes?: string;
  audience?: string;
}) {
  const request = input.request;
  const documentData = request.documentData ?? {};
  const hospital = request.issuerHospitalId ? await db.getHospitalById(request.issuerHospitalId) : undefined;
  const issuer = {
    id: String(request.issuerHospitalId || documentData.issuer?.id || "trustcare-network"),
    name: String(documentData.issuer?.name ?? hospital?.nameEn ?? hospital?.name ?? defaultIssuerProfile().name),
    did: String(request.issuerDid ?? documentData.issuer?.did ?? hospital?.did ?? defaultIssuerProfile().did),
    country: String(documentData.issuer?.country ?? "TH"),
    trustDomain: String(documentData.issuer?.trustDomain ?? "trustcare-network"),
  };
  const holderDid = String(request.holderDid ?? documentData.holderDid ?? defaultHolderDid(request.subjectId));
  const credentialId = `urn:trustcare:vc:${sha256(request.requestId).slice(0, 32)}`;
  const issuedAt = new Date();
  let credential;

  if (request.type === "medical_certificate") {
    credential = await issueMedicalCertificateVc({
      issuer,
      holderDid,
      patient: documentData.patient ?? { id: String(request.subjectId), name: `Patient ${request.subjectId}` },
      practitioner: documentData.practitioner ?? { id: String(input.checkerId), name: "Checker" },
      organization: documentData.organization ?? { id: String(request.issuerHospitalId), name: issuer.name },
      diagnosisText: documentData.diagnosisText,
      fitnessForWork: documentData.fitnessForWork,
      recommendations: documentData.recommendations,
      validFrom: documentData.validFrom,
      validUntil: documentData.validUntil,
      audience: input.audience ?? documentData.audience,
      credentialId,
      now: issuedAt,
    });
  } else if (request.type === "prescription") {
    credential = await issuePrescriptionVc({
      issuer,
      holderDid,
      patient: documentData.patient ?? { id: String(request.subjectId), name: `Patient ${request.subjectId}` },
      prescriber: documentData.prescriber ?? { id: String(input.checkerId), name: "Checker" },
      organization: documentData.organization ?? { id: String(request.issuerHospitalId), name: issuer.name },
      medications: documentData.medications ?? [{ name: "Clinical medication order", instructions: "As directed" }],
      authoredOn: documentData.authoredOn,
      substitutionAllowed: documentData.substitutionAllowed,
      repeatsAllowed: documentData.repeatsAllowed,
      dispenseWindowDays: documentData.dispenseWindowDays,
      audience: input.audience ?? documentData.audience,
      credentialId,
      now: issuedAt,
    });
  } else {
    credential = await issueCredential({
      type: trustcareVcTypeForDbType(request.type),
      issuer,
      subjectId: String(documentData.patient?.id ?? request.subjectId),
      subjectDid: holderDid,
      claims: {
        documentType: request.type,
        patient: documentData.patient ?? { id: request.subjectId },
        organization: documentData.organization ?? { id: request.issuerHospitalId, name: issuer.name },
        clinical: documentData.clinical,
        fhir: documentData.fhir,
        sourceOfTruth: documentData.sourceOfTruth,
        humanDocument: documentData.humanDocument,
        originalDocumentData: documentData,
      },
      evidence: [
        { type: "MakerCheckerRequest", digest: sha256(request), resourceId: request.requestId },
        request.canonicalReview ? { type: "CanonicalReview", digest: sha256(request.canonicalReview), status: request.canonicalReview.status } : undefined,
      ].filter(Boolean) as any,
      validDays: validityDaysForCredentialType(request.type),
      audience: input.audience ?? documentData.audience,
      credentialId,
      now: issuedAt,
    });
  }

  const templateId = await resolveTemplateForRequest(request);
  const storage = documentStorageMetadata({
    documentType: request.type,
    hospitalCode: hospital?.code ?? String(request.issuerHospitalId),
    patientKey: String(request.subjectId),
    credentialId: credential.id,
  });
  const credentialData = {
    ...credential.credential,
    makerChecker: {
      requestId: request.requestId,
      makerId: request.makerId,
      makerRole: request.makerRole,
      checkerId: input.checkerId,
      checkerRole: input.checkerRole,
      checkerNotes: input.checkerNotes,
      checkedAt: issuedAt.toISOString(),
      canonicalReview: request.canonicalReview,
    },
  };
  const rowId = await db.createIssuedCredential({
    credentialId: credential.id,
    templateId,
    issuerId: input.checkerId,
    issuerHospitalId: request.issuerHospitalId,
    subjectId: request.subjectId,
    type: request.type,
    status: "active",
    credentialData,
    sdJwtVc: credential.jwt,
    documentCategory: storage.category,
    documentSubcategory: storage.subcategory,
    storageKey: storage.storagePath,
    searchTags: storage.indexTags,
    issuedAt,
    expiresAt: credential.expiresAt ? new Date(credential.expiresAt) : undefined,
    fhirResourceId: String(credential.credential?.credentialSubject?.fhir?.resourceType ?? request.type),
  } as any);
  await db.createWalletCard({
    patientId: request.subjectId,
    credentialId: rowId!,
    cardType: cardTypeForCredential(request.type) as any,
    displayName: getCardDisplayName(request.type),
    displayNameEn: String(request.type).replace(/_/g, " "),
    issuerHospitalName: issuer.name,
    documentCategory: storage.category,
  });
  await db.updateCredentialIssuanceRequest(request.id, {
    status: "issued",
    checkerId: input.checkerId,
    checkerRole: input.checkerRole,
    checkerNotes: input.checkerNotes,
    checkedAt: issuedAt,
    issuedAt,
    issuedCredentialId: credential.id,
    issuedCredentialRowId: rowId,
  } as any);
  await db.createAuditEvent({
    actorId: input.checkerId,
    actorRole: input.checkerRole,
    hospitalId: request.issuerHospitalId,
    action: "credential.request.approved_and_issued",
    resourceType: "verifiable_credential",
    resourceId: credential.id,
    details: {
      requestId: request.requestId,
      type: request.type,
      subjectId: request.subjectId,
      digest: credential.digest,
      makerId: request.makerId,
      checkerId: input.checkerId,
    },
  });
  return { id: rowId, credentialId: credential.id, requestId: request.requestId, status: "issued", credential };
}

async function resolveTemplateForRequest(request: any): Promise<number> {
  if (request.templateId) return request.templateId;
  const existing = await db.listCredentialTemplates(request.issuerHospitalId);
  const template = existing.find((item: any) => item.type === request.type);
  if (template) return template.id;
  const id = await db.createCredentialTemplate({
    hospitalId: request.issuerHospitalId,
    name: getCardDisplayName(request.type),
    nameEn: String(request.type).replace(/_/g, " "),
    type: request.type,
    version: "1.0",
    schema: { makerCheckerRequired: true, vcType: trustcareVcTypeForDbType(request.type) },
    fhirResourceType: "DocumentReference",
    documentCategory: documentStorageMetadata({ documentType: request.type }).category,
    documentSubcategory: documentStorageMetadata({ documentType: request.type }).subcategory,
    defaultStoragePath: documentStorageMetadata({ documentType: request.type }).storagePath,
    validityDays: validityDaysForCredentialType(request.type),
    isActive: true,
  } as any);
  return id!;
}

function trustcareVcTypeForDbType(type: string): any {
  const map: Record<string, string> = {
    patient_identity: "PatientIdentityCredential",
    consent_receipt: "ConsentReceiptCredential",
    patient_summary: "PatientSummaryCredential",
    allergy_alert: "AllergyAlertCredential",
    medication_summary: "MedicationSummaryCredential",
    referral_vc: "ReferralCredential",
    immunization: "ImmunizationCredential",
    medical_certificate: "MedicalCertificateCredential",
    prescription: "PrescriptionCredential",
    lab_result: "LabResultCredential",
    diagnostic_report: "DiagnosticReportCredential",
    discharge_summary: "DischargeSummaryCredential",
    insurance_eligibility: "CoverageEligibilityCredential",
    claim_package: "ClaimPackageCredential",
    claim_receipt: "ClaimReceiptCredential",
    travel_document_verification: "TravelDocumentVerificationCredential",
    shl_manifest: "ShlManifestCredential",
    pharmacy_dispense: "PharmacyDispenseCredential",
    appointment: "AppointmentCredential",
    visa_support_letter: "VisaSupportLetterCredential",
    quotation: "QuotationCredential",
    guarantee_letter: "GuaranteeLetterCredential",
    mpi_link_certificate: "MpiLinkCertificateCredential",
    sync_receipt: "SyncReceiptCredential",
  };
  return map[type] ?? "PatientSummaryCredential";
}

function validityDaysForCredentialType(type: string): number {
  if (["prescription", "pharmacy_dispense"].includes(type)) return 30;
  if (["medical_certificate", "lab_result", "diagnostic_report"].includes(type)) return 90;
  if (["consent_receipt", "insurance_eligibility", "claim_package", "claim_receipt"].includes(type)) return 180;
  return 365;
}

function numericSubjectId(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").replace(/[^\d]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getCardDisplayName(type: string): string {
  const extendedNames: Record<string, string> = {
    medical_certificate: "Medical Certificate",
    prescription: "Prescription",
    lab_result: "Lab Result",
    diagnostic_report: "Diagnostic Report",
    discharge_summary: "Discharge Summary",
    insurance_eligibility: "Coverage Eligibility",
    claim_package: "Claim Package",
    claim_receipt: "Claim Receipt",
    travel_document_verification: "Travel Document Verification",
    shl_manifest: "SHL Manifest",
    pharmacy_dispense: "Pharmacy Dispense",
    appointment: "Appointment",
    visa_support_letter: "Visa Support Letter",
    quotation: "Treatment Quotation",
    guarantee_letter: "Guarantee Letter",
    mpi_link_certificate: "MPI Link Certificate",
    sync_receipt: "Sync Receipt",
  };
  if (extendedNames[type]) return extendedNames[type];
  const map: Record<string, string> = {
    patient_identity: "บัตรประจำตัวผู้ป่วย",
    consent_receipt: "ใบรับรองความยินยอม",
    patient_summary: "สรุปข้อมูลผู้ป่วย",
    allergy_alert: "แจ้งเตือนการแพ้",
    medication_summary: "สรุปยาที่ใช้",
    referral_vc: "ใบส่งต่อ",
    immunization: "ประวัติวัคซีน",
  };
  return map[type] || type;
}

function cardTypeForCredential(type: string): string {
  const map: Record<string, string> = {
    patient_identity: "identity",
    consent_receipt: "consent",
    patient_summary: "patient_summary",
    allergy_alert: "allergy",
    medication_summary: "medication",
    referral_vc: "referral",
    immunization: "immunization",
    medical_certificate: "medical_certificate",
    prescription: "prescription",
    lab_result: "lab_result",
    diagnostic_report: "diagnostic_report",
    discharge_summary: "discharge_summary",
    insurance_eligibility: "coverage",
    claim_package: "claim",
    claim_receipt: "claim",
    travel_document_verification: "travel_document",
    shl_manifest: "shl_manifest",
    pharmacy_dispense: "pharmacy_dispense",
    appointment: "appointment",
    visa_support_letter: "visa_support_letter",
    quotation: "quotation",
    guarantee_letter: "guarantee_letter",
    mpi_link_certificate: "mpi_link_certificate",
    sync_receipt: "sync_receipt",
  };
  return map[type] ?? "patient_summary";
}

function defaultIssuerProfile() {
  return {
    id: "trustcare-network",
    name: "Trustcare Hospital Network",
    did: "did:web:trustcare.network",
    country: "TH",
    trustDomain: "trustcare-network",
  };
}

function defaultHolderDid(userId: number) {
  return patientDidKey(`trustcare-patient-${userId}`);
}

function evaluateAdapterHealth(adapter: {
  id: number;
  name?: string | null;
  status?: string | null;
  connectorPattern?: string | null;
}, config?: Record<string, unknown> | null) {
  const status = String(adapter.status ?? "testing");
  const targetConfigured = hasAdapterConnectionTarget(String(adapter.connectorPattern ?? ""), config);
  const healthy = status === "active" && targetConfigured;
  const responseTimeMs = 50 + stableModulo(`${adapter.id}:${adapter.name ?? ""}:${adapter.connectorPattern ?? ""}`, 450);
  let errorMessage: string | undefined;
  if (status !== "active") {
    errorMessage = `Adapter status is ${status}; activate adapter before marking it healthy.`;
  } else if (!targetConfigured) {
    errorMessage = "Adapter connection target is incomplete.";
  }
  return {
    healthy,
    responseTimeMs,
    errorMessage,
    evaluatedAt: new Date().toISOString(),
    evaluationSource: "adapter_configuration",
  };
}

function hasAdapterConnectionTarget(pattern: string, config?: Record<string, unknown> | null): boolean {
  if (!config || typeof config !== "object") return false;
  const acceptedKeys = [
    "endpoint", "baseUrl", "url", "dsn", "connectionString", "host", "databaseUrl",
    "viewName", "tableName", "fileDropPath", "directory", "topic", "queueName",
  ];
  const hasTarget = acceptedKeys.some((key) => {
    const value = config[key];
    return typeof value === "string" ? value.trim().length > 0 : Boolean(value);
  });
  if (hasTarget) return true;
  return ["portal_adapter", "batch_file"].includes(pattern) && Boolean(config.enabled);
}

function evaluateEligibility(payer: {
  payerType?: string | null;
  status?: string | null;
  validationRules?: unknown;
}, memberId?: string) {
  const payerStatus = String(payer.status ?? "testing");
  const payerType = String(payer.payerType ?? "private_insurance");
  const isSelfPay = payerType === "self_pay";
  const hasMemberId = isSelfPay || Boolean(memberId?.trim());
  const eligible = payerStatus === "active" && hasMemberId;
  const limitations: Array<{ code: string; message: string }> = [];
  if (payerStatus !== "active") {
    limitations.push({ code: "payer_not_active", message: `Payer adapter status is ${payerStatus}.` });
  }
  if (!hasMemberId) {
    limitations.push({ code: "member_id_required", message: "Member ID is required for this payer type." });
  }
  return {
    eligible,
    coverageType: coverageTypeForPayer(payerType),
    benefits: benefitsForPayer(payerType),
    limitations,
    payerStatus,
    evaluationSource: "payer_adapter_rules",
  };
}

function coverageTypeForPayer(payerType: string) {
  const map: Record<string, string> = {
    nhso: "universal_coverage",
    sso: "social_security",
    csmbs: "civil_servant",
    private_insurance: "private_insurance",
    corporate: "corporate",
    self_pay: "self_pay",
  };
  return map[payerType] ?? "general";
}

function benefitsForPayer(payerType: string) {
  if (payerType === "self_pay") return { opd: false, ipd: false, dental: false, paymentMode: "self_pay" };
  if (payerType === "private_insurance") return { opd: true, ipd: true, dental: true, preAuthorizationRequired: true };
  if (payerType === "corporate") return { opd: true, ipd: true, dental: false, guaranteeLetterRequired: true };
  return { opd: true, ipd: true, dental: false };
}

function validateClaimCase(claimCase: {
  payerAdapterId?: number | null;
  patientId?: number | null;
  hospitalId?: number | null;
  totalAmount?: string | null;
  diagnosisCodes?: unknown;
  procedureCodes?: unknown;
  serviceItems?: unknown;
  claimType?: string | null;
}) {
  const issues: Array<{ field: string; message: string }> = [];
  if (!claimCase.patientId) issues.push({ field: "patientId", message: "Patient is required." });
  if (!claimCase.hospitalId) issues.push({ field: "hospitalId", message: "Hospital is required." });
  if (!claimCase.payerAdapterId) issues.push({ field: "payerAdapterId", message: "Payer adapter is required." });
  if (!hasStructuredValue(claimCase.diagnosisCodes)) {
    issues.push({ field: "diagnosisCodes", message: "At least one diagnosis code is required." });
  }
  if (claimCase.claimType !== "pharmacy" && !hasStructuredValue(claimCase.serviceItems)) {
    issues.push({ field: "serviceItems", message: "Service items are required for non-pharmacy claims." });
  }
  const amount = Number(String(claimCase.totalAmount ?? "").replace(/,/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) {
    issues.push({ field: "totalAmount", message: "Total amount must be greater than zero." });
  }
  if (claimCase.claimType === "ipd" && !hasStructuredValue(claimCase.procedureCodes)) {
    issues.push({ field: "procedureCodes", message: "IPD claims require procedure codes." });
  }
  return issues;
}

function hasStructuredValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  return false;
}

function stableModulo(text: string, modulo: number): number {
  let value = 0;
  for (const char of text) {
    value = (value * 31 + char.charCodeAt(0)) % modulo;
  }
  return value;
}

async function buildPortabilityTrustPolicy(input: {
  mode: "off" | "advisory" | "required";
  trustedIssuers?: string[];
  revokedCredentialIds?: string[];
  revokedStatusIndexes?: string[];
  allowedCredentialTypes?: any[];
}) {
  const [entries, revokedCredentialIds, revokedStatus] = await Promise.all([
    db.listTrustRegistry({ isActive: true }),
    db.listRevokedCredentialIds(),
    db.listRevokedCredentialStatus(),
  ]);
  const policy = buildTrustRegistryPolicy({
    entries: entries as any[],
    mode: input.mode,
    revokedCredentialIds: [...(input.revokedCredentialIds ?? []), ...revokedCredentialIds, ...revokedStatus.credentialIds],
    revokedStatusIndexes: [...(input.revokedStatusIndexes ?? []), ...revokedStatus.statusListIndexes],
    allowedCredentialTypes: input.allowedCredentialTypes as any,
  });
  policy.trustedIssuers = Array.from(new Set([...(input.trustedIssuers ?? []), ...policy.trustedIssuers]));
  return policy;
}

function syncReceiptSubjectId(plan: any, fallback: string) {
  return String(
    plan?.outboundPayload?.row?.business_key
      ?? plan?.outboundPayload?.body?.subject?.reference
      ?? plan?.outboundPayload?.payload?.subject?.reference
      ?? plan?.outboundPayload?.conditionalUrl
      ?? fallback
  );
}
