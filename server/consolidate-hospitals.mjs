/**
 * Hospital Consolidation Migration Script
 * 
 * Problem: Two seed sources created 6 hospitals instead of 3.
 * - Old codes: TC-BKK (id=1), TC-CM (id=2), TC-PKT (id=3)
 * - New codes: TCC (id=4), TCP (id=8), TCM (id=9)
 * 
 * Resolution:
 * 1. Migrate users from old hospital IDs to new ones
 * 2. Migrate departments from old hospital IDs to new ones
 * 3. Fix TAO trusted issuers/verifiers (set hospitalId to NULL — they're external orgs)
 * 4. Delete old hospital rows
 * 5. Clean up duplicate departments
 */

import mysql from 'mysql2/promise';

const MAPPING = {
  // old_id → new_id
  1: 4,  // TC-BKK → TCC (Bangkok/Central)
  2: 9,  // TC-CM → TCM (Chiang Mai)
  3: 8,  // TC-PKT → TCP (Phuket)
};

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  console.log("[Consolidate] Connected to database");

  // 1. Migrate users
  for (const [oldId, newId] of Object.entries(MAPPING)) {
    const [result] = await conn.execute(
      `UPDATE users SET hospitalId = ? WHERE hospitalId = ?`,
      [newId, oldId]
    );
    console.log(`[Consolidate] Users: hospitalId ${oldId} → ${newId}: ${result.affectedRows} rows`);
  }

  // 2. Migrate departments (move to new hospital, but first check for duplicates)
  for (const [oldId, newId] of Object.entries(MAPPING)) {
    // Get departments on old hospital
    const [oldDepts] = await conn.execute(
      `SELECT id, name, code FROM departments WHERE hospitalId = ?`, [oldId]
    );
    
    for (const dept of oldDepts) {
      // Check if same department already exists on new hospital
      const [existing] = await conn.execute(
        `SELECT id FROM departments WHERE hospitalId = ? AND name = ?`, [newId, dept.name]
      );
      
      if (existing.length > 0) {
        // Delete duplicate
        await conn.execute(`DELETE FROM departments WHERE id = ?`, [dept.id]);
        console.log(`[Consolidate] Dept: deleted duplicate "${dept.name}" (id=${dept.id}) from old hospital ${oldId}`);
      } else {
        // Move to new hospital
        await conn.execute(`UPDATE departments SET hospitalId = ? WHERE id = ?`, [newId, dept.id]);
        console.log(`[Consolidate] Dept: moved "${dept.name}" (id=${dept.id}) from hospital ${oldId} → ${newId}`);
      }
    }
  }

  // 3. Fix TAO trusted issuers/verifiers — these are EXTERNAL orgs, not bound to TrustCare hospitals
  await conn.execute(`UPDATE tao_trusted_issuers SET hospitalId = NULL`);
  console.log("[Consolidate] TAO Issuers: set hospitalId = NULL (external organizations)");
  
  await conn.execute(`UPDATE tao_trusted_verifiers SET hospitalId = NULL WHERE hospitalId IS NOT NULL`);
  console.log("[Consolidate] TAO Verifiers: set hospitalId = NULL (external organizations)");

  // 4. Fix user_roles scope references (hospital:1 → hospital:4, etc.)
  for (const [oldId, newId] of Object.entries(MAPPING)) {
    await conn.execute(
      `UPDATE user_roles SET scope = ? WHERE scope = ?`,
      [`hospital:${newId}`, `hospital:${oldId}`]
    );
    console.log(`[Consolidate] user_roles: scope hospital:${oldId} → hospital:${newId}`);
  }

  // 5. Check for any remaining references to old hospital IDs before deletion
  const tables = ['credential_templates', 'integration_adapters', 'referrals', 'patient_identifiers'];
  for (const table of tables) {
    try {
      const [cols] = await conn.execute(`SHOW COLUMNS FROM ${table} LIKE '%hospitalId%'`);
      if (cols.length > 0) {
        const colName = cols[0].Field;
        for (const [oldId, newId] of Object.entries(MAPPING)) {
          const [result] = await conn.execute(
            `UPDATE ${table} SET ${colName} = ? WHERE ${colName} = ?`, [newId, oldId]
          );
          if (result.affectedRows > 0) {
            console.log(`[Consolidate] ${table}: ${colName} ${oldId} → ${newId}: ${result.affectedRows} rows`);
          }
        }
      }
    } catch (e) {
      // Table might not exist or column name different
    }
  }

  // 6. Delete old hospital rows
  for (const oldId of Object.keys(MAPPING)) {
    await conn.execute(`DELETE FROM hospitals WHERE id = ?`, [oldId]);
    console.log(`[Consolidate] Deleted old hospital id=${oldId}`);
  }

  // 7. Verify final state
  const [finalHospitals] = await conn.execute(`SELECT id, code, name, nameEn FROM hospitals ORDER BY id`);
  console.log("\n[Consolidate] Final hospitals:");
  console.table(finalHospitals);

  const [finalUsers] = await conn.execute(`SELECT COUNT(*) as cnt, hospitalId FROM users WHERE hospitalId IS NOT NULL GROUP BY hospitalId`);
  console.log("\n[Consolidate] Users per hospital:");
  console.table(finalUsers);

  await conn.end();
  console.log("\n[Consolidate] ✅ Hospital consolidation complete!");
}

main().catch(e => {
  console.error("[Consolidate] ERROR:", e);
  process.exit(1);
});
