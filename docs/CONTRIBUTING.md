# Contributing to TrustCare Hospital Network

**Version:** 5.0
**Last updated:** 2026-07-02

---

## Branch Strategy

| Branch | Purpose | Merge Target |
|--------|---------|-------------|
| `main` | Production-ready code | — |
| `codex/*` | AI-generated feature branches | `main` via PR |
| `feature/*` | Manual feature development | `main` via PR |
| `fix/*` | Bug fixes | `main` via PR |

---

## Quick Start

```bash
# Clone the repository
gh repo clone AEC-Infraconnect-2562/tdc-reserve-prototype

# Install dependencies
pnpm install

# Start development server
pnpm dev

# Run tests
pnpm test

# Type check
pnpm check
```

---

## Pre-PR Checklist

Before opening a Pull Request, ensure:

- [ ] `pnpm check` (TypeScript) passes with zero errors
- [ ] `pnpm test` passes all unit tests (currently 168 tests)
- [ ] `pnpm build` succeeds (Vite bundle-size warnings are acceptable)
- [ ] New migrations are generated if schema changed
- [ ] `docs/ARCHITECTURE.md` is updated if:
  - New tables are added
  - New credential types are introduced
  - Router structure changes (currently 27 routers)
  - Avatar/photo system changes
  - Scheduled handler additions
  - Portability module is modified
  - New reusable components are added
  - Verification flow changes
  - Hospital data changes
- [ ] `docs/SHL_CONTEXT_VERSIONING.md` is reviewed when changing Smart Health Links, SHL manifests, passcode/access policy, or VC/VP bindings around SHL transport

---

## Schema Change Protocol

When modifying `drizzle/schema.ts`:

1. **Never** modify existing migration SQL files
2. Run `pnpm drizzle-kit generate` to create a new migration
3. Review the generated SQL in `drizzle/` directory
4. Apply via `webdev_execute_sql` in development
5. Update `docs/ARCHITECTURE.md` Section 5 (Schema) and Section 6 (Migration Order)
6. If adding new enum values, update **all tables** that share the same enum

### Tables Sharing Credential Type Enum

These tables must stay in sync when adding new credential types:

- `credential_templates.type`
- `issued_credentials.type`
- `credential_issuance_requests.type`
- `wallet_cards.cardType` (uses different naming convention)

### Current Schema Stats

- **42 tables** total
- **12 migrations** (0000–0011)
- **24 credential types** in the enum

---

## Hospital Data Rules

### Canonical Source (CRITICAL)

The **single source of truth** for hospital definitions is:

```
server/portability/seedData.ts → TRUSTCARE_DEMO_HOSPITALS
```

Both `server/seed.ts` and `server/portability/reseed.ts` reference this array. **Never create hospital entries from any other source.** This prevents the duplicate hospital bug that was fixed in v4.2.

### Hospital Codes (3 Hospitals Only)

| Code | Hospital | DID |
|------|----------|-----|
| TCC | โรงพยาบาลทรัสต์แคร์ เซ็นทรัล (TrustCare Central Hospital) | `did:web:trustcare.network:hospital:tcc` |
| TCP | โรงพยาบาลทรัสต์แคร์ ภูเก็ต อินเตอร์เนชันแนล (TrustCare Phuket International Hospital) | `did:web:trustcare.network:hospital:tcp` |
| TCM | โรงพยาบาลทรัสต์แคร์ เชียงใหม่ ครอสบอร์เดอร์ (TrustCare Chiang Mai Cross-Border Hospital) | `did:web:trustcare.network:hospital:tcm` |

### DID Format

- Hospital: `did:web:trustcare.network:hospital:{lowercase_code}`
- Network: `did:web:trustcare.network`
- Patient: `did:key:z{base58(ed25519-multicodec)}`

---

## Router Organization

The `server/routers.ts` file contains **27 routers** (~3628 lines). When it exceeds 4000 lines, split into:

```
server/routers/
  ├── index.ts          (appRouter composition)
  ├── auth.ts
  ├── portability.ts
  ├── makerChecker.ts
  └── ...
```

### Current Routers (27)

```
auth · seed · makerChecker · hospital · credential · wallet · verifier ·
consent · referral · fhir · terminology · audit · notification · dashboard ·
users (incl. uploadPhoto/getPhoto) · patientIdentity · integration ·
trustRegistry · shl · claim (incl. analytics) · international ·
crossBorderReferral · portability (incl. DQI) · executiveDashboard ·
tao · schemaRegistry
```

### Adding a New Router

1. Define the router in `server/routers.ts` (or split file)
2. Use `protectedProcedure` for authenticated endpoints
3. Use `adminProcedure` for admin-only operations
4. Add corresponding page in `client/src/pages/`
5. Register route in `client/src/App.tsx`
6. Add navigation entry in `DashboardLayout.tsx`
7. Update `shared/menuConfig.ts` for role-based visibility

---

## Portability Module Guidelines

The `server/portability/` directory is the VC/VP engine (17 modules). Key rules:

1. **Types first** — All new types go in `types.ts`
2. **Pure functions** — Portability functions should be pure (no DB access) except `reseed.ts`
3. **FHIR compliance** — Clinical documents must follow HL7 FHIR R4 profiles
4. **Labels required** — Every new document type needs entries in `labels.ts`:
   - `DOCUMENT_TYPE_LABELS`
   - `DOCUMENT_STORAGE_MAP`
5. **DID consistency** — Hospital DIDs use `did:web`, patient DIDs use `did:key`
6. **Trust registry** — Any new issuer DID must be added to `trust_registry` with `trustLevel = "verified"`

### Portability Modules (17 files)

| Module | Purpose |
|--------|---------|
| `vc.ts` | Issue/verify VC, create/verify VP |
| `did.ts` | DID generation (did:web, did:key) |
| `fhir.ts` | HIS → FHIR R4 canonicalization |
| `policy.ts` | Consent-based access control |
| `presentation.ts` | JSON VP verification |
| `syncBack.ts` | HIS/Legacy sync-back plans |
| `sourceTruth.ts` | CSV/DB import + review |
| `seedData.ts` | Demo hospital/patient generation |
| `reseed.ts` | DB reseed orchestrator |
| `labels.ts` | Document taxonomy + storage metadata |
| `trust.ts` | Trust registry policy builder |
| `clinicalDocuments.ts` | FHIR Composition builders |
| `types.ts` | Shared type definitions |
| `shl.ts` | SHL payload, passcode hash, JWE manifest |
| `shlSimulator.ts` | Realistic HIS/legacy source scenarios |
| `utils.ts` | sha256, nanoid, date helpers |
| `index.ts` | Re-exports all public APIs |

---

## Role Policy & Patient Restriction Rules

The role policy engine lives in `shared/rolePolicy.ts` and is the single source of truth for authorization decisions.

### System Roles (8 roles)

```typescript
type SystemRole = 
  | 'system_admin'
  | 'hospital_admin'
  | 'doctor'
  | 'nurse'
  | 'integration_engineer'
  | 'maker'
  | 'checker'
  | 'patient';
```

### Additional Roles (via user_roles table)

```typescript
type AdditionalRole = 'issuer_maker' | 'issuer_checker';
```

### Patient Restrictions

Patients are fundamentally restricted from issuer-level operations:

1. **Never grant issuer privileges to patients.** The `sanitizeAdditionalRolesForSystemRole()` function strips `issuer_maker` and `issuer_checker` from any user whose `systemRole === 'patient'`.
2. **Staff can act as patients, but not vice versa.** The `availableRolesForSystemRole()` function always includes `patient` for staff users, but patients cannot assume any staff role.
3. **Credential entitlements are null for patients.** The `normalizeCredentialEntitlements()` function returns empty arrays for `makerTypes` and `checkerTypes` when the user is a patient.
4. **Frontend menu visibility must use `activeRole`.** Do not check `systemRole` alone for menu filtering.
5. **Backend procedures must validate the effective role.** Use `normalizeActiveRole()` in context building.

### Adding New Roles

1. Add the role to the appropriate set in `shared/rolePolicy.ts`
2. Update `shared/menuConfig.ts` to define menu visibility
3. Update `DashboardLayout.tsx` `allMenuItems` to match
4. Add seed users for the new role in `server/portability/seedData.ts`
5. Write tests in `server/role-policy.test.ts`

---

## Maker/Checker Workflow

### Credential Entitlements

Each user has a `credentialEntitlements` JSON field:

```json
{
  "makerTypes": ["medical_certificate", "prescription", "lab_result"],
  "checkerTypes": ["medical_certificate", "prescription", "lab_result"]
}
```

- `"*"` grants access to all 24 document types
- Checked by `hasCredentialEntitlement(user, key, credentialType)`

### When Modifying the Authorization Matrix

1. Update `systemRole` enum in `drizzle/schema.ts` if adding new roles
2. Update `requireMaker()` / `requireChecker()` helper functions
3. Update `hasCredentialEntitlement()` if changing entitlement structure
4. Update `docs/ARCHITECTURE.md` Section 4 (Authorization Matrix)
5. Add appropriate notification types for new workflow states

---

## Trust Registry Rules

### Internal Trust Registry (`trust_registry` table)

- Only TrustCare network hospitals + network-level issuer (4 entries total)
- `trustLevel` must be `"verified"` for issuers to pass verification
- `isActive` must be `true`
- Managed via `trustRegistry.*` tRPC procedures

### TAO Trust Framework (`tao_trusted_issuers` / `tao_trusted_verifiers`)

- External organizations only (Siriraj, Ramathibodi, Bumrungrad, NHSO)
- `hospitalId = NULL` — they are NOT part of TrustCare network
- Trust levels: `accredited`, `recognized`, `self_declared`
- Trust anchors: `moph` (Ministry of Public Health), `self`
- Managed via `tao.*` tRPC procedures

### Verification Policy

The `buildTrustRegistryPolicy()` function in `server/portability/trust.ts`:
1. Queries `trust_registry` table
2. Filters entries where `trustLevel === "verified"` AND `isActive === true`
3. Returns `{ trustedIssuers: string[] }` for use in `verifyCredential()`

---

## Testing Requirements

### Current Test Suite: 168 tests (15 unit + 1 E2E)

| Change Type | Required Tests |
|-------------|---------------|
| New tRPC procedure | Unit test in `server/*.test.ts` |
| Schema change | Migration test (apply + verify) |
| VC issuance logic | Portability test with mock data |
| Auth flow | `auth.logout.test.ts` pattern |
| Role changes | `role-policy.test.ts`, `role-guard.test.ts` |
| Trust registry | `tao-consent.test.ts` |
| SHL changes | `shl.test.ts` |
| Maker/Checker | `maker-checker.test.ts` |

### Running Tests

```bash
# All tests
pnpm test

# Specific test file
pnpm test -- portability

# Watch mode
pnpm test -- --watch

# E2E only
pnpm test -- e2e
```

---

## Seed Data Management

### When to Reseed

- After schema changes that affect credential structure
- After adding new credential types
- After hospital consolidation/changes
- When demo data becomes stale

### Reseed Process

```bash
# Via tRPC (admin only)
# Call portability.reseedDb mutation with:
{
  resetExistingSeed: true,  // Clears old seed data
  patientsPerHospital: 12   // Default
}
```

### Demo Patient Binding

After reseeding, demo patients (demo-patient-001/002/003) must be re-bound to seed patient data. This is handled by the `bind-demo-patients.mjs` script or manually via SQL.

| Demo Patient | Seed Source | Hospital |
|-------------|-------------|----------|
| demo-patient-001 (id=414) | seed-patient-tcc-p001 | TCC |
| demo-patient-002 (id=415) | seed-patient-tcp-p001 | TCP |
| demo-patient-003 (id=416) | seed-patient-tcm-p001 | TCM |

---

## Credential Type Enum (24 Types)

When adding new credential types, update ALL of these locations:

1. `drizzle/schema.ts` — `credentialTypeEnum` definition
2. `server/portability/seedData.ts` — Document type metadata
3. `server/portability/labels.ts` — Category/subcategory mapping
4. `server/portability/vc.ts` — VC builder function
5. `server/portability/types.ts` — Type definitions
6. `shared/rolePolicy.ts` — Entitlement checks (if restricted)
7. Generate and apply migration for enum expansion

Current types:
```
patient_identity, consent_receipt, mpi_link_certificate,
patient_summary, allergy_alert, immunization, medical_certificate,
medication_summary, prescription, pharmacy_dispense,
lab_result, diagnostic_report,
referral_vc, discharge_summary,
insurance_eligibility, claim_package, claim_receipt,
travel_document_verification, visa_support_letter, quotation, guarantee_letter,
shl_manifest, sync_receipt,
appointment
```

---

## Conflict Prevention

Common sources of merge conflicts and how to avoid them:

| File | Risk | Mitigation |
|------|------|-----------|
| `server/routers.ts` | High — multiple features touch this | Add new routers at the end |
| `drizzle/schema.ts` | High — enum changes | Always extend enums, never reorder |
| `client/src/App.tsx` | Medium — route additions | Add routes alphabetically |
| `server/db.ts` | Medium — new helpers | Append new functions at the end |
| `DashboardLayout.tsx` | Low — menu items | Add items in logical groups |

### Critical Rule

> **Never overwrite `server/routers.ts` or `drizzle/schema.ts` entirely.** Always merge incrementally. These files contain accumulated business logic from multiple PRs.

---

## Environment Variables

Never hardcode secrets. Use `webdev_request_secrets` for new environment variables. Current system envs:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Database connection string |
| `JWT_SECRET` | Session cookie + VC signing |
| `TRUSTCARE_VC_SIGNING_SECRET` | Optional dedicated VC signing key |
| `VITE_APP_ID` | OAuth application ID |
| `OAUTH_SERVER_URL` | OAuth backend URL |
| `VITE_OAUTH_PORTAL_URL` | OAuth login portal |
| `OWNER_OPEN_ID` | Owner's OpenID |
| `BUILT_IN_FORGE_API_URL` | Internal API URL |
| `BUILT_IN_FORGE_API_KEY` | Internal API key (server-side) |
| `VITE_FRONTEND_FORGE_API_KEY` | Frontend API key |

---

## Deployment

- **Hosting:** Manus Autoscale (serverless, Node.js runtime)
- **Build:** `pnpm build` produces `dist/` (Vite frontend + compiled server)
- **Port:** Dynamic (never hardcode)
- **Database:** TiDB-compatible MySQL
- **Storage:** S3-compatible object storage
- **No Docker** — runs directly on Node.js
- **Request timeout:** 180s
- **Memory:** 512 MiB RAM

---

## Commit Message Convention

```
feat(portability): add new credential type for pharmacy dispense
fix(wallet): correct card count display for multi-hospital patients
docs(architecture): update schema documentation for v4.3
refactor(trust): consolidate trust registry queries
test(e2e): fix portability flow test issuer DID
chore(deps): upgrade drizzle-orm to 0.44
```

---

## Common Pitfalls

1. **Duplicate hospitals** — Always use `TRUSTCARE_DEMO_HOSPITALS` as canonical source
2. **Trust registry mismatch** — Ensure issuer DID in credentials matches trust registry entries with `trustLevel = "verified"`
3. **Demo patient binding** — After reseed, demo patients need data re-binding
4. **Enum expansion** — Adding credential types requires migration + multiple file updates
5. **SHL manifest tokens** — Must be unique and URL-safe (nanoid)
6. **Credential IDs** — Format: `urn:trustcare:{type}:{hospitalCode}:{nanoid}`
7. **Wallet card patientId** — Must match the user ID of the patient who will view it
8. **TAO external orgs** — Must have `hospitalId = NULL`, never bind to TrustCare hospitals
