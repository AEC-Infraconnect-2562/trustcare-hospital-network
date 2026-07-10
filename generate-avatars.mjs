/**
 * Generate realistic avatar URLs for all demo users and seed patients.
 * Uses AI-generated realistic photos shipped in /seed-avatars/.
 * Avatar selection is based on role and gender.
 */
import { getDb } from "./server/db.ts";
import { sql } from "drizzle-orm";

// Realistic avatar photos (400x400 JPEG, ~18KB each)
const AVATAR_PHOTOS = {
  male: "/seed-avatars/patient_somsak_a2e00e97.jpg",
  female: "/seed-avatars/patient_malee_74d2ef04.jpg",
  doctorMale: "/seed-avatars/doctor_thanawat_f91f7278.jpg",
  doctorFemale: "/seed-avatars/doctor_napa_abd67502.jpg",
  nurse: "/seed-avatars/nurse_pimjai_ace1fd06.jpg",
  pharmacist: "/seed-avatars/engineer_piya_eb6aeff4.jpg",
  radiologist: "/seed-avatars/doctor_kriangkrai_b6bcdefb.jpg",
  medTech: "/seed-avatars/doctor_prasit_2ed84c26.jpg",
};

// Map of demo users with their gender hints based on Thai prefixes
function inferGender(name) {
  if (name.startsWith("นพ.") || name.startsWith("นาย") || name.startsWith("Mr.")) return "male";
  if (name.startsWith("พญ.") || name.startsWith("นาง") || name.startsWith("Ms.") || name.startsWith("Mrs.")) return "female";
  return "male"; // default
}

function selectAvatar(name, systemRole) {
  const gender = inferGender(name);
  // Doctors
  if (systemRole === "doctor" || name.includes("นพ.") || name.includes("พญ.")) {
    return gender === "female" ? AVATAR_PHOTOS.doctorFemale : AVATAR_PHOTOS.doctorMale;
  }
  // Nurses
  if (systemRole === "nurse" || name.includes("พยาบาล")) {
    return AVATAR_PHOTOS.nurse;
  }
  // Pharmacists
  if (name.includes("เภสัช")) {
    return AVATAR_PHOTOS.pharmacist;
  }
  // Admin (use doctor photo for professional look)
  if (systemRole === "system_admin" || systemRole === "hospital_admin") {
    return gender === "female" ? AVATAR_PHOTOS.doctorFemale : AVATAR_PHOTOS.doctorMale;
  }
  // Default: patient photos based on gender
  return gender === "female" ? AVATAR_PHOTOS.female : AVATAR_PHOTOS.male;
}

async function main() {
  const db = await getDb();
  if (!db) { console.error("No DB"); process.exit(1); }

  // Get all users that need avatar updates (demo users + seed patients with dicebear or no avatar)
  const [allUsers] = await db.execute(sql`
    SELECT id, openId, name, systemRole 
    FROM users 
    WHERE (loginMethod = 'demo' OR openId LIKE 'seed-patient-%')
    AND (avatarUrl IS NULL OR avatarUrl = '' OR avatarUrl LIKE '%dicebear%')
    ORDER BY id
  `);

  console.log(`Found ${allUsers.length} users needing avatar update`);

  let updated = 0;
  for (const user of allUsers) {
    const avatarUrl = selectAvatar(user.name || "", user.systemRole || "");
    
    await db.execute(sql`
      UPDATE users SET avatarUrl = ${avatarUrl} WHERE id = ${user.id}
    `);
    updated++;
  }

  console.log(`Updated ${updated} user avatars to realistic photos`);
  
  // Verify
  const [check] = await db.execute(sql`
    SELECT COUNT(*) as cnt FROM users 
    WHERE (loginMethod = 'demo' OR openId LIKE 'seed-patient-%')
    AND avatarUrl IS NOT NULL AND avatarUrl != '' AND avatarUrl NOT LIKE '%dicebear%'
  `);
  console.log(`Users with realistic avatars: ${check[0]?.cnt}`);
  
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
