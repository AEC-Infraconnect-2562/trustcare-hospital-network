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
  createPortabilityPacket,
  createSyncBackPlan,
  executeSyncBackPlan,
  issueMedicalCertificateVc,
  issuePrescriptionVc,
  issueSyncReceiptVc,
  localIssuerJwks,
  productionReadinessChecks,
  RECOMMENDED_SYNC_TARGETS,
  syncAdapterManifest,
  verifyCredential,
  verifyPresentation,
} from "./portability";
import { sha256 } from "./portability/utils";

// Admin-only guard
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  const systemRole = (ctx.user as any).systemRole;
  const isAdmin = ctx.user.role === "admin" || systemRole === "system_admin" || systemRole === "hospital_admin";
  if (!isAdmin) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

// Stricter: only system_admin
const systemAdminProcedure = protectedProcedure.use(({ ctx, next }) => {
  const systemRole = (ctx.user as any).systemRole;
  if (ctx.user.role !== "admin" && systemRole !== "system_admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "System admin access required" });
  }
  return next({ ctx });
});

// Clinical staff procedure: doctor, nurse, hospital_admin, system_admin
// Also allows users with issuer_maker or issuer_checker additional roles
const clinicalProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const systemRole = (ctx.user as any).systemRole;
  const clinicalRoles = ["system_admin", "hospital_admin", "doctor", "nurse"];
  if (clinicalRoles.includes(systemRole)) {
    return next({ ctx });
  }
  // Check additional roles for users who have been assigned issuer_maker or issuer_checker
  const additionalRoles = await db.getUserAdditionalRoles(ctx.user.id);
  const issuerRoles = ["issuer_maker", "issuer_checker"];
  if (additionalRoles.some(r => issuerRoles.includes(r))) {
    return next({ ctx });
  }
  throw new TRPCError({ code: "FORBIDDEN", message: "Clinical staff access required" });
});

function getRoleLabelTh(role: string): string {
  const map: Record<string, string> = {
    system_admin: "ผู้ดูแลระบบ",
    hospital_admin: "ผู้ดูแลโรงพยาบาล",
    doctor: "แพทย์",
    nurse: "พยาบาล",
    integration_engineer: "วิศวกรระบบ",
    patient: "ผู้ป่วย",
  };
  return map[role] || role;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(async (opts) => {
      if (!opts.ctx.user) return null;
      const additionalRoles = await db.getUserAdditionalRoles(opts.ctx.user.id);
      // Read activeRole from cookie (defaults to systemRole if not set)
      const activeRole = opts.ctx.req.cookies?.["trustcare_active_role"] || (opts.ctx.user as any).systemRole || "patient";
      return { ...opts.ctx.user, additionalRoles, activeRole };
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
    getDemoUsers: publicProcedure.query(async () => {
      const allUsers = await db.listUsers();
      // Only return demo users (openId starts with "demo-")
      const demoUsers = allUsers.filter((u: any) => u.openId?.startsWith("demo-"));
      // Attach additionalRoles for each user
      const usersWithRoles = await Promise.all(demoUsers.map(async (u: any) => {
        const additionalRoles = await db.getUserAdditionalRoles(u.id);
        return { ...u, additionalRoles };
      }));
      return usersWithRoles;
    }),
    // Get available roles the current user can switch to
    getAvailableRoles: protectedProcedure.query(async ({ ctx }) => {
      const user = ctx.user as any;
      const systemRole = user.systemRole || "patient";
      const additionalRoles = await db.getUserAdditionalRoles(user.id);
      // Everyone can be a patient (their own health wallet)
      const availableRoles: { role: string; label: string; labelTh: string }[] = [];
      // Primary role is always available
      availableRoles.push({ role: systemRole, label: systemRole, labelTh: getRoleLabelTh(systemRole) });
      // All staff can also act as patient
      if (systemRole !== "patient") {
        availableRoles.push({ role: "patient", label: "patient", labelTh: "ผู้ป่วย (ตัวเอง)" });
      }
      // Additional roles (issuer_maker, issuer_checker) add more capabilities but don't change the view
      // They are returned as metadata
      return { availableRoles, additionalRoles, currentActiveRole: ctx.req.cookies?.["trustcare_active_role"] || systemRole };
    }),
    // Switch the active role for the current session
    switchRole: protectedProcedure.input(z.object({
      role: z.string(),
    })).mutation(async ({ ctx, input }) => {
      const user = ctx.user as any;
      const systemRole = user.systemRole || "patient";
      // Validate: user can only switch to their systemRole or "patient"
      const allowedRoles = [systemRole, "patient"];
      if (!allowedRoles.includes(input.role)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "ไม่สามารถสลับไปบทบาทนี้ได้" });
      }
      // Store active role in a cookie (lightweight, no DB change)
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie("trustcare_active_role", input.role, { ...cookieOptions, maxAge: 86400000 });
      return { success: true, activeRole: input.role };
    }),
  }),
    seed: router({
    run: publicProcedure.mutation(async () => {
      const { seedDatabase } = await import("./seed");
      await seedDatabase();
      return { success: true };
    }),
  }),
  // ============================================================
  // USER ADDITIONAL ROLES MANAGEMENT
  // ============================================================
  userRoles: router({
    list: adminProcedure.input(z.object({ userId: z.number() })).query(async ({ input }) => {
      return db.listUserRoles(input.userId);
    }),
    assign: adminProcedure.input(z.object({
      userId: z.number(),
      role: z.string().min(1),
      scope: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const id = await db.assignUserRole({
        userId: input.userId,
        role: input.role,
        scope: input.scope,
        assignedBy: ctx.user.id,
      });
      return { id };
    }),
    remove: adminProcedure.input(z.object({
      userId: z.number(),
      role: z.string().min(1),
    })).mutation(async ({ input }) => {
      await db.removeUserRole(input.userId, input.role);
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
      type: z.enum(["patient_identity", "consent_receipt", "patient_summary", "allergy_alert", "medication_summary", "referral_vc", "immunization", "medical_certificate", "prescription", "claim_package", "sync_receipt"]),
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
    })).query(async ({ input }) => {
      return db.listIssuedCredentials(input);
    }),
    issue: clinicalProcedure.input(z.object({
      templateId: z.number(),
      subjectId: z.number(),
      issuerHospitalId: z.number(),
      type: z.enum(["patient_identity", "consent_receipt", "patient_summary", "allergy_alert", "medication_summary", "referral_vc", "immunization", "medical_certificate", "prescription", "claim_package", "sync_receipt"]),
      credentialData: z.any(),
      expiresAt: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const credentialId = `urn:uuid:${nanoid(32)}`;
      const id = await db.createIssuedCredential({
        credentialId,
        templateId: input.templateId,
        issuerId: ctx.user.id,
        issuerHospitalId: input.issuerHospitalId,
        subjectId: input.subjectId,
        type: input.type,
        credentialData: input.credentialData,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
      });
      await db.createAuditEvent({
        actorId: ctx.user.id,
        actorRole: (ctx.user as any).systemRole,
        hospitalId: input.issuerHospitalId,
        action: "credential.issued",
        resourceType: "credential",
        resourceId: credentialId,
        details: { type: input.type, subjectId: input.subjectId },
      });
      // Auto-create wallet card for patient
      await db.createWalletCard({
        patientId: input.subjectId,
        credentialId: id!,
        cardType: input.type === "patient_identity" ? "identity" :
                  input.type === "consent_receipt" ? "consent" :
                  input.type === "patient_summary" ? "patient_summary" :
                  input.type === "allergy_alert" ? "allergy" :
                  input.type === "medication_summary" ? "medication" :
                  input.type === "referral_vc" ? "referral" :
                  input.type === "medical_certificate" ? "medical_certificate" :
                  input.type === "prescription" ? "prescription" :
                  input.type === "claim_package" ? "claim" :
                  input.type === "sync_receipt" ? "sync_receipt" : "immunization",
        displayName: getCardDisplayName(input.type),
        displayNameEn: input.type.replace(/_/g, " "),
      });
      return { id, credentialId, success: true };
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
      // Generate a time-limited QR presentation token
      const token = nanoid(32);
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
      await db.createAuditEvent({
        actorId: ctx.user.id,
        actorRole: (ctx.user as any).systemRole,
        action: "credential.presented",
        resourceType: "wallet_card",
        resourceId: String(input.cardId),
        details: { token: token.slice(0, 8) },
      });
      return { token, expiresAt: expiresAt.toISOString(), qrData: `trustcare://vp/${token}` };
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
      const isValid = !!presented;
      return {
        trustLevel: isValid ? "yellow" : "red",
        verified: isValid,
        issuer: "Trustcare verifier token bridge",
        issuedAt: new Date().toISOString(),
        warnings: isValid ? ["Legacy token accepted only as a bridge; prefer JWT VP from Patient Data Portability Layer."] : [],
        errors: isValid ? [] : ["No token or presentation was supplied."],
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
    create: clinicalProcedure.input(z.object({
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
    markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
      await db.markAllNotificationsRead(ctx.user.id);
      return { success: true };
    }),
    unreadCount: protectedProcedure.query(async ({ ctx }) => {
      return { count: await db.getUnreadNotificationCount(ctx.user.id) };
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
      systemRole: z.enum(["system_admin", "hospital_admin", "doctor", "nurse", "integration_engineer", "patient"]),
      hospitalId: z.number().optional(),
    })).mutation(async ({ input }) => {
      await db.updateUserProfile(input.id, { systemRole: input.systemRole, hospitalId: input.hospitalId } as any);
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
      // Simulate connection test
      const adapter = await db.getIntegrationAdapterById(input.id);
      if (!adapter) throw new TRPCError({ code: "NOT_FOUND" });
      const healthy = Math.random() > 0.2; // Simulated
      const responseTime = Math.floor(Math.random() * 500) + 50;
      await db.createAdapterHealthLog({
        adapterId: input.id,
        status: healthy ? "healthy" : "degraded",
        responseTimeMs: responseTime,
        errorMessage: healthy ? undefined : "Connection timeout",
      });
      await db.updateIntegrationAdapter(input.id, {
        healthStatus: healthy ? "healthy" : "degraded",
        lastHealthCheck: new Date(),
      } as any);
      return { healthy, responseTimeMs: responseTime };
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
      // Simulate eligibility check
      const eligible = Math.random() > 0.15;
      const data: any = {
        patientId: input.patientId,
        payerAdapterId: input.payerAdapterId,
        memberId: input.memberId,
        status: eligible ? "eligible" : "ineligible",
        coverageType: "general",
        benefits: eligible ? { opd: true, ipd: true, dental: false } : null,
        validUntil: eligible ? new Date(Date.now() + 30 * 86400000) : null,
      };
      const id = await db.checkCoverageEligibility(data);
      return { id, eligible, benefits: data.benefits };
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
      // Simulate validation
      const issues = Math.random() > 0.5 ? [] : [{ field: "diagnosisCodes", message: "Missing primary diagnosis" }];
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
      const credential = await issueMedicalCertificateVc({
        issuer: input.issuer ?? defaultIssuerProfile(),
        holderDid: input.holderDid ?? defaultHolderDid(ctx.user.id),
        patient: input.patient,
        practitioner: input.practitioner,
        organization: input.organization,
        diagnosisText: input.diagnosisText,
        fitnessForWork: input.fitnessForWork,
        recommendations: input.recommendations,
        validFrom: input.validFrom,
        validUntil: input.validUntil,
        audience: input.audience,
      });
      await db.createAuditEvent({
        actorId: ctx.user.id,
        actorRole: (ctx.user as any).systemRole,
        action: "portability.medical_certificate.issued",
        resourceType: "verifiable_credential",
        resourceId: credential.id,
        details: { type: credential.type, digest: credential.digest },
      });
      return credential;
    }),

    issuePrescription: protectedProcedure.input(z.object({
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
      const credential = await issuePrescriptionVc({
        issuer: input.issuer ?? defaultIssuerProfile(),
        holderDid: input.holderDid ?? defaultHolderDid(ctx.user.id),
        patient: input.patient,
        prescriber: input.prescriber,
        organization: input.organization,
        medications: input.medications,
        authoredOn: input.authoredOn,
        substitutionAllowed: input.substitutionAllowed,
        repeatsAllowed: input.repeatsAllowed,
        dispenseWindowDays: input.dispenseWindowDays,
        audience: input.audience,
      });
      await db.createAuditEvent({
        actorId: ctx.user.id,
        actorRole: (ctx.user as any).systemRole,
        action: "portability.prescription.issued",
        resourceType: "verifiable_credential",
        resourceId: credential.id,
        details: { type: credential.type, digest: credential.digest },
      });
      return credential;
    }),

    verify: publicProcedure.input(z.object({
      jwt: z.string().min(1),
      kind: z.enum(["credential", "presentation"]).default("presentation"),
      trustedIssuers: z.array(z.string()).optional(),
      revokedCredentialIds: z.array(z.string()).optional(),
      revokedStatusIndexes: z.array(z.string()).optional(),
      allowedCredentialTypes: z.array(z.enum([
        "PatientIdentityCredential",
        "ConsentReceiptCredential",
        "PatientSummaryCredential",
        "AllergyAlertCredential",
        "MedicationSummaryCredential",
        "ReferralCredential",
        "CoverageEligibilityCredential",
        "MedicalCertificateCredential",
        "PrescriptionCredential",
        "ClaimPackageCredential",
        "SyncReceiptCredential",
      ])).optional(),
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
  // MAKER/CHECKER WORKFLOW
  // ============================================================
  makerChecker: router({
    // Maker: create a new credential request
    createRequest: clinicalProcedure.input(z.object({
      templateId: z.number(),
      patientId: z.number(),
      hospitalId: z.number().optional(),
      credentialData: z.any().optional(),
      makerNotes: z.string().optional(),
      priority: z.enum(["normal", "urgent"]).optional(),
    })).mutation(async ({ ctx, input }) => {
      const user = ctx.user as any;
      const result = await db.createCredentialRequest({
        templateId: input.templateId,
        patientId: input.patientId,
        hospitalId: input.hospitalId || user.hospitalId,
        makerId: ctx.user.id,
        credentialData: input.credentialData,
        makerNotes: input.makerNotes,
        priority: input.priority,
      });
      // Notify maker (confirmation)
      await db.createNotification({
        userId: ctx.user.id,
        hospitalId: input.hospitalId || user.hospitalId,
        type: "vc_request_created",
        title: "สร้างคำขอออก VC สำเร็จ",
        message: `คำขอ ${result.requestNumber} ถูกสร้างแล้ว รอส่งตรวจสอบ`,
        metadata: { requestId: result.id, requestNumber: result.requestNumber },
      });
      await db.createAuditEvent({
        actorId: ctx.user.id,
        actorRole: user.systemRole,
        hospitalId: input.hospitalId || user.hospitalId,
        action: "vc_request.created",
        resourceType: "credential_request",
        resourceId: result.requestNumber,
        details: { templateId: input.templateId, patientId: input.patientId },
      });
      return result;
    }),

    // Maker: update a draft request
    updateDraft: clinicalProcedure.input(z.object({
      requestId: z.number(),
      credentialData: z.any().optional(),
      makerNotes: z.string().optional(),
      templateId: z.number().optional(),
      patientId: z.number().optional(),
      priority: z.enum(["normal", "urgent"]).optional(),
    })).mutation(async ({ ctx, input }) => {
      const request = await db.getCredentialRequestById(input.requestId);
      if (!request) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบคำขอ" });
      if (request.makerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "ไม่มีสิทธิ์แก้ไขคำขอนี้" });
      if (request.status !== "draft") throw new TRPCError({ code: "BAD_REQUEST", message: "แก้ไขได้เฉพาะคำขอสถานะ draft" });
      await db.updateCredentialRequestDraft(input.requestId, {
        credentialData: input.credentialData,
        makerNotes: input.makerNotes,
        templateId: input.templateId,
        patientId: input.patientId,
        priority: input.priority,
      });
      return { success: true };
    }),

    // Maker: submit for review
    submitForReview: clinicalProcedure.input(z.object({
      requestId: z.number(),
    })).mutation(async ({ ctx, input }) => {
      const request = await db.getCredentialRequestById(input.requestId);
      if (!request) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบคำขอ" });
      if (request.makerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "ไม่มีสิทธิ์ส่งคำขอนี้" });
      if (request.status !== "draft") throw new TRPCError({ code: "BAD_REQUEST", message: "ส่งตรวจสอบได้เฉพาะคำขอสถานะ draft" });
      await db.submitRequestForReview(input.requestId);
      const user = ctx.user as any;
      // Notify all checkers in the same hospital
      const allUsers = await db.listUsers();
      for (const u of allUsers) {
        const roles = await db.getUserAdditionalRoles(u.id);
        if (roles.includes("issuer_checker") && (u.hospitalId === request.hospitalId || (u as any).systemRole === "system_admin")) {
          await db.createNotification({
            userId: u.id,
            hospitalId: request.hospitalId,
            type: "vc_submitted_for_review",
            title: "มีคำขอออก VC รอตรวจสอบ",
            message: `คำขอ ${request.requestNumber} จาก ${user.name} รอการตรวจสอบ`,
            metadata: { requestId: request.id, requestNumber: request.requestNumber, makerName: user.name },
          });
        }
      }
      await db.createAuditEvent({
        actorId: ctx.user.id,
        actorRole: user.systemRole,
        hospitalId: request.hospitalId,
        action: "vc_request.submitted",
        resourceType: "credential_request",
        resourceId: request.requestNumber,
        details: { requestId: request.id },
      });
      return { success: true };
    }),

    // Maker: cancel a request
    cancelRequest: clinicalProcedure.input(z.object({
      requestId: z.number(),
    })).mutation(async ({ ctx, input }) => {
      const request = await db.getCredentialRequestById(input.requestId);
      if (!request) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบคำขอ" });
      if (request.makerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "ไม่มีสิทธิ์ยกเลิกคำขอนี้" });
      if (!["draft", "pending_review"].includes(request.status)) throw new TRPCError({ code: "BAD_REQUEST", message: "ยกเลิกได้เฉพาะคำขอสถานะ draft หรือ pending_review" });
      await db.cancelCredentialRequest(input.requestId);
      return { success: true };
    }),

    // Checker: approve a request
    approve: clinicalProcedure.input(z.object({
      requestId: z.number(),
      comment: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      // Verify user is a checker
      const additionalRoles = await db.getUserAdditionalRoles(ctx.user.id);
      const user = ctx.user as any;
      const isChecker = additionalRoles.includes("issuer_checker") || user.systemRole === "system_admin";
      if (!isChecker) throw new TRPCError({ code: "FORBIDDEN", message: "ต้องมีสิทธิ์ Checker จึงจะอนุมัติได้" });

      const request = await db.getCredentialRequestById(input.requestId);
      if (!request) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบคำขอ" });
      if (request.status !== "pending_review") throw new TRPCError({ code: "BAD_REQUEST", message: "อนุมัติได้เฉพาะคำขอที่รอตรวจสอบ" });
      if (request.makerId === ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "ไม่สามารถอนุมัติคำขอที่ตนเองสร้างได้" });

      await db.approveRequest(input.requestId, ctx.user.id, input.comment);

      // Auto-issue the credential
      const template = (await db.listCredentialTemplates(request.hospitalId || undefined))?.find(t => t.id === request.templateId);
      const credentialId = `urn:uuid:${nanoid(32)}`;
      const issuedId = await db.createIssuedCredential({
        credentialId,
        templateId: request.templateId,
        issuerId: ctx.user.id,
        issuerHospitalId: request.hospitalId || 0,
        subjectId: request.patientId,
        type: (template?.type || "patient_summary") as any,
        credentialData: request.credentialData,
      });
      await db.markRequestIssued(input.requestId, issuedId!);

      // Auto-create wallet card for patient
      const cardType = template?.type === "patient_identity" ? "identity" :
        template?.type === "consent_receipt" ? "consent" :
        template?.type === "patient_summary" ? "patient_summary" :
        template?.type === "allergy_alert" ? "allergy" :
        template?.type === "medication_summary" ? "medication" :
        template?.type === "referral_vc" ? "referral" :
        template?.type === "medical_certificate" ? "medical_certificate" :
        template?.type === "prescription" ? "prescription" :
        template?.type === "claim_package" ? "claim" :
        template?.type === "sync_receipt" ? "sync_receipt" : "immunization";
      await db.createWalletCard({
        patientId: request.patientId,
        credentialId: issuedId!,
        cardType: cardType as any,
        displayName: template?.name || "Credential",
        displayNameEn: template?.nameEn || template?.type?.replace(/_/g, " ") || "Credential",
      });

      // Notify maker that their request was approved
      await db.createNotification({
        userId: request.makerId,
        hospitalId: request.hospitalId,
        type: "vc_approved",
        title: "คำขอออก VC ได้รับอนุมัติ",
        message: `คำขอ ${request.requestNumber} ได้รับอนุมัติจาก ${user.name} และออก VC เรียบร้อยแล้ว`,
        metadata: { requestId: request.id, requestNumber: request.requestNumber, checkerName: user.name, credentialId },
      });
      // Notify patient that a VC was issued to them
      await db.createNotification({
        userId: request.patientId,
        hospitalId: request.hospitalId,
        type: "vc_issued",
        title: "คุณได้รับใบรับรองดิจิทัลใหม่",
        message: `ใบรับรอง ${template?.name || "VC"} ถูกออกให้คุณเรียบร้อยแล้ว`,
        metadata: { requestId: request.id, credentialId, templateName: template?.name },
      });

      await db.createAuditEvent({
        actorId: ctx.user.id,
        actorRole: user.systemRole,
        hospitalId: request.hospitalId,
        action: "vc_request.approved",
        resourceType: "credential_request",
        resourceId: request.requestNumber,
        details: { requestId: request.id, issuedCredentialId: issuedId, comment: input.comment },
      });

      return { success: true, credentialId, issuedCredentialId: issuedId };
    }),

    // Checker: reject a request
    reject: clinicalProcedure.input(z.object({
      requestId: z.number(),
      comment: z.string().min(1, "กรุณาระบุเหตุผลในการปฏิเสธ"),
    })).mutation(async ({ ctx, input }) => {
      // Verify user is a checker
      const additionalRoles = await db.getUserAdditionalRoles(ctx.user.id);
      const user = ctx.user as any;
      const isChecker = additionalRoles.includes("issuer_checker") || user.systemRole === "system_admin";
      if (!isChecker) throw new TRPCError({ code: "FORBIDDEN", message: "ต้องมีสิทธิ์ Checker จึงจะปฏิเสธได้" });

      const request = await db.getCredentialRequestById(input.requestId);
      if (!request) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบคำขอ" });
      if (request.status !== "pending_review") throw new TRPCError({ code: "BAD_REQUEST", message: "ปฏิเสธได้เฉพาะคำขอที่รอตรวจสอบ" });

      await db.rejectRequest(input.requestId, ctx.user.id, input.comment);

      // Notify maker that their request was rejected
      await db.createNotification({
        userId: request.makerId,
        hospitalId: request.hospitalId,
        type: "vc_rejected",
        title: "คำขอออก VC ถูกปฏิเสธ",
        message: `คำขอ ${request.requestNumber} ถูกปฏิเสธโดย ${user.name}: ${input.comment}`,
        metadata: { requestId: request.id, requestNumber: request.requestNumber, checkerName: user.name, reason: input.comment },
      });

      await db.createAuditEvent({
        actorId: ctx.user.id,
        actorRole: user.systemRole,
        hospitalId: request.hospitalId,
        action: "vc_request.rejected",
        resourceType: "credential_request",
        resourceId: request.requestNumber,
        details: { requestId: request.id, comment: input.comment },
      });

      return { success: true };
    }),

    // List requests for maker (my requests)
    myRequests: clinicalProcedure.query(async ({ ctx }) => {
      return db.listCredentialRequestsByMaker(ctx.user.id);
    }),

    // List pending review requests for checker
    pendingReviews: clinicalProcedure.query(async ({ ctx }) => {
      const user = ctx.user as any;
      const additionalRoles = await db.getUserAdditionalRoles(ctx.user.id);
      const isChecker = additionalRoles.includes("issuer_checker") || user.systemRole === "system_admin";
      if (!isChecker) return [];
      // System admin sees all, checker sees their hospital
      if (user.systemRole === "system_admin") {
        return db.listPendingReviewRequests();
      }
      return db.listPendingReviewRequests(user.hospitalId);
    }),

    // Get single request detail
    getById: clinicalProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return db.getCredentialRequestById(input.id);
    }),

    // Count pending reviews (for badge)
    pendingCount: protectedProcedure.query(async ({ ctx }) => {
      const user = ctx.user as any;
      const additionalRoles = await db.getUserAdditionalRoles(ctx.user.id);
      const isChecker = additionalRoles.includes("issuer_checker") || user.systemRole === "system_admin";
      if (!isChecker) return { count: 0 };
      if (user.systemRole === "system_admin") {
        return { count: await db.countPendingReviewRequests() };
      }
      return { count: await db.countPendingReviewRequests(user.hospitalId) };
    }),

    // List my reviewed requests (for checker history)
    myReviews: clinicalProcedure.query(async ({ ctx }) => {
      return db.listCredentialRequestsByChecker(ctx.user.id);
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
function getCardDisplayName(type: string): string {
  const extendedNames: Record<string, string> = {
    medical_certificate: "Medical Certificate",
    prescription: "Prescription",
    claim_package: "Claim Package",
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
  return `did:key:trustcare-patient-${userId}`;
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
