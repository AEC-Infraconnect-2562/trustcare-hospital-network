import { and, count, desc, eq, inArray, like, sql } from "drizzle-orm";
import {
  auditEvents,
  credentialTemplates,
  fhirFieldMappings,
  hospitals,
  integrationAdapters,
  issuedCredentials,
  issuedPresentations,
  mappingVersions,
  patientIdentifiers,
  shlFiles,
  shlManifestVersions,
  smartHealthLinks,
  trustRegistry,
  userRoles,
  users,
  vcVpSeedBatches,
  walletCards,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { buildMedicalCertificateFhir, buildPrescriptionMedicationRequests } from "./clinicalDocuments";
import { hospitalDidWeb, patientDidKey } from "./did";
import { canonicalizeHisPayload } from "./fhir";
import { DOCUMENT_TYPE_LABELS, documentStorageMetadata, standardLabelCatalog, THAI_GOVERNMENT_DOCUMENT_FONT_POLICY } from "./labels";
import { resolvePatientOpenId, DEMO_PATIENT_MAPPING } from "./seedData";
import { purposeForContext } from "./policy";
import { buildManifestResponse, buildShlinkPayload, encryptShlFile, generateNumericPasscode, hashPasscode, manifestFileDigest, randomBase64UrlBytes } from "./shl";
import { buildSimulatedHisPayload, scenarioForShlPurpose } from "./shlSimulator";
import { createSyncBackPlan, executeSyncBackPlan, RECOMMENDED_SYNC_TARGETS } from "./syncBack";
import type { ConsentPurpose, IssuedVc, IssuerProfile, JsonRecord, PortabilityContext, TrustcareCredentialType } from "./types";
import { consentReceiptClaims, createPresentation, issueCredential, medicalCertificateClaims, patientSummaryClaims, prescriptionClaims } from "./vc";
import { generateTrustcareDemoSeed, sourceTruthConnectors, TRUSTCARE_DEMO_HOSPITALS } from "./seedData";
import { sha256 } from "./utils";

const SEED_PREFIX = "urn:trustcare:seed";
const SEED_ISSUED_AT = new Date("2026-07-01T02:00:00.000Z");
const DEFAULT_AUDIENCE = "https://trustcare.network/verifier";

export async function reseedTrustcareVcVpDatabase(input: {
  actorId?: number;
  patientsPerHospital?: number;
  resetExistingSeed?: boolean;
} = {}): Promise<JsonRecord> {
  const db = await getDb();
  if (!db) {
    throw new Error("DATABASE_URL is required to reseed TrustCare VC/VP records.");
  }
  const patientsPerHospital = input.patientsPerHospital ?? 12;
  const seed = generateTrustcareDemoSeed({ patientsPerHospital });
  const inputHash = sha256({ patientsPerHospital, hospitals: seed.hospitals, documents: seed.documents, version: "vc-vp-db-reseed-v1" });
  const batchId = `${SEED_PREFIX}:batch:${patientsPerHospital}:${inputHash.slice(0, 16)}`;

  // SELECT-first pattern to avoid TiDB lock contention
  const [existingBatch] = await db.select().from(vcVpSeedBatches).where(eq(vcVpSeedBatches.batchId, batchId)).limit(1);
  if (existingBatch) {
    await db.update(vcVpSeedBatches).set({
      status: "running",
      inputHash,
      patientsPerHospital,
      startedBy: input.actorId,
      completedAt: null,
      summary: { counts: seed.counts, fontPolicy: THAI_GOVERNMENT_DOCUMENT_FONT_POLICY.primary },
    } as any).where(eq(vcVpSeedBatches.batchId, batchId));
  } else {
    await db.insert(vcVpSeedBatches).values({
      batchId,
      sourceKit: "trustcare-portable-vc-vp-seed-kit.zip",
      inputHash,
      patientsPerHospital,
      status: "running",
      startedBy: input.actorId,
      summary: { counts: seed.counts, fontPolicy: THAI_GOVERNMENT_DOCUMENT_FONT_POLICY.primary },
    } as any);
  }

  if (input.resetExistingSeed ?? true) {
    await db.update(issuedCredentials).set({
      status: "suspended",
      revocationReason: `Superseded by reseed batch ${batchId}`,
    } as any).where(like(issuedCredentials.credentialId, `${SEED_PREFIX}:vc:%`));
    await db.update(issuedPresentations).set({ status: "revoked" } as any)
      .where(like(issuedPresentations.presentationId, `${SEED_PREFIX}:vp:%`));
    await db.update(smartHealthLinks).set({
      status: "revoked",
      revokedAt: new Date(),
      disabledReason: `Superseded by reseed batch ${batchId}`,
    } as any).where(like(smartHealthLinks.manifestToken, `${SEED_PREFIX}:shl:%`));
  }

  const hospitalRows = new Map<string, number>();
  const issuerRows = new Map<string, number>();
  const patientRows = new Map<string, number>();
  const templateRows = new Map<string, number>();
  const credentialRows = new Map<string, { rowId: number; vc: IssuedVc; document: JsonRecord; patient: JsonRecord }>();

  for (const hospital of seed.hospitals as JsonRecord[]) {
    const hospitalId = await upsertHospital(hospital);
    hospitalRows.set(String(hospital.code), hospitalId);
    const issuerId = await upsertSeedUser({
      openId: `seed-issuer-${String(hospital.code).toLowerCase()}`,
      name: `${hospital.nameEn} Issuer`,
      email: `issuer.${String(hospital.code).toLowerCase()}@trustcare.example`,
      systemRole: "hospital_admin",
      role: "admin",
      hospitalId,
      credentialEntitlements: { makerTypes: ["*"], checkerTypes: ["*"] },
    });
    issuerRows.set(String(hospital.code), issuerId);
    await seedStaffForHospital(hospital, hospitalId);
    await upsertTrustRegistryIssuer(hospital, hospitalId);
    await upsertSourceTruthAdapters(hospital, hospitalId);
  }

    // Ensure network-level issuer is in trust registry
  await upsertNetworkLevelIssuer();
  for (const documentType of Object.keys(DOCUMENT_TYPE_LABELS)) {
    for (const hospital of seed.hospitals as JsonRecord[]) {
      const hospitalId = hospitalRows.get(String(hospital.code))!;
      const templateId = await upsertCredentialTemplate(hospitalId, documentType);
      templateRows.set(`${hospital.code}:${documentType}`, templateId);
    }
  }
  for (const patient of seed.patients as JsonRecord[]) {
    const hospitalId = hospitalRows.get(String(patient.hospitalCode))!;
    const patientId = await upsertPatient(patient, hospitalId);
    patientRows.set(patientKey(patient), patientId);
    await upsertPatientIdentifiers(patient, patientId, hospitalId);
  }
  for (const document of seed.documents as JsonRecord[]) {
    const patient = (seed.patients as JsonRecord[]).find((item) => item.seedId === document.patientSeedId && item.hospitalCode === document.hospitalCode);
    if (!patient) continue;
    const hospitalId = hospitalRows.get(String(document.hospitalCode))!;
    const issuerId = issuerRows.get(String(document.hospitalCode))!;
    const subjectId = patientRows.get(patientKey(patient))!;
    const templateId = templateRows.get(`${document.hospitalCode}:${document.credentialType}`)!;
    const issuer = issuerProfile(document, hospitalId);
    try {
      const vc = await issueSeedCredential({ document, patient, issuer, subjectId, audience: DEFAULT_AUDIENCE });
      const rowId = await upsertIssuedCredential({
        vc,
        document,
        patient,
        templateId,
        issuerId,
        hospitalId,
        subjectId,
        batchId,
      });
      await upsertWalletCard({
        patientId: subjectId,
        credentialRowId: rowId,
        document,
      });
      credentialRows.set(String(document.id), { rowId, vc, document, patient });
    } catch (err: any) {
    }
  }

  const presentations = [];
  for (const scenario of seed.vpScenarios as JsonRecord[]) {
    const patient = (seed.patients as JsonRecord[]).find((item) => item.holderDid === scenario.holderDid);
    if (!patient) continue;
    const selected = (scenario.credentialRefs as string[])
      .map((id) => credentialRows.get(id))
      .filter((item): item is { rowId: number; vc: IssuedVc; document: JsonRecord; patient: JsonRecord } => Boolean(item));
    if (selected.length === 0) continue;
    const presentationId = `${SEED_PREFIX}:vp:${scenario.id}:${String(patient.hospitalCode).toLowerCase()}:${String(patient.seedId).toLowerCase()}`;
    const presentation = await createPresentation({
      holderDid: String(scenario.holderDid),
      credentials: selected.map((item) => item.vc),
      purpose: purposeForContext(String(scenario.context) as PortabilityContext),
      audience: DEFAULT_AUDIENCE,
      validMinutes: 30 * 24 * 60,
      now: SEED_ISSUED_AT,
      presentationId,
      hospitalCode: String(patient.hospitalCode),
      context: String(scenario.context),
      documentTypes: selected.map((item) => String(item.document.credentialType)),
    });
    const patientId = patientRows.get(patientKey(patient))!;
    // SELECT-first to avoid TiDB lock contention
    const [existingPres] = await db.select().from(issuedPresentations).where(eq(issuedPresentations.presentationId, presentation.id)).limit(1);
    const presPayload = {
      patientId,
      holderDid: presentation.holderDid,
      context: String(scenario.context),
      purpose: presentation.purpose,
      audience: presentation.audience,
      presentationJwt: presentation.jwt,
      credentialIds: presentation.credentialIds,
      credentialRowIds: selected.map((item) => item.rowId),
      verifier: String(scenario.verifier ?? ""),
      status: "active",
      expiresAt: new Date(presentation.expiresAt),
      metadata: { scenario, batchId },
    } as any;
    if (existingPres) {
      await db.update(issuedPresentations).set(presPayload).where(eq(issuedPresentations.presentationId, presentation.id));
    } else {
      await db.insert(issuedPresentations).values({ presentationId: presentation.id, ...presPayload });
    }
    presentations.push({ id: presentation.id, holderDid: presentation.holderDid, credentialCount: selected.length, scenario: scenario.id });
  }

  // ─── Seed Staff Identity Credentials ──────────────────────────────────────
  await seedStaffIdentityCredentials({ hospitalRows, issuerRows, templateRows, batchId });

  const shlPackages = await seedSmartHealthLinkPackages({
    seed,
    batchId,
    patientRows,
    hospitalRows,
    issuerRows,
    templateRows,
    credentialRows,
  });

  await db.update(vcVpSeedBatches).set({
    status: "completed",
    completedAt: new Date(),
    generatedCredentialCount: credentialRows.size,
    generatedPresentationCount: presentations.length,
    summary: {
      counts: {
        hospitals: hospitalRows.size,
        patients: patientRows.size,
        credentials: credentialRows.size,
        presentations: presentations.length,
        smartHealthLinks: shlPackages.length,
      },
      batchId,
      standardLabels: standardLabelCatalog(),
      sourceTruthConnectors: sourceTruthConnectors(),
      fontPolicy: THAI_GOVERNMENT_DOCUMENT_FONT_POLICY,
    },
  } as any).where(eq(vcVpSeedBatches.batchId, batchId));

  await db.insert(auditEvents).values({
    actorId: input.actorId,
    actorRole: input.actorId ? "system_admin" : "system",
    action: "portability.seed.reseeded",
    resourceType: "vc_vp_seed_batch",
    resourceId: batchId,
    details: {
      patientsPerHospital,
      inputHash,
      credentials: credentialRows.size,
      presentations: presentations.length,
      smartHealthLinks: shlPackages.length,
      resetExistingSeed: input.resetExistingSeed ?? true,
    },
  } as any);

  return {
    batchId,
    inputHash,
    persisted: true,
    counts: {
      hospitals: hospitalRows.size,
      patients: patientRows.size,
      credentialTemplates: templateRows.size,
      credentials: credentialRows.size,
      walletCards: credentialRows.size,
      presentations: presentations.length,
      smartHealthLinks: shlPackages.length,
    },
    sample: {
      hospitalDid: hospitalDidWeb("TCC"),
      patientDid: patientDidKey("TCC:P001:CP-TH-2026-000001"),
      presentationId: presentations[0]?.id,
      smartHealthLinkId: shlPackages[0]?.id,
    },
  };
}

async function seedSmartHealthLinkPackages(input: {
  seed: JsonRecord;
  batchId: string;
  patientRows: Map<string, number>;
  hospitalRows: Map<string, number>;
  issuerRows: Map<string, number>;
  templateRows: Map<string, number>;
  credentialRows: Map<string, { rowId: number; vc: IssuedVc; document: JsonRecord; patient: JsonRecord }>;
}) {
  const db = (await getDb())!;
  const created: JsonRecord[] = [];
  for (const scenario of input.seed.vpScenarios as JsonRecord[]) {
    const patient = (input.seed.patients as JsonRecord[]).find((item) => item.holderDid === scenario.holderDid);
    if (!patient) continue;
    const hospital = (input.seed.hospitals as JsonRecord[]).find((item) => item.code === patient.hospitalCode);
    if (!hospital) continue;
    const selected = ((scenario.credentialRefs as string[]) ?? [])
      .map((id) => input.credentialRows.get(id))
      .filter((item): item is { rowId: number; vc: IssuedVc; document: JsonRecord; patient: JsonRecord } => Boolean(item));
    if (selected.length === 0) continue;

    const hospitalId = input.hospitalRows.get(String(patient.hospitalCode))!;
    const patientId = input.patientRows.get(patientKey(patient))!;
    const issuerId = input.issuerRows.get(String(patient.hospitalCode))!;
    const context = String(scenario.context) as PortabilityContext;
    const purpose = purposeForSeedContext(context);
    const simulatorPayload = buildSimulatedHisPayload({
      patient: { id: patientId, name: patient.nameTh ?? patient.nameEn, hn: patient.hn, birthDate: patient.birthDate, gender: patient.gender },
      hospital,
      purpose,
      context,
      credentials: selected.map((item) => ({ ...item.document, credentialId: item.vc.id, sdJwtVc: item.vc.jwt })),
      now: SEED_ISSUED_AT,
    });
    const canonical = canonicalizeHisPayload({
      sourceFormat: "db_view",
      payload: simulatorPayload,
      sourceSystem: `${patient.hospitalCode}-SHL-SIM`,
      sourceOrganizationId: String(patient.hcode ?? patient.hospitalCode),
      sourceOrganizationName: String(patient.hospitalNameEn ?? hospital.nameEn ?? hospital.name),
      mapperVersion: `trustcare-shl-seed-${scenarioForShlPurpose(purpose, context)}-v1`,
      receivedAt: SEED_ISSUED_AT.toISOString(),
    });
    const key = randomBase64UrlBytes(32);
    const passcode = generateNumericPasscode();
    const passcodeHash = hashPasscode(passcode);
    const manifestToken = `${SEED_PREFIX}:shl:${sha256({ batchId: input.batchId, scenario: scenario.id, patient: patient.seedId }).slice(0, 24)}`;
    const manifestUrl = `https://trustcare.network/api/shl/manifest/${encodeURIComponent(manifestToken)}`;
    const shlink = buildShlinkPayload({
      manifestUrl,
      key,
      expiresAt: new Date(SEED_ISSUED_AT.getTime() + 30 * 86_400_000),
      passcodeRequired: true,
      label: String(scenario.name ?? scenario.id),
      viewerBaseUrl: "https://trustcare.network/shl-viewer",
    });
    const encrypted = await encryptShlFile({
      key,
      contentType: "application/fhir+json",
      payload: canonical.bundle,
    });
    const files = [{
      fileId: `seed-fhir-${canonical.summary.bundleHash.slice(0, 16)}`,
      contentType: "application/fhir+json" as const,
      embeddedJwe: encrypted.jwe,
      contentHash: encrypted.contentHash,
      plaintextHash: encrypted.plaintextHash,
      version: 1,
    }];
    const manifestHash = manifestFileDigest(files);
    const contextHash = sha256({
      context,
      purpose,
      bundleHash: canonical.summary.bundleHash,
      manifestHash,
      credentialIds: selected.map((item) => item.vc.id),
    });
    const shlInsert = await db.insert(smartHealthLinks).values({
      patientId,
      issuedBy: issuerId,
      hospitalId,
      purpose: purpose as any,
      context,
      label: String(scenario.name ?? scenario.id),
      scope: selected.map((item) => item.document.credentialType),
      manifestHash,
      manifestToken,
      manifestUrl,
      encryptionKey: `sha256:${sha256(key)}`,
      shlUrl: shlink.qrPayload,
      qrPayload: shlink.qrPayload,
      viewerUrl: shlink.viewerUrl,
      status: "active",
      maxAccessCount: 10,
      passcodeRequired: true,
      passcodeSalt: passcodeHash.salt,
      passcodeHash: passcodeHash.hash,
      passcodeMaxAttempts: 5,
      recipientPolicy: { seedScenario: scenario.id, allowedRecipientTypes: recipientTypesForSeedPurpose(purpose) },
      sourceBundleHash: canonical.summary.bundleHash,
      policyDecision: { mode: "seed_realistic_simulator", context, purpose },
      currentManifestVersion: 1,
      contextHash,
      autoUpdatePolicy: "manual_review",
      expiresAt: new Date(SEED_ISSUED_AT.getTime() + 30 * 86_400_000),
    } as any);
    const shlId = shlInsert[0].insertId;
    await db.insert(shlFiles).values({
      shlId,
      manifestVersion: 1,
      fileId: files[0].fileId,
      version: 1,
      contentType: files[0].contentType,
      embeddedJwe: files[0].embeddedJwe,
      contentHash: files[0].contentHash,
      plaintextHash: files[0].plaintextHash,
      encryptedSizeBytes: encrypted.encryptedSizeBytes,
      metadata: { batchId: input.batchId, scenario: scenario.id, resourceCounts: canonical.summary.resourceCounts },
    } as any);

    const document: JsonRecord = {
      id: `seed-shl-doc-${String(scenario.id)}-${String(patient.seedId)}`,
      credentialType: "shl_manifest",
      hospitalCode: patient.hospitalCode,
      humanDocument: {
        brand: "TrustCare",
        templateId: "shl_manifest_seed_v1",
        renderData: { shlId, manifestHash, passcode, scenario: scenario.id },
      },
    };
    const manifestVc = await issueCredential({
      type: "ShlManifestCredential",
      issuer: issuerProfile({ ...document, issuerDid: hospitalDidWeb(String(hospital.code)) }, hospitalId),
      subjectId: String(patientId),
      subjectDid: String(patient.holderDid),
      claims: {
        smartHealthLinkId: shlId,
        manifestUrl,
        manifestHash,
        sourceBundleHash: canonical.summary.bundleHash,
        purpose,
        context,
        patient: { id: patientId, hn: patient.hn, name: patient.nameTh ?? patient.nameEn },
        hospital: { id: hospitalId, code: hospital.code, name: hospital.nameEn ?? hospital.name, did: hospitalDidWeb(String(hospital.code)) },
        transport: { scheme: "shlink", encrypted: true, passcodeRequired: true, contentTypes: ["application/fhir+json"] },
        canonicalSummary: canonical.summary,
      },
      evidence: [
        { type: "SHLManifestHash", digest: manifestHash, resourceId: manifestUrl },
        { type: "FHIRBundleHash", digest: canonical.summary.bundleHash },
        { type: "SeedScenario", digest: sha256(scenario), resourceId: String(scenario.id) },
      ],
      validDays: 365,
      audience: manifestUrl,
      credentialId: `${SEED_PREFIX}:vc:shl_manifest:${String(scenario.id)}:${String(patient.seedId).toLowerCase()}`,
      now: SEED_ISSUED_AT,
    });
    const templateId = input.templateRows.get(`${patient.hospitalCode}:shl_manifest`)!;
    const rowId = await upsertIssuedCredential({
      vc: manifestVc,
      document,
      patient,
      templateId,
      issuerId,
      hospitalId,
      subjectId: patientId,
      batchId: input.batchId,
    });
    await upsertWalletCard({ patientId, credentialRowId: rowId, document });
    const presentation = await createPresentation({
      holderDid: String(patient.holderDid),
      credentials: [manifestVc, ...selected.map((item) => item.vc)],
      purpose: purposeForContext(context),
      audience: manifestUrl,
      validMinutes: 30 * 24 * 60,
      now: SEED_ISSUED_AT,
      presentationId: `${SEED_PREFIX}:vp:shl:${String(scenario.id)}:${String(patient.seedId).toLowerCase()}`,
    });
    // SELECT-first to avoid TiDB lock contention
    const [existingShlPres] = await db.select().from(issuedPresentations).where(eq(issuedPresentations.presentationId, presentation.id)).limit(1);
    const shlPresPayload = {
      patientId,
      holderDid: presentation.holderDid,
      context,
      purpose: presentation.purpose,
      audience: presentation.audience,
      presentationJwt: presentation.jwt,
      credentialIds: presentation.credentialIds,
      credentialRowIds: [rowId, ...selected.map((item) => item.rowId)],
      verifier: "smart-health-link-viewer",
      status: "active",
      expiresAt: new Date(presentation.expiresAt),
      metadata: { batchId: input.batchId, shlId, scenario },
    } as any;
    if (existingShlPres) {
      await db.update(issuedPresentations).set(shlPresPayload).where(eq(issuedPresentations.presentationId, presentation.id));
    } else {
      await db.insert(issuedPresentations).values({ presentationId: presentation.id, ...shlPresPayload });
    }
    await db.update(smartHealthLinks).set({
      manifestCredentialId: manifestVc.id,
      presentationId: presentation.id,
    } as any).where(eq(smartHealthLinks.id, shlId));
    await db.insert(shlManifestVersions).values({
      shlId,
      manifestVersion: 1,
      contextHash,
      scopeHash: sha256(selected.map((item) => item.document.credentialType)),
      sourceBundleHash: canonical.summary.bundleHash,
      manifestHash,
      manifestCredentialId: manifestVc.id,
      presentationId: presentation.id,
      status: "current",
      createdBy: issuerId,
      metadata: { batchId: input.batchId, scenario: scenario.id, passcodeHint: "seed passcode is stored in humanDocument renderData for demos" },
    } as any);
    created.push({ id: shlId, scenario: scenario.id, patientId, manifestCredentialId: manifestVc.id, presentationId: presentation.id });
  }
  return created;
}

function purposeForSeedContext(context: PortabilityContext): string {
  if (context === "cross_branch_referral") return "referral";
  if (context === "cross_border") return "cross_border";
  if (context === "e_claim") return "insurance";
  if (context === "medical_tourist") return "medical_tourist";
  if (context === "self_share") return "self_share";
  return "patient_summary";
}

function recipientTypesForSeedPurpose(purpose: string): string[] {
  if (purpose === "insurance") return ["payer", "claim_processor"];
  if (purpose === "medical_tourist" || purpose === "cross_border") return ["foreign_hospital", "international_patient_center"];
  if (purpose === "referral") return ["receiving_hospital", "clinician"];
  if (purpose === "self_share") return ["patient_selected_recipient"];
  return ["clinician", "hospital"];
}

export async function auditTrustcareVcVpSeedDatabase(input: {
  patientsPerHospital?: number;
} = {}): Promise<JsonRecord> {
  const db = await getDb();
  if (!db) {
    throw new Error("DATABASE_URL is required to audit TrustCare VC/VP seed records.");
  }

  const latestBatch = await db.select().from(vcVpSeedBatches)
    .where(like(vcVpSeedBatches.batchId, `${SEED_PREFIX}:batch:%`))
    .orderBy(desc(vcVpSeedBatches.startedAt))
    .limit(1);
  const patientsPerHospital = input.patientsPerHospital ?? latestBatch[0]?.patientsPerHospital ?? 12;
  const expectedSeed = generateTrustcareDemoSeed({ patientsPerHospital });
  const expectedHospitalCodes = (expectedSeed.hospitals as JsonRecord[]).map((hospital) => String(hospital.code));
  const expectedConnectorNames = sourceTruthConnectors().map((connector) => String(connector.name));

  const hospitalRows = await db.select().from(hospitals).where(inArray(hospitals.code, expectedHospitalCodes));
  const seedPatientRows = await db.select().from(users).where(like(users.openId, "seed-patient-%"));
  const seedStaffRows = await db.select().from(users).where(sql`${users.openId} like 'seed-maker-%' or ${users.openId} like 'seed-checker-%' or ${users.openId} like 'seed-issuer-%'`);
  const sourceTruthRows = await db.select().from(integrationAdapters).where(inArray(integrationAdapters.name, expectedConnectorNames));
  const hospitalIds = hospitalRows.map((hospital) => hospital.id);
  const patientIds = seedPatientRows.map((patient) => patient.id);

  const [templateCount] = hospitalIds.length > 0
    ? await db.select({ value: count() }).from(credentialTemplates).where(inArray(credentialTemplates.hospitalId, hospitalIds))
    : [{ value: 0 }];
  const [credentialCount] = await db.select({ value: count() }).from(issuedCredentials)
    .where(and(like(issuedCredentials.credentialId, `${SEED_PREFIX}:vc:%`), eq(issuedCredentials.status, "active" as any)));
  const [walletCount] = await db.select({ value: count() }).from(walletCards)
    .innerJoin(issuedCredentials, eq(walletCards.credentialId, issuedCredentials.id))
    .where(and(like(issuedCredentials.credentialId, `${SEED_PREFIX}:vc:%`), eq(issuedCredentials.status, "active" as any)));
  const [presentationCount] = await db.select({ value: count() }).from(issuedPresentations)
    .where(and(like(issuedPresentations.presentationId, `${SEED_PREFIX}:vp:%`), eq(issuedPresentations.status, "active" as any)));
  const [identifierCount] = patientIds.length > 0
    ? await db.select({ value: count() }).from(patientIdentifiers).where(inArray(patientIdentifiers.patientId, patientIds))
    : [{ value: 0 }];
  const credentialTypes = await db.select({ type: issuedCredentials.type, value: count() }).from(issuedCredentials)
    .where(and(like(issuedCredentials.credentialId, `${SEED_PREFIX}:vc:%`), eq(issuedCredentials.status, "active" as any)))
    .groupBy(issuedCredentials.type);
  const patientIssuerRoleViolations = await db.select({
    userId: users.id,
    openId: users.openId,
    role: userRoles.role,
  }).from(userRoles)
    .innerJoin(users, eq(userRoles.userId, users.id))
    .where(and(
      eq(users.systemRole, "patient" as any),
      eq(userRoles.isActive, true),
      inArray(userRoles.role, ["issuer_maker", "issuer_checker"]),
    ));
  const patientEntitlementViolations = seedPatientRows
    .filter((patient) => hasIssuerEntitlements(patient.credentialEntitlements))
    .map((patient) => ({ id: patient.id, openId: patient.openId }));

  const checks = [
    checkCount("completed seed batch", 1, latestBatch[0]?.status === "completed" ? 1 : 0),
    checkCount("hospitals", Number((expectedSeed.counts as JsonRecord).hospitals), hospitalRows.length),
    checkCount("seed patients", Number((expectedSeed.counts as JsonRecord).patients), seedPatientRows.length),
    checkCount("credential templates", Object.keys(DOCUMENT_TYPE_LABELS).length * expectedHospitalCodes.length, Number(templateCount?.value ?? 0)),
    checkCount("active seed credentials", Number((expectedSeed.counts as JsonRecord).documents), Number(credentialCount?.value ?? 0)),
    checkCount("wallet cards for seed credentials", Number((expectedSeed.counts as JsonRecord).documents), Number(walletCount?.value ?? 0)),
    checkCount("active seed presentations", Number((expectedSeed.counts as JsonRecord).vpScenarios), Number(presentationCount?.value ?? 0)),
    checkCount("source of truth connectors", expectedConnectorNames.length, sourceTruthRows.length),
    checkCount("patient issuer-role violations", 0, patientIssuerRoleViolations.length),
    checkCount("patient entitlement violations", 0, patientEntitlementViolations.length),
  ];
  const didChecks = {
    hospitalDidWeb: hospitalRows.every((hospital) => String(hospital.did ?? "").startsWith("did:web:")),
    patientDidKeyIdentifiers: seedPatientRows.length === 0
      ? false
      : Number(identifierCount?.value ?? 0) >= seedPatientRows.length,
  };

  return {
    ok: checks.every((check) => check.ok) && didChecks.hospitalDidWeb && didChecks.patientDidKeyIdentifiers,
    checkedAt: new Date().toISOString(),
    latestBatch: latestBatch[0] ?? null,
    expected: expectedSeed.counts,
    actual: {
      hospitals: hospitalRows.length,
      seedPatients: seedPatientRows.length,
      seedStaff: seedStaffRows.length,
      credentialTemplates: Number(templateCount?.value ?? 0),
      activeSeedCredentials: Number(credentialCount?.value ?? 0),
      walletCardsForSeedCredentials: Number(walletCount?.value ?? 0),
      activeSeedPresentations: Number(presentationCount?.value ?? 0),
      patientIdentifiers: Number(identifierCount?.value ?? 0),
      sourceTruthConnectors: sourceTruthRows.length,
      credentialTypes: Object.fromEntries(credentialTypes.map((row) => [row.type, Number(row.value)])),
    },
    checks,
    didChecks,
    violations: {
      patientIssuerRoles: patientIssuerRoleViolations,
      patientCredentialEntitlements: patientEntitlementViolations,
      missingHospitalCodes: expectedHospitalCodes.filter((code) => !hospitalRows.some((hospital) => hospital.code === code)),
      missingSourceTruthConnectors: expectedConnectorNames.filter((name) => !sourceTruthRows.some((adapter) => adapter.name === name)),
    },
    remediation: checks.every((check) => check.ok)
      ? []
      : [
          "Run portability.reseedDb with { patientsPerHospital, resetExistingSeed: true } in the Manus workspace.",
          "Remove issuer_maker/issuer_checker rows for users whose systemRole is patient.",
          "Clear credentialEntitlements for users whose systemRole is patient.",
        ],
  };
}

async function upsertHospital(hospital: JsonRecord): Promise<number> {
  const db = (await getDb())!;
  // Use SELECT-first pattern to avoid TiDB lock contention
  const [existing] = await db.select().from(hospitals).where(eq(hospitals.code, String(hospital.code))).limit(1);
  if (existing) {
    await db.update(hospitals).set({
      name: String(hospital.nameTh),
      nameEn: String(hospital.nameEn),
      did: String(hospital.did),
      address: String(hospital.addressTh ?? ""),
      phone: String(hospital.phone ?? ""),
      status: "active",
      settings: {
        branding: hospital.branding,
        didDocument: hospital.didDocument,
        fontPolicy: THAI_GOVERNMENT_DOCUMENT_FONT_POLICY,
      },
    } as any).where(eq(hospitals.id, existing.id));
    return existing.id;
  }
  await db.insert(hospitals).values({
    name: String(hospital.nameTh),
    nameEn: String(hospital.nameEn),
    code: String(hospital.code),
    did: String(hospital.did),
    address: String(hospital.addressTh ?? ""),
    phone: String(hospital.phone ?? ""),
    email: `contact.${String(hospital.code).toLowerCase()}@trustcare.example`,
    logoUrl: `trustcare://${String(hospital.code).toLowerCase()}/brand/logo.svg`,
    issuerEndpoint: `https://trustcare.network/api/issuer/${String(hospital.code).toLowerCase()}`,
    verifierEndpoint: `https://trustcare.network/api/verifier/${String(hospital.code).toLowerCase()}`,
    fhirEndpoint: `https://trustcare.network/fhir/${String(hospital.code).toLowerCase()}`,
    status: "active",
    settings: {
      branding: hospital.branding,
      didDocument: hospital.didDocument,
      fontPolicy: THAI_GOVERNMENT_DOCUMENT_FONT_POLICY,
    },
  } as any);
  const [row] = await db.select().from(hospitals).where(eq(hospitals.code, String(hospital.code))).limit(1);
  return row.id;
}

async function upsertSeedUser(input: {
  openId: string;
  name: string;
  email: string;
  systemRole: "hospital_admin" | "maker" | "checker" | "patient";
  role?: "admin" | "user";
  hospitalId: number;
  phone?: string;
  thaiId?: string;
  preferredLanguage?: "th" | "en";
  credentialEntitlements?: JsonRecord;
}): Promise<number> {
  const db = (await getDb())!;
  // Use SELECT-first pattern to avoid TiDB ON DUPLICATE KEY UPDATE lock contention
  const [existing] = await db.select().from(users).where(eq(users.openId, input.openId)).limit(1);
  const payload = {
    name: input.name,
    email: input.email,
    loginMethod: "seed",
    role: input.role ?? "user",
    systemRole: input.systemRole,
    hospitalId: input.hospitalId,
    thaiId: input.thaiId,
    phone: input.phone,
    credentialEntitlements: input.credentialEntitlements,
    preferredLanguage: input.preferredLanguage ?? "th",
    isActive: true,
  } as any;
  if (existing) {
    await db.update(users).set(payload).where(eq(users.id, existing.id));
    return existing.id;
  }
  await db.insert(users).values({ openId: input.openId, ...payload });
  const [row] = await db.select().from(users).where(eq(users.openId, input.openId)).limit(1);
  return row.id;
}
async function seedStaffForHospital(hospital: JsonRecord, hospitalId: number): Promise<void> {
  const code = String(hospital.code).toLowerCase();
  await upsertSeedUser({
    openId: `seed-maker-nurse-${code}`,
    name: `${hospital.nameEn} Nurse Maker`,
    email: `maker.nurse.${code}@trustcare.example`,
    systemRole: "maker",
    hospitalId,
    credentialEntitlements: {
      makerTypes: ["prescription", "medical_certificate", "allergy_alert", "medication_summary", "shl_manifest"],
      checkerTypes: [],
    },
  });
  await upsertSeedUser({
    openId: `seed-maker-records-${code}`,
    name: `${hospital.nameEn} Medical Records Maker`,
    email: `maker.records.${code}@trustcare.example`,
    systemRole: "maker",
    hospitalId,
    credentialEntitlements: {
      makerTypes: ["patient_identity", "patient_summary", "consent_receipt", "mpi_link_certificate", "shl_manifest"],
      checkerTypes: [],
    },
  });
  await upsertSeedUser({
    openId: `seed-checker-clinical-${code}`,
    name: `${hospital.nameEn} Clinical Checker`,
    email: `checker.clinical.${code}@trustcare.example`,
    systemRole: "checker",
    hospitalId,
    credentialEntitlements: {
      makerTypes: [],
      checkerTypes: ["prescription", "medical_certificate", "allergy_alert", "medication_summary", "patient_summary", "shl_manifest"],
    },
  });
  await upsertSeedUser({
    openId: `seed-checker-records-${code}`,
    name: `${hospital.nameEn} Records Checker`,
    email: `checker.records.${code}@trustcare.example`,
    systemRole: "checker",
    hospitalId,
    credentialEntitlements: {
      makerTypes: [],
      checkerTypes: ["patient_identity", "consent_receipt", "mpi_link_certificate", "travel_document_verification", "insurance_eligibility", "shl_manifest"],
    },
  });
}

async function upsertPatient(patient: JsonRecord, hospitalId: number): Promise<number> {
  // Use Single Source of Truth: resolvePatientOpenId checks if this seed patient
  // maps to a demo patient (loginMethod='demo'). If so, reuse that user record.
  const openId = resolvePatientOpenId(String(patient.hospitalCode), String(patient.seedId));
  const demoMapping = DEMO_PATIENT_MAPPING.find(
    m => m.hospitalCode === String(patient.hospitalCode) && m.seedId === String(patient.seedId)
  );

  const db = (await getDb())!;
  // If this is a mapped demo patient, check if the demo user already exists
  if (demoMapping) {
    const [existing] = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
    if (existing) {
      // Update the existing demo user with seed-relevant fields (hospitalId, etc.)
      await db.update(users).set({
        hospitalId,
        preferredLanguage: String(patient.nationality) === "THA" ? "th" : "en",
        isActive: true,
      } as any).where(eq(users.id, existing.id));
      return existing.id;
    }
  }

  // Fallback: create/upsert a seed user (for non-mapped patients or if demo user doesn't exist yet)
  return upsertSeedUser({
    openId,
    name: demoMapping?.name || String(patient.nameTh || patient.nameEn),
    email: demoMapping?.email || `${String(patient.seedId).toLowerCase()}.${String(patient.hospitalCode).toLowerCase()}@patients.trustcare.example`,
    systemRole: "patient",
    hospitalId,
    phone: demoMapping?.phone || `08${String(10000000 + Number(sha256(patient.hn).slice(0, 6)) % 89999999).slice(0, 8)}`,
    thaiId: demoMapping?.thaiId,
    preferredLanguage: String(patient.nationality) === "THA" ? "th" : "en",
    credentialEntitlements: { makerTypes: [], checkerTypes: [] },
  });
}

async function upsertPatientIdentifiers(patient: JsonRecord, patientId: number, hospitalId: number): Promise<void> {
  const identifiers = [
    ["hn", patient.hn],
    ["mrn", patient.mrn],
    ["carepass_id", patient.carepassId],
    patient.passport ? ["passport", patient.passport] : undefined,
    ["health_id", patient.holderDid],
  ].filter(Boolean) as Array<[string, string]>;
  for (const [identifierType, identifierValue] of identifiers) {
    const db = (await getDb())!;
    const existing = await db.select().from(patientIdentifiers)
      .where(and(
        eq(patientIdentifiers.patientId, patientId),
        eq(patientIdentifiers.identifierType, identifierType as any),
        eq(patientIdentifiers.identifierValue, String(identifierValue))
      ))
      .limit(1);
    if (existing.length > 0) continue;
    await db.insert(patientIdentifiers).values({
      patientId,
      hospitalId,
      identifierType: identifierType as any,
      identifierValue: String(identifierValue),
      issuerOrg: String(patient.hospitalNameEn),
      verifiedAt: SEED_ISSUED_AT,
      verificationMethod: identifierType === "health_id" ? "did:key" : "seed-source-of-truth",
      isActive: true,
    } as any);
  }
}

async function upsertCredentialTemplate(hospitalId: number, documentType: string): Promise<number> {
  const db = (await getDb())!;
  const label = DOCUMENT_TYPE_LABELS[documentType] ?? { th: documentType, en: documentType, vcType: "PatientSummaryCredential" };
  const existing = await db.select().from(credentialTemplates)
    .where(and(eq(credentialTemplates.hospitalId, hospitalId), eq(credentialTemplates.type, documentType as any)))
    .limit(1);
  const schema = {
    vcType: label.vcType,
    documentType,
    brand: "TrustCare",
    label: "TrustCare Verified Health Document",
    fontPolicy: THAI_GOVERNMENT_DOCUMENT_FONT_POLICY,
  };
  const storage = documentStorageMetadata({ documentType, hospitalCode: String(hospitalId), patientKey: "template" });
  if (existing[0]) {
    await db.update(credentialTemplates).set({
      name: String(label.th),
      nameEn: String(label.en),
      version: "1.0",
      schema,
      fhirResourceType: primaryFhirResource(documentType),
      documentCategory: storage.category,
      documentSubcategory: storage.subcategory,
      defaultStoragePath: storage.storagePath,
      validityDays: validityDays(documentType),
      isActive: true,
    } as any).where(eq(credentialTemplates.id, existing[0].id));
    return existing[0].id;
  }
  const result = await db.insert(credentialTemplates).values({
    hospitalId,
    name: String(label.th),
    nameEn: String(label.en),
    type: documentType as any,
    version: "1.0",
    schema,
    fhirResourceType: primaryFhirResource(documentType),
    documentCategory: storage.category,
    documentSubcategory: storage.subcategory,
    defaultStoragePath: storage.storagePath,
    validityDays: validityDays(documentType),
    schemaVersion: "1.0.0",
    isActive: true,
  } as any);
  return result[0].insertId;
}

async function upsertTrustRegistryIssuer(hospital: JsonRecord, hospitalId: number): Promise<void> {
  const db = (await getDb())!;
  const did = String(hospital.did);
  const [existing] = await db.select().from(trustRegistry).where(eq(trustRegistry.did, did)).limit(1);
  const values = {
    entityType: "issuer",
    entityName: String(hospital.nameTh),
    entityNameEn: String(hospital.nameEn),
    did,
    publicKeyJwk: hospital.didDocument?.verificationMethod?.[0]?.publicKeyJwk,
    country: "TH",
    jurisdiction: "Thailand",
    trustLevel: "verified",
    credentialTypes: Object.values(DOCUMENT_TYPE_LABELS).map((item) => item.vcType),
    contactEmail: `issuer.${String(hospital.code).toLowerCase()}@trustcare.example`,
    contactUrl: `https://trustcare.network/hospital/${String(hospital.code).toLowerCase()}`,
    verifiedAt: SEED_ISSUED_AT,
    isActive: true,
    metadata: { hospitalId, source: "trustcare-seed-reseed", didDocument: hospital.didDocument },
  };
  if (existing) await db.update(trustRegistry).set(values as any).where(eq(trustRegistry.id, existing.id));
  else await db.insert(trustRegistry).values(values as any);
}

async function upsertNetworkLevelIssuer(): Promise<void> {
  const db = (await getDb())!;
  const networkDid = "did:web:trustcare.network";
  const [existing] = await db.select().from(trustRegistry).where(eq(trustRegistry.did, networkDid)).limit(1);
  const values = {
    entityType: "issuer",
    entityName: "เครือข่ายโรงพยาบาลทรัสต์แคร์",
    entityNameEn: "TrustCare Hospital Network",
    did: networkDid,
    country: "TH",
    jurisdiction: "Thailand",
    trustLevel: "verified",
    credentialTypes: Object.values(DOCUMENT_TYPE_LABELS).map((item) => item.vcType),
    contactEmail: "trust@trustcare.example",
    contactUrl: "https://trustcare.network",
    verifiedAt: SEED_ISSUED_AT,
    isActive: true,
    metadata: { source: "trustcare-seed-reseed", level: "network" },
  };
  if (existing) await db.update(trustRegistry).set(values as any).where(eq(trustRegistry.id, existing.id));
  else await db.insert(trustRegistry).values(values as any);
}

async function upsertSourceTruthAdapters(hospital: JsonRecord, hospitalId: number): Promise<void> {
  const db = (await getDb())!;
  const connectors = sourceTruthConnectors().filter((item) => item.hospitalCode === hospital.code);
  for (const connector of connectors) {
    const name = String(connector.name);
    const [existing] = await db.select().from(integrationAdapters)
      .where(and(eq(integrationAdapters.hospitalId, hospitalId), eq(integrationAdapters.name, name)))
      .limit(1);
    const values = {
      hospitalId,
      name,
      systemType: connector.kind === "unified_integration" ? "his" : connector.kind === "legacy_db_view" ? "legacy_db" : "his",
      connectorPattern: connector.kind === "unified_integration" ? "api_rest" : connector.kind === "legacy_db_view" ? "db_view" : "api_rest",
      connectionConfig: {
        sourceOfTruth: true,
        connector,
        canonicalMappingVersion: connector.canonicalMappingVersion,
        reviewRequiredBeforeVc: true,
      },
      authMethod: "mtls",
      status: "active",
      healthStatus: "healthy",
      lastHealthCheck: SEED_ISSUED_AT,
    };
    const adapterId = existing
      ? (await db.update(integrationAdapters).set(values as any).where(eq(integrationAdapters.id, existing.id)), existing.id)
      : (await db.insert(integrationAdapters).values(values as any))[0].insertId;

    const [mapping] = await db.select().from(mappingVersions)
      .where(and(eq(mappingVersions.adapterId, adapterId), eq(mappingVersions.version, String(connector.canonicalMappingVersion))))
      .limit(1);
    const mappingValues = {
      adapterId,
      resourceType: "Bundle",
      version: String(connector.canonicalMappingVersion),
      mappingConfig: { standardLabels: standardLabelCatalog(), connector },
      status: "published",
      publishedAt: SEED_ISSUED_AT,
    };
    if (mapping) await db.update(mappingVersions).set(mappingValues as any).where(eq(mappingVersions.id, mapping.id));
    else await db.insert(mappingVersions).values(mappingValues as any);

    for (const resourceType of ["Patient", "Encounter", "Condition", "AllergyIntolerance", "MedicationRequest", "Observation", "DocumentReference"]) {
      const localFieldName = `${String(connector.id)}.${resourceType}`;
      const [field] = await db.select().from(fhirFieldMappings)
        .where(and(eq(fhirFieldMappings.hospitalId, hospitalId), eq(fhirFieldMappings.localFieldName, localFieldName)))
        .limit(1);
      const fieldValues = {
        hospitalId,
        localFieldName,
        localFieldPath: `${String(connector.kind)}.${resourceType}`,
        fhirResourceType: resourceType,
        fhirFieldPath: resourceType,
        transformRule: "canonical-data-mapping-review-before-vc",
        isActive: true,
        validationStatus: "valid",
      };
      if (field) await db.update(fhirFieldMappings).set(fieldValues as any).where(eq(fhirFieldMappings.id, field.id));
      else await db.insert(fhirFieldMappings).values(fieldValues as any);
    }
  }
}

function buildPatientBlock(patient: JsonRecord): import("./vc").PatientBlock {
  return {
    fullNameTh: String(patient.nameTh),
    fullNameEn: String(patient.nameEn),
    birthDate: String(patient.birthDate),
    gender: String(patient.gender),
    nationality: String(patient.nationality ?? "THA"),
    carepassId: String(patient.carepassId ?? ""),
    hn: String(patient.hn ?? ""),
    phone: String(patient.phone ?? ""),
    email: String(patient.email ?? ""),
  };
}

async function issueSeedCredential(input: {
  document: JsonRecord;
  patient: JsonRecord;
  issuer: IssuerProfile;
  subjectId: number;
  audience: string;
}): Promise<IssuedVc> {
  const credentialId = `${SEED_PREFIX}:vc:${String(input.document.hospitalCode).toLowerCase()}:${String(input.patient.seedId).toLowerCase()}:${String(input.document.credentialType)}`;
  const holderDid = String(input.document.holderDid);
  const subjectRef = String(input.patient.patientRef ?? input.subjectId);
  const patientBlock = buildPatientBlock(input.patient);
  const documentType = String(input.document.credentialType);
  const hospitalCode = String(input.document.hospitalCode);
  if (input.document.credentialType === "medical_certificate") {
    const fhir = buildMedicalCertificateFhir({
      patient: { id: subjectRef, name: input.patient.nameTh, hn: input.patient.hn },
      practitioner: seedPractitioner(input.document.hospitalCode),
      organization: seedOrganization(input.patient),
      diagnosisText: diagnosisForPatient(input.patient),
      fitnessForWork: "restricted",
      recommendations: ["พักผ่อนตามแพทย์สั่ง", "ใช้เอกสารนี้คู่กับ QR/VP สำหรับตรวจสอบความถูกต้อง"],
    });
    return issueCredential({
      type: "MedicalCertificateCredential",
      issuer: input.issuer,
      subjectId: subjectRef,
      subjectDid: holderDid,
      claims: medicalCertificateClaims({
        patientId: subjectRef,
        patientName: String(input.patient.nameTh),
        practitioner: seedPractitioner(input.document.hospitalCode),
        organization: seedOrganization(input.patient),
        diagnosisText: diagnosisForPatient(input.patient),
        fitnessForWork: "restricted",
        recommendations: ["พักผ่อนตามแพทย์สั่ง", "ใช้เอกสารนี้คู่กับ QR/VP สำหรับตรวจสอบความถูกต้อง"],
        validFrom: SEED_ISSUED_AT.toISOString(),
        validUntil: new Date(SEED_ISSUED_AT.getTime() + 7 * 86400000).toISOString(),
        fhirComposition: fhir.composition,
        documentHash: fhir.documentHash,
      }),
      evidence: [{ type: "FHIRComposition", digest: fhir.documentHash, resourceId: fhir.composition.id }],
      validDays: 90,
      audience: input.audience,
      credentialId,
      now: SEED_ISSUED_AT,
      documentType,
      patient: patientBlock,
      hospitalCode,
    });
  }

  if (input.document.credentialType === "prescription") {
    const medicationRequests = buildPrescriptionMedicationRequests({
      patient: { id: subjectRef, name: input.patient.nameTh, hn: input.patient.hn },
      prescriber: seedPractitioner(input.document.hospitalCode),
      organization: seedOrganization(input.patient),
      authoredOn: SEED_ISSUED_AT.toISOString(),
      medications: [{ code: medicationCodeForPatient(input.patient), name: medicationNameForPatient(input.patient), instructions: "รับประทานหลังอาหารตามแพทย์สั่ง", daysSupply: 30 }],
    });
    return issueCredential({
      type: "PrescriptionCredential",
      issuer: input.issuer,
      subjectId: subjectRef,
      subjectDid: holderDid,
      claims: prescriptionClaims({
        patientId: subjectRef,
        patientName: String(input.patient.nameTh),
        prescriber: seedPractitioner(input.document.hospitalCode),
        organization: seedOrganization(input.patient),
        authoredOn: SEED_ISSUED_AT.toISOString(),
        medicationRequests,
        substitutionAllowed: false,
        repeatsAllowed: 0,
        dispenseWindowDays: 30,
      }),
      evidence: [{ type: "FHIRMedicationRequestBundle", digest: sha256(medicationRequests), resourceCount: medicationRequests.length }],
      validDays: 30,
      audience: input.audience,
      credentialId,
      now: SEED_ISSUED_AT,
      documentType,
      patient: patientBlock,
      hospitalCode,
    });
  }

  if (input.document.credentialType === "sync_receipt") {
    const target = RECOMMENDED_SYNC_TARGETS[0];
    const plan = createSyncBackPlan({
      target,
      operation: "upsert",
      resource: { resourceType: "Patient", id: String(input.patient.hn), identifier: [{ system: "https://trustcare.network/hn", value: input.patient.hn }] },
      sourceEventId: `${credentialId}:source-event`,
      patientBusinessKey: String(input.patient.hn),
      expectedVersion: 'W/"1"',
      reason: "TrustCare reseed validates HIS consistency binding",
      actorId: String(input.subjectId),
      occurredAt: SEED_ISSUED_AT.toISOString(),
    });
    const execution = executeSyncBackPlan(plan, { actorId: String(input.subjectId), executedAt: SEED_ISSUED_AT.toISOString() });
    return issueCredential({
      type: "SyncReceiptCredential",
      issuer: input.issuer,
      subjectId: subjectRef,
      subjectDid: holderDid,
      claims: {
        receiptType: "his_sync_back",
        planId: plan.id,
        targetId: plan.targetId,
        operation: plan.operation,
        status: execution.status,
        idempotencyKey: plan.idempotencyKey,
        consistencyKey: plan.consistencyKey,
        execution,
      },
      evidence: [
        { type: "SyncBackPlan", digest: sha256(plan), resourceId: plan.id },
        { type: "SyncBackExecution", digest: sha256(execution), resourceId: execution.id },
      ],
      validDays: 365,
      audience: input.audience,
      credentialId,
      now: SEED_ISSUED_AT,
      documentType,
      patient: patientBlock,
      hospitalCode,
    });
  }

  const canonical = canonicalizeHisPayload({
    sourceFormat: "db_view",
    payload: hisPayloadForPatient(input.patient),
    sourceSystem: String(input.patient.sourceSystem),
    sourceOrganizationId: String(input.patient.hcode),
    sourceOrganizationName: String(input.patient.hospitalNameEn),
    mapperVersion: String(input.patient.mappingVersion),
    receivedAt: SEED_ISSUED_AT.toISOString(),
  });
  return issueCredential({
    type: credentialTypeForDocument(String(input.document.credentialType)),
    issuer: input.issuer,
    subjectId: subjectRef,
    subjectDid: holderDid,
    claims: claimsForDocument(input.document, input.patient, canonical),
    evidence: [
      { type: "FHIRBundleHash", digest: canonical.summary.bundleHash, sourceSystem: input.patient.sourceSystem },
      { type: "SourceOfTruth", digest: sha256(hisPayloadForPatient(input.patient)), sourceSystem: input.patient.sourceSystem, mappingVersion: input.patient.mappingVersion },
    ],
    validDays: validityDays(String(input.document.credentialType)),
    audience: input.audience,
    credentialId,
    now: SEED_ISSUED_AT,
    documentType,
    patient: patientBlock,
    hospitalCode,
  });
}

async function upsertIssuedCredential(input: {
  vc: IssuedVc;
  document: JsonRecord;
  patient: JsonRecord;
  templateId: number;
  issuerId: number;
  hospitalId: number;
  subjectId: number;
  batchId: string;
}): Promise<number> {
  const db = (await getDb())!;
  const storageMeta = documentStorageMetadata({
    documentType: String(input.document.credentialType),
    hospitalCode: String(input.document.hospitalCode),
    patientKey: String(input.patient.hn ?? input.subjectId),
    credentialId: input.vc.id,
  });
  // SELECT-first to avoid TiDB lock contention
  const [existingCred] = await db.select().from(issuedCredentials).where(eq(issuedCredentials.credentialId, input.vc.id)).limit(1);
  const credPayload = {
    templateId: input.templateId,
    issuerId: input.issuerId,
    issuerHospitalId: input.hospitalId,
    subjectId: input.subjectId,
    type: input.document.credentialType as any,
    status: "active",
    credentialData: input.vc.credential,
    sdJwtVc: input.vc.jwt,
    documentCategory: storageMeta.category,
    documentSubcategory: storageMeta.subcategory,
    storageKey: storageMeta.storagePath,
    searchTags: storageMeta.indexTags,
    issuedAt: SEED_ISSUED_AT,
    expiresAt: input.vc.expiresAt ? new Date(input.vc.expiresAt) : undefined,
    fhirResourceId: String(input.vc.credential?.credentialSubject?.fhir?.resourceType ?? input.document.evidence?.fhirRefs?.[0] ?? "DocumentReference"),
    schemaVersion: "2.0.0",
  } as any;
  if (existingCred) {
    await db.update(issuedCredentials).set({ ...credPayload, revokedAt: null, revocationReason: null }).where(eq(issuedCredentials.credentialId, input.vc.id));
    return existingCred.id;
  }
  await db.insert(issuedCredentials).values({ credentialId: input.vc.id, ...credPayload });
  const [row] = await db.select().from(issuedCredentials).where(eq(issuedCredentials.credentialId, input.vc.id)).limit(1);
  return row.id;
}

async function upsertWalletCard(input: { patientId: number; credentialRowId: number; document: JsonRecord }): Promise<void> {
  const db = (await getDb())!;
  const existing = await db.select().from(walletCards)
    .where(and(eq(walletCards.patientId, input.patientId), eq(walletCards.credentialId, input.credentialRowId)))
    .limit(1);
  const label = DOCUMENT_TYPE_LABELS[String(input.document.credentialType)] ?? { th: input.document.credentialType, en: input.document.credentialType };
  const storage = documentStorageMetadata({ documentType: String(input.document.credentialType), hospitalCode: String(input.document.hospitalCode), patientKey: String(input.patientId) });
  const values = {
    patientId: input.patientId,
    credentialId: input.credentialRowId,
    cardType: cardTypeForDocument(String(input.document.credentialType)) as any,
    displayName: String(label.th),
    displayNameEn: String(label.en),
    issuerHospitalName: String(input.document.humanDocument?.renderData?.hospital?.nameTh ?? input.document.hospitalNameTh ?? input.document.hospitalCode),
    issuerDid: String(input.document.issuerDid ?? ""),
    documentCategory: storage.category,
    cardColor: hospitalColor(String(input.document.hospitalCode)),
    isPinned: ["patient_identity", "staff_identity", "patient_summary", "allergy_alert"].includes(String(input.document.credentialType)),
  };
  if (existing[0]) await db.update(walletCards).set(values as any).where(eq(walletCards.id, existing[0].id));
  else await db.insert(walletCards).values(values as any);
}

function issuerProfile(document: JsonRecord, hospitalId: number): IssuerProfile {
  return {
    id: String(hospitalId),
    name: String(document.humanDocument?.renderData?.hospital?.nameEn ?? `TrustCare ${document.hospitalCode}`),
    nameTh: String(document.humanDocument?.renderData?.hospital?.nameTh ?? document.hospitalNameTh ?? document.hospitalCode),
    did: String(document.issuerDid),
    hospitalCode: String(document.hospitalCode),
    country: "TH",
    trustDomain: "trustcare-network",
  };
}

function patientKey(patient: JsonRecord): string {
  return `${patient.hospitalCode}:${patient.seedId}`;
}

function credentialTypeForDocument(type: string): TrustcareCredentialType {
  const label = DOCUMENT_TYPE_LABELS[type];
  return String(label?.vcType ?? "PatientSummaryCredential") as TrustcareCredentialType;
}

function claimsForDocument(document: JsonRecord, patient: JsonRecord, canonical: ReturnType<typeof canonicalizeHisPayload>): JsonRecord {
  const type = String(document.credentialType);
  if (type === "patient_summary") return patientSummaryClaims(canonical);
  if (type === "consent_receipt") {
    return consentReceiptClaims({
      id: `${SEED_PREFIX}:consent:${String(patient.hospitalCode).toLowerCase()}:${String(patient.seedId).toLowerCase()}`,
      patientId: String(patient.patientRef),
      purpose: consentPurposeForDocument(type),
      requesterId: "trustcare-seed-requester",
      requesterRole: "doctor",
      grantedToOrganizationId: String(patient.hcode),
      scopes: ["Patient.read", "Condition.read", "AllergyIntolerance.read", "Medication.read", "Observation.read", "DocumentReference.read"],
      status: "granted",
      grantedAt: SEED_ISSUED_AT.toISOString(),
      expiresAt: new Date(SEED_ISSUED_AT.getTime() + 180 * 86400000).toISOString(),
    });
  }
  return {
    documentType: type,
    documentNo: document.documentNo,
    documentHash: document.documentHash,
    brand: "TrustCare",
    label: "TrustCare Verified Health Document",
    fontPolicy: THAI_GOVERNMENT_DOCUMENT_FONT_POLICY,
    patient: {
      id: patient.patientRef,
      holderDid: patient.holderDid,
      hn: patient.hn,
      carepassId: patient.carepassId,
      nameTh: patient.nameTh,
      nameEn: patient.nameEn,
      birthDate: patient.birthDate,
      nationality: patient.nationality,
    },
    organization: seedOrganization(patient),
    clinical: clinicalFactsForPatient(patient),
    fhir: {
      resourceType: primaryFhirResource(type),
      bundleHash: canonical.summary.bundleHash,
      resourceCounts: canonical.summary.resourceCounts,
      refs: document.evidence?.fhirRefs ?? [],
    },
    sourceOfTruth: {
      sourceSystem: patient.sourceSystem,
      mappingVersion: patient.mappingVersion,
      canonicalReviewRequired: true,
      dataConsistency: "source-of-truth-bound",
    },
    humanDocument: document.humanDocument,
  };
}

function hisPayloadForPatient(patient: JsonRecord): JsonRecord {
  return {
    patient: {
      hn: patient.hn,
      healthId: patient.carepassId,
      passport: patient.passport,
      name: patient.nameTh,
      birthDate: patient.birthDate,
      sex: patient.gender === "female" ? "F" : "M",
    },
    encounter: { vn: `VN-${patient.hospitalCode}-20260701-${patient.seedId}`, class: "OPD", visitDate: SEED_ISSUED_AT.toISOString() },
    allergies: (patient.allergies ?? []).map((item: string) => ({ substance: item, severity: item.toLowerCase().includes("severe") ? "high" : "low", reaction: item })),
    medications: [{ code: medicationCodeForPatient(patient), name: medicationNameForPatient(patient), frequency: "ตามแพทย์สั่ง" }],
    diagnoses: (patient.conditions ?? []).map((code: string) => ({ code, display: diagnosisText(code), status: "active" })),
    labs: patient.tags?.includes("lab") ? [{ loinc: "4548-4", name: "HbA1c", value: "7.4", unit: "%", specimenDate: "2026-07-01" }] : [],
    documents: [{ type: "DocumentReference", title: "TrustCare Verified Health Document", status: "current" }],
  };
}

function clinicalFactsForPatient(patient: JsonRecord): JsonRecord {
  return {
    conditions: (patient.conditions ?? []).map((code: string) => ({ code, display: diagnosisText(code) })),
    allergies: patient.allergies ?? [],
    medications: [{ code: medicationCodeForPatient(patient), name: medicationNameForPatient(patient) }],
  };
}

function seedPractitioner(hospitalCode: unknown): JsonRecord {
  return {
    id: `Practitioner/${String(hospitalCode).toLowerCase()}-dr-arisa`,
    name: "พญ. อริสา กลิ่นใจ",
    nameEn: "Dr. Arisa Klinjai",
    licenseNo: "MD-TH-12345",
  };
}

function seedOrganization(patient: JsonRecord): JsonRecord {
  return {
    id: String(patient.hcode),
    name: String(patient.hospitalNameTh),
    nameEn: String(patient.hospitalNameEn),
    did: String(patient.issuerDid),
  };
}

function consentPurposeForDocument(type: string): ConsentPurpose {
  if (type.includes("claim")) return "claim";
  if (type.includes("insurance")) return "insurance";
  if (type.includes("travel")) return "medical_tourism";
  return "referral";
}

function primaryFhirResource(type: string): string {
  const map: Record<string, string> = {
    patient_identity: "Patient",
    staff_identity: "Practitioner",
    consent_receipt: "Consent",
    patient_summary: "Bundle",
    allergy_alert: "AllergyIntolerance",
    medication_summary: "MedicationStatement",
    referral_vc: "ServiceRequest",
    immunization: "Immunization",
    medical_certificate: "Composition",
    prescription: "MedicationRequest",
    lab_result: "DiagnosticReport",
    diagnostic_report: "DiagnosticReport",
    discharge_summary: "Composition",
    insurance_eligibility: "Coverage",
    claim_package: "Claim",
    claim_receipt: "ClaimResponse",
    travel_document_verification: "DocumentReference",
    shl_manifest: "Bundle",
    pharmacy_dispense: "MedicationDispense",
    appointment: "Appointment",
    visa_support_letter: "DocumentReference",
    quotation: "DocumentReference",
    guarantee_letter: "DocumentReference",
    mpi_link_certificate: "Patient",
    sync_receipt: "Provenance",
  };
  return map[type] ?? "DocumentReference";
}

function validityDays(type: string): number {
  if (["prescription", "pharmacy_dispense"].includes(type)) return 30;
  if (["medical_certificate", "lab_result", "diagnostic_report"].includes(type)) return 90;
  if (["consent_receipt", "insurance_eligibility", "claim_package", "claim_receipt"].includes(type)) return 180;
  return 365;
}

function cardTypeForDocument(type: string): string {
  const map: Record<string, string> = {
    patient_identity: "identity",
    staff_identity: "identity",
    consent_receipt: "consent",
    patient_summary: "patient_summary",
    allergy_alert: "allergy",
    medication_summary: "medication",
    referral_vc: "referral",
    insurance_eligibility: "coverage",
    claim_package: "claim",
    claim_receipt: "claim",
    travel_document_verification: "travel_document",
  };
  return map[type] ?? type;
}

function hospitalColor(code: string): string {
  return TRUSTCARE_DEMO_HOSPITALS.find((hospital) => hospital.code === code)?.color ?? "#2563eb";
}

function diagnosisForPatient(patient: JsonRecord): string {
  return diagnosisText((patient.conditions ?? [])[0]);
}

function diagnosisText(code: string | undefined): string {
  const map: Record<string, string> = {
    E11: "Type 2 diabetes mellitus",
    I10: "Essential hypertension",
    J45: "Asthma",
    "R07.9": "Chest pain",
    Z34: "Supervision of normal pregnancy",
    M17: "Knee osteoarthritis",
    "M17.1": "Knee osteoarthritis",
    M16: "Hip osteoarthritis",
    "N18.2": "Chronic kidney disease stage 2",
    Z23: "Immunization encounter",
    A09: "Infectious gastroenteritis",
  };
  return map[code ?? ""] ?? "General examination";
}

function medicationCodeForPatient(patient: JsonRecord): string {
  const first = (patient.conditions ?? [])[0];
  if (first === "E11") return "TMT-MET-500";
  if (first === "I10") return "TMT-AML-5";
  if (first === "J45") return "TMT-SAL-INH";
  return "TMT-PARA-500";
}

function medicationNameForPatient(patient: JsonRecord): string {
  const first = (patient.conditions ?? [])[0];
  if (first === "E11") return "Metformin 500mg";
  if (first === "I10") return "Amlodipine 5mg";
  if (first === "J45") return "Salbutamol inhaler";
  return "Paracetamol 500mg";
}

function checkCount(name: string, expected: number, actual: number) {
  return {
    name,
    expected,
    actual,
    ok: actual === expected,
    delta: actual - expected,
  };
}

function hasIssuerEntitlements(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const entitlements = value as { makerTypes?: unknown; checkerTypes?: unknown };
  return (Array.isArray(entitlements.makerTypes) && entitlements.makerTypes.length > 0)
    || (Array.isArray(entitlements.checkerTypes) && entitlements.checkerTypes.length > 0);
}


// ─── Staff Identity Credential Seeding ──────────────────────────────────────
const STAFF_POSITION_LABELS: Record<string, { th: string; en: string; licensePrefix?: string }> = {
  doctor: { th: "แพทย์", en: "Physician", licensePrefix: "MD" },
  nurse: { th: "พยาบาลวิชาชีพ", en: "Registered Nurse", licensePrefix: "RN" },
  hospital_admin: { th: "ผู้ดูแลโรงพยาบาล", en: "Hospital Administrator" },
  system_admin: { th: "ผู้ดูแลระบบ", en: "System Administrator" },
  integration_engineer: { th: "วิศวกรระบบเชื่อมต่อ", en: "Integration Engineer" },
  maker: { th: "เจ้าหน้าที่ออกเอกสาร", en: "Document Maker" },
  checker: { th: "เจ้าหน้าที่ตรวจสอบ", en: "Document Checker" },
};

async function seedStaffIdentityCredentials(input: {
  hospitalRows: Map<string, number>;
  issuerRows: Map<string, number>;
  templateRows: Map<string, number>;
  batchId: string;
}): Promise<void> {
  const db = (await getDb())!;
  // Find all staff users (non-patient, with a hospitalId)
  const staffUsers = await db.select().from(users).where(
    and(
      sql`${users.systemRole} != 'patient'`,
      sql`${users.hospitalId} IS NOT NULL`,
    )
  );

  for (const staffUser of staffUsers) {
    if (!staffUser.hospitalId) continue;
    // Check if this user already has a staff_identity credential
    const [existing] = await db.select().from(issuedCredentials)
      .where(and(
        eq(issuedCredentials.subjectId, staffUser.id),
        eq(issuedCredentials.type, "staff_identity" as any),
        eq(issuedCredentials.status, "active"),
      ))
      .limit(1);
    if (existing) continue;

    // Find hospital code from hospitalId
    const [hospital] = await db.select().from(hospitals).where(eq(hospitals.id, staffUser.hospitalId)).limit(1);
    if (!hospital) continue;

    const hospitalCode = hospital.code || "TCC";
    const hospitalNameTh = hospital.name || hospitalCode;
    const hospitalNameEn = hospital.nameEn || hospitalCode;
    const hospitalHcode = hospital.code; // use code as hcode fallback
    const issuerId = input.issuerRows.get(hospitalCode);
    const templateId = input.templateRows.get(`${hospitalCode}:staff_identity`);
    if (!issuerId || !templateId) continue;

    const positionLabel = STAFF_POSITION_LABELS[staffUser.systemRole] ?? { th: "เจ้าหน้าที่", en: "Staff" };
    const licenseNo = positionLabel.licensePrefix
      ? `${positionLabel.licensePrefix}-${String(staffUser.id).padStart(6, "0")}`
      : undefined;

    const credentialId = `${SEED_PREFIX}:vc:staff:${hospitalCode.toLowerCase()}:${staffUser.openId}`;
    const holderDid = patientDidKey(`${hospitalCode}:STAFF:${staffUser.openId}`);
    const issuerDid = hospitalDidWeb(hospitalCode);

    const issuer: IssuerProfile = {
      id: String(staffUser.hospitalId),
      name: hospital.nameEn || `TrustCare ${hospitalCode}`,
      did: issuerDid,
      country: "TH",
      trustDomain: "trustcare-network",
    };

    const claims: JsonRecord = {
      documentType: "staff_identity",
      staffId: staffUser.openId,
      position: positionLabel.th,
      positionEn: positionLabel.en,
      systemRole: staffUser.systemRole,
      hospitalCode,
      hospitalName: hospitalNameEn,
      hospitalNameTh: hospitalNameTh,
      fullNameTh: staffUser.name,
      fullNameEn: staffUser.name,
      email: staffUser.email,
      phone: staffUser.phone,
      thaiId: staffUser.thaiId,
      ...(licenseNo ? { licenseNo } : {}),
      brand: "TrustCare",
      label: "TrustCare Hospital Staff Identity",
      fontPolicy: THAI_GOVERNMENT_DOCUMENT_FONT_POLICY,
    };

    const vc = await issueCredential({
      type: "HospitalStaffIdentityCredential",
      issuer,
      subjectId: String(staffUser.id),
      subjectDid: holderDid,
      claims,
      evidence: [{ type: "StaffRegistry", digest: sha256(claims), sourceSystem: `${hospitalCode}-HRM` }],
      validDays: 365,
      audience: DEFAULT_AUDIENCE,
      credentialId,
      now: SEED_ISSUED_AT,
    });

    const document: JsonRecord = {
      credentialType: "staff_identity",
      hospitalCode,
      id: `doc-staff-${hospitalCode.toLowerCase()}-${staffUser.openId}`,
      holderDid,
      issuerDid,
      humanDocument: {
        brand: "TrustCare",
        label: "TrustCare Hospital Staff Identity",
        templateId: "staff_identity_v1",
        renderData: {
          hospital: { code: hospitalCode, nameTh: hospitalNameTh, nameEn: hospitalNameEn, hcode: hospitalHcode },
          staff: { fullNameTh: staffUser.name, position: positionLabel.th, positionEn: positionLabel.en, licenseNo },
          document: { no: `STAFF-${hospitalCode}-${String(staffUser.id).padStart(6, "0")}`, hashShort: sha256(credentialId).slice(0, 12), qrLabel: "Scan to verify" },
          issuer: { did: issuerDid },
        },
      },
    };

    const storage = documentStorageMetadata({ documentType: "staff_identity", hospitalCode, patientKey: String(staffUser.id) });

    // SELECT-first to avoid TiDB lock contention
    const [existingStaffCred] = await db.select().from(issuedCredentials).where(eq(issuedCredentials.credentialId, vc.id)).limit(1);
    const staffCredPayload = {
      templateId,
      issuerId,
      issuerHospitalId: staffUser.hospitalId,
      subjectId: staffUser.id,
      type: "staff_identity" as any,
      status: "active",
      credentialData: vc.credential,
      sdJwtVc: vc.jwt,
      documentCategory: storage.category,
      documentSubcategory: storage.subcategory,
      storageKey: storage.storagePath,
      searchTags: storage.indexTags,
      issuedAt: SEED_ISSUED_AT,
      expiresAt: vc.expiresAt ? new Date(vc.expiresAt) : undefined,
      fhirResourceId: "Practitioner",
      schemaVersion: "2.0.0",
    } as any;
    if (existingStaffCred) {
      await db.update(issuedCredentials).set(staffCredPayload).where(eq(issuedCredentials.credentialId, vc.id));
    } else {
      await db.insert(issuedCredentials).values({ credentialId: vc.id, ...staffCredPayload });
    }

    const [credRow] = await db.select().from(issuedCredentials).where(eq(issuedCredentials.credentialId, vc.id)).limit(1);
    if (!credRow) continue;

    await upsertWalletCard({
      patientId: staffUser.id,
      credentialRowId: credRow.id,
      document,
    });
  }
}
