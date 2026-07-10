import { getDb } from "./db";
import { users, hospitals, departments, userRoles, taoTrustedIssuers, taoTrustedVerifiers } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { TRUSTCARE_DEMO_HOSPITALS } from "./portability/seedData";

// ─── Canonical Hospital Mapping ────────────────────────────────────────────────
// Single source of truth: TRUSTCARE_DEMO_HOSPITALS from portability/seedData.ts
// TCC = TrustCare Central (Bangkok), TCP = TrustCare Phuket, TCM = TrustCare Chiang Mai
// The old codes (TC-BKK, TC-CM, TC-PKT) are DEPRECATED and must not be used.

// ─── Avatar URL Helper ─────────────────────────────────────────────────────────
// Per-user unique avatar URLs — each test user has a distinct AI-generated portrait
// matching their name, gender, ethnicity, and role
const USER_AVATAR_MAP: Record<string, string> = {
  "demo-sysadmin-001": "/seed-avatars/sysadmin_somchai_7aa02209.jpg",
  "demo-hospadmin-001": "/seed-avatars/hospadmin_wipa_aeeee791.jpg",
  "demo-doctor-001": "/seed-avatars/doctor_thanawat_f91f7278.jpg",
  "demo-nurse-001": "/seed-avatars/nurse_pimjai_ace1fd06.jpg",
  "demo-engineer-001": "/seed-avatars/engineer_piya_eb6aeff4.jpg",
  "demo-hospadmin-002": "/seed-avatars/hospadmin_weera_3eb0fed7.jpg",
  "demo-doctor-003": "/seed-avatars/doctor_panu_06e68e06.jpg",
  "demo-doctor-004": "/seed-avatars/doctor_napa_abd67502.jpg",
  "demo-nurse-003": "/seed-avatars/nurse_jan_ac93cf3a.jpg",
  "demo-hospadmin-003": "/seed-avatars/hospadmin_dao_2b841b65.jpg",
  "demo-doctor-002": "/seed-avatars/doctor_supaporn_8b7c6a8a.jpg",
  "demo-doctor-005": "/seed-avatars/doctor_kriangkrai_b6bcdefb.jpg",
  "demo-nurse-002": "/seed-avatars/nurse_anucha_e814499a.jpg",
  "demo-nurse-004": "/seed-avatars/nurse_prae_dd21c148.jpg",
  "demo-partner-siriraj-001": "/seed-avatars/doctor_prasit_2ed84c26.jpg",
  "demo-partner-bumrungrad-001": "/seed-avatars/doctor_sarah_chen_97f031b5.jpg",
  "demo-patient-001": "/seed-avatars/patient_somsak_a2e00e97.jpg",
  "demo-patient-002": "/seed-avatars/patient_malee_74d2ef04.jpg",
  "demo-patient-003": "/seed-avatars/patient_john_williams_b4e9e7f3.jpg",
};

// Fallback for any user not in the map (legacy behavior)
function staffAvatarUrl(systemRole: string, gender: "male" | "female"): string {
  if (systemRole === "nurse" && gender === "female") return "/seed-avatars/nurse_pimjai_ace1fd06.jpg";
  if (systemRole === "nurse" && gender === "male") return "/seed-avatars/nurse_anucha_e814499a.jpg";
  if (systemRole === "doctor" && gender === "female") return "/seed-avatars/doctor_napa_abd67502.jpg";
  if (systemRole === "doctor" && gender === "male") return "/seed-avatars/doctor_thanawat_f91f7278.jpg";
  if (gender === "female") return "/seed-avatars/hospadmin_wipa_aeeee791.jpg";
  return "/seed-avatars/sysadmin_somchai_7aa02209.jpg";
}

// Demo users for each systemRole
// hospitalId uses code-based lookup at seed time (resolved dynamically)
// NOTE: system_admin and integration_engineer now assigned to TCC as HQ
export const DEMO_USERS = [
  // ─── TCC (TrustCare Central, Bangkok) ─────────────────────────────────────
  { openId: "demo-sysadmin-001", name: "นพ.สมชาย ระบบดี", email: "somchai@trustcare.th", role: "admin" as const, systemRole: "system_admin" as const, hospitalCode: "TCC", thaiId: "1100100000001", phone: "081-000-0001", gender: "male" as const },
  { openId: "demo-hospadmin-001", name: "นางวิภา บริหารเก่ง", email: "wipa@trustcare-central.th", role: "admin" as const, systemRole: "hospital_admin" as const, hospitalCode: "TCC", thaiId: "1100100000002", phone: "081-000-0002", gender: "female" as const },
  { openId: "demo-doctor-001", name: "นพ.ธนวัฒน์ รักษาดี", email: "thanawat@trustcare-central.th", role: "user" as const, systemRole: "doctor" as const, hospitalCode: "TCC", thaiId: "1100100000003", phone: "081-000-0003", gender: "male" as const },
  { openId: "demo-nurse-001", name: "นางสาวพิมพ์ใจ ดูแลดี", email: "pimjai@trustcare-central.th", role: "user" as const, systemRole: "nurse" as const, hospitalCode: "TCC", thaiId: "1100100000005", phone: "081-000-0005", gender: "female" as const },
  { openId: "demo-engineer-001", name: "นายปิยะ เชื่อมต่อดี", email: "piya@trustcare.th", role: "user" as const, systemRole: "integration_engineer" as const, hospitalCode: "TCC", thaiId: "1100100000007", phone: "081-000-0007", gender: "male" as const },

  // ─── TCP (TrustCare Phuket International) ──────────────────────────────────
  { openId: "demo-hospadmin-002", name: "นายวีระ ภูเก็ตดี", email: "weera@trustcare-phuket.th", role: "admin" as const, systemRole: "hospital_admin" as const, hospitalCode: "TCP", thaiId: "1830100000001", phone: "076-000-0001", gender: "male" as const },
  { openId: "demo-doctor-003", name: "นพ.ภาณุ ทะเลใส", email: "panu@trustcare-phuket.th", role: "user" as const, systemRole: "doctor" as const, hospitalCode: "TCP", thaiId: "1830100000002", phone: "076-000-0002", gender: "male" as const },
  { openId: "demo-doctor-004", name: "พญ.นภา อันดามัน", email: "napa@trustcare-phuket.th", role: "user" as const, systemRole: "doctor" as const, hospitalCode: "TCP", thaiId: "1830100000003", phone: "076-000-0003", gender: "female" as const },
  { openId: "demo-nurse-003", name: "นางสาวจันทร์ ดูแลใจ", email: "jan@trustcare-phuket.th", role: "user" as const, systemRole: "nurse" as const, hospitalCode: "TCP", thaiId: "1830100000004", phone: "076-000-0004", gender: "female" as const },

  // ─── TCM (TrustCare Chiang Mai Cross-Border) ───────────────────────────────
  { openId: "demo-hospadmin-003", name: "นางสาวดาว เชียงใหม่ดี", email: "dao@trustcare-chiangmai.th", role: "admin" as const, systemRole: "hospital_admin" as const, hospitalCode: "TCM", thaiId: "1500100000001", phone: "053-000-0001", gender: "female" as const },
  { openId: "demo-doctor-002", name: "พญ.สุภาพร ใจดี", email: "supaporn@trustcare-chiangmai.th", role: "user" as const, systemRole: "doctor" as const, hospitalCode: "TCM", thaiId: "1100100000004", phone: "081-000-0004", gender: "female" as const },
  { openId: "demo-doctor-005", name: "นพ.เกรียงไกร ล้านนา", email: "kriangkrai@trustcare-chiangmai.th", role: "user" as const, systemRole: "doctor" as const, hospitalCode: "TCM", thaiId: "1500100000002", phone: "053-000-0002", gender: "male" as const },
  { openId: "demo-nurse-002", name: "นายอนุชา ช่วยเหลือ", email: "anucha@trustcare-chiangmai.th", role: "user" as const, systemRole: "nurse" as const, hospitalCode: "TCM", thaiId: "1100100000006", phone: "081-000-0006", gender: "male" as const },
  { openId: "demo-nurse-004", name: "นางสาวแพร ดอยสุเทพ", email: "prae@trustcare-chiangmai.th", role: "user" as const, systemRole: "nurse" as const, hospitalCode: "TCM", thaiId: "1500100000003", phone: "053-000-0003", gender: "female" as const },

  // ─── Partner Staff (External Hospitals — for cross-verification testing) ────
  // These use TCC as their hospitalCode for credential issuance but represent partner orgs
  { openId: "demo-partner-siriraj-001", name: "นพ.ประสิทธิ์ ศิริราชดี", email: "prasit@siriraj.or.th", role: "user" as const, systemRole: "doctor" as const, hospitalCode: "TCC", thaiId: "1100200000001", phone: "02-419-0001", gender: "male" as const },
  { openId: "demo-partner-bumrungrad-001", name: "Dr. Sarah Chen", email: "sarah.chen@bumrungrad.com", role: "user" as const, systemRole: "doctor" as const, hospitalCode: "TCC", thaiId: "1100200000002", phone: "02-066-0001", gender: "female" as const },

  // ─── Demo Patients — MUST match DEMO_PATIENT_MAPPING in portability/seedData.ts ─
  { openId: "demo-patient-001", name: "นายสมชาย ใจดี", email: "somsak@gmail.com", role: "user" as const, systemRole: "patient" as const, hospitalCode: "TCC", thaiId: "1100500123456", phone: "089-123-4567", gender: "male" as const },
  { openId: "demo-patient-002", name: "นางสาวมาลี วัฒนา", email: "napa@gmail.com", role: "user" as const, systemRole: "patient" as const, hospitalCode: "TCC", thaiId: "1100500234567", phone: "089-234-5678", gender: "female" as const },
  { openId: "demo-patient-003", name: "Mr. John Williams", email: "wichai@gmail.com", role: "user" as const, systemRole: "patient" as const, hospitalCode: "TCP", thaiId: "1100500345678", phone: "089-345-6789", gender: "male" as const },
];

function demoCredentialEntitlements(openId: string, systemRole: string) {
  if (systemRole === "patient") return { makerTypes: [], checkerTypes: [] };
  if (systemRole === "system_admin" || systemRole === "hospital_admin") return { makerTypes: ["*"], checkerTypes: ["*"] };
  if (openId.includes("nurse")) {
    return {
      makerTypes: ["patient_identity", "consent_receipt", "patient_summary", "medical_certificate", "prescription", "referral_vc", "discharge_summary", "shl_manifest"],
      checkerTypes: [],
    };
  }
  if (openId.includes("doctor") || openId.includes("partner")) {
    return {
      makerTypes: ["patient_summary", "medical_certificate", "prescription", "referral_vc", "shl_manifest"],
      checkerTypes: ["patient_summary", "medical_certificate", "prescription", "referral_vc", "discharge_summary", "lab_result", "diagnostic_report", "shl_manifest"],
    };
  }
  if (systemRole === "integration_engineer") {
    return { makerTypes: ["sync_receipt", "shl_manifest"], checkerTypes: [] };
  }
  return { makerTypes: [], checkerTypes: [] };
}

// Demo departments — uses hospital code for dynamic ID resolution
const DEMO_DEPARTMENTS = [
  { hospitalCode: "TCC", name: "อายุรกรรม", code: "MED" },
  { hospitalCode: "TCC", name: "ศัลยกรรม", code: "SUR" },
  { hospitalCode: "TCC", name: "กุมารเวชกรรม", code: "PED" },
  { hospitalCode: "TCC", name: "ระบบสารสนเทศ", code: "IT" },
  { hospitalCode: "TCM", name: "อายุรกรรม", code: "MED" },
  { hospitalCode: "TCM", name: "สูตินรีเวชกรรม", code: "OBG" },
  { hospitalCode: "TCM", name: "ศูนย์ข้ามแดน", code: "XBR" },
  { hospitalCode: "TCP", name: "เวชศาสตร์ฉุกเฉิน", code: "ER" },
  { hospitalCode: "TCP", name: "อายุรกรรม", code: "MED" },
  { hospitalCode: "TCP", name: "ศูนย์ผู้ป่วยต่างชาติ", code: "INTL" },
];

// TAO Trust Registry seed — external trusted issuers/verifiers (NOT TrustCare's own hospitals)
// These represent EXTERNAL organizations that TrustCare trusts for cross-verification
const TAO_TRUSTED_ISSUERS_SEED = [
  {
    did: "did:web:siriraj.or.th",
    name: "โรงพยาบาลศิริราช",
    nameEn: "Siriraj Hospital",
    organizationType: "hospital" as const,
    country: "THA",
    jurisdiction: "กรุงเทพมหานคร",
    trustLevel: "accredited" as const,
    accreditationBody: "สถาบันรับรองคุณภาพสถานพยาบาล (สรพ.)",
    accreditationId: "HA-SRR-2026-001",
    trustAnchor: "moph" as const,
    contactEmail: "vc-admin@siriraj.or.th",
    credentialTypesAllowed: ["patient_identity", "medical_certificate", "prescription", "lab_result", "referral_vc"],
    hospitalId: null, // External — not bound to TrustCare hospital
  },
  {
    did: "did:web:ramathibodi.mahidol.ac.th",
    name: "โรงพยาบาลรามาธิบดี",
    nameEn: "Ramathibodi Hospital",
    organizationType: "hospital" as const,
    country: "THA",
    jurisdiction: "กรุงเทพมหานคร",
    trustLevel: "accredited" as const,
    accreditationBody: "สถาบันรับรองคุณภาพสถานพยาบาล (สรพ.)",
    accreditationId: "HA-RMT-2026-002",
    trustAnchor: "moph" as const,
    contactEmail: "vc-admin@ramathibodi.mahidol.ac.th",
    credentialTypesAllowed: ["patient_identity", "medical_certificate", "prescription", "lab_result", "immunization"],
    hospitalId: null,
  },
  {
    did: "did:web:bumrungrad.com",
    name: "โรงพยาบาลบำรุงราษฎร์",
    nameEn: "Bumrungrad International Hospital",
    organizationType: "hospital" as const,
    country: "THA",
    jurisdiction: "กรุงเทพมหานคร",
    trustLevel: "accredited" as const,
    accreditationBody: "JCI (Joint Commission International)",
    accreditationId: "JCI-BMG-2026-003",
    trustAnchor: "gdhcn" as const,
    contactEmail: "vc-admin@bumrungrad.com",
    credentialTypesAllowed: ["patient_identity", "medical_certificate", "prescription", "lab_result", "travel_document_verification", "insurance_eligibility"],
    hospitalId: null,
  },
];

const TAO_TRUSTED_VERIFIERS_SEED = [
  {
    did: "did:web:siriraj.or.th",
    name: "โรงพยาบาลศิริราช",
    nameEn: "Siriraj Hospital",
    organizationType: "hospital" as const,
    country: "THA",
    trustLevel: "accredited" as const,
    credentialTypesAccepted: ["patient_identity", "referral_vc", "medical_certificate", "lab_result"],
    purposesAllowed: ["treatment", "referral"],
    trustAnchor: "moph" as const,
    contactEmail: "verify@siriraj.or.th",
    hospitalId: null,
  },
  {
    did: "did:web:ramathibodi.mahidol.ac.th",
    name: "โรงพยาบาลรามาธิบดี",
    nameEn: "Ramathibodi Hospital",
    organizationType: "hospital" as const,
    country: "THA",
    trustLevel: "accredited" as const,
    credentialTypesAccepted: ["patient_identity", "referral_vc", "medical_certificate", "lab_result"],
    purposesAllowed: ["treatment", "referral", "research"],
    trustAnchor: "moph" as const,
    contactEmail: "verify@ramathibodi.mahidol.ac.th",
    hospitalId: null,
  },
  {
    did: "did:web:bumrungrad.com",
    name: "โรงพยาบาลบำรุงราษฎร์",
    nameEn: "Bumrungrad International Hospital",
    organizationType: "hospital" as const,
    country: "THA",
    trustLevel: "accredited" as const,
    credentialTypesAccepted: ["patient_identity", "medical_certificate", "insurance_eligibility", "travel_document_verification"],
    purposesAllowed: ["treatment", "insurance", "travel"],
    trustAnchor: "gdhcn" as const,
    contactEmail: "verify@bumrungrad.com",
    hospitalId: null,
  },
  {
    did: "did:web:nhso.go.th",
    name: "สำนักงานหลักประกันสุขภาพแห่งชาติ (สปสช.)",
    nameEn: "NHSO",
    organizationType: "government" as const,
    country: "THA",
    trustLevel: "accredited" as const,
    credentialTypesAccepted: ["insurance_eligibility", "claim_package", "patient_identity"],
    purposesAllowed: ["insurance", "claim"],
    trustAnchor: "nhso" as const,
    contactEmail: "vc-verify@nhso.go.th",
    hospitalId: null,
  },
];

export async function seedDatabase() {
  const db = await getDb();
  if (!db) { console.error("[Seed] No database connection"); return; }
  console.log("[Seed] Starting database seeding...");

  // ─── 1. Seed Hospitals (using canonical TRUSTCARE_DEMO_HOSPITALS) ───────────
  // This uses the SAME source as portability/reseed.ts to prevent duplicates
  const hospitalIdMap = new Map<string, number>();

  for (const h of TRUSTCARE_DEMO_HOSPITALS) {
    await db.insert(hospitals).values({
      name: h.nameTh,
      nameEn: h.nameEn,
      code: h.code,
      address: h.addressTh,
      phone: h.phone,
      email: `info@${h.code.toLowerCase()}.trustcare.th`,
      status: "active",
    } as any).onDuplicateKeyUpdate({
      set: { name: h.nameTh, nameEn: h.nameEn, status: "active" } as any,
    });
    // Resolve the actual DB ID
    const [row] = await db.select({ id: hospitals.id }).from(hospitals).where(eq(hospitals.code, h.code)).limit(1);
    if (row) hospitalIdMap.set(h.code, row.id);
  }
  console.log("[Seed] Hospitals seeded (TCC, TCP, TCM)");

  // ─── 2. Seed Departments ────────────────────────────────────────────────────
  for (const d of DEMO_DEPARTMENTS) {
    const hospitalId = hospitalIdMap.get(d.hospitalCode);
    if (!hospitalId) continue;
    await db.insert(departments).values({
      hospitalId,
      name: d.name,
      code: d.code,
    }).onDuplicateKeyUpdate({ set: { name: d.name } });
  }
  console.log("[Seed] Departments seeded");

  // ─── 3. Seed Users (with avatarUrl) ─────────────────────────────────────────
  for (const u of DEMO_USERS) {
    const hospitalId = u.hospitalCode ? (hospitalIdMap.get(u.hospitalCode) ?? null) : null;
    const avatar = USER_AVATAR_MAP[u.openId]
      ?? (u.systemRole === "patient"
        ? (u.gender === "female" ? "/seed-avatars/patient_malee_74d2ef04.jpg" : "/seed-avatars/patient_somsak_a2e00e97.jpg")
        : staffAvatarUrl(u.systemRole, u.gender));

    await db.insert(users).values({
      openId: u.openId,
      name: u.name,
      email: u.email,
      role: u.role,
      systemRole: u.systemRole,
      hospitalId,
      thaiId: u.thaiId,
      phone: u.phone,
      avatarUrl: avatar,
      credentialEntitlements: demoCredentialEntitlements(u.openId, u.systemRole),
      loginMethod: "demo",
      isActive: true,
      lastSignedIn: new Date(),
    }).onDuplicateKeyUpdate({
      set: {
        name: u.name,
        email: u.email,
        role: u.role,
        systemRole: u.systemRole,
        hospitalId,
        thaiId: u.thaiId,
        phone: u.phone,
        avatarUrl: avatar,
        credentialEntitlements: demoCredentialEntitlements(u.openId, u.systemRole),
        isActive: true,
      },
    });
  }
  console.log("[Seed] Users seeded (all hospitals + partners)");

  // ─── 4. Assign additional roles (Maker/Checker) ─────────────────────────────
  const tccId = hospitalIdMap.get("TCC");
  const tcmId = hospitalIdMap.get("TCM");
  const tcpId = hospitalIdMap.get("TCP");

  const additionalRoleAssignments = [
    // TCC
    { openId: "demo-nurse-001", role: "issuer_maker", scope: tccId ? `hospital:${tccId}` : "hospital:TCC" },
    { openId: "demo-doctor-001", role: "issuer_checker", scope: tccId ? `hospital:${tccId}` : "hospital:TCC" },
    // TCM
    { openId: "demo-nurse-002", role: "issuer_maker", scope: tcmId ? `hospital:${tcmId}` : "hospital:TCM" },
    { openId: "demo-nurse-004", role: "issuer_maker", scope: tcmId ? `hospital:${tcmId}` : "hospital:TCM" },
    { openId: "demo-doctor-002", role: "issuer_checker", scope: tcmId ? `hospital:${tcmId}` : "hospital:TCM" },
    { openId: "demo-doctor-005", role: "issuer_checker", scope: tcmId ? `hospital:${tcmId}` : "hospital:TCM" },
    // TCP
    { openId: "demo-nurse-003", role: "issuer_maker", scope: tcpId ? `hospital:${tcpId}` : "hospital:TCP" },
    { openId: "demo-doctor-003", role: "issuer_checker", scope: tcpId ? `hospital:${tcpId}` : "hospital:TCP" },
    { openId: "demo-doctor-004", role: "issuer_checker", scope: tcpId ? `hospital:${tcpId}` : "hospital:TCP" },
  ];

  for (const assignment of additionalRoleAssignments) {
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.openId, assignment.openId));
    if (!user) continue;

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
  console.log("[Seed] Additional roles (Maker/Checker) assigned for all hospitals");

  // ─── 5. Seed TAO Trust Registry (External Trusted Issuers/Verifiers) ────────
  for (const issuer of TAO_TRUSTED_ISSUERS_SEED) {
    await db.insert(taoTrustedIssuers).values(issuer as any)
      .onDuplicateKeyUpdate({ set: { name: issuer.name, trustLevel: issuer.trustLevel, isActive: true } as any });
  }
  console.log("[Seed] TAO Trusted Issuers seeded (external: Siriraj, Ramathibodi, Bumrungrad)");

  for (const verifier of TAO_TRUSTED_VERIFIERS_SEED) {
    await db.insert(taoTrustedVerifiers).values(verifier as any)
      .onDuplicateKeyUpdate({ set: { name: verifier.name, trustLevel: verifier.trustLevel, isActive: true } as any });
  }
  console.log("[Seed] TAO Trusted Verifiers seeded (external: Siriraj, Ramathibodi, Bumrungrad, NHSO)");

  console.log("[Seed] Database seeding complete!");
}
