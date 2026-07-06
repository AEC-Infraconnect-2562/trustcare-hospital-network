/**
 * Batch SD-JWT Migration Script
 * 
 * Issues SD-JWT (selective disclosure) for all existing credentials
 * that don't have sdJwtFull yet. This ensures every credential in the
 * system is ready for selective disclosure presentation.
 * 
 * Usage: npx tsx server/scripts/batchSdJwtMigration.ts
 * 
 * Options:
 *   --dry-run    Preview what would be migrated without making changes
 *   --limit N    Process only N credentials (for testing)
 *   --status S   Process only credentials with this status (default: all)
 */
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { isNull, eq, and, desc, sql } from "drizzle-orm";
import { issuedCredentials } from "../../drizzle/schema";
import { issueSdJwt } from "../portability/sdJwt";
import { hospitals } from "../../drizzle/schema";

// Parse CLI args
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const limitIdx = args.indexOf("--limit");
const batchLimit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : undefined;
const statusIdx = args.indexOf("--status");
const statusFilter = statusIdx >= 0 ? args[statusIdx + 1] : undefined;

async function main() {
  console.log("=== Batch SD-JWT Migration ===");
  console.log(`Mode: ${dryRun ? "DRY RUN (no changes)" : "LIVE"}`);
  if (batchLimit) console.log(`Limit: ${batchLimit} credentials`);
  if (statusFilter) console.log(`Status filter: ${statusFilter}`);
  console.log("");

  // Connect to database
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("ERROR: DATABASE_URL not set");
    process.exit(1);
  }

  const connection = await mysql.createConnection(dbUrl);
  const db = drizzle(connection);

  // Build query conditions
  const conditions = [isNull(issuedCredentials.sdJwtFull)];
  if (statusFilter) {
    conditions.push(eq(issuedCredentials.status, statusFilter as any));
  }

  // Count total needing migration
  const [countResult] = await db.select({ count: sql<number>`COUNT(*)` })
    .from(issuedCredentials)
    .where(and(...conditions));
  const totalNeedsMigration = Number(countResult?.count ?? 0);

  console.log(`Credentials needing SD-JWT: ${totalNeedsMigration}`);

  if (totalNeedsMigration === 0) {
    console.log("✅ All credentials already have SD-JWT. Nothing to do.");
    await connection.end();
    return;
  }

  // Fetch credentials needing migration
  let query = db.select()
    .from(issuedCredentials)
    .where(and(...conditions))
    .orderBy(desc(issuedCredentials.issuedAt));

  const credentialsToMigrate = batchLimit
    ? await query.limit(batchLimit)
    : await query;

  console.log(`Processing: ${credentialsToMigrate.length} credentials\n`);

  // Fetch all hospitals for DID resolution
  const allHospitals = await db.select().from(hospitals);
  const hospitalMap = new Map(allHospitals.map(h => [h.id, h]));

  // Process each credential
  let success = 0;
  let skipped = 0;
  let failed = 0;
  const errors: { credentialId: string; error: string }[] = [];

  for (let i = 0; i < credentialsToMigrate.length; i++) {
    const cred = credentialsToMigrate[i];
    const progress = `[${i + 1}/${credentialsToMigrate.length}]`;

    // Skip if no credential data
    const credData = cred.credentialData as Record<string, unknown> | null;
    if (!credData) {
      console.log(`${progress} SKIP ${cred.credentialId} — no credentialData`);
      skipped++;
      continue;
    }

    // Extract claims
    const credentialSubject = (credData as any)?.credentialSubject || credData;
    const hospital = hospitalMap.get(cred.issuerHospitalId);
    const hospitalCode = hospital?.code || "TCC";
    const issuerDid = `did:web:trustcare.network:hospital:${hospitalCode}`;
    const subjectDid = `did:trustcare:patient:${cred.subjectId}`;

    if (dryRun) {
      console.log(`${progress} WOULD ISSUE SD-JWT for ${cred.credentialId} (type: ${cred.type}, subject: ${cred.subjectId})`);
      success++;
      continue;
    }

    try {
      const sdResult = await issueSdJwt({
        credentialId: cred.credentialId,
        credentialType: cred.type,
        issuerDid,
        subjectDid,
        claims: credentialSubject as Record<string, unknown>,
        vcEnvelope: credData as any,
        hospitalCode,
      });

      // Update the database
      await db.update(issuedCredentials)
        .set({
          sdJwtFull: sdResult.sdJwtFull,
          disclosureMap: sdResult.disclosureMap,
        })
        .where(eq(issuedCredentials.id, cred.id));

      success++;
      if ((i + 1) % 50 === 0 || i === credentialsToMigrate.length - 1) {
        console.log(`${progress} ✓ ${cred.credentialId} (type: ${cred.type}) — ${Object.keys(sdResult.disclosureMap).length} disclosures`);
      }
    } catch (err: any) {
      failed++;
      const errMsg = err?.message || String(err);
      errors.push({ credentialId: cred.credentialId, error: errMsg });
      console.log(`${progress} ✗ FAILED ${cred.credentialId}: ${errMsg}`);
    }
  }

  // Summary
  console.log("\n=== Migration Summary ===");
  console.log(`Total processed: ${credentialsToMigrate.length}`);
  console.log(`Success: ${success}`);
  console.log(`Skipped (no data): ${skipped}`);
  console.log(`Failed: ${failed}`);

  if (errors.length > 0) {
    console.log("\nFailed credentials:");
    for (const e of errors) {
      console.log(`  - ${e.credentialId}: ${e.error}`);
    }
  }

  // Verify final count
  if (!dryRun) {
    const [finalCount] = await db.select({ count: sql<number>`COUNT(*)` })
      .from(issuedCredentials)
      .where(isNull(issuedCredentials.sdJwtFull));
    console.log(`\nRemaining without SD-JWT: ${Number(finalCount?.count ?? 0)}`);
  }

  console.log("\n✅ Migration complete.");
  await connection.end();
}

main().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
