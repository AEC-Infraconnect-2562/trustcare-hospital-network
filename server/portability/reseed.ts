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
import { didWebDocument, hospitalDidWeb, networkDidWeb, patientDidKey } from "./did";
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
import { defaultPatientImage, type PersonGender } from "../../shared/personImages";
import { ENV } from "../_core/env";

const SEED_PREFIX = "urn:trustcare:seed";
const SEED_ISSUED_AT = new Date("2026-07-01T02:00:00.000Z");
const DEFAULT_AUDIENCE = `${ENV.publicUrl}/verifier`;

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
    const manifestUrl = `${ENV.publicUrl}/api/shl/manifest/${encodeURIComponent(manifestToken)}`;
    const shlink = buildShlinkPayload({
      manifestUrl,
      key,
      expiresAt: new Date(SEED_ISSUED_AT.getTime() + 30 * 86_400_000),
      passcodeRequired: true,
      label: String(scenario.name ?? scenario.id),
      viewerBaseUrl: `${ENV.publicUrl}/shl-viewer`,
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
  const expectedPatientOpenIds = Array.from(new Set(
    (expectedSeed.patients as JsonRecord[]).map((patient) => resolvePatientOpenId(
      String(patient.hospitalCode),
      String(patient.seedId),
    )),
  ));

  const hospitalRows = await db.select().from(hospitals).where(inArray(hospitals.code, expectedHospitalCodes));
  const seedPatientRows = await db.select().from(users).where(inArray(users.openId, expectedPatientOpenIds));
  const seedStaffRows = await db.select().from(users).where(sql`${users.openId} like 'seed-maker-%' or ${users.openId} like 'seed-checker-%' or ${users.openId} like 'seed-issuer-%'`);
  const sourceTruthRows = await db.select().from(integrationAdapters).where(inArray(integrationAdapters.name, expectedConnectorNames));
  const hospitalIds = hospitalRows.map((hospital) => hospital.id);
  const patientIds = seedPatientRows.map((patient) => patient.id);
  const staffIdentitySubjects = hospitalIds.length > 0
    ? await db.select({ id: users.id }).from(users).where(and(
        sql`${users.systemRole} != 'patient'`,
        inArray(users.hospitalId, hospitalIds),
      ))
    : [];

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
  const [smartHealthLinkCount] = await db.select({ value: count() }).from(smartHealthLinks)
    .where(and(like(smartHealthLinks.manifestToken, `${SEED_PREFIX}:shl:%`), eq(smartHealthLinks.status, "active" as any)));
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
  const credentialTypeCounts = Object.fromEntries(
    credentialTypes.map((row) => [row.type, Number(row.value)]),
  );
  const generatedCredentialCount = Number(
    latestBatch[0]?.generatedCredentialCount ?? (expectedSeed.counts as JsonRecord).documents,
  );
  const generatedPresentationCount = Number(
    latestBatch[0]?.generatedPresentationCount ?? (expectedSeed.counts as JsonRecord).vpScenarios,
  );
  const expectedSmartHealthLinks = Number((expectedSeed.counts as JsonRecord).vpScenarios);
  const expectedActiveSeedCredentials = generatedCredentialCount
    + staffIdentitySubjects.length
    + expectedSmartHealthLinks;
  const expectedActiveSeedPresentations = generatedPresentationCount + expectedSmartHealthLinks;

  const checks = [
    checkCount("completed seed batch", 1, latestBatch[0]?.status === "completed" ? 1 : 0),
    checkCount("hospitals", Number((expectedSeed.counts as JsonRecord).hospitals), hospitalRows.length),
    checkCount("seed patient records", expectedPatientOpenIds.length, seedPatientRows.length),
    checkCount("credential templates", Object.keys(DOCUMENT_TYPE_LABELS).length * expectedHospitalCodes.length, Number(templateCount?.value ?? 0)),
    checkCount("active seed credentials", expectedActiveSeedCredentials, Number(credentialCount?.value ?? 0)),
    checkCount("wallet cards for seed credentials", expectedActiveSeedCredentials, Number(walletCount?.value ?? 0)),
    checkCount("staff identity credentials", staffIdentitySubjects.length, Number(credentialTypeCounts.staff_identity ?? 0)),
    checkCount("active seed presentations", expectedActiveSeedPresentations, Number(presentationCount?.value ?? 0)),
    checkCount("active Smart Health Links", expectedSmartHealthLinks, Number(smartHealthLinkCount?.value ?? 0)),
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
    expected: {
      ...expectedSeed.counts,
      databasePatientRows: expectedPatientOpenIds.length,
      activeSeedCredentials: expectedActiveSeedCredentials,
      activeSeedPresentations: expectedActiveSeedPresentations,
      staffIdentityCredentials: staffIdentitySubjects.length,
      activeSmartHealthLinks: expectedSmartHealthLinks,
    },
    actual: {
      hospitals: hospitalRows.length,
      seedPatients: seedPatientRows.length,
      seedStaff: seedStaffRows.length,
      credentialTemplates: Number(templateCount?.value ?? 0),
      activeSeedCredentials: Number(credentialCount?.value ?? 0),
      walletCardsForSeedCredentials: Number(walletCount?.value ?? 0),
      activeSeedPresentations: Number(presentationCount?.value ?? 0),
      activeSmartHealthLinks: Number(smartHealthLinkCount?.value ?? 0),
      patientIdentifiers: Number(identifierCount?.value ?? 0),
      sourceTruthConnectors: sourceTruthRows.length,
      credentialTypes: credentialTypeCounts,
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
  const hospitalCode = String(hospital.code);
  const did = hospitalDidWeb(hospitalCode);
  const runtimeDidDocument = didWebDocument({
    hospitalCode,
    name: String(hospital.nameTh),
    nameEn: String(hospital.nameEn),
  });
  // Use SELECT-first pattern to avoid TiDB lock contention
  const [existing] = await db.select().from(hospitals).where(eq(hospitals.code, String(hospital.code))).limit(1);
  if (existing) {
    await db.update(hospitals).set({
      name: String(hospital.nameTh),
      nameEn: String(hospital.nameEn),
      did,
      address: String(hospital.addressTh ?? ""),
      phone: String(hospital.phone ?? ""),
      status: "active",
      settings: {
        branding: hospital.branding,
        didDocument: runtimeDidDocument,
        fontPolicy: THAI_GOVERNMENT_DOCUMENT_FONT_POLICY,
      },
    } as any).where(eq(hospitals.id, existing.id));
    return existing.id;
  }
  await db.insert(hospitals).values({
    name: String(hospital.nameTh),
    nameEn: String(hospital.nameEn),
    code: hospitalCode,
    did,
    address: String(hospital.addressTh ?? ""),
    phone: String(hospital.phone ?? ""),
    email: `contact.${String(hospital.code).toLowerCase()}@trustcare.example`,
    logoUrl: `trustcare://${String(hospital.code).toLowerCase()}/brand/logo.svg`,
    issuerEndpoint: `${ENV.publicUrl}/api/issuer/${String(hospital.code).toLowerCase()}`,
    verifierEndpoint: `${ENV.publicUrl}/api/verifier/${String(hospital.code).toLowerCase()}`,
    fhirEndpoint: `${ENV.publicUrl}/fhir/${String(hospital.code).toLowerCase()}`,
    status: "active",
    settings: {
      branding: hospital.branding,
      didDocument: runtimeDidDocument,
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
  const hospitalCode = String(hospital.code);
  const did = hospitalDidWeb(hospitalCode);
  const runtimeDidDocument = didWebDocument({
    hospitalCode,
    name: String(hospital.nameTh),
    nameEn: String(hospital.nameEn),
  });
  const [existing] = await db.select().from(trustRegistry).where(eq(trustRegistry.did, did)).limit(1);
  const values = {
    entityType: "issuer",
    entityName: String(hospital.nameTh),
    entityNameEn: String(hospital.nameEn),
    did,
    publicKeyJwk: runtimeDidDocument.verificationMethod?.[0]?.publicKeyJwk,
    country: "TH",
    jurisdiction: "Thailand",
    trustLevel: "verified",
    credentialTypes: Object.values(DOCUMENT_TYPE_LABELS).map((item) => item.vcType),
    contactEmail: `issuer.${String(hospital.code).toLowerCase()}@trustcare.example`,
    contactUrl: `${ENV.publicUrl}/hospital/${String(hospital.code).toLowerCase()}`,
    verifiedAt: SEED_ISSUED_AT,
    isActive: true,
    metadata: { hospitalId, source: "trustcare-seed-reseed", didDocument: runtimeDidDocument },
  };
  if (existing) await db.update(trustRegistry).set(values as any).where(eq(trustRegistry.id, existing.id));
  else await db.insert(trustRegistry).values(values as any);
}

async function upsertNetworkLevelIssuer(): Promise<void> {
  const db = (await getDb())!;
  const networkDid = networkDidWeb();
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
    contactUrl: ENV.publicUrl,
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
    avatarUrl: defaultPatientImage(String(patient.gender) as PersonGender),
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
        recommendations: ["พักผ่อนตามแพทย์สั่ง", "งดออกกำลังกายหนัก 7 วัน", "ใช้เอกสารนี้คู่กับ QR/VP สำหรับตรวจสอบความถูกต้อง"],
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
      medications: medicationsForPatient(input.patient),
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
    issuerDid: hospitalDidWeb(String(input.document.hospitalCode)),
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
    did: hospitalDidWeb(String(document.hospitalCode)),
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

  // Deterministic pick helpers based on patient+hospital+type
  const seed = sha256(String(patient.seedId) + String(document.hospitalCode) + type);
  const pick = <T>(arr: T[]): T => arr[parseInt(seed.slice(0, 4), 16) % arr.length];
  const pickIdx = (max: number): number => parseInt(seed.slice(4, 8), 16) % max;

  // Shared base fields for all type-specific claims
  const base = {
    documentType: type,
    documentNo: document.documentNo,
    documentHash: document.documentHash,
    brand: "TrustCare",
    fontPolicy: THAI_GOVERNMENT_DOCUMENT_FONT_POLICY,
    organization: seedOrganization(patient),
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
  };

  // ─── Type-Specific Claims ─────────────────────────────────────────────────

  if (type === "patient_identity") {
    return {
      ...base,
      identityType: "patient_card",
      idCardNo: patient.thaiIdHash ? `*****${String(patient.thaiIdHash).slice(-4)}` : undefined,
      passport: patient.passport,
      nationality: patient.nationality ?? "THA",
      bloodType: pick(["A+", "B+", "O+", "AB+", "A-", "O-"]),
      emergencyContact: {
        name: patient.nationality === "THA" ? "นางสมศรี ใจดี" : "Jane Williams",
        relationship: patient.nationality === "THA" ? "มารดา" : "Spouse",
        phone: patient.nationality === "THA" ? "081-234-5678" : "+1-555-0199",
      },
      issuedFacility: seedOrganization(patient),
      practitioner: seedPractitioner(patient.hospitalCode),
    };
  }

  if (type === "allergy_alert") {
    const allergies = (patient.allergies ?? []).map((item: string) => {
      const severity = item.toLowerCase().includes("severe") ? "high" : item.toLowerCase().includes("moderate") ? "moderate" : "low";
      const reactionMap: Record<string, string> = { "penicillin": "Anaphylaxis", "sulfonamide": "Skin rash", "nsaid": "Bronchospasm", "iodinated": "Urticaria", "latex": "Contact dermatitis", "aspirin": "GI bleeding" };
      const substance = item.split(" ")[0];
      const reaction = Object.entries(reactionMap).find(([k]) => item.toLowerCase().includes(k))?.[1] ?? "Allergic reaction";
      return {
        substance,
        severity,
        reaction,
        reactionTh: severity === "high" ? "แพ้รุนแรง" : severity === "moderate" ? "แพ้ปานกลาง" : "แพ้เล็กน้อย",
        onsetDate: "2020-03-15",
        verifiedBy: seedPractitioner(patient.hospitalCode).name,
        clinicalStatus: "active",
        verificationStatus: "confirmed",
        category: "medication",
        criticality: severity === "high" ? "high" : "low",
      };
    });
    return {
      ...base,
      alertType: "allergy_intolerance",
      alertLevel: allergies.some((a: JsonRecord) => a.severity === "high") ? "critical" : "warning",
      allergies,
      totalAllergyCount: allergies.length,
      lastReviewedDate: "2026-06-15",
      reviewedBy: seedPractitioner(patient.hospitalCode),
      clinicalNote: allergies.some((a: JsonRecord) => a.severity === "high")
        ? "ผู้ป่วยมีประวัติแพ้ยารุนแรง กรุณาตรวจสอบก่อนสั่งยาทุกครั้ง"
        : "ผู้ป่วยมีประวัติแพ้ยา กรุณาระวังการสั่งยาในกลุ่มเดียวกัน",
    };
  }

  if (type === "medication_summary") {
    const medications = (patient.conditions ?? []).map((code: string) => {
      const medMap: Record<string, { code: string; name: string; nameTh: string; dose: string; frequency: string; route: string }> = {
        E11: { code: "TMT-MET-500", name: "Metformin 500mg", nameTh: "เมทฟอร์มิน 500 มก.", dose: "500mg", frequency: "วันละ 2 ครั้ง หลังอาหาร", route: "oral" },
        I10: { code: "TMT-AML-5", name: "Amlodipine 5mg", nameTh: "แอมโลดิปีน 5 มก.", dose: "5mg", frequency: "วันละ 1 ครั้ง เช้า", route: "oral" },
        J45: { code: "TMT-SAL-INH", name: "Salbutamol inhaler", nameTh: "ซัลบูทามอล สูดพ่น", dose: "2 puffs", frequency: "เมื่อมีอาการ", route: "inhalation" },
        "M17.1": { code: "TMT-CEL-200", name: "Celecoxib 200mg", nameTh: "เซเลค็อกซิบ 200 มก.", dose: "200mg", frequency: "วันละ 1 ครั้ง", route: "oral" },
        M16: { code: "TMT-CEL-200", name: "Celecoxib 200mg", nameTh: "เซเลค็อกซิบ 200 มก.", dose: "200mg", frequency: "วันละ 1 ครั้ง", route: "oral" },
        "N18.2": { code: "TMT-FEB-40", name: "Febuxostat 40mg", nameTh: "เฟบูโซสแตท 40 มก.", dose: "40mg", frequency: "วันละ 1 ครั้ง", route: "oral" },
        Z23: { code: "TMT-PARA-500", name: "Paracetamol 500mg", nameTh: "พาราเซตามอล 500 มก.", dose: "500mg", frequency: "เมื่อมีไข้", route: "oral" },
        A09: { code: "TMT-ORS", name: "ORS solution", nameTh: "ผงเกลือแร่", dose: "1 ซอง", frequency: "ทุก 4 ชั่วโมง", route: "oral" },
      };
      const med = medMap[code] ?? { code: "TMT-PARA-500", name: "Paracetamol 500mg", nameTh: "พาราเซตามอล 500 มก.", dose: "500mg", frequency: "เมื่อมีอาการ", route: "oral" };
      return { ...med, status: "active", startDate: "2025-01-15", prescriber: seedPractitioner(patient.hospitalCode).name };
    });
    return {
      ...base,
      summaryType: "current_medication_list",
      medications,
      totalMedicationCount: medications.length,
      lastReconciledDate: "2026-06-28",
      reconciledBy: seedPractitioner(patient.hospitalCode),
      adherenceNote: "ผู้ป่วยรับประทานยาสม่ำเสมอ",
      nextReviewDate: "2026-09-01",
    };
  }

  if (type === "referral_vc") {
    const departments = ["อายุรกรรม", "ศัลยกรรม", "ออร์โธปิดิกส์", "หู คอ จมูก", "จักษุ", "รังสีวิทยา"];
    const departmentsEn = ["Internal Medicine", "Surgery", "Orthopedics", "ENT", "Ophthalmology", "Radiology"];
    const deptIdx = pickIdx(departments.length);
    const referToHospital = pick(TRUSTCARE_DEMO_HOSPITALS.filter((h) => h.code !== patient.hospitalCode));
    return {
      ...base,
      referralType: "outpatient_referral",
      priority: pick(["routine", "urgent", "semi-urgent"]),
      referringPractitioner: seedPractitioner(patient.hospitalCode),
      referringDepartment: { nameTh: pick(departments), nameEn: pick(departmentsEn) },
      receivingFacility: {
        code: referToHospital.code,
        nameTh: referToHospital.nameTh,
        nameEn: referToHospital.nameEn,
        hcode: referToHospital.hcode,
      },
      receivingDepartment: { nameTh: departments[deptIdx], nameEn: departmentsEn[deptIdx] },
      reasonForReferral: diagnosisForPatient(patient),
      reasonForReferralTh: `ส่งต่อเพื่อรักษาต่อเนื่อง - ${diagnosisForPatient(patient)}`,
      clinicalSummary: {
        chiefComplaint: diagnosisForPatient(patient),
        currentMedications: [{ name: medicationNameForPatient(patient), code: medicationCodeForPatient(patient) }],
        allergies: patient.allergies ?? [],
        relevantHistory: `Patient diagnosed with ${diagnosisForPatient(patient)}, currently on ${medicationNameForPatient(patient)}`,
      },
      requestedServices: ["Specialist consultation", "Treatment plan review"],
      referralDate: SEED_ISSUED_AT.toISOString(),
      validUntil: new Date(SEED_ISSUED_AT.getTime() + 30 * 86400000).toISOString(),
      transportMode: "self",
    };
  }

  if (type === "lab_result") {
    const labPanels = [
      { code: "4548-4", name: "HbA1c", nameTh: "ฮีโมโกลบิน เอวันซี", value: "7.4", unit: "%", refRange: "4.0-5.6", interpretation: "high", category: "chemistry" },
      { code: "2345-7", name: "FBS", nameTh: "น้ำตาลในเลือด (อดอาหาร)", value: "142", unit: "mg/dL", refRange: "70-100", interpretation: "high", category: "chemistry" },
      { code: "2160-0", name: "Creatinine", nameTh: "ครีเอตินีน", value: "1.8", unit: "mg/dL", refRange: "0.7-1.3", interpretation: "high", category: "chemistry" },
      { code: "6690-2", name: "WBC", nameTh: "เม็ดเลือดขาว", value: "8200", unit: "cells/uL", refRange: "4500-11000", interpretation: "normal", category: "hematology" },
      { code: "718-7", name: "Hemoglobin", nameTh: "ฮีโมโกลบิน", value: "13.5", unit: "g/dL", refRange: "12.0-16.0", interpretation: "normal", category: "hematology" },
      { code: "2093-3", name: "Total Cholesterol", nameTh: "คอเลสเตอรอลรวม", value: "228", unit: "mg/dL", refRange: "<200", interpretation: "high", category: "chemistry" },
    ];
    const conditions = patient.conditions ?? [];
    // Give each patient a full panel of 5-6 results for realism
    let selectedLabs = [labPanels[3], labPanels[4], labPanels[0], labPanels[5]]; // default: CBC + HbA1c + Cholesterol
    if (conditions.includes("E11")) selectedLabs = [labPanels[0], labPanels[1], labPanels[5], labPanels[2], labPanels[3], labPanels[4]]; // Full DM panel
    if (conditions.includes("N18.2")) selectedLabs = [labPanels[2], labPanels[4], labPanels[3], labPanels[0], labPanels[1]]; // Renal panel
    if (conditions.includes("I10")) selectedLabs = [labPanels[5], labPanels[0], labPanels[1], labPanels[3], labPanels[4]]; // Cardio panel
    return {
      ...base,
      reportType: "laboratory_report",
      specimen: {
        type: "Venous blood",
        typeTh: "เลือดดำ",
        collectedAt: new Date(SEED_ISSUED_AT.getTime() - 2 * 3600000).toISOString(),
        receivedAt: new Date(SEED_ISSUED_AT.getTime() - 1.5 * 3600000).toISOString(),
        accessionNo: `LAB-${patient.hospitalCode}-${seed.slice(0, 8).toUpperCase()}`,
      },
      observations: selectedLabs.map((lab) => ({
        loincCode: lab.code,
        name: lab.name,
        nameTh: lab.nameTh,
        value: lab.value,
        unit: lab.unit,
        referenceRange: lab.refRange,
        interpretation: lab.interpretation,
        category: lab.category,
        status: "final",
      })),
      reportStatus: "final",
      reportedAt: SEED_ISSUED_AT.toISOString(),
      performedBy: { name: "นักเทคนิคการแพทย์ ปราณี วงศ์สุข", nameEn: "MT. Pranee Wongsuk", licenseNo: "MT-TH-54321" },
      verifiedBy: seedPractitioner(patient.hospitalCode),
      orderingPractitioner: seedPractitioner(patient.hospitalCode),
      clinicalNote: selectedLabs.some((l) => l.interpretation === "high")
        ? "พบค่าผิดปกติ กรุณาติดตามผลกับแพทย์"
        : "ผลตรวจปกติ",
    };
  }

  if (type === "diagnostic_report") {
    const modalities = [
      { code: "X-RAY", name: "Chest X-ray", nameTh: "เอกซเรย์ทรวงอก", bodyPart: "Chest", bodyPartTh: "ทรวงอก" },
      { code: "CT", name: "CT Abdomen", nameTh: "ซีทีสแกนช่องท้อง", bodyPart: "Abdomen", bodyPartTh: "ช่องท้อง" },
      { code: "MRI", name: "MRI Knee", nameTh: "เอ็มอาร์ไอ เข่า", bodyPart: "Knee", bodyPartTh: "เข่า" },
      { code: "US", name: "Ultrasound Abdomen", nameTh: "อัลตราซาวด์ช่องท้อง", bodyPart: "Abdomen", bodyPartTh: "ช่องท้อง" },
    ];
    const conditions = patient.conditions ?? [];
    let selectedModality = modalities[0];
    if (conditions.includes("M17.1") || conditions.includes("M16")) selectedModality = modalities[2];
    if (conditions.includes("N18.2")) selectedModality = modalities[3];
    if (conditions.includes("J45")) selectedModality = modalities[0];
    return {
      ...base,
      reportType: "diagnostic_imaging_report",
      modality: selectedModality.code,
      studyName: selectedModality.name,
      studyNameTh: selectedModality.nameTh,
      bodyPart: selectedModality.bodyPart,
      bodyPartTh: selectedModality.bodyPartTh,
      studyDate: new Date(SEED_ISSUED_AT.getTime() - 24 * 3600000).toISOString(),
      accessionNo: `IMG-${patient.hospitalCode}-${seed.slice(0, 8).toUpperCase()}`,
      findings: `No acute abnormality detected in ${selectedModality.bodyPart.toLowerCase()}. Normal study.`,
      findingsTh: `ไม่พบความผิดปกติเฉียบพลันใน${selectedModality.bodyPartTh} ผลปกติ`,
      conclusion: "Normal study. No significant abnormality.",
      conclusionTh: "ผลการตรวจปกติ ไม่พบความผิดปกติที่สำคัญ",
      reportingRadiologist: { name: "นพ. เกรียงไกร ศรีสมบูรณ์", nameEn: "Dr. Kriangkrai Srisomboon", licenseNo: "MD-TH-67890" },
      orderingPractitioner: seedPractitioner(patient.hospitalCode),
      clinicalIndication: diagnosisForPatient(patient),
      urgency: "routine",
    };
  }

  if (type === "discharge_summary") {
    const admitDate = new Date(SEED_ISSUED_AT.getTime() - 5 * 86400000);
    return {
      ...base,
      summaryType: "inpatient_discharge",
      admissionDate: admitDate.toISOString(),
      dischargeDate: SEED_ISSUED_AT.toISOString(),
      lengthOfStay: 5,
      ward: pick(["อายุรกรรมชาย 1", "อายุรกรรมหญิง 2", "ศัลยกรรม 3"]),
      wardEn: pick(["Male Medicine Ward 1", "Female Medicine Ward 2", "Surgical Ward 3"]),
      admittingDiagnosis: diagnosisForPatient(patient),
      dischargeDiagnosis: diagnosisForPatient(patient),
      principalProcedure: patient.conditions?.includes("E11") ? "Blood glucose monitoring" : "Supportive care",
      attendingPhysician: seedPractitioner(patient.hospitalCode),
      dischargeCondition: "improved",
      dischargeConditionTh: "อาการดีขึ้น",
      vitalSignsAtAdmission: { bp: "158/92 mmHg", hr: "92 bpm", temp: "37.8°C", rr: "22/min", spo2: "96%", weight: "72 kg" },
      vitalSignsAtDischarge: { bp: "128/78 mmHg", hr: "76 bpm", temp: "36.6°C", rr: "18/min", spo2: "98%", weight: "71 kg" },
      dischargeMedications: medicationsForPatient(patient).map(m => ({ name: m.name, code: m.code, instructions: m.instructions, dose: m.dose, frequency: m.frequency })),
      followUpInstructions: "นัดตรวจติดตามอาการ 2 สัปดาห์",
      followUpInstructionsEn: "Follow-up appointment in 2 weeks",
      followUpDate: new Date(SEED_ISSUED_AT.getTime() + 14 * 86400000).toISOString(),
      dietaryAdvice: "รับประทานอาหารอ่อน หลีกเลี่ยงอาหารรสจัด",
      activityRestrictions: "งดยกของหนักเกิน 5 กก. เป็นเวลา 2 สัปดาห์",
    };
  }

  if (type === "immunization") {
    const vaccines = [
      { code: "CVX-208", name: "COVID-19 mRNA (Pfizer-BioNTech)", nameTh: "วัคซีนโควิด-19 ไฟเซอร์", manufacturer: "Pfizer-BioNTech", lotNo: "FN7890", doseNumber: 3, series: "Primary + Booster" },
      { code: "CVX-141", name: "Influenza (Quadrivalent)", nameTh: "วัคซีนไข้หวัดใหญ่ 4 สายพันธุ์", manufacturer: "Sanofi Pasteur", lotNo: "U3456A", doseNumber: 1, series: "Annual" },
      { code: "CVX-110", name: "Hepatitis B (Recombinant)", nameTh: "วัคซีนตับอักเสบบี", manufacturer: "GSK", lotNo: "AHBV2026", doseNumber: 2, series: "3-dose series" },
      { code: "CVX-115", name: "Tetanus-Diphtheria (Td)", nameTh: "วัคซีนบาดทะยัก-คอตีบ", manufacturer: "bioCSL", lotNo: "TD2026B", doseNumber: 1, series: "Booster" },
      { code: "CVX-137", name: "HPV (Gardasil 9)", nameTh: "วัคซีนเอชพีวี 9 สายพันธุ์", manufacturer: "Merck", lotNo: "HPV9-2026", doseNumber: 2, series: "2-dose series" },
    ];
    const selectedVaccine = patient.conditions?.includes("Z23") ? vaccines[pickIdx(vaccines.length)] : vaccines[0];
    return {
      ...base,
      immunizationType: "vaccination_record",
      vaccine: {
        cvxCode: selectedVaccine.code,
        name: selectedVaccine.name,
        nameTh: selectedVaccine.nameTh,
        manufacturer: selectedVaccine.manufacturer,
        lotNumber: selectedVaccine.lotNo,
        expirationDate: "2027-06-30",
      },
      doseNumber: selectedVaccine.doseNumber,
      seriesName: selectedVaccine.series,
      administrationDate: SEED_ISSUED_AT.toISOString(),
      site: "Left deltoid",
      siteTh: "กล้ามเนื้อหัวไหล่ซ้าย",
      route: "Intramuscular",
      administeredBy: seedPractitioner(patient.hospitalCode),
      facility: seedOrganization(patient),
      nextDoseDate: selectedVaccine.doseNumber < 3 ? new Date(SEED_ISSUED_AT.getTime() + 90 * 86400000).toISOString() : undefined,
      adverseReaction: "None observed",
      adverseReactionTh: "ไม่พบอาการข้างเคียง",
    };
  }

  if (type === "insurance_eligibility") {
    const insurers = [
      { name: "AXA Thailand", memberId: "AXA-TH-2026-001", planName: "AXA SmartCare Executive", payerType: "private_insurance" },
      { name: "Cigna Thailand", memberId: "CIG-TH-2026-002", planName: "Cigna Global Health", payerType: "private_insurance" },
      { name: "Pacific Cross", memberId: "PCX-TH-2026-003", planName: "Pacific Cross Premier", payerType: "private_insurance" },
      { name: "BUPA Thailand", memberId: "BUP-TH-2026-004", planName: "BUPA Platinum", payerType: "private_insurance" },
      { name: "สำนักงานหลักประกันสุขภาพแห่งชาติ (สปสช.)", memberId: "UCS-TH-2026-005", planName: "บัตรทอง (UC)", payerType: "ucs" },
      { name: "กรมบัญชีกลาง", memberId: "CSMBS-TH-2026-006", planName: "สวัสดิการข้าราชการ", payerType: "csmbs" },
    ];
    const selectedInsurer = patient.nationality !== "THA" ? insurers[pickIdx(4)] : insurers[pickIdx(insurers.length)];
    return {
      ...base,
      eligibilityType: "coverage_verification",
      payer: {
        name: selectedInsurer.name,
        payerType: selectedInsurer.payerType,
        payerId: `PAYER-${selectedInsurer.payerType.toUpperCase()}-001`,
      },
      memberId: selectedInsurer.memberId,
      planName: selectedInsurer.planName,
      status: "eligible",
      checkedAt: SEED_ISSUED_AT.toISOString(),
      validFrom: "2026-01-01",
      validUntil: "2026-12-31",
      preAuthorizationRequired: selectedInsurer.payerType === "private_insurance",
      benefits: {
        opd: true,
        ipd: true,
        dental: selectedInsurer.payerType === "private_insurance",
        maternity: selectedInsurer.payerType === "private_insurance",
        directBilling: selectedInsurer.payerType !== "ucs",
        annualLimit: selectedInsurer.payerType === "private_insurance" ? 2000000 : undefined,
        annualLimitCurrency: "THB",
        remainingLimit: selectedInsurer.payerType === "private_insurance" ? 1750000 : undefined,
      },
      copay: selectedInsurer.payerType === "private_insurance" ? { percentage: 20, maxPerVisit: 3000 } : undefined,
    };
  }

  if (type === "claim_package") {
    const serviceItems = [
      { code: "HC-OPD-CONSULT", description: "ค่าตรวจแพทย์ผู้เชี่ยวชาญ", descriptionEn: "Specialist consultation fee", amount: 1500 },
      { code: "HC-LAB-PANEL", description: "ค่าตรวจทางห้องปฏิบัติการ", descriptionEn: "Laboratory panel", amount: 2800 },
      { code: "HC-MED-RX", description: "ค่ายา", descriptionEn: "Medication", amount: 3200 },
      { code: "HC-PROC-MINOR", description: "ค่าหัตถการ", descriptionEn: "Minor procedure", amount: 5000 },
    ];
    const selectedItems = serviceItems.slice(0, 2 + pickIdx(3));
    const totalAmount = selectedItems.reduce((sum, item) => sum + item.amount, 0);
    return {
      ...base,
      claimType: "opd",
      claimStatus: "submitted",
      encounterRef: `VN-${patient.hospitalCode}-20260701-${patient.seedId}`,
      serviceDate: SEED_ISSUED_AT.toISOString(),
      diagnosisCodes: patient.conditions ?? ["Z00.0"],
      procedureCodes: selectedItems.length > 3 ? ["99213"] : [],
      serviceItems: selectedItems,
      totalAmount,
      currency: "THB",
      submittedAt: SEED_ISSUED_AT.toISOString(),
      claimRef: `CLM-${patient.hospitalCode}-${seed.slice(0, 10).toUpperCase()}`,
      attachedEvidence: [
        { type: "lab_result", credentialRef: `${SEED_PREFIX}:vc:${String(patient.hospitalCode).toLowerCase()}:${String(patient.seedId).toLowerCase()}:lab_result` },
        { type: "prescription", credentialRef: `${SEED_PREFIX}:vc:${String(patient.hospitalCode).toLowerCase()}:${String(patient.seedId).toLowerCase()}:prescription` },
      ],
    };
  }

  if (type === "claim_receipt") {
    const totalAmount = 7500 + pickIdx(15) * 500;
    const approvedAmount = Math.round(totalAmount * 0.8);
    return {
      ...base,
      receiptType: "claim_adjudication_receipt",
      claimRef: `CLM-${patient.hospitalCode}-${seed.slice(0, 10).toUpperCase()}`,
      adjudicationDate: new Date(SEED_ISSUED_AT.getTime() + 3 * 86400000).toISOString(),
      adjudicationOutcome: "approved",
      totalClaimed: totalAmount,
      approvedAmount,
      patientResponsibility: totalAmount - approvedAmount,
      currency: "THB",
      paymentMethod: "direct_billing",
      paymentStatus: "paid",
      paidAt: new Date(SEED_ISSUED_AT.getTime() + 7 * 86400000).toISOString(),
      payerRef: `PAY-${patient.hospitalCode}-${seed.slice(10, 18).toUpperCase()}`,
      invoiceNo: `INV-${patient.hospitalCode}-20260701-${patient.seedId}`,
      receiptNo: `RCP-${patient.hospitalCode}-20260701-${patient.seedId}`,
      breakdown: [
        { category: "ค่าตรวจแพทย์", categoryEn: "Consultation", claimed: 1500, approved: 1500 },
        { category: "ค่าตรวจทางห้องปฏิบัติการ", categoryEn: "Laboratory", claimed: 2800, approved: 2240 },
        { category: "ค่ายา", categoryEn: "Medication", claimed: totalAmount - 4300, approved: approvedAmount - 3740 },
      ],
    };
  }

  if (type === "travel_document_verification") {
    return {
      ...base,
      verificationType: "passport_identity_verification",
      documentType: "passport",
      passportNumber: patient.passport ?? "X12345678",
      issuingCountry: patient.nationality ?? "USA",
      nationality: patient.nationality ?? "USA",
      verificationStatus: "verified",
      verifiedAt: SEED_ISSUED_AT.toISOString(),
      verifiedBy: "TrustCare International Desk",
      verifiedByTh: "แผนกผู้ป่วยต่างชาติ ทรัสต์แคร์",
      mrzLine1: `P<${(patient.nationality ?? "USA").slice(0, 3)}${String(patient.nameEn ?? "").replace(/[^A-Z]/gi, "<").toUpperCase().slice(0, 39)}`,
      mrzLine2: `${patient.passport ?? "X12345678"}${'<'.repeat(30)}`.slice(0, 44),
      expiryDate: "2030-12-31",
      visaType: patient.nationality === "USA" ? "Tourist (VOA)" : "Medical (Non-Imm MT)",
      visaTypeTh: patient.nationality === "USA" ? "ท่องเที่ยว (VOA)" : "รักษาพยาบาล (Non-Imm MT)",
      purposeOfVisit: "Medical treatment",
      purposeOfVisitTh: "เข้ารับการรักษาพยาบาล",
    };
  }

  if (type === "pharmacy_dispense") {
    return {
      ...base,
      dispenseType: "outpatient_dispense",
      prescriptionRef: `${SEED_PREFIX}:vc:${String(patient.hospitalCode).toLowerCase()}:${String(patient.seedId).toLowerCase()}:prescription`,
      dispensedAt: SEED_ISSUED_AT.toISOString(),
      dispensedItems: [
        {
          medicationCode: medicationCodeForPatient(patient),
          medicationName: medicationNameForPatient(patient),
          medicationNameTh: patient.conditions?.includes("E11") ? "เมทฟอร์มิน 500 มก." : patient.conditions?.includes("I10") ? "แอมโลดิปีน 5 มก." : patient.conditions?.includes("J45") ? "ซัลบูทามอล สูดพ่น" : "พาราเซตามอล 500 มก.",
          quantity: 30,
          unit: patient.conditions?.includes("J45") ? "puffs" : "tablets",
          daysSupply: 30,
          lotNumber: `LOT-${seed.slice(0, 6).toUpperCase()}`,
          expirationDate: "2027-12-31",
          instructions: "รับประทานหลังอาหารตามแพทย์สั่ง",
          instructionsEn: "Take after meals as directed",
        },
      ],
      dispenser: { name: "ภก. สุรศักดิ์ เภสัชกร", nameEn: "Pharm. Surasak Pharmacist", licenseNo: "RPH-TH-11111" },
      verifiedAllergies: true,
      counselingProvided: true,
      counselingNotes: "แนะนำวิธีรับประทานยาและอาการข้างเคียงที่ควรระวัง",
      counselingNotesEn: "Counseled on administration and potential side effects",
      substitutionMade: false,
      nextRefillDate: new Date(SEED_ISSUED_AT.getTime() + 28 * 86400000).toISOString(),
    };
  }

  if (type === "appointment") {
    const departments = [
      { nameTh: "อายุรกรรม", nameEn: "Internal Medicine" },
      { nameTh: "ศัลยกรรม", nameEn: "Surgery" },
      { nameTh: "ออร์โธปิดิกส์", nameEn: "Orthopedics" },
      { nameTh: "จักษุ", nameEn: "Ophthalmology" },
    ];
    const selectedDept = departments[pickIdx(departments.length)];
    const appointmentDate = new Date(SEED_ISSUED_AT.getTime() + (7 + pickIdx(21)) * 86400000);
    return {
      ...base,
      appointmentType: "follow_up",
      status: "booked",
      scheduledDate: appointmentDate.toISOString().split("T")[0],
      scheduledTime: `${9 + pickIdx(8)}:${pickIdx(2) === 0 ? "00" : "30"}`,
      duration: 30,
      department: selectedDept,
      practitioner: seedPractitioner(patient.hospitalCode),
      location: {
        building: pick(["อาคาร A", "อาคาร B", "อาคาร C"]),
        floor: `ชั้น ${2 + pickIdx(5)}`,
        room: `ห้อง ${pick(["201", "305", "412", "508"])}`,
      },
      reasonForVisit: `ติดตามอาการ ${diagnosisForPatient(patient)}`,
      reasonForVisitEn: `Follow-up: ${diagnosisForPatient(patient)}`,
      preparationInstructions: "กรุณามาก่อนเวลานัด 15 นาที พร้อมบัตรประชาชนหรือพาสปอร์ต",
      preparationInstructionsEn: "Please arrive 15 minutes early with your ID or passport",
      requiredDocuments: ["บัตรประชาชน/พาสปอร์ต", "บัตรนัดพบแพทย์", "ผลตรวจครั้งก่อน (ถ้ามี)"],
      cancellationPolicy: "กรุณาแจ้งยกเลิกล่วงหน้าอย่างน้อย 24 ชั่วโมง",
    };
  }

  if (type === "visa_support_letter") {
    const treatmentDays = 7 + pickIdx(14);
    return {
      ...base,
      letterType: "medical_visa_support",
      purpose: "medical_treatment",
      purposeTh: "เข้ารับการรักษาพยาบาล",
      patientPassport: patient.passport ?? "X12345678",
      patientNationality: patient.nationality ?? "USA",
      visitPeriod: {
        from: SEED_ISSUED_AT.toISOString().split("T")[0],
        to: new Date(SEED_ISSUED_AT.getTime() + treatmentDays * 86400000).toISOString().split("T")[0],
        totalDays: treatmentDays,
      },
      receivingDepartment: { nameTh: "แผนกผู้ป่วยต่างชาติ", nameEn: "International Patient Department" },
      responsiblePhysician: seedPractitioner(patient.hospitalCode),
      treatmentPlan: {
        diagnosis: diagnosisForPatient(patient),
        plannedProcedures: [`Specialist consultation for ${diagnosisForPatient(patient)}`, "Diagnostic workup", "Treatment initiation"],
        estimatedCost: { amount: 150000 + pickIdx(10) * 50000, currency: "THB" },
      },
      hospitalGuarantee: "โรงพยาบาลรับรองว่าผู้ป่วยมีนัดหมายรับการรักษาตามกำหนดข้างต้น",
      hospitalGuaranteeEn: "The hospital certifies that the patient has a confirmed appointment for the treatment described above.",
      signatoryTitle: "ผู้อำนวยการโรงพยาบาล",
      signatoryTitleEn: "Hospital Director",
    };
  }

  if (type === "quotation") {
    const packages = [
      { nameTh: "ตรวจสุขภาพประจำปี (Executive)", nameEn: "Annual Health Check-up (Executive)", basePrice: 25000 },
      { nameTh: "ผ่าตัดเปลี่ยนข้อเข่า", nameEn: "Total Knee Replacement", basePrice: 450000 },
      { nameTh: "ผ่าตัดต้อกระจก", nameEn: "Cataract Surgery (Phaco)", basePrice: 85000 },
      { nameTh: "ผ่าตัดไส้ติ่ง (ส่องกล้อง)", nameEn: "Laparoscopic Appendectomy", basePrice: 120000 },
      { nameTh: "ทำฟัน (ครอบฟัน)", nameEn: "Dental Crown", basePrice: 15000 },
    ];
    const conditions = patient.conditions ?? [];
    let selectedPkg = packages[0];
    if (conditions.includes("M17.1") || conditions.includes("M16")) selectedPkg = packages[1];
    if (conditions.includes("N18.2")) selectedPkg = packages[0];
    const lineItems = [
      { description: "ค่าแพทย์", descriptionEn: "Physician fee", amount: Math.round(selectedPkg.basePrice * 0.2) },
      { description: "ค่าห้องและอาหาร", descriptionEn: "Room & board", amount: Math.round(selectedPkg.basePrice * 0.25) },
      { description: "ค่ายาและเวชภัณฑ์", descriptionEn: "Medication & supplies", amount: Math.round(selectedPkg.basePrice * 0.3) },
      { description: "ค่าหัตถการ/ผ่าตัด", descriptionEn: "Procedure/Surgery", amount: Math.round(selectedPkg.basePrice * 0.25) },
    ];
    const estimatedTotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
    return {
      ...base,
      quotationType: "treatment_cost_estimate",
      packageName: selectedPkg.nameTh,
      packageNameEn: selectedPkg.nameEn,
      lineItems,
      estimatedTotal,
      currency: "THB",
      validForDays: 30,
      validUntil: new Date(SEED_ISSUED_AT.getTime() + 30 * 86400000).toISOString(),
      exclusions: [
        "ค่าตรวจเพิ่มเติมนอกเหนือแพ็กเกจ",
        "ค่ารักษาภาวะแทรกซ้อน",
        "ค่าอุปกรณ์พิเศษ (ถ้ามี)",
      ],
      exclusionsEn: [
        "Additional tests beyond package",
        "Complication management",
        "Special equipment (if required)",
      ],
      paymentTerms: "ชำระ 50% ล่วงหน้า ส่วนที่เหลือชำระก่อนจำหน่าย",
      paymentTermsEn: "50% deposit required, balance due before discharge",
      preparedBy: seedPractitioner(patient.hospitalCode),
      approvedBy: { name: "ผู้จัดการฝ่ายการเงิน", nameEn: "Finance Manager" },
    };
  }

  if (type === "guarantee_letter") {
    const insurers = ["AXA Thailand", "Cigna Thailand", "Pacific Cross", "BUPA Thailand", "Allianz Thailand"];
    const selectedInsurer = pick(insurers);
    const coveredAmount = 200000 + pickIdx(10) * 50000;
    return {
      ...base,
      guaranteeType: "insurance_guarantee_of_payment",
      guaranteeRef: `GOP-${patient.hospitalCode}-${seed.slice(0, 10).toUpperCase()}`,
      payer: {
        name: selectedInsurer,
        payerType: "private_insurance",
        contactRef: `${selectedInsurer.replace(/\s/g, "-").toLowerCase()}-claims@example.com`,
      },
      memberId: `MBR-${seed.slice(10, 18).toUpperCase()}`,
      preAuthorizationNo: `PA-${seed.slice(0, 12).toUpperCase()}`,
      coveredServices: [
        { service: "Specialist consultation", serviceTh: "ค่าตรวจแพทย์ผู้เชี่ยวชาญ", covered: true },
        { service: "Diagnostic imaging", serviceTh: "ค่าตรวจทางรังสีวิทยา", covered: true },
        { service: "Laboratory tests", serviceTh: "ค่าตรวจทางห้องปฏิบัติการ", covered: true },
        { service: "Medication", serviceTh: "ค่ายา", covered: true },
        { service: "Room & board (private)", serviceTh: "ค่าห้องเดี่ยว", covered: patient.nationality !== "THA" },
      ],
      approvedLimit: coveredAmount,
      currency: "THB",
      validFrom: SEED_ISSUED_AT.toISOString(),
      validUntil: new Date(SEED_ISSUED_AT.getTime() + 90 * 86400000).toISOString(),
      conditions: [
        "ใช้ได้เฉพาะการรักษาที่ระบุในใบอนุมัติ",
        "ต้องแสดงบัตรประกันทุกครั้งที่เข้ารับบริการ",
        "หากค่าใช้จ่ายเกินวงเงิน ผู้ป่วยรับผิดชอบส่วนเกิน",
      ],
      conditionsEn: [
        "Valid only for approved treatment",
        "Insurance card must be presented at each visit",
        "Patient is responsible for amounts exceeding the approved limit",
      ],
      issuedByPayer: true,
      approvedAt: SEED_ISSUED_AT.toISOString(),
    };
  }

  if (type === "mpi_link_certificate") {
    return {
      ...base,
      linkType: "master_patient_index_link",
      linkedIdentifiers: [
        { system: "https://trustcare.network/carepass", value: patient.carepassId, isPrimary: true },
        { system: `https://trustcare.network/hospitals/${patient.hospitalCode}/hn`, value: patient.hn, isPrimary: false },
        ...(patient.thaiIdHash ? [{ system: "https://dopa.go.th/cid", value: `***${String(patient.thaiIdHash).slice(-4)}`, isPrimary: false, masked: true }] : []),
        ...(patient.passport ? [{ system: "https://icao.int/passport", value: patient.passport, isPrimary: false }] : []),
      ],
      linkStatus: "active",
      linkConfidence: "high",
      matchAlgorithm: "deterministic_exact_match",
      linkedAt: SEED_ISSUED_AT.toISOString(),
      linkedBy: "TrustCare MPI Service",
      goldenRecordId: `MPI-GOLDEN-${patient.carepassId}`,
      crossReferenceCount: patient.passport ? 3 : 2,
      lastVerifiedAt: SEED_ISSUED_AT.toISOString(),
    };
  }

  if (type === "shl_manifest") {
    const context = patient.tags?.includes("referral") || patient.tags?.includes("cross_border")
      ? "cross_branch_referral"
      : patient.tags?.includes("medical_tourist")
        ? "medical_tourist"
        : patient.tags?.includes("claim")
          ? "e_claim"
          : "patient_summary";
    const contextDocuments: Record<string, Array<{ documentType: string; title: string; category: string; fhirResource: string }>> = {
      cross_branch_referral: [
        { documentType: "referral_vc", title: "Referral document", category: "care_transition", fhirResource: "ServiceRequest" },
        { documentType: "patient_summary", title: "Patient summary", category: "clinical_summary", fhirResource: "Composition" },
        { documentType: "lab_result", title: "Laboratory results", category: "diagnostics_and_results", fhirResource: "DiagnosticReport" },
        { documentType: "consent_receipt", title: "Referral consent", category: "identity_and_access", fhirResource: "Consent" },
      ],
      medical_tourist: [
        { documentType: "travel_document_verification", title: "Passport / travel identity", category: "identity_and_access", fhirResource: "DocumentReference" },
        { documentType: "patient_summary", title: "Clinical summary", category: "clinical_summary", fhirResource: "Composition" },
        { documentType: "quotation", title: "Treatment quotation", category: "medical_tourism", fhirResource: "DocumentReference" },
        { documentType: "guarantee_letter", title: "Guarantee letter", category: "medical_tourism", fhirResource: "DocumentReference" },
      ],
      e_claim: [
        { documentType: "insurance_eligibility", title: "Coverage eligibility", category: "claims_and_finance", fhirResource: "Coverage" },
        { documentType: "claim_package", title: "Verified claim package", category: "claims_and_finance", fhirResource: "Claim" },
        { documentType: "claim_receipt", title: "Payment receipt", category: "claims_and_finance", fhirResource: "DocumentReference" },
      ],
      patient_summary: [
        { documentType: "patient_identity", title: "Patient identity", category: "identity_and_access", fhirResource: "Patient" },
        { documentType: "patient_summary", title: "Patient summary", category: "clinical_summary", fhirResource: "Composition" },
        { documentType: "allergy_alert", title: "Allergy alerts", category: "clinical_summary", fhirResource: "AllergyIntolerance" },
        { documentType: "medication_summary", title: "Medication summary", category: "medication_and_pharmacy", fhirResource: "MedicationStatement" },
      ],
    };
    return {
      ...base,
      manifestType: "smart_health_link_manifest",
      context,
      manifestVersion: 1,
      bundleId: `shl-bundle-${patient.hospitalCode.toLowerCase()}-${patient.seedId.toLowerCase()}-v1`,
      documents: contextDocuments[context] ?? contextDocuments.patient_summary,
      transportStandards: ["SMART Health Links files[]", "HL7 FHIR Bundle", "W3C VC/VP"],
      accessControl: {
        passcodeRequired: true,
        expiresAt: new Date(SEED_ISSUED_AT.getTime() + 30 * 86400000).toISOString(),
        maxAccessCount: 5,
      },
      shlinkLabel: context === "cross_branch_referral" ? "Referral Package" : context === "medical_tourist" ? "Medical Tourism Package" : context === "e_claim" ? "Insurance Claim Package" : "Patient Health Summary",
      shlinkLabelTh: context === "cross_branch_referral" ? "แพ็กเกจส่งต่อผู้ป่วย" : context === "medical_tourist" ? "แพ็กเกจ Medical Tourism" : context === "e_claim" ? "แพ็กเกจเคลมประกัน" : "สรุปสุขภาพผู้ป่วย",
    };
  }

  // Fallback for any unhandled types (should not occur with complete seed)
  return {
    ...base,
    clinical: clinicalFactsForPatient(patient),
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

/** Returns a realistic multi-medication list for prescription VC */
function medicationsForPatient(patient: JsonRecord): Array<{ code: string; name: string; instructions: string; daysSupply: number; dose?: string; frequency?: string; route?: string }> {
  const first = (patient.conditions ?? [])[0];
  if (first === "E11") return [
    { code: "TMT-MET-500", name: "Metformin 500mg", dose: "500mg", frequency: "วันละ 2 ครั้ง เช้า-เย็น", route: "รับประทาน", instructions: "รับประทานหลังอาหาร เช้าและเย็น", daysSupply: 30 },
    { code: "TMT-GLI-5", name: "Glipizide 5mg", dose: "5mg", frequency: "วันละ 1 ครั้ง ก่อนอาหารเช้า", route: "รับประทาน", instructions: "รับประทานก่อนอาหารเช้า 30 นาที", daysSupply: 30 },
    { code: "TMT-ATOR-20", name: "Atorvastatin 20mg", dose: "20mg", frequency: "วันละ 1 ครั้ง ก่อนนอน", route: "รับประทาน", instructions: "รับประทานก่อนนอน", daysSupply: 30 },
    { code: "TMT-ASA-81", name: "Aspirin 81mg (enteric-coated)", dose: "81mg", frequency: "วันละ 1 ครั้ง หลังอาหารเช้า", route: "รับประทาน", instructions: "รับประทานหลังอาหารเช้า", daysSupply: 30 },
  ];
  if (first === "I10") return [
    { code: "TMT-AML-5", name: "Amlodipine 5mg", dose: "5mg", frequency: "วันละ 1 ครั้ง เช้า", route: "รับประทาน", instructions: "รับประทานหลังอาหารเช้า", daysSupply: 30 },
    { code: "TMT-ENA-10", name: "Enalapril 10mg", dose: "10mg", frequency: "วันละ 1 ครั้ง เช้า", route: "รับประทาน", instructions: "รับประทานหลังอาหารเช้า", daysSupply: 30 },
    { code: "TMT-HCTZ-25", name: "Hydrochlorothiazide 25mg", dose: "25mg", frequency: "วันละ 1 ครั้ง เช้า", route: "รับประทาน", instructions: "รับประทานหลังอาหารเช้า", daysSupply: 30 },
  ];
  if (first === "J45") return [
    { code: "TMT-SAL-INH", name: "Salbutamol MDI 100mcg/puff", dose: "2 puffs", frequency: "เมื่อมีอาการ (prn)", route: "สูดพ่น", instructions: "สูดพ่น 2 ครั้ง เมื่อมีอาการหอบ", daysSupply: 90 },
    { code: "TMT-BUD-INH", name: "Budesonide/Formoterol 160/4.5mcg", dose: "1 puff", frequency: "วันละ 2 ครั้ง เช้า-เย็น", route: "สูดพ่น", instructions: "สูดพ่น 1 ครั้ง เช้าและเย็น ทุกวัน", daysSupply: 30 },
    { code: "TMT-MONT-10", name: "Montelukast 10mg", dose: "10mg", frequency: "วันละ 1 ครั้ง ก่อนนอน", route: "รับประทาน", instructions: "รับประทานก่อนนอน", daysSupply: 30 },
  ];
  return [
    { code: "TMT-PARA-500", name: "Paracetamol 500mg", dose: "500mg", frequency: "ทุก 4-6 ชม. เมื่อมีอาการ", route: "รับประทาน", instructions: "รับประทานเมื่อมีอาการปวดหรือไข้ ไม่เกิน 4 เม็ดต่อวัน", daysSupply: 7 },
    { code: "TMT-IBU-400", name: "Ibuprofen 400mg", dose: "400mg", frequency: "วันละ 3 ครั้ง หลังอาหาร", route: "รับประทาน", instructions: "รับประทานหลังอาหาร ทันที", daysSupply: 7 },
  ];
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
