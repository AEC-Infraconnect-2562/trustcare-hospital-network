# Hospital Consolidation Analysis

## Problem
There are **6 hospital rows** in the `hospitals` table from 2 different seed sources:

### Source 1: `server/seed.ts` (DEMO_HOSPITALS) — OLD codes
| ID | Code | Name | Status |
|----|------|------|--------|
| 1 | TC-BKK | โรงพยาบาล Trustcare กรุงเทพฯ | active |
| 2 | TC-CM | โรงพยาบาล Trustcare เชียงใหม่ | active |
| 3 | TC-PKT | โรงพยาบาล Trustcare ภูเก็ต | active |

### Source 2: `server/portability/reseed.ts` (TRUSTCARE_DEMO_HOSPITALS) — CANONICAL codes
| ID | Code | Name | NameEn | Status |
|----|------|------|--------|--------|
| 4 | TCC | โรงพยาบาลทรัสต์แคร์ เซ็นทรัล | TrustCare Central Hospital | active |
| 8 | TCP | โรงพยาบาลทรัสต์แคร์ ภูเก็ต อินเตอร์เนชันแนล | TrustCare Phuket International Hospital | active |
| 9 | TCM | โรงพยาบาลทรัสต์แคร์ เชียงใหม่ ครอสบอร์เดอร์ | TrustCare Chiang Mai Cross-Border Hospital | active |

## Data Binding Analysis

### Credentials (issued_credentials.issuerHospitalId)
- All 351 credentials are bound to **new** hospitals (4, 8, 9) ✓
- Zero credentials bound to old hospitals (1, 2, 3)

### Wallet Cards (wallet_cards.issuerHospitalName)
- All wallet cards reference new hospital names ✓
- Zero reference old hospital names

### Trust Registry (trust_registry)
- 3 entries, all pointing to new hospitals (TCC, TCP, TCM) ✓

### TAO Trusted Issuers/Verifiers
- 3 issuers: Siriraj, Ramathibodi, Bumrungrad — bound to hospitalId 1, 2, 3 (OLD!)
- 4 verifiers: same 3 + NHSO — bound to hospitalId 1, 2, 3 (OLD!)
- **PROBLEM**: TAO references old hospital IDs that should be removed

### Users bound to old hospitals (1, 2, 3)
- id=408: นางวิภา บริหารเก่ง (hospital_admin) → hospitalId=1
- id=409: นพ.ธนวัฒน์ รักษาดี (doctor) → hospitalId=1
- id=410: พญ.สุภาพร ใจดี (doctor) → hospitalId=2
- id=411: นางสาวพิมพ์ใจ ดูแลดี (nurse) → hospitalId=1
- id=412: นายอนุชา ช่วยเหลือ (nurse) → hospitalId=2

### Departments bound to old hospitals
- Multiple duplicate departments (seeded multiple times) on hospitalId 1, 2, 3

## Resolution Plan

1. **Update seed.ts** to use TCC/TCP/TCM codes (matching portability seed)
2. **Migrate users** from old hospital IDs (1,2,3) to new (4,8,9):
   - hospitalId 1 (TC-BKK/กรุงเทพ) → 4 (TCC/เซ็นทรัล)
   - hospitalId 2 (TC-CM/เชียงใหม่) → 9 (TCM/เชียงใหม่)
   - hospitalId 3 (TC-PKT/ภูเก็ต) → 8 (TCP/ภูเก็ต)
3. **Migrate departments** similarly
4. **Update TAO** issuers/verifiers to reference correct hospital IDs OR re-seed as TrustCare hospitals
5. **Delete old hospital rows** (1, 2, 3)
6. **Update seed.ts** to prevent re-creation of duplicates
