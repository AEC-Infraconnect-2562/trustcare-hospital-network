# TrustCare Hospital Network — Presentation Slides
# ระบบ TrustCare: Patient Data Portability & Verifiable Ecosystem สำหรับเครือข่ายโรงพยาบาล

---

## Slide 1: Title Slide
**Title:** TrustCare Hospital Network
**Subtitle:** ระบบนิเวศข้อมูลสุขภาพแบบ Portable & Verifiable เพื่อลด Friction ในการให้บริการผู้ป่วย
**Footer:** Confidential — สำหรับผู้บริหารโรงพยาบาลและหน่วยงานกระทรวงสาธารณสุข
**Visual:** Clean, modern healthcare tech aesthetic with green/teal gradient, hospital network icon

---

## Slide 2: ปัญหาที่ระบบสาธารณสุขไทยเผชิญมานานหลายทศวรรษ
**Heading:** ข้อมูลผู้ป่วยกระจัดกระจายใน Silo — ทำให้เกิด Friction ทุกครั้งที่ผู้ป่วยเข้ารับบริการ

**Key Points:**
- ผู้ป่วยต้องกรอกข้อมูลซ้ำทุกครั้งที่ไปโรงพยาบาลใหม่ — ประวัติแพ้ยา โรคประจำตัว ผลตรวจเลือด ต้องเริ่มใหม่หมด
- โรงพยาบาลแต่ละแห่งมีระบบ HIS เป็นของตัวเอง ไม่สามารถแลกเปลี่ยนข้อมูลได้โดยตรง
- การส่งต่อผู้ป่วย (Referral) ต้องใช้เอกสารกระดาษหรือ Fax — ข้อมูลสูญหาย ล่าช้า ไม่ครบถ้วน
- งานวิจัยจาก Chulalongkorn University (PMC9635045, 2022) ยืนยัน: อุปสรรค 4 ด้าน — เทคนิค เศรษฐกิจ การเมือง และกฎหมาย ขัดขวาง HIE ในไทย
- ผู้ป่วยไม่มีสิทธิ์เข้าถึงข้อมูลสุขภาพของตนเองอย่างแท้จริง

**Visual:** Diagram showing fragmented hospital silos with broken connections between them

---

## Slide 3: ผลกระทบต่อผู้ป่วยและโรงพยาบาล
**Heading:** Friction ที่เกิดขึ้นทุกวัน — ส่งผลต่อทั้งคุณภาพการรักษาและประสิทธิภาพการดำเนินงาน

**Key Points:**
- ผู้ป่วย: รอนาน ข้อมูลไม่ครบ เสี่ยงแพ้ยาซ้ำ ตรวจซ้ำโดยไม่จำเป็น
- โรงพยาบาล: เสียเวลาขอข้อมูล ไม่มั่นใจในความถูกต้อง ต้อง Authorize ซ้ำหลายระบบ
- ระบบสาธารณสุข: ข้อมูลไม่เชื่อมกัน วางแผนนโยบายยาก ค่าใช้จ่ายสูงจากความซ้ำซ้อน
- ตลาด Digital Health ทั่วโลก: $162.1B (2024) → $573.5B (2030) — แต่ไทยยังติดอยู่กับปัญหาพื้นฐาน
- Health Link (2021) เชื่อม 50+ โรงพยาบาล แต่ยังเป็น Read-only และไม่ให้ผู้ป่วยควบคุมข้อมูลเอง

**Visual:** Infographic showing patient journey with pain points highlighted at each step

---

## Slide 4: วิสัยทัศน์ TrustCare — Patient-Centric Data Portability
**Heading:** TrustCare สร้าง Ecosystem ที่ข้อมูลสุขภาพเป็นของผู้ป่วย — Portable, Verifiable, Secure

**Key Points:**
- ผู้ป่วยเก็บข้อมูลสุขภาพที่สำคัญไว้ใน Digital Wallet ของตนเอง
- นำข้อมูลไปใช้ที่ไหนก็ได้ในโลก โดยไม่ต้องขอ Authorize จากระบบเดิมทุกครั้ง
- โรงพยาบาลได้รับข้อมูลที่ "น่าเชื่อถือ" และ "เพียงพอ" ต่อการเริ่มให้บริการทันที
- TrustCare เป็นตัวเชื่อมโลกใหม่ (Portable & Verifiable) เข้ากับโลกเก่า (Silo-Based Legacy)
- ไม่ได้แทนที่ระบบเดิม — แต่เพิ่มชั้น Portability ให้ข้อมูลที่มีอยู่แล้ว

**Visual:** Diagram showing patient at center with wallet, connected to multiple hospitals and systems

---

## Slide 5: เทคโนโลยีหลักที่ขับเคลื่อน TrustCare
**Heading:** มาตรฐานสากลที่ได้รับการยอมรับทั่วโลก — ไม่ใช่เทคโนโลยีทดลอง

**Key Points:**
- W3C Verifiable Credentials (VC/VP) — มาตรฐานใบรับรองดิจิทัลที่พิสูจน์ตัวตนได้ ปลอมแปลงไม่ได้
- HL7 FHIR R4 — มาตรฐานแลกเปลี่ยนข้อมูลสุขภาพที่ใช้ทั่วโลก (US, EU, Australia, Japan)
- International Patient Summary (IPS) — ชุดข้อมูลผู้ป่วยขั้นต่ำสำหรับการรักษาข้ามพรมแดน
- SMART Health Links (SHL) — กลไกแชร์ข้อมูลสุขภาพผ่าน QR Code/Link อย่างปลอดภัย
- Decentralized Identifiers (DID) — ระบบระบุตัวตนแบบกระจายศูนย์ ไม่ขึ้นกับ Platform ใด

**Visual:** Technology stack diagram showing layers: DID → VC/VP → FHIR → SHL → Patient Wallet

---

## Slide 6: Verifiable Credentials (VC) คืออะไร?
**Heading:** ใบรับรองดิจิทัลที่พิสูจน์ได้ทันที — เหมือนบัตรประชาชนแต่สำหรับข้อมูลสุขภาพ

**Key Points:**
- เปรียบเทียบ: บัตรประชาชน (กรมการปกครองออก → ใครก็ตรวจสอบได้) = VC (โรงพยาบาลออก → ใครก็ verify ได้)
- มี 3 บทบาท: Issuer (ผู้ออก) → Holder (ผู้ถือ) → Verifier (ผู้ตรวจสอบ)
- ลงนามด้วย Cryptographic Signature — ปลอมแปลงไม่ได้ ตรวจสอบได้ทันที
- Selective Disclosure — ผู้ป่วยเลือกเปิดเผยเฉพาะข้อมูลที่จำเป็น
- ไม่ต้องติดต่อผู้ออกเพื่อ Verify — ลดภาระระบบ ลดเวลารอ

**Visual:** Triangle diagram: Issuer (Hospital) → Holder (Patient) → Verifier (Another Hospital), with arrows showing credential flow

---

## Slide 7: Patient Health Wallet — กระเป๋าสุขภาพดิจิทัล
**Heading:** ผู้ป่วยเก็บ Credentials 24 ประเภทไว้ในกระเป๋าสุขภาพ — พร้อมใช้ทุกที่ทุกเวลา

**Key Points:**
- ตัวตนและสิทธิ์: บัตรประจำตัวผู้ป่วย, ใบยินยอม, ใบเชื่อมโยง MPI
- สรุปทางคลินิก: สรุปข้อมูลผู้ป่วย, แพ้ยา, วัคซีน, ใบรับรองแพทย์
- ยาและเภสัชกรรม: สรุปยา, ใบสั่งยา, บันทึกจ่ายยา
- ผลตรวจ: ผลแล็บ, รายงานวินิจฉัย, ภาพรังสี (DICOM)
- การส่งต่อ: ใบส่งต่อ, สรุปจำหน่าย
- การเงิน: สิทธิ์ประกัน, เคลมแพ็กเกจ, ใบเสร็จเคลม
- Medical Tourism: เอกสารเดินทาง, Visa Support, ใบเสนอราคา

**Visual:** Mobile phone mockup showing wallet cards organized by category with Thai labels

---

## Slide 8: สถาปัตยกรรมระบบ TrustCare
**Heading:** ออกแบบเป็น Modular — เชื่อมต่อได้ทั้งระบบใหม่และระบบเดิม

**Key Points:**
- Frontend: React 19 + Tailwind CSS 4 — รองรับทั้ง Desktop และ Mobile
- Backend: Express 4 + tRPC 11 — Type-safe API ตลอดทั้ง Stack
- VC/VP Engine: 17 modules สำหรับออก ตรวจสอบ และจัดการ Credentials
- Database: 52 tables รองรับ Credential lifecycle ครบวงจร
- Integration Layer: รองรับ HIS REST, Legacy DB, CSV, HL7v2, FHIR native
- Security: Cryptographic signing (ES256), Consent-based access, Audit trail

**Visual:** Architecture diagram showing layered system: Frontend → API → VC Engine → DB → Integration → Legacy Systems

---

## Slide 9: กระบวนการออก Credential (Maker/Checker Workflow)
**Heading:** ระบบ Dual Control — ป้องกันข้อผิดพลาดด้วยกระบวนการ 2 ชั้น

**Key Points:**
- Step 1: ข้อมูลจาก HIS ถูก Canonicalize เป็น FHIR R4 + คำนวณ Data Quality Index (DQI)
- Step 2: Maker (เจ้าหน้าที่) สร้างคำขอออก Credential พร้อมตรวจสอบข้อมูล
- Step 3: Checker (ผู้มีอำนาจ) ตรวจสอบและอนุมัติ — ลงนาม VC ด้วย Digital Signature
- Step 4: Credential ถูกส่งเข้า Patient Wallet — พร้อมใช้งานทันที
- DQI Score (A-F): วัดคุณภาพข้อมูลอัตโนมัติ — Completeness, Conformance, Consistency

**Visual:** Flow diagram: Source of Truth → Maker Queue → Checker Queue → Wallet Card (with DQI badge)

---

## Slide 10: Smart Health Links (SHL) — แชร์ข้อมูลอย่างปลอดภัย
**Heading:** ผู้ป่วยแชร์ข้อมูลผ่าน QR Code หรือ Link — ควบคุมได้ว่าใครเห็นอะไร นานแค่ไหน

**Key Points:**
- สร้าง SHL จาก Credentials ใน Wallet — เลือกได้ว่าจะแชร์อะไรบ้าง
- ป้องกันด้วย Passcode + กำหนดวันหมดอายุ + จำกัดจำนวนครั้งเข้าถึง
- ข้อมูลถูกเข้ารหัส (JWE) — แม้ถูกดักจับก็อ่านไม่ได้
- ผู้รับสแกน QR Code → เห็นข้อมูลสุขภาพในรูปแบบ FHIR + VC Proof
- เพิกถอนได้ทันที — ผู้ป่วยควบคุมสิทธิ์ตลอดเวลา

**Visual:** Sequence diagram: Patient creates SHL → QR Code → Doctor scans → Verified data displayed

---

## Slide 11: Trust Registry — ระบบความน่าเชื่อถือแบบหลายระดับ
**Heading:** ไม่ใช่ทุก Credential จะเชื่อถือได้เท่ากัน — Trust Registry กำหนดระดับความน่าเชื่อถือ

**Key Points:**
- Trust Anchor Organization (TAO): กระทรวงสาธารณสุข, สปสช. เป็น Root of Trust
- Accredited: โรงพยาบาลที่ผ่านการรับรอง (ศิริราช, รามาธิบดี)
- Recognized: โรงพยาบาลที่ได้รับการยอมรับ (บำรุงราษฎร์)
- Self-declared: โรงพยาบาลที่ลงทะเบียนเอง — ต้องผ่านการตรวจสอบเพิ่ม
- DID:web — ทุกโรงพยาบาลมี Digital Identity ที่ตรวจสอบได้ผ่าน Domain

**Visual:** Pyramid diagram showing trust levels: TAO (top) → Accredited → Recognized → Self-declared

---

## Slide 12: การเชื่อมต่อกับระบบเดิม (Legacy Integration)
**Heading:** TrustCare ไม่ได้ทำลายระบบเดิม — แต่เพิ่มชั้น Portability ให้ข้อมูลที่มีอยู่

**Key Points:**
- Source of Truth Connectors: รองรับ 6 รูปแบบ — HIS REST API, Legacy DB View, CSV, HL7v2, FHIR native, Document extraction
- Canonicalization: แปลงข้อมูลจากทุกรูปแบบเป็น FHIR R4 มาตรฐานเดียว
- Sync-Back: หลังออก VC แล้ว สามารถ sync ข้อมูลกลับไปยังระบบเดิมได้
- Adapter SDK: โรงพยาบาลพัฒนา Adapter เชื่อมต่อระบบ HIS ของตนเอง
- ไม่ต้องเปลี่ยนระบบ HIS — เพียงเพิ่ม Adapter Layer เท่านั้น

**Visual:** Diagram showing TrustCare as a bridge layer between multiple legacy HIS systems and the portable wallet ecosystem

---

## Slide 13: Consent Management — ผู้ป่วยควบคุมข้อมูลของตนเอง
**Heading:** ทุกการเข้าถึงข้อมูลต้องได้รับความยินยอม — สอดคล้อง PDPA และมาตรฐานสากล

**Key Points:**
- Granular Consent: ผู้ป่วยเลือกได้ว่าใครเข้าถึงข้อมูลอะไร นานแค่ไหน
- Consent Receipt VC: บันทึกความยินยอมเป็น Verifiable Credential — ตรวจสอบได้
- Auto-expiry Alert: แจ้งเตือนผู้ป่วย 7 วันก่อนความยินยอมหมดอายุ
- Break-glass Access: กรณีฉุกเฉิน แพทย์เข้าถึงได้ แต่ต้องบันทึกเหตุผล + Audit
- Revocation: ผู้ป่วยเพิกถอนความยินยอมได้ทันที — มีผลทันที

**Visual:** Shield icon with consent flow: Patient grants → Time-limited access → Auto-expire → Revoke option

---

## Slide 14: การส่งต่อผู้ป่วย (Referral) — ลด Friction ด้วย VC
**Heading:** ส่งต่อผู้ป่วยพร้อมข้อมูลที่ Verified — โรงพยาบาลปลายทางเริ่มรักษาได้ทันที

**Key Points:**
- Referral VC: ใบส่งต่อเป็น Verifiable Credential — ตรวจสอบได้ว่าออกจากที่ไหน
- แนบ Patient Summary, Allergy Alert, Medication Summary — ข้อมูลครบในที่เดียว
- Cross-border Referral: ส่งต่อข้ามเครือข่ายโรงพยาบาล ข้ามจังหวัด ข้ามประเทศ
- โรงพยาบาลปลายทาง Verify ทันที — ไม่ต้องโทรกลับไปยืนยัน
- ลดเวลาจาก "หลายชั่วโมง/วัน" เหลือ "ไม่กี่วินาที"

**Visual:** Flow: Hospital A issues Referral VC → Patient carries in Wallet → Hospital B verifies instantly

---

## Slide 15: Medical Tourism — รองรับผู้ป่วยต่างชาติ
**Heading:** ผู้ป่วยต่างชาตินำ Credentials มาจากประเทศต้นทาง — เริ่มรักษาได้ทันทีที่ถึงไทย

**Key Points:**
- Travel Document Verification: ตรวจสอบเอกสารเดินทางทางการแพทย์
- Visa Support Letter: ออกจดหมายสนับสนุนวีซ่าเป็น VC
- Quotation & Guarantee Letter: ใบเสนอราคาและหนังสือค้ำประกันดิจิทัล
- International Patient Summary (IPS): มาตรฐานสากลที่ใช้ได้ทั่วโลก
- รองรับ Trusted Issuers จากต่างประเทศผ่าน TAO Framework

**Visual:** Globe with patient traveling from overseas, carrying digital credentials to Thai hospital

---

## Slide 16: Insurance Claims — เคลมประกันแบบ Verifiable
**Heading:** ข้อมูลการรักษาที่ Verified — ลดข้อพิพาทและเร่งกระบวนการเคลม

**Key Points:**
- Coverage Eligibility VC: ตรวจสอบสิทธิ์ประกันได้ทันที
- Claim Package VC: รวมข้อมูลการรักษาที่ Verified ส่งให้ประกัน
- Claim Receipt VC: ใบเสร็จเคลมที่ตรวจสอบได้
- Payer Adapter: เชื่อมต่อกับระบบประกันสุขภาพ (สปสช., ประกันสังคม, ประกันเอกชน)
- Claim Analytics Dashboard: วิเคราะห์แนวโน้มเคลม ลดการทุจริต

**Visual:** Flow diagram: Treatment → Verified Claim Package → Insurance Payer → Payment

---

## Slide 17: Data Quality Index (DQI) — วัดคุณภาพข้อมูลอัตโนมัติ
**Heading:** ไม่ใช่ทุกข้อมูลจะมีคุณภาพเท่ากัน — DQI ให้คะแนนความน่าเชื่อถือ 0-100

**Key Points:**
- Completeness: ข้อมูลครบถ้วนตามมาตรฐาน FHIR หรือไม่
- Conformance: ข้อมูลตรงตามรูปแบบที่กำหนดหรือไม่ (coding, terminology)
- Consistency: ข้อมูลสอดคล้องกันภายในเอกสารหรือไม่
- Grade A (90-100) ถึง Grade F (<50): โรงพยาบาลเห็นคุณภาพข้อมูลก่อนออก VC
- ช่วยโรงพยาบาลปรับปรุงคุณภาพข้อมูลอย่างเป็นระบบ

**Visual:** Gauge/meter showing DQI score with color grades A-F, example credential with DQI badge

---

## Slide 18: Security & Privacy — ความปลอดภัยระดับสูงสุด
**Heading:** ออกแบบ Security-first — ปกป้องข้อมูลผู้ป่วยด้วยมาตรฐาน Cryptographic

**Key Points:**
- Digital Signature: ES256 (P-256) สำหรับ Production — ปลอมแปลง VC ไม่ได้
- Encryption: JWE สำหรับ SHL — ข้อมูลถูกเข้ารหัสตลอดทาง
- Audit Trail: ทุก Action ถูกบันทึก — ใคร ทำอะไร เมื่อไหร่
- PDPA Compliance: Consent-based access, Right to be forgotten
- Watermark: Preview แสดง "สำเนา/COPY" ป้องกัน Screenshot forgery
- Schema Versioning: VC schemas มี version control — upgrade ได้โดยไม่กระทบ VC เดิม

**Visual:** Lock/shield icon with security layers: Signature → Encryption → Consent → Audit

---

## Slide 19: Role-Based Access Control — แต่ละบทบาทเห็นเฉพาะสิ่งที่ควรเห็น
**Heading:** 8 บทบาทในระบบ — แต่ละบทบาทมีสิทธิ์และหน้าที่ชัดเจน

**Key Points:**
- System Admin: จัดการระบบทั้งหมด, Trust Registry, Hospital Management
- Hospital Admin: บริหารโรงพยาบาล, ดูแลผู้ใช้, Executive Dashboard
- Doctor: ออก Credential, ส่งต่อผู้ป่วย, ดูข้อมูลคลินิก
- Nurse: สนับสนุนการรักษา, จัดการเอกสาร
- Maker: สร้างคำขอออก Credential (ตรวจสอบข้อมูล)
- Checker: อนุมัติคำขอ (ลงนาม VC)
- Integration Engineer: จัดการ Adapter, FHIR Mapping, Terminology
- Patient: ดู Wallet, จัดการ Consent, แชร์ SHL

**Visual:** Organizational chart showing 8 roles with their key permissions highlighted

---

## Slide 20: Portability Workbench — เครื่องมือจัดการ VC/VP
**Heading:** เครื่องมือครบวงจรสำหรับออก ตรวจสอบ และจัดการ Verifiable Credentials

**Key Points:**
- Issue VC: ออก Credential จากข้อมูล FHIR ที่ผ่าน Canonicalization
- Verify VP: ตรวจสอบ Verifiable Presentation จากผู้ป่วยหรือโรงพยาบาลอื่น
- QR Scanner: สแกน QR Code เพื่อ Verify Credential ทันที
- Revocation: เพิกถอน Credential ที่ไม่ถูกต้องหรือหมดอายุ
- Schema Registry: จัดการ version ของ VC Schema — รองรับ backward compatibility

**Visual:** Dashboard mockup showing the Portability Workbench interface with key actions

---

## Slide 21: Partner Portal & Adapter SDK — เปิดให้พันธมิตรเชื่อมต่อ
**Heading:** โรงพยาบาลพันธมิตรเชื่อมต่อได้ง่าย — ผ่าน Adapter SDK และ Partner Portal

**Key Points:**
- Partner Onboarding Wizard: ขั้นตอนลงทะเบียนพันธมิตรแบบ Step-by-step
- Adapter SDK Documentation: คู่มือพัฒนา Adapter สำหรับ HIS แต่ละยี่ห้อ
- Health Check API: ตรวจสอบสถานะการเชื่อมต่ออัตโนมัติ
- Document Exchange: แลกเปลี่ยนเอกสารทางคลินิกผ่าน FHIR Bundle
- Care Package: ส่งชุดข้อมูลการดูแลผู้ป่วยแบบครบวงจร

**Visual:** Portal interface mockup showing partner onboarding steps and API documentation

---

## Slide 22: Executive Dashboard — ภาพรวมสำหรับผู้บริหาร
**Heading:** ผู้บริหารเห็นภาพรวมเครือข่าย — Credentials ที่ออก, การส่งต่อ, คุณภาพข้อมูล

**Key Points:**
- Network Statistics: จำนวนโรงพยาบาล, ผู้ป่วย, Credentials ที่ออก
- Credential Analytics: แนวโน้มการออก VC แต่ละประเภท
- Referral Metrics: จำนวนและสถานะการส่งต่อ
- DQI Trends: คุณภาพข้อมูลเฉลี่ยของแต่ละโรงพยาบาล
- Claim Overview: สรุปการเคลมและสถานะ

**Visual:** Dashboard mockup with charts, KPI cards, and network map

---

## Slide 23: Roadmap การ Adopt — เริ่มต้นได้ทันที ขยายได้ตามพร้อม
**Heading:** เริ่มจากโรงพยาบาลเดียว ขยายเป็นเครือข่าย — ไม่ต้องเปลี่ยนระบบทั้งหมดพร้อมกัน

**Key Points:**
- Phase 1 (เดือน 1-3): ติดตั้ง TrustCare + เชื่อม HIS ผ่าน Adapter → ออก Patient Identity VC
- Phase 2 (เดือน 3-6): เพิ่ม Clinical Summary, Allergy, Medication → Patient Wallet ใช้งานได้
- Phase 3 (เดือน 6-12): เปิด SHL Sharing, Referral VC, Cross-network → Ecosystem เริ่มเติบโต
- Phase 4 (ปีที่ 2): Insurance Claims, Medical Tourism, Partner Portal → Full Ecosystem
- ทุก Phase ใช้งานได้จริง — ไม่ต้องรอจนครบทุกอย่าง

**Visual:** Timeline/roadmap diagram showing 4 phases with milestones and deliverables

---

## Slide 24: โอกาสทางธุรกิจและนโยบาย
**Heading:** TrustCare ตอบโจทย์ทั้งนโยบายรัฐและความต้องการของตลาด

**Key Points:**
- ยุทธศาสตร์สุขภาพดิจิทัล สธ. (2564-2568): เป้าหมายเชื่อมข้อมูลสุขภาพทั้งประเทศ
- สปสช. Big Data บัตรทอง (2569): เปิดเชื่อมโยงข้อมูลกับ สธ. และหน่วยงานที่เกี่ยวข้อง
- Medical Hub: ไทยเป็นศูนย์กลางการแพทย์ — ต้องการระบบรองรับผู้ป่วยต่างชาติ
- ตลาด Healthcare ไทย: USD 35.8B (2025) → USD 61.38B (2032) — โอกาสเติบโตสูง
- PDPA Compliance: โรงพยาบาลต้องจัดการ Consent อย่างเป็นระบบ — TrustCare ช่วยได้

**Visual:** Growth chart showing market opportunity with policy alignment indicators

---

## Slide 25: ความท้าทายและแนวทางรับมือ
**Heading:** ทุกนวัตกรรมมีความท้าทาย — TrustCare ออกแบบมาเพื่อรับมือตั้งแต่ต้น

**Key Points:**
- ความท้าทาย 1: โรงพยาบาลมี HIS หลากหลายยี่ห้อ → แก้ด้วย Adapter SDK + 6 Source Formats
- ความท้าทาย 2: บุคลากรไม่คุ้นเคยเทคโนโลยีใหม่ → แก้ด้วย UI ภาษาไทย + Workflow ที่คุ้นเคย
- ความท้าทาย 3: ข้อมูลเดิมคุณภาพต่ำ → แก้ด้วย DQI Scoring + Data Cleansing ก่อนออก VC
- ความท้าทาย 4: กฎหมายและนโยบายยังไม่ชัดเจน → แก้ด้วย Consent-first + PDPA Compliance
- ความท้าทาย 5: ต้องสร้าง Network Effect → แก้ด้วย Phased Adoption + Value ตั้งแต่ Day 1

**Visual:** Challenge-Solution pairs displayed as a balanced scale or problem-solution matrix

---

## Slide 26: เปรียบเทียบ TrustCare กับแนวทางอื่น
**Heading:** TrustCare แตกต่างจาก Platform กลาง — เพราะข้อมูลอยู่กับผู้ป่วย ไม่ใช่กับ Platform

**Key Points:**
- Health Link: Read-only, ข้อมูลอยู่ที่ รพ. ต้นทาง, ผู้ป่วยไม่ควบคุม → TrustCare: ข้อมูลอยู่ใน Wallet ผู้ป่วย
- หมอพร้อม: ข้อมูลจำกัดเฉพาะ สธ., ไม่รองรับ รพ.เอกชน → TrustCare: รองรับทุกโรงพยาบาล
- Platform กลาง: Single Point of Failure, ข้อมูลรวมศูนย์ → TrustCare: Decentralized, ไม่มี Single Point
- Paper-based: ปลอมแปลงง่าย, สูญหาย, ไม่ Verify ได้ → TrustCare: Cryptographic proof, ปลอมไม่ได้
- VC/VP Ecosystem: เปิดกว้าง, Interoperable, ไม่ Lock-in กับ Vendor ใด

**Visual:** Comparison table with checkmarks showing TrustCare advantages vs alternatives

---

## Slide 27: กรณีศึกษา — เครือข่ายโรงพยาบาล TrustCare
**Heading:** Demo Network: 4 โรงพยาบาล, 3 ผู้ป่วย, 46 Credentials — ทำงานจริงแล้ว

**Key Points:**
- TrustCare Central Hospital (TCC): โรงพยาบาลหลัก กรุงเทพฯ
- TrustCare Phuket International (TCP): โรงพยาบาลนานาชาติ ภูเก็ต
- TrustCare Chiang Mai (TCM): โรงพยาบาลภูมิภาค เชียงใหม่
- ผู้ป่วยตัวอย่าง: 16 Wallet Cards ต่อคน — ครอบคลุมทุกประเภทเอกสาร
- External Trust: เชื่อมกับ ศิริราช, รามาธิบดี, บำรุงราษฎร์, สปสช.

**Visual:** Map of Thailand showing hospital locations with connection lines and credential counts

---

## Slide 28: ผลลัพธ์ที่คาดหวัง — ROI สำหรับโรงพยาบาล
**Heading:** ลงทุนครั้งเดียว ได้ผลตอบแทนต่อเนื่อง — ทั้งด้านประสิทธิภาพและความพึงพอใจ

**Key Points:**
- ลดเวลาลงทะเบียนผู้ป่วยใหม่: จาก 30-60 นาที → 5 นาที (Verify จาก Wallet)
- ลดความเสี่ยงแพ้ยา: ข้อมูลแพ้ยาที่ Verified มาพร้อมผู้ป่วยทุกครั้ง
- เร่งกระบวนการส่งต่อ: จากหลายชั่วโมง → ไม่กี่นาที
- ลดค่าใช้จ่ายตรวจซ้ำ: ผลตรวจที่ Verified ใช้ต่อได้ทันที
- เพิ่มความพึงพอใจผู้ป่วย: ประสบการณ์ที่ราบรื่น ไม่ต้องกรอกซ้ำ

**Visual:** Before/After comparison showing time and cost savings with specific metrics

---

## Slide 29: ขั้นตอนถัดไป — เริ่มต้นกับ TrustCare
**Heading:** พร้อมเริ่มต้นวันนี้ — 3 ขั้นตอนสู่ Patient Data Portability

**Key Points:**
- ขั้นตอน 1: Assessment — วิเคราะห์ระบบ HIS ปัจจุบัน, ระบุ Data Sources, ออกแบบ Adapter
- ขั้นตอน 2: Pilot — ติดตั้ง TrustCare, ออก Patient Identity VC ให้ผู้ป่วยกลุ่มแรก
- ขั้นตอน 3: Scale — ขยายประเภท Credential, เปิด SHL, เชื่อมพันธมิตร
- Support: ทีมงานพร้อมสนับสนุนตลอดกระบวนการ
- Flexible: ปรับแต่งได้ตามความต้องการของแต่ละโรงพยาบาล

**Visual:** 3-step staircase diagram with icons for each step, leading to "Full Ecosystem"

---

## Slide 30: สรุปและ Q&A
**Heading:** TrustCare — สร้าง Ecosystem ที่ข้อมูลสุขภาพเป็นของผู้ป่วย เพื่อลด Friction ให้ทุกฝ่าย

**Key Points:**
- Vision: ผู้ป่วยพกข้อมูลสุขภาพที่ Verified ไปรักษาที่ไหนก็ได้
- Technology: W3C VC/VP + FHIR + SHL — มาตรฐานสากลที่พิสูจน์แล้ว
- Value: ลด Friction ให้ผู้ป่วย + โรงพยาบาลได้ข้อมูลที่น่าเชื่อถือทันที
- Approach: เชื่อมโลกใหม่ (Portable) กับโลกเก่า (Legacy) — ไม่ต้องเปลี่ยนทั้งหมด
- Momentum: ยิ่งมีโรงพยาบาลใช้มากขึ้น Ecosystem ยิ่งแข็งแกร่ง

**Footer:** ขอบคุณครับ — พร้อมตอบคำถาม
**Visual:** Clean summary with TrustCare logo, key value propositions, and contact information
