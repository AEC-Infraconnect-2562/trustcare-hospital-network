# VP Redesign Approach - Implementation Guide

## What's Already Done
1. Added Sarabun font to client/index.html (Google Fonts)
2. Added `.vp-document` CSS class system in client/src/index.css
3. Widened Wallet.tsx dialog from max-w-lg to max-w-3xl
4. TypeScript compiles with 0 errors

## Strategy
Instead of rewriting the entire 2100-line CredentialRenderer.tsx (risky, could break things),
we will create a NEW component `DocumentRenderer.tsx` that renders A4-format documents,
and update the main switch to use it for A4-type credentials.

Card-format types (patient_identity, staff_identity, insurance_eligibility, mpi_link_certificate)
and slip-format types (appointment, sync_receipt) will KEEP their current renderers.

## DocumentRenderer.tsx - Shared A4 Document Shell
Uses `.vp-document` CSS classes. Structure:
```
<div className="vp-document">
  <div className="doc-watermark">สำเนา COPY</div>
  <div className="doc-header">
    <div className="doc-header-logo">
      <div className="hospital-icon" style={{background: brand.primary}}>{code}</div>
      <div>
        <strong>{hospital.nameTh}</strong>
        <small>{hospital.nameEn}</small>
        <small>ที่อยู่ / Address</small>
      </div>
    </div>
    <div>เลขที่: {doc.no}</div>
  </div>
  <div className="doc-title">{title}</div>
  <div className="doc-subtitle">{subtitle}</div>
  
  {/* Patient Section */}
  <div className="doc-section">
    <div className="doc-section-title">ข้อมูลผู้ป่วย / Patient Information</div>
    <div className="doc-patient-row">
      {photo && <img className="doc-patient-photo" />}
      <div className="doc-field-grid">
        <span className="doc-field-label">ชื่อ-นามสกุล</span>
        <span className="doc-field-value bold">{name}</span>
        ...
      </div>
    </div>
  </div>
  
  {/* Type-specific content sections */}
  {children}
  
  {/* Signature */}
  <div className="doc-signature">
    <div className="doc-signature-block">
      <div className="doc-signature-line" />
      <div className="doc-signature-name">{practitioner.name}</div>
      <div className="doc-signature-role">{role}</div>
    </div>
  </div>
  
  {/* Footer */}
  <div className="doc-footer">
    <span>ออกเมื่อ: {issuedAt}</span>
    <span>หมดอายุ: {expiresAt}</span>
    <span>DID: {issuer.did}</span>
  </div>
</div>
```

## Types that use DocumentRenderer (A4):
- medical_certificate
- prescription
- lab_result
- immunization
- patient_summary
- allergy_alert
- medication_summary
- referral_vc
- discharge_summary
- consent_receipt
- travel_document_verification
- claim_package / claim_receipt
- diagnostic_report
- pharmacy_dispense
- visa_support_letter
- quotation
- guarantee_letter

## Types that KEEP current card renderer:
- patient_identity (ID card)
- staff_identity (ID card)
- insurance_eligibility (insurance card)
- mpi_link_certificate (link card)
- appointment (slip)
- sync_receipt (slip)

## Hospital Address Data (for letterhead)
- TCC: โรงพยาบาลทรัสต์แคร์ เซ็นทรัล / 99 ถ.พหลโยธิน แขวงจตุจักร เขตจตุจักร กทม. 10900
- TCP: โรงพยาบาลทรัสต์แคร์ ภูเก็ต อินเตอร์เนชันแนล / 888 ถ.เทพกระษัตรี ต.เทพกระษัตรี อ.ถลาง จ.ภูเก็ต 83110
- TCM: โรงพยาบาลทรัสต์แคร์ เชียงใหม่ / 123 ถ.สุเทพ ต.สุเทพ อ.เมือง จ.เชียงใหม่ 50200
- SRR: โรงพยาบาลศิริราช / 2 ถ.วังหลัง แขวงศิริราช เขตบางกอกน้อย กทม. 10700
- RMT: โรงพยาบาลรามาธิบดี / 270 ถ.พระราม 6 แขวงทุ่งพญาไท เขตราชเทวี กทม. 10400
- BMG: โรงพยาบาลบำรุงราษฎร์ / 33 สุขุมวิท ซอย 3 แขวงคลองเตยเหนือ เขตวัฒนา กทม. 10110
- BNH: โรงพยาบาล BNH / 9/1 ถ.คอนแวนต์ แขวงสีลม เขตบางรัก กทม. 10500

## Key Implementation Notes
- DO NOT touch CredentialCompactCard (wallet list view) - it's at line 2055+
- DO NOT touch extractRenderData - it works correctly now
- The main switch at line 2021-2044 routes to card components
- For A4 types, replace the card component with DocumentRenderer + type-specific content
- Keep all field extraction logic that was fixed for object-as-child issues
