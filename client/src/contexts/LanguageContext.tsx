import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type Language = "th" | "en";

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: "th",
  setLang: () => {},
  t: (key: string) => key,
});

const STORAGE_KEY = "trustcare_language";

// Translation dictionaries
const translations: Record<Language, Record<string, string>> = {
  th: {
    // Navigation & Layout
    "nav.dashboard": "แดชบอร์ด",
    "nav.executive_dashboard": "แดชบอร์ดผู้บริหาร",
    "nav.wallet": "กระเป๋าสุขภาพ",
    "nav.consent": "จัดการความยินยอม",
    "nav.shl": "ลิงก์แชร์สุขภาพ",
    "nav.referral": "ส่งต่อผู้ป่วย",
    "nav.cross_border": "ส่งต่อข้ามเครือข่าย",
    "nav.medical_tourist": "ผู้ป่วยต่างชาติ",
    "nav.issuer": "ออกใบรับรอง",
    "nav.verifier": "ตรวจสอบใบรับรอง",
    "nav.trust_registry": "ทะเบียนความน่าเชื่อถือ",
    "nav.claim_center": "ศูนย์เคลม",
    "nav.integration": "เชื่อมต่อระบบ HIS",
    "nav.portability": "Portability Layer",
    "nav.fhir_mapping": "แผนที่ข้อมูล FHIR",
    "nav.terminology": "จับคู่รหัสมาตรฐาน",
    "nav.audit": "บันทึกการเข้าถึง",
    "nav.settings": "ตั้งค่าระบบ",
    "nav.hospitals": "จัดการโรงพยาบาล",

    // Common
    "common.loading": "กำลังโหลด...",
    "common.save": "บันทึก",
    "common.cancel": "ยกเลิก",
    "common.confirm": "ยืนยัน",
    "common.delete": "ลบ",
    "common.edit": "แก้ไข",
    "common.search": "ค้นหา",
    "common.filter": "กรอง",
    "common.export": "ส่งออก",
    "common.download": "ดาวน์โหลด",
    "common.status": "สถานะ",
    "common.active": "ใช้งานได้",
    "common.inactive": "ไม่ใช้งาน",
    "common.expired": "หมดอายุ",
    "common.revoked": "ถูกเพิกถอน",
    "common.all": "ทั้งหมด",
    "common.online": "ออนไลน์",
    "common.offline": "ออฟไลน์",

    // Wallet
    "wallet.title": "กระเป๋าสุขภาพ",
    "wallet.subtitle": "Health Cards ทั้งหมด",
    "wallet.cards": "ใบ",
    "wallet.categories": "หมวดหมู่",
    "wallet.health_cards": "Health Cards",
    "wallet.superseded": "ประวัติ (Superseded)",
    "wallet.presentations": "การแสดงข้อมูล",
    "wallet.biometric_protected": "ปกป้องแล้ว",
    "wallet.setup_biometric": "ตั้งค่า Biometric",
    "wallet.generate_qr": "สร้าง VP QR",
    "wallet.confirm_qr": "ยืนยัน + QR",
    "wallet.share_selective": "แชร์ (Selective)",
    "wallet.no_cards": "ยังไม่มี Health Card ในกระเป๋า",
    "wallet.no_history": "ยังไม่มีประวัติการแสดงข้อมูล",
    "wallet.offline_qr": "แสดง QR จากแคช (Offline)",
    "wallet.no_cached_qr": "ไม่มี QR ที่แคชไว้ กรุณาเชื่อมต่ออินเทอร์เน็ตแล้วสร้าง QR ใหม่",

    // Dashboard
    "dashboard.title": "แดชบอร์ด",
    "dashboard.subtitle": "ภาพรวมเครือข่ายโรงพยาบาล Trustcare",
    "dashboard.hospitals": "โรงพยาบาลในเครือ",
    "dashboard.credentials": "ใบรับรองที่ออก",
    "dashboard.patients": "ผู้ป่วยในระบบ",
    "dashboard.referrals": "การส่งต่อ",
    "dashboard.recent_activity": "กิจกรรมล่าสุด",

    // Consent
    "consent.title": "จัดการความยินยอม",
    "consent.active": "ความยินยอมที่ใช้งาน",
    "consent.history": "ประวัติ",
    "consent.grant": "ให้ความยินยอม",
    "consent.revoke": "เพิกถอน",
    "consent.purpose": "วัตถุประสงค์",

    // Verifier
    "verifier.title": "ตรวจสอบใบรับรอง",
    "verifier.scan_qr": "สแกน QR",
    "verifier.paste_token": "วาง Token",
    "verifier.verify": "ตรวจสอบ",
    "verifier.valid": "ถูกต้อง",
    "verifier.invalid": "ไม่ถูกต้อง",
    "verifier.trust_level": "ระดับความน่าเชื่อถือ",

    // PDF Export
    "pdf.download_summary": "ดาวน์โหลด PDF",
    "pdf.clinical_summary": "สรุปข้อมูลทางคลินิก",
    "pdf.generating": "กำลังสร้าง PDF...",

    // Integration
    "integration.title": "Integration Adapter SDK",
    "integration.subtitle": "SDK สำหรับเชื่อมต่อระบบ HIS",
    "integration.download_sdk": "ดาวน์โหลด SDK",
    "integration.documentation": "เอกสารประกอบ",

    // Cross-border
    "crossborder.title": "เพิ่ม Partner Hospital",
    "crossborder.wizard_step1": "ข้อมูลโรงพยาบาล",
    "crossborder.wizard_step2": "Trust Credential",
    "crossborder.wizard_step3": "ทดสอบการเชื่อมต่อ",
    "crossborder.wizard_step4": "ยืนยันและเปิดใช้งาน",

    // Language
    "lang.switch": "เปลี่ยนภาษา",
    "lang.thai": "ไทย",
    "lang.english": "English",
  },
  en: {
    // Navigation & Layout
    "nav.dashboard": "Dashboard",
    "nav.executive_dashboard": "Executive Dashboard",
    "nav.wallet": "Health Wallet",
    "nav.consent": "Consent Management",
    "nav.shl": "Smart Health Links",
    "nav.referral": "Patient Referral",
    "nav.cross_border": "Cross-border Referral",
    "nav.medical_tourist": "International Patients",
    "nav.issuer": "Issue Credentials",
    "nav.verifier": "Verify Credentials",
    "nav.trust_registry": "Trust Registry",
    "nav.claim_center": "Claim Center",
    "nav.integration": "HIS Integration",
    "nav.portability": "Portability Layer",
    "nav.fhir_mapping": "FHIR Mapping",
    "nav.terminology": "Terminology Mapping",
    "nav.audit": "Audit Trail",
    "nav.settings": "Settings",
    "nav.hospitals": "Hospital Management",

    // Common
    "common.loading": "Loading...",
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.confirm": "Confirm",
    "common.delete": "Delete",
    "common.edit": "Edit",
    "common.search": "Search",
    "common.filter": "Filter",
    "common.export": "Export",
    "common.download": "Download",
    "common.status": "Status",
    "common.active": "Active",
    "common.inactive": "Inactive",
    "common.expired": "Expired",
    "common.revoked": "Revoked",
    "common.all": "All",
    "common.online": "Online",
    "common.offline": "Offline",

    // Wallet
    "wallet.title": "Health Wallet",
    "wallet.subtitle": "Total Health Cards",
    "wallet.cards": "cards",
    "wallet.categories": "categories",
    "wallet.health_cards": "Health Cards",
    "wallet.superseded": "History (Superseded)",
    "wallet.presentations": "Presentations",
    "wallet.biometric_protected": "Protected",
    "wallet.setup_biometric": "Setup Biometric",
    "wallet.generate_qr": "Generate VP QR",
    "wallet.confirm_qr": "Confirm + QR",
    "wallet.share_selective": "Share (Selective)",
    "wallet.no_cards": "No Health Cards in wallet yet",
    "wallet.no_history": "No presentation history yet",
    "wallet.offline_qr": "Showing cached QR (Offline)",
    "wallet.no_cached_qr": "No cached QR available. Please connect to internet and generate a new QR.",

    // Dashboard
    "dashboard.title": "Dashboard",
    "dashboard.subtitle": "Trustcare Hospital Network Overview",
    "dashboard.hospitals": "Network Hospitals",
    "dashboard.credentials": "Issued Credentials",
    "dashboard.patients": "Registered Patients",
    "dashboard.referrals": "Referrals",
    "dashboard.recent_activity": "Recent Activity",

    // Consent
    "consent.title": "Consent Management",
    "consent.active": "Active Consents",
    "consent.history": "History",
    "consent.grant": "Grant Consent",
    "consent.revoke": "Revoke",
    "consent.purpose": "Purpose",

    // Verifier
    "verifier.title": "Verify Credentials",
    "verifier.scan_qr": "Scan QR",
    "verifier.paste_token": "Paste Token",
    "verifier.verify": "Verify",
    "verifier.valid": "Valid",
    "verifier.invalid": "Invalid",
    "verifier.trust_level": "Trust Level",

    // PDF Export
    "pdf.download_summary": "Download PDF",
    "pdf.clinical_summary": "Clinical Summary",
    "pdf.generating": "Generating PDF...",

    // Integration
    "integration.title": "Integration Adapter SDK",
    "integration.subtitle": "SDK for HIS System Integration",
    "integration.download_sdk": "Download SDK",
    "integration.documentation": "Documentation",

    // Cross-border
    "crossborder.title": "Add Partner Hospital",
    "crossborder.wizard_step1": "Hospital Information",
    "crossborder.wizard_step2": "Trust Credential",
    "crossborder.wizard_step3": "Connection Test",
    "crossborder.wizard_step4": "Confirm & Activate",

    // Language
    "lang.switch": "Switch Language",
    "lang.thai": "ไทย",
    "lang.english": "English",
  },
};

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "en" || stored === "th") return stored;
    } catch {}
    return "th";
  });

  const setLang = useCallback((newLang: Language) => {
    setLangState(newLang);
    try {
      localStorage.setItem(STORAGE_KEY, newLang);
    } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const t = useCallback((key: string): string => {
    return translations[lang][key] || translations.th[key] || key;
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
