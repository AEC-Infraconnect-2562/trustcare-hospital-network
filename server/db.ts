import { eq, desc, and, sql, like, or, count, gte, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  hospitals, InsertHospital,
  departments, InsertDepartment,
  credentialTemplates, InsertCredentialTemplate,
  issuedCredentials, InsertIssuedCredential,
  credentialIssuanceRequests, InsertCredentialIssuanceRequest,
  walletCards, InsertWalletCard,
  issuedPresentations, InsertIssuedPresentation,
  presentationHistory,
  consentPolicies, InsertConsentPolicy,
  consentRecords, InsertConsentRecord,
  referrals, InsertReferral,
  fhirFieldMappings, InsertFhirFieldMapping,
  terminologyMappings, InsertTerminologyMapping,
  auditEvents, InsertAuditEvent,
  vcVpSeedBatches, InsertVcVpSeedBatch,
  notifications, InsertNotification,
  userRoles, InsertUserRole,
  credentialRequests, InsertCredentialRequest,
  serviceReadinessChecks, InsertServiceReadinessCheck,
  walletDocumentRequests, InsertWalletDocumentRequest,
  careTransitionCaseEvents, InsertCareTransitionCaseEvent,
  caseDocuments, InsertCaseDocument,
  caseTasks, InsertCaseTask,
  partnerSourceConnectors, InsertPartnerSourceConnector,
  partnerSourceAttestations, InsertPartnerSourceAttestation,
  carePackages, InsertCarePackage,
  carePackageItems, InsertCarePackageItem,
  caseDecisions, InsertCaseDecision,
  documentBundles, InsertDocumentBundle,
  vcSchemaRegistry, InsertVcSchemaRegistry,
} from "../drizzle/schema";
import { ENV } from './_core/env';
import { isIssuerPrivilegeRole, isPatientRole } from "@shared/rolePolicy";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============================================================
// USER HELPERS
// ============================================================
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];
  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  };
  textFields.forEach(assignNullable);

  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; (values as any).systemRole = 'system_admin'; updateSet.systemRole = 'system_admin'; }

  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function listUsers(filters?: { hospitalId?: number; systemRole?: string }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters?.hospitalId) conditions.push(eq(users.hospitalId, filters.hospitalId));
  if (filters?.systemRole) conditions.push(eq(users.systemRole, filters.systemRole as any));
  if (conditions.length > 0) {
    return db.select().from(users).where(and(...conditions)).orderBy(desc(users.createdAt));
  }
  return db.select().from(users).orderBy(desc(users.createdAt));
}

export async function updateUserProfile(id: number, data: Partial<InsertUser>) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set(data).where(eq(users.id, id));
}

// ============================================================
// HOSPITAL HELPERS
// ============================================================
export async function listHospitals() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(hospitals).orderBy(desc(hospitals.createdAt));
}

export async function getHospitalById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(hospitals).where(eq(hospitals.id, id)).limit(1);
  return result[0];
}

export async function createHospital(data: InsertHospital) {
  const db = await getDb();
  if (!db) return;
  const result = await db.insert(hospitals).values(data);
  return result[0].insertId;
}

export async function updateHospital(id: number, data: Partial<InsertHospital>) {
  const db = await getDb();
  if (!db) return;
  await db.update(hospitals).set(data).where(eq(hospitals.id, id));
}

export async function deleteHospital(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(hospitals).where(eq(hospitals.id, id));
}

// ============================================================
// DEPARTMENT HELPERS
// ============================================================
export async function listDepartments(hospitalId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(departments).where(eq(departments.hospitalId, hospitalId));
}

export async function createDepartment(data: InsertDepartment) {
  const db = await getDb();
  if (!db) return;
  const result = await db.insert(departments).values(data);
  return result[0].insertId;
}

// ============================================================
// CREDENTIAL TEMPLATE HELPERS
// ============================================================
export async function listCredentialTemplates(hospitalId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (hospitalId) {
    return db.select().from(credentialTemplates)
      .where(or(eq(credentialTemplates.hospitalId, hospitalId), sql`${credentialTemplates.hospitalId} IS NULL`))
      .orderBy(desc(credentialTemplates.createdAt));
  }
  return db.select().from(credentialTemplates).orderBy(desc(credentialTemplates.createdAt));
}

export async function createCredentialTemplate(data: InsertCredentialTemplate) {
  const db = await getDb();
  if (!db) return;
  const result = await db.insert(credentialTemplates).values(data);
  return result[0].insertId;
}

// ============================================================
// ISSUED CREDENTIAL HELPERS
// ============================================================
export async function listIssuedCredentials(filters?: { hospitalId?: number; subjectId?: number; type?: string; status?: string; documentCategory?: string }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters?.hospitalId) conditions.push(eq(issuedCredentials.issuerHospitalId, filters.hospitalId));
  if (filters?.subjectId) conditions.push(eq(issuedCredentials.subjectId, filters.subjectId));
  if (filters?.type) conditions.push(eq(issuedCredentials.type, filters.type as any));
  if (filters?.status) conditions.push(eq(issuedCredentials.status, filters.status as any));
  if (filters?.documentCategory) conditions.push(eq(issuedCredentials.documentCategory, filters.documentCategory));
  if (conditions.length > 0) {
    return db.select().from(issuedCredentials).where(and(...conditions)).orderBy(desc(issuedCredentials.issuedAt));
  }
  return db.select().from(issuedCredentials).orderBy(desc(issuedCredentials.issuedAt));
}

export async function createIssuedCredential(data: InsertIssuedCredential) {
  const db = await getDb();
  if (!db) return;
  const result = await db.insert(issuedCredentials).values(data);
  return result[0].insertId;
}

export async function revokeCredential(id: number, reason: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(issuedCredentials).set({
    status: "revoked",
    revokedAt: new Date(),
    revocationReason: reason,
  }).where(eq(issuedCredentials.id, id));
}

export async function getCredentialById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(issuedCredentials).where(eq(issuedCredentials.id, id)).limit(1);
  return result[0];
}

export async function getIssuedCredentialByCredentialId(credentialId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(issuedCredentials).where(eq(issuedCredentials.credentialId, credentialId)).limit(1);
  return result[0];
}

export async function listCredentialIssuanceRequests(filters?: { hospitalId?: number; subjectId?: number; status?: string; makerId?: number; checkerId?: number; limit?: number }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters?.hospitalId) conditions.push(eq(credentialIssuanceRequests.issuerHospitalId, filters.hospitalId));
  if (filters?.subjectId) conditions.push(eq(credentialIssuanceRequests.subjectId, filters.subjectId));
  if (filters?.status) conditions.push(eq(credentialIssuanceRequests.status, filters.status as any));
  if (filters?.makerId) conditions.push(eq(credentialIssuanceRequests.makerId, filters.makerId));
  if (filters?.checkerId) conditions.push(eq(credentialIssuanceRequests.checkerId, filters.checkerId));
  const limit = filters?.limit ?? 100;
  if (conditions.length > 0) {
    return db.select().from(credentialIssuanceRequests).where(and(...conditions)).orderBy(desc(credentialIssuanceRequests.createdAt)).limit(limit);
  }
  return db.select().from(credentialIssuanceRequests).orderBy(desc(credentialIssuanceRequests.createdAt)).limit(limit);
}

export async function createCredentialIssuanceRequest(data: InsertCredentialIssuanceRequest) {
  const db = await getDb();
  if (!db) return;
  const result = await db.insert(credentialIssuanceRequests).values(data);
  return result[0].insertId;
}

export async function getCredentialIssuanceRequestById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(credentialIssuanceRequests).where(eq(credentialIssuanceRequests.id, id)).limit(1);
  return result[0];
}

export async function updateCredentialIssuanceRequest(id: number, data: Partial<InsertCredentialIssuanceRequest>) {
  const db = await getDb();
  if (!db) return;
  await db.update(credentialIssuanceRequests).set(data as any).where(eq(credentialIssuanceRequests.id, id));
}

// ============================================================
// WALLET CARD HELPERS
// ============================================================
export async function listWalletCards(patientId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(walletCards).where(eq(walletCards.patientId, patientId)).orderBy(desc(walletCards.createdAt));
}

export async function createWalletCard(data: InsertWalletCard) {
  const db = await getDb();
  if (!db) return;
  const result = await db.insert(walletCards).values(data);
  return result[0].insertId;
}

export async function createServiceReadinessCheck(data: InsertServiceReadinessCheck) {
  const db = await getDb();
  if (!db) return;
  const result = await db.insert(serviceReadinessChecks).values(data);
  return result[0].insertId;
}

export async function listServiceReadinessChecks(filter: { patientId: number; context?: string; limit?: number }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(serviceReadinessChecks.patientId, filter.patientId)];
  if (filter.context) conditions.push(eq(serviceReadinessChecks.context, filter.context as any));
  return db.select()
    .from(serviceReadinessChecks)
    .where(and(...conditions))
    .orderBy(desc(serviceReadinessChecks.createdAt))
    .limit(filter.limit ?? 10);
}

export async function createWalletDocumentRequest(data: InsertWalletDocumentRequest) {
  const db = await getDb();
  if (!db) return;
  const result = await db.insert(walletDocumentRequests).values(data);
  return result[0].insertId;
}

export async function listWalletDocumentRequests(filter: { patientId: number; context?: string; status?: string; limit?: number }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(walletDocumentRequests.patientId, filter.patientId)];
  if (filter.context) conditions.push(eq(walletDocumentRequests.context, filter.context as any));
  if (filter.status) conditions.push(eq(walletDocumentRequests.status, filter.status as any));
  return db.select()
    .from(walletDocumentRequests)
    .where(and(...conditions))
    .orderBy(desc(walletDocumentRequests.createdAt))
    .limit(filter.limit ?? 50);
}

export async function listIssuedPresentations(filter?: { patientId?: number; status?: string; limit?: number }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filter?.patientId) conditions.push(eq(issuedPresentations.patientId, filter.patientId));
  if (filter?.status) conditions.push(eq(issuedPresentations.status, filter.status as any));
  const limit = filter?.limit ?? 50;
  if (conditions.length > 0) {
    return db.select().from(issuedPresentations).where(and(...conditions)).orderBy(desc(issuedPresentations.createdAt)).limit(limit);
  }
  return db.select().from(issuedPresentations).orderBy(desc(issuedPresentations.createdAt)).limit(limit);
}

export async function createIssuedPresentation(data: InsertIssuedPresentation) {
  const db = await getDb();
  if (!db) return;
  const result = await db.insert(issuedPresentations).values(data);
  return result[0].insertId;
}

export async function getIssuedPresentationByPresentationId(presentationId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(issuedPresentations).where(eq(issuedPresentations.presentationId, presentationId)).limit(1);
  return result[0];
}

export async function listPresentationHistory(patientId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(presentationHistory).where(eq(presentationHistory.patientId, patientId)).orderBy(desc(presentationHistory.presentedAt));
}

// ============================================================
// CONSENT HELPERS
// ============================================================
export async function listConsentPolicies(hospitalId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (hospitalId) {
    return db.select().from(consentPolicies)
      .where(or(eq(consentPolicies.hospitalId, hospitalId), sql`${consentPolicies.hospitalId} IS NULL`));
  }
  return db.select().from(consentPolicies);
}

export async function createConsentPolicy(data: InsertConsentPolicy) {
  const db = await getDb();
  if (!db) return;
  const result = await db.insert(consentPolicies).values(data);
  return result[0].insertId;
}

export async function listConsentRecords(patientId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(consentRecords).where(eq(consentRecords.patientId, patientId)).orderBy(desc(consentRecords.grantedAt));
}

export async function createConsentRecord(data: InsertConsentRecord) {
  const db = await getDb();
  if (!db) return;
  const result = await db.insert(consentRecords).values(data);
  return result[0].insertId;
}

export async function revokeConsent(id: number, reason: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(consentRecords).set({
    status: "revoked",
    revokedAt: new Date(),
    revocationReason: reason,
  }).where(eq(consentRecords.id, id));
}

// ============================================================
// REFERRAL HELPERS
// ============================================================
export async function listReferrals(filters?: { fromHospitalId?: number; toHospitalId?: number; patientId?: number; status?: string }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters?.fromHospitalId) conditions.push(eq(referrals.fromHospitalId, filters.fromHospitalId));
  if (filters?.toHospitalId) conditions.push(eq(referrals.toHospitalId, filters.toHospitalId));
  if (filters?.patientId) conditions.push(eq(referrals.patientId, filters.patientId));
  if (filters?.status) conditions.push(eq(referrals.status, filters.status as any));
  if (conditions.length > 0) {
    return db.select().from(referrals).where(and(...conditions)).orderBy(desc(referrals.createdAt));
  }
  return db.select().from(referrals).orderBy(desc(referrals.createdAt));
}

export async function createReferral(data: InsertReferral) {
  const db = await getDb();
  if (!db) return;
  const result = await db.insert(referrals).values(data);
  return result[0].insertId;
}

export async function updateReferralStatus(id: number, status: string, extra?: Record<string, unknown>) {
  const db = await getDb();
  if (!db) return;
  const updateData: Record<string, unknown> = { status };
  if (status === "accepted") updateData.acceptedAt = new Date();
  if (status === "completed") updateData.completedAt = new Date();
  if (status === "rejected") updateData.rejectedAt = new Date();
  if (extra) Object.assign(updateData, extra);
  await db.update(referrals).set(updateData).where(eq(referrals.id, id));
}

export async function getReferralById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(referrals).where(eq(referrals.id, id)).limit(1);
  return result[0];
}

// ============================================================
// FHIR MAPPING HELPERS
// ============================================================
export async function listFhirMappings(hospitalId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(fhirFieldMappings).where(eq(fhirFieldMappings.hospitalId, hospitalId));
}

export async function createFhirMapping(data: InsertFhirFieldMapping) {
  const db = await getDb();
  if (!db) return;
  const result = await db.insert(fhirFieldMappings).values(data);
  return result[0].insertId;
}

export async function updateFhirMapping(id: number, data: Partial<InsertFhirFieldMapping>) {
  const db = await getDb();
  if (!db) return;
  await db.update(fhirFieldMappings).set(data).where(eq(fhirFieldMappings.id, id));
}

// ============================================================
// TERMINOLOGY MAPPING HELPERS
// ============================================================
export async function listTerminologyMappings(filters?: { hospitalId?: number; codeSystem?: string; status?: string }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters?.hospitalId) conditions.push(eq(terminologyMappings.hospitalId, filters.hospitalId));
  if (filters?.codeSystem) conditions.push(eq(terminologyMappings.codeSystem, filters.codeSystem as any));
  if (filters?.status) conditions.push(eq(terminologyMappings.status, filters.status as any));
  if (conditions.length > 0) {
    return db.select().from(terminologyMappings).where(and(...conditions)).orderBy(desc(terminologyMappings.createdAt));
  }
  return db.select().from(terminologyMappings).orderBy(desc(terminologyMappings.createdAt));
}

export async function createTerminologyMapping(data: InsertTerminologyMapping) {
  const db = await getDb();
  if (!db) return;
  const result = await db.insert(terminologyMappings).values(data);
  return result[0].insertId;
}

export async function updateTerminologyMapping(id: number, data: Partial<InsertTerminologyMapping>) {
  const db = await getDb();
  if (!db) return;
  await db.update(terminologyMappings).set(data).where(eq(terminologyMappings.id, id));
}

// ============================================================
// AUDIT EVENT HELPERS
// ============================================================
export async function listAuditEvents(filters?: { hospitalId?: number; actorId?: number; action?: string; limit?: number }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters?.hospitalId) conditions.push(eq(auditEvents.hospitalId, filters.hospitalId));
  if (filters?.actorId) conditions.push(eq(auditEvents.actorId, filters.actorId));
  if (filters?.action) conditions.push(eq(auditEvents.action, filters.action));
  const limit = filters?.limit || 100;
  if (conditions.length > 0) {
    return db.select().from(auditEvents).where(and(...conditions)).orderBy(desc(auditEvents.createdAt)).limit(limit);
  }
  return db.select().from(auditEvents).orderBy(desc(auditEvents.createdAt)).limit(limit);
}

export async function createAuditEvent(data: InsertAuditEvent) {
  const db = await getDb();
  if (!db) return;
  await db.insert(auditEvents).values(data);
}

export async function listVcVpSeedBatches(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(vcVpSeedBatches).orderBy(desc(vcVpSeedBatches.startedAt)).limit(limit);
}

export async function createVcVpSeedBatch(data: InsertVcVpSeedBatch) {
  const db = await getDb();
  if (!db) return;
  const result = await db.insert(vcVpSeedBatches).values(data);
  return result[0].insertId;
}

// ============================================================
// NOTIFICATION HELPERS
// ============================================================
export async function listNotifications(userId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (userId) {
    return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(50);
  }
  return db.select().from(notifications).orderBy(desc(notifications.createdAt)).limit(50);
}

export async function createNotification(data: InsertNotification) {
  const db = await getDb();
  if (!db) return;
  await db.insert(notifications).values(data);
}

export async function markNotificationRead(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
}

// ============================================================
// DASHBOARD STATISTICS
// ============================================================
export async function getDashboardStats() {
  const db = await getDb();
  if (!db) return { hospitals: 0, credentials: 0, patients: 0, referrals: 0, claims: 0, tourists: 0, adapters: 0, adaptersOnline: 0 };

  const [hospitalCount] = await db.select({ count: count() }).from(hospitals);
  const [credentialCount] = await db.select({ count: count() }).from(issuedCredentials);
  const [patientCount] = await db.select({ count: count() }).from(users).where(eq(users.systemRole, "patient"));
  const [referralCount] = await db.select({ count: count() }).from(referrals);
  const [claimCount] = await db.select({ count: count() }).from(claimCases);
  const [touristCount] = await db.select({ count: count() }).from(internationalCases);
  const [adapterCount] = await db.select({ count: count() }).from(integrationAdapters);
  const [adapterOnlineCount] = await db.select({ count: count() }).from(integrationAdapters).where(eq(integrationAdapters.status, "active"));

  return {
    hospitals: hospitalCount.count,
    credentials: credentialCount.count,
    patients: patientCount.count,
    referrals: referralCount.count,
    claims: claimCount.count,
    tourists: touristCount.count,
    adapters: adapterCount.count,
    adaptersOnline: adapterOnlineCount.count,
  };
}

// ============================================================
// IMPORT NEW TABLES
// ============================================================
import {
  patientIdentifiers, InsertPatientIdentifier,
  mpiMatches,
  integrationAdapters, InsertIntegrationAdapter,
  adapterHealthLogs,
  mappingVersions, InsertMappingVersion,
  integrationEventLogs,
  credentialStatusEvents, InsertCredentialStatusEvent,
  syncReconciliationJobs, InsertSyncReconciliationJob,
  trustRegistry, InsertTrustRegistryEntry,
  taoTrustedIssuers, InsertTaoTrustedIssuer,
  taoTrustedVerifiers, InsertTaoTrustedVerifier,
  taoTrustPolicies, InsertTaoTrustPolicy,
  smartHealthLinks, InsertSmartHealthLink,
  shlFiles, InsertShlFile,
  shlManifestVersions, InsertShlManifestVersion,
  shlAccessLogs,
  payerAdapters, InsertPayerAdapter,
  coverageEligibility, InsertCoverageEligibility,
  claimCases, InsertClaimCase,
  internationalCases, InsertInternationalCase,
  travelDocuments, InsertTravelDocument,
  crossBorderReferrals, InsertCrossBorderReferral,
} from "../drizzle/schema";

// ============================================================
// PATIENT IDENTITY / MPI HELPERS
// ============================================================
export async function listPatientIdentifiers(patientId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(patientIdentifiers).where(eq(patientIdentifiers.patientId, patientId));
}

export async function createPatientIdentifier(data: InsertPatientIdentifier) {
  const db = await getDb();
  if (!db) return;
  const result = await db.insert(patientIdentifiers).values(data);
  return result[0].insertId;
}

export async function listMpiMatches(filter?: { status?: string }) {
  const db = await getDb();
  if (!db) return [];
  if (filter?.status) {
    return db.select().from(mpiMatches).where(eq(mpiMatches.matchStatus, filter.status as any)).orderBy(desc(mpiMatches.createdAt)).limit(100);
  }
  return db.select().from(mpiMatches).orderBy(desc(mpiMatches.createdAt)).limit(100);
}

export async function updateMpiMatch(id: number, data: { matchStatus: string; reviewedBy?: number }) {
  const db = await getDb();
  if (!db) return;
  await db.update(mpiMatches).set({ ...data, reviewedAt: new Date() } as any).where(eq(mpiMatches.id, id));
}

// ============================================================
// INTEGRATION ADAPTER HELPERS
// ============================================================
export async function listIntegrationAdapters(hospitalId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (hospitalId) {
    return db.select().from(integrationAdapters).where(eq(integrationAdapters.hospitalId, hospitalId));
  }
  return db.select().from(integrationAdapters).orderBy(desc(integrationAdapters.createdAt));
}

export async function createIntegrationAdapter(data: InsertIntegrationAdapter) {
  const db = await getDb();
  if (!db) return;
  const result = await db.insert(integrationAdapters).values(data);
  return result[0].insertId;
}

export async function updateIntegrationAdapter(id: number, data: Partial<InsertIntegrationAdapter>) {
  const db = await getDb();
  if (!db) return;
  await db.update(integrationAdapters).set(data as any).where(eq(integrationAdapters.id, id));
}

export async function getIntegrationAdapterById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(integrationAdapters).where(eq(integrationAdapters.id, id)).limit(1);
  return result[0];
}

export async function createAdapterHealthLog(data: { adapterId: number; status: string; responseTimeMs?: number; errorMessage?: string }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(adapterHealthLogs).values(data as any);
}

export async function listAdapterHealthLogs(adapterId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(adapterHealthLogs).where(eq(adapterHealthLogs.adapterId, adapterId)).orderBy(desc(adapterHealthLogs.checkedAt)).limit(limit);
}

export async function listMappingVersions(adapterId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(mappingVersions).where(eq(mappingVersions.adapterId, adapterId)).orderBy(desc(mappingVersions.createdAt));
}

export async function createMappingVersion(data: InsertMappingVersion) {
  const db = await getDb();
  if (!db) return;
  const result = await db.insert(mappingVersions).values(data);
  return result[0].insertId;
}

export async function updateMappingVersion(id: number, data: Partial<InsertMappingVersion>) {
  const db = await getDb();
  if (!db) return;
  await db.update(mappingVersions).set(data as any).where(eq(mappingVersions.id, id));
}

export async function listIntegrationEvents(filter?: { adapterId?: number; status?: string; limit?: number }) {
  const db = await getDb();
  if (!db) return [];
  const limit = filter?.limit || 50;
  const conditions: any[] = [];
  if (filter?.adapterId) conditions.push(eq(integrationEventLogs.adapterId, filter.adapterId));
  if (filter?.status) conditions.push(eq(integrationEventLogs.status, filter.status as any));
  if (conditions.length > 0) {
    return db.select().from(integrationEventLogs).where(and(...conditions)).orderBy(desc(integrationEventLogs.createdAt)).limit(limit);
  }
  return db.select().from(integrationEventLogs).orderBy(desc(integrationEventLogs.createdAt)).limit(limit);
}

export async function createIntegrationEvent(data: any) {
  const db = await getDb();
  if (!db) return;
  await db.insert(integrationEventLogs).values(data);
}

export async function listRevokedCredentialIds() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ credentialId: issuedCredentials.credentialId })
    .from(issuedCredentials)
    .where(eq(issuedCredentials.status, "revoked" as any));
  return rows.map((row) => row.credentialId).filter(Boolean);
}

export async function createCredentialStatusEvent(data: InsertCredentialStatusEvent) {
  const db = await getDb();
  if (!db) return;
  const result = await db.insert(credentialStatusEvents).values(data);
  return result[0].insertId;
}

export async function listCredentialStatusEvents(filter?: { credentialId?: string; status?: string; limit?: number }) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  const limit = filter?.limit ?? 50;
  if (filter?.credentialId) conditions.push(eq(credentialStatusEvents.credentialId, filter.credentialId));
  if (filter?.status) conditions.push(eq(credentialStatusEvents.status, filter.status as any));
  if (conditions.length > 0) {
    return db.select().from(credentialStatusEvents).where(and(...conditions)).orderBy(desc(credentialStatusEvents.createdAt)).limit(limit);
  }
  return db.select().from(credentialStatusEvents).orderBy(desc(credentialStatusEvents.createdAt)).limit(limit);
}

export async function listRevokedCredentialStatus() {
  const db = await getDb();
  if (!db) return { credentialIds: [] as string[], statusListIndexes: [] as string[] };
  const rows = await db.select({
    credentialId: credentialStatusEvents.credentialId,
    statusListIndex: credentialStatusEvents.statusListIndex,
  })
    .from(credentialStatusEvents)
    .where(or(eq(credentialStatusEvents.status, "revoked" as any), eq(credentialStatusEvents.status, "suspended" as any)));
  return {
    credentialIds: rows.map((row) => row.credentialId).filter(Boolean),
    statusListIndexes: rows.map((row) => row.statusListIndex).filter((value): value is string => Boolean(value)),
  };
}

export async function createSyncReconciliationJob(data: InsertSyncReconciliationJob) {
  const db = await getDb();
  if (!db) return;
  const result = await db.insert(syncReconciliationJobs).values(data);
  return result[0].insertId;
}

export async function listSyncReconciliationJobs(filter?: { status?: string; targetId?: string; limit?: number }) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  const limit = filter?.limit ?? 50;
  if (filter?.status) conditions.push(eq(syncReconciliationJobs.status, filter.status as any));
  if (filter?.targetId) conditions.push(eq(syncReconciliationJobs.targetId, filter.targetId));
  if (conditions.length > 0) {
    return db.select().from(syncReconciliationJobs).where(and(...conditions)).orderBy(desc(syncReconciliationJobs.createdAt)).limit(limit);
  }
  return db.select().from(syncReconciliationJobs).orderBy(desc(syncReconciliationJobs.createdAt)).limit(limit);
}

// ============================================================
// TRUST REGISTRY HELPERS
// ============================================================
export async function listTrustRegistry(filter?: { entityType?: string; isActive?: boolean }) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (filter?.entityType) conditions.push(eq(trustRegistry.entityType, filter.entityType as any));
  if (filter?.isActive !== undefined) conditions.push(eq(trustRegistry.isActive, filter.isActive));
  if (conditions.length > 0) {
    return db.select().from(trustRegistry).where(and(...conditions)).orderBy(desc(trustRegistry.createdAt));
  }
  return db.select().from(trustRegistry).orderBy(desc(trustRegistry.createdAt));
}

export async function createTrustRegistryEntry(data: InsertTrustRegistryEntry) {
  const db = await getDb();
  if (!db) return;
  const result = await db.insert(trustRegistry).values(data);
  return result[0].insertId;
}

export async function updateTrustRegistryEntry(id: number, data: Partial<InsertTrustRegistryEntry>) {
  const db = await getDb();
  if (!db) return;
  await db.update(trustRegistry).set(data as any).where(eq(trustRegistry.id, id));
}

export async function getTrustRegistryByDid(did: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(trustRegistry).where(eq(trustRegistry.did, did)).limit(1);
  return result[0];
}

// ============================================================
// TAO TRUST FRAMEWORK HELPERS
// ============================================================
export async function listTaoIssuers(filter?: { trustLevel?: string; organizationType?: string; trustAnchor?: string; isActive?: boolean }) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (filter?.trustLevel) conditions.push(eq(taoTrustedIssuers.trustLevel, filter.trustLevel as any));
  if (filter?.organizationType) conditions.push(eq(taoTrustedIssuers.organizationType, filter.organizationType as any));
  if (filter?.trustAnchor) conditions.push(eq(taoTrustedIssuers.trustAnchor, filter.trustAnchor as any));
  if (filter?.isActive !== undefined) conditions.push(eq(taoTrustedIssuers.isActive, filter.isActive));
  if (conditions.length > 0) return db.select().from(taoTrustedIssuers).where(and(...conditions)).orderBy(desc(taoTrustedIssuers.createdAt));
  return db.select().from(taoTrustedIssuers).orderBy(desc(taoTrustedIssuers.createdAt));
}
export async function createTaoIssuer(data: InsertTaoTrustedIssuer) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.insert(taoTrustedIssuers).values(data);
  return result[0].insertId;
}
export async function updateTaoIssuer(id: number, data: Partial<InsertTaoTrustedIssuer>) {
  const db = await getDb();
  if (!db) return;
  await db.update(taoTrustedIssuers).set(data as any).where(eq(taoTrustedIssuers.id, id));
}
export async function getTaoIssuerByDid(did: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(taoTrustedIssuers).where(eq(taoTrustedIssuers.did, did)).limit(1);
  return result[0];
}
export async function listTaoVerifiers(filter?: { trustLevel?: string; organizationType?: string; isActive?: boolean }) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (filter?.trustLevel) conditions.push(eq(taoTrustedVerifiers.trustLevel, filter.trustLevel as any));
  if (filter?.organizationType) conditions.push(eq(taoTrustedVerifiers.organizationType, filter.organizationType as any));
  if (filter?.isActive !== undefined) conditions.push(eq(taoTrustedVerifiers.isActive, filter.isActive));
  if (conditions.length > 0) return db.select().from(taoTrustedVerifiers).where(and(...conditions)).orderBy(desc(taoTrustedVerifiers.createdAt));
  return db.select().from(taoTrustedVerifiers).orderBy(desc(taoTrustedVerifiers.createdAt));
}
export async function createTaoVerifier(data: InsertTaoTrustedVerifier) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.insert(taoTrustedVerifiers).values(data);
  return result[0].insertId;
}
export async function updateTaoVerifier(id: number, data: Partial<InsertTaoTrustedVerifier>) {
  const db = await getDb();
  if (!db) return;
  await db.update(taoTrustedVerifiers).set(data as any).where(eq(taoTrustedVerifiers.id, id));
}
export async function listTaoPolicies(filter?: { credentialType?: string; enforcementMode?: string; isActive?: boolean }) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (filter?.credentialType) conditions.push(eq(taoTrustPolicies.credentialType, filter.credentialType));
  if (filter?.enforcementMode) conditions.push(eq(taoTrustPolicies.enforcementMode, filter.enforcementMode as any));
  if (filter?.isActive !== undefined) conditions.push(eq(taoTrustPolicies.isActive, filter.isActive));
  if (conditions.length > 0) return db.select().from(taoTrustPolicies).where(and(...conditions)).orderBy(desc(taoTrustPolicies.createdAt));
  return db.select().from(taoTrustPolicies).orderBy(desc(taoTrustPolicies.createdAt));
}
export async function createTaoPolicy(data: InsertTaoTrustPolicy) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.insert(taoTrustPolicies).values(data);
  return result[0].insertId;
}
export async function updateTaoPolicy(id: number, data: Partial<InsertTaoTrustPolicy>) {
  const db = await getDb();
  if (!db) return;
  await db.update(taoTrustPolicies).set(data as any).where(eq(taoTrustPolicies.id, id));
}
export async function checkIssuerTrust(issuerDid: string, credentialType: string): Promise<{ trusted: boolean; level: string; anchor: string; reason?: string }> {
  const issuer = await getTaoIssuerByDid(issuerDid);
  if (!issuer || !issuer.isActive) return { trusted: false, level: 'unknown', anchor: 'none', reason: 'Issuer not found in TAO registry' };
  if (issuer.trustLevel === 'revoked' || issuer.trustLevel === 'suspended') return { trusted: false, level: issuer.trustLevel, anchor: issuer.trustAnchor, reason: `Issuer is ${issuer.trustLevel}` };
  const db2 = await getDb();
  if (!db2) return { trusted: false, level: issuer.trustLevel, anchor: issuer.trustAnchor, reason: 'DB unavailable' };
  const policies = await db2.select().from(taoTrustPolicies).where(and(eq(taoTrustPolicies.credentialType, credentialType), eq(taoTrustPolicies.isActive, true)));
  if (policies.length === 0) return { trusted: true, level: issuer.trustLevel, anchor: issuer.trustAnchor };
  const policy = policies[0];
  if (policy.enforcementMode === 'off') return { trusted: true, level: issuer.trustLevel, anchor: issuer.trustAnchor };
  const levelHierarchy = ['accredited', 'recognized', 'self_declared', 'any'];
  const requiredIdx = levelHierarchy.indexOf(policy.requiredTrustLevel);
  const issuerIdx = levelHierarchy.indexOf(issuer.trustLevel);
  if (issuerIdx > requiredIdx && policy.requiredTrustLevel !== 'any') {
    const reason = `Issuer trust level '${issuer.trustLevel}' below required '${policy.requiredTrustLevel}'`;
    if (policy.enforcementMode === 'strict') return { trusted: false, level: issuer.trustLevel, anchor: issuer.trustAnchor, reason };
    return { trusted: true, level: issuer.trustLevel, anchor: issuer.trustAnchor, reason };
  }
  if (policy.requiredTrustAnchor !== 'any' && issuer.trustAnchor !== policy.requiredTrustAnchor) {
    const reason = `Issuer trust anchor '${issuer.trustAnchor}' does not match required '${policy.requiredTrustAnchor}'`;
    if (policy.enforcementMode === 'strict') return { trusted: false, level: issuer.trustLevel, anchor: issuer.trustAnchor, reason };
    return { trusted: true, level: issuer.trustLevel, anchor: issuer.trustAnchor, reason };
  }
  return { trusted: true, level: issuer.trustLevel, anchor: issuer.trustAnchor };
}
// ============================================================
// SMART HEALTH LINKS HELPERS
// ============================================================
export async function listSmartHealthLinks(filter: number | { patientId?: number; hospitalId?: number; status?: string; purpose?: string } = {}) {
  const db = await getDb();
  if (!db) return [];
  const normalized = typeof filter === "number" ? { patientId: filter } : filter;
  const conditions = [];
  if (normalized.patientId) conditions.push(eq(smartHealthLinks.patientId, normalized.patientId));
  if (normalized.hospitalId) conditions.push(eq(smartHealthLinks.hospitalId, normalized.hospitalId));
  if (normalized.status) conditions.push(eq(smartHealthLinks.status, normalized.status as any));
  if (normalized.purpose) conditions.push(eq(smartHealthLinks.purpose, normalized.purpose as any));
  if (conditions.length > 0) {
    return db.select().from(smartHealthLinks).where(and(...conditions)).orderBy(desc(smartHealthLinks.createdAt));
  }
  return db.select().from(smartHealthLinks).orderBy(desc(smartHealthLinks.createdAt));
}

export async function createSmartHealthLink(data: InsertSmartHealthLink) {
  const db = await getDb();
  if (!db) return;
  const result = await db.insert(smartHealthLinks).values(data);
  return result[0].insertId;
}

export async function getShlById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(smartHealthLinks).where(eq(smartHealthLinks.id, id)).limit(1);
  return result[0];
}

export async function getShlByManifestToken(manifestToken: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(smartHealthLinks).where(eq(smartHealthLinks.manifestToken, manifestToken)).limit(1);
  return result[0];
}

export async function updateSmartHealthLink(id: number, data: Partial<InsertSmartHealthLink>) {
  const db = await getDb();
  if (!db) return;
  await db.update(smartHealthLinks).set(data as any).where(eq(smartHealthLinks.id, id));
}

export async function revokeShl(id: number, reason?: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(smartHealthLinks).set({ status: "revoked", revokedAt: new Date(), disabledReason: reason } as any).where(eq(smartHealthLinks.id, id));
}

export async function incrementShlAccessCount(id: number) {
  const db = await getDb();
  if (!db) return;
  const shl = await getShlById(id);
  if (shl) {
    await db.update(smartHealthLinks).set({ currentAccessCount: shl.currentAccessCount + 1, lastAccessedAt: new Date() } as any).where(eq(smartHealthLinks.id, id));
  }
}

export async function createShlFile(data: InsertShlFile) {
  const db = await getDb();
  if (!db) return;
  const result = await db.insert(shlFiles).values(data);
  return result[0].insertId;
}

export async function listShlFiles(shlId: number, manifestVersion?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(shlFiles.shlId, shlId)];
  if (manifestVersion) conditions.push(eq(shlFiles.manifestVersion, manifestVersion));
  return db.select().from(shlFiles).where(and(...conditions)).orderBy(desc(shlFiles.createdAt));
}

export async function createShlManifestVersion(data: InsertShlManifestVersion) {
  const db = await getDb();
  if (!db) return;
  const result = await db.insert(shlManifestVersions).values(data);
  return result[0].insertId;
}

export async function supersedeShlManifestVersions(shlId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(shlManifestVersions).set({ status: "superseded" } as any)
    .where(and(eq(shlManifestVersions.shlId, shlId), eq(shlManifestVersions.status, "current" as any)));
}

export async function revokeShlManifestVersions(shlId: number, reason?: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(shlManifestVersions).set({ status: "revoked", changeReason: reason } as any)
    .where(and(eq(shlManifestVersions.shlId, shlId), eq(shlManifestVersions.status, "current" as any)));
}

export async function listShlManifestVersions(shlId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(shlManifestVersions).where(eq(shlManifestVersions.shlId, shlId)).orderBy(desc(shlManifestVersions.createdAt));
}

export async function createShlAccessLog(data: {
  shlId: number;
  accessorName?: string;
  accessorOrg?: string;
  accessorCountry?: string;
  recipient?: string;
  result?: string;
  failureReason?: string;
  userAgent?: string;
  manifestRequestedAt?: Date;
  fileId?: string;
  countryHint?: string;
  verifiedVpResult?: unknown;
  ipAddress?: string;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(shlAccessLogs).values(data as any);
}

export async function listShlAccessLogs(shlId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(shlAccessLogs).where(eq(shlAccessLogs.shlId, shlId)).orderBy(desc(shlAccessLogs.accessedAt));
}

// ============================================================
// E-CLAIM / PAYER HELPERS
// ============================================================
export async function listPayerAdapters() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(payerAdapters).orderBy(desc(payerAdapters.createdAt));
}

export async function getPayerAdapterById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(payerAdapters).where(eq(payerAdapters.id, id)).limit(1);
  return result[0];
}

export async function createPayerAdapter(data: InsertPayerAdapter) {
  const db = await getDb();
  if (!db) return;
  const result = await db.insert(payerAdapters).values(data);
  return result[0].insertId;
}

export async function updatePayerAdapter(id: number, data: Partial<InsertPayerAdapter>) {
  const db = await getDb();
  if (!db) return;
  await db.update(payerAdapters).set(data as any).where(eq(payerAdapters.id, id));
}

export async function checkCoverageEligibility(data: InsertCoverageEligibility) {
  const db = await getDb();
  if (!db) return;
  const result = await db.insert(coverageEligibility).values(data);
  return result[0].insertId;
}

export async function listCoverageEligibility(patientId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(coverageEligibility).where(eq(coverageEligibility.patientId, patientId)).orderBy(desc(coverageEligibility.createdAt));
}

export async function listClaimCases(filter?: { hospitalId?: number; status?: string; patientId?: number }) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (filter?.hospitalId) conditions.push(eq(claimCases.hospitalId, filter.hospitalId));
  if (filter?.status) conditions.push(eq(claimCases.status, filter.status as any));
  if (filter?.patientId) conditions.push(eq(claimCases.patientId, filter.patientId));
  if (conditions.length > 0) {
    return db.select().from(claimCases).where(and(...conditions)).orderBy(desc(claimCases.createdAt)).limit(100);
  }
  return db.select().from(claimCases).orderBy(desc(claimCases.createdAt)).limit(100);
}

export async function createClaimCase(data: InsertClaimCase) {
  const db = await getDb();
  if (!db) return;
  const result = await db.insert(claimCases).values(data);
  return result[0].insertId;
}

export async function updateClaimCase(id: number, data: Partial<InsertClaimCase>) {
  const db = await getDb();
  if (!db) return;
  await db.update(claimCases).set(data as any).where(eq(claimCases.id, id));
}

export async function getClaimCaseById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(claimCases).where(eq(claimCases.id, id)).limit(1);
  return result[0];
}

// ============================================================
// MEDICAL TOURIST / INTERNATIONAL HELPERS
// ============================================================
export async function listInternationalCases(filter?: { status?: string; assignedCoordinatorId?: number }) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (filter?.status) conditions.push(eq(internationalCases.status, filter.status as any));
  if (filter?.assignedCoordinatorId) conditions.push(eq(internationalCases.assignedCoordinatorId, filter.assignedCoordinatorId));
  if (conditions.length > 0) {
    return db.select().from(internationalCases).where(and(...conditions)).orderBy(desc(internationalCases.createdAt)).limit(100);
  }
  return db.select().from(internationalCases).orderBy(desc(internationalCases.createdAt)).limit(100);
}

export async function createInternationalCase(data: InsertInternationalCase) {
  const db = await getDb();
  if (!db) return;
  const result = await db.insert(internationalCases).values(data);
  return result[0].insertId;
}

export async function updateInternationalCase(id: number, data: Partial<InsertInternationalCase>) {
  const db = await getDb();
  if (!db) return;
  await db.update(internationalCases).set(data as any).where(eq(internationalCases.id, id));
}

export async function getInternationalCaseById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(internationalCases).where(eq(internationalCases.id, id)).limit(1);
  return result[0];
}

export async function listTravelDocuments(caseId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(travelDocuments).where(eq(travelDocuments.caseId, caseId)).orderBy(desc(travelDocuments.createdAt));
}

export async function createTravelDocument(data: InsertTravelDocument) {
  const db = await getDb();
  if (!db) return;
  const result = await db.insert(travelDocuments).values(data);
  return result[0].insertId;
}

export async function updateTravelDocument(id: number, data: Partial<InsertTravelDocument>) {
  const db = await getDb();
  if (!db) return;
  await db.update(travelDocuments).set(data as any).where(eq(travelDocuments.id, id));
}

// ============================================================
// CROSS-BORDER REFERRAL HELPERS
// ============================================================
export async function listCrossBorderReferrals(filter?: { referralType?: string; status?: string }) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (filter?.referralType) conditions.push(eq(crossBorderReferrals.referralType, filter.referralType as any));
  if (filter?.status) conditions.push(eq(crossBorderReferrals.status, filter.status as any));
  if (conditions.length > 0) {
    return db.select().from(crossBorderReferrals).where(and(...conditions)).orderBy(desc(crossBorderReferrals.createdAt)).limit(100);
  }
  return db.select().from(crossBorderReferrals).orderBy(desc(crossBorderReferrals.createdAt)).limit(100);
}

export async function createCrossBorderReferral(data: InsertCrossBorderReferral) {
  const db = await getDb();
  if (!db) return;
  const result = await db.insert(crossBorderReferrals).values(data);
  return result[0].insertId;
}

export async function updateCrossBorderReferral(id: number, data: Partial<InsertCrossBorderReferral>) {
  const db = await getDb();
  if (!db) return;
  await db.update(crossBorderReferrals).set(data as any).where(eq(crossBorderReferrals.id, id));
}

export async function getCrossBorderReferralById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(crossBorderReferrals).where(eq(crossBorderReferrals.id, id)).limit(1);
  return result[0];
}

// ============================================================
// CARE TRANSITION / PARTNER PORTAL HELPERS
// ============================================================
type CareCaseFilter = {
  caseType?: string;
  caseId?: number;
  status?: string;
  partnerOrgId?: number;
  connectorType?: string;
};

export async function createCareTransitionEvent(data: InsertCareTransitionCaseEvent) {
  const db = await getDb();
  if (!db) return;
  const result = await db.insert(careTransitionCaseEvents).values(data);
  return result[0].insertId;
}

export async function listCareTransitionEvents(filter: { caseType: string; caseId: number }) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(careTransitionCaseEvents)
    .where(and(eq(careTransitionCaseEvents.caseType, filter.caseType as any), eq(careTransitionCaseEvents.caseId, filter.caseId)))
    .orderBy(desc(careTransitionCaseEvents.createdAt));
}

export async function createCaseDocument(data: InsertCaseDocument) {
  const db = await getDb();
  if (!db) return;
  const result = await db.insert(caseDocuments).values(data);
  return result[0].insertId;
}

export async function listCaseDocuments(filter?: CareCaseFilter & { direction?: string; verificationStatus?: string }) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (filter?.caseType) conditions.push(eq(caseDocuments.caseType, filter.caseType as any));
  if (filter?.caseId) conditions.push(eq(caseDocuments.caseId, filter.caseId));
  if (filter?.direction) conditions.push(eq(caseDocuments.direction, filter.direction as any));
  if (filter?.verificationStatus) conditions.push(eq(caseDocuments.verificationStatus, filter.verificationStatus as any));
  if (conditions.length > 0) {
    return db.select().from(caseDocuments).where(and(...conditions)).orderBy(desc(caseDocuments.createdAt)).limit(200);
  }
  return db.select().from(caseDocuments).orderBy(desc(caseDocuments.createdAt)).limit(200);
}

export async function getCaseDocumentById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(caseDocuments).where(eq(caseDocuments.id, id)).limit(1);
  return result[0];
}

export async function updateCaseDocument(id: number, data: Partial<InsertCaseDocument>) {
  const db = await getDb();
  if (!db) return;
  await db.update(caseDocuments).set(data as any).where(eq(caseDocuments.id, id));
}

export async function createCaseTask(data: InsertCaseTask) {
  const db = await getDb();
  if (!db) return;
  const result = await db.insert(caseTasks).values(data);
  return result[0].insertId;
}

export async function listCaseTasks(filter?: CareCaseFilter & { taskType?: string }) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (filter?.caseType) conditions.push(eq(caseTasks.caseType, filter.caseType as any));
  if (filter?.caseId) conditions.push(eq(caseTasks.caseId, filter.caseId));
  if (filter?.status) conditions.push(eq(caseTasks.status, filter.status as any));
  if (filter?.taskType) conditions.push(eq(caseTasks.taskType, filter.taskType as any));
  if (conditions.length > 0) {
    return db.select().from(caseTasks).where(and(...conditions)).orderBy(desc(caseTasks.createdAt)).limit(200);
  }
  return db.select().from(caseTasks).orderBy(desc(caseTasks.createdAt)).limit(200);
}

export async function updateCaseTask(id: number, data: Partial<InsertCaseTask>) {
  const db = await getDb();
  if (!db) return;
  await db.update(caseTasks).set(data as any).where(eq(caseTasks.id, id));
}

export async function createPartnerSourceConnector(data: InsertPartnerSourceConnector) {
  const db = await getDb();
  if (!db) return;
  const result = await db.insert(partnerSourceConnectors).values(data);
  return result[0].insertId;
}

export async function listPartnerSourceConnectors(filter?: CareCaseFilter) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (filter?.partnerOrgId) conditions.push(eq(partnerSourceConnectors.partnerOrgId, filter.partnerOrgId));
  if (filter?.connectorType) conditions.push(eq(partnerSourceConnectors.connectorType, filter.connectorType as any));
  if (filter?.status) conditions.push(eq(partnerSourceConnectors.status, filter.status as any));
  if (conditions.length > 0) {
    return db.select().from(partnerSourceConnectors).where(and(...conditions)).orderBy(desc(partnerSourceConnectors.createdAt)).limit(100);
  }
  return db.select().from(partnerSourceConnectors).orderBy(desc(partnerSourceConnectors.createdAt)).limit(100);
}

export async function getPartnerSourceConnectorById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(partnerSourceConnectors).where(eq(partnerSourceConnectors.id, id)).limit(1);
  return result[0];
}

export async function updatePartnerSourceConnector(id: number, data: Partial<InsertPartnerSourceConnector>) {
  const db = await getDb();
  if (!db) return;
  await db.update(partnerSourceConnectors).set(data as any).where(eq(partnerSourceConnectors.id, id));
}

export async function createPartnerSourceAttestation(data: InsertPartnerSourceAttestation) {
  const db = await getDb();
  if (!db) return;
  const result = await db.insert(partnerSourceAttestations).values(data);
  return result[0].insertId;
}

export async function createCarePackage(data: InsertCarePackage) {
  const db = await getDb();
  if (!db) return;
  const result = await db.insert(carePackages).values(data);
  return result[0].insertId;
}

export async function listCarePackages(filter?: CareCaseFilter & { packageType?: string }) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (filter?.caseType) conditions.push(eq(carePackages.caseType, filter.caseType as any));
  if (filter?.caseId) conditions.push(eq(carePackages.caseId, filter.caseId));
  if (filter?.status) conditions.push(eq(carePackages.status, filter.status as any));
  if (filter?.packageType) conditions.push(eq(carePackages.packageType, filter.packageType as any));
  if (conditions.length > 0) {
    return db.select().from(carePackages).where(and(...conditions)).orderBy(desc(carePackages.createdAt)).limit(100);
  }
  return db.select().from(carePackages).orderBy(desc(carePackages.createdAt)).limit(100);
}

export async function getCarePackageById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(carePackages).where(eq(carePackages.id, id)).limit(1);
  return result[0];
}

export async function updateCarePackage(id: number, data: Partial<InsertCarePackage>) {
  const db = await getDb();
  if (!db) return;
  await db.update(carePackages).set(data as any).where(eq(carePackages.id, id));
}

export async function createCarePackageItem(data: InsertCarePackageItem) {
  const db = await getDb();
  if (!db) return;
  const result = await db.insert(carePackageItems).values(data);
  return result[0].insertId;
}

export async function listCarePackageItems(carePackageId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(carePackageItems).where(eq(carePackageItems.carePackageId, carePackageId)).orderBy(desc(carePackageItems.createdAt));
}

export async function createCaseDecision(data: InsertCaseDecision) {
  const db = await getDb();
  if (!db) return;
  const result = await db.insert(caseDecisions).values(data);
  return result[0].insertId;
}

export async function listCaseDecisions(filter: { caseType: string; caseId: number }) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(caseDecisions)
    .where(and(eq(caseDecisions.caseType, filter.caseType as any), eq(caseDecisions.caseId, filter.caseId)))
    .orderBy(desc(caseDecisions.decidedAt));
}

export async function getCareTransitionStats() {
  const db = await getDb();
  if (!db) {
    return {
      documents: 0,
      pendingDocuments: 0,
      activeTasks: 0,
      activeConnectors: 0,
      packages: 0,
    };
  }
  const [documentCount] = await db.select({ count: count() }).from(caseDocuments);
  const [pendingDocumentCount] = await db.select({ count: count() }).from(caseDocuments).where(eq(caseDocuments.verificationStatus, "needs_review" as any));
  const [activeTaskCount] = await db.select({ count: count() }).from(caseTasks).where(or(eq(caseTasks.status, "ready" as any), eq(caseTasks.status, "in_progress" as any), eq(caseTasks.status, "blocked" as any)));
  const [activeConnectorCount] = await db.select({ count: count() }).from(partnerSourceConnectors).where(eq(partnerSourceConnectors.status, "active" as any));
  const [packageCount] = await db.select({ count: count() }).from(carePackages);
  return {
    documents: documentCount.count,
    pendingDocuments: pendingDocumentCount.count,
    activeTasks: activeTaskCount.count,
    activeConnectors: activeConnectorCount.count,
    packages: packageCount.count,
  };
}

// ============================================================
// ENHANCED DASHBOARD STATS (v2.0)
// ============================================================
export async function getExecutiveDashboardStats() {
  const db = await getDb();
  if (!db) return { hospitals: 0, credentials: 0, patients: 0, referrals: 0, claims: 0, internationalCases: 0, adapters: 0, shlLinks: 0 };

  const [hospitalCount] = await db.select({ count: count() }).from(hospitals);
  const [credentialCount] = await db.select({ count: count() }).from(issuedCredentials);
  const [patientCount] = await db.select({ count: count() }).from(users).where(eq(users.systemRole, "patient"));
  const [referralCount] = await db.select({ count: count() }).from(referrals);
  const [claimCount] = await db.select({ count: count() }).from(claimCases);
  const [intlCount] = await db.select({ count: count() }).from(internationalCases);
  const [adapterCount] = await db.select({ count: count() }).from(integrationAdapters);
  const [shlCount] = await db.select({ count: count() }).from(smartHealthLinks);

  return {
    hospitals: hospitalCount.count,
    credentials: credentialCount.count,
    patients: patientCount.count,
    referrals: referralCount.count,
    claims: claimCount.count,
    internationalCases: intlCount.count,
    adapters: adapterCount.count,
    shlLinks: shlCount.count,
  };
}

// ============================================================
// USER ROLES (Multi-Role Support)
// ============================================================
export async function assignUserRole(data: InsertUserRole) {
  const db = await getDb();
  if (!db) return;
  const [user] = await db.select().from(users).where(eq(users.id, data.userId)).limit(1);
  if (user && isPatientRole((user as any).systemRole) && isIssuerPrivilegeRole(data.role)) {
    throw new Error("Patient users cannot be assigned Maker/Checker issuer roles.");
  }
  await db.insert(userRoles).values(data);
}

export async function removeUserRole(userId: number, role: string) {
  const db = await getDb();
  if (!db) return;
  await db.delete(userRoles).where(and(eq(userRoles.userId, userId), eq(userRoles.role, role)));
}

export async function getUserAdditionalRoles(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(userRoles).where(and(eq(userRoles.userId, userId), eq(userRoles.isActive, true)));
}

// ============================================================
// NOTIFICATION HELPERS (Maker/Checker)
// ============================================================
export async function markAllNotificationsRead(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(notifications).set({ isRead: true }).where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
}

export async function getUnreadNotificationCount(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const [result] = await db.select({ count: sql<number>`count(*)` }).from(notifications).where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  return result?.count ?? 0;
}

// ============================================================
// GET CHECKERS FOR NOTIFICATION
// ============================================================
export async function getCheckerUserIds(hospitalId?: number | null): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  // Find users who have 'checker' role in user_roles table
  const checkerRoles = await db.select({ userId: userRoles.userId }).from(userRoles).where(and(eq(userRoles.role, "checker"), eq(userRoles.isActive, true)));
  const checkerIds = checkerRoles.map(r => r.userId);
  // Also include system_admin and hospital_admin users as they can act as checkers
  const conditions = [];
  if (hospitalId) {
    conditions.push(sql`(${users.systemRole} IN ('system_admin', 'hospital_admin') AND (${users.hospitalId} = ${hospitalId} OR ${users.hospitalId} IS NULL))`);
  } else {
    conditions.push(sql`${users.systemRole} IN ('system_admin', 'hospital_admin')`);
  }
  const admins = await db.select({ id: users.id }).from(users).where(sql`${users.systemRole} IN ('system_admin', 'hospital_admin')`);
  const adminIds = admins.map(a => a.id);
  return Array.from(new Set([...checkerIds, ...adminIds]));
}

// ============================================================
// CREDENTIAL REQUESTS (Maker/Checker Workflow v2.2)
// ============================================================
export async function listCredentialRequests(filters?: { makerId?: number; hospitalId?: number; status?: string; checkerId?: number }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters?.makerId) conditions.push(eq(credentialRequests.makerId, filters.makerId));
  if (filters?.hospitalId) conditions.push(eq(credentialRequests.hospitalId, filters.hospitalId));
  if (filters?.status) conditions.push(eq(credentialRequests.status, filters.status as any));
  if (filters?.checkerId) conditions.push(eq(credentialRequests.checkerId, filters.checkerId));
  return db.select().from(credentialRequests).where(conditions.length ? and(...conditions) : undefined).orderBy(sql`${credentialRequests.createdAt} DESC`);
}

export async function createCredentialRequest(data: InsertCredentialRequest) {
  const db = await getDb();
  if (!db) return;
  const [result] = await db.insert(credentialRequests).values(data).$returningId();
  return result;
}

export async function updateCredentialRequest(id: number, data: Partial<InsertCredentialRequest>) {
  const db = await getDb();
  if (!db) return;
  await db.update(credentialRequests).set(data).where(eq(credentialRequests.id, id));
}

export async function getCredentialRequestById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.select().from(credentialRequests).where(eq(credentialRequests.id, id));
  return result ?? null;
}

// ============================================================
// DEMO USERS
// ============================================================
export async function getDemoUsers() {
  const db = await getDb();
  if (!db) return [];
  const demoUsersList = await db.select().from(users).where(sql`${users.loginMethod} = 'demo'`).orderBy(users.id);
  // Enrich with additional roles from user_roles table
  const enriched = await Promise.all(demoUsersList.map(async (u) => {
    const roles = await db.select().from(userRoles).where(and(eq(userRoles.userId, u.id), eq(userRoles.isActive, true)));
    return {
      ...u,
      additionalRoles: roles.map(r => r.role),
    };
  }));
  return enriched;
}

// ============================================================
// VC SCHEMA REGISTRY
// ============================================================

export async function registerSchema(data: InsertVcSchemaRegistry) {
  const database = await getDb();
  if (!database) return null;
  // Deactivate previous active versions of same type
  await database.update(vcSchemaRegistry)
    .set({ isActive: false })
    .where(and(
      eq(vcSchemaRegistry.credentialType, data.credentialType),
      eq(vcSchemaRegistry.isActive, true),
    ));
  const [result] = await database.insert(vcSchemaRegistry).values(data).$returningId();
  return result;
}

export async function getActiveSchema(credentialType: string) {
  const database = await getDb();
  if (!database) return null;
  const [schema] = await database.select().from(vcSchemaRegistry)
    .where(and(
      eq(vcSchemaRegistry.credentialType, credentialType),
      eq(vcSchemaRegistry.isActive, true),
    ))
    .limit(1);
  return schema || null;
}

export async function getSchemaByVersion(credentialType: string, version: string) {
  const database = await getDb();
  if (!database) return null;
  const [schema] = await database.select().from(vcSchemaRegistry)
    .where(and(
      eq(vcSchemaRegistry.credentialType, credentialType),
      eq(vcSchemaRegistry.version, version),
    ))
    .limit(1);
  return schema || null;
}

export async function listSchemaVersions(credentialType?: string) {
  const database = await getDb();
  if (!database) return [];
  const conditions = credentialType
    ? [eq(vcSchemaRegistry.credentialType, credentialType)]
    : [];
  return database.select().from(vcSchemaRegistry)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(vcSchemaRegistry.createdAt));
}

export async function validateCredentialAgainstSchema(credentialType: string, schemaVersion: string, credentialData: unknown): Promise<{ valid: boolean; errors: string[] }> {
  const schema = await getSchemaByVersion(credentialType, schemaVersion);
  if (!schema) {
    return { valid: false, errors: [`Schema not found: ${credentialType}@${schemaVersion}`] };
  }
  // Basic JSON Schema validation (structural check)
  const jsonSchema = schema.jsonSchema as any;
  const errors: string[] = [];
  if (jsonSchema && jsonSchema.required && Array.isArray(jsonSchema.required)) {
    for (const field of jsonSchema.required) {
      if (!(credentialData as any)?.[field]) {
        errors.push(`Missing required field: ${field}`);
      }
    }
  }
  return { valid: errors.length === 0, errors };
}


// ============================================================
// CONSENT EXPIRY REMINDER
// ============================================================
/**
 * Find consent records expiring within the next N days that are still active (granted).
 * Used by the scheduled consent expiry reminder to notify patients.
 */
export async function findConsentsExpiringWithinDays(days: number) {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  return db.select().from(consentRecords)
    .where(and(
      eq(consentRecords.status, "granted"),
      gte(consentRecords.expiresAt, now),
      lte(consentRecords.expiresAt, futureDate),
    ))
    .orderBy(consentRecords.expiresAt);
}


// ============================================================
// CLAIM ANALYTICS
// ============================================================
export async function getClaimAnalytics() {
  const db = await getDb();
  if (!db) return { totalClaims: 0, statusBreakdown: [], typeBreakdown: [], rejectionReasons: [], avgProcessingDays: 0, monthlyTrend: [] };

  // Total claims and status breakdown
  const allClaims = await db.select().from(claimCases).orderBy(desc(claimCases.createdAt));

  const statusBreakdown: Record<string, number> = {};
  const typeBreakdown: Record<string, number> = {};
  const rejectionReasons: Record<string, number> = {};
  let totalProcessingMs = 0;
  let processedCount = 0;
  const monthlyMap: Record<string, { submitted: number; accepted: number; rejected: number; paid: number }> = {};

  for (const claim of allClaims) {
    // Status breakdown
    statusBreakdown[claim.status] = (statusBreakdown[claim.status] || 0) + 1;
    // Type breakdown
    typeBreakdown[claim.claimType] = (typeBreakdown[claim.claimType] || 0) + 1;
    // Rejection reasons
    if (claim.status === "rejected" && claim.rejectionReason) {
      rejectionReasons[claim.rejectionReason] = (rejectionReasons[claim.rejectionReason] || 0) + 1;
    }
    // Processing time (submitted -> responded)
    if (claim.submittedAt && claim.respondedAt) {
      totalProcessingMs += new Date(claim.respondedAt).getTime() - new Date(claim.submittedAt).getTime();
      processedCount++;
    }
    // Monthly trend
    const month = new Date(claim.createdAt).toISOString().slice(0, 7); // YYYY-MM
    if (!monthlyMap[month]) monthlyMap[month] = { submitted: 0, accepted: 0, rejected: 0, paid: 0 };
    if (claim.status === "submitted" || claim.submittedAt) monthlyMap[month].submitted++;
    if (claim.status === "accepted") monthlyMap[month].accepted++;
    if (claim.status === "rejected") monthlyMap[month].rejected++;
    if (claim.status === "paid") monthlyMap[month].paid++;
  }

  const avgProcessingDays = processedCount > 0 ? Math.round(totalProcessingMs / processedCount / 86400000 * 10) / 10 : 0;
  const totalClaims = allClaims.length;
  const approvalRate = totalClaims > 0
    ? Math.round(((statusBreakdown["accepted"] || 0) + (statusBreakdown["paid"] || 0)) / totalClaims * 100)
    : 0;

  return {
    totalClaims,
    approvalRate,
    avgProcessingDays,
    statusBreakdown: Object.entries(statusBreakdown).map(([status, count]) => ({ status, count })),
    typeBreakdown: Object.entries(typeBreakdown).map(([type, count]) => ({ type, count })),
    rejectionReasons: Object.entries(rejectionReasons)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    monthlyTrend: Object.entries(monthlyMap)
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12),
  };
}

// ============================================================
// DOCUMENT BUNDLES
// ============================================================
export async function createDocumentBundle(data: {
  caseType: string;
  caseId: number;
  title: string;
  description?: string;
  bundleType?: string;
  submittedBy?: number;
}) {
  const db = await getDb();
  if (!db) return { id: 0 };
  const [result] = await db.insert(documentBundles).values({
    caseType: data.caseType as any,
    caseId: data.caseId,
    title: data.title,
    description: data.description || null,
    bundleType: (data.bundleType || "mixed") as any,
    status: "draft",
    submittedBy: data.submittedBy || null,
    fileCount: 0,
    totalSizeBytes: 0,
  });
  return { id: result.insertId };
}

export async function getBundlesByCaseId(caseType: string, caseId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(documentBundles)
    .where(and(
      eq(documentBundles.caseType, caseType as any),
      eq(documentBundles.caseId, caseId)
    ))
    .orderBy(desc(documentBundles.createdAt));
}

export async function getBundleWithFiles(bundleId: number) {
  const db = await getDb();
  if (!db) return null;
  const [bundle] = await db.select().from(documentBundles)
    .where(eq(documentBundles.id, bundleId));
  if (!bundle) return null;
  const files = await db.select().from(caseDocuments)
    .where(eq(caseDocuments.bundleId, bundleId))
    .orderBy(caseDocuments.sortOrder);
  return { ...bundle, files };
}

export async function addFileToBundle(bundleId: number, fileData: {
  caseType: string;
  caseId: number;
  direction?: string;
  documentType: string;
  title: string;
  fileName?: string;
  fileUrl?: string;
  fileKey?: string;
  mimeType?: string;
  fileSize?: number;
  hash?: string;
  sortOrder?: number;
  receivedBy?: number;
  metadata?: any;
}) {
  const db = await getDb();
  if (!db) return { id: 0 };
  const [result] = await db.insert(caseDocuments).values({
    bundleId,
    caseType: fileData.caseType as any,
    caseId: fileData.caseId,
    direction: (fileData.direction || "inbound") as any,
    documentType: fileData.documentType as any,
    title: fileData.title,
    fileName: fileData.fileName || null,
    fileUrl: fileData.fileUrl || null,
    fileKey: fileData.fileKey || null,
    mimeType: fileData.mimeType || "application/pdf",
    fileSize: fileData.fileSize ? BigInt(fileData.fileSize) as any : null,
    sortOrder: fileData.sortOrder || 0,
    hash: fileData.hash || null,
    receivedBy: fileData.receivedBy || null,
    verificationStatus: "received",
    metadata: fileData.metadata || null,
  });
  // Update bundle counts
  await db.execute(sql`UPDATE document_bundles SET fileCount = fileCount + 1, totalSizeBytes = totalSizeBytes + ${fileData.fileSize || 0} WHERE id = ${bundleId}`);
  return { id: result.insertId };
}

export async function updateBundleStatus(bundleId: number, status: string, userId?: number) {
  const db = await getDb();
  if (!db) return;
  const updateData: any = { status };
  if (status === "submitted") {
    updateData.submittedBy = userId;
  } else if (["accepted", "rejected"].includes(status)) {
    updateData.reviewedBy = userId;
    updateData.reviewedAt = new Date();
  }
  await db.update(documentBundles)
    .set(updateData)
    .where(eq(documentBundles.id, bundleId));
}

export async function removeBundleFile(fileId: number, bundleId: number) {
  const db = await getDb();
  if (!db) return false;
  const [file] = await db.select().from(caseDocuments)
    .where(and(eq(caseDocuments.id, fileId), eq(caseDocuments.bundleId, bundleId)));
  if (!file) return false;
  await db.delete(caseDocuments).where(eq(caseDocuments.id, fileId));
  const fileSize = (file as any).fileSize || 0;
  await db.execute(sql`UPDATE document_bundles SET fileCount = GREATEST(fileCount - 1, 0), totalSizeBytes = GREATEST(totalSizeBytes - ${fileSize}, 0) WHERE id = ${bundleId}`);
  return true;
}

export async function updateDocumentBundleHash(bundleId: number, integrityHash: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(documentBundles)
    .set({ integrityHash })
    .where(eq(documentBundles.id, bundleId));
}


// ============================================================
// Wallet Document Request - Extended Helpers (for webhook import flow)
// ============================================================

export async function getWalletDocumentRequestByRequestId(requestId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select()
    .from(walletDocumentRequests)
    .where(eq(walletDocumentRequests.requestId, requestId))
    .limit(1);
  return result[0];
}

export async function updateWalletDocumentRequestStatus(
  id: number,
  status: "draft" | "pending_consent" | "requested" | "imported" | "needs_review" | "converted_to_vc" | "rejected" | "cancelled",
  metadata?: Record<string, any>
) {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(walletDocumentRequests).where(eq(walletDocumentRequests.id, id)).limit(1);
  if (!existing[0]) return;
  const existingMeta = (existing[0].metadata as Record<string, any>) || {};
  await db.update(walletDocumentRequests)
    .set({
      status,
      metadata: metadata ? { ...existingMeta, ...metadata } : existingMeta,
    })
    .where(eq(walletDocumentRequests.id, id));
}

// ============================================================
// Service Verification - VP Packet verification at service point
// ============================================================

export async function recordServiceVerification(data: {
  presentationId: string;
  patientId: number;
  verifiedBy?: number;
  verifierRole?: string;
  context?: string;
  score?: number;
  credentialCount?: number;
  trustLevel?: string;
  verified?: boolean;
  serviceName?: string;
  hospitalId?: number;
}) {
  const db = await getDb();
  if (!db) return;
  await createAuditEvent({
    actorId: data.verifiedBy,
    actorRole: data.verifierRole,
    action: "service_point.vp_verified",
    resourceType: "verifiable_presentation",
    resourceId: data.presentationId,
    details: {
      patientId: data.patientId,
      context: data.context,
      score: data.score,
      credentialCount: data.credentialCount,
      trustLevel: data.trustLevel,
      verified: data.verified,
      serviceName: data.serviceName,
      hospitalId: data.hospitalId,
    },
  });
}
