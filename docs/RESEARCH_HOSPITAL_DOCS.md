# Research: Real Hospital Document Formats for VC Claims & VP Rendering

## 1. Patient Identity Card (บัตรประจำตัวผู้ป่วย)
Fields: fullNameTh, fullNameEn, dateOfBirth, gender, nationalId/passportNo, bloodType, allergies (critical), HN (hospital number), photo, issueDate, expiryDate, emergencyContact (name, phone, relationship), insuranceInfo

## 2. OPD Visit Summary (ใบสรุปการรักษาผู้ป่วยนอก)
Based on After Visit Summary (AVS) standards:
- Patient demographics (name, DOB, HN)
- Date/time of visit, provider name, department
- Chief complaint (reason for visit)
- Vital signs: BP, HR, Temp, RR, SpO2, Weight, Height, BMI
- Diagnosis (ICD-10 code + description Thai/English)
- Treatment provided (procedures, medications given)
- Medications prescribed (name, dose, route, frequency, duration, quantity)
- Follow-up instructions (plain language)
- Next appointment date
- Attending physician signature

## 3. Lab Result (ผลตรวจทางห้องปฏิบัติการ)
Standard pathology report format:
- Patient info (name, DOB, HN, age, gender)
- Ordering physician, department
- Specimen type, collection date/time, received date/time, report date/time
- Report type (CBC, Chemistry, Urinalysis, Serology, etc.)
- Test panels with individual tests:
  - Test name (Thai/English)
  - Result value
  - Unit
  - Reference range (low-high)
  - Flag (Normal/High/Low/Critical)
- Lab technician name, pathologist name
- Accreditation info (ISO 15189)

### CBC Reference Ranges (Adults):
- WBC: 4,500-11,000 /μL
- RBC: M 4.5-5.5, F 4.0-5.0 million/μL
- Hemoglobin: M 13.5-17.5, F 12.0-16.0 g/dL
- Hematocrit: M 38.3-48.6%, F 35.5-44.9%
- Platelets: 150,000-400,000 /μL
- MCV: 80-100 fL
- MCH: 27-33 pg
- MCHC: 32-36 g/dL

### Chemistry Reference Ranges:
- Glucose (fasting): 70-100 mg/dL
- BUN: 8-23 mg/dL
- Creatinine: M 0.7-1.3, F 0.6-1.1 mg/dL
- Total Cholesterol: <200 mg/dL
- Triglycerides: <150 mg/dL
- HDL: M >40, F >50 mg/dL
- LDL: <100 mg/dL (optimal)
- AST (SGOT): 10-40 U/L
- ALT (SGPT): 7-56 U/L
- Total Bilirubin: 0.3-1.2 mg/dL
- HbA1c: <5.7% (normal), 5.7-6.4% (prediabetes), ≥6.5% (diabetes)

## 4. Prescription (ใบสั่งยา)
Six required parts of a prescription:
- Prescriber info (name, license no, hospital, department)
- Patient info (name, HN, age, weight, allergies)
- Date prescribed
- Rx items (each with):
  - Drug name (generic + brand)
  - Strength/dosage form
  - Dose (amount per administration)
  - Route (oral, IV, IM, SC, topical, inhaled)
  - Frequency (OD, BID, TID, QID, PRN, HS, AC, PC)
  - Duration (days)
  - Quantity dispensed
  - Special instructions (e.g., "take with food", "avoid sunlight")
- Pharmacist dispensing notes
- Refill information

## 5. Medical Certificate (ใบรับรองแพทย์)
Standard format (based on international guidelines):
- Hospital/clinic letterhead
- Doctor info (name, license no, specialty)
- Patient info (name, DOB, ID number)
- Examination date
- Clinical findings (chief complaint, examination details, assessment)
- Certification statement:
  - Unfit for work from [date] to [date]
  - OR Fit to return to work on [date]
  - OR Fit for travel/sports/duty
- Work restrictions (if any)
- Follow-up recommendation
- Doctor signature, stamp, date
- Certificate number

## 6. Discharge Summary (ใบสรุปการจำหน่ายผู้ป่วย)
10 crucial elements:
- Patient info (name, DOB, MRN, contact)
- Healthcare details (hospital, unit, attending physician)
- Admission date, discharge date, length of stay
- Primary diagnosis (ICD-10) + secondary diagnoses + comorbidities
- Summary of hospital course (key interventions, procedures, clinical events)
- Medication list at discharge:
  - New medications (started during admission)
  - Changed medications (adjusted)
  - Unchanged medications (continued)
  - Ceased medications (stopped, with reason)
- Allergies and special considerations
- Follow-up plans and pending results
- Patient advice and self-care instructions
- Condition at discharge (improved/stable/against medical advice)

## 7. Referral Letter (ใบส่งตัว)
- Referring hospital/physician info
- Receiving hospital/physician info
- Patient info
- Reason for referral (chief complaint, clinical question)
- Clinical summary (relevant history, current medications, allergies)
- Investigations done (lab results, imaging)
- Current treatment
- Specific request (assessment, treatment, opinion)
- Urgency level (routine/urgent/emergency)
- Attachments list

## 8. Immunization Record (บันทึกการฉีดวัคซีน)
Based on CDC/WHO vaccination record:
- Patient info (name, DOB, gender)
- Vaccine name (trade name + generic)
- Manufacturer, lot/batch number
- Dose number (1st, 2nd, booster)
- Date administered
- Site of injection (left/right deltoid, thigh)
- Route (IM, SC, oral)
- Administering provider name + license
- Next dose due date
- Adverse reaction (if any)

## 9. Allergy Alert (บันทึกการแพ้ยา/อาหาร)
- Patient info
- Allergen (drug name, food, substance)
- Reaction type (anaphylaxis, rash, urticaria, angioedema, GI upset, etc.)
- Severity (mild/moderate/severe/life-threatening)
- Date of reaction
- Certainty (confirmed/suspected/unlikely)
- Source of information (patient-reported/clinician-observed/lab-confirmed)
- Cross-reactivity warnings
- Reporting clinician

## 10. Insurance Eligibility / Guarantee Letter (หนังสือรับรองสิทธิ์)
Based on Singapore hospital LOG format:
- Insurance company/payer info (name, address, phone, policy number)
- Patient info (name, DOB, policy/member number)
- Hospital info
- Guarantee details:
  - Approved amount / coverage limit
  - Coverage type (inpatient/outpatient/both)
  - Covered services (room, surgery, medications, etc.)
  - Exclusions
  - Co-payment/deductible
  - Valid from/to dates
- Authorization number
- Approved by (name, position)
- Conditions/restrictions

## 11. Medical Quotation (ใบเสนอราคาค่ารักษา)
- Hospital info
- Patient info
- Package/procedure name
- Line items:
  - Service/item description
  - Unit price
  - Quantity
  - Amount (THB)
- Subtotal
- Discount (if any)
- VAT
- Grand total
- Validity period (e.g., 30 days)
- Payment terms
- Inclusions/exclusions
- Prepared by, approved by

## 12. Appointment Slip (ใบนัดหมาย)
- Hospital info
- Patient info (name, HN)
- Appointment date/time
- Department/clinic
- Doctor name
- Purpose of visit
- Preparation instructions (fasting, bring documents, etc.)
- Location (building, floor, room)
- Contact for rescheduling

## 13. Diagnostic Report (รายงานผลวินิจฉัย - Imaging)
Based on RSNA RadReport templates:
- Patient info
- Ordering physician
- Exam type (X-ray, CT, MRI, Ultrasound)
- Body part examined
- Clinical indication
- Technique/protocol
- Findings (structured by anatomical region)
- Impression/conclusion
- Recommendations
- Radiologist name + signature
- Report date

## 14. Pharmacy Dispense Record (บันทึกการจ่ายยา)
- Patient info
- Prescription number
- Dispensing date/time
- Items dispensed:
  - Drug name (generic + brand)
  - Strength
  - Dosage form
  - Quantity dispensed
  - Directions for use
  - Expiry date
  - Lot number
- Pharmacist name + license
- Counseling notes
- Total cost

## 15. Claim Package (ชุดเอกสารเคลม)
- Claim number
- Patient/member info
- Insurance policy number
- Diagnosis (ICD-10)
- Procedure codes (ICD-9-CM)
- Service dates
- Itemized charges
- Total amount claimed
- Supporting documents list
- Hospital certification

## 16. Travel Document / Visa Support Letter
- Hospital letterhead
- Patient info + passport details
- Diagnosis and treatment plan
- Treatment dates (planned)
- Estimated cost
- Physician statement of medical necessity
- Hospital contact for verification

## 17. Patient Summary (สรุปข้อมูลผู้ป่วย - IPS)
Based on FHIR International Patient Summary:
- Patient demographics
- Active problems/conditions
- Current medications
- Allergies and intolerances
- Immunization history
- Past procedures/surgeries
- Medical devices
- Vital signs (latest)
- Lab results (recent significant)
- Advance directives
- Pregnancy status (if applicable)

## 18. MPI Link (การเชื่อมโยงข้อมูลผู้ป่วย)
- Primary identifier (HN at issuing hospital)
- Linked identifiers (HN at other hospitals, national ID, passport)
- Match confidence score
- Link date
- Verification method (manual/algorithmic/biometric)

## VP Design Principles (Printer-Friendly):
1. A4 portrait orientation (210mm x 297mm)
2. Hospital logo + name at top (bilingual Thai/English)
3. Document title prominent
4. Patient info block (photo for identity docs)
5. Structured content with clear sections and labels
6. Footer: document number, issue date, QR code for verification
7. Watermark "สำเนา" (COPY) for digital display
8. Professional fonts: Sarabun (Thai), Inter/Roboto (English)
9. Color scheme: minimal - navy headers, black text, gray borders
10. Print margins: 20mm all sides
