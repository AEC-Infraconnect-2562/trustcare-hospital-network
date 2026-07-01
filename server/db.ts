import { eq, desc, and, sql, like, or, count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  hospitals, InsertHospital,
  departments, InsertDepartment,
  credentialTemplates, InsertCredentialTemplate,
  issuedCredentials, InsertIssuedCredential,
  walletCards, InsertWalletCard,
  presentationHistory,
  consentPolicies, InsertConsentPolicy,
  consentRecords, InsertConsentRecord,
  referrals, InsertReferral,
  fhirFieldMappings, InsertFhirFieldMapping,
  terminologyMappings, InsertTerminologyMapping,
  auditEvents, InsertAuditEvent,
  notifications, InsertNotification,
} from "../drizzle/schema";
import { ENV } from './_core/env';

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
export async function listIssuedCredentials(filters?: { hospitalId?: number; subjectId?: number; type?: string; status?: string }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters?.hospitalId) conditions.push(eq(issuedCredentials.issuerHospitalId, filters.hospitalId));
  if (filters?.subjectId) conditions.push(eq(issuedCredentials.subjectId, filters.subjectId));
  if (filters?.type) conditions.push(eq(issuedCredentials.type, filters.type as any));
  if (filters?.status) conditions.push(eq(issuedCredentials.status, filters.status as any));
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
  if (!db) return { hospitals: 0, credentials: 0, patients: 0, referrals: 0 };

  const [hospitalCount] = await db.select({ count: count() }).from(hospitals);
  const [credentialCount] = await db.select({ count: count() }).from(issuedCredentials);
  const [patientCount] = await db.select({ count: count() }).from(users).where(eq(users.systemRole, "patient"));
  const [referralCount] = await db.select({ count: count() }).from(referrals);

  return {
    hospitals: hospitalCount.count,
    credentials: credentialCount.count,
    patients: patientCount.count,
    referrals: referralCount.count,
  };
}
