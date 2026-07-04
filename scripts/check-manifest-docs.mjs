import { createConnection } from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("No DATABASE_URL"); process.exit(1); }

const url = new URL(DATABASE_URL);
const conn = await createConnection({
  host: url.hostname,
  port: parseInt(url.port || '3306'),
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1),
  ssl: { rejectUnauthorized: false },
});

const [rows] = await conn.query('SELECT id, shlId, manifestVersion, documentId, title, status FROM shl_manifest_documents WHERE shlId = 60043');
console.log(`Rows for SHL 60043: ${rows.length}`);
if (rows.length > 0) console.log(JSON.stringify(rows[0], null, 2));

const [countRows] = await conn.query('SELECT COUNT(*) as total FROM shl_manifest_documents');
console.log(`Total rows: ${countRows[0].total}`);

const [distinctShl] = await conn.query('SELECT DISTINCT shlId FROM shl_manifest_documents ORDER BY shlId LIMIT 10');
console.log('Distinct SHL IDs:', distinctShl.map(r => r.shlId));

await conn.end();
