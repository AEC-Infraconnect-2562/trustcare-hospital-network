import * as db from '../server/db';
import { getDb } from '../server/db';

async function main() {
  const dbConn = await getDb();
  if (!dbConn) { console.log("No DB"); return; }
  const userRows = await dbConn.execute("SELECT id FROM users WHERE email = 'wichai@gmail.com'");
  const userId = (userRows as any)[0][0].id;
  console.log('User ID:', userId);

  const shlRows = await db.listSmartHealthLinks({ patientId: userId });
  console.log('SHL count:', shlRows.length);

  if (shlRows.length > 0) {
    const first = shlRows[0];
    console.log('\n--- First SHL row (list view) ---');
    for (const [key, val] of Object.entries(first)) {
      if (val !== null && val !== undefined && typeof val === 'object' && !(val instanceof Date)) {
        console.log(`OBJECT field [${key}]:`, JSON.stringify(val).substring(0, 120));
      }
    }

    const detail = await db.getShlById(first.id);
    if (detail) {
      console.log('\n--- Detail view ---');
      for (const [key, val] of Object.entries(detail)) {
        if (val !== null && val !== undefined && typeof val === 'object' && !(val instanceof Date)) {
          console.log(`OBJECT field [${key}]:`, JSON.stringify(val).substring(0, 120));
        }
      }
    }
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
