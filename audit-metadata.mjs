import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { sql } from "drizzle-orm";

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(conn);

// Audit issued_credentials
const [icRows] = await conn.query(`
  SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN documentCategory IS NULL OR documentCategory = '' THEN 1 ELSE 0 END) as missing_category,
    SUM(CASE WHEN documentSubcategory IS NULL OR documentSubcategory = '' THEN 1 ELSE 0 END) as missing_subcategory,
    SUM(CASE WHEN storageKey IS NULL OR storageKey = '' THEN 1 ELSE 0 END) as missing_storageKey,
    SUM(CASE WHEN searchTags IS NULL THEN 1 ELSE 0 END) as missing_searchTags
  FROM issued_credentials
`);
console.log("=== issued_credentials audit ===");
console.log(JSON.stringify(icRows[0], null, 2));

// Audit wallet_cards
const [wcRows] = await conn.query(`
  SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN documentCategory IS NULL OR documentCategory = '' THEN 1 ELSE 0 END) as missing_category
  FROM wallet_cards
`);
console.log("\n=== wallet_cards audit ===");
console.log(JSON.stringify(wcRows[0], null, 2));

// Check wallet_cards that don't reference valid issued_credentials
const [orphanWc] = await conn.query(`
  SELECT COUNT(*) as orphan_count FROM wallet_cards wc
  LEFT JOIN issued_credentials ic ON wc.credentialId = ic.id
  WHERE ic.id IS NULL
`);
console.log("\n=== orphan wallet_cards (no matching issued_credential) ===");
console.log(JSON.stringify(orphanWc[0], null, 2));

// Check issued_credentials type distribution
const [typeDistro] = await conn.query(`
  SELECT type, COUNT(*) as cnt, 
    SUM(CASE WHEN documentCategory IS NULL OR documentCategory = '' THEN 1 ELSE 0 END) as needs_repair
  FROM issued_credentials 
  GROUP BY type ORDER BY cnt DESC
`);
console.log("\n=== type distribution (with repair needed) ===");
typeDistro.forEach(r => console.log(`  ${r.type}: ${r.cnt} total, ${r.needs_repair} need repair`));

// Check wallet_cards category distribution
const [wcCatDistro] = await conn.query(`
  SELECT documentCategory, COUNT(*) as cnt
  FROM wallet_cards 
  GROUP BY documentCategory ORDER BY cnt DESC
`);
console.log("\n=== wallet_cards category distribution ===");
wcCatDistro.forEach(r => console.log(`  ${r.documentCategory || 'NULL'}: ${r.cnt}`));

await conn.end();
