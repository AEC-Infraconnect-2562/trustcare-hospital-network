import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import { nanoid } from "nanoid";
import { notifyOwner } from "./_core/notification";

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
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
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
      type: z.enum(["patient_identity", "consent_receipt", "patient_summary", "allergy_alert", "medication_summary", "referral_vc", "immunization"]),
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
    issue: protectedProcedure.input(z.object({
      templateId: z.number(),
      subjectId: z.number(),
      issuerHospitalId: z.number(),
      type: z.enum(["patient_identity", "consent_receipt", "patient_summary", "allergy_alert", "medication_summary", "referral_vc", "immunization"]),
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
                  input.type === "referral_vc" ? "referral" : "immunization",
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
      // In production: validate SD-JWT VP, check revocation status, verify issuer DID
      // For now: simulate verification result
      const isValid = !!input.token || !!input.vpUrl;
      const trustLevel = isValid ? "green" : "red";
      return {
        trustLevel,
        verified: isValid,
        issuer: "Trustcare Central Hospital",
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
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
      systemRole: z.enum(["system_admin", "hospital_admin", "doctor", "nurse", "integration_engineer", "patient"]),
      hospitalId: z.number().optional(),
    })).mutation(async ({ input }) => {
      await db.updateUserProfile(input.id, { systemRole: input.systemRole, hospitalId: input.hospitalId } as any);
      return { success: true };
    }),
  }),
});

export type AppRouter = typeof appRouter;

// Helper
function getCardDisplayName(type: string): string {
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
