import * as db from '../server/db';
import { getDb } from '../server/db';

async function main() {
  const dbConn = await getDb();
  const userRows: any = await dbConn.execute("SELECT id FROM users WHERE email = 'wichai@gmail.com'");
  const userId = userRows[0][0].id;
  console.log("userId:", userId);
  
  const shlRows = await db.listSmartHealthLinks({ patientId: userId });
  console.log("SHL count:", shlRows.length);
  
  for (const shl of shlRows) {
    for (const [k, v] of Object.entries(shl)) {
      if (v && typeof v === 'object' && !(v instanceof Date)) {
        const str = JSON.stringify(v);
        if (str.includes('hash') || str.includes('token') || str.includes('url')) {
          console.log(`SHL[${shl.id}].${k} is OBJECT:`, str.substring(0, 300));
        }
      }
    }
  }
  
  // Also check the detail view
  if (shlRows.length > 0) {
    const shl = shlRows[0];
    const detail = await db.getShlById(shl.id);
    if (detail) {
      for (const [k, v] of Object.entries(detail)) {
        if (v && typeof v === 'object' && !(v instanceof Date)) {
          const str = JSON.stringify(v);
          if (str.includes('hash') || str.includes('token') || str.includes('url')) {
            console.log(`Detail[${detail.id}].${k} is OBJECT:`, str.substring(0, 300));
          }
        }
      }
    }
    // Check files
    const files = await db.listShlFiles(shl.id);
    console.log('Files count:', files.length);
    for (const f of files) {
      for (const [k, v] of Object.entries(f)) {
        if (v && typeof v === 'object' && !(v instanceof Date)) {
          console.log(`File[${f.id}].${k} is OBJECT:`, JSON.stringify(v).substring(0, 200));
        }
      }
    }
    // Check what the frontend would see from the SHL list
    console.log('\n--- SHL list fields for first record ---');
    const s = shlRows[0] as any;
    console.log('manifestUrl type:', typeof s.manifestUrl, String(s.manifestUrl).substring(0, 100));
    console.log('qrPayload type:', typeof s.qrPayload, String(s.qrPayload).substring(0, 100));
    console.log('viewerUrl type:', typeof s.viewerUrl, String(s.viewerUrl).substring(0, 100));
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
