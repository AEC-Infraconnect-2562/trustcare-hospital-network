import * as db from '../server/db';
import { generateManifestDocuments } from '../server/portability/seedShlManifestDocuments';

async function main() {
  const allShls = await db.listSmartHealthLinks({});
  console.log('Total SHLs:', allShls.length);
  
  let fixedCount = 0;
  let alreadyGoodCount = 0;
  
  for (const shl of allShls) {
    const docs = await db.listShlManifestDocuments(shl.id, shl.currentManifestVersion ?? 1);
    
    // Check if any doc has object-type fields in objectLinksJson
    let needsFix = false;
    for (const d of docs) {
      const objLinks = d.objectLinksJson as any;
      if (objLinks) {
        for (const v of Object.values(objLinks)) {
          if (v && typeof v === 'object') {
            needsFix = true;
            break;
          }
        }
      }
      if (needsFix) break;
    }
    
    if (needsFix) {
      // Delete and re-seed with correct format
      await db.deleteShlManifestDocuments(shl.id);
      const newDocs = generateManifestDocuments(shl as any);
      await db.bulkInsertShlManifestDocuments(newDocs);
      fixedCount++;
    } else {
      alreadyGoodCount++;
    }
  }
  
  console.log('Fixed:', fixedCount, 'SHLs');
  console.log('Already good:', alreadyGoodCount, 'SHLs');
  console.log('Total processed:', fixedCount + alreadyGoodCount);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
