# v3.29.0 Fix Notes - Staff Card + Role-Based Visibility

## Problem Summary (from user screenshots)
1. Staff cards show "บัตรประจำตัวผู้ป่วย" template (patient card design) instead of staff card design
2. นพ.สมชาย (system_admin) has NO card at all - shows "ยังไม่มีบัตรประจำตัวในระบบ"
3. When staff login as patient, they should see ONLY patient cards (not staff cards)

## Current Code Architecture

### PatientProfile.tsx (card display page)
- Lines 55-66: ROLE_IDENTITY_TYPES config
  - patient: { cardTypes: ["identity"], label: "บัตรประจำตัวผู้ป่วย" }
  - doctor/nurse/system_admin/hospital_admin: { cardTypes: ["identity"], label: "บัตรประจำตัวเจ้าหน้าที่โรงพยาบาล" }
- Line 124-130: identityCards filter - filters by `card.cardType` matching roleConfig.cardTypes
  - ALL roles use cardType "identity" - so ALL cards show regardless of role!
  - Problem: no distinction between patient_identity and staff_identity in cardType

### CredentialRenderer Component
- Renders the visual card - needs to check credential type to show staff vs patient template
- Currently shows patient card template for ALL identity cards

### Key Issue
- `cardType` in wallet_cards is "identity" for BOTH patient and staff cards
- Need to distinguish using `credentialType` field (patient_identity vs staff_identity)
- Filter should use credentialType, not cardType

## Fix Plan
1. Update ROLE_IDENTITY_TYPES to filter by credentialType instead of cardType
2. Fix CredentialRenderer to render staff card template (with position, hospital, employee ID)
3. Seed staff_identity credentials for ALL staff users (especially นพ.สมชาย)
4. Ensure credentialData has: fullName, position, hospitalName, employeeId, department

## DB Info
- users table: staff users have systemRole = system_admin, hospital_admin, doctor, nurse, integration_engineer
- issued_credentials table: credentialType = 'staff_identity' or 'patient_identity'
- wallet_cards table: cardType = 'identity', links to credentialId
- The filter should be: 
  - Staff role → show only cards where credentialType = 'staff_identity'
  - Patient role → show only cards where credentialType = 'patient_identity'

## Staff Users (from seed data)
- demo-staff-001 = นพ.สมชาย ระบบดี (system_admin, doctor position)
- demo-staff-002 = นางวิภา บริหารเก่ง (hospital_admin position)
- demo-staff-003 = นพ.วิชัย รักษาดี (doctor)
- demo-staff-004 = พญ.สุภาพร ใจดี (doctor)
- demo-staff-005 = นางสาวพิมพ์ใจ ดูแลดี (nurse)
- demo-staff-006 = นายธีรพงศ์ เชื่อมต่อ (integration_engineer)
