import mysql from "mysql2/promise";
const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Check storageKey format matches vc/{hospital}/{patient}/{category}/{subcategory}/{documentType}/{credentialId}.jwt
const [rows] = await conn.query(`SELECT id, type, storageKey, documentCategory, documentSubcategory FROM issued_credentials LIMIT 10`);
const pattern = /^vc\/[a-z0-9-]+\/[a-z0-9-]+\/[a-z_]+\/[a-z_]+\/[a-z_]+\/[a-zA-Z0-9-]+\.jwt$/;
let valid = 0, invalid = 0;
rows.forEach(r => {
  if (pattern.test(r.storageKey)) { valid++; }
  else { invalid++; console.log(`  INVALID: id=${r.id} type=${r.type} key=${r.storageKey}`); }
});
console.log(`Sample 10: ${valid} valid, ${invalid} invalid storageKey format`);

// Check all 351
const [allRows] = await conn.query(`SELECT id, type, storageKey FROM issued_credentials`);
let allValid = 0, allInvalid = 0;
allRows.forEach(r => {
  if (pattern.test(r.storageKey)) { allValid++; }
  else { allInvalid++; }
});
console.log(`All ${allRows.length}: ${allValid} valid, ${allInvalid} invalid storageKey format`);
if (allInvalid > 0) {
  const invalids = allRows.filter(r => !pattern.test(r.storageKey)).slice(0, 5);
  invalids.forEach(r => console.log(`  INVALID: id=${r.id} type=${r.type} key=${r.storageKey}`));
}

await conn.end();
process.exit(0);
