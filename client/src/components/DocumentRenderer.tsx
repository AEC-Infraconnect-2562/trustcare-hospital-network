/**
 * DocumentRenderer.tsx
 * A4 printer-friendly document renderer for Verifiable Presentations (VP).
 * Uses .vp-document CSS classes for hospital letterhead, tables, signatures.
 * 
 * This component handles A4-format credential types:
 * medical_certificate, prescription, lab_result, immunization, patient_summary,
 * allergy_alert, medication_summary, referral_vc, discharge_summary, consent_receipt,
 * travel_document_verification, claim_package, claim_receipt, diagnostic_report,
 * pharmacy_dispense, visa_support_letter, quotation, guarantee_letter
 */

import { PersonPhoto } from "@/components/PersonPhoto";
import { patientPhotoSources, practitionerPhotoSources } from "@shared/personImages";

// ─── Hospital Data ──────────────────────────────────────────────────────────
const HOSPITAL_DATA: Record<string, { nameTh: string; nameEn: string; address: string; tel: string; primary: string }> = {
  TCC: { nameTh: "โรงพยาบาลทรัสต์แคร์ เซ็นทรัล", nameEn: "TrustCare Central Hospital", address: "99 ถ.พหลโยธิน แขวงจตุจักร เขตจตุจักร กรุงเทพฯ 10900", tel: "02-123-4567", primary: "#0f766e" },
  TCP: { nameTh: "โรงพยาบาลทรัสต์แคร์ ภูเก็ต อินเตอร์เนชันแนล", nameEn: "TrustCare Phuket International Hospital", address: "888 ถ.เทพกระษัตรี ต.เทพกระษัตรี อ.ถลาง จ.ภูเก็ต 83110", tel: "076-123-456", primary: "#1d4ed8" },
  TCM: { nameTh: "โรงพยาบาลทรัสต์แคร์ เชียงใหม่", nameEn: "TrustCare Chiang Mai Hospital", address: "123 ถ.สุเทพ ต.สุเทพ อ.เมือง จ.เชียงใหม่ 50200", tel: "053-123-456", primary: "#7c3aed" },
  SRR: { nameTh: "โรงพยาบาลศิริราช", nameEn: "Siriraj Hospital", address: "2 ถ.วังหลัง แขวงศิริราช เขตบางกอกน้อย กรุงเทพฯ 10700", tel: "02-419-7000", primary: "#1e40af" },
  RMT: { nameTh: "โรงพยาบาลรามาธิบดี", nameEn: "Ramathibodi Hospital", address: "270 ถ.พระราม 6 แขวงทุ่งพญาไท เขตราชเทวี กรุงเทพฯ 10400", tel: "02-201-1000", primary: "#7c3aed" },
  BMG: { nameTh: "โรงพยาบาลบำรุงราษฎร์", nameEn: "Bumrungrad International Hospital", address: "33 สุขุมวิท ซอย 3 แขวงคลองเตยเหนือ เขตวัฒนา กรุงเทพฯ 10110", tel: "02-066-8888", primary: "#0d9488" },
  BNH: { nameTh: "โรงพยาบาล BNH", nameEn: "BNH Hospital", address: "9/1 ถ.คอนแวนต์ แขวงสีลม เขตบางรัก กรุงเทพฯ 10500", tel: "02-022-0700", primary: "#dc2626" },
};

const DEFAULT_HOSPITAL = { nameTh: "TrustCare Network Hospital", nameEn: "TrustCare Network Hospital", address: "", tel: "", primary: "#1d4ed8" };

// ─── Types ──────────────────────────────────────────────────────────────────
interface DocumentRendererProps {
  credentialData: any;
  type: string;
  status: string;
  credentialId: string;
  issuedAt: string;
  expiresAt?: string | null;
  hospitalCode?: string;
  hospitalName?: string;
  patientName?: string;
  patientPhotoUrl?: string | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function fmtDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });
  } catch { return dateStr; }
}

function fmtShortDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString("th-TH", { year: "2-digit", month: "short", day: "numeric" });
  } catch { return dateStr; }
}

function fmtMoney(n: number | string) {
  const num = typeof n === "string" ? parseFloat(n) : n;
  if (isNaN(num)) return String(n);
  return num.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function str(val: any): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (typeof val === "object") {
    if (val.nameTh) return val.nameTh;
    if (val.nameEn) return val.nameEn;
    if (val.name) return val.name;
    if (val.text) return val.text;
    return JSON.stringify(val);
  }
  return String(val);
}

function extractData(credentialData: any) {
  const subject = credentialData?.credentialSubject || credentialData;
  const hd = subject?.humanDocument;
  const renderData = hd?.renderData || hd;
  const hospital = renderData?.hospital || renderData?.issuer || subject?.organization || {};
  const patient = renderData?.patient || subject?.patient || {};
  const document = renderData?.document || {};
  return {
    subject,
    hospitalCode: hospital.code || "",
    hospitalNameTh: hospital.nameTh || "",
    hospitalNameEn: hospital.nameEn || "",
    patientNameTh: patient.fullNameTh || patient.nameTh || "",
    patientNameEn: patient.fullNameEn || patient.nameEn || "",
    patientHn: patient.hn || "",
    patientCarepassId: patient.carepassId || "",
    documentNo: document.no || "",
    issuerDid: renderData?.issuer?.did || hospital.did || subject?.id || "",
  };
}

// ─── Shared Document Shell ──────────────────────────────────────────────────
function DocumentShell({ hospitalCode, documentNo, title, subtitle, issuedAt, expiresAt, issuerDid, children }: {
  hospitalCode: string;
  documentNo: string;
  title: string;
  subtitle?: string;
  issuedAt: string;
  expiresAt?: string | null;
  issuerDid?: string;
  children: React.ReactNode;
}) {
  const h = HOSPITAL_DATA[hospitalCode] || DEFAULT_HOSPITAL;
  return (
    <div className="vp-document">
      <div className="doc-watermark">สำเนา COPY</div>

      {/* Letterhead */}
      <div className="doc-header">
        <div className="doc-header-logo">
          <div className="hospital-icon" style={{ background: h.primary }}>{hospitalCode || "TC"}</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: "15px" }}>{h.nameTh}</div>
            <div style={{ fontSize: "11px", color: "#555" }}>{h.nameEn}</div>
            {h.address && <div style={{ fontSize: "10px", color: "#777" }}>{h.address}</div>}
            {h.tel && <div style={{ fontSize: "10px", color: "#777" }}>โทร. {h.tel}</div>}
          </div>
        </div>
        {documentNo && <div style={{ fontSize: "11px", color: "#555", textAlign: "right" }}>เลขที่ / No.<br /><strong>{documentNo}</strong></div>}
      </div>

      {/* Title */}
      <div className="doc-title">{title}</div>
      {subtitle && <div className="doc-subtitle">{subtitle}</div>}

      {/* Content */}
      {children}

      {/* Footer */}
      <div className="doc-footer">
        <span>ออกเมื่อ: {fmtDate(issuedAt)}</span>
        {expiresAt && <span>หมดอายุ: {fmtDate(expiresAt)}</span>}
        {issuerDid && <span style={{ fontSize: "9px", fontFamily: "monospace" }}>DID: {issuerDid.slice(0, 32)}...</span>}
      </div>
    </div>
  );
}

// ─── Patient Info Block (for A4 documents) ──────────────────────────────────
function PatientBlock({ patientNameTh, patientNameEn, hn, carepassId, showPhoto, photoUrl, gender, credentialData }: {
  patientNameTh: string;
  patientNameEn?: string;
  hn?: string;
  carepassId?: string;
  showPhoto?: boolean;
  photoUrl?: string | null;
  gender?: "male" | "female";
  credentialData?: any;
}) {
  const photoSources = patientPhotoSources({ primaryUrl: photoUrl, credentialData, gender });
  return (
    <div className="doc-section">
      <div className="doc-section-title">ข้อมูลผู้ป่วย / Patient Information</div>
      <div className="doc-patient-row">
        {showPhoto && (
          <PersonPhoto
            sources={photoSources}
            alt=""
            className="doc-patient-photo"
            fallback={<div className="doc-patient-photo" style={{ background: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", color: "#999" }}>No Photo</div>}
          />
        )}
        <div className="doc-field-grid">
          <span className="doc-field-label">ชื่อ-นามสกุล</span>
          <span className="doc-field-value bold">{patientNameTh || "—"}</span>
          {patientNameEn && <>
            <span className="doc-field-label">Name</span>
            <span className="doc-field-value">{patientNameEn}</span>
          </>}
          {hn && <>
            <span className="doc-field-label">HN</span>
            <span className="doc-field-value" style={{ fontFamily: "monospace" }}>{hn}</span>
          </>}
          {carepassId && <>
            <span className="doc-field-label">CarePass ID</span>
            <span className="doc-field-value" style={{ fontFamily: "monospace" }}>{carepassId}</span>
          </>}
        </div>
      </div>
    </div>
  );
}

// ─── Signature Block ────────────────────────────────────────────────────────
function SignatureBlock({ practitioner, role }: { practitioner: any; role: string }) {
  if (!practitioner?.name) return null;
  return (
    <div className="doc-signature">
      <div className="doc-signature-block">
        <div className="doc-signature-line" />
        <div className="doc-signature-name">({str(practitioner.name)})</div>
        <div className="doc-signature-role">{role}</div>
        {practitioner.licenseNo && <div className="doc-signature-role">ว.{practitioner.licenseNo}</div>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE-SPECIFIC DOCUMENT RENDERERS
// ═══════════════════════════════════════════════════════════════════════════════

function MedicalCertificateDoc({ props }: { props: DocumentRendererProps }) {
  const d = extractData(props.credentialData);
  const s = d.subject;
  return (
    <DocumentShell hospitalCode={d.hospitalCode} documentNo={d.documentNo} title="ใบรับรองแพทย์" subtitle="MEDICAL CERTIFICATE" issuedAt={props.issuedAt} expiresAt={props.expiresAt} issuerDid={d.issuerDid}>
      <PatientBlock patientNameTh={d.patientNameTh} patientNameEn={d.patientNameEn} hn={d.patientHn} carepassId={d.patientCarepassId} showPhoto photoUrl={props.patientPhotoUrl} credentialData={props.credentialData} />

      <div className="doc-section">
        <div className="doc-section-title">การวินิจฉัย / Diagnosis</div>
        <div className="doc-field-grid">
          <span className="doc-field-label">การวินิจฉัย</span>
          <span className="doc-field-value bold">{str(s?.diagnosisText) || "—"}</span>
          <span className="doc-field-label">ความสามารถทำงาน</span>
          <span className="doc-field-value">
            {s?.fitnessForWork === "fit" ? "✓ สามารถทำงานได้ตามปกติ" :
             s?.fitnessForWork === "unfit" ? "✗ ไม่สามารถทำงานได้" :
             s?.fitnessForWork === "limited" ? "△ ทำงานได้จำกัด" : str(s?.fitnessForWork) || "—"}
          </span>
        </div>
      </div>

      {s?.recommendations?.length > 0 && (
        <div className="doc-section">
          <div className="doc-section-title">คำแนะนำแพทย์ / Recommendations</div>
          <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "13px" }}>
            {s.recommendations.map((r: string, i: number) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}

      <SignatureBlock practitioner={s?.practitioner} role="แพทย์ผู้ออกใบรับรอง / Certifying Physician" />
    </DocumentShell>
  );
}

function PrescriptionDoc({ props }: { props: DocumentRendererProps }) {
  const d = extractData(props.credentialData);
  const s = d.subject;
  const meds: any[] = s?.fhir?.medicationRequests || s?.medications || [];
  return (
    <DocumentShell hospitalCode={d.hospitalCode} documentNo={d.documentNo} title="ใบสั่งยา" subtitle="PRESCRIPTION" issuedAt={props.issuedAt} expiresAt={props.expiresAt} issuerDid={d.issuerDid}>
      <PatientBlock patientNameTh={d.patientNameTh} patientNameEn={d.patientNameEn} hn={d.patientHn} carepassId={d.patientCarepassId} />

      <div className="doc-section">
        <div className="doc-section-title">รายการยาที่สั่ง / Medications Prescribed</div>
        <table className="doc-table">
          <thead>
            <tr>
              <th style={{ width: "30px" }}>#</th>
              <th>ชื่อยา / Drug Name</th>
              <th>วิธีใช้ / Dosage Instructions</th>
              <th style={{ width: "60px" }}>จำนวนวัน</th>
            </tr>
          </thead>
          <tbody>
            {meds.map((med: any, i: number) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td style={{ fontWeight: 500 }}>{med.medicationCodeableConcept?.text || med.name || med.code || `ยารายการที่ ${i + 1}`}</td>
                <td>{med.dosageInstruction?.[0]?.text || med.instructions || "—"}</td>
                <td className="amount-col">{med.dispenseRequest?.expectedSupplyDuration?.value || "—"}</td>
              </tr>
            ))}
            {meds.length === 0 && <tr><td colSpan={4} style={{ textAlign: "center", color: "#999" }}>ไม่มีข้อมูลรายการยา</td></tr>}
          </tbody>
        </table>
      </div>

      <SignatureBlock practitioner={s?.prescriber} role="แพทย์ผู้สั่งยา / Prescribing Physician" />
    </DocumentShell>
  );
}

function LabResultDoc({ props }: { props: DocumentRendererProps }) {
  const d = extractData(props.credentialData);
  const s = d.subject;
  const observations: any[] = s?.observations || [];
  const specimen = s?.specimen || {};
  return (
    <DocumentShell hospitalCode={d.hospitalCode} documentNo={d.documentNo} title="ผลตรวจทางห้องปฏิบัติการ" subtitle="LABORATORY REPORT" issuedAt={props.issuedAt} expiresAt={props.expiresAt} issuerDid={d.issuerDid}>
      <PatientBlock patientNameTh={d.patientNameTh} patientNameEn={d.patientNameEn} hn={d.patientHn} carepassId={d.patientCarepassId} />

      {specimen.accessionNo && (
        <div className="doc-section">
          <div className="doc-field-grid">
            <span className="doc-field-label">Accession No.</span>
            <span className="doc-field-value" style={{ fontFamily: "monospace" }}>{specimen.accessionNo}</span>
            {specimen.collectedAt && <>
              <span className="doc-field-label">เก็บตัวอย่าง</span>
              <span className="doc-field-value">{fmtDate(specimen.collectedAt)}</span>
            </>}
            <span className="doc-field-label">สถานะรายงาน</span>
            <span className="doc-field-value"><span className="doc-badge doc-badge-active">{s?.reportStatus || "final"}</span></span>
          </div>
        </div>
      )}

      <div className="doc-section">
        <div className="doc-section-title">ผลการตรวจ / Test Results</div>
        <table className="doc-table">
          <thead>
            <tr>
              <th>รายการตรวจ / Test</th>
              <th>LOINC</th>
              <th className="amount-col">ผลตรวจ / Result</th>
              <th>หน่วย</th>
              <th>ค่าปกติ / Ref. Range</th>
              <th>แปลผล</th>
            </tr>
          </thead>
          <tbody>
            {observations.map((obs: any, i: number) => (
              <tr key={i}>
                <td style={{ fontWeight: 500 }}>{obs.nameTh || obs.name}</td>
                <td style={{ fontFamily: "monospace", fontSize: "10px" }}>{obs.loincCode || "—"}</td>
                <td className="amount-col" style={{ fontWeight: 600, color: obs.interpretation === "normal" ? "#166534" : "#991b1b" }}>{obs.value}</td>
                <td>{obs.unit || ""}</td>
                <td style={{ fontSize: "11px" }}>{obs.referenceRange || "—"}</td>
                <td>
                  <span className={`doc-badge ${obs.interpretation === "normal" ? "doc-badge-active" : "doc-badge-danger"}`}>
                    {obs.interpretation === "normal" ? "ปกติ" : obs.interpretation === "high" ? "สูง" : obs.interpretation === "low" ? "ต่ำ" : obs.interpretation || "—"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {s?.clinicalNote && (
        <div className="doc-section">
          <div className="doc-section-title">หมายเหตุ / Clinical Note</div>
          <p style={{ fontSize: "13px", margin: 0 }}>{s.clinicalNote}</p>
        </div>
      )}

      <div className="doc-signature" style={{ justifyContent: "space-between" }}>
        {s?.orderingPractitioner?.name && (
          <div className="doc-signature-block">
            <div className="doc-signature-line" />
            <div className="doc-signature-name">({str(s.orderingPractitioner.name)})</div>
            <div className="doc-signature-role">แพทย์ผู้สั่งตรวจ</div>
          </div>
        )}
        {s?.performedBy?.name && (
          <div className="doc-signature-block">
            <div className="doc-signature-line" />
            <div className="doc-signature-name">({str(s.performedBy.name)})</div>
            <div className="doc-signature-role">นักเทคนิคการแพทย์</div>
          </div>
        )}
      </div>
    </DocumentShell>
  );
}

function ImmunizationDoc({ props }: { props: DocumentRendererProps }) {
  const d = extractData(props.credentialData);
  const s = d.subject;
  const vaccine = s?.vaccine || {};
  return (
    <DocumentShell hospitalCode={d.hospitalCode} documentNo={d.documentNo} title="บันทึกการฉีดวัคซีน" subtitle="IMMUNIZATION RECORD" issuedAt={props.issuedAt} expiresAt={props.expiresAt} issuerDid={d.issuerDid}>
      <PatientBlock patientNameTh={d.patientNameTh} patientNameEn={d.patientNameEn} hn={d.patientHn} carepassId={d.patientCarepassId} showPhoto photoUrl={props.patientPhotoUrl} credentialData={props.credentialData} />

      <div className="doc-section">
        <div className="doc-section-title">ข้อมูลวัคซีน / Vaccine Information</div>
        <div className="doc-field-grid">
          <span className="doc-field-label">ชนิดวัคซีน</span>
          <span className="doc-field-value bold">{vaccine.nameTh || vaccine.name || "—"}</span>
          <span className="doc-field-label">ผู้ผลิต</span>
          <span className="doc-field-value">{vaccine.manufacturer || "—"}</span>
          <span className="doc-field-label">Lot Number</span>
          <span className="doc-field-value" style={{ fontFamily: "monospace" }}>{vaccine.lotNumber || "—"}</span>
          <span className="doc-field-label">เข็มที่</span>
          <span className="doc-field-value">{s?.doseNumber || 1} ({s?.seriesName || "Primary"})</span>
          <span className="doc-field-label">วันที่ฉีด</span>
          <span className="doc-field-value">{fmtDate(s?.administrationDate || props.issuedAt)}</span>
          <span className="doc-field-label">ตำแหน่งที่ฉีด</span>
          <span className="doc-field-value">{s?.siteTh || s?.site || "—"} ({s?.route || "IM"})</span>
          {s?.nextDoseDate && <>
            <span className="doc-field-label">นัดฉีดครั้งถัดไป</span>
            <span className="doc-field-value bold">{fmtDate(s.nextDoseDate)}</span>
          </>}
        </div>
      </div>

      {(s?.adverseReactionTh || s?.adverseReaction) && (
        <div className="doc-section">
          <div className="doc-section-title">อาการข้างเคียง / Adverse Reaction</div>
          <p style={{ fontSize: "13px", margin: 0 }}>{s.adverseReactionTh || s.adverseReaction}</p>
        </div>
      )}

      <SignatureBlock practitioner={s?.administeredBy} role="แพทย์/พยาบาลผู้ฉีดวัคซีน" />
    </DocumentShell>
  );
}

function PatientSummaryDoc({ props }: { props: DocumentRendererProps }) {
  const d = extractData(props.credentialData);
  const s = d.subject;
  const conditions: any[] = s?.conditions || s?.clinical?.conditions || [];
  const allergies: any[] = s?.allergies || s?.clinical?.allergies || [];
  const medications: any[] = s?.medications || s?.clinical?.medications || [];
  return (
    <DocumentShell hospitalCode={d.hospitalCode} documentNo={d.documentNo} title="สรุปข้อมูลผู้ป่วย" subtitle="PATIENT SUMMARY (IPS)" issuedAt={props.issuedAt} expiresAt={props.expiresAt} issuerDid={d.issuerDid}>
      <PatientBlock patientNameTh={d.patientNameTh} patientNameEn={d.patientNameEn} hn={d.patientHn} carepassId={d.patientCarepassId} showPhoto photoUrl={props.patientPhotoUrl} credentialData={props.credentialData} />

      {conditions.length > 0 && (
        <div className="doc-section">
          <div className="doc-section-title">โรคประจำตัว / Active Conditions</div>
          <table className="doc-table">
            <thead><tr><th>#</th><th>โรค/ภาวะ</th><th>ICD-10</th></tr></thead>
            <tbody>
              {conditions.map((c: any, i: number) => (
                <tr key={i}><td>{i + 1}</td><td>{typeof c === "string" ? c : c.display || c.code}</td><td style={{ fontFamily: "monospace" }}>{typeof c === "object" ? c.code : ""}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {allergies.length > 0 && (
        <div className="doc-section">
          <div className="doc-section-title" style={{ color: "#991b1b" }}>⚠ การแพ้ยา / Drug Allergies</div>
          <table className="doc-table">
            <thead><tr><th>#</th><th>สารที่แพ้ / Allergen</th></tr></thead>
            <tbody>
              {allergies.map((a: string, i: number) => <tr key={i}><td>{i + 1}</td><td style={{ fontWeight: 500 }}>{a}</td></tr>)}
            </tbody>
          </table>
        </div>
      )}

      {medications.length > 0 && (
        <div className="doc-section">
          <div className="doc-section-title">ยาที่ใช้ประจำ / Current Medications</div>
          <table className="doc-table">
            <thead><tr><th>#</th><th>ชื่อยา</th></tr></thead>
            <tbody>
              {medications.map((m: any, i: number) => <tr key={i}><td>{i + 1}</td><td>{typeof m === "string" ? m : m.name || m.code}</td></tr>)}
            </tbody>
          </table>
        </div>
      )}

      <SignatureBlock practitioner={s?.practitioner} role="แพทย์เจ้าของไข้ / Attending Physician" />
    </DocumentShell>
  );
}

function AllergyAlertDoc({ props }: { props: DocumentRendererProps }) {
  const d = extractData(props.credentialData);
  const s = d.subject;
  const allergies: any[] = s?.allergies || s?.clinical?.allergies || [];
  return (
    <DocumentShell hospitalCode={d.hospitalCode} documentNo={d.documentNo} title="⚠ แจ้งเตือนการแพ้ยา" subtitle="DRUG ALLERGY ALERT" issuedAt={props.issuedAt} expiresAt={props.expiresAt} issuerDid={d.issuerDid}>
      <PatientBlock patientNameTh={d.patientNameTh} patientNameEn={d.patientNameEn} hn={d.patientHn} carepassId={d.patientCarepassId} />

      <div className="doc-section">
        <div className="doc-section-title" style={{ color: "#991b1b", borderColor: "#fca5a5" }}>ข้อมูลการแพ้ยา / Allergy Information</div>
        <div style={{ border: "2px solid #ef4444", borderRadius: "4px", padding: "12px", background: "#fef2f2" }}>
          <p style={{ fontWeight: 700, color: "#991b1b", margin: "0 0 8px", fontSize: "13px" }}>กรุณาแจ้งแพทย์ทุกครั้งก่อนรับยา / Please inform physician before receiving medication</p>
          <table className="doc-table">
            <thead><tr><th>#</th><th>สารที่แพ้ / Allergen</th><th>อาการ / Reaction</th><th>ระดับความรุนแรง</th></tr></thead>
            <tbody>
              {allergies.map((a: any, i: number) => <tr key={i}><td>{i + 1}</td><td style={{ fontWeight: 600 }}>{typeof a === "string" ? a : a.substance || a.allergen || str(a)}</td><td>{typeof a === "object" ? (a.reaction || a.manifestation || "—") : "—"}</td><td><span className={`doc-badge ${(a?.severity === "severe" || a?.severity === "high") ? "doc-badge-danger" : "doc-badge-active"}`}>{typeof a === "object" ? (a.severity || "สูง") : "สูง"}</span></td></tr>)}
              {allergies.length === 0 && <tr><td colSpan={4} style={{ textAlign: "center" }}>ไม่พบข้อมูลการแพ้ยาในระบบ</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <SignatureBlock practitioner={s?.practitioner} role="แพทย์ผู้บันทึก / Recording Physician" />
    </DocumentShell>
  );
}

function MedicationSummaryDoc({ props }: { props: DocumentRendererProps }) {
  const d = extractData(props.credentialData);
  const s = d.subject;
  const medications: any[] = s?.medications || s?.clinical?.medications || [];
  return (
    <DocumentShell hospitalCode={d.hospitalCode} documentNo={d.documentNo} title="สรุปรายการยา" subtitle="MEDICATION SUMMARY" issuedAt={props.issuedAt} expiresAt={props.expiresAt} issuerDid={d.issuerDid}>
      <PatientBlock patientNameTh={d.patientNameTh} patientNameEn={d.patientNameEn} hn={d.patientHn} carepassId={d.patientCarepassId} />

      <div className="doc-section">
        <div className="doc-section-title">รายการยาที่ใช้ประจำ / Current Medications</div>
        <table className="doc-table">
          <thead><tr><th>#</th><th>ชื่อยา / Drug Name</th><th>ขนาดยา / Dose</th><th>ความถี่ / Frequency</th><th>วิธีให้ / Route</th></tr></thead>
          <tbody>
            {medications.map((m: any, i: number) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td style={{ fontWeight: 500 }}>{typeof m === "string" ? m : m.nameTh || m.name || m.code}</td>
                <td>{typeof m === "object" ? m.dose || m.dosage || "" : ""}</td>
                <td>{typeof m === "object" ? m.frequency || "" : ""}</td>
                <td>{typeof m === "object" ? m.route || "" : ""}</td>
              </tr>
            ))}
            {medications.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", color: "#999" }}>ไม่มีข้อมูลรายการยา</td></tr>}
          </tbody>
        </table>
      </div>

      <SignatureBlock practitioner={s?.practitioner} role="แพทย์ผู้สั่งยา / Prescribing Physician" />
    </DocumentShell>
  );
}

function ReferralDoc({ props }: { props: DocumentRendererProps }) {
  const d = extractData(props.credentialData);
  const s = d.subject;
  const referringTo = s?.referringTo || s?.receivingFacility || {};
  const clinicalSummary = s?.clinicalSummary;
  const priorityLabels: Record<string, string> = { urgent: "เร่งด่วน / Urgent", routine: "ปกติ / Routine", stat: "ฉุกเฉิน / STAT" };
  return (
    <DocumentShell hospitalCode={d.hospitalCode} documentNo={d.documentNo} title="ใบส่งต่อผู้ป่วย" subtitle="PATIENT REFERRAL LETTER" issuedAt={props.issuedAt} expiresAt={props.expiresAt} issuerDid={d.issuerDid}>
      <PatientBlock patientNameTh={d.patientNameTh} patientNameEn={d.patientNameEn} hn={d.patientHn} carepassId={d.patientCarepassId} />

      <div className="doc-section">
        <div className="doc-section-title">ข้อมูลการส่งต่อ / Referral Details</div>
        <div className="doc-field-grid">
          <span className="doc-field-label">จากสถานพยาบาล</span>
          <span className="doc-field-value">{d.hospitalNameTh}</span>
          <span className="doc-field-label">ส่งต่อไปยัง</span>
          <span className="doc-field-value bold">{referringTo?.nameTh || referringTo?.nameEn || referringTo?.name || str(referringTo)}</span>
          <span className="doc-field-label">เหตุผลการส่งต่อ</span>
          <span className="doc-field-value">{s?.reasonForReferralTh || s?.reasonForReferral || "—"}</span>
          <span className="doc-field-label">บริการที่ต้องการ</span>
          <span className="doc-field-value">{s?.requestedServiceTh || s?.requestedService || (Array.isArray(s?.requestedServices) ? s.requestedServices.join(", ") : "—")}</span>
          <span className="doc-field-label">ระดับความเร่งด่วน</span>
          <span className="doc-field-value"><span className={`doc-badge ${s?.priority === "urgent" || s?.priority === "stat" ? "doc-badge-danger" : "doc-badge-active"}`}>{priorityLabels[s?.priority] || s?.priority || "ปกติ"}</span></span>
        </div>
      </div>

      {clinicalSummary && (
        <div className="doc-section">
          <div className="doc-section-title">สรุปทางคลินิก / Clinical Summary</div>
          {typeof clinicalSummary === "string" ? (
            <p style={{ fontSize: "13px", margin: 0 }}>{clinicalSummary}</p>
          ) : (
            <div className="doc-field-grid">
              {clinicalSummary.chiefComplaint && <><span className="doc-field-label">อาการสำคัญ</span><span className="doc-field-value">{clinicalSummary.chiefComplaint}</span></>}
              {clinicalSummary.relevantHistory && <><span className="doc-field-label">ประวัติ</span><span className="doc-field-value">{String(clinicalSummary.relevantHistory)}</span></>}
              {Array.isArray(clinicalSummary.allergies) && clinicalSummary.allergies.length > 0 && <><span className="doc-field-label">การแพ้</span><span className="doc-field-value">{clinicalSummary.allergies.join(", ")}</span></>}
              {Array.isArray(clinicalSummary.currentMedications) && clinicalSummary.currentMedications.length > 0 && <><span className="doc-field-label">ยาปัจจุบัน</span><span className="doc-field-value">{clinicalSummary.currentMedications.map((m: any) => m.name || m.code || String(m)).join(", ")}</span></>}
            </div>
          )}
        </div>
      )}

      <SignatureBlock practitioner={s?.referringPractitioner} role="แพทย์ผู้ส่งต่อ / Referring Physician" />
    </DocumentShell>
  );
}

function DischargeSummaryDoc({ props }: { props: DocumentRendererProps }) {
  const d = extractData(props.credentialData);
  const s = d.subject;
  const dischargeMeds: any[] = s?.dischargeMedications || [];
  return (
    <DocumentShell hospitalCode={d.hospitalCode} documentNo={d.documentNo} title="สรุปจำหน่ายผู้ป่วย" subtitle="DISCHARGE SUMMARY" issuedAt={props.issuedAt} expiresAt={props.expiresAt} issuerDid={d.issuerDid}>
      <PatientBlock patientNameTh={d.patientNameTh} patientNameEn={d.patientNameEn} hn={d.patientHn} carepassId={d.patientCarepassId} />

      {(s?.vitalSignsAtAdmission || s?.vitalSignsAtDischarge) && (
        <div className="doc-section">
          <div className="doc-section-title">สัญญาณชีพ / Vital Signs</div>
          <table className="doc-table">
            <thead><tr><th>รายการ</th><th>แรกรับ (Admission)</th><th>จำหน่าย (Discharge)</th></tr></thead>
            <tbody>
              <tr><td>BP</td><td>{s?.vitalSignsAtAdmission?.bp || "—"}</td><td>{s?.vitalSignsAtDischarge?.bp || "—"}</td></tr>
              <tr><td>HR</td><td>{s?.vitalSignsAtAdmission?.hr || "—"}</td><td>{s?.vitalSignsAtDischarge?.hr || "—"}</td></tr>
              <tr><td>Temp</td><td>{s?.vitalSignsAtAdmission?.temp || "—"}</td><td>{s?.vitalSignsAtDischarge?.temp || "—"}</td></tr>
              <tr><td>RR</td><td>{s?.vitalSignsAtAdmission?.rr || "—"}</td><td>{s?.vitalSignsAtDischarge?.rr || "—"}</td></tr>
              <tr><td>SpO2</td><td>{s?.vitalSignsAtAdmission?.spo2 || "—"}</td><td>{s?.vitalSignsAtDischarge?.spo2 || "—"}</td></tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="doc-section">
        <div className="doc-section-title">สรุปการรักษา / Treatment Summary</div>
        <div className="doc-field-grid">
          <span className="doc-field-label">วันที่รับไว้</span>
          <span className="doc-field-value">{s?.admissionDate ? fmtDate(s.admissionDate) : "—"}</span>
          <span className="doc-field-label">วันที่จำหน่าย</span>
          <span className="doc-field-value">{fmtDate(s?.dischargeDate || props.issuedAt)}</span>
          {s?.lengthOfStay && <><span className="doc-field-label">ระยะเวลานอน</span><span className="doc-field-value">{s.lengthOfStay} วัน</span></>}
          {s?.ward && <><span className="doc-field-label">หอผู้ป่วย</span><span className="doc-field-value">{str(s.ward)}</span></>}
          {s?.admittingDiagnosis && <><span className="doc-field-label">การวินิจฉัยแรกรับ</span><span className="doc-field-value">{s.admittingDiagnosis}</span></>}
          {s?.dischargeDiagnosis && <><span className="doc-field-label">การวินิจฉัยสุดท้าย</span><span className="doc-field-value bold">{s.dischargeDiagnosis}</span></>}
          {s?.principalProcedure && <><span className="doc-field-label">หัตถการหลัก</span><span className="doc-field-value">{s.principalProcedure}</span></>}
          <span className="doc-field-label">สภาพขณะจำหน่าย</span>
          <span className="doc-field-value"><span className="doc-badge doc-badge-active">{s?.dischargeConditionTh || s?.dischargeCondition || "ดีขึ้น"}</span></span>
        </div>
      </div>

      {dischargeMeds.length > 0 && (
        <div className="doc-section">
          <div className="doc-section-title">ยากลับบ้าน / Discharge Medications</div>
          <table className="doc-table">
            <thead><tr><th>#</th><th>ชื่อยา / Drug Name</th><th>ขนาด / Dose</th><th>ความถี่ / Frequency</th><th>วิธีใช้ / Instructions</th></tr></thead>
            <tbody>
              {dischargeMeds.map((m: any, i: number) => <tr key={i}><td>{i + 1}</td><td style={{ fontWeight: 500 }}>{m.name || m.code}</td><td>{m.dose || "—"}</td><td>{m.frequency || "—"}</td><td>{m.instructions || "—"}</td></tr>)}
            </tbody>
          </table>
        </div>
      )}

      {(s?.followUpInstructions || s?.activityRestrictions || s?.dietaryAdvice) && (
        <div className="doc-section">
          <div className="doc-section-title">คำแนะนำหลังจำหน่าย / Post-Discharge Instructions</div>
          <div style={{ fontSize: "13px" }}>
            {s?.followUpInstructions && <p style={{ margin: "0 0 4px" }}>• {s.followUpInstructions}</p>}
            {s?.followUpDate && <p style={{ margin: "0 0 4px" }}>• นัดติดตาม: <strong>{fmtDate(s.followUpDate)}</strong></p>}
            {s?.activityRestrictions && <p style={{ margin: "0 0 4px" }}>• ข้อจำกัดกิจกรรม: {s.activityRestrictions}</p>}
            {s?.dietaryAdvice && <p style={{ margin: "0 0 4px" }}>• คำแนะนำอาหาร: {s.dietaryAdvice}</p>}
          </div>
        </div>
      )}

      <SignatureBlock practitioner={s?.attendingPhysician} role="แพทย์เจ้าของไข้ / Attending Physician" />
    </DocumentShell>
  );
}

function ConsentReceiptDoc({ props }: { props: DocumentRendererProps }) {
  const d = extractData(props.credentialData);
  const s = d.subject;
  const purposes: any[] = s?.purposes || [];
  const dataCategories: any[] = s?.dataCategories || [];
  return (
    <DocumentShell hospitalCode={d.hospitalCode} documentNo={d.documentNo} title="ใบยินยอมเปิดเผยข้อมูล" subtitle="CONSENT RECEIPT" issuedAt={props.issuedAt} expiresAt={props.expiresAt} issuerDid={d.issuerDid}>
      <PatientBlock patientNameTh={d.patientNameTh} patientNameEn={d.patientNameEn} hn={d.patientHn} carepassId={d.patientCarepassId} />

      <div className="doc-section">
        <div className="doc-section-title">รายละเอียดความยินยอม / Consent Details</div>
        <div className="doc-field-grid">
          <span className="doc-field-label">ประเภทความยินยอม</span>
          <span className="doc-field-value bold">{s?.consentType || "ยินยอมเปิดเผยข้อมูลสุขภาพ"}</span>
          <span className="doc-field-label">สถานะ</span>
          <span className="doc-field-value"><span className="doc-badge doc-badge-active">{s?.consentStatus || "active"}</span></span>
          {s?.consentGivenDate && <><span className="doc-field-label">วันที่ให้ความยินยอม</span><span className="doc-field-value">{fmtDate(s.consentGivenDate)}</span></>}
          {s?.validUntil && <><span className="doc-field-label">หมดอายุ</span><span className="doc-field-value">{fmtDate(s.validUntil)}</span></>}
        </div>
      </div>

      {purposes.length > 0 && (
        <div className="doc-section">
          <div className="doc-section-title">วัตถุประสงค์ / Purposes</div>
          <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "13px" }}>
            {purposes.map((p: any, i: number) => <li key={i}>{typeof p === "string" ? p : p.description || p.code}</li>)}
          </ul>
        </div>
      )}

      {dataCategories.length > 0 && (
        <div className="doc-section">
          <div className="doc-section-title">ประเภทข้อมูล / Data Categories</div>
          <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "13px" }}>
            {dataCategories.map((dc: any, i: number) => <li key={i}>{typeof dc === "string" ? dc : dc.name || dc.code}</li>)}
          </ul>
        </div>
      )}

      <SignatureBlock practitioner={s?.witnessedBy || s?.practitioner} role="พยาน / Witness" />
    </DocumentShell>
  );
}

function TravelDocumentDoc({ props }: { props: DocumentRendererProps }) {
  const d = extractData(props.credentialData);
  const s = d.subject;
  return (
    <DocumentShell hospitalCode={d.hospitalCode} documentNo={d.documentNo} title="เอกสารยืนยันตัวตนผู้ป่วยต่างชาติ" subtitle="TRAVEL DOCUMENT VERIFICATION" issuedAt={props.issuedAt} expiresAt={props.expiresAt} issuerDid={d.issuerDid}>
      <PatientBlock patientNameTh={d.patientNameTh} patientNameEn={d.patientNameEn} hn={d.patientHn} carepassId={d.patientCarepassId} showPhoto photoUrl={props.patientPhotoUrl} credentialData={props.credentialData} />

      <div className="doc-section">
        <div className="doc-section-title">ข้อมูลหนังสือเดินทาง / Passport Information</div>
        <div className="doc-field-grid">
          <span className="doc-field-label">เลขหนังสือเดินทาง</span>
          <span className="doc-field-value bold" style={{ fontFamily: "monospace" }}>{s?.passportNumber || "—"}</span>
          <span className="doc-field-label">สัญชาติ</span>
          <span className="doc-field-value">{s?.nationality || "—"}</span>
          <span className="doc-field-label">ประเทศที่ออก</span>
          <span className="doc-field-value">{s?.issuingCountry || "—"}</span>
          {s?.passportExpiryDate && <><span className="doc-field-label">วันหมดอายุ</span><span className="doc-field-value">{fmtDate(s.passportExpiryDate)}</span></>}
          {s?.verificationMethod && <><span className="doc-field-label">วิธีการตรวจสอบ</span><span className="doc-field-value">{s.verificationMethod}</span></>}
          <span className="doc-field-label">สถานะ</span>
          <span className="doc-field-value"><span className="doc-badge doc-badge-active">{s?.verificationStatus || "verified"}</span></span>
        </div>
      </div>

      <SignatureBlock practitioner={s?.verifiedBy || s?.practitioner} role="เจ้าหน้าที่ผู้ตรวจสอบ / Verification Officer" />
    </DocumentShell>
  );
}

function ClaimDoc({ props }: { props: DocumentRendererProps }) {
  const d = extractData(props.credentialData);
  const s = d.subject;
  const items: any[] = s?.serviceItems || s?.items || s?.claimItems || s?.breakdown || [];
  return (
    <DocumentShell hospitalCode={d.hospitalCode} documentNo={d.documentNo} title={props.type === "claim_receipt" ? "ใบเสร็จรับเงิน" : "เอกสารเคลมประกัน"} subtitle={props.type === "claim_receipt" ? "RECEIPT / INVOICE" : "INSURANCE CLAIM PACKAGE"} issuedAt={props.issuedAt} expiresAt={props.expiresAt} issuerDid={d.issuerDid}>
      <PatientBlock patientNameTh={d.patientNameTh} patientNameEn={d.patientNameEn} hn={d.patientHn} carepassId={d.patientCarepassId} />

      <div className="doc-section">
        <div className="doc-section-title">ข้อมูลเคลม / Claim Details</div>
        <div className="doc-field-grid">
          {(s?.claimRef || s?.claimId) && <><span className="doc-field-label">Claim ID</span><span className="doc-field-value" style={{ fontFamily: "monospace" }}>{s.claimRef || s.claimId}</span></>}
          {s?.claimType && <><span className="doc-field-label">ประเภท</span><span className="doc-field-value">{s.claimType}</span></>}
          {s?.claimStatus && <><span className="doc-field-label">สถานะ</span><span className="doc-field-value"><span className="doc-badge doc-badge-active">{s.claimStatus}</span></span></>}
          {s?.serviceDate && <><span className="doc-field-label">วันที่รับบริการ</span><span className="doc-field-value">{fmtDate(s.serviceDate)}</span></>}
          {s?.payer && <><span className="doc-field-label">ผู้จ่าย</span><span className="doc-field-value">{typeof s.payer === "object" ? s.payer.name : s.payer}</span></>}
          {s?.payerRef && <><span className="doc-field-label">ผู้จ่าย (Ref)</span><span className="doc-field-value">{typeof s.payerRef === "object" ? s.payerRef.name : s.payerRef}</span></>}
          {s?.receiptNo && <><span className="doc-field-label">เลขที่ใบเสร็จ</span><span className="doc-field-value" style={{ fontFamily: "monospace" }}>{s.receiptNo}</span></>}
          {s?.invoiceNo && <><span className="doc-field-label">เลขที่ใบแจ้งหนี้</span><span className="doc-field-value" style={{ fontFamily: "monospace" }}>{s.invoiceNo}</span></>}
          {s?.adjudicationOutcome && <><span className="doc-field-label">ผลการพิจารณา</span><span className="doc-field-value"><span className={`doc-badge ${s.adjudicationOutcome === "approved" ? "doc-badge-active" : "doc-badge-danger"}`}>{s.adjudicationOutcome}</span></span></>}
          {s?.approvedAmount && <><span className="doc-field-label">ยอดอนุมัติ</span><span className="doc-field-value bold" style={{ color: "#166534" }}>฿{fmtMoney(s.approvedAmount)}</span></>}
          {s?.patientResponsibility != null && <><span className="doc-field-label">ส่วนผู้ป่วยรับผิดชอบ</span><span className="doc-field-value">฿{fmtMoney(s.patientResponsibility)}</span></>}
          {s?.paymentMethod && <><span className="doc-field-label">วิธีชำระ</span><span className="doc-field-value">{s.paymentMethod}</span></>}
        </div>
      </div>

      {items.length > 0 && (
        <div className="doc-section">
          <div className="doc-section-title">รายการค่าใช้จ่าย / Itemized Charges</div>
          <table className="doc-table">
            <thead><tr><th>#</th><th>รายการ / Description</th><th className="amount-col">จำนวนเงิน (฿)</th></tr></thead>
            <tbody>
              {items.map((item: any, i: number) => (
                <tr key={i}><td>{i + 1}</td><td>{item.description || item.name || item.code}</td><td className="amount-col">{fmtMoney(item.amount || item.unitPrice || 0)}</td></tr>
              ))}
              <tr style={{ fontWeight: 700 }}><td colSpan={2} style={{ textAlign: "right" }}>รวมทั้งสิ้น / Total</td><td className="amount-col">{fmtMoney(s?.totalAmount || s?.totalCharge || 0)}</td></tr>
            </tbody>
          </table>
        </div>
      )}

      <SignatureBlock practitioner={s?.approvedBy || s?.practitioner} role="ผู้อนุมัติ / Authorized Officer" />
    </DocumentShell>
  );
}

function DiagnosticReportDoc({ props }: { props: DocumentRendererProps }) {
  const d = extractData(props.credentialData);
  const s = d.subject;
  return (
    <DocumentShell hospitalCode={d.hospitalCode} documentNo={d.documentNo} title="รายงานผลวินิจฉัย" subtitle="DIAGNOSTIC REPORT" issuedAt={props.issuedAt} expiresAt={props.expiresAt} issuerDid={d.issuerDid}>
      <PatientBlock patientNameTh={d.patientNameTh} patientNameEn={d.patientNameEn} hn={d.patientHn} carepassId={d.patientCarepassId} />

      <div className="doc-section">
        <div className="doc-section-title">ข้อมูลการตรวจ / Examination Details</div>
        <div className="doc-field-grid">
          {s?.reportType && <><span className="doc-field-label">ประเภท</span><span className="doc-field-value bold">{s.reportType}</span></>}
          {s?.modality && <><span className="doc-field-label">Modality</span><span className="doc-field-value">{s.modality}</span></>}
          {s?.bodyPart && <><span className="doc-field-label">ส่วนที่ตรวจ</span><span className="doc-field-value">{s.bodyPart}</span></>}
          {(s?.clinicalIndication || s?.indication) && <><span className="doc-field-label">ข้อบ่งชี้</span><span className="doc-field-value">{s.clinicalIndication || s.indication}</span></>}
        </div>
      </div>

      {s?.findings && (
        <div className="doc-section">
          <div className="doc-section-title">ผลการตรวจ / Findings</div>
          <p style={{ fontSize: "13px", margin: 0, whiteSpace: "pre-wrap" }}>{s.findings}</p>
        </div>
      )}

      {(s?.conclusionTh || s?.conclusion || s?.impression) && (
        <div className="doc-section">
          <div className="doc-section-title">สรุปผล / Impression</div>
          <p style={{ fontSize: "13px", margin: 0, fontWeight: 600 }}>{s.conclusionTh || s.conclusion || s.impression}</p>
        </div>
      )}

      <SignatureBlock practitioner={s?.reportingRadiologist || s?.reportingPhysician || s?.practitioner} role="แพทย์ผู้รายงาน / Reporting Physician" />
    </DocumentShell>
  );
}

function PharmacyDispenseDoc({ props }: { props: DocumentRendererProps }) {
  const d = extractData(props.credentialData);
  const s = d.subject;
  const items: any[] = s?.dispensedItems || [];
  return (
    <DocumentShell hospitalCode={d.hospitalCode} documentNo={d.documentNo} title="ใบจ่ายยา" subtitle="PHARMACY DISPENSING RECORD" issuedAt={props.issuedAt} expiresAt={props.expiresAt} issuerDid={d.issuerDid}>
      <PatientBlock patientNameTh={d.patientNameTh} patientNameEn={d.patientNameEn} hn={d.patientHn} carepassId={d.patientCarepassId} />

      <div className="doc-section">
        <div className="doc-section-title">รายการยาที่จ่าย / Dispensed Medications</div>
        <table className="doc-table">
          <thead><tr><th>#</th><th>ชื่อยา / Drug Name</th><th>จำนวน</th><th>วิธีใช้ / Instructions</th></tr></thead>
          <tbody>
            {items.map((item: any, i: number) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td style={{ fontWeight: 500 }}>{item.medicationNameTh || item.medicationName || item.name || item.drugName || item.code}</td>
                <td>{item.quantity || "—"}</td>
                <td>{item.instructions || item.dosage || "—"}</td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={4} style={{ textAlign: "center", color: "#999" }}>ไม่มีข้อมูลรายการยา</td></tr>}
          </tbody>
        </table>
      </div>

      {(s?.counselingNotes || s?.dispensingNote) && (
        <div className="doc-section">
          <div className="doc-section-title">หมายเหตุ / Notes</div>
          <p style={{ fontSize: "13px", margin: 0 }}>{s.counselingNotes || s.dispensingNote}</p>
        </div>
      )}

      <SignatureBlock practitioner={s?.dispenser || s?.dispensedBy || s?.pharmacist} role="เภสัชกรผู้จ่ายยา / Dispensing Pharmacist" />
    </DocumentShell>
  );
}

function VisaSupportLetterDoc({ props }: { props: DocumentRendererProps }) {
  const d = extractData(props.credentialData);
  const s = d.subject;
  const treatmentPlan = s?.treatmentPlan;
  return (
    <DocumentShell hospitalCode={d.hospitalCode} documentNo={d.documentNo} title="หนังสือรับรองการรักษาพยาบาล" subtitle="VISA SUPPORT LETTER FOR MEDICAL TREATMENT" issuedAt={props.issuedAt} expiresAt={props.expiresAt} issuerDid={d.issuerDid}>
      <PatientBlock patientNameTh={d.patientNameTh} patientNameEn={d.patientNameEn} hn={d.patientHn} carepassId={d.patientCarepassId} showPhoto photoUrl={props.patientPhotoUrl} credentialData={props.credentialData} />

      <div className="doc-section">
        <div className="doc-section-title">ข้อมูลผู้ป่วยต่างชาติ / International Patient Details</div>
        <div className="doc-field-grid">
          {(s?.patientPassport || s?.passportNumber) && <><span className="doc-field-label">หนังสือเดินทาง</span><span className="doc-field-value" style={{ fontFamily: "monospace" }}>{s.patientPassport || s.passportNumber}</span></>}
          {(s?.patientNationality || s?.nationality) && <><span className="doc-field-label">สัญชาติ</span><span className="doc-field-value">{s.patientNationality || s.nationality}</span></>}
          {s?.purposeOfVisit && <><span className="doc-field-label">วัตถุประสงค์</span><span className="doc-field-value">{s.purposeOfVisit}</span></>}
          {(s?.visitPeriod?.totalDays || s?.estimatedStayDays) && <><span className="doc-field-label">ระยะเวลาพำนัก</span><span className="doc-field-value">{s.visitPeriod?.totalDays || s.estimatedStayDays} วัน</span></>}
        </div>
      </div>

      {treatmentPlan && (
        <div className="doc-section">
          <div className="doc-section-title">แผนการรักษา / Treatment Plan</div>
          <div className="doc-field-grid">
            {typeof treatmentPlan === "string" ? (
              <><span className="doc-field-label">รายละเอียด</span><span className="doc-field-value">{treatmentPlan}</span></>
            ) : (
              <>
                {treatmentPlan.diagnosis && <><span className="doc-field-label">การวินิจฉัย</span><span className="doc-field-value">{treatmentPlan.diagnosis}</span></>}
                {treatmentPlan.plannedProcedures && <><span className="doc-field-label">หัตถการ</span><span className="doc-field-value">{Array.isArray(treatmentPlan.plannedProcedures) ? treatmentPlan.plannedProcedures.join(", ") : treatmentPlan.plannedProcedures}</span></>}
                {treatmentPlan.estimatedCost && <><span className="doc-field-label">ค่าใช้จ่ายโดยประมาณ</span><span className="doc-field-value bold">฿{fmtMoney(typeof treatmentPlan.estimatedCost === "object" ? treatmentPlan.estimatedCost.amount : treatmentPlan.estimatedCost)}</span></>}
              </>
            )}
          </div>
        </div>
      )}

      <div style={{ marginTop: "16px", fontSize: "13px", lineHeight: 1.8 }}>
        <p>ข้าพเจ้าขอรับรองว่าผู้ป่วยข้างต้นมีความจำเป็นต้องเดินทางมารับการรักษาพยาบาลที่โรงพยาบาลของเรา ตามแผนการรักษาที่ระบุข้างต้น</p>
        <p style={{ marginTop: "8px" }}>This is to certify that the above-named patient requires medical treatment at our hospital as per the treatment plan specified above.</p>
      </div>

      <SignatureBlock practitioner={s?.issuingPhysician || s?.practitioner} role="แพทย์ผู้ออกหนังสือ / Issuing Physician" />
    </DocumentShell>
  );
}

function QuotationDoc({ props }: { props: DocumentRendererProps }) {
  const d = extractData(props.credentialData);
  const s = d.subject;
  const lineItems: any[] = s?.lineItems || [];
  return (
    <DocumentShell hospitalCode={d.hospitalCode} documentNo={d.documentNo} title="ใบเสนอราคาค่ารักษา" subtitle="MEDICAL COST ESTIMATE / QUOTATION" issuedAt={props.issuedAt} expiresAt={props.expiresAt} issuerDid={d.issuerDid}>
      <PatientBlock patientNameTh={d.patientNameTh} patientNameEn={d.patientNameEn} hn={d.patientHn} carepassId={d.patientCarepassId} />

      <div className="doc-section">
        <div className="doc-section-title">ข้อมูลแพ็คเกจ / Package Details</div>
        <div className="doc-field-grid">
          {s?.packageName && <><span className="doc-field-label">แพ็คเกจ</span><span className="doc-field-value bold">{s.packageName}</span></>}
          {s?.validForDays && <><span className="doc-field-label">ใบเสนอราคามีผล</span><span className="doc-field-value">{s.validForDays} วัน</span></>}
        </div>
      </div>

      {lineItems.length > 0 && (
        <div className="doc-section">
          <div className="doc-section-title">รายการค่าใช้จ่าย / Itemized Costs</div>
          <table className="doc-table">
            <thead><tr><th>#</th><th>รายการ / Description</th><th className="amount-col">จำนวนเงิน (฿)</th></tr></thead>
            <tbody>
              {lineItems.map((item: any, i: number) => (
                <tr key={i}><td>{i + 1}</td><td>{item.description || item.name}</td><td className="amount-col">{fmtMoney(item.amount || 0)}</td></tr>
              ))}
              <tr style={{ fontWeight: 700, borderTop: "2px solid #333" }}>
                <td colSpan={2} style={{ textAlign: "right" }}>รวมทั้งสิ้น / Estimated Total</td>
                <td className="amount-col">{fmtMoney(s?.estimatedTotal || s?.totalAmount || 0)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div style={{ fontSize: "11px", color: "#666", marginTop: "12px" }}>
        <p>* ราคาข้างต้นเป็นราคาประมาณการ อาจมีการเปลี่ยนแปลงตามสภาพจริงของผู้ป่วย</p>
        <p>* The above prices are estimates and may vary depending on the patient's actual condition.</p>
      </div>

      <SignatureBlock practitioner={s?.approvedBy || s?.practitioner} role="ผู้อนุมัติใบเสนอราคา / Authorized Officer" />
    </DocumentShell>
  );
}

function GuaranteeLetterDoc({ props }: { props: DocumentRendererProps }) {
  const d = extractData(props.credentialData);
  const s = d.subject;
  return (
    <DocumentShell hospitalCode={d.hospitalCode} documentNo={d.documentNo} title="หนังสือรับรองการชำระเงิน" subtitle="GUARANTEE LETTER / LETTER OF GUARANTEE" issuedAt={props.issuedAt} expiresAt={props.expiresAt} issuerDid={d.issuerDid}>
      <PatientBlock patientNameTh={d.patientNameTh} patientNameEn={d.patientNameEn} hn={d.patientHn} carepassId={d.patientCarepassId} />

      <div className="doc-section">
        <div className="doc-section-title">รายละเอียดการค้ำประกัน / Guarantee Details</div>
        <div className="doc-field-grid">
          {s?.payer && <><span className="doc-field-label">ผู้ค้ำประกัน/ผู้จ่าย</span><span className="doc-field-value bold">{typeof s.payer === "object" ? s.payer.name : s.payer}</span></>}
          {s?.payer?.payerType && <><span className="doc-field-label">ประเภท</span><span className="doc-field-value">{s.payer.payerType === "private_insurance" ? "ประกันเอกชน" : s.payer.payerType}</span></>}
          {s?.guaranteeRef && <><span className="doc-field-label">เลขที่อ้างอิง</span><span className="doc-field-value" style={{ fontFamily: "monospace" }}>{s.guaranteeRef}</span></>}
          {s?.preAuthorizationNo && <><span className="doc-field-label">Pre-Auth No.</span><span className="doc-field-value" style={{ fontFamily: "monospace" }}>{s.preAuthorizationNo}</span></>}
          {s?.memberId && <><span className="doc-field-label">Member ID</span><span className="doc-field-value" style={{ fontFamily: "monospace" }}>{s.memberId}</span></>}
          {s?.approvedLimit && <><span className="doc-field-label">วงเงินอนุมัติ</span><span className="doc-field-value bold" style={{ color: "#166534" }}>฿{fmtMoney(s.approvedLimit)}</span></>}
          {s?.guaranteeAmount && <><span className="doc-field-label">จำนวนเงินค้ำประกัน</span><span className="doc-field-value bold" style={{ color: "#166534" }}>฿{fmtMoney(s.guaranteeAmount)}</span></>}
          {s?.validFrom && <><span className="doc-field-label">มีผลตั้งแต่</span><span className="doc-field-value">{fmtDate(s.validFrom)}</span></>}
          {s?.validUntil && <><span className="doc-field-label">ถึงวันที่</span><span className="doc-field-value">{fmtDate(s.validUntil)}</span></>}
          {s?.coverageScope && <><span className="doc-field-label">ขอบเขตความคุ้มครอง</span><span className="doc-field-value">{s.coverageScope}</span></>}
          {s?.coveredServices && <><span className="doc-field-label">บริการที่ครอบคลุม</span><span className="doc-field-value">{Array.isArray(s.coveredServices) ? s.coveredServices.join(", ") : s.coveredServices}</span></>}
          {s?.conditions && <><span className="doc-field-label">เงื่อนไข</span><span className="doc-field-value">{Array.isArray(s.conditions) ? s.conditions.join("; ") : s.conditions}</span></>}
        </div>
      </div>

      <div style={{ marginTop: "16px", fontSize: "13px", lineHeight: 1.8 }}>
        <p>หนังสือฉบับนี้ออกเพื่อรับรองว่าผู้ค้ำประกันข้างต้นจะรับผิดชอบค่าใช้จ่ายในการรักษาพยาบาลตามวงเงินที่อนุมัติ</p>
      </div>

      <SignatureBlock practitioner={s?.approvedBy || s?.authorizedBy} role="ผู้มีอำนาจอนุมัติ / Authorized Signatory" />
    </DocumentShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT - Route to type-specific document renderer
// ═══════════════════════════════════════════════════════════════════════════════

export function DocumentRenderer(props: DocumentRendererProps) {
  switch (props.type) {
    case "medical_certificate": return <MedicalCertificateDoc props={props} />;
    case "prescription": return <PrescriptionDoc props={props} />;
    case "lab_result": return <LabResultDoc props={props} />;
    case "immunization": return <ImmunizationDoc props={props} />;
    case "patient_summary": return <PatientSummaryDoc props={props} />;
    case "allergy_alert": return <AllergyAlertDoc props={props} />;
    case "medication_summary": return <MedicationSummaryDoc props={props} />;
    case "referral_vc": return <ReferralDoc props={props} />;
    case "discharge_summary": return <DischargeSummaryDoc props={props} />;
    case "consent_receipt": return <ConsentReceiptDoc props={props} />;
    case "travel_document_verification": return <TravelDocumentDoc props={props} />;
    case "claim_package":
    case "claim_receipt": return <ClaimDoc props={props} />;
    case "diagnostic_report": return <DiagnosticReportDoc props={props} />;
    case "pharmacy_dispense": return <PharmacyDispenseDoc props={props} />;
    case "visa_support_letter": return <VisaSupportLetterDoc props={props} />;
    case "quotation": return <QuotationDoc props={props} />;
    case "guarantee_letter": return <GuaranteeLetterDoc props={props} />;
    default: return <FallbackDoc props={props} />;
  }
}

function FallbackDoc({ props }: { props: DocumentRendererProps }) {
  const d = extractData(props.credentialData);
  return (
    <DocumentShell hospitalCode={d.hospitalCode} documentNo={d.documentNo} title={props.type.replace(/_/g, " ").toUpperCase()} issuedAt={props.issuedAt} expiresAt={props.expiresAt} issuerDid={d.issuerDid}>
      <PatientBlock patientNameTh={d.patientNameTh} patientNameEn={d.patientNameEn} hn={d.patientHn} carepassId={d.patientCarepassId} />
      <div className="doc-section">
        <div className="doc-section-title">ข้อมูลเอกสาร / Document Data</div>
        <pre style={{ fontSize: "11px", whiteSpace: "pre-wrap", background: "#f9f9f9", padding: "8px", borderRadius: "4px" }}>
          {JSON.stringify(d.subject, null, 2)?.slice(0, 2000)}
        </pre>
      </div>
    </DocumentShell>
  );
}

// A4 document types list (exported for use in CredentialRenderer switch)
export const A4_DOCUMENT_TYPES = [
  "medical_certificate", "prescription", "lab_result", "immunization",
  "patient_summary", "allergy_alert", "medication_summary", "referral_vc",
  "discharge_summary", "consent_receipt", "travel_document_verification",
  "claim_package", "claim_receipt", "diagnostic_report", "pharmacy_dispense",
  "visa_support_letter", "quotation", "guarantee_letter",
];
