import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';

const config = JSON.parse(readFileSync('.project-config.json', 'utf-8'));
const dbUrl = config.env_vars.DATABASE_URL;
const conn = await mysql.createConnection(dbUrl);

console.log("=== issued_credentials: null credentialData by type ===");
const [rows] = await conn.query(`
  SELECT \`type\`, COUNT(*) as total, 
    SUM(CASE WHEN credentialData IS NULL THEN 1 ELSE 0 END) as null_count
  FROM issued_credentials 
  GROUP BY \`type\` 
  ORDER BY null_count DESC
`);
console.table(rows);

console.log("\n=== Total summary ===");
const [summary] = await conn.query(`
  SELECT COUNT(*) as total, 
    SUM(CASE WHEN credentialData IS NULL THEN 1 ELSE 0 END) as null_cred_data,
    SUM(CASE WHEN sdJwtVc IS NULL THEN 1 ELSE 0 END) as null_sd_jwt
  FROM issued_credentials
`);
console.table(summary);

console.log("\n=== issued_presentations: null presentationData ===");
const [vpRows] = await conn.query(`
  SELECT COUNT(*) as total,
    SUM(CASE WHEN presentationData IS NULL THEN 1 ELSE 0 END) as null_pres_data
  FROM issued_presentations
`);
console.table(vpRows);

console.log("\n=== Sample null credentialData records ===");
const [samples] = await conn.query(`
  SELECT credentialId, \`type\`, subjectId, issuerHospitalId, issuedAt
  FROM issued_credentials 
  WHERE credentialData IS NULL 
  LIMIT 10
`);
console.table(samples);

await conn.end();
