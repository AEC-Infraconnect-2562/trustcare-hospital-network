# FHIR Labels, Icons, and Thai Document Fonts

## Label Sources

- HL7 FHIR R4 resource list is used as the stable resource vocabulary for labels such as Patient, Encounter, Observation, DiagnosticReport, MedicationRequest, Claim, ClaimResponse, DocumentReference, Provenance, and AuditEvent.
- FHIR `DocumentReference.category` and `DocumentReference.type` inform the split between high-level document category and precise document type.
- FHIR Document Class Value Set, based on LOINC document classes, informs categories such as laboratory studies, radiology studies, discharge summary, medication summary, referral note, and immunization history.

## Icon Choices

TrustCare uses `lucide-react` icons because the project already depends on Lucide, the icons are lightweight React components, and the catalog has common clinical/administrative symbols:

- `UserRound`, `Building2`, `Stethoscope`: base actors.
- `FileText`, `FileHeart`, `FileBadge`, `FileCheck2`: clinical documents.
- `Pill`, `PackageCheck`, `Syringe`: medication, dispense, immunization.
- `Microscope`, `ScanLine`: lab and imaging.
- `ShieldCheck`, `ReceiptText`, `Landmark`: coverage, claims, guarantee letters.
- `Globe2`, `CalendarDays`, `RefreshCcw`, `QrCode`: travel, appointments, sync, SHL/VP sharing.

## Thai Government-Style Fonts

Primary print font:

- `TH Sarabun New` for official Thai document styling and dense printable clinical forms.

Web fallback:

- `Sarabun`, the modern web font family distributed under SIL Open Font License 1.1.

Fallback stack:

```css
"TH Sarabun New", "Sarabun", "TH SarabunPSK", "Noto Sans Thai", Tahoma, sans-serif
```

Implementation:

- `THAI_GOVERNMENT_DOCUMENT_FONT_POLICY` in `server/portability/labels.ts` exposes the font stack.
- Reseeded VC document payloads embed the font policy in `credentialData.humanDocument` and `credentialData.trustcareSeed`.
- Future PDF/rendering work should embed the actual font binary in the renderer rather than relying only on local OS fonts.
