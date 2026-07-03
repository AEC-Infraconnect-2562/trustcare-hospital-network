import { COOKIE_NAME, isSingletonType } from "@shared/const";
import { assessReadiness, readinessContextValues, type ReadinessContext } from "@shared/readiness";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  availableRolesForSystemRole,
  canActAsCredentialChecker,
  canActAsCredentialMaker,
  canHoldIssuerPrivileges,
  normalizeActiveRole,
  normalizeCredentialEntitlements,
  sanitizeAdditionalRolesForSystemRole,
} from "@shared/rolePolicy";
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
  auditTrustcareVcVpSeedDatabase,
  buildManifestResponse,
  buildShlinkPayload,
  buildSimulatedHisPayload,
  createPresentation,
  defaultScopesForContext,
  encryptShlFile,
  generateNumericPasscode,
  issueMedicalCertificateVc,
  issueCredential,
  issuePrescriptionVc,
  issueSyncReceiptVc,
  localIssuerJwks,
  manifestFileDigest,
  patientDidKey,
  purposeForContext,
  productionReadinessChecks,
  randomBase64UrlBytes,
  reseedTrustcareVcVpDatabase,
  reviewCsvForCanonicalMapping,
  RECOMMENDED_SYNC_TARGETS,
  sourceTruthConnectors,
  standardLabelCatalog,
  syncAdapterManifest,
  verifyCredential,
  verifyJsonPresentation,
  verifyPasscode,
  verifyPresentation,
  hashPasscode,
  scenarioForShlPurpose,
  type ConsentPurpose,
} from "./portability";
import { sha256 } from "./portability/utils";
import { resolveShlManifestAccessPacket, ShlAccessError } from "./shlAccess";
import { storagePut } from "./storage";
import {
  buildClaimPackageCredential,
  buildClaimWorkbench,
  buildPayerAdjudicationEnvelope,
  buildPaymentReconciliationEnvelope,
  buildPayerSubmissionEnvelope,
  parseCodes,
  parseServiceItems,
  validateClaimPacket,
} from "./claimCenter";
import {
  buildContractHubCatalog,
  buildDataMappingV2Profiles,
  buildPrepareServicePublicApiExamples,
  buildPrepareServiceWorkbench,
  buildServiceBundleEnvelope,
  buildServiceReadinessContracts,
  buildWalletDeploymentEnvelope,
  buildWalkInWalletConnection,
  simulatePrepareServiceImport,
} from "./prepareService";
import {
  buildCarePackageManifest,
  buildDocumentReference,
  buildServiceRequest,
  type CaseType,
  caseDocumentTypeValues,
  caseTypeFromReferralType,
  caseTypeValues,
  connectorTypeValues,
  defaultTasksForCase,
  packageTypeForCase,
  packageTypeValues,
  purposeForCarePackage,
  validatePartnerConnector,
} from "./careTransition";

const credentialTypeValues = [
  "patient_identity", "consent_receipt", "patient_summary", "allergy_alert", "medication_summary", "referral_vc", "immunization",
  "medical_certificate", "prescription", "lab_result", "diagnostic_report", "discharge_summary", "insurance_eligibility",
  "claim_package", "claim_receipt", "travel_document_verification", "shl_manifest", "pharmacy_dispense", "appointment",
  "visa_support_letter", "quotation", "guarantee_letter", "mpi_link_certificate", "sync_receipt",
] as const;

const shlPurposeValues = ["referral", "patient_summary", "discharge", "cross_border", "medical_tourist", "insurance", "self_share"] as const;

const portabilityContextValues = ["treatment", "cross_branch_referral", "cross_border", "e_claim", "medical_tourist", "emergency", "self_share"] as const;

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

// Staff-only guard (blocks patient role from clinical/partner operations)
const staffProcedure = protectedProcedure.use(({ ctx, next }) => {
  const systemRole = (ctx.user as any).systemRole;
  if (!systemRole || systemRole === "patient") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Staff access required. Patients cannot perform this operation." });
  }
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(async (opts) => {
      if (!opts.ctx.user) return null;
      const systemRole = (opts.ctx.user as any).systemRole ?? "patient";
      const additionalRoles = sanitizeAdditionalRolesForSystemRole(
        systemRole,
        (await db.getUserAdditionalRoles(opts.ctx.user.id)).map(r => r.role),
      );
      const activeRoleCookie = opts.ctx.req.cookies?.["trustcare_active_role"];
      return {
        ...opts.ctx.user,
        additionalRoles,
        activeRole: normalizeActiveRole(systemRole, activeRoleCookie, additionalRoles),
      };
    }),
    getDemoUsers: publicProcedure.query(async () => {
      return db.getDemoUsers();
    }),
    switchRole: protectedProcedure.input(z.object({ role: z.string() })).mutation(async ({ ctx, input }) => {
      const user = ctx.user as any;
      const additionalRoles = sanitizeAdditionalRolesForSystemRole(
        user.systemRole,
        (await db.getUserAdditionalRoles(ctx.user.id)).map((r: any) => r.role),
      );
      const allRoles = availableRolesForSystemRole(user.systemRole, additionalRoles);
      if (!allRoles.includes(input.role)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "ไม่สามารถสลับไปบทบาทนี้ได้" });
      }
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie("trustcare_active_role", input.role, { ...cookieOptions, maxAge: 86400000 });
      return { success: true, activeRole: input.role };
    }),
    getAvailableRoles: protectedProcedure.query(async ({ ctx }) => {
      const user = ctx.user as any;
      const additionalRoles = sanitizeAdditionalRolesForSystemRole(
        user.systemRole,
        (await db.getUserAdditionalRoles(ctx.user.id)).map((r: any) => r.role),
      );
      return availableRolesForSystemRole(user.systemRole, additionalRoles);
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
      // After seeding base users/hospitals, also seed VC/VP documents
      const result = await reseedTrustcareVcVpDatabase({
        patientsPerHospital: 12,
        resetExistingSeed: true,
      });
      return { success: true, vcVpSeed: result };
    }),
  }),
  // ============================================================
  // MAKER/CHECKER WORKFLOW (v2.2)
  // ============================================================
  makerChecker: router({
    myRequests: protectedProcedure.query(async ({ ctx }) => {
      return db.listCredentialRequests({ makerId: ctx.user.id });
    }),
    pendingReviews: protectedProcedure.query(async ({ ctx }) => {
      await requireMakerCheckerRole(ctx.user, "checker");
      return db.listCredentialRequests({ status: "pending_review" });
    }),
    myReviews: protectedProcedure.query(async ({ ctx }) => {
      await requireMakerCheckerRole(ctx.user, "checker");
      return db.listCredentialRequests({ checkerId: ctx.user.id });
    }),
    pendingCount: protectedProcedure.query(async ({ ctx }) => {
      await requireMakerCheckerRole(ctx.user, "checker");
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
      await requireMakerCheckerRole(ctx.user, "maker");
      const requestNumber = `REQ-${Date.now().toString(36).toUpperCase()}`;
      const result = await db.createCredentialRequest({
        requestNumber,
        makerId: ctx.user.id,
        templateId: input.templateId ?? 0,
        patientId: input.patientId,
        hospitalId: input.hospitalId,
        status: "draft",
        credentialData: input.requestData,
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
      await requireMakerCheckerRole(ctx.user, "maker");
      const request = await db.getCredentialRequestById(input.id);
      if (!request) throw new TRPCError({ code: "NOT_FOUND" });
      if (request.makerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      await db.updateCredentialRequest(input.id, { status: "pending_review", submittedAt: new Date() });
      // Notify the maker
      await db.createNotification({
        userId: ctx.user.id,
        type: "vc_submitted_for_review" as any,
        title: "ส่งคำขอตรวจสอบ",
        message: `คำขอ ${request.requestNumber} ถูกส่งตรวจสอบแล้ว`,
      });
      // Notify all checkers about the new pending review
      const checkerIds = await db.getCheckerUserIds(request.hospitalId);
      const checkerNotifications = checkerIds
        .filter(id => id !== ctx.user.id) // Don't notify the maker themselves
        .map(checkerId => db.createNotification({
          userId: checkerId,
          type: "vc_pending_review" as any,
          title: "มีคำขอ VC ใหม่รอตรวจสอบ",
          message: `คำขอ ${request.requestNumber} จาก ${ctx.user.name} รอการตรวจสอบ${request.priority === 'urgent' ? ' (เร่งด่วน)' : ''}`,
        }));
      await Promise.all(checkerNotifications);
      return { success: true };
    }),
    cancelRequest: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      const request = await db.getCredentialRequestById(input.id);
      if (!request) throw new TRPCError({ code: "NOT_FOUND" });
      if (request.makerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      await db.updateCredentialRequest(input.id, { status: "cancelled" });
      return { success: true };
    }),
    approve: protectedProcedure.input(z.object({ id: z.number(), comment: z.string().optional() })).mutation(async ({ ctx, input }) => {
      const request = await db.getCredentialRequestById(input.id);
      if (!request) throw new TRPCError({ code: "NOT_FOUND" });
      if (request.makerId === ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "ไม่สามารถอนุมัติคำขอตัวเองได้" });
      await db.updateCredentialRequest(input.id, { status: "approved", checkerId: ctx.user.id, checkerComment: input.comment, reviewedAt: new Date() });
      // Auto-issue VC
      const credential = await db.createIssuedCredential({
        credentialId: `vc-${nanoid(12)}`,
        type: "patient_summary" as any,
        subjectId: request.patientId,
        issuerHospitalId: request.hospitalId ?? 1,
        issuerId: ctx.user.id,
        templateId: request.templateId ?? 0,
        credentialData: request.credentialData as any,
        status: "active",
      });
      await db.updateCredentialRequest(input.id, { status: "issued", issuedCredentialId: (credential as any)?.id, issuedAt: new Date() });
      await db.createNotification({
        userId: request.makerId,
        type: "vc_approved" as any,
        title: "คำขอ VC ได้รับอนุมัติ",
        message: `คำขอ #${input.id} ได้รับอนุมัติและออก VC แล้ว`,
      });
      return { success: true };
    }),
    reject: protectedProcedure.input(z.object({ id: z.number(), comment: z.string() })).mutation(async ({ ctx, input }) => {
      const request = await db.getCredentialRequestById(input.id);
      if (!request) throw new TRPCError({ code: "NOT_FOUND" });
      await db.updateCredentialRequest(input.id, { status: "rejected", checkerId: ctx.user.id, checkerComment: input.comment, reviewedAt: new Date() });
      await db.createNotification({
        userId: request.makerId,
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
    cardsByCategory: protectedProcedure.query(async ({ ctx }) => {
      const cards = await db.listWalletCards(ctx.user.id);
      const allCreds = await db.listIssuedCredentials({ subjectId: ctx.user.id });
      const credMap = new Map(allCreds.map((c: any) => [c.id, c]));
      const enriched = cards.map((card: any) => {
        const cred = credMap.get(card.credentialId);
        return {
          ...card,
          credentialStatus: cred?.status || 'active',
          expiresAt: cred?.expiresAt || null,
          credentialData: cred?.credentialData || null,
          credentialType: cred?.type || card.cardType,
          issuedAt: cred?.issuedAt || card.createdAt,
        };
      });
      const grouped: Record<string, any[]> = {};
      for (const card of enriched) {
        const cat = card.documentCategory || 'operations';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(card);
      }
      return grouped;
    }),
    readiness: protectedProcedure.input(z.object({
      context: z.enum(readinessContextValues).default("opd_visit"),
      patientId: z.number().optional(),
    }).optional()).query(async ({ ctx, input }) => {
      const patientId = resolveWalletPatientId(ctx, input?.patientId);
      const cards = await enrichedWalletCards(patientId);
      const readiness = assessReadiness(cards, input?.context ?? "opd_visit");
      const requests = await db.listWalletDocumentRequests({ patientId, context: input?.context, limit: 20 });
      const previousChecks = await db.listServiceReadinessChecks({ patientId, context: input?.context, limit: 5 });
      return { patientId, readiness, requests, previousChecks };
    }),
    prepareWorkbench: protectedProcedure.input(z.object({
      context: z.enum(readinessContextValues).default("opd_visit"),
      patientId: z.number().optional(),
    }).optional()).query(async ({ ctx, input }) => {
      const patientId = resolveWalletPatientId(ctx, input?.patientId);
      const cards = await enrichedWalletCards(patientId);
      return buildPrepareServiceWorkbench({
        context: input?.context ?? "opd_visit",
        patientId,
        cards,
      });
    }),
    prepareContracts: protectedProcedure.query(() => {
      return buildServiceReadinessContracts();
    }),
    contractHub: protectedProcedure.query(() => {
      return buildContractHubCatalog();
    }),
    dataMappingV2: protectedProcedure.query(() => {
      return buildDataMappingV2Profiles();
    }),
    prepareApiExamples: protectedProcedure.input(z.object({
      context: z.enum(readinessContextValues).default("opd_visit"),
    }).optional()).query(({ input }) => {
      return buildPrepareServicePublicApiExamples(input?.context ?? "opd_visit");
    }),
    buildServiceBundle: protectedProcedure.input(z.object({
      context: z.enum(readinessContextValues),
      patientId: z.number().optional(),
      audience: z.enum(["patient", "hospital", "integration_engineer", "partner"]).default("patient"),
      receiver: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const patientId = resolveWalletPatientId(ctx, input.patientId);
      const cards = await enrichedWalletCards(patientId);
      return buildServiceBundleEnvelope({
        context: input.context,
        audience: input.audience,
        patientId,
        cards,
        receiver: input.receiver,
      });
    }),
    deployBundleToWallet: protectedProcedure.input(z.object({
      context: z.enum(readinessContextValues),
      hospitalId: z.number().optional(),
      targetPatientIds: z.array(z.number()).optional(),
      targetWalletMode: z.enum(["single", "appointment_list", "cohort", "walk_in", "external_wallet"]).default("single"),
      issueDocuments: z.array(z.string()).optional(),
    })).mutation(async ({ ctx, input }) => {
      const envelope = buildWalletDeploymentEnvelope(input);
      await db.createAuditEvent({
        actorId: ctx.user.id,
        actorRole: (ctx.user as any).systemRole,
        action: "wallet.prepare_service.deployment_simulated",
        resourceType: "wallet_deployment",
        resourceId: envelope.deploymentId,
        details: { context: input.context, targetWalletMode: input.targetWalletMode, targets: envelope.counts.targets },
      });
      return envelope;
    }),
    connectWalkInWallet: protectedProcedure.input(z.object({
      patientName: z.string().optional(),
      phone: z.string().optional(),
      passport: z.string().optional(),
      consentAttested: z.boolean().default(false),
    })).mutation(async ({ ctx, input }) => {
      const connection = buildWalkInWalletConnection(input);
      await db.createAuditEvent({
        actorId: ctx.user.id,
        actorRole: (ctx.user as any).systemRole,
        action: "wallet.prepare_service.walkin_wallet_simulated",
        resourceType: "wallet_connection",
        resourceId: connection.connectionId,
        details: { status: connection.status, patientIdentityConfidence: connection.patientIdentityConfidence },
      });
      return connection;
    }),
    importForService: protectedProcedure.input(z.object({
      context: z.enum(readinessContextValues),
      patientId: z.number().optional(),
      sourceType: z.string().default("patient_upload"),
      documentType: z.string().optional(),
      consentRef: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const patientId = resolveWalletPatientId(ctx, input.patientId);
      const result = simulatePrepareServiceImport({ ...input, patientId });
      await db.createAuditEvent({
        actorId: ctx.user.id,
        actorRole: (ctx.user as any).systemRole,
        action: "wallet.prepare_service.import_simulated",
        resourceType: "wallet_import_job",
        resourceId: result.importId,
        details: { context: input.context, documentType: result.documentType, sourceType: input.sourceType, dqiScore: result.dqiScore },
      });
      return result;
    }),
    documentRequests: protectedProcedure.input(z.object({
      context: z.enum(readinessContextValues).optional(),
      patientId: z.number().optional(),
      status: z.string().optional(),
    }).optional()).query(async ({ ctx, input }) => {
      const patientId = resolveWalletPatientId(ctx, input?.patientId);
      return db.listWalletDocumentRequests({
        patientId,
        context: input?.context,
        status: input?.status,
        limit: 50,
      });
    }),
    requestDocument: protectedProcedure.input(z.object({
      context: z.enum(readinessContextValues),
      patientId: z.number().optional(),
      documentType: z.string().min(1),
      documentCategory: z.string().optional(),
      sourceType: z.enum(["his", "lis", "ris", "pacs", "hospital_app", "national_app", "partner_portal", "payer", "patient_upload", "personal_health_app", "other"]).default("his"),
      sourceName: z.string().optional(),
      targetHospitalId: z.number().optional(),
      notes: z.string().optional(),
      consentAttested: z.boolean().default(false),
    })).mutation(async ({ ctx, input }) => {
      const patientId = resolveWalletPatientId(ctx, input.patientId);
      const requestId = `wdr_${nanoid(16)}`;
      const id = await db.createWalletDocumentRequest({
        requestId,
        patientId,
        context: input.context,
        documentType: input.documentType,
        documentCategory: input.documentCategory,
        sourceType: input.sourceType,
        sourceName: input.sourceName,
        targetHospitalId: input.targetHospitalId,
        status: input.consentAttested ? "requested" : "pending_consent",
        requestedBy: ctx.user.id,
        notes: input.notes,
        metadata: {
          requestedFromWallet: true,
          consentAttested: input.consentAttested,
          sourcePurpose: "feed_patient_wallet",
        },
      } as any);
      await db.createAuditEvent({
        actorId: ctx.user.id,
        actorRole: (ctx.user as any).systemRole,
        action: "wallet.document_request.created",
        resourceType: "wallet_document_request",
        resourceId: String(id),
        details: { requestId, context: input.context, documentType: input.documentType, sourceType: input.sourceType },
      });
      return { id, requestId, status: input.consentAttested ? "requested" : "pending_consent" };
    }),
    buildServicePacket: protectedProcedure.input(z.object({
      context: z.enum(readinessContextValues),
      patientId: z.number().optional(),
      hospitalId: z.number().optional(),
      serviceName: z.string().optional(),
      receiverName: z.string().optional(),
      selectedCardIds: z.array(z.number()).optional(),
      consentAttested: z.boolean().default(false),
      validMinutes: z.number().min(15).max(10080).default(24 * 60),
    })).mutation(async ({ ctx, input }) => {
      const patientId = resolveWalletPatientId(ctx, input.patientId);
      const cards = await enrichedWalletCards(patientId);
      const readiness = assessReadiness(cards, input.context);
      const allowedCardIds = new Set(input.selectedCardIds?.length ? input.selectedCardIds : readiness.selectedCardIds);
      const selectedCards = cards.filter((card: any) => typeof card.id === "number" && allowedCardIds.has(card.id));
      const credentialRowIds = selectedCards.map((card: any) => Number(card.credentialId)).filter(Boolean);
      const credentialRows = (await db.listIssuedCredentials({ subjectId: patientId, status: "active" }))
        .filter((row: any) => credentialRowIds.includes(row.id))
        .filter((row: any) => row.sdJwtVc);
      if (!credentialRows.length) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No signed VC is available for the selected wallet packet. Request or issue wallet documents first." });
      }
      if (!input.consentAttested) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Contextual consent is required before building a service packet." });
      }
      const purpose = servicePacketPurpose(input.context);
      const presentation = await createPresentation({
        holderDid: defaultHolderDid(patientId),
        credentials: credentialRows.map(issuedCredentialRowToIssuedVc),
        purpose,
        audience: input.receiverName ?? input.serviceName ?? "TrustCare hospital intake",
        validMinutes: input.validMinutes,
      });
      await db.createIssuedPresentation({
        presentationId: presentation.id,
        patientId,
        holderDid: defaultHolderDid(patientId),
        context: input.context,
        purpose,
        audience: input.receiverName ?? input.serviceName,
        presentationJwt: presentation.jwt,
        credentialIds: presentation.credentialIds,
        credentialRowIds: credentialRows.map((row: any) => row.id),
        verifier: input.receiverName ?? "hospital-intake",
        status: "active",
        expiresAt: new Date(presentation.expiresAt),
        metadata: {
          readinessScore: readiness.score,
          criticalReady: readiness.criticalReady,
          selectedCardIds: Array.from(allowedCardIds),
          serviceName: input.serviceName,
          consentAttested: input.consentAttested,
        },
      } as any);
      const checkId = await db.createServiceReadinessCheck({
        patientId,
        context: input.context,
        hospitalId: input.hospitalId,
        serviceName: input.serviceName,
        score: readiness.score,
        criticalReady: readiness.criticalReady,
        requiredMissing: readiness.missing.filter((item) => item.required),
        recommendedMissing: readiness.missing.filter((item) => !item.required),
        selectedCredentialIds: credentialRows.map((row: any) => row.credentialId),
        packetPresentationId: presentation.id,
        status: "shared",
        createdBy: ctx.user.id,
        metadata: {
          receiverName: input.receiverName,
          purpose,
          consentAttested: input.consentAttested,
          missingActions: readiness.recommendedActions,
        },
      } as any);
      await db.createAuditEvent({
        actorId: ctx.user.id,
        actorRole: (ctx.user as any).systemRole,
        action: "wallet.service_packet.created",
        resourceType: "service_readiness_check",
        resourceId: String(checkId),
        details: { context: input.context, score: readiness.score, presentationId: presentation.id, credentialCount: credentialRows.length },
      });
      const proto = ctx.req.headers["x-forwarded-proto"] || ctx.req.protocol || "https";
      const host = ctx.req.headers["x-forwarded-host"] || ctx.req.headers.host || "";
      return {
        checkId,
        patientId,
        readiness,
        presentationId: presentation.id,
        expiresAt: presentation.expiresAt,
        credentialCount: credentialRows.length,
        qrData: `${proto}://${host}/verifier?vp=${presentation.id}`,
      };
    }),
    superseded: protectedProcedure.query(async ({ ctx }) => {
      const allCreds = await db.listIssuedCredentials({ subjectId: ctx.user.id });
      return allCreds.filter((c: any) => c.status === 'revoked' || c.status === 'expired');
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
      // QR Code has ~2,953 byte limit; JWT is too large.
      // Use a short verification URL that the verifier can resolve.
      const proto = ctx.req.headers["x-forwarded-proto"] || ctx.req.protocol || "https";
      const host = ctx.req.headers["x-forwarded-host"] || ctx.req.headers.host || "";
      const origin = `${proto}://${host}`;
      const qrUrl = `${origin}/verifier?vp=${presentation.presentationId}`;
      return {
        presentationId: presentation.presentationId,
        format: "jwt-vp",
        expiresAt: presentation.expiresAt?.toISOString(),
        qrData: qrUrl,
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
        // TAO Trust Registry check
        let taoTrust: { trusted: boolean; level: string; anchor: string; reason?: string } | null = null;
        const firstCred = presentation.verifiableCredential?.[0];
        if (firstCred) {
          const issuerDid = typeof firstCred.issuer === "string" ? firstCred.issuer : firstCred.issuer?.id;
          const credType = Array.isArray(firstCred.type) ? firstCred.type.find((t: string) => t !== "VerifiableCredential") || "VerifiableCredential" : firstCred.type;
          if (issuerDid) taoTrust = await db.checkIssuerTrust(issuerDid, credType);
        }
        const effectiveTrustLevel = taoTrust && !taoTrust.trusted ? "red" : result.trustLevel;
        await db.createAuditEvent({
          action: "verifier.vp_json.verified",
          resourceType: "verifiable_presentation",
          resourceId: String(result.presentationId ?? "json-vp"),
          details: { trustLevel: effectiveTrustLevel, verified: result.verified, purpose: result.purpose, taoTrust },
        });
        return {
          trustLevel: effectiveTrustLevel,
          verified: result.verified,
          issuer: "TrustCare JSON VP",
          holderDid: result.holderDid,
          credentials: presentation.verifiableCredential ?? [],
          highPriority: result.highPriority,
          warnings: taoTrust?.reason ? [...(result.warnings || []), `TAO: ${taoTrust.reason}`] : result.warnings,
          errors: result.errors,
          taoTrust,
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
    verifyQrScan: publicProcedure.input(z.object({
      qrData: z.string().min(1, "QR data is required"),
      source: z.enum(["camera", "file_upload"]).default("camera"),
    })).mutation(async ({ input }) => {
      const { qrData, source } = input;
      let parsed: string = qrData;

      // If QR contains a URL (e.g., https://trustcare.../verify?token=...), extract the token
      if (qrData.startsWith("http")) {
        try {
          const url = new URL(qrData);
          parsed = url.searchParams.get("token") || url.searchParams.get("vp") || url.searchParams.get("vc") || qrData;
        } catch {
          // Not a valid URL, use raw data
        }
      }

      // If parsed looks like a presentationId (not JWT/JSON), resolve from DB
      if (!parsed.startsWith("{") && !parsed.startsWith("eyJ") && !parsed.startsWith("http") && parsed.length < 300) {
        const storedPresentation = await db.getIssuedPresentationByPresentationId(parsed);
        if (storedPresentation?.presentationJwt) {
          parsed = storedPresentation.presentationJwt;
        }
      }

      // Attempt to decode base64-encoded QR payloads
      if (!parsed.startsWith("{") && !parsed.startsWith("eyJ")) {
        try {
          const decoded = Buffer.from(parsed, "base64").toString("utf-8");
          if (decoded.startsWith("{") || decoded.startsWith("eyJ")) {
            parsed = decoded;
          }
        } catch {
          // Not base64, use as-is
        }
      }

      // Verify using the same logic as the main verify endpoint
      let result: any;
      if (parsed.trim().startsWith("{")) {
        try {
          const presentation = JSON.parse(parsed);
          const verResult = verifyJsonPresentation({ presentation });
          result = {
            trustLevel: verResult.trustLevel,
            verified: verResult.verified,
            issuer: "TrustCare JSON VP",
            holderDid: verResult.holderDid,
            credentials: presentation.verifiableCredential ?? [],
            highPriority: verResult.highPriority,
            warnings: verResult.warnings,
            errors: verResult.errors,
          };
        } catch (e: any) {
          result = {
            trustLevel: "red" as const,
            verified: false,
            issuer: "TrustCare Verifier",
            warnings: [],
            errors: [`Invalid JSON in QR code: ${e.message}`],
          };
        }
      } else if (parsed.startsWith("eyJ")) {
        const vpResult = await verifyPresentation({ jwt: parsed });
        if (vpResult.verified || vpResult.credentials.length > 0) {
          result = {
            trustLevel: vpResult.trustLevel,
            verified: vpResult.verified,
            issuer: vpResult.credentials[0]?.issuer?.name ?? vpResult.credentials[0]?.issuer?.id ?? "Unknown issuer",
            holderDid: vpResult.holderDid,
            credentials: vpResult.credentials,
            warnings: vpResult.warnings,
            errors: vpResult.errors,
          };
        } else {
          const credResult = await verifyCredential({ jwt: parsed });
          result = {
            trustLevel: credResult.trustLevel,
            verified: credResult.verified,
            issuer: credResult.issuer,
            credential: credResult.credential,
            warnings: credResult.warnings,
            errors: credResult.errors,
          };
        }
      } else {
        result = {
          trustLevel: "red" as const,
          verified: false,
          issuer: "TrustCare Verifier",
          warnings: [],
          errors: ["QR code does not contain a valid VC/VP format (JSON or JWT)."],
        };
      }

      // Audit trail for QR scan verification
      await db.createAuditEvent({
        action: `verifier.qr_scan.${source}`,
        resourceType: "verifiable_presentation",
        resourceId: `qr-${source}-${Date.now()}`,
        details: { trustLevel: result.trustLevel, verified: result.verified, source, qrDataLength: qrData.length },
      });

      return { ...result, scanSource: source };
    }),
    // VP Packet verification at service point (staff scanner)
    verifyServicePacket: staffProcedure.input(z.object({
      presentationId: z.string().min(1, "Presentation ID is required"),
    })).mutation(async ({ ctx, input }) => {
      // 1. Look up the stored presentation
      const storedPresentation = await db.getIssuedPresentationByPresentationId(input.presentationId);
      if (!storedPresentation) {
        return {
          verified: false,
          trustLevel: "red" as const,
          error: "Presentation not found. The QR code may be invalid or expired.",
          patient: null,
          credentials: [],
          readiness: null,
        };
      }

      // 2. Check expiration
      const isExpired = storedPresentation.expiresAt && new Date(storedPresentation.expiresAt) < new Date();
      if (isExpired || storedPresentation.status !== "active") {
        return {
          verified: false,
          trustLevel: "red" as const,
          error: isExpired ? "This service packet has expired." : `Presentation status: ${storedPresentation.status}`,
          patient: null,
          credentials: [],
          readiness: null,
        };
      }

      // 3. Verify the JWT
      let verificationResult: any;
      if (storedPresentation.presentationJwt) {
        const { verifyPresentation } = await import("./portability");
        verificationResult = await verifyPresentation({ jwt: storedPresentation.presentationJwt });
      }

      // 4. Get patient info
      const patient = await db.getUserById(storedPresentation.patientId);

      // 5. Get the credentials included in this presentation
      const credentialRowIds = (storedPresentation.credentialRowIds as number[]) || [];
      const credentials = [];
      for (const credId of credentialRowIds) {
        const cred = await db.getCredentialById(credId);
        if (cred) {
          credentials.push({
            id: cred.id,
            credentialId: cred.credentialId,
            type: cred.type,
            status: cred.status,
            documentCategory: cred.documentCategory,
            issuedAt: cred.issuedAt,
            expiresAt: cred.expiresAt,
            credentialData: cred.credentialData,
            issuerHospitalId: cred.issuerHospitalId,
          });
        }
      }

      // 6. Get readiness metadata from the presentation
      const meta = (storedPresentation.metadata as any) || {};
      const readiness = {
        score: meta.readinessScore ?? null,
        criticalReady: meta.criticalReady ?? null,
        context: storedPresentation.context,
        purpose: storedPresentation.purpose,
      };

      // 7. Clinical-risk ordering of credentials
      const clinicalPriority: Record<string, number> = {
        allergy_alert: 1,
        medication_summary: 2,
        patient_summary: 3,
        lab_result: 4,
        diagnostic_report: 5,
        discharge_summary: 6,
        immunization: 7,
        prescription: 8,
        pharmacy_dispense: 9,
        referral_vc: 10,
        medical_certificate: 11,
        consent_receipt: 12,
        patient_identity: 13,
        insurance_eligibility: 14,
        claim_package: 15,
        travel_document_verification: 16,
        quotation: 17,
        guarantee_letter: 18,
        visa_support_letter: 19,
      };
      credentials.sort((a, b) => (clinicalPriority[a.type] ?? 99) - (clinicalPriority[b.type] ?? 99));

      // 8. Determine trust level
      const trustLevel = verificationResult?.verified
        ? (verificationResult.trustLevel || "green")
        : (credentials.length > 0 ? "amber" : "red");

      // 9. Audit trail
      await db.recordServiceVerification({
        presentationId: input.presentationId,
        patientId: storedPresentation.patientId,
        verifiedBy: ctx.user.id,
        verifierRole: (ctx.user as any).systemRole,
        context: storedPresentation.context,
        score: meta.readinessScore,
        credentialCount: credentials.length,
        trustLevel,
        verified: verificationResult?.verified ?? false,
      });

      return {
        verified: verificationResult?.verified ?? (credentials.length > 0),
        trustLevel,
        patient: patient ? {
          id: patient.id,
          name: patient.name,
          openId: patient.openId,
          avatarUrl: patient.avatarUrl,
        } : null,
        credentials,
        readiness,
        presentation: {
          id: storedPresentation.presentationId,
          context: storedPresentation.context,
          purpose: storedPresentation.purpose,
          audience: storedPresentation.audience,
          createdAt: storedPresentation.createdAt,
          expiresAt: storedPresentation.expiresAt,
          holderDid: storedPresentation.holderDid,
        },
        warnings: verificationResult?.warnings || [],
      };
    }),
    // Confirm service check-in after VP verification
    confirmServiceCheckin: staffProcedure.input(z.object({
      presentationId: z.string().min(1),
      serviceName: z.string().optional(),
      hospitalId: z.number().optional(),
      notes: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const storedPresentation = await db.getIssuedPresentationByPresentationId(input.presentationId);
      if (!storedPresentation) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Presentation not found" });
      }
      // Record the service check-in event
      await db.createAuditEvent({
        actorId: ctx.user.id,
        actorRole: (ctx.user as any).systemRole,
        action: "service_point.patient_checked_in",
        resourceType: "verifiable_presentation",
        resourceId: input.presentationId,
        details: {
          patientId: storedPresentation.patientId,
          context: storedPresentation.context,
          serviceName: input.serviceName,
          hospitalId: input.hospitalId,
          notes: input.notes,
          verifiedBy: ctx.user.id,
        },
      });
      return {
        success: true,
        patientId: storedPresentation.patientId,
        checkedInAt: new Date().toISOString(),
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
    check: protectedProcedure.input(z.object({
      patientId: z.number(),
      purpose: z.enum(["treatment", "referral", "research", "insurance", "public_health", "emergency"]),
      hospitalId: z.number().optional(),
      doctorId: z.number().optional(),
    })).query(async ({ input }) => {
      const records = await db.listConsentRecords(input.patientId);
      const active = records.find((r: any) =>
        r.status === "granted" &&
        r.purpose === input.purpose &&
        (!input.hospitalId || r.grantedToHospitalId === input.hospitalId) &&
        (!input.doctorId || r.grantedToDoctorId === input.doctorId) &&
        (!r.expiresAt || new Date(r.expiresAt) > new Date())
      );
      return { hasConsent: !!active, consentId: active?.id || null, expiresAt: active?.expiresAt || null };
    }),
    expiringWithinDays: protectedProcedure.input(z.object({
      days: z.number().min(1).max(30).default(7),
    }).optional()).query(async ({ input }) => {
      const days = input?.days ?? 7;
      const records = await db.findConsentsExpiringWithinDays(days);
      return records.map((r: any) => ({
        id: r.id,
        patientId: r.patientId,
        purpose: r.purpose,
        expiresAt: r.expiresAt,
        grantedAt: r.grantedAt,
        daysUntilExpiry: Math.ceil((new Date(r.expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
      }));
    }),
    history: protectedProcedure.input(z.object({
      patientId: z.number().optional(),
    })).query(async ({ ctx, input }) => {
      const patientId = input.patientId || ctx.user.id;
      const records = await db.listConsentRecords(patientId);
      return records.map((r: any) => ({
        ...r,
        actorId: r.patientId,
        action: r.status === "revoked" ? "consent.revoked" : "consent.granted",
        timestamp: r.status === "revoked" ? r.revokedAt : r.grantedAt,
      }));
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
    unreadCount: protectedProcedure.query(async ({ ctx }) => {
      return db.getUnreadNotificationCount(ctx.user.id);
    }),
    markRead: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await db.markNotificationRead(input.id);
      return { success: true };
    }),
    markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
      await db.markAllNotificationsRead(ctx.user.id);
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
      if (!canHoldIssuerPrivileges(input.systemRole)) {
        input.credentialEntitlements = { makerTypes: [], checkerTypes: [] };
        await Promise.all([
          db.removeUserRole(input.id, "issuer_maker"),
          db.removeUserRole(input.id, "issuer_checker"),
        ]);
      }
      if ((input.systemRole === "maker" || input.systemRole === "checker") && !input.hospitalId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Maker/Checker users must be linked to a hospital." });
      }
      await db.updateUserProfile(input.id, {
        systemRole: input.systemRole,
        hospitalId: input.hospitalId,
        credentialEntitlements: normalizeCredentialEntitlements(input.systemRole, input.credentialEntitlements),
      } as any);
      return { success: true };
    }),
    uploadPhoto: protectedProcedure.input(z.object({
      photoBase64: z.string().min(1),
      mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]).default("image/jpeg"),
    })).mutation(async ({ ctx, input }) => {
      const buffer = Buffer.from(input.photoBase64, "base64");
      // Limit to 2MB
      if (buffer.length > 2 * 1024 * 1024) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Photo must be under 2MB" });
      }
      const ext = input.mimeType === "image/png" ? "png" : input.mimeType === "image/webp" ? "webp" : "jpg";
      const fileKey = `patient-photos/${ctx.user.id}/avatar.${ext}`;
      const { url } = await storagePut(fileKey, buffer, input.mimeType);
      await db.updateUserProfile(ctx.user.id, { avatarUrl: url } as any);
      return { url };
    }),
    getPhoto: publicProcedure.input(z.object({ userId: z.number() })).query(async ({ input }) => {
      const user = await db.getUserById(input.userId);
      return { avatarUrl: user?.avatarUrl || null };
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
  // TAO TRUST FRAMEWORK
  // ============================================================
  tao: router({
    issuers: protectedProcedure.input(z.object({
      trustLevel: z.string().optional(),
      organizationType: z.string().optional(),
      trustAnchor: z.string().optional(),
    }).optional()).query(async ({ input }) => {
      return db.listTaoIssuers(input || undefined);
    }),
    createIssuer: adminProcedure.input(z.object({
      did: z.string().min(1),
      name: z.string().min(1),
      nameEn: z.string().optional(),
      organizationType: z.enum(["hospital", "clinic", "lab", "pharmacy", "government", "insurance", "international"]),
      country: z.string().optional(),
      jurisdiction: z.string().optional(),
      trustLevel: z.enum(["accredited", "recognized", "self_declared", "pending", "suspended", "revoked"]).optional(),
      accreditationBody: z.string().optional(),
      accreditationId: z.string().optional(),
      credentialTypesAllowed: z.any().optional(),
      trustAnchor: z.enum(["etda", "gdhcn", "moph", "nhso", "self"]).optional(),
      contactEmail: z.string().optional(),
      contactUrl: z.string().optional(),
      hospitalId: z.number().optional(),
    })).mutation(async ({ input }) => {
      const id = await db.createTaoIssuer(input as any);
      return { id, success: true };
    }),
    updateIssuer: adminProcedure.input(z.object({
      id: z.number(),
      trustLevel: z.enum(["accredited", "recognized", "self_declared", "pending", "suspended", "revoked"]).optional(),
      isActive: z.boolean().optional(),
      credentialTypesAllowed: z.any().optional(),
      trustAnchor: z.enum(["etda", "gdhcn", "moph", "nhso", "self"]).optional(),
    })).mutation(async ({ input }) => {
      const { id, ...data } = input;
      await db.updateTaoIssuer(id, data as any);
      return { success: true };
    }),
    verifiers: protectedProcedure.input(z.object({
      trustLevel: z.string().optional(),
      organizationType: z.string().optional(),
    }).optional()).query(async ({ input }) => {
      return db.listTaoVerifiers(input || undefined);
    }),
    createVerifier: adminProcedure.input(z.object({
      did: z.string().min(1),
      name: z.string().min(1),
      nameEn: z.string().optional(),
      organizationType: z.enum(["hospital", "clinic", "insurance", "government", "employer", "border_control", "research"]),
      country: z.string().optional(),
      trustLevel: z.enum(["accredited", "recognized", "self_declared", "pending", "suspended", "revoked"]).optional(),
      credentialTypesAccepted: z.any().optional(),
      purposesAllowed: z.any().optional(),
      trustAnchor: z.enum(["etda", "gdhcn", "moph", "nhso", "self"]).optional(),
      contactEmail: z.string().optional(),
      hospitalId: z.number().optional(),
    })).mutation(async ({ input }) => {
      const id = await db.createTaoVerifier(input as any);
      return { id, success: true };
    }),
    updateVerifier: adminProcedure.input(z.object({
      id: z.number(),
      trustLevel: z.enum(["accredited", "recognized", "self_declared", "pending", "suspended", "revoked"]).optional(),
      isActive: z.boolean().optional(),
    })).mutation(async ({ input }) => {
      const { id, ...data } = input;
      await db.updateTaoVerifier(id, data as any);
      return { success: true };
    }),
    policies: protectedProcedure.input(z.object({
      credentialType: z.string().optional(),
      enforcementMode: z.string().optional(),
    }).optional()).query(async ({ input }) => {
      return db.listTaoPolicies(input || undefined);
    }),
    createPolicy: adminProcedure.input(z.object({
      credentialType: z.string().min(1),
      requiredTrustLevel: z.enum(["accredited", "recognized", "self_declared", "any"]).optional(),
      requiredTrustAnchor: z.enum(["etda", "gdhcn", "moph", "nhso", "any"]).optional(),
      enforcementMode: z.enum(["strict", "advisory", "off"]).optional(),
      description: z.string().optional(),
      descriptionEn: z.string().optional(),
    })).mutation(async ({ input }) => {
      const id = await db.createTaoPolicy(input as any);
      return { id, success: true };
    }),
    updatePolicy: adminProcedure.input(z.object({
      id: z.number(),
      requiredTrustLevel: z.enum(["accredited", "recognized", "self_declared", "any"]).optional(),
      requiredTrustAnchor: z.enum(["etda", "gdhcn", "moph", "nhso", "any"]).optional(),
      enforcementMode: z.enum(["strict", "advisory", "off"]).optional(),
      isActive: z.boolean().optional(),
    })).mutation(async ({ input }) => {
      const { id, ...data } = input;
      await db.updateTaoPolicy(id, data as any);
      return { success: true };
    }),
    checkIssuerTrust: protectedProcedure.input(z.object({
      issuerDid: z.string(),
      credentialType: z.string(),
    })).query(async ({ input }) => {
      return db.checkIssuerTrust(input.issuerDid, input.credentialType);
    }),
  }),
  // ============================================================
  // SMART HEALTH LINKS (SHL)
  // ============================================================
  shl: router({
    patientOptions: protectedProcedure.query(async ({ ctx }) => {
      const access = await shlActorAccess(ctx);
      if (access.activeRole === "patient") {
        return [{
          id: ctx.user.id,
          name: (ctx.user as any).name,
          email: (ctx.user as any).email,
          systemRole: "patient",
          hospitalId: (ctx.user as any).hospitalId,
        }];
      }
      return db.listUsers({
        systemRole: "patient",
        hospitalId: access.hospitalScoped ? (ctx.user as any).hospitalId : undefined,
      });
    }),
    simulatorScenarios: protectedProcedure.query(() => {
      return [
        { id: "patient_summary", purpose: "patient_summary", context: "treatment", label: "Patient summary", description: "IPS-style summary with medications, observations, and source document references." },
        { id: "cross_branch_referral", purpose: "referral", context: "cross_branch_referral", label: "Cross-branch referral", description: "Referral packet with recent labs and imaging references." },
        { id: "cross_border", purpose: "cross_border", context: "cross_border", label: "Cross-border care", description: "International summary and translated referral material." },
        { id: "e_claim", purpose: "insurance", context: "e_claim", label: "E-claim packet", description: "Coverage, claim package, invoice summary, and clinical evidence." },
        { id: "medical_tourist", purpose: "medical_tourist", context: "medical_tourist", label: "Medical tourist intake", description: "Travel document, quotation, guarantee letter, and visa support evidence." },
        { id: "discharge", purpose: "discharge", context: "treatment", label: "Discharge handoff", description: "Discharge summary, medication reconciliation, and follow-up plan." },
        { id: "self_share", purpose: "self_share", context: "self_share", label: "Patient self-share", description: "Patient-controlled wallet snapshot with consent receipt." },
      ];
    }),
    list: protectedProcedure.input(z.object({
      patientId: z.number().optional(),
      hospitalId: z.number().optional(),
      status: z.enum(["pending_review", "active", "expired", "revoked", "disabled", "max_accessed"]).optional(),
      purpose: z.enum(shlPurposeValues).optional(),
    }).optional()).query(async ({ ctx, input }) => {
      const access = await shlActorAccess(ctx);
      if (access.activeRole === "patient") {
        if (input?.patientId && input.patientId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Patients can list only their own Smart Health Links." });
        }
        return db.listSmartHealthLinks({ patientId: ctx.user.id, status: input?.status, purpose: input?.purpose });
      }
      return db.listSmartHealthLinks({
        patientId: input?.patientId,
        hospitalId: input?.hospitalId ?? (access.hospitalScoped ? (ctx.user as any).hospitalId : undefined),
        status: input?.status,
        purpose: input?.purpose,
      });
    }),
    getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
      const shl = await db.getShlById(input.id);
      if (!shl) throw new TRPCError({ code: "NOT_FOUND", message: "SHL not found" });
      await assertCanViewShl(ctx, shl);
      const [files, versions, accessLogs] = await Promise.all([
        db.listShlFiles(shl.id, shl.currentManifestVersion ?? 1),
        db.listShlManifestVersions(shl.id),
        db.listShlAccessLogs(shl.id),
      ]);
      return { ...shl, files, versions, accessLogs };
    }),
    create: protectedProcedure.input(z.object({
      patientId: z.number().optional(),
      hospitalId: z.number().optional(),
      purpose: z.enum(shlPurposeValues),
      context: z.enum(portabilityContextValues).optional(),
      label: z.string().max(80).optional(),
      scope: z.any().optional(),
      recipientPolicy: z.any().optional(),
      credentialIds: z.array(z.string()).optional(),
      fhirBundle: z.any().optional(),
      simulatorScenario: z.string().optional(),
      consentCredentialId: z.string().optional(),
      passcodeRequired: z.boolean().optional(),
      passcode: z.string().min(4).max(32).optional(),
      maxAccessCount: z.number().min(1).max(100).optional(),
      expiresInDays: z.number().min(1).max(365).optional(),
      longTerm: z.boolean().optional(),
      forceCheckerReview: z.boolean().optional(),
    })).mutation(async ({ ctx, input }) => {
      return createSmartHealthLinkPackage(ctx, input);
    }),
    revoke: protectedProcedure.input(z.object({ id: z.number(), reason: z.string().optional() })).mutation(async ({ ctx, input }) => {
      const shl = await db.getShlById(input.id);
      if (!shl) throw new TRPCError({ code: "NOT_FOUND", message: "SHL not found" });
      await assertCanManageShl(ctx, shl);
      await db.revokeShl(input.id, input.reason ?? "User requested revocation");
      await db.revokeShlManifestVersions(input.id, input.reason ?? "SHL revoked");
      await db.createAuditEvent({
        actorId: ctx.user.id,
        actorRole: (ctx.user as any).systemRole,
        hospitalId: shl.hospitalId,
        action: "shl.revoked",
        resourceType: "smart_health_link",
        resourceId: String(input.id),
        details: { reason: input.reason, manifestCredentialId: shl.manifestCredentialId, presentationId: shl.presentationId },
      });
      return { success: true };
    }),
    accessLogs: protectedProcedure.input(z.object({ shlId: z.number() })).query(async ({ ctx, input }) => {
      const shl = await db.getShlById(input.shlId);
      if (!shl) throw new TRPCError({ code: "NOT_FOUND", message: "SHL not found" });
      await assertCanViewShl(ctx, shl);
      return db.listShlAccessLogs(input.shlId);
    }),
    versions: protectedProcedure.input(z.object({ shlId: z.number() })).query(async ({ ctx, input }) => {
      const shl = await db.getShlById(input.shlId);
      if (!shl) throw new TRPCError({ code: "NOT_FOUND", message: "SHL not found" });
      await assertCanViewShl(ctx, shl);
      return db.listShlManifestVersions(input.shlId);
    }),
    rotatePasscode: protectedProcedure.input(z.object({
      id: z.number(),
      passcode: z.string().min(4).max(32).optional(),
    })).mutation(async ({ ctx, input }) => {
      const shl = await db.getShlById(input.id);
      if (!shl) throw new TRPCError({ code: "NOT_FOUND", message: "SHL not found" });
      await assertCanManageShl(ctx, shl);
      const passcode = input.passcode ?? generateNumericPasscode();
      const hashed = hashPasscode(passcode);
      await db.updateSmartHealthLink(input.id, {
        passcodeRequired: true,
        passcodeSalt: hashed.salt,
        passcodeHash: hashed.hash,
        passcodeFailedAttempts: 0,
      } as any);
      await db.createAuditEvent({
        actorId: ctx.user.id,
        actorRole: (ctx.user as any).systemRole,
        hospitalId: shl.hospitalId,
        action: "shl.passcode.rotated",
        resourceType: "smart_health_link",
        resourceId: String(input.id),
      });
      return { success: true, passcode };
    }),
    manifest: publicProcedure.input(z.object({
      manifestToken: z.string().min(16),
      recipient: z.string().min(1),
      passcode: z.string().optional(),
      embeddedLengthMax: z.number().min(0).max(5_000_000).optional(),
      accessorName: z.string().optional(),
      accessorOrg: z.string().optional(),
      accessorCountry: z.string().max(3).optional(),
    })).mutation(async ({ ctx, input }) => {
      const shl = await db.getShlByManifestToken(input.manifestToken);
      if (!shl) throw new TRPCError({ code: "NOT_FOUND", message: "SHL not found" });
      return resolveShlManifestAccess(ctx, shl, input);
    }),
    access: publicProcedure.input(z.object({
      shlId: z.number(),
      passcode: z.string().optional(),
      recipient: z.string().optional(),
      accessorName: z.string().optional(),
      accessorOrg: z.string().optional(),
      accessorCountry: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const shl = await db.getShlById(input.shlId);
      if (!shl) throw new TRPCError({ code: "NOT_FOUND", message: "SHL not found" });
      return resolveShlManifestAccess(ctx, shl, {
        recipient: input.recipient ?? input.accessorOrg ?? input.accessorName ?? "Unknown recipient",
        passcode: input.passcode,
        accessorName: input.accessorName,
        accessorOrg: input.accessorOrg,
        accessorCountry: input.accessorCountry,
      });
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
    workbench: protectedProcedure.query(async () => {
      const [claimCases, payerAdapters] = await Promise.all([
        db.listClaimCases({}),
        db.listPayerAdapters(),
      ]);
      return buildClaimWorkbench({
        claimCases: claimCases as any,
        payerAdapters: payerAdapters as any,
      });
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
    getClaimDetail: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      const [claimCase, documents, packages, submissions, payments, payerAdapters] = await Promise.all([
        db.getClaimCaseById(input.id),
        db.listClaimDocuments(input.id),
        db.listClaimPackages(input.id),
        db.listClaimSubmissionEvents(input.id),
        db.listClaimPayments(input.id),
        db.listPayerAdapters(),
      ]);
      if (!claimCase) return null;
      const payer = (payerAdapters as any[]).find((p: any) => p.id === claimCase.payerAdapterId);
      return {
        ...claimCase,
        payerName: payer?.name ?? null,
        payerType: payer?.payerType ?? null,
        documents,
        packages,
        submissions,
        payments,
      };
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
    createReadiness: protectedProcedure.input(z.object({
      patientId: z.number(),
      hospitalId: z.number(),
      payerAdapterId: z.number(),
      memberId: z.string().optional(),
      encounterRef: z.string().optional(),
      claimType: z.enum(["opd", "ipd", "dental", "pharmacy", "rehabilitation", "emergency"]),
      totalAmount: z.string().optional(),
      diagnosisCodes: z.string().optional(),
      procedureCodes: z.string().optional(),
      serviceItems: z.string().optional(),
      intakeChannel: z.enum(["wallet_vp", "shl", "legacy_upload", "his_import", "partner_portal"]).default("wallet_vp"),
      consentRef: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const diagnosisCodes = parseCodes(input.diagnosisCodes);
      const procedureCodes = parseCodes(input.procedureCodes);
      const serviceItems = parseServiceItems(input.serviceItems);
      const id = await db.createClaimCase({
        patientId: input.patientId,
        hospitalId: input.hospitalId,
        payerAdapterId: input.payerAdapterId,
        encounterRef: input.encounterRef,
        claimType: input.claimType,
        totalAmount: input.totalAmount,
        diagnosisCodes,
        procedureCodes,
        serviceItems,
        validationIssues: [],
      } as any);
      if (id) {
        await db.createAuditEvent({
          actorId: ctx.user.id,
          action: "claim.readiness.created",
          resourceType: "claim_case",
          resourceId: String(id),
          details: {
            intakeChannel: input.intakeChannel,
            consentRef: input.consentRef,
            memberId: input.memberId,
          },
        });
      }
      return {
        id,
        simulationMode: !id,
        intakeChannel: input.intakeChannel,
        nextStep: "Validate evidence and issue ClaimPackageCredential before payer submission.",
      };
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
    issueClaimPackageVc: protectedProcedure.input(z.object({
      claimCaseId: z.number().optional(),
      simulatedCaseId: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const { packet } = await claimPacketForAction(input);
      const issues = validateClaimPacket(packet);
      const blockingIssues = issues.filter((issue) => issue.severity === "error");
      if (input.claimCaseId) {
        await db.updateClaimCase(input.claimCaseId, {
          status: blockingIssues.length === 0 ? "ready_to_submit" : "correction_required",
          validationIssues: issues,
        } as any);
        await db.createAuditEvent({
          actorId: ctx.user.id,
          action: "claim.claim_package_vc.issued",
          resourceType: "claim_case",
          resourceId: String(input.claimCaseId),
        });
      }
      return {
        valid: blockingIssues.length === 0,
        issues,
        credentialType: "claim_package",
        credential: buildClaimPackageCredential(packet),
        fhirClaim: packet.fhirClaim,
        simulation: packet.simulated,
      };
    }),
    submitToPayer: protectedProcedure.input(z.object({
      claimCaseId: z.number().optional(),
      simulatedCaseId: z.string().optional(),
      adapterMode: z.enum(["api", "portal", "batch_file", "email", "rpa"]).optional(),
    })).mutation(async ({ ctx, input }) => {
      const { packet } = await claimPacketForAction(input);
      if (input.claimCaseId) {
        await db.updateClaimCase(input.claimCaseId, {
          status: "submitted",
          submittedAt: new Date(),
          payerClaimId: `PAYER-${packet.caseRef}`,
        } as any);
        await db.createAuditEvent({
          actorId: ctx.user.id,
          action: "claim.payer.submitted",
          resourceType: "claim_case",
          resourceId: String(input.claimCaseId),
          details: { adapterMode: input.adapterMode ?? packet.payer.submissionFormat },
        });
      }
      return buildPayerSubmissionEnvelope(packet, input.adapterMode);
    }),
    recordPayerResponse: protectedProcedure.input(z.object({
      claimCaseId: z.number().optional(),
      simulatedCaseId: z.string().optional(),
      decision: z.enum(["accepted", "rejected", "more_info_requested"]),
      reason: z.string().optional(),
      approvedAmount: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const { packet } = await claimPacketForAction(input);
      const envelope = buildPayerAdjudicationEnvelope(packet, input.decision, input.reason);
      if (input.claimCaseId) {
        await db.updateClaimCase(input.claimCaseId, {
          status: input.decision,
          respondedAt: new Date(),
          rejectionReason: input.decision === "rejected" || input.decision === "more_info_requested" ? input.reason : undefined,
          approvedAmount: input.approvedAmount ?? String(envelope.approvedAmount ?? packet.approvedAmount),
        } as any);
        await db.createAuditEvent({
          actorId: ctx.user.id,
          action: `claim.payer.${input.decision}`,
          resourceType: "claim_case",
          resourceId: String(input.claimCaseId),
        });
      }
      return envelope;
    }),
    recordPayment: protectedProcedure.input(z.object({
      claimCaseId: z.number().optional(),
      simulatedCaseId: z.string().optional(),
      paidAmount: z.number().optional(),
      paymentReference: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const { packet } = await claimPacketForAction(input);
      const envelope = buildPaymentReconciliationEnvelope(packet, input.paidAmount);
      if (input.claimCaseId) {
        await db.updateClaimCase(input.claimCaseId, {
          status: "paid",
          paidAt: new Date(),
          approvedAmount: String(input.paidAmount ?? packet.approvedAmount),
          claimReceiptVcId: String(envelope.claimReceiptCredential.id),
        } as any);
        await db.createAuditEvent({
          actorId: ctx.user.id,
          action: "claim.payment.reconciled",
          resourceType: "claim_case",
          resourceId: String(input.claimCaseId),
          details: { paymentReference: input.paymentReference },
        });
      }
      return envelope;
    }),
    publicApiExamples: protectedProcedure.query(async () => {
      const workbench = buildClaimWorkbench({ claimCases: await db.listClaimCases({}) as any, payerAdapters: await db.listPayerAdapters() as any });
      return workbench.apiExamples;
    }),
    analytics: protectedProcedure.query(async () => {
      return db.getClaimAnalytics();
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
  // CARE TRANSITION WORKBENCH
  // ============================================================
  careTransition: router({
    overview: staffProcedure.query(async () => {
      const [stats, documents, tasks, packages, connectors] = await Promise.all([
        db.getCareTransitionStats(),
        db.listCaseDocuments({ verificationStatus: "needs_review" }),
        db.listCaseTasks({ status: "ready" }),
        db.listCarePackages({}),
        db.listPartnerSourceConnectors({}),
      ]);
      return {
        stats,
        documents: documents.slice(0, 8),
        tasks: tasks.slice(0, 8),
        packages: packages.slice(0, 8),
        connectors: connectors.slice(0, 8),
      };
    }),
    workspace: staffProcedure.input(z.object({
      caseType: z.enum(caseTypeValues),
      caseId: z.number(),
    })).query(async ({ input }) => {
      const [caseRecord, documents, tasks, packages, decisions, events] = await Promise.all([
        resolveCareTransitionCase(input.caseType, input.caseId),
        db.listCaseDocuments(input),
        db.listCaseTasks(input),
        db.listCarePackages(input),
        db.listCaseDecisions(input),
        db.listCareTransitionEvents(input),
      ]);
      return { case: caseRecord, documents, tasks, packages, decisions, events };
    }),
    initializeCase: staffProcedure.input(z.object({
      caseType: z.enum(caseTypeValues),
      caseId: z.number(),
      translationRequired: z.boolean().optional(),
      payerRequired: z.boolean().optional(),
    })).mutation(async ({ ctx, input }) => {
      const existing = await db.listCaseTasks({ caseType: input.caseType, caseId: input.caseId });
      if (existing.length === 0) {
        for (const task of defaultTasksForCase(input.caseType, input)) {
          await db.createCaseTask({
            caseType: input.caseType,
            caseId: input.caseId,
            taskType: task.taskType as any,
            title: task.title,
            ownerRole: task.ownerRole,
            priority: task.priority ?? "routine",
            input: { fhir: "Task", caseType: input.caseType },
          } as any);
        }
      }
      await db.createCareTransitionEvent({
        caseType: input.caseType,
        caseId: input.caseId,
        eventType: "created",
        actorId: ctx.user.id,
        actorRole: (ctx.user as any).systemRole,
        summary: "Care transition workflow initialized",
        metadata: { taskCount: existing.length === 0 ? defaultTasksForCase(input.caseType, input).length : existing.length },
      } as any);
      return { success: true, taskCount: existing.length === 0 ? defaultTasksForCase(input.caseType, input).length : existing.length };
    }),
    addDocument: staffProcedure.input(z.object({
      caseType: z.enum(caseTypeValues),
      caseId: z.number(),
      direction: z.enum(["inbound", "outbound"]).default("inbound"),
      documentType: z.enum(caseDocumentTypeValues),
      title: z.string().min(1),
      sourceSystem: z.string().optional(),
      sourcePartnerId: z.number().optional(),
      fileName: z.string().optional(),
      fileUrl: z.string().optional(),
      fileKey: z.string().optional(),
      mimeType: z.string().optional(),
      hash: z.string().optional(),
      notes: z.string().optional(),
      patientId: z.number().optional(),
      metadata: z.any().optional(),
    })).mutation(async ({ ctx, input }) => {
      const caseRecord = await resolveCareTransitionCase(input.caseType, input.caseId);
      const resolvedPatientId = input.patientId ?? Number((caseRecord as any)?.patientId ?? 0);
      const patientId = resolvedPatientId || undefined;
      const documentRefId = `docref-${input.caseType}-${input.caseId}-${nanoid(10)}`;
      const documentReference = buildDocumentReference({
        id: documentRefId,
        title: input.title,
        documentType: input.documentType,
        caseType: input.caseType,
        caseId: input.caseId,
        patientId,
        fileName: input.fileName,
        fileUrl: input.fileUrl,
        mimeType: input.mimeType,
        hash: input.hash,
        sourcePartnerId: input.sourcePartnerId,
        sourceSystem: input.sourceSystem,
        direction: input.direction,
      });
      const content = (documentReference.content as any[])[0]?.attachment ?? {};
      const id = await db.createCaseDocument({
        caseType: input.caseType,
        caseId: input.caseId,
        direction: input.direction,
        documentType: input.documentType,
        title: input.title,
        sourceSystem: input.sourceSystem ?? "partner_portal",
        sourcePartnerId: input.sourcePartnerId,
        fileName: input.fileName,
        fileUrl: input.fileUrl,
        fileKey: input.fileKey,
        mimeType: input.mimeType ?? "application/pdf",
        hash: String(content.hash),
        fhirDocumentReferenceId: documentRefId,
        fhirDocumentReference: documentReference,
        verificationStatus: "needs_review",
        receivedBy: ctx.user.id,
        notes: input.notes,
        metadata: {
          ...input.metadata,
          fhir: { resourceType: "DocumentReference", profile: "R4" },
          sourceOfTruth: input.sourceSystem ?? "partner_portal",
        },
      } as any);
      await db.createCareTransitionEvent({
        caseType: input.caseType,
        caseId: input.caseId,
        eventType: "document_received",
        actorId: ctx.user.id,
        actorRole: (ctx.user as any).systemRole,
        summary: `Document received: ${input.title}`,
        metadata: { documentId: id, documentType: input.documentType, direction: input.direction },
      } as any);
      return { id, fhirDocumentReferenceId: documentRefId, hash: content.hash, verificationStatus: "needs_review" };
    }),
    verifyDocument: staffProcedure.input(z.object({
      id: z.number(),
      verificationStatus: z.enum(["verified", "rejected", "converted_to_vc"]),
      notes: z.string().optional(),
      createVcRequest: z.boolean().optional(),
      credentialType: z.enum(credentialTypeValues).optional(),
      issuerHospitalId: z.number().optional(),
      subjectId: z.number().optional(),
    })).mutation(async ({ ctx, input }) => {
      const document = await db.getCaseDocumentById(input.id);
      if (!document) throw new TRPCError({ code: "NOT_FOUND", message: "Case document not found" });
      let vcRequest: any;
      if (input.createVcRequest && input.verificationStatus !== "rejected") {
        const credentialType = input.credentialType ?? credentialTypeForCaseDocument(String(document.documentType));
        requireMaker(ctx.user, credentialType);
        const caseRecord = await resolveCareTransitionCase(String(document.caseType) as any, Number(document.caseId));
        const subjectId = input.subjectId ?? Number((caseRecord as any)?.patientId ?? 0);
        const issuerHospitalId = input.issuerHospitalId ?? Number((caseRecord as any)?.fromHospitalId ?? (caseRecord as any)?.preferredBranchId ?? (ctx.user as any).hospitalId ?? 1);
        if (!subjectId) throw new TRPCError({ code: "BAD_REQUEST", message: "subjectId is required to create a VC request from this document." });
        vcRequest = await submitMakerCredentialRequest({
          maker: ctx.user,
          issuerHospitalId,
          subjectId,
          type: credentialType,
          documentData: {
            source: "case_document",
            caseType: document.caseType,
            caseId: document.caseId,
            caseDocumentId: document.id,
            documentType: document.documentType,
            title: document.title,
            hash: document.hash,
            fhirDocumentReference: document.fhirDocumentReference,
            evidence: { sourceSystem: document.sourceSystem, sourcePartnerId: document.sourcePartnerId },
          },
          canonicalReview: {
            status: "human_verified_document_reference",
            requiredBeforeIssue: false,
            sourceHash: document.hash,
          },
        });
        await db.createPartnerSourceAttestation({
          caseDocumentId: document.id,
          partnerOrgId: document.sourcePartnerId,
          partnerName: String(document.sourceSystem ?? "Partner portal"),
          sourceMode: "delegated_issuance",
          attestationStatus: "verified",
          sourceHash: document.hash ?? undefined,
          evidence: { credentialRequestId: vcRequest.id, requestId: vcRequest.requestId },
          reviewedBy: ctx.user.id,
          reviewedAt: new Date(),
        } as any);
      }
      await db.updateCaseDocument(input.id, {
        verificationStatus: input.verificationStatus,
        notes: input.notes,
        verifiedBy: ctx.user.id,
        verifiedAt: new Date(),
        vcCredentialId: vcRequest?.requestId,
      } as any);
      await db.createCareTransitionEvent({
        caseType: document.caseType as any,
        caseId: document.caseId,
        eventType: "document_verified",
        actorId: ctx.user.id,
        actorRole: (ctx.user as any).systemRole,
        summary: `Document ${input.verificationStatus}: ${document.title}`,
        metadata: { documentId: document.id, vcRequest },
      } as any);
      return { success: true, vcRequest };
    }),
    updateTask: staffProcedure.input(z.object({
      id: z.number(),
      status: z.enum(["created", "ready", "in_progress", "blocked", "completed", "failed", "cancelled"]),
      notes: z.string().optional(),
      output: z.any().optional(),
    })).mutation(async ({ ctx, input }) => {
      await db.updateCaseTask(input.id, {
        status: input.status,
        notes: input.notes,
        output: input.output,
        completedAt: input.status === "completed" ? new Date() : undefined,
        ownerId: ctx.user.id,
      } as any);
      await db.createAuditEvent({ actorId: ctx.user.id, actorRole: (ctx.user as any).systemRole, action: `care_transition.task.${input.status}`, resourceType: "case_task", resourceId: String(input.id) });
      return { success: true };
    }),
    recordDecision: staffProcedure.input(z.object({
      caseType: z.enum(caseTypeValues),
      caseId: z.number(),
      decisionType: z.enum(["clinical_acceptance", "document_acceptance", "financial_acceptance", "legal_acceptance", "admission_acceptance", "discharge_clearance"]),
      outcome: z.enum(["accepted", "rejected", "more_info_requested", "conditional"]),
      reason: z.string().optional(),
      conditions: z.any().optional(),
    })).mutation(async ({ ctx, input }) => {
      const id = await db.createCaseDecision({ ...input, decidedBy: ctx.user.id } as any);
      await db.createCareTransitionEvent({
        caseType: input.caseType,
        caseId: input.caseId,
        eventType: "decision_recorded",
        actorId: ctx.user.id,
        actorRole: (ctx.user as any).systemRole,
        summary: `${input.decisionType}: ${input.outcome}`,
        metadata: { decisionId: id, reason: input.reason },
      } as any);
      return { id };
    }),
    generatePackage: staffProcedure.input(z.object({
      caseType: z.enum(caseTypeValues),
      caseId: z.number(),
      packageType: z.enum(packageTypeValues).optional(),
      patientId: z.number().optional(),
      hospitalId: z.number().optional(),
      recipientName: z.string().optional(),
      recipientDid: z.string().optional(),
      recipientType: z.enum(["trustcare_hospital", "partner_hospital", "payer", "patient", "embassy", "facilitator"]).optional(),
      includeShl: z.boolean().default(true),
      forceCheckerReview: z.boolean().optional(),
      costEstimate: z.any().optional(),
      claimRef: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const caseRecord = await resolveCareTransitionCase(input.caseType, input.caseId);
      const patientId = input.patientId ?? Number((caseRecord as any)?.patientId ?? 0);
      const hospitalId = input.hospitalId ?? Number((caseRecord as any)?.fromHospitalId ?? (caseRecord as any)?.preferredBranchId ?? (ctx.user as any).hospitalId ?? 1);
      if (!patientId) throw new TRPCError({ code: "BAD_REQUEST", message: "patientId is required to generate a care package." });
      const packageType = input.packageType ?? packageTypeForCase(input.caseType);
      const documents = await db.listCaseDocuments({ caseType: input.caseType, caseId: input.caseId });
      const serviceRequest = buildServiceRequest({
        id: `servicerequest-${input.caseType}-${input.caseId}`,
        caseType: input.caseType,
        patientId,
        reason: String((caseRecord as any)?.reason ?? (caseRecord as any)?.serviceLine ?? "Care transition"),
        diagnosis: String((caseRecord as any)?.diagnosis ?? ""),
        priority: String((caseRecord as any)?.priority ?? "routine"),
        requester: String((ctx.user as any).name ?? "TrustCare"),
        performer: input.recipientName,
      });
      const documentResources = documents.map((document: any) => document.fhirDocumentReference).filter(Boolean);
      const fhirBundle = {
        resourceType: "Bundle",
        type: "collection",
        timestamp: new Date().toISOString(),
        entry: [
          { fullUrl: `urn:uuid:${serviceRequest.id}`, resource: serviceRequest },
          ...documentResources.map((resource: any) => ({ fullUrl: `urn:uuid:${resource.id}`, resource })),
        ],
      };
      const fhirBundleHash = sha256(fhirBundle);
      const packageManifest = buildCarePackageManifest({
        caseType: input.caseType,
        caseId: input.caseId,
        packageType,
        documents: documents.map((document: any) => ({
          id: document.id,
          title: document.title,
          documentType: document.documentType,
          hash: document.hash,
          fhirDocumentReferenceId: document.fhirDocumentReferenceId,
        })),
        costEstimate: input.costEstimate,
        claimRef: input.claimRef,
      });
      let shlPackage: any;
      if (input.includeShl) {
        shlPackage = await createSmartHealthLinkPackage(ctx, {
          patientId,
          hospitalId,
          purpose: purposeForCarePackage(packageType) as any,
          context: input.caseType === "medical_tourist" ? "medical_tourist" : input.caseType === "internal_referral" ? "cross_branch_referral" : "cross_border",
          label: `${packageType} package #${input.caseId}`,
          fhirBundle,
          scope: ["Patient.read", "ServiceRequest.read", "Task.read", "DocumentReference.read", "Coverage.read", "Claim.read"],
          recipientPolicy: { recipientType: input.recipientType ?? "partner_hospital", recipientName: input.recipientName, recipientDid: input.recipientDid },
          forceCheckerReview: input.forceCheckerReview,
          passcodeRequired: true,
          expiresInDays: packageType === "medical_tourist" ? 30 : 14,
        });
      }
      const carePackageId = await db.createCarePackage({
        caseType: input.caseType,
        caseId: input.caseId,
        packageType,
        status: shlPackage?.status === "pending_review" ? "ready_for_review" : "approved",
        recipientType: input.recipientType ?? "partner_hospital",
        recipientName: input.recipientName,
        recipientDid: input.recipientDid,
        purpose: purposeForCarePackage(packageType) as any,
        fhirBundleHash,
        manifestHash: packageManifest.manifestHash,
        shlId: shlPackage?.id,
        presentationId: shlPackage?.presentationId,
        costEstimate: input.costEstimate,
        claimRef: input.claimRef,
        createdBy: ctx.user.id,
        metadata: { manifest: packageManifest.manifest, shl: shlPackage },
      } as any);
      await db.createCarePackageItem({ carePackageId: carePackageId!, itemType: "fhir_bundle", title: "FHIR care transition bundle", hash: fhirBundleHash, metadata: { resourceCount: fhirBundle.entry.length } } as any);
      for (const document of documents as any[]) {
        await db.createCarePackageItem({
          carePackageId: carePackageId!,
          itemType: "document_reference",
          title: document.title,
          resourceRef: document.fhirDocumentReferenceId,
          hash: document.hash,
          requiredForAcceptance: ["referral_letter", "passport", "insurance_card", "patient_summary"].includes(document.documentType),
          metadata: { documentId: document.id, documentType: document.documentType },
        } as any);
      }
      await db.createCareTransitionEvent({
        caseType: input.caseType,
        caseId: input.caseId,
        eventType: "package_generated",
        actorId: ctx.user.id,
        actorRole: (ctx.user as any).systemRole,
        summary: `Care package generated: ${packageType}`,
        metadata: { carePackageId, shlPackage, manifestHash: packageManifest.manifestHash },
      } as any);
            return { id: carePackageId, fhirBundleHash, manifestHash: packageManifest.manifestHash, shl: shlPackage };
    }),

    // --- Document Bundles ---
    createBundle: staffProcedure.input(z.object({
      caseType: z.string(),
      caseId: z.number(),
      title: z.string(),
      description: z.string().optional(),
      bundleType: z.enum(["initial_submission", "follow_up", "lab_results", "imaging", "legal_documents", "insurance", "discharge", "mixed"]).optional(),
    })).mutation(async ({ input, ctx }) => {
      return db.createDocumentBundle({ ...input, submittedBy: ctx.user.id });
    }),

    getBundles: staffProcedure.input(z.object({
      caseType: z.string(),
      caseId: z.number(),
    })).query(async ({ input }) => {
      return db.getBundlesByCaseId(input.caseType, input.caseId);
    }),

    getBundleWithFiles: staffProcedure.input(z.object({
      bundleId: z.number(),
    })).query(async ({ input }) => {
      return db.getBundleWithFiles(input.bundleId);
    }),

    addFileToBundle: staffProcedure.input(z.object({
      bundleId: z.number(),
      caseType: z.string(),
      caseId: z.number(),
      documentType: z.string(),
      title: z.string(),
      fileName: z.string().optional(),
      fileUrl: z.string().optional(),
      fileKey: z.string().optional(),
      mimeType: z.string().optional(),
      fileSize: z.number().optional(),
      hash: z.string().optional(),
      direction: z.string().optional(),
      sortOrder: z.number().optional(),
      metadata: z.any().optional(),
    })).mutation(async ({ input, ctx }) => {
      return db.addFileToBundle(input.bundleId, { ...input, receivedBy: ctx.user.id });
    }),

    updateBundleStatus: staffProcedure.input(z.object({
      bundleId: z.number(),
      status: z.enum(["draft", "submitted", "under_review", "accepted", "rejected", "archived"]),
    })).mutation(async ({ input, ctx }) => {
      await db.updateBundleStatus(input.bundleId, input.status, ctx.user.id);
      return { success: true };
    }),

    removeBundleFile: staffProcedure.input(z.object({
      fileId: z.number(),
      bundleId: z.number(),
    })).mutation(async ({ input }) => {
      const removed = await db.removeBundleFile(input.fileId, input.bundleId);
      return { success: removed };
    }),
    // --- Trust Layer Integration ---
    linkVcToFile: staffProcedure.input(z.object({
      fileId: z.number(),
      vcCredentialId: z.string(),
    })).mutation(async ({ input }) => {
      const credential = await db.getIssuedCredentialByCredentialId(input.vcCredentialId);
      if (!credential) throw new TRPCError({ code: "NOT_FOUND", message: "Credential not found in trust registry" });
      if (credential.status !== "active") throw new TRPCError({ code: "BAD_REQUEST", message: `Credential is ${credential.status}, cannot link` });
      await db.updateCaseDocument(input.fileId, { vcCredentialId: input.vcCredentialId, verificationStatus: "converted_to_vc" });
      return { success: true, credential: { id: credential.id, credentialId: credential.credentialId, type: credential.type, status: credential.status, issuedAt: credential.issuedAt } };
    }),
    verifyBundleVc: staffProcedure.input(z.object({
      fileId: z.number(),
    })).query(async ({ input }) => {
      const doc = await db.getCaseDocumentById(input.fileId);
      if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
      if (!doc.vcCredentialId) return { verified: false, reason: "No VC linked to this document" };
      const credential = await db.getIssuedCredentialByCredentialId(doc.vcCredentialId);
      if (!credential) return { verified: false, reason: "Linked credential not found in registry" };
      if (credential.status !== "active") return { verified: false, reason: `Credential status: ${credential.status}` };
      return { verified: true, credential: { id: credential.id, credentialId: credential.credentialId, type: credential.type, status: credential.status, issuedAt: credential.issuedAt, expiresAt: credential.expiresAt } };
    }),
    generateBundleHash: staffProcedure.input(z.object({
      bundleId: z.number(),
    })).mutation(async ({ input }) => {
      const bundle = await db.getBundleWithFiles(input.bundleId);
      if (!bundle) throw new TRPCError({ code: "NOT_FOUND", message: "Bundle not found" });
      const fileHashes = (bundle.files || []).map((f: any) => f.hash || sha256({ id: f.id, fileName: f.fileName, fileKey: f.fileKey, mimeType: f.mimeType, fileSize: f.fileSize }));
      const bundleIntegrityHash = sha256(fileHashes.join("|"));
      await db.updateDocumentBundleHash(input.bundleId, bundleIntegrityHash);
      return { integrityHash: bundleIntegrityHash, fileCount: fileHashes.length };
    }),
    generateShlFromBundle: staffProcedure.input(z.object({
      bundleId: z.number(),
      patientId: z.number(),
      purpose: z.enum(shlPurposeValues).optional(),
      label: z.string().optional(),
      passcodeRequired: z.boolean().optional(),
      expiresInDays: z.number().optional(),
    })).mutation(async ({ input, ctx }) => {
      const bundle = await db.getBundleWithFiles(input.bundleId);
      if (!bundle) throw new TRPCError({ code: "NOT_FOUND", message: "Bundle not found" });
      if (!bundle.files?.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Bundle has no files" });
      const documentResources = (bundle.files || []).map((file: any) => ({
        resourceType: "DocumentReference",
        id: `doc-${file.id}`,
        status: "current",
        type: { text: file.documentType },
        description: file.title,
        content: [{
          attachment: {
            contentType: file.mimeType || "application/octet-stream",
            url: file.fileUrl || file.fileKey || "",
            title: file.fileName || file.title,
            size: file.fileSize ? Number(file.fileSize) : undefined,
            hash: file.hash || undefined,
          },
        }],
        context: { related: file.vcCredentialId ? [{ reference: `Credential/${file.vcCredentialId}` }] : [] },
      }));
      const fhirBundle = {
        resourceType: "Bundle",
        type: "collection",
        timestamp: new Date().toISOString(),
        meta: { tag: [{ system: "urn:trustcare:bundle", code: `bundle-${input.bundleId}` }] },
        entry: documentResources.map((r: any) => ({ fullUrl: `urn:uuid:${r.id}`, resource: r })),
      };
      const shlResult = await createSmartHealthLinkPackage(ctx, {
        patientId: input.patientId,
        purpose: input.purpose ?? "referral",
        label: input.label ?? `Document Bundle #${input.bundleId}: ${bundle.title}`,
        fhirBundle,
        passcodeRequired: input.passcodeRequired ?? true,
        expiresInDays: input.expiresInDays ?? 14,
      });
      return { shl: shlResult, bundleId: input.bundleId, fhirBundleHash: sha256(fhirBundle) };
    }),
  }),
  // ============================================================
  // PARTNER PORTAL
  // ============================================================
  partnerPortal: router({
    dashboard: staffProcedure.query(async () => {
      const [stats, connectors, documents, packages] = await Promise.all([
        db.getCareTransitionStats(),
        db.listPartnerSourceConnectors({}),
        db.listCaseDocuments({}),
        db.listCarePackages({}),
      ]);
      return {
        stats,
        connectors: connectors.slice(0, 12),
        inboundDocuments: documents.filter((document: any) => document.direction === "inbound").slice(0, 12),
        outboundPackages: packages.slice(0, 12),
      };
    }),
    listConnectors: staffProcedure.input(z.object({
      partnerOrgId: z.number().optional(),
      connectorType: z.enum(connectorTypeValues).optional(),
      status: z.string().optional(),
    }).optional()).query(async ({ input }) => {
      return db.listPartnerSourceConnectors(input);
    }),
    createConnector: staffProcedure.input(z.object({
      partnerOrgId: z.number().optional(),
      partnerName: z.string().min(1),
      connectorType: z.enum(connectorTypeValues),
      direction: z.enum(["inbound", "outbound", "bidirectional"]).default("bidirectional"),
      endpointUrl: z.string().optional(),
      authType: z.enum(["none", "api_key", "oauth2_client_credentials", "mutual_tls", "signed_vp", "basic"]).default("none"),
      credentialRef: z.string().optional(),
      mappingProfile: z.string().optional(),
      canonicalMapping: z.any().optional(),
      supportedDocumentTypes: z.array(z.enum(caseDocumentTypeValues)).optional(),
      supportedCredentialTypes: z.array(z.enum(credentialTypeValues)).optional(),
      metadata: z.any().optional(),
    })).mutation(async ({ ctx, input }) => {
      const validation = validatePartnerConnector(input);
      const id = await db.createPartnerSourceConnector({
        ...input,
        status: validation.ok ? "testing" : "draft",
        validationStatus: validation.ok ? (validation.warnings.length ? "warning" : "passed") : "failed",
        validationReport: validation,
        createdBy: ctx.user.id,
      } as any);
      await db.createAuditEvent({
        actorId: ctx.user.id,
        actorRole: (ctx.user as any).systemRole,
        action: "partner.connector.created",
        resourceType: "partner_source_connector",
        resourceId: String(id),
        details: { connectorType: input.connectorType, validation },
      });
      return { id, validation };
    }),
    validateConnector: staffProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      const connector = await db.getPartnerSourceConnectorById(input.id);
      if (!connector) throw new TRPCError({ code: "NOT_FOUND", message: "Connector not found" });
      const validation = validatePartnerConnector(connector as any);
      await db.updatePartnerSourceConnector(input.id, {
        validationStatus: validation.ok ? (validation.warnings.length ? "warning" : "passed") : "failed",
        validationReport: validation,
        lastValidatedAt: new Date(),
      } as any);
      await db.createAuditEvent({ actorId: ctx.user.id, actorRole: (ctx.user as any).systemRole, action: "partner.connector.validated", resourceType: "partner_source_connector", resourceId: String(input.id), details: validation });
      return validation;
    }),
    activateConnector: staffProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      const connector = await db.getPartnerSourceConnectorById(input.id);
      if (!connector) throw new TRPCError({ code: "NOT_FOUND", message: "Connector not found" });
      const validation = validatePartnerConnector(connector as any);
      if (!validation.ok) throw new TRPCError({ code: "BAD_REQUEST", message: validation.issues.join(" ") });
      await db.updatePartnerSourceConnector(input.id, {
        status: "active",
        validationStatus: validation.warnings.length ? "warning" : "passed",
        validationReport: validation,
        lastValidatedAt: new Date(),
      } as any);
      await db.createAuditEvent({ actorId: ctx.user.id, actorRole: (ctx.user as any).systemRole, action: "partner.connector.activated", resourceType: "partner_source_connector", resourceId: String(input.id), details: validation });
      return { success: true, validation };
    }),
    submitCase: staffProcedure.input(z.object({
      flowType: z.enum(["external_partner", "cross_border_inbound", "medical_tourist"]),
      connectorId: z.number().optional(),
      partnerOrgName: z.string().min(1),
      partnerCountry: z.string().optional(),
      language: z.enum(["th", "en", "zh", "ja", "ar", "ru", "ko", "de", "fr", "other"]).optional(),
      jurisdiction: z.string().optional(),
      patientId: z.number().optional(),
      serviceLine: z.string().optional(),
      reason: z.string().optional(),
      contactEmail: z.string().optional(),
      contactPhone: z.string().optional(),
      payerMode: z.enum(["self_pay", "insurance", "government", "guarantee_letter"]).optional(),
      translationRequired: z.boolean().optional(),
      documents: z.array(z.object({
        documentType: z.enum(caseDocumentTypeValues),
        title: z.string(),
        fileName: z.string().optional(),
        fileUrl: z.string().optional(),
        mimeType: z.string().optional(),
        hash: z.string().optional(),
      })).optional(),
    })).mutation(async ({ ctx, input }) => {
      const connector = input.connectorId ? await db.getPartnerSourceConnectorById(input.connectorId) : undefined;
      let caseType: CaseType = "external_partner";
      let caseId: number | undefined;
      if (input.flowType === "medical_tourist") {
        caseType = "medical_tourist";
        caseId = await db.createInternationalCase({
          patientId: input.patientId,
          country: input.partnerCountry,
          language: normalizeInternationalLanguage(input.language),
          serviceLine: input.serviceLine,
          contactEmail: input.contactEmail,
          contactPhone: input.contactPhone,
          clinicalNotes: input.reason,
          metadata: { partnerOrgName: input.partnerOrgName, payerMode: input.payerMode, connectorId: input.connectorId },
        } as any);
      } else {
        caseType = input.flowType === "cross_border_inbound" ? "cross_border" : "external_partner";
        caseId = await db.createCrossBorderReferral({
          referralType: input.flowType === "cross_border_inbound" ? "cross_border_inbound" : "external_partner",
          partnerOrgId: input.connectorId,
          partnerOrgName: input.partnerOrgName,
          partnerCountry: input.partnerCountry,
          language: normalizeCrossBorderLanguage(input.language),
          jurisdiction: input.jurisdiction,
          translationRequired: input.translationRequired ?? false,
          status: "draft",
        } as any);
      }
      await db.createCareTransitionEvent({
        caseType,
        caseId: caseId!,
        eventType: "created",
        actorId: ctx.user.id,
        actorRole: (ctx.user as any).systemRole,
        summary: `Partner case submitted by ${input.partnerOrgName}`,
        metadata: { flowType: input.flowType, connectorId: input.connectorId, connectorType: connector?.connectorType, payerMode: input.payerMode },
      } as any);
      for (const task of defaultTasksForCase(caseType, { translationRequired: input.translationRequired, payerRequired: Boolean(input.payerMode && input.payerMode !== "self_pay") })) {
        await db.createCaseTask({
          caseType,
          caseId: caseId!,
          taskType: task.taskType as any,
          title: task.title,
          ownerRole: task.ownerRole,
          priority: task.priority ?? "routine",
          input: { source: "partner_portal", flowType: input.flowType },
        } as any);
      }
      for (const document of input.documents ?? []) {
        const documentReference = buildDocumentReference({
          id: `docref-${caseType}-${caseId}-${nanoid(10)}`,
          title: document.title,
          documentType: document.documentType,
          caseType,
          caseId: caseId!,
          patientId: input.patientId,
          fileName: document.fileName,
          fileUrl: document.fileUrl,
          mimeType: document.mimeType,
          hash: document.hash,
          sourcePartnerId: input.connectorId,
          sourceSystem: input.partnerOrgName,
          direction: "inbound",
        });
        await db.createCaseDocument({
          caseType,
          caseId: caseId!,
          direction: "inbound",
          documentType: document.documentType,
          title: document.title,
          sourceSystem: input.partnerOrgName,
          sourcePartnerId: input.connectorId,
          fileName: document.fileName,
          fileUrl: document.fileUrl,
          mimeType: document.mimeType ?? "application/pdf",
          hash: String((documentReference.content as any[])[0]?.attachment?.hash),
          fhirDocumentReferenceId: String(documentReference.id),
          fhirDocumentReference: documentReference,
          verificationStatus: "needs_review",
          receivedBy: ctx.user.id,
          metadata: { connectorId: input.connectorId, connectorType: connector?.connectorType },
        } as any);
      }
      return { caseType, caseId, status: "submitted", connector: connector ? { id: connector.id, connectorType: connector.connectorType, status: connector.status } : null };
    }),
    sendDocument: staffProcedure.input(z.object({
      caseType: z.enum(caseTypeValues),
      caseId: z.number(),
      documentType: z.enum(caseDocumentTypeValues),
      title: z.string().min(1),
      recipientName: z.string().optional(),
      fileName: z.string().optional(),
      fileUrl: z.string().optional(),
      mimeType: z.string().optional(),
      notes: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const documentReference = buildDocumentReference({
        id: `docref-out-${input.caseType}-${input.caseId}-${nanoid(10)}`,
        title: input.title,
        documentType: input.documentType,
        caseType: input.caseType,
        caseId: input.caseId,
        fileName: input.fileName,
        fileUrl: input.fileUrl,
        mimeType: input.mimeType,
        sourceSystem: "trustcare",
        direction: "outbound",
      });
      const id = await db.createCaseDocument({
        caseType: input.caseType,
        caseId: input.caseId,
        direction: "outbound",
        documentType: input.documentType,
        title: input.title,
        sourceSystem: "trustcare",
        fileName: input.fileName,
        fileUrl: input.fileUrl,
        mimeType: input.mimeType ?? "application/pdf",
        hash: String((documentReference.content as any[])[0]?.attachment?.hash),
        fhirDocumentReferenceId: String(documentReference.id),
        fhirDocumentReference: documentReference,
        verificationStatus: "verified",
        receivedBy: ctx.user.id,
        verifiedBy: ctx.user.id,
        verifiedAt: new Date(),
        notes: input.notes,
        metadata: { recipientName: input.recipientName, direction: "outbound" },
      } as any);
      await db.createCareTransitionEvent({
        caseType: input.caseType,
        caseId: input.caseId,
        eventType: "document_received",
        actorId: ctx.user.id,
        actorRole: (ctx.user as any).systemRole,
        summary: `Outbound document prepared: ${input.title}`,
        metadata: { documentId: id, recipientName: input.recipientName },
      } as any);
      return { id };
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

    auditSeedDb: adminProcedure.input(z.object({
      patientsPerHospital: z.number().min(1).max(100).optional(),
    }).optional()).query(({ input }) => {
      return auditTrustcareVcVpSeedDatabase({
        patientsPerHospital: input?.patientsPerHospital,
      });
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

  // ============================================================
  // SCHEMA REGISTRY
  // ============================================================
  schemaRegistry: router({
    register: adminProcedure.input(z.object({
      credentialType: z.string().min(1),
      version: z.string().regex(/^\d+\.\d+\.\d+$/, "Must be semver (e.g., 1.0.0)"),
      jsonSchema: z.any(),
      changelog: z.string().optional(),
    })).mutation(async ({ input }) => {
      const result = await db.registerSchema({
        credentialType: input.credentialType,
        version: input.version,
        jsonSchema: input.jsonSchema,
        changelog: input.changelog || null,
      });
      return result;
    }),

    getActive: protectedProcedure.input(z.object({
      credentialType: z.string().min(1),
    })).query(async ({ input }) => {
      return db.getActiveSchema(input.credentialType);
    }),

    getByVersion: protectedProcedure.input(z.object({
      credentialType: z.string().min(1),
      version: z.string().min(1),
    })).query(async ({ input }) => {
      return db.getSchemaByVersion(input.credentialType, input.version);
    }),

    list: protectedProcedure.input(z.object({
      credentialType: z.string().optional(),
    }).optional()).query(async ({ input }) => {
      return db.listSchemaVersions(input?.credentialType);
    }),

    validate: protectedProcedure.input(z.object({
      credentialType: z.string().min(1),
      schemaVersion: z.string().min(1),
      credentialData: z.any(),
    })).mutation(async ({ input }) => {
      return db.validateCredentialAgainstSchema(
        input.credentialType,
        input.schemaVersion,
        input.credentialData,
      );
    }),
  }),
});

export type AppRouter = typeof appRouter;

// Helper
async function resolveCareTransitionCase(caseType: CaseType, caseId: number) {
  if (caseType === "internal_referral") return db.getReferralById(caseId);
  if (caseType === "medical_tourist") return db.getInternationalCaseById(caseId);
  const crossBorder = await db.getCrossBorderReferralById(caseId);
  if (crossBorder?.referralId) {
    const referral = await db.getReferralById(crossBorder.referralId);
    return {
      ...crossBorder,
      referral,
      patientId: referral?.patientId,
      fromHospitalId: referral?.fromHospitalId,
      toHospitalId: referral?.toHospitalId,
      reason: referral?.reason,
      diagnosis: referral?.diagnosis,
      priority: referral?.priority,
    };
  }
  return crossBorder;
}

function credentialTypeForCaseDocument(documentType: string): (typeof credentialTypeValues)[number] {
  const map: Record<string, (typeof credentialTypeValues)[number]> = {
    referral_letter: "referral_vc",
    patient_summary: "patient_summary",
    lab_report: "lab_result",
    imaging_report: "diagnostic_report",
    passport: "travel_document_verification",
    insurance_card: "insurance_eligibility",
    guarantee_letter: "guarantee_letter",
    quotation: "quotation",
    visa_support_letter: "visa_support_letter",
    consent: "consent_receipt",
    claim_document: "claim_package",
    invoice: "claim_package",
    receipt: "claim_receipt",
    discharge_summary: "discharge_summary",
    prescription: "prescription",
    medical_certificate: "medical_certificate",
  };
  return map[documentType] ?? "travel_document_verification";
}

function normalizeCrossBorderLanguage(language?: string) {
  if (language === "th" || language === "en" || language === "zh" || language === "ja" || language === "other") return language;
  return "en";
}

function normalizeInternationalLanguage(language?: string) {
  if (language === "en" || language === "zh" || language === "ja" || language === "ar" || language === "ru" || language === "ko" || language === "de" || language === "fr" || language === "other") return language;
  return "en";
}

function requireMaker(user: any, credentialType: string) {
  if (!canActAsCredentialMaker(user?.systemRole, [])) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Document creation requires Maker role." });
  }
  if (!hasCredentialEntitlement(user, "makerTypes", credentialType)) {
    throw new TRPCError({ code: "FORBIDDEN", message: `Maker is not entitled to create ${credentialType}.` });
  }
}

function requireChecker(user: any, credentialType: string) {
  if (!canActAsCredentialChecker(user?.systemRole, [])) {
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

async function requireMakerCheckerRole(user: any, mode: "maker" | "checker") {
  const additionalRoles = sanitizeAdditionalRolesForSystemRole(
    user?.systemRole,
    (await db.getUserAdditionalRoles(user.id)).map((role: any) => role.role),
  );
  const allowed = mode === "maker"
    ? canActAsCredentialMaker(user?.systemRole, additionalRoles)
    : canActAsCredentialChecker(user?.systemRole, additionalRoles);
  if (!allowed) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: mode === "maker" ? "Maker role required" : "Checker role required",
    });
  }
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

  // ── Singleton enforcement: revoke previous active credential if type is singleton ──
  if (isSingletonType(request.type) && request.subjectId && request.issuerHospitalId) {
    const existingActive = await db.listIssuedCredentials({
      subjectId: request.subjectId,
      status: "active",
    });
    const previousSingleton = existingActive.find(
      (c: any) => c.type === request.type && c.issuerHospitalId === request.issuerHospitalId
    );
    if (previousSingleton) {
      await db.revokeCredential(previousSingleton.id, "superseded");
      await db.createAuditEvent({
        actorId: input.checkerId,
        actorRole: input.checkerRole,
        hospitalId: request.issuerHospitalId,
        action: "credential_superseded",
        resourceType: "issued_credential",
        resourceId: String(previousSingleton.id),
        details: {
          oldCredentialId: previousSingleton.credentialId,
          type: request.type,
          reason: "superseded",
          newRequestId: request.requestId,
        },
      });
    }
  }
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
  } else if (request.type === "shl_manifest" && documentData.manifestClaims) {
    credential = await issueCredential({
      type: "ShlManifestCredential",
      issuer,
      subjectId: String(request.subjectId),
      subjectDid: holderDid,
      claims: documentData.manifestClaims,
      evidence: [
        { type: "MakerCheckerRequest", digest: sha256(request), resourceId: request.requestId },
        { type: "SHLManifestHash", digest: documentData.manifestHash, resourceId: documentData.manifestUrl },
        { type: "FHIRBundleHash", digest: documentData.sourceBundleHash },
      ],
      validDays: validityDaysForCredentialType("shl_manifest"),
      audience: input.audience ?? documentData.manifestUrl,
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

  // Schema validation enforcement
  const schemaVersion = "1.0.0";
  const validationResult = await db.validateCredentialAgainstSchema(
    request.type,
    schemaVersion,
    credential.credential?.credentialSubject ?? documentData,
  );
  if (!validationResult.valid && validationResult.errors[0] && !validationResult.errors[0].includes("Schema not found")) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Schema validation failed: ${validationResult.errors.join(", ")}`,
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
    schemaVersion,
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
  if (request.type === "shl_manifest" && documentData.smartHealthLinkId) {
    const shl = await db.getShlById(Number(documentData.smartHealthLinkId));
    if (shl) {
      const selectedCredentialIds = Array.isArray(documentData.selectedCredentialIds) ? documentData.selectedCredentialIds : [];
      const selectedCredentialRows = (await db.listIssuedCredentials({ subjectId: request.subjectId, status: "active" }))
        .filter((row: any) => row.credentialId !== credential.id)
        .filter((row: any) => !selectedCredentialIds.length || selectedCredentialIds.includes(row.credentialId) || selectedCredentialIds.includes(String(row.id)))
        .slice(0, 12);
      const context = String(documentData.manifestClaims?.context ?? shl.context ?? "self_share") as PortabilityContextValue;
      const presentation = await createPresentation({
        holderDid,
        credentials: [credential, ...selectedCredentialRows.filter((row: any) => row.sdJwtVc).map(issuedCredentialRowToIssuedVc)],
        purpose: purposeForContext(context),
        audience: documentData.manifestUrl ?? input.audience,
        validMinutes: 24 * 60,
      });
      await db.createIssuedPresentation({
        presentationId: presentation.id,
        patientId: request.subjectId,
        holderDid,
        context,
        purpose: presentation.purpose,
        audience: documentData.manifestUrl ?? input.audience,
        presentationJwt: presentation.jwt,
        credentialIds: presentation.credentialIds,
        credentialRowIds: [rowId, ...selectedCredentialRows.map((row: any) => row.id)],
        verifier: "smart-health-link-viewer",
        status: "active",
        expiresAt: new Date(presentation.expiresAt),
        metadata: {
          shlId: shl.id,
          manifestHash: documentData.manifestHash,
          sourceBundleHash: documentData.sourceBundleHash,
          checkerIssued: true,
        },
      } as any);
      await db.updateSmartHealthLink(shl.id, {
        status: "active",
        manifestCredentialId: credential.id,
        presentationId: presentation.id,
      } as any);
      await db.supersedeShlManifestVersions(shl.id);
      await db.createShlManifestVersion({
        shlId: shl.id,
        manifestVersion: shl.currentManifestVersion ?? 1,
        contextHash: shl.contextHash ?? sha256(documentData.manifestClaims ?? shl),
        scopeHash: sha256(documentData.manifestClaims?.requestedScopes ?? shl.scope ?? []),
        sourceBundleHash: documentData.sourceBundleHash,
        manifestHash: documentData.manifestHash ?? shl.manifestHash,
        manifestCredentialId: credential.id,
        presentationId: presentation.id,
        status: "current",
        changeReason: "Checker approved SHL manifest",
        createdBy: input.checkerId,
        metadata: { requestId: request.requestId, checkerId: input.checkerId },
      } as any);
      await db.createAuditEvent({
        actorId: input.checkerId,
        actorRole: input.checkerRole,
        hospitalId: request.issuerHospitalId,
        action: "shl.activated_after_checker_approval",
        resourceType: "smart_health_link",
        resourceId: String(shl.id),
        details: { manifestCredentialId: credential.id, presentationId: presentation.id },
      });
    }
  }
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

function resolveWalletPatientId(ctx: any, requestedPatientId?: number) {
  const systemRole = (ctx.user as any)?.systemRole ?? "patient";
  if (systemRole === "patient") {
    if (requestedPatientId && requestedPatientId !== ctx.user.id) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Patients can only prepare their own wallet data." });
    }
    return ctx.user.id;
  }
  return requestedPatientId ?? ctx.user.id;
}

async function enrichedWalletCards(patientId: number) {
  const cards = await db.listWalletCards(patientId);
  const allCreds = await db.listIssuedCredentials({ subjectId: patientId });
  const credMap = new Map(allCreds.map((credential: any) => [credential.id, credential]));
  return cards.map((card: any) => {
    const cred = credMap.get(card.credentialId);
    return {
      ...card,
      credentialStatus: cred?.status || "active",
      expiresAt: cred?.expiresAt || null,
      credentialData: cred?.credentialData || null,
      credentialType: cred?.type || card.cardType,
      issuedAt: cred?.issuedAt || card.createdAt,
    };
  });
}

function servicePacketPurpose(context: ReadinessContext): ConsentPurpose {
  const map: Record<ReadinessContext, ConsentPurpose> = {
    opd_visit: "treatment",
    emergency: "emergency",
    referral: "referral",
    cross_border: "referral",
    medical_tourist: "medical_tourism",
    insurance_claim: "insurance",
    pharmacy_dispense: "treatment",
  };
  return map[context];
}

type ShlPurpose = (typeof shlPurposeValues)[number];
type PortabilityContextValue = (typeof portabilityContextValues)[number];

async function shlActorAccess(ctx: any) {
  const user = ctx.user as any;
  const additionalRoles = sanitizeAdditionalRolesForSystemRole(
    user.systemRole,
    (await db.getUserAdditionalRoles(user.id)).map((role: any) => role.role),
  );
  const activeRole = normalizeActiveRole(user.systemRole, ctx.req.cookies?.["trustcare_active_role"], additionalRoles);
  return {
    additionalRoles,
    activeRole,
    hospitalScoped: activeRole !== "system_admin" && Boolean(user.hospitalId),
  };
}

async function assertCanViewShl(ctx: any, shl: any) {
  const access = await shlActorAccess(ctx);
  if (access.activeRole === "patient") {
    if (Number(shl.patientId) !== Number(ctx.user.id)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Patients can view only their own Smart Health Links." });
    }
    return;
  }
  if (access.activeRole === "system_admin") return;
  if (access.hospitalScoped && Number(shl.hospitalId) === Number((ctx.user as any).hospitalId)) return;
  throw new TRPCError({ code: "FORBIDDEN", message: "Smart Health Link is outside your hospital scope." });
}

async function assertCanManageShl(ctx: any, shl: any) {
  const access = await shlActorAccess(ctx);
  if (access.activeRole === "patient") {
    if (Number(shl.patientId) === Number(ctx.user.id)) return;
    throw new TRPCError({ code: "FORBIDDEN", message: "Patients can manage only their own Smart Health Links." });
  }
  if (access.activeRole === "system_admin") return;
  if (access.hospitalScoped && Number(shl.hospitalId) === Number((ctx.user as any).hospitalId)) return;
  throw new TRPCError({ code: "FORBIDDEN", message: "Smart Health Link is outside your hospital scope." });
}

function contextForShlPurpose(purpose: ShlPurpose): PortabilityContextValue {
  const map: Record<ShlPurpose, PortabilityContextValue> = {
    referral: "cross_branch_referral",
    patient_summary: "treatment",
    discharge: "treatment",
    cross_border: "cross_border",
    medical_tourist: "medical_tourist",
    insurance: "e_claim",
    self_share: "self_share",
  };
  return map[purpose];
}

function defaultShlPolicy(purpose: ShlPurpose) {
  const map: Record<ShlPurpose, { expiresInDays: number; maxAccessCount: number; passcodeRequired: boolean }> = {
    referral: { expiresInDays: 14, maxAccessCount: 5, passcodeRequired: true },
    patient_summary: { expiresInDays: 14, maxAccessCount: 10, passcodeRequired: true },
    discharge: { expiresInDays: 30, maxAccessCount: 8, passcodeRequired: true },
    cross_border: { expiresInDays: 30, maxAccessCount: 5, passcodeRequired: true },
    medical_tourist: { expiresInDays: 45, maxAccessCount: 8, passcodeRequired: true },
    insurance: { expiresInDays: 30, maxAccessCount: 4, passcodeRequired: true },
    self_share: { expiresInDays: 7, maxAccessCount: 3, passcodeRequired: true },
  };
  return map[purpose];
}

function appBaseUrl(req: any) {
  const configured = process.env.TRUSTCARE_PUBLIC_BASE_URL;
  if (configured) return configured.replace(/\/$/, "");
  const proto = req.headers["x-forwarded-proto"] ?? req.protocol ?? "http";
  const host = req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost:3000";
  return `${proto}://${host}`.replace(/\/$/, "");
}

function shlManifestUrl(req: any, manifestToken: string) {
  return `${appBaseUrl(req)}/api/shl/manifest/${manifestToken}`;
}

function shlViewerBaseUrl(req: any) {
  return `${appBaseUrl(req)}/shl-viewer`;
}

function issuerProfileForHospital(hospital: any) {
  return {
    id: String(hospital?.id ?? defaultIssuerProfile().id),
    name: String(hospital?.nameEn ?? hospital?.name ?? defaultIssuerProfile().name),
    did: String(hospital?.did ?? (hospital?.code ? hospitalDidWeb(hospital.code) : defaultIssuerProfile().did)),
    country: "TH",
    trustDomain: "trustcare-network",
  };
}

function issuedCredentialRowToIssuedVc(row: any) {
  return {
    id: row.credentialId,
    type: trustcareVcTypeForDbType(row.type),
    format: "jwt-vc" as const,
    jwt: row.sdJwtVc ?? "",
    credential: row.credentialData ?? {},
    digest: sha256(row.sdJwtVc ?? row.credentialData ?? row.credentialId),
    expiresAt: row.expiresAt ? new Date(row.expiresAt).toISOString() : undefined,
  };
}

async function buildCanonicalPayloadForShl(input: {
  patient: any;
  hospital: any;
  purpose: ShlPurpose;
  context: PortabilityContextValue;
  credentials: any[];
  fhirBundle?: any;
  simulatorScenario?: string;
}) {
  if (input.fhirBundle?.resourceType) {
    return canonicalizeHisPayload({
      sourceFormat: "fhir_native",
      payload: input.fhirBundle,
      sourceSystem: `${input.hospital?.code ?? "TRUSTCARE"}-FHIR`,
      sourceOrganizationId: String(input.hospital?.code ?? input.hospital?.id ?? "TRUSTCARE"),
      sourceOrganizationName: String(input.hospital?.nameEn ?? input.hospital?.name ?? "Trustcare Hospital Network"),
      mapperVersion: "trustcare-shl-fhir-native-v1",
    });
  }
  const payload = buildSimulatedHisPayload({
    patient: input.patient,
    hospital: input.hospital,
    purpose: input.purpose,
    context: input.context,
    credentials: input.credentials,
  });
  const scenario = input.simulatorScenario ?? scenarioForShlPurpose(input.purpose, input.context);
  return canonicalizeHisPayload({
    sourceFormat: "db_view",
    payload: {
      ...payload,
      sourceMetadata: { ...(payload.sourceMetadata as any), selectedScenario: scenario },
    },
    sourceSystem: `${input.hospital?.code ?? "TRUSTCARE"}-SHL-SIM`,
    sourceOrganizationId: String(input.hospital?.code ?? input.hospital?.id ?? "TRUSTCARE"),
    sourceOrganizationName: String(input.hospital?.nameEn ?? input.hospital?.name ?? "Trustcare Hospital Network"),
    mapperVersion: `trustcare-shl-realistic-simulator-${scenario}-v1`,
  });
}

async function createShlTrustArtifacts(input: {
  shl: any;
  patient: any;
  hospital: any;
  issuerUserId: number;
  issuerRole: string;
  holderDid: string;
  manifestClaims: any;
  manifestHash: string;
  sourceBundleHash: string;
  context: PortabilityContextValue;
  manifestUrl: string;
  selectedCredentialRows: any[];
  issuedAt?: Date;
}) {
  const issuedAt = input.issuedAt ?? new Date();
  const issuer = issuerProfileForHospital(input.hospital);
  const credential = await issueCredential({
    type: "ShlManifestCredential",
    issuer,
    subjectId: String(input.patient.id),
    subjectDid: input.holderDid,
    claims: input.manifestClaims,
    evidence: [
      { type: "SHLManifestHash", digest: input.manifestHash, resourceId: input.manifestUrl },
      { type: "FHIRBundleHash", digest: input.sourceBundleHash },
      { type: "SHLContextHash", digest: input.shl.contextHash },
    ],
    validDays: validityDaysForCredentialType("shl_manifest"),
    audience: input.manifestUrl,
    credentialId: `urn:trustcare:vc:shl:${sha256({ shlId: input.shl.id, manifestHash: input.manifestHash }).slice(0, 32)}`,
    now: issuedAt,
  });
  const templateId = await resolveTemplateForRequest({
    issuerHospitalId: input.hospital.id,
    type: "shl_manifest",
  } as any);
  const storage = documentStorageMetadata({
    documentType: "shl_manifest",
    hospitalCode: input.hospital?.code ?? String(input.hospital?.id ?? "trustcare"),
    patientKey: String(input.patient.id),
    credentialId: credential.id,
  });
  const rowId = await db.createIssuedCredential({
    credentialId: credential.id,
    templateId,
    issuerId: input.issuerUserId,
    issuerHospitalId: input.hospital.id,
    subjectId: input.patient.id,
    type: "shl_manifest",
    status: "active",
    credentialData: credential.credential,
    sdJwtVc: credential.jwt,
    documentCategory: storage.category,
    documentSubcategory: storage.subcategory,
    storageKey: storage.storagePath,
    searchTags: storage.indexTags,
    issuedAt,
    expiresAt: credential.expiresAt ? new Date(credential.expiresAt) : undefined,
    fhirResourceId: `DocumentReference/shl-${input.shl.id}`,
    schemaVersion: "1.0.0",
  } as any);
  await db.createWalletCard({
    patientId: input.patient.id,
    credentialId: rowId!,
    cardType: "shl_manifest" as any,
    displayName: "SHL Manifest",
    displayNameEn: "Smart Health Link Manifest",
    issuerHospitalName: issuer.name,
    documentCategory: storage.category,
  });
  const outboundCredentials = [
    credential,
    ...input.selectedCredentialRows
      .filter((row) => row.sdJwtVc && row.credentialId !== credential.id)
      .map(issuedCredentialRowToIssuedVc),
  ];
  const presentation = await createPresentation({
    holderDid: input.holderDid,
    credentials: outboundCredentials,
    purpose: purposeForContext(input.context),
    audience: input.manifestUrl,
    validMinutes: 24 * 60,
  });
  await db.createIssuedPresentation({
    presentationId: presentation.id,
    patientId: input.patient.id,
    holderDid: input.holderDid,
    context: input.context,
    purpose: presentation.purpose,
    audience: input.manifestUrl,
    presentationJwt: presentation.jwt,
    credentialIds: presentation.credentialIds,
    credentialRowIds: [rowId, ...input.selectedCredentialRows.map((row) => row.id)],
    verifier: "smart-health-link-viewer",
    status: "active",
    expiresAt: new Date(presentation.expiresAt),
    metadata: {
      shlId: input.shl.id,
      manifestHash: input.manifestHash,
      sourceBundleHash: input.sourceBundleHash,
      trustLayer: "vc-vp-around-shl",
    },
  } as any);
  return { credential, credentialRowId: rowId, presentation };
}

async function createSmartHealthLinkPackage(ctx: any, input: {
  patientId?: number;
  hospitalId?: number;
  purpose: ShlPurpose;
  context?: PortabilityContextValue;
  label?: string;
  scope?: any;
  recipientPolicy?: any;
  credentialIds?: string[];
  fhirBundle?: any;
  simulatorScenario?: string;
  consentCredentialId?: string;
  passcodeRequired?: boolean;
  passcode?: string;
  maxAccessCount?: number;
  expiresInDays?: number;
  longTerm?: boolean;
  forceCheckerReview?: boolean;
}) {
  const access = await shlActorAccess(ctx);
  const purpose = input.purpose;
  const context = input.context ?? contextForShlPurpose(purpose);
  const policy = defaultShlPolicy(purpose);
  const patientId = access.activeRole === "patient" ? ctx.user.id : input.patientId;
  if (!patientId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "patientId is required for staff-created Smart Health Links." });
  }
  if (access.activeRole === "patient" && !["self_share", "patient_summary"].includes(purpose)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Patients can create only self-share or patient summary Smart Health Links." });
  }
  if (access.activeRole !== "patient") {
    requireMaker(ctx.user, "shl_manifest");
  }

  const patient = await db.getUserById(patientId);
  if (!patient) throw new TRPCError({ code: "NOT_FOUND", message: "Patient not found" });
  const hospitalId = input.hospitalId ?? (ctx.user as any).hospitalId ?? patient.hospitalId ?? 1;
  const hospital = await db.getHospitalById(hospitalId);
  if (!hospital) throw new TRPCError({ code: "NOT_FOUND", message: "Hospital not found" });
  if (access.hospitalScoped && Number((ctx.user as any).hospitalId) !== Number(hospitalId)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Cannot create SHL outside your hospital scope." });
  }

  const selectedCredentialRows = (await db.listIssuedCredentials({ subjectId: patientId, status: "active" }))
    .filter((row: any) => !input.credentialIds?.length || input.credentialIds.includes(row.credentialId) || input.credentialIds.includes(String(row.id)))
    .slice(0, 12);
  const canonical = await buildCanonicalPayloadForShl({
    patient,
    hospital,
    purpose,
    context,
    credentials: selectedCredentialRows,
    fhirBundle: input.fhirBundle,
    simulatorScenario: input.simulatorScenario,
  });
  const requestedScopes = Array.isArray(input.scope) ? input.scope : defaultScopesForContext(context);
  const sourceBundleHash = canonical.summary.bundleHash;
  const expiresAt = new Date(Date.now() + (input.expiresInDays ?? policy.expiresInDays) * 86_400_000);
  const passcodeRequired = input.passcodeRequired ?? policy.passcodeRequired;
  const passcode = passcodeRequired ? (input.passcode ?? generateNumericPasscode()) : undefined;
  const hashedPasscode = passcode ? hashPasscode(passcode) : undefined;
  const manifestToken = randomBase64UrlBytes(32);
  const encryptionKey = randomBase64UrlBytes(32);
  const manifestUrl = shlManifestUrl(ctx.req, manifestToken);
  const link = buildShlinkPayload({
    manifestUrl,
    key: encryptionKey,
    expiresAt,
    passcodeRequired,
    longTerm: input.longTerm ?? false,
    singleFile: false,
    label: input.label ?? `Trustcare ${purpose.replace(/_/g, " ")}`,
    viewerBaseUrl: shlViewerBaseUrl(ctx.req),
  });
  const encrypted = await encryptShlFile({
    key: encryptionKey,
    contentType: "application/fhir+json",
    payload: canonical.bundle,
  });
  const manifestFiles = [{
    fileId: `fhir-bundle-${sourceBundleHash.slice(0, 16)}`,
    contentType: "application/fhir+json" as const,
    embeddedJwe: encrypted.jwe,
    contentHash: encrypted.contentHash,
    plaintextHash: encrypted.plaintextHash,
    version: 1,
  }];
  const manifestHash = manifestFileDigest(manifestFiles);
  const contextHash = sha256({
    purpose,
    context,
    requestedScopes,
    sourceBundleHash,
    manifestHash,
    recipientPolicy: input.recipientPolicy,
    consentCredentialId: input.consentCredentialId,
    expiresAt: expiresAt.toISOString(),
    maxAccessCount: input.maxAccessCount ?? policy.maxAccessCount,
  });
  const directIssue = access.activeRole === "patient" || ["system_admin", "hospital_admin"].includes(access.activeRole);
  const status = directIssue && !input.forceCheckerReview ? "active" : "pending_review";
  const shlId = await db.createSmartHealthLink({
    patientId,
    issuedBy: ctx.user.id,
    hospitalId,
    purpose,
    context,
    label: input.label ?? `Trustcare ${purpose.replace(/_/g, " ")}`,
    scope: requestedScopes,
    manifestHash,
    manifestToken,
    manifestUrl,
    encryptionKey: `sha256:${sha256(encryptionKey)}`,
    shlUrl: link.qrPayload,
    qrPayload: link.qrPayload,
    viewerUrl: link.viewerUrl,
    status: status as any,
    maxAccessCount: input.maxAccessCount ?? policy.maxAccessCount,
    passcodeRequired,
    passcodeSalt: hashedPasscode?.salt,
    passcodeHash: hashedPasscode?.hash,
    passcodeMaxAttempts: 5,
    longTerm: input.longTerm ?? false,
    singleFile: false,
    recipientPolicy: input.recipientPolicy ?? { allowedRecipientTypes: recipientTypesForPurpose(purpose) },
    consentCredentialId: input.consentCredentialId,
    sourceBundleHash,
    policyDecision: { mode: access.activeRole === "patient" ? "holder_self_share" : "maker_checker", scopes: requestedScopes },
    currentManifestVersion: 1,
    contextHash,
    autoUpdatePolicy: "manual_review",
    expiresAt,
  } as any);
  await db.createShlFile({
    shlId: shlId!,
    manifestVersion: 1,
    fileId: manifestFiles[0].fileId,
    version: 1,
    contentType: "application/fhir+json",
    embeddedJwe: encrypted.jwe,
    contentHash: encrypted.contentHash,
    plaintextHash: encrypted.plaintextHash,
    encryptedSizeBytes: encrypted.encryptedSizeBytes,
    metadata: { sourceBundleHash, scenario: input.simulatorScenario ?? scenarioForShlPurpose(purpose, context), resourceCounts: canonical.summary.resourceCounts },
  } as any);
  const manifestClaims = {
    smartHealthLinkId: shlId,
    manifestUrl,
    manifestHash,
    sourceBundleHash,
    purpose,
    context,
    requestedScopes,
    patient: { id: patient.id, name: patient.name },
    hospital: { id: hospital.id, code: hospital.code, name: hospital.name, did: hospital.did ?? hospitalDidWeb(hospital.code) },
    transport: { scheme: "shlink", encrypted: true, passcodeRequired, contentTypes: ["application/fhir+json"] },
    limits: { maxAccessCount: input.maxAccessCount ?? policy.maxAccessCount, expiresAt: expiresAt.toISOString() },
    canonicalSummary: canonical.summary,
  };
  const shl = await db.getShlById(shlId!);
  let trustArtifacts: Awaited<ReturnType<typeof createShlTrustArtifacts>> | undefined;
  if (status === "active" && shl) {
    trustArtifacts = await createShlTrustArtifacts({
      shl: { ...shl, contextHash },
      patient,
      hospital,
      issuerUserId: ctx.user.id,
      issuerRole: (ctx.user as any).systemRole ?? ctx.user.role,
      holderDid: defaultHolderDid(patientId),
      manifestClaims,
      manifestHash,
      sourceBundleHash,
      context,
      manifestUrl,
      selectedCredentialRows,
    });
    await db.updateSmartHealthLink(shlId!, {
      manifestCredentialId: trustArtifacts.credential.id,
      presentationId: trustArtifacts.presentation.id,
      status: "active",
    } as any);
  } else {
    const request = await submitMakerCredentialRequest({
      maker: ctx.user,
      issuerHospitalId: hospitalId,
      subjectId: patientId,
      type: "shl_manifest",
      holderDid: defaultHolderDid(patientId),
      issuerDid: hospital.did ?? hospitalDidWeb(hospital.code),
      documentData: {
        smartHealthLinkId: shlId,
        manifestVersion: 1,
        manifestClaims,
        manifestUrl,
        manifestHash,
        sourceBundleHash,
        selectedCredentialIds: selectedCredentialRows.map((row: any) => row.credentialId),
        patient: { id: patient.id, name: patient.name },
        organization: { id: hospital.id, name: hospital.name, code: hospital.code },
        fhir: { bundle: canonical.bundle, summary: canonical.summary, issues: canonical.issues },
      },
      canonicalReview: {
        status: "pending_checker_review",
        requiredBeforeIssue: true,
        issues: canonical.issues,
        sourceBundleHash,
      },
    });
    await db.createAuditEvent({
      actorId: ctx.user.id,
      actorRole: (ctx.user as any).systemRole,
      hospitalId,
      action: "shl.checker_review_requested",
      resourceType: "smart_health_link",
      resourceId: String(shlId),
      details: { requestId: request.requestId, purpose, context },
    });
  }
  await db.createShlManifestVersion({
    shlId: shlId!,
    manifestVersion: 1,
    contextHash,
    scopeHash: sha256(requestedScopes),
    sourceBundleHash,
    manifestHash,
    manifestCredentialId: trustArtifacts?.credential.id,
    presentationId: trustArtifacts?.presentation.id,
    status: "current",
    createdBy: ctx.user.id,
    metadata: { purpose, context, scenario: input.simulatorScenario ?? scenarioForShlPurpose(purpose, context), status },
  } as any);
  await db.createAuditEvent({
    actorId: ctx.user.id,
    actorRole: (ctx.user as any).systemRole,
    hospitalId,
    action: "shl.created",
    resourceType: "smart_health_link",
    resourceId: String(shlId),
    details: { purpose, context, status, manifestHash, sourceBundleHash, vcId: trustArtifacts?.credential.id, vpId: trustArtifacts?.presentation.id },
  });
  return {
    id: shlId,
    status,
    nextStep: status === "pending_review" ? "checker_review_required" : "ready_to_share",
    shlUrl: link.qrPayload,
    qrPayload: link.qrPayload,
    viewerUrl: link.viewerUrl,
    manifestUrl,
    manifestToken,
    passcode,
    passcodeRequired,
    expiresAt: expiresAt.toISOString(),
    maxAccessCount: input.maxAccessCount ?? policy.maxAccessCount,
    manifestHash,
    sourceBundleHash,
    manifestCredentialId: trustArtifacts?.credential.id,
    presentationId: trustArtifacts?.presentation.id,
    fhirSummary: canonical.summary,
    simulatorScenario: input.simulatorScenario ?? scenarioForShlPurpose(purpose, context),
  };
}

function recipientTypesForPurpose(purpose: ShlPurpose) {
  if (purpose === "insurance") return ["payer", "claim_processor"];
  if (purpose === "medical_tourist" || purpose === "cross_border") return ["foreign_hospital", "international_patient_center"];
  if (purpose === "referral") return ["receiving_hospital", "clinician"];
  if (purpose === "self_share") return ["patient_selected_recipient"];
  return ["clinician", "hospital"];
}

async function resolveShlManifestAccess(ctx: any, shl: any, input: {
  recipient: string;
  passcode?: string;
  embeddedLengthMax?: number;
  accessorName?: string;
  accessorOrg?: string;
  accessorCountry?: string;
}) {
  try {
    return await resolveShlManifestAccessPacket({
      shl,
      recipient: input.recipient,
      passcode: input.passcode,
      embeddedLengthMax: input.embeddedLengthMax,
      accessorName: input.accessorName,
      accessorOrg: input.accessorOrg,
      accessorCountry: input.accessorCountry,
      userAgent: ctx.req.headers["user-agent"],
      ipAddress: ctx.req.ip,
    });
  } catch (error) {
    if (error instanceof ShlAccessError) {
      throw new TRPCError({ code: error.trpcCode, message: error.message });
    }
    throw error;
  }
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

async function claimPacketForAction(input: { claimCaseId?: number; simulatedCaseId?: string }) {
  const payerAdapters = await db.listPayerAdapters();
  if (input.claimCaseId) {
    const claimCase = await db.getClaimCaseById(input.claimCaseId);
    if (!claimCase) throw new TRPCError({ code: "NOT_FOUND", message: "Claim case not found" });
    const workbench = buildClaimWorkbench({
      claimCases: [claimCase as any],
      payerAdapters: payerAdapters as any,
    });
    return { packet: workbench.casePackets[0], claimCase };
  }
  const workbench = buildClaimWorkbench({ payerAdapters: payerAdapters as any });
  const packet =
    workbench.seedPackets.find((item) => item.id === input.simulatedCaseId || item.caseRef === input.simulatedCaseId) ??
    workbench.seedPackets[0];
  return { packet, claimCase: undefined };
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
