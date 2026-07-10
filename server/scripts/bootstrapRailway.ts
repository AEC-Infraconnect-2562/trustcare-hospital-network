import { eq } from "drizzle-orm";
import { auditEvents } from "../../drizzle/schema";
import { ENV } from "../_core/env";
import { closeDb, getDb } from "../db";
import { auditTrustcareVcVpSeedDatabase, reseedTrustcareVcVpDatabase } from "../portability/reseed";
import { seedDatabase } from "../seed";
import { seedPrepareServiceContracts } from "../seedPrepareService";

const BOOTSTRAP_VERSION = "railway-demo-v1";

async function stageCompleted(action: string): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL is required for Railway bootstrap");
  const [row] = await db.select({ id: auditEvents.id })
    .from(auditEvents)
    .where(eq(auditEvents.action, action))
    .limit(1);
  return Boolean(row);
}

async function markStage(action: string, details: Record<string, unknown>) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL is required for Railway bootstrap");
  await db.insert(auditEvents).values({
    actorRole: "system",
    action,
    resourceType: "deployment_bootstrap",
    resourceId: BOOTSTRAP_VERSION,
    details,
  });
}

async function runStage<T>(name: string, work: () => Promise<T>): Promise<T | undefined> {
  const action = `deployment.bootstrap.${BOOTSTRAP_VERSION}.${name}`;
  if (await stageCompleted(action)) {
    console.log(`[Bootstrap] ${name}: already completed`);
    return undefined;
  }

  console.log(`[Bootstrap] ${name}: starting`);
  const result = await work();
  await markStage(action, { completedAt: new Date().toISOString(), result });
  console.log(`[Bootstrap] ${name}: completed`);
  return result;
}

async function main() {
  if (!ENV.bootstrapDemoData) {
    console.log("[Bootstrap] BOOTSTRAP_DEMO_DATA is not true; skipping demo seed");
    return;
  }

  await runStage("base", seedDatabase);
  await runStage("vc-vp", () => reseedTrustcareVcVpDatabase({
    patientsPerHospital: 12,
    resetExistingSeed: true,
  }));
  await runStage("prepare-service", seedPrepareServiceContracts);

  const audit = await auditTrustcareVcVpSeedDatabase({ patientsPerHospital: 12 });
  if (!audit.ok) {
    throw new Error(`VC/VP seed audit failed: ${JSON.stringify(audit)}`);
  }
  console.log(`[Bootstrap] seed audit passed: ${JSON.stringify(audit.actual)}`);
}

async function run() {
  try {
    await main();
  } catch (error) {
    console.error("[Bootstrap] failed", error);
    process.exitCode = 1;
  } finally {
    await closeDb();
  }
}

void run();
