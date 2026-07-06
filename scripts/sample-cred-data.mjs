import mysql from 'mysql2/promise';
import { readFileSync, writeFileSync } from 'fs';

const config = JSON.parse(readFileSync('.project-config.json', 'utf-8'));
const dbUrl = config.env_vars.DATABASE_URL;
const conn = await mysql.createConnection(dbUrl);

// Sample one credentialData per type using subquery
const [types] = await conn.query(`SELECT DISTINCT \`type\` FROM issued_credentials ORDER BY \`type\``);
const rows = [];
for (const t of types) {
  const [r] = await conn.query(`SELECT \`type\`, credentialId, credentialData FROM issued_credentials WHERE \`type\` = ? LIMIT 1`, [t.type]);
  if (r.length > 0) rows.push(r[0]);
}

const samples = {};
for (const row of rows) {
  let data;
  try {
    data = typeof row.credentialData === 'string' ? JSON.parse(row.credentialData) : row.credentialData;
  } catch {
    data = { _raw: String(row.credentialData).substring(0, 200) };
  }
  samples[row.type] = {
    credentialId: row.credentialId,
    topLevelKeys: Object.keys(data),
    hasContext: !!data['@context'],
    hasType: !!data.type,
    hasIssuer: !!data.issuer,
    hasCredentialSubject: !!data.credentialSubject,
    hasCredentialStatus: !!data.credentialStatus,
    hasEvidence: !!data.evidence,
    hasTrustcare: !!data.trustcare,
    hasDocumentReference: !!data.credentialSubject?.documentReference,
    hasHumanDocument: !!data.credentialSubject?.humanDocument,
    issuerShape: data.issuer ? Object.keys(data.issuer) : null,
    credSubjectKeys: data.credentialSubject ? Object.keys(data.credentialSubject) : null,
  };
}

writeFileSync('scripts/credential-data-samples.json', JSON.stringify(samples, null, 2));
console.log("Saved to scripts/credential-data-samples.json");
console.log("\n=== Schema compliance summary ===");
console.table(Object.entries(samples).map(([type, s]) => ({
  type,
  hasContext: s.hasContext,
  hasType: s.hasType,
  hasIssuer: s.hasIssuer,
  hasCredSubject: s.hasCredentialSubject,
  hasDocRef: s.hasDocumentReference,
  hasHumanDoc: s.hasHumanDocument,
  hasEvidence: s.hasEvidence,
  hasTrustcare: s.hasTrustcare,
})));

// Also get one full sample for patient_summary
const [fullSample] = await conn.query(`
  SELECT credentialData FROM issued_credentials WHERE \`type\` = 'patient_summary' LIMIT 1
`);
if (fullSample.length > 0) {
  const data = typeof fullSample[0].credentialData === 'string' ? JSON.parse(fullSample[0].credentialData) : fullSample[0].credentialData;
  writeFileSync('scripts/sample-patient-summary-full.json', JSON.stringify(data, null, 2));
  console.log("\nFull patient_summary sample saved to scripts/sample-patient-summary-full.json");
}

await conn.end();
