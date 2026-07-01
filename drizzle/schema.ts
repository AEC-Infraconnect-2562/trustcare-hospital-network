import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, boolean } from "drizzle-orm/mysql-core";

// ============================================================
// USER & AUTH
// ============================================================
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  systemRole: mysqlEnum("systemRole", ["system_admin", "hospital_admin", "doctor", "nurse", "integration_engineer", "patient"]).default("patient").notNull(),
  hospitalId: int("hospitalId"),
  departmentId: int("departmentId"),
  thaiId: varchar("thaiId", { length: 13 }),
  phone: varchar("phone", { length: 20 }),
  avatarUrl: text("avatarUrl"),
  preferredLanguage: mysqlEnum("preferredLanguage", ["th", "en"]).default("th").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ============================================================
// HOSPITAL NETWORK
// ============================================================
export const hospitals = mysqlTable("hospitals", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  nameEn: varchar("nameEn", { length: 255 }),
  code: varchar("code", { length: 20 }).notNull().unique(),
  did: varchar("did", { length: 512 }),
  address: text("address"),
  province: varchar("province", { length: 100 }),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 320 }),
  logoUrl: text("logoUrl"),
  issuerEndpoint: text("issuerEndpoint"),
  verifierEndpoint: text("verifierEndpoint"),
  fhirEndpoint: text("fhirEndpoint"),
  status: mysqlEnum("status", ["active", "inactive", "pending"]).default("pending").notNull(),
  settings: json("settings"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Hospital = typeof hospitals.$inferSelect;
export type InsertHospital = typeof hospitals.$inferInsert;

export const departments = mysqlTable("departments", {
  id: int("id").autoincrement().primaryKey(),
  hospitalId: int("hospitalId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  nameEn: varchar("nameEn", { length: 255 }),
  code: varchar("code", { length: 50 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Department = typeof departments.$inferSelect;
export type InsertDepartment = typeof departments.$inferInsert;

// ============================================================
// VERIFIABLE CREDENTIALS
// ============================================================
export const credentialTemplates = mysqlTable("credential_templates", {
  id: int("id").autoincrement().primaryKey(),
  hospitalId: int("hospitalId"),
  name: varchar("name", { length: 255 }).notNull(),
  nameEn: varchar("nameEn", { length: 255 }),
  type: mysqlEnum("type", ["patient_identity", "consent_receipt", "patient_summary", "allergy_alert", "medication_summary", "referral_vc", "immunization"]).notNull(),
  version: varchar("version", { length: 20 }).default("1.0").notNull(),
  schema: json("schema"),
  fhirResourceType: varchar("fhirResourceType", { length: 100 }),
  validityDays: int("validityDays").default(365),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CredentialTemplate = typeof credentialTemplates.$inferSelect;
export type InsertCredentialTemplate = typeof credentialTemplates.$inferInsert;

export const issuedCredentials = mysqlTable("issued_credentials", {
  id: int("id").autoincrement().primaryKey(),
  credentialId: varchar("credentialId", { length: 255 }).notNull().unique(),
  templateId: int("templateId").notNull(),
  issuerId: int("issuerId").notNull(),
  issuerHospitalId: int("issuerHospitalId").notNull(),
  subjectId: int("subjectId").notNull(),
  type: mysqlEnum("type", ["patient_identity", "consent_receipt", "patient_summary", "allergy_alert", "medication_summary", "referral_vc", "immunization"]).notNull(),
  status: mysqlEnum("status", ["active", "revoked", "expired", "suspended"]).default("active").notNull(),
  credentialData: json("credentialData"),
  sdJwtVc: text("sdJwtVc"),
  issuedAt: timestamp("issuedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"),
  revokedAt: timestamp("revokedAt"),
  revocationReason: text("revocationReason"),
  fhirResourceId: varchar("fhirResourceId", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type IssuedCredential = typeof issuedCredentials.$inferSelect;
export type InsertIssuedCredential = typeof issuedCredentials.$inferInsert;

// ============================================================
// PATIENT WALLET
// ============================================================
export const walletCards = mysqlTable("wallet_cards", {
  id: int("id").autoincrement().primaryKey(),
  patientId: int("patientId").notNull(),
  credentialId: int("credentialId").notNull(),
  cardType: mysqlEnum("cardType", ["allergy", "medication", "patient_summary", "consent", "identity", "immunization", "referral"]).notNull(),
  displayName: varchar("displayName", { length: 255 }).notNull(),
  displayNameEn: varchar("displayNameEn", { length: 255 }),
  issuerHospitalName: varchar("issuerHospitalName", { length: 255 }),
  cardColor: varchar("cardColor", { length: 7 }).default("#2563eb"),
  isPinned: boolean("isPinned").default(false).notNull(),
  lastPresentedAt: timestamp("lastPresentedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WalletCard = typeof walletCards.$inferSelect;
export type InsertWalletCard = typeof walletCards.$inferInsert;

export const presentationHistory = mysqlTable("presentation_history", {
  id: int("id").autoincrement().primaryKey(),
  patientId: int("patientId").notNull(),
  credentialId: int("credentialId").notNull(),
  verifierName: varchar("verifierName", { length: 255 }),
  verifierHospitalId: int("verifierHospitalId"),
  purpose: varchar("purpose", { length: 255 }),
  disclosedFields: json("disclosedFields"),
  presentedAt: timestamp("presentedAt").defaultNow().notNull(),
  verificationResult: mysqlEnum("verificationResult", ["valid", "invalid", "expired"]),
});

export type PresentationHistory = typeof presentationHistory.$inferSelect;

// ============================================================
// CONSENT MANAGEMENT
// ============================================================
export const consentPolicies = mysqlTable("consent_policies", {
  id: int("id").autoincrement().primaryKey(),
  hospitalId: int("hospitalId"),
  name: varchar("name", { length: 255 }).notNull(),
  nameEn: varchar("nameEn", { length: 255 }),
  description: text("description"),
  purpose: mysqlEnum("purpose", ["treatment", "referral", "research", "insurance", "public_health", "emergency"]).notNull(),
  dataCategories: json("dataCategories"),
  retentionDays: int("retentionDays").default(365),
  isRequired: boolean("isRequired").default(false).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  version: varchar("version", { length: 20 }).default("1.0").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ConsentPolicy = typeof consentPolicies.$inferSelect;
export type InsertConsentPolicy = typeof consentPolicies.$inferInsert;

export const consentRecords = mysqlTable("consent_records", {
  id: int("id").autoincrement().primaryKey(),
  patientId: int("patientId").notNull(),
  policyId: int("policyId").notNull(),
  grantedToHospitalId: int("grantedToHospitalId"),
  grantedToDoctorId: int("grantedToDoctorId"),
  status: mysqlEnum("status", ["granted", "revoked", "expired"]).default("granted").notNull(),
  purpose: mysqlEnum("purpose", ["treatment", "referral", "research", "insurance", "public_health", "emergency"]).notNull(),
  dataScope: json("dataScope"),
  grantedAt: timestamp("grantedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"),
  revokedAt: timestamp("revokedAt"),
  revocationReason: text("revocationReason"),
  consentMethod: mysqlEnum("consentMethod", ["digital", "paper", "verbal_emergency"]).default("digital").notNull(),
  vcCredentialId: varchar("vcCredentialId", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ConsentRecord = typeof consentRecords.$inferSelect;
export type InsertConsentRecord = typeof consentRecords.$inferInsert;

// ============================================================
// REFERRAL MANAGEMENT
// ============================================================
export const referrals = mysqlTable("referrals", {
  id: int("id").autoincrement().primaryKey(),
  referralCode: varchar("referralCode", { length: 50 }).notNull().unique(),
  patientId: int("patientId").notNull(),
  fromHospitalId: int("fromHospitalId").notNull(),
  toHospitalId: int("toHospitalId").notNull(),
  fromDoctorId: int("fromDoctorId").notNull(),
  toDoctorId: int("toDoctorId"),
  status: mysqlEnum("status", ["requested", "accepted", "in_progress", "completed", "replied", "rejected"]).default("requested").notNull(),
  priority: mysqlEnum("priority", ["routine", "urgent", "emergency"]).default("routine").notNull(),
  reason: text("reason"),
  clinicalNotes: text("clinicalNotes"),
  diagnosis: varchar("diagnosis", { length: 500 }),
  icdCode: varchar("icdCode", { length: 20 }),
  attachedCredentialIds: json("attachedCredentialIds"),
  shlPayload: text("shlPayload"),
  responseNotes: text("responseNotes"),
  acceptedAt: timestamp("acceptedAt"),
  completedAt: timestamp("completedAt"),
  rejectedAt: timestamp("rejectedAt"),
  rejectionReason: text("rejectionReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Referral = typeof referrals.$inferSelect;
export type InsertReferral = typeof referrals.$inferInsert;

// ============================================================
// FHIR MAPPING
// ============================================================
export const fhirFieldMappings = mysqlTable("fhir_field_mappings", {
  id: int("id").autoincrement().primaryKey(),
  hospitalId: int("hospitalId").notNull(),
  localFieldName: varchar("localFieldName", { length: 255 }).notNull(),
  localFieldPath: varchar("localFieldPath", { length: 500 }),
  fhirResourceType: varchar("fhirResourceType", { length: 100 }).notNull(),
  fhirFieldPath: varchar("fhirFieldPath", { length: 500 }).notNull(),
  transformRule: text("transformRule"),
  isActive: boolean("isActive").default(true).notNull(),
  validationStatus: mysqlEnum("validationStatus", ["valid", "invalid", "pending"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FhirFieldMapping = typeof fhirFieldMappings.$inferSelect;
export type InsertFhirFieldMapping = typeof fhirFieldMappings.$inferInsert;

export const terminologyMappings = mysqlTable("terminology_mappings", {
  id: int("id").autoincrement().primaryKey(),
  hospitalId: int("hospitalId").notNull(),
  localCode: varchar("localCode", { length: 100 }).notNull(),
  localDisplay: varchar("localDisplay", { length: 500 }),
  codeSystem: mysqlEnum("codeSystem", ["icd10", "snomed_ct", "loinc", "tmt", "cvx"]).notNull(),
  standardCode: varchar("standardCode", { length: 100 }),
  standardDisplay: varchar("standardDisplay", { length: 500 }),
  confidence: int("confidence"),
  mappingSource: mysqlEnum("mappingSource", ["manual", "llm_suggested", "verified"]).default("manual").notNull(),
  status: mysqlEnum("status", ["pending", "accepted", "rejected"]).default("pending").notNull(),
  reviewedBy: int("reviewedBy"),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TerminologyMapping = typeof terminologyMappings.$inferSelect;
export type InsertTerminologyMapping = typeof terminologyMappings.$inferInsert;

// ============================================================
// AUDIT & NOTIFICATIONS
// ============================================================
export const auditEvents = mysqlTable("audit_events", {
  id: int("id").autoincrement().primaryKey(),
  actorId: int("actorId"),
  actorRole: varchar("actorRole", { length: 50 }),
  hospitalId: int("hospitalId"),
  action: varchar("action", { length: 100 }).notNull(),
  resourceType: varchar("resourceType", { length: 100 }),
  resourceId: varchar("resourceId", { length: 255 }),
  details: json("details"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  isBreakGlass: boolean("isBreakGlass").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditEvent = typeof auditEvents.$inferSelect;
export type InsertAuditEvent = typeof auditEvents.$inferInsert;

export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  hospitalId: int("hospitalId"),
  type: mysqlEnum("type", ["hospital_onboarded", "vc_revoked", "break_glass", "data_quality", "referral_update", "consent_request", "system"]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message"),
  isRead: boolean("isRead").default(false).notNull(),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;
