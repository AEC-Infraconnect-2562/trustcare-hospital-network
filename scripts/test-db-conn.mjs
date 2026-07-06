import { getDb } from "../server/db.ts";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Connecting to DB...");
  const db = await getDb();
  if (!db) { console.log("No DB!"); process.exit(1); }
  console.log("DB connected!");
  const [result] = await db.execute(sql`SELECT COUNT(*) as cnt FROM issued_credentials`);
  console.log("Credential count:", result);
  process.exit(0);
}
main().catch(e => { console.error("Error:", e.message); process.exit(1); });
