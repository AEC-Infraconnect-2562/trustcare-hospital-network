import { createPool } from 'mysql2/promise';
import { readFileSync } from 'fs';

const config = JSON.parse(readFileSync('./.project-config.json', 'utf8'));
const dbUrl = config.env_vars.DATABASE_URL;

async function main() {
  const pool = createPool(dbUrl + '&connectionLimit=1');
  
  // Check a patient_summary credential
  const [rows] = await pool.query("SELECT type, credentialData FROM issued_credentials LIMIT 5");
  
  for (const row of rows) {
    const data = typeof row.credentialData === 'string' ? JSON.parse(row.credentialData) : row.credentialData;
    console.log(`\n=== ${row.type} ===`);
    console.log('Top-level keys:', Object.keys(data));
    console.log('issuer:', JSON.stringify(data.issuer));
    console.log('trustcare keys:', data.trustcare ? Object.keys(data.trustcare) : 'MISSING');
    console.log('credentialSubject keys:', Object.keys(data.credentialSubject || {}));
    console.log('has documentReference:', !!(data.credentialSubject && data.credentialSubject.documentReference));
    console.log('has humanDocument:', !!(data.credentialSubject && data.credentialSubject.humanDocument));
    console.log('credentialStatus type:', data.credentialStatus ? data.credentialStatus.type : 'MISSING');
  }
  
  // Count null credentialData
  const [nullCount] = await pool.query("SELECT COUNT(*) as cnt FROM issued_credentials WHERE credentialData IS NULL");
  console.log('\n\nNull credentialData count:', nullCount[0].cnt);
  
  // Count total
  const [totalCount] = await pool.query("SELECT COUNT(*) as cnt FROM issued_credentials");
  console.log('Total credentials:', totalCount[0].cnt);
  
  await pool.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
