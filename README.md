# TrustCare Hospital Network

**Version:** 3.20.0  
**Last Updated:** 2026-07-03  
**Stack:** React 19 + Tailwind 4 + Express 4 + tRPC 11 + Drizzle ORM + MySQL

---

## Overview

TrustCare Hospital Network is a hospital-enabled, patient-wallet-first interoperability platform that bridges legacy HIS/EMR/LIS/PACS/claims systems into a portable and verifiable VC/VP (Verifiable Credential / Verifiable Presentation) ecosystem.

The system enables:
- **Patient Wallet** — Portable health credentials, consent management, biometric access
- **Maker/Checker Workflow** — Role-based credential issuance with audit trail
- **Claim Center** — Insurance claim readiness, FHIR packaging, payer submission, adjudication, payment reconciliation
- **Cross-Border Referrals** — International patient referral with credential verification
- **Smart Health Links (SHL)** — Secure sharing of health data bundles
- **Care Transition** — Document bundles for care continuity across facilities
- **Trust Registry** — DID-based issuer/verifier trust framework

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (React 19 + Tailwind 4 + shadcn/ui)               │
│  37 pages · DashboardLayout · i18n (TH/EN)                  │
├─────────────────────────────────────────────────────────────┤
│  tRPC Layer (30 routers · type-safe · Superjson)            │
├─────────────────────────────────────────────────────────────┤
│  Backend (Express 4 + Manus OAuth + Role Guards)            │
├─────────────────────────────────────────────────────────────┤
│  Database (MySQL · 67 tables · Drizzle ORM)                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Modules

| Module | Description |
|--------|-------------|
| Patient Wallet | VC/VP storage, biometric access, consent management, QR presentation, document upload |
| Maker/Checker | Credential request workflow with role-based approval |
| Claim Center | FHIR-based claim packaging, payer adapter submission, payment reconciliation |
| Cross-Border | International referral management with credential verification |
| SHL System | Smart Health Links creation, sharing, and revocation |
| Care Transition | Document bundles for inter-facility care continuity |
| Trust Registry | DID-based issuer/verifier trust management |
| Partner Portal | External system integration via API connectors |
| Service Verification | QR-based credential verification at service points |

---

## Database

- **67 tables** across patient identity, credentials, claims, care transitions, and system management
- **18 migration batches** managed via Drizzle Kit
- **24 credential types** in the enum (patient_id, medical_certificate, lab_result, etc.)
- **6 payer adapter types** (NHSO, SSO, Private Insurance, CSMBS, Travel Insurance, Self-Pay)

---

## Testing

- **319 test cases** across 25 test files (all passing)
- **0 TypeScript errors** with strict mode enabled
- Coverage includes: role guards, maker/checker workflow, claim analytics, multi-role switching, SHL, portability, QR scanning, DICOM viewer, schema registry, contract admin CRUD

---

## Seed Data

The system includes realistic seed data for demonstration:

- **16 demo users** with unique AI-generated portrait photos
- **6 claim scenarios** covering all Thai payer types (NHSO, SSO, AIA, CSMBS, Travel, Self-Pay)
- **10 credential requests** across all workflow statuses
- **6 payer adapters** with validation rulesets
- **18 claim documents** with evidence items

---

## Standards Compliance

| Standard | Usage |
|----------|-------|
| W3C VC Data Model 2.0 | Credential issuance and verification |
| FHIR R4 | Claim, ClaimResponse, PaymentReconciliation, CoverageEligibility |
| SMART Health Links | Secure health data sharing |
| SMART Health Cards | Compact verifiable health credentials |
| HL7 IPS | Patient summary structure |
| IHE MHD | Document exchange patterns |

---

## Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Run tests
pnpm test

# Type check
pnpm check

# Generate migration
pnpm drizzle-kit generate
```

---

## Documentation

- `docs/ARCHITECTURE.md` — Full system architecture (1700+ lines)
- `docs/CONTRIBUTING.md` — Development guidelines and schema rules
- `docs/CLAIM_CENTER_RESEARCH_AND_MANUS_HANDOFF.md` — Claim Center design decisions
- `docs/CARE_TRANSITION_PARTNER_PORTAL.md` — Care transition workflow
- `docs/SHL_CONTEXT_VERSIONING.md` — SHL versioning strategy
- `docs/VC_UNIQUENESS_RULES.md` — Credential uniqueness constraints
- `docs/UX_FLOW_SYSTEM_AUDIT_2026-07-03.md` — UX audit findings
- `docs/V320_CURRENT_STATE.md` — v3.20.0 implementation state analysis
- `docs/V320_PROGRESS.md` — v3.20.0 implementation progress

---

## License

Private — AEC Infraconnect 2562
