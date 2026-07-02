/**
 * Generate realistic avatar URLs for all demo users and seed patients.
 * Uses AI-generated realistic photos stored in /manus-storage/.
 * Avatar selection is based on role and gender.
 */
import { getDb } from "./server/db.ts";
import { sql } from "drizzle-orm";

// Realistic avatar photos (400x400 JPEG, ~18KB each)
const AVATAR_PHOTOS = {
  male: "/manus-storage/patient_male_realistic_opt_e9b1630b.jpg",
  female: "/manus-storage/patient_female_realistic_opt_d0edb245.jpg",
  doctorMale: "/manus-storage/doctor_male_realistic_opt_b09f1058.jpg",
  doctorFemale: "/manus-storage/doctor_female_realistic_opt_56d94f1d.jpg",
  nurse: "/manus-storage/nurse_female_realistic_opt_d0e35459.jpg",
  pharmacist: "/manus-storage/pharmacist_male_realistic_opt_2b3b0f56.jpg",
  radiologist: "/manus-storage/radiologist_realistic_bd97425d.jpg",
  medTech: "/manus-storage/med_tech_realistic_78575c20.jpg",
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
