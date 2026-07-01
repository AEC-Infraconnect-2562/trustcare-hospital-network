import { getDb } from "./server/db.ts";
import { sql } from "drizzle-orm";

async function verify() {
  const db = await getDb();
  if (!db) { console.error("No DB"); process.exit(1); }

  const [creds] = await db.execute(sql`SELECT COUNT(*) as cnt FROM issued_credentials WHERE credentialId LIKE 'urn:trustcare:seed:vc:%' AND status = 'active'`);
  const [presos] = await db.execute(sql`SELECT COUNT(*) as cnt FROM issued_presentations WHERE presentationId LIKE 'urn:trustcare:seed:vp:%' AND status = 'active'`);
  const [wallets] = await db.execute(sql`SELECT COUNT(*) as cnt FROM wallet_cards`);
  const [batches] = await db.execute(sql`SELECT COUNT(*) as cnt FROM vc_vp_seed_batches WHERE status = 'completed'`);
  const [users] = await db.execute(sql`SELECT COUNT(*) as cnt FROM users WHERE openId LIKE 'seed-patient-%'`);

  console.log("=== Reseed Verification ===");
  console.log("Active seed credentials:", creds[0]?.cnt);
  console.log("Active seed presentations:", presos[0]?.cnt);
  console.log("Wallet cards:", wallets[0]?.cnt);
  console.log("Completed seed batches:", batches[0]?.cnt);
  console.log("Seed patients:", users[0]?.cnt);
  process.exit(0);
}

verify().catch(err => { console.error(err); process.exit(1); });
