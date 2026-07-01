/**
 * Generate DiceBear avatar URLs for all demo users and seed patients.
 * Uses DiceBear's "notionists" style for a professional, diverse look.
 * Avatar URLs are deterministic based on user openId (no file upload needed).
 */
import { getDb } from "./server/db.ts";
import { sql } from "drizzle-orm";

// DiceBear API - generates unique SVG avatars based on seed string
// Using "notionists" style for professional look
function generateAvatarUrl(seed, gender) {
  // Use different styles based on role/gender for variety
  const style = "notionists";
  const params = new URLSearchParams({
    seed: seed,
    backgroundColor: "b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf",
    backgroundType: "gradientLinear",
  });
  return `https://api.dicebear.com/9.x/${style}/svg?${params.toString()}`;
}

// Map of demo users with their gender hints based on Thai prefixes
function inferGender(name) {
  if (name.startsWith("นพ.") || name.startsWith("นาย") || name.startsWith("Mr.")) return "male";
  if (name.startsWith("พญ.") || name.startsWith("นาง") || name.startsWith("Ms.") || name.startsWith("Mrs.")) return "female";
  return "neutral";
}

async function main() {
  const db = await getDb();
  if (!db) { console.error("No DB"); process.exit(1); }

  // Get all users that need avatars (demo users + seed patients)
  const [allUsers] = await db.execute(sql`
    SELECT id, openId, name, systemRole 
    FROM users 
    WHERE (loginMethod = 'demo' OR openId LIKE 'seed-patient-%')
    AND (avatarUrl IS NULL OR avatarUrl = '')
    ORDER BY id
  `);

  console.log(`Found ${allUsers.length} users without avatars`);

  let updated = 0;
  for (const user of allUsers) {
    const gender = inferGender(user.name || "");
    const avatarUrl = generateAvatarUrl(user.openId, gender);
    
    await db.execute(sql`
      UPDATE users SET avatarUrl = ${avatarUrl} WHERE id = ${user.id}
    `);
    updated++;
  }

  console.log(`Updated ${updated} user avatars`);
  
  // Verify
  const [check] = await db.execute(sql`
    SELECT COUNT(*) as cnt FROM users 
    WHERE (loginMethod = 'demo' OR openId LIKE 'seed-patient-%')
    AND avatarUrl IS NOT NULL AND avatarUrl != ''
  `);
  console.log(`Users with avatars: ${check[0]?.cnt}`);
  
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
