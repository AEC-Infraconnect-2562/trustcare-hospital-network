import { getDb } from "./db";
import { users, hospitals, departments, userRoles } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

// Demo users for each systemRole
export const DEMO_USERS = [
  { openId: "demo-sysadmin-001", name: "นพ.สมชาย ระบบดี", email: "somchai@trustcare.th", role: "admin" as const, systemRole: "system_admin" as const, hospitalId: null, thaiId: "1100100000001", phone: "081-000-0001" },
  { openId: "demo-hospadmin-001", name: "นางวิภา บริหารเก่ง", email: "wipa@bkk-hospital.th", role: "admin" as const, systemRole: "hospital_admin" as const, hospitalId: 1, thaiId: "1100100000002", phone: "081-000-0002" },
  { openId: "demo-doctor-001", name: "นพ.ธนวัฒน์ รักษาดี", email: "thanawat@bkk-hospital.th", role: "user" as const, systemRole: "doctor" as const, hospitalId: 1, thaiId: "1100100000003", phone: "081-000-0003" },
  { openId: "demo-doctor-002", name: "พญ.สุภาพร ใจดี", email: "supaporn@cm-hospital.th", role: "user" as const, systemRole: "doctor" as const, hospitalId: 2, thaiId: "1100100000004", phone: "081-000-0004" },
  { openId: "demo-nurse-001", name: "นางสาวพิมพ์ใจ ดูแลดี", email: "pimjai@bkk-hospital.th", role: "user" as const, systemRole: "nurse" as const, hospitalId: 1, thaiId: "1100100000005", phone: "081-000-0005" },
  { openId: "demo-nurse-002", name: "นายอนุชา ช่วยเหลือ", email: "anucha@cm-hospital.th", role: "user" as const, systemRole: "nurse" as const, hospitalId: 2, thaiId: "1100100000006", phone: "081-000-0006" },
  { openId: "demo-engineer-001", name: "นายปิยะ เชื่อมต่อดี", email: "piya@trustcare.th", role: "user" as const, systemRole: "integration_engineer" as const, hospitalId: null, thaiId: "1100100000007", phone: "081-000-0007" },
  { openId: "demo-patient-001", name: "นายสมศักดิ์ สุขภาพดี", email: "somsak@gmail.com", role: "user" as const, systemRole: "patient" as const, hospitalId: null, thaiId: "1100500123456", phone: "089-123-4567" },
  { openId: "demo-patient-002", name: "นางสาวนภา แข็งแรง", email: "napa@gmail.com", role: "user" as const, systemRole: "patient" as const, hospitalId: null, thaiId: "1100500234567", phone: "089-234-5678" },
  { openId: "demo-patient-003", name: "นายวิชัย ใส่ใจสุขภาพ", email: "wichai@gmail.com", role: "user" as const, systemRole: "patient" as const, hospitalId: null, thaiId: "1100500345678", phone: "089-345-6789" },
];

// Demo hospitals
const DEMO_HOSPITALS = [
  { id: 1, name: "โรงพยาบาล Trustcare กรุงเทพฯ", code: "TC-BKK", province: "กรุงเทพมหานคร", address: "123 ถ.สุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110", phone: "02-123-4567", email: "info@bkk.trustcare.th", status: "active" as const },
  { id: 2, name: "โรงพยาบาล Trustcare เชียงใหม่", code: "TC-CM", province: "เชียงใหม่", address: "456 ถ.ห้วยแก้ว ต.สุเทพ อ.เมือง เชียงใหม่ 50200", phone: "053-123-456", email: "info@cm.trustcare.th", status: "active" as const },
  { id: 3, name: "โรงพยาบาล Trustcare ภูเก็ต", code: "TC-PKT", province: "ภูเก็ต", address: "789 ถ.เทพกระษัตรี ต.รัษฎา อ.เมือง ภูเก็ต 83000", phone: "076-123-456", email: "info@pkt.trustcare.th", status: "active" as const },
];

// Demo departments
const DEMO_DEPARTMENTS = [
  { hospitalId: 1, name: "อายุรกรรม", code: "MED" },
  { hospitalId: 1, name: "ศัลยกรรม", code: "SUR" },
  { hospitalId: 1, name: "กุมารเวชกรรม", code: "PED" },
  { hospitalId: 2, name: "อายุรกรรม", code: "MED" },
  { hospitalId: 2, name: "สูตินรีเวชกรรม", code: "OBG" },
  { hospitalId: 3, name: "เวชศาสตร์ฉุกเฉิน", code: "ER" },
  { hospitalId: 3, name: "อายุรกรรม", code: "MED" },
];

export async function seedDatabase() {
  const db = await getDb();
  if (!db) { console.error("[Seed] No database connection"); return; }
  console.log("[Seed] Starting database seeding...");

  // 1. Seed Hospitals
  for (const h of DEMO_HOSPITALS) {
    try {
      await db.insert(hospitals).values(h).onDuplicateKeyUpdate({ set: { name: h.name, status: "active" } });
    } catch (e) { console.log(`[Seed] Hospital ${h.code} already exists`); }
  }
  console.log("[Seed] Hospitals seeded");

  // 2. Seed Departments
  for (const d of DEMO_DEPARTMENTS) {
    try {
      await db.insert(departments).values(d).onDuplicateKeyUpdate({ set: { name: d.name } });
    } catch (e) { console.log(`[Seed] Department ${d.code} already exists`); }
  }
  console.log("[Seed] Departments seeded");

  // 3. Seed Users
  for (const u of DEMO_USERS) {
    await db.insert(users).values({
      openId: u.openId,
      name: u.name,
      email: u.email,
      role: u.role,
      systemRole: u.systemRole,
      hospitalId: u.hospitalId,
      thaiId: u.thaiId,
      phone: u.phone,
      loginMethod: "demo",
      isActive: true,
      lastSignedIn: new Date(),
    }).onDuplicateKeyUpdate({
      set: {
        name: u.name,
        email: u.email,
        role: u.role,
        systemRole: u.systemRole,
        hospitalId: u.hospitalId,
        thaiId: u.thaiId,
        phone: u.phone,
        isActive: true,
      },
    });
  }
  console.log("[Seed] Users seeded");

  // 4. Assign additional roles (Maker/Checker) to specific users
  // Nurse พิมพ์ใจ gets issuer_maker (can draft/create credential requests)
  // Doctor ธนวัฒน์ gets issuer_checker (can approve/reject credential requests)
  // Nurse อนุชา gets issuer_maker (can draft credentials at CM hospital)
  // Doctor สุภาพร gets issuer_checker (can approve at CM hospital)
  const additionalRoleAssignments = [
    { openId: "demo-nurse-001", role: "issuer_maker", scope: "hospital:1" },
    { openId: "demo-doctor-001", role: "issuer_checker", scope: "hospital:1" },
    { openId: "demo-nurse-002", role: "issuer_maker", scope: "hospital:2" },
    { openId: "demo-doctor-002", role: "issuer_checker", scope: "hospital:2" },
  ];

  for (const assignment of additionalRoleAssignments) {
    // Find user by openId
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.openId, assignment.openId));
    if (!user) continue;

    // Check if role already exists
    const existing = await db.select().from(userRoles)
      .where(and(eq(userRoles.userId, user.id), eq(userRoles.role, assignment.role)));
    if (existing.length > 0) continue;

    await db.insert(userRoles).values({
      userId: user.id,
      role: assignment.role,
      scope: assignment.scope,
      isActive: true,
    });
  }
  console.log("[Seed] Additional roles (Maker/Checker) assigned");
  console.log("[Seed] Database seeding complete!");
}
