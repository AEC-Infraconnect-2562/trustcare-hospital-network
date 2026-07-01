import { int, mediumtext, mysqlEnum, mysqlTable, text, timestamp, varchar, json, boolean } from "drizzle-orm/mysql-core";

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
  systemRole: mysqlEnum("systemRole", ["system_admin", "hospital_admin", "maker", "checker", "doctor", "nurse", "integration_engineer", "patient"]).default("patient").notNull(),
  hospitalId: int("hospitalId"),
  departmentId: int("departmentId"),
  thaiId: varchar("thaiId", { length: 13 }),
  phone: varchar("phone", { length: 20 }),
  avatarUrl: text("avatarUrl"),
  credentialEntitlements: json("credentialEntitlements"),
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
  type: mysqlEnum("type", ["patient_identity", "consent_receipt", "patient_summary", "allergy_alert", "medication_summary", "referral_vc", "immunization", "medical_certificate", "prescription", "lab_result", "diagnostic_report", "discharge_summary", "insurance_eligibility", "claim_package", "claim_receipt", "travel_document_verification", "shl_manifest", "pharmacy_dispense", "appointment", "visa_support_letter", "quotation", "guarantee_letter", "mpi_link_certificate", "sync_receipt"]).notNull(),
  version: varchar("version", { length: 20 }).default("1.0").notNull(),
  schema: json("schema"),
  fhirResourceType: varchar("fhirResourceType", { length: 100 }),
  documentCategory: varchar("documentCategory", { length: 64 }),
  documentSubcategory: varchar("documentSubcategory", { length: 64 }),
  defaultStoragePath: varchar("defaultStoragePath", { length: 500 }),
  validityDays: int("validityDays").default(365),
  schemaVersion: varchar("schemaVersion", { length: 20 }).default("1.0.0").notNull(),
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
  type: mysqlEnum("type", ["patient_identity", "consent_receipt", "patient_summary", "allergy_alert", "medication_summary", "referral_vc", "immunization", "medical_certificate", "prescription", "lab_result", "diagnostic_report", "discharge_summary", "insurance_eligibility", "claim_package", "claim_receipt", "travel_document_verification", "shl_manifest", "pharmacy_dispense", "appointment", "visa_support_letter", "quotation", "guarantee_letter", "mpi_link_certificate", "sync_receipt"]).notNull(),
  status: mysqlEnum("status", ["active", "revoked", "expired", "suspended"]).default("active").notNull(),
  credentialData: json("credentialData"),
  sdJwtVc: mediumtext("sdJwtVc"),
  documentCategory: varchar("documentCategory", { length: 64 }),
  documentSubcategory: varchar("documentSubcategory", { length: 64 }),
  storageKey: varchar("storageKey", { length: 500 }),
  searchTags: json("searchTags"),
  issuedAt: timestamp("issuedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"),
  revokedAt: timestamp("revokedAt"),
  revocationReason: text("revocationReason"),
  fhirResourceId: varchar("fhirResourceId", { length: 255 }),
  schemaVersion: varchar("schemaVersion", { length: 20 }).default("1.0.0").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type IssuedCredential = typeof issuedCredentials.$inferSelect;
export type InsertIssuedCredential = typeof issuedCredentials.$inferInsert;

export const credentialIssuanceRequests = mysqlTable("credential_issuance_requests", {
  id: int("id").autoincrement().primaryKey(),
  requestId: varchar("requestId", { length: 255 }).notNull().unique(),
  templateId: int("templateId"),
  issuerHospitalId: int("issuerHospitalId").notNull(),
  subjectId: int("subjectId").notNull(),
  type: mysqlEnum("type", ["patient_identity", "consent_receipt", "patient_summary", "allergy_alert", "medication_summary", "referral_vc", "immunization", "medical_certificate", "prescription", "lab_result", "diagnostic_report", "discharge_summary", "insurance_eligibility", "claim_package", "claim_receipt", "travel_document_verification", "shl_manifest", "pharmacy_dispense", "appointment", "visa_support_letter", "quotation", "guarantee_letter", "mpi_link_certificate", "sync_receipt"]).notNull(),
  status: mysqlEnum("status", ["draft", "submitted", "changes_requested", "approved", "rejected", "issued", "cancelled"]).default("submitted").notNull(),
  makerId: int("makerId").notNull(),
  checkerId: int("checkerId"),
  makerRole: varchar("makerRole", { length: 64 }),
  checkerRole: varchar("checkerRole", { length: 64 }),
  holderDid: varchar("holderDid", { length: 512 }),
  issuerDid: varchar("issuerDid", { length: 512 }),
  documentData: json("documentData"),
  canonicalReview: json("canonicalReview"),
  checkerNotes: text("checkerNotes"),
  issuedCredentialId: varchar("issuedCredentialId", { length: 255 }),
  issuedCredentialRowId: int("issuedCredentialRowId"),
  submittedAt: timestamp("submittedAt").defaultNow().notNull(),
  checkedAt: timestamp("checkedAt"),
  issuedAt: timestamp("issuedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CredentialIssuanceRequest = typeof credentialIssuanceRequests.$inferSelect;
export type InsertCredentialIssuanceRequest = typeof credentialIssuanceRequests.$inferInsert;

// ============================================================
// PATIENT WALLET
// ============================================================
export const walletCards = mysqlTable("wallet_cards", {
  id: int("id").autoincrement().primaryKey(),
  patientId: int("patientId").notNull(),
  credentialId: int("credentialId").notNull(),
  cardType: mysqlEnum("cardType", ["allergy", "medication", "patient_summary", "consent", "identity", "immunization", "referral", "medical_certificate", "prescription", "lab_result", "diagnostic_report", "discharge_summary", "coverage", "claim", "travel_document", "shl_manifest", "pharmacy_dispense", "appointment", "visa_support_letter", "quotation", "guarantee_letter", "mpi_link_certificate", "sync_receipt"]).notNull(),
  displayName: varchar("displayName", { length: 255 }).notNull(),
  displayNameEn: varchar("displayNameEn", { length: 255 }),
  issuerHospitalName: varchar("issuerHospitalName", { length: 255 }),
  documentCategory: varchar("documentCategory", { length: 64 }),
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

export const issuedPresentations = mysqlTable("issued_presentations", {
  id: int("id").autoincrement().primaryKey(),
  presentationId: varchar("presentationId", { length: 255 }).notNull().unique(),
  patientId: int("patientId").notNull(),
  holderDid: varchar("holderDid", { length: 512 }).notNull(),
  context: varchar("context", { length: 64 }).notNull(),
  purpose: varchar("purpose", { length: 64 }).notNull(),
  audience: text("audience"),
  presentationJwt: mediumtext("presentationJwt").notNull(),
  credentialIds: json("credentialIds"),
  credentialRowIds: json("credentialRowIds"),
  verifier: varchar("verifier", { length: 255 }),
  status: mysqlEnum("status", ["active", "expired", "revoked"]).default("active").notNull(),
  expiresAt: timestamp("expiresAt"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type IssuedPresentation = typeof issuedPresentations.$inferSelect;
export type InsertIssuedPresentation = typeof issuedPresentations.$inferInsert;

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

export const vcVpSeedBatches = mysqlTable("vc_vp_seed_batches", {
  id: int("id").autoincrement().primaryKey(),
  batchId: varchar("batchId", { length: 255 }).notNull().unique(),
  sourceKit: varchar("sourceKit", { length: 255 }).notNull(),
  inputHash: varchar("inputHash", { length: 128 }).notNull(),
  patientsPerHospital: int("patientsPerHospital").notNull(),
  generatedCredentialCount: int("generatedCredentialCount").default(0).notNull(),
  generatedPresentationCount: int("generatedPresentationCount").default(0).notNull(),
  status: mysqlEnum("status", ["running", "completed", "failed"]).default("running").notNull(),
  startedBy: int("startedBy"),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
  summary: json("summary"),
});

export type VcVpSeedBatch = typeof vcVpSeedBatches.$inferSelect;
export type InsertVcVpSeedBatch = typeof vcVpSeedBatches.$inferInsert;

export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  hospitalId: int("hospitalId"),
  type: mysqlEnum("type", ["hospital_onboarded", "vc_revoked", "break_glass", "data_quality", "referral_update", "consent_request", "system", "vc_request_created", "vc_submitted_for_review", "vc_approved", "vc_rejected", "vc_issued"]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message"),
  isRead: boolean("isRead").default(false).notNull(),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// ============================================================
// USER ADDITIONAL ROLES (Multi-Role Support)
// ============================================================
export const userRoles = mysqlTable("user_roles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  role: varchar("role", { length: 64 }).notNull(),
  scope: varchar("scope", { length: 255 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type UserRole = typeof userRoles.$inferSelect;
export type InsertUserRole = typeof userRoles.$inferInsert;

// ============================================================
// CREDENTIAL REQUESTS (Maker/Checker Workflow v2.2)
// ============================================================
export const credentialRequests = mysqlTable("credential_requests", {
  id: int("id").autoincrement().primaryKey(),
  requesterId: int("requesterId").notNull(),
  templateId: int("templateId"),
  patientId: int("patientId").notNull(),
  hospitalId: int("hospitalId").notNull(),
  credentialType: varchar("credentialType", { length: 128 }).notNull(),
  status: mysqlEnum("status", ["draft", "pending_review", "approved", "rejected", "issued", "cancelled"]).default("draft").notNull(),
  requestData: json("requestData"),
  reviewerId: int("reviewerId"),
  reviewComment: text("reviewComment"),
  issuedCredentialId: int("issuedCredentialId"),
  priority: mysqlEnum("priority", ["normal", "urgent"]).default("normal").notNull(),
  makerNotes: text("makerNotes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CredentialRequest = typeof credentialRequests.$inferSelect;
export type InsertCredentialRequest = typeof credentialRequests.$inferInsert;

// ============================================================
// PATIENT IDENTITY LINKS (MPI)
// ============================================================
export const patientIdentifiers = mysqlTable("patient_identifiers", {
  id: int("id").autoincrement().primaryKey(),
  patientId: int("patientId").notNull(),
  hospitalId: int("hospitalId"),
  identifierType: mysqlEnum("identifierType", ["thai_id", "passport", "health_id", "hn", "mrn", "carepass_id", "insurance_id"]).notNull(),
  identifierValue: varchar("identifierValue", { length: 255 }).notNull(),
  issuerOrg: varchar("issuerOrg", { length: 255 }),
  verifiedAt: timestamp("verifiedAt"),
  verificationMethod: varchar("verificationMethod", { length: 100 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PatientIdentifier = typeof patientIdentifiers.$inferSelect;
export type InsertPatientIdentifier = typeof patientIdentifiers.$inferInsert;

export const mpiMatches = mysqlTable("mpi_matches", {
  id: int("id").autoincrement().primaryKey(),
  patientIdA: int("patientIdA").notNull(),
  patientIdB: int("patientIdB").notNull(),
  matchScore: int("matchScore"),
  matchStatus: mysqlEnum("matchStatus", ["confirmed", "pending_review", "rejected", "auto_linked"]).default("pending_review").notNull(),
  matchedFields: json("matchedFields"),
  reviewedBy: int("reviewedBy"),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MpiMatch = typeof mpiMatches.$inferSelect;

// ============================================================
// INTEGRATION & ADAPTER LAYER
// ============================================================
export const integrationAdapters = mysqlTable("integration_adapters", {
  id: int("id").autoincrement().primaryKey(),
  hospitalId: int("hospitalId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  systemType: mysqlEnum("systemType", ["his", "emr", "lis", "ris", "pacs", "erp", "crm", "claim_system", "legacy_db"]).notNull(),
  connectorPattern: mysqlEnum("connectorPattern", ["api_rest", "api_graphql", "hl7v2", "db_view", "cdc", "batch_file", "dicomweb", "portal_adapter"]).notNull(),
  connectionConfig: json("connectionConfig"),
  authMethod: mysqlEnum("authMethod", ["oauth2", "api_key", "mtls", "basic", "vpn", "none"]).default("api_key").notNull(),
  status: mysqlEnum("status", ["active", "inactive", "testing", "error"]).default("testing").notNull(),
  lastHealthCheck: timestamp("lastHealthCheck"),
  healthStatus: mysqlEnum("healthStatus", ["healthy", "degraded", "down", "unknown"]).default("unknown").notNull(),
  mappingVersionId: int("mappingVersionId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type IntegrationAdapter = typeof integrationAdapters.$inferSelect;
export type InsertIntegrationAdapter = typeof integrationAdapters.$inferInsert;

export const adapterHealthLogs = mysqlTable("adapter_health_logs", {
  id: int("id").autoincrement().primaryKey(),
  adapterId: int("adapterId").notNull(),
  status: mysqlEnum("status", ["healthy", "degraded", "down"]).notNull(),
  responseTimeMs: int("responseTimeMs"),
  errorMessage: text("errorMessage"),
  checkedAt: timestamp("checkedAt").defaultNow().notNull(),
});

export const mappingVersions = mysqlTable("mapping_versions", {
  id: int("id").autoincrement().primaryKey(),
  adapterId: int("adapterId").notNull(),
  resourceType: varchar("resourceType", { length: 100 }).notNull(),
  version: varchar("version", { length: 100 }).notNull(),
  mappingConfig: json("mappingConfig"),
  status: mysqlEnum("status", ["draft", "testing", "published", "deprecated"]).default("draft").notNull(),
  approvedBy: int("approvedBy"),
  approvedAt: timestamp("approvedAt"),
  publishedAt: timestamp("publishedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MappingVersion = typeof mappingVersions.$inferSelect;
export type InsertMappingVersion = typeof mappingVersions.$inferInsert;

export const integrationEventLogs = mysqlTable("integration_event_logs", {
  id: int("id").autoincrement().primaryKey(),
  adapterId: int("adapterId").notNull(),
  eventType: varchar("eventType", { length: 100 }).notNull(),
  direction: mysqlEnum("direction", ["inbound", "outbound"]).notNull(),
  resourceType: varchar("resourceType", { length: 100 }),
  resourceId: varchar("resourceId", { length: 255 }),
  status: mysqlEnum("status", ["success", "error", "pending", "retrying"]).default("pending").notNull(),
  payload: json("payload"),
  errorDetails: text("errorDetails"),
  correlationId: varchar("correlationId", { length: 255 }),
  processedAt: timestamp("processedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type IntegrationEventLog = typeof integrationEventLogs.$inferSelect;

export const credentialStatusEvents = mysqlTable("credential_status_events", {
  id: int("id").autoincrement().primaryKey(),
  credentialId: varchar("credentialId", { length: 255 }).notNull(),
  statusListIndex: varchar("statusListIndex", { length: 64 }),
  statusPurpose: mysqlEnum("statusPurpose", ["revocation", "suspension"]).default("revocation").notNull(),
  status: mysqlEnum("status", ["active", "revoked", "suspended"]).default("active").notNull(),
  reason: text("reason"),
  actorId: int("actorId"),
  eventHash: varchar("eventHash", { length: 128 }).notNull(),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CredentialStatusEvent = typeof credentialStatusEvents.$inferSelect;
export type InsertCredentialStatusEvent = typeof credentialStatusEvents.$inferInsert;

export const syncReconciliationJobs = mysqlTable("sync_reconciliation_jobs", {
  id: int("id").autoincrement().primaryKey(),
  jobId: varchar("jobId", { length: 255 }).notNull().unique(),
  planId: varchar("planId", { length: 255 }).notNull(),
  executionId: varchar("executionId", { length: 255 }).notNull(),
  targetId: varchar("targetId", { length: 255 }).notNull(),
  targetKind: varchar("targetKind", { length: 50 }).notNull(),
  status: mysqlEnum("status", ["not_required", "scheduled", "manual_review", "running", "passed", "failed", "cancelled"]).default("scheduled").notNull(),
  runMode: mysqlEnum("runMode", ["read_back", "ack_replay", "manual_review"]).notNull(),
  reason: text("reason"),
  checks: json("checks"),
  attempts: int("attempts").default(0).notNull(),
  dueAt: timestamp("dueAt"),
  completedAt: timestamp("completedAt"),
  result: json("result"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SyncReconciliationJobRow = typeof syncReconciliationJobs.$inferSelect;
export type InsertSyncReconciliationJob = typeof syncReconciliationJobs.$inferInsert;

// ============================================================
// TRUST REGISTRY
// ============================================================
export const trustRegistry = mysqlTable("trust_registry", {
  id: int("id").autoincrement().primaryKey(),
  entityType: mysqlEnum("entityType", ["issuer", "verifier", "provider", "payer", "partner_hospital", "foreign_hospital"]).notNull(),
  entityName: varchar("entityName", { length: 255 }).notNull(),
  entityNameEn: varchar("entityNameEn", { length: 255 }),
  did: varchar("did", { length: 512 }),
  publicKeyJwk: json("publicKeyJwk"),
  x509Certificate: text("x509Certificate"),
  country: varchar("country", { length: 3 }),
  jurisdiction: varchar("jurisdiction", { length: 100 }),
  trustLevel: mysqlEnum("trustLevel", ["verified", "self_declared", "pending", "revoked"]).default("pending").notNull(),
  credentialTypes: json("credentialTypes"),
  contactEmail: varchar("contactEmail", { length: 320 }),
  contactUrl: text("contactUrl"),
  verifiedAt: timestamp("verifiedAt"),
  verifiedBy: int("verifiedBy"),
  isActive: boolean("isActive").default(true).notNull(),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TrustRegistryEntry = typeof trustRegistry.$inferSelect;
export type InsertTrustRegistryEntry = typeof trustRegistry.$inferInsert;

// ============================================================
// SMART HEALTH LINKS (SHL)
// ============================================================
export const smartHealthLinks = mysqlTable("smart_health_links", {
  id: int("id").autoincrement().primaryKey(),
  patientId: int("patientId").notNull(),
  issuedBy: int("issuedBy").notNull(),
  hospitalId: int("hospitalId").notNull(),
  purpose: mysqlEnum("purpose", ["referral", "patient_summary", "discharge", "cross_border", "medical_tourist", "insurance", "self_share"]).notNull(),
  context: varchar("context", { length: 64 }),
  label: varchar("label", { length: 80 }),
  scope: json("scope"),
  manifestHash: varchar("manifestHash", { length: 255 }),
  manifestToken: varchar("manifestToken", { length: 128 }),
  manifestUrl: text("manifestUrl"),
  encryptionKey: text("encryptionKey"),
  shlUrl: text("shlUrl"),
  qrPayload: text("qrPayload"),
  viewerUrl: text("viewerUrl"),
  status: mysqlEnum("status", ["pending_review", "active", "expired", "revoked", "disabled", "max_accessed"]).default("active").notNull(),
  maxAccessCount: int("maxAccessCount"),
  currentAccessCount: int("currentAccessCount").default(0).notNull(),
  passcodeRequired: boolean("passcodeRequired").default(true).notNull(),
  passcodeSalt: varchar("passcodeSalt", { length: 128 }),
  passcodeHash: varchar("passcodeHash", { length: 255 }),
  passcodeFailedAttempts: int("passcodeFailedAttempts").default(0).notNull(),
  passcodeMaxAttempts: int("passcodeMaxAttempts").default(5).notNull(),
  longTerm: boolean("longTerm").default(false).notNull(),
  singleFile: boolean("singleFile").default(false).notNull(),
  recipientPolicy: json("recipientPolicy"),
  consentCredentialId: varchar("consentCredentialId", { length: 255 }),
  manifestCredentialId: varchar("manifestCredentialId", { length: 255 }),
  presentationId: varchar("presentationId", { length: 255 }),
  sourceBundleHash: varchar("sourceBundleHash", { length: 255 }),
  policyDecision: json("policyDecision"),
  currentManifestVersion: int("currentManifestVersion").default(1).notNull(),
  contextHash: varchar("contextHash", { length: 128 }),
  autoUpdatePolicy: varchar("autoUpdatePolicy", { length: 32 }).default("manual_review"),
  lastAccessedAt: timestamp("lastAccessedAt"),
  disabledReason: text("disabledReason"),
  expiresAt: timestamp("expiresAt"),
  revokedAt: timestamp("revokedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SmartHealthLink = typeof smartHealthLinks.$inferSelect;
export type InsertSmartHealthLink = typeof smartHealthLinks.$inferInsert;

export const shlFiles = mysqlTable("shl_files", {
  id: int("id").autoincrement().primaryKey(),
  shlId: int("shlId").notNull(),
  manifestVersion: int("manifestVersion").default(1).notNull(),
  fileId: varchar("fileId", { length: 128 }).notNull(),
  version: int("version").default(1).notNull(),
  contentType: mysqlEnum("contentType", ["application/fhir+json", "application/smart-health-card", "application/smart-api-access"]).notNull(),
  embeddedJwe: mediumtext("embeddedJwe"),
  location: text("location"),
  contentHash: varchar("contentHash", { length: 128 }).notNull(),
  plaintextHash: varchar("plaintextHash", { length: 128 }),
  encryptedSizeBytes: int("encryptedSizeBytes"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ShlFile = typeof shlFiles.$inferSelect;
export type InsertShlFile = typeof shlFiles.$inferInsert;

export const shlManifestVersions = mysqlTable("shl_manifest_versions", {
  id: int("id").autoincrement().primaryKey(),
  shlId: int("shlId").notNull(),
  manifestVersion: int("manifestVersion").default(1).notNull(),
  contextHash: varchar("contextHash", { length: 128 }).notNull(),
  scopeHash: varchar("scopeHash", { length: 128 }),
  sourceBundleHash: varchar("sourceBundleHash", { length: 255 }),
  manifestHash: varchar("manifestHash", { length: 255 }).notNull(),
  manifestCredentialId: varchar("manifestCredentialId", { length: 255 }),
  presentationId: varchar("presentationId", { length: 255 }),
  status: mysqlEnum("status", ["current", "superseded", "revoked"]).default("current").notNull(),
  changeReason: text("changeReason"),
  createdBy: int("createdBy"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ShlManifestVersion = typeof shlManifestVersions.$inferSelect;
export type InsertShlManifestVersion = typeof shlManifestVersions.$inferInsert;

export const shlAccessLogs = mysqlTable("shl_access_logs", {
  id: int("id").autoincrement().primaryKey(),
  shlId: int("shlId").notNull(),
  accessorName: varchar("accessorName", { length: 255 }),
  accessorOrg: varchar("accessorOrg", { length: 255 }),
  accessorCountry: varchar("accessorCountry", { length: 3 }),
  recipient: varchar("recipient", { length: 255 }),
  result: mysqlEnum("result", ["granted", "denied", "expired", "revoked", "bad_passcode", "max_accessed", "rate_limited"]).default("granted").notNull(),
  failureReason: text("failureReason"),
  userAgent: text("userAgent"),
  manifestRequestedAt: timestamp("manifestRequestedAt"),
  fileId: varchar("fileId", { length: 128 }),
  countryHint: varchar("countryHint", { length: 3 }),
  verifiedVpResult: json("verifiedVpResult"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  accessedAt: timestamp("accessedAt").defaultNow().notNull(),
});

// ============================================================
// E-CLAIM / PAYER ORCHESTRATION
// ============================================================
export const payerAdapters = mysqlTable("payer_adapters", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  payerType: mysqlEnum("payerType", ["nhso", "sso", "csmbs", "private_insurance", "corporate", "self_pay"]).notNull(),
  apiEndpoint: text("apiEndpoint"),
  authConfig: json("authConfig"),
  submissionFormat: mysqlEnum("submissionFormat", ["api", "portal", "batch_file", "email", "rpa"]).default("api").notNull(),
  validationRules: json("validationRules"),
  status: mysqlEnum("status", ["active", "inactive", "testing"]).default("testing").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PayerAdapter = typeof payerAdapters.$inferSelect;
export type InsertPayerAdapter = typeof payerAdapters.$inferInsert;

export const coverageEligibility = mysqlTable("coverage_eligibility", {
  id: int("id").autoincrement().primaryKey(),
  patientId: int("patientId").notNull(),
  payerAdapterId: int("payerAdapterId").notNull(),
  coverageType: varchar("coverageType", { length: 100 }),
  memberId: varchar("memberId", { length: 255 }),
  status: mysqlEnum("status", ["eligible", "ineligible", "pending", "expired"]).default("pending").notNull(),
  benefits: json("benefits"),
  limitations: json("limitations"),
  vcCredentialId: varchar("vcCredentialId", { length: 255 }),
  checkedAt: timestamp("checkedAt").defaultNow().notNull(),
  validUntil: timestamp("validUntil"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CoverageEligibilityRecord = typeof coverageEligibility.$inferSelect;
export type InsertCoverageEligibility = typeof coverageEligibility.$inferInsert;

export const claimCases = mysqlTable("claim_cases", {
  id: int("id").autoincrement().primaryKey(),
  patientId: int("patientId").notNull(),
  hospitalId: int("hospitalId").notNull(),
  payerAdapterId: int("payerAdapterId").notNull(),
  encounterRef: varchar("encounterRef", { length: 255 }),
  claimType: mysqlEnum("claimType", ["opd", "ipd", "dental", "pharmacy", "rehabilitation", "emergency"]).default("opd").notNull(),
  status: mysqlEnum("status", ["draft", "validating", "correction_required", "ready_to_submit", "submitted", "accepted", "rejected", "more_info_requested", "appeal", "paid", "closed"]).default("draft").notNull(),
  totalAmount: varchar("totalAmount", { length: 20 }),
  approvedAmount: varchar("approvedAmount", { length: 20 }),
  diagnosisCodes: json("diagnosisCodes"),
  procedureCodes: json("procedureCodes"),
  serviceItems: json("serviceItems"),
  validationIssues: json("validationIssues"),
  payerClaimId: varchar("payerClaimId", { length: 255 }),
  submittedAt: timestamp("submittedAt"),
  respondedAt: timestamp("respondedAt"),
  paidAt: timestamp("paidAt"),
  rejectionReason: text("rejectionReason"),
  resubmissionCount: int("resubmissionCount").default(0).notNull(),
  claimReceiptVcId: varchar("claimReceiptVcId", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ClaimCase = typeof claimCases.$inferSelect;
export type InsertClaimCase = typeof claimCases.$inferInsert;

// ============================================================
// MEDICAL TOURIST / INTERNATIONAL PATIENT
// ============================================================
export const internationalCases = mysqlTable("international_cases", {
  id: int("id").autoincrement().primaryKey(),
  patientId: int("patientId"),
  status: mysqlEnum("status", ["inquiry", "profile_created", "documents_uploaded", "identity_verified", "clinical_pre_review", "more_info_requested", "quotation_prepared", "insurance_review", "appointment_confirmed", "arrival_ready", "patient_arrived", "treatment_in_progress", "discharge_prepared", "follow_up_scheduled", "closed"]).default("inquiry").notNull(),
  country: varchar("country", { length: 3 }),
  language: mysqlEnum("language", ["en", "zh", "ja", "ar", "ru", "ko", "de", "fr", "other"]).default("en").notNull(),
  passportNumber: varchar("passportNumber", { length: 50 }),
  passportCountry: varchar("passportCountry", { length: 3 }),
  insuranceProvider: varchar("insuranceProvider", { length: 255 }),
  insurancePolicyNumber: varchar("insurancePolicyNumber", { length: 100 }),
  serviceLine: varchar("serviceLine", { length: 255 }),
  preferredBranchId: int("preferredBranchId"),
  assignedCoordinatorId: int("assignedCoordinatorId"),
  assignedInterpreterId: int("assignedInterpreterId"),
  contactEmail: varchar("contactEmail", { length: 320 }),
  contactPhone: varchar("contactPhone", { length: 50 }),
  contactMessenger: varchar("contactMessenger", { length: 255 }),
  clinicalNotes: text("clinicalNotes"),
  quotationAmount: varchar("quotationAmount", { length: 20 }),
  quotationCurrency: varchar("quotationCurrency", { length: 3 }).default("THB"),
  appointmentDate: timestamp("appointmentDate"),
  arrivalDate: timestamp("arrivalDate"),
  dischargeDate: timestamp("dischargeDate"),
  followUpDate: timestamp("followUpDate"),
  dischargePacketShlId: int("dischargePacketShlId"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type InternationalCase = typeof internationalCases.$inferSelect;
export type InsertInternationalCase = typeof internationalCases.$inferInsert;

export const travelDocuments = mysqlTable("travel_documents", {
  id: int("id").autoincrement().primaryKey(),
  caseId: int("caseId").notNull(),
  documentType: mysqlEnum("documentType", ["passport", "insurance_card", "referral_letter", "lab_report", "imaging_report", "medication_list", "medical_certificate", "visa_support_letter", "quotation", "guarantee_letter", "other"]).notNull(),
  fileName: varchar("fileName", { length: 255 }),
  fileUrl: text("fileUrl"),
  fileKey: varchar("fileKey", { length: 500 }),
  verificationStatus: mysqlEnum("verificationStatus", ["pending", "verified", "unverified", "rejected"]).default("pending").notNull(),
  verifiedBy: int("verifiedBy"),
  verifiedAt: timestamp("verifiedAt"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TravelDocument = typeof travelDocuments.$inferSelect;
export type InsertTravelDocument = typeof travelDocuments.$inferInsert;

// ============================================================
// CROSS-BORDER REFERRAL EXTENSIONS
// ============================================================
export const crossBorderReferrals = mysqlTable("cross_border_referrals", {
  id: int("id").autoincrement().primaryKey(),
  referralId: int("referralId"),
  referralType: mysqlEnum("referralType", ["cross_branch", "cross_border_outbound", "cross_border_inbound", "external_partner"]).notNull(),
  partnerOrgId: int("partnerOrgId"),
  partnerOrgName: varchar("partnerOrgName", { length: 255 }),
  partnerCountry: varchar("partnerCountry", { length: 3 }),
  language: mysqlEnum("language", ["th", "en", "zh", "ja", "other"]).default("en").notNull(),
  jurisdiction: varchar("jurisdiction", { length: 100 }),
  ipsShlId: int("ipsShlId"),
  referralVcId: varchar("referralVcId", { length: 255 }),
  consentId: int("consentId"),
  translationRequired: boolean("translationRequired").default(false).notNull(),
  translationStatus: mysqlEnum("translationStatus", ["not_needed", "pending", "completed"]).default("not_needed").notNull(),
  legalDisclaimer: text("legalDisclaimer"),
  expiresAt: timestamp("expiresAt"),
  status: mysqlEnum("status", ["draft", "consent_requested", "consent_granted", "packet_generated", "sent", "acknowledged", "accepted", "rejected", "completed", "counter_referral_received", "closed"]).default("draft").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CrossBorderReferral = typeof crossBorderReferrals.$inferSelect;
export type InsertCrossBorderReferral = typeof crossBorderReferrals.$inferInsert;

// ============================================================
// VC SCHEMA REGISTRY
// ============================================================
export const vcSchemaRegistry = mysqlTable("vc_schema_registry", {
  id: int("id").autoincrement().primaryKey(),
  credentialType: varchar("credentialType", { length: 100 }).notNull(),
  version: varchar("version", { length: 20 }).notNull(),
  jsonSchema: json("jsonSchema").notNull(),
  changelog: text("changelog"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type VcSchemaRegistry = typeof vcSchemaRegistry.$inferSelect;
export type InsertVcSchemaRegistry = typeof vcSchemaRegistry.$inferInsert;
