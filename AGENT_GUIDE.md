# Trustcare Hospital Network — AI Agent Development Guide

> **Version:** 2.0 (CarePass Network)  
> **Last Updated:** 2026-07-01  
> **Repository:** https://github.com/AEC-Infraconnect-2562/trustcare-hospital-network  
> **Live Preview:** https://trustcarehealth-tylvb5l8.manus.space  
> **Purpose:** This document provides all context an AI agent (Codex, Cursor, Manus, etc.) needs to understand, develop, and submit Pull Requests for this project without breaking existing functionality.

---

## 1. Project Overview

Trustcare Hospital Network is a **multi-hospital health data interoperability platform** that enables patient data portability across a hospital network using **Verifiable Credentials (VCs)**, **FHIR R4**, and **Smart Health Links (SHL)**. The system does NOT replace existing HIS/EMR systems — it bridges the gap between them, making patient data portable and frictionless.

### Core Design Principles

1. **VC-First:** Every clinical data exchange is backed by a Verifiable Credential (SD-JWT format).
2. **Patient-Centric:** Patients own their data in a "Health Wallet" using a card metaphor — zero crypto jargon.
3. **PDPA Compliant:** All data sharing requires explicit, granular, revocable consent.
4. **HIS-Agnostic:** Connects to any hospital system via adapters (REST, HL7v2, DB View, CDC, etc.).
5. **Thai-First UI:** All patient-facing text is in plain Thai. Admin interfaces support Thai labels with English identifiers.

### Key Use Cases

| Use Case | Description |
|----------|-------------|
| Cross-branch Referral | Patient transfers between hospitals in the same network with full data packet |
| Cross-border Referral | International referrals with SHL-based data sharing and jurisdiction awareness |
| E-Claim | VC-backed insurance claim submission with automated eligibility checking |
| Medical Tourist | End-to-end flow for international patients (inquiry → treatment → discharge) |
| Emergency Access | Break-glass consent override with mandatory audit trail |

---

## 2. Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | React + TypeScript | 19.x |
| Styling | Tailwind CSS | 4.x |
| UI Components | shadcn/ui (Radix primitives) | Latest |
| Routing | wouter | 3.x |
| State/Data | TanStack Query + tRPC | 5.x / 11.x |
| Backend | Express + tRPC | 4.x / 11.x |
| ORM | Drizzle ORM | 0.44.x |
| Database | MySQL (TiDB compatible) | 8.x |
| Auth | Manus OAuth (session cookie) | Built-in |
| Serialization | SuperJSON | 1.x |
| Testing | Vitest | 2.x |
| Build | Vite + esbuild | 7.x |
| Package Manager | pnpm | 10.x |

---

## 3. Repository Structure

```
trustcare-hospital-network/
├── client/                          # Frontend (React SPA)
│   ├── index.html                   # Entry HTML (Google Fonts loaded here)
│   ├── public/                      # Static config files only (favicon, robots.txt)
│   └── src/
│       ├── _core/hooks/useAuth.ts   # Auth hook (DO NOT MODIFY)
│       ├── components/
│       │   ├── DashboardLayout.tsx   # Main layout with sidebar navigation
│       │   ├── ui/                   # shadcn/ui components (DO NOT MODIFY)
│       │   └── ...
│       ├── contexts/ThemeContext.tsx  # Theme provider
│       ├── hooks/                    # Custom hooks
│       ├── lib/
│       │   ├── trpc.ts              # tRPC client binding
│       │   └── utils.ts             # cn() utility
│       ├── pages/                    # All page components (one per route)
│       ├── App.tsx                   # Route definitions
│       ├── const.ts                  # Frontend constants
│       ├── index.css                 # Global styles + Tailwind theme
│       └── main.tsx                  # App entry + providers
├── server/
│   ├── _core/                       # Framework internals (DO NOT MODIFY)
│   │   ├── index.ts                 # Express server entry
│   │   ├── trpc.ts                  # tRPC setup (publicProcedure, protectedProcedure)
│   │   ├── context.ts               # Request context builder
│   │   ├── env.ts                   # Environment variable access
│   │   ├── llm.ts                   # LLM integration helper
│   │   ├── notification.ts          # Owner notification helper
│   │   ├── oauth.ts                 # OAuth flow handler
│   │   └── ...
│   ├── db.ts                        # Database query helpers
│   ├── routers.ts                   # All tRPC procedures (main business logic)
│   ├── storage.ts                   # S3 storage helpers
│   └── *.test.ts                    # Vitest test files
├── drizzle/
│   ├── schema.ts                    # Database schema (source of truth)
│   ├── relations.ts                 # Table relations
│   └── 0001_*.sql, 0002_*.sql       # Generated migrations
├── shared/
│   ├── const.ts                     # Shared constants
│   ├── menuConfig.ts                # Sidebar menu configuration
│   └── types.ts                     # Re-exported types
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
└── todo.md                          # Feature tracking
```

### Critical Rules

- **NEVER modify** files under `server/_core/` or `client/src/_core/` — these are framework internals.
- **NEVER modify** files under `client/src/components/ui/` — these are shadcn/ui primitives.
- **NEVER store images/media** in `client/public/` or `client/src/assets/` — use S3 via `storagePut()`.
- **NEVER hardcode** port numbers in server code.
- **NEVER use** `git reset --hard` — use checkpoint rollback instead.

---

## 4. Database Schema

The database uses MySQL (TiDB) with Drizzle ORM. All schema definitions live in `drizzle/schema.ts`.

### Tables Overview

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `users` | System users (all roles) | id, openId, name, email, role, systemRole |
| `hospitals` | Network hospitals | id, name, code, did, address, status |
| `departments` | Hospital departments | id, hospitalId, name, code |
| `credential_templates` | VC template definitions | id, hospitalId, type, name, schema |
| `credentials` | Issued VCs | id, templateId, subjectId, issuerId, status, vcJwt |
| `wallet_cards` | Patient wallet cards | id, userId, credentialId, cardType, displayData |
| `presentation_history` | Wallet presentation log | id, userId, verifierName, verificationResult |
| `consent_policies` | Consent policy definitions | id, hospitalId, purpose, dataScope, retentionDays |
| `consent_records` | Patient consent grants | id, patientId, policyId, status, purpose, expiresAt |
| `referrals` | Internal referrals | id, patientId, fromHospitalId, toHospitalId, status, priority |
| `cross_border_referrals` | International referrals | id, patientId, referralType, partnerOrg, jurisdiction |
| `fhir_field_mappings` | Local→FHIR field maps | id, hospitalId, localField, fhirPath, resourceType |
| `terminology_mappings` | Code system mappings | id, hospitalId, localCode, standardCode, codeSystem |
| `audit_events` | System audit trail | id, userId, action, resourceType, resourceId, ipAddress |
| `notifications` | System notifications | id, userId, type, title, message, isRead |
| `patient_identifiers` | MPI identifiers | id, userId, identifierType, identifierValue, hospitalId |
| `mpi_matches` | MPI match records | id, identifierAId, identifierBId, matchStatus, confidence |
| `integration_adapters` | HIS/Legacy connectors | id, hospitalId, name, systemType, connectorPattern, status |
| `adapter_health_logs` | Adapter health history | id, adapterId, status, responseTimeMs |
| `mapping_versions` | Data mapping versions | id, adapterId, version, status, mappingConfig |
| `integration_event_logs` | Integration event trace | id, adapterId, eventType, direction, status |
| `trust_registry` | Trusted entities | id, entityName, entityType, did, status, verifiedAt |
| `smart_health_links` | SHL links | id, patientId, label, passcode, expiresAt, maxAccess |
| `shl_access_logs` | SHL access history | id, shlId, accessorName, accessedAt |
| `payer_adapters` | Insurance payer configs | id, payerName, payerCode, apiEndpoint, status |
| `coverage_eligibility` | Coverage check results | id, patientId, payerId, status, coverageDetails |
| `claim_cases` | E-Claim cases | id, patientId, hospitalId, payerId, claimType, status, totalAmount |
| `international_cases` | Medical tourist cases | id, patientId, hospitalId, nationality, status, phase |
| `travel_documents` | Tourist documents | id, caseId, documentType, documentNumber, verificationStatus |

### Schema Modification Workflow

1. Edit `drizzle/schema.ts` — add/modify table definitions
2. Run `pnpm drizzle-kit generate` — generates SQL migration file
3. Read the generated `.sql` file in `drizzle/` directory
4. Apply via `webdev_execute_sql` (or equivalent SQL execution tool)
5. Update `server/db.ts` with new query helpers
6. Update `server/routers.ts` with new procedures

### Enum Values (Critical for Validation)

```typescript
// User system roles
systemRole: ["system_admin", "hospital_admin", "doctor", "nurse", "integration_engineer", "patient"]

// Credential types
credentialType: ["patient_identity", "consent_receipt", "patient_summary", "allergy_alert", "medication_summary", "referral", "immunization", "insurance_eligibility"]

// Credential status
credentialStatus: ["active", "revoked", "expired", "suspended"]

// Referral status (MUST follow this exact sequence)
referralStatus: ["requested", "accepted", "in_progress", "completed", "replied", "rejected"]

// Consent purpose
consentPurpose: ["treatment", "referral", "research", "insurance", "public_health", "emergency"]

// Integration connector patterns
connectorPattern: ["api_rest", "api_graphql", "hl7v2", "db_view", "cdc", "batch_file", "dicomweb", "portal_adapter"]

// Claim status
claimStatus: ["draft", "submitted", "under_review", "approved", "rejected", "paid", "appealed"]

// International case phases
internationalPhase: ["inquiry", "document_intake", "clinical_review", "quotation", "appointment", "treatment", "discharge", "follow_up", "closed"]

// Cross-border referral types
crossBorderType: ["cross_branch", "cross_border", "external_partner"]
```

---

## 5. API Architecture (tRPC Routers)

All backend logic is in `server/routers.ts`. The router tree:

```
appRouter
├── system.*                    # System health (DO NOT MODIFY)
├── auth.me                     # Get current user (public)
├── auth.logout                 # Logout (public)
├── auth.updateProfile          # Update user profile (protected)
├── hospital.list               # List all hospitals
├── hospital.getById            # Get hospital by ID
├── hospital.create             # Create hospital (admin)
├── hospital.update             # Update hospital (admin)
├── hospital.delete             # Delete hospital (admin)
├── hospital.departments        # List departments
├── hospital.createDepartment   # Create department (admin)
├── credential.templates        # List VC templates
├── credential.createTemplate   # Create template (admin)
├── credential.list             # List credentials (with filters)
├── credential.issue            # Issue a VC (protected)
├── credential.revoke           # Revoke a VC (protected)
├── credential.getById          # Get credential detail
├── wallet.cards                # Get user's wallet cards
├── wallet.history              # Get presentation history
├── wallet.present              # Present credential via QR
├── verifier.verify             # Verify a VP (public)
├── consent.policies            # List consent policies
├── consent.createPolicy        # Create policy (admin)
├── consent.records             # List consent records
├── consent.grant               # Grant consent
├── consent.revoke              # Revoke consent
├── referral.list               # List referrals (with filters)
├── referral.getById            # Get referral detail
├── referral.create             # Create referral
├── referral.updateStatus       # Update referral status
├── fhir.mappings               # List FHIR mappings
├── fhir.createMapping          # Create FHIR mapping
├── fhir.updateMapping          # Update FHIR mapping
├── terminology.list            # List terminology mappings
├── terminology.create          # Create mapping
├── terminology.update          # Update mapping
├── terminology.suggestMapping  # LLM-assisted suggestion
├── audit.list                  # List audit events (with filters)
├── audit.export                # Export audit data
├── audit.stats                 # Audit statistics
├── notification.list           # List user notifications
├── notification.markRead       # Mark notification as read
├── dashboard.stats             # Dashboard statistics
├── dashboard.recentActivity    # Recent activity feed
├── users.list                  # List users (admin)
├── users.updateRole            # Update user role (admin)
├── patientIdentity.listIdentifiers    # List patient identifiers
├── patientIdentity.addIdentifier      # Add identifier
├── patientIdentity.listMpiMatches     # List MPI matches (admin)
├── patientIdentity.resolveMpiMatch    # Resolve MPI match (admin)
├── integration.listAdapters           # List HIS adapters
├── integration.getAdapter             # Get adapter detail
├── integration.createAdapter          # Create adapter (admin)
├── integration.updateAdapter          # Update adapter (admin)
├── integration.testConnection         # Test adapter connection (admin)
├── integration.healthLogs             # Adapter health history
├── integration.listMappingVersions    # List mapping versions
├── integration.createMappingVersion   # Create mapping version (admin)
├── integration.publishMappingVersion  # Publish version (admin)
├── integration.listEvents             # List integration events
├── trustRegistry.list                 # List trust entries
├── trustRegistry.create               # Register entity (admin)
├── trustRegistry.update               # Update entity (admin)
├── trustRegistry.verify               # Verify entity (admin)
├── shl.list                           # List SHL links
├── shl.create                         # Create SHL link
├── shl.revoke                         # Revoke SHL link
├── shl.accessLogs                     # SHL access history
├── shl.access                         # Access SHL (public)
├── claim.listPayers                   # List payer adapters
├── claim.createPayer                  # Create payer (admin)
├── claim.checkEligibility             # Check coverage eligibility
├── claim.listEligibility              # List eligibility records
├── claim.listCases                    # List claim cases
├── claim.getCase                      # Get claim detail
├── claim.createCase                   # Create claim case
├── claim.updateStatus                 # Update claim status
├── claim.validate                     # Validate claim package
├── international.listCases            # List tourist cases
├── international.getCase              # Get tourist case detail
├── international.createCase           # Create tourist case
├── international.updateStatus         # Update case status
├── international.updateCase           # Update case fields
├── international.listDocuments        # List travel documents
├── international.addDocument          # Add travel document
├── international.verifyDocument       # Verify document
├── crossBorderReferral.list           # List cross-border referrals
├── crossBorderReferral.getById        # Get detail
├── crossBorderReferral.create         # Create cross-border referral
├── crossBorderReferral.updateStatus   # Update status
├── crossBorderReferral.generatePacket # Generate SHL data packet
└── executiveDashboard.stats           # Executive KPIs
```

### Procedure Types

- **`publicProcedure`** — No auth required. Use for: login, verification endpoints, SHL access.
- **`protectedProcedure`** — Requires authenticated user (`ctx.user` available). Use for: all standard operations.
- **`adminProcedure`** — Requires `ctx.user.role === 'admin'` OR `ctx.user.systemRole === 'system_admin'`. Use for: hospital management, user management, adapter configuration.

### Adding a New Procedure

```typescript
// In server/routers.ts, inside the appRouter definition:
myFeature: router({
  list: protectedProcedure
    .input(z.object({ hospitalId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      return await db.getMyFeatureList(input.hospitalId);
    }),
  create: adminProcedure
    .input(z.object({
      name: z.string().min(1),
      hospitalId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await db.createMyFeature(input);
      // Log audit event
      await db.createAuditEvent({
        userId: ctx.user.id,
        action: "create",
        resourceType: "my_feature",
        resourceId: String(result.insertId),
        details: JSON.stringify(input),
      });
      return result;
    }),
}),
```

---

## 6. Frontend Architecture

### Route → Page Mapping

| Route | Page Component | Description |
|-------|---------------|-------------|
| `/` | Home.tsx | Landing page (unauthenticated) |
| `/dashboard` | Dashboard.tsx | Main dashboard with stats |
| `/executive` | ExecutiveDashboard.tsx | Executive KPIs |
| `/hospitals` | Hospitals.tsx | Hospital network management |
| `/wallet` | Wallet.tsx | Patient health wallet (cards) |
| `/issuer` | Issuer.tsx | VC issuance portal |
| `/verifier` | Verifier.tsx | VC verification portal |
| `/consent` | Consent.tsx | Consent management |
| `/referral` | Referral.tsx | Internal referrals |
| `/cross-border` | CrossBorder.tsx | Cross-border referrals |
| `/international` | International.tsx | Medical tourist management |
| `/claim-center` | ClaimCenter.tsx | E-Claim center |
| `/integration` | Integration.tsx | HIS integration console |
| `/fhir-mapping` | FhirMapping.tsx | FHIR field mapping |
| `/terminology` | Terminology.tsx | Terminology mapping |
| `/trust-registry` | TrustRegistry.tsx | Trust registry |
| `/shl` | SmartHealthLinks.tsx | Smart Health Links |
| `/patient-identity` | PatientIdentity.tsx | Patient MPI |
| `/audit` | Audit.tsx | Audit trail |
| `/users` | Users.tsx | User management |
| `/settings` | Settings.tsx | System settings |

### Adding a New Page

1. Create `client/src/pages/MyPage.tsx`
2. Add route in `client/src/App.tsx`:
   ```tsx
   <Route path="/my-page" component={MyPage} />
   ```
3. Add menu item in `shared/menuConfig.ts`:
   ```typescript
   {
     id: "my-page",
     label: "ชื่อเมนูภาษาไทย",
     labelEn: "English Menu Name",
     icon: "IconName", // from lucide-react
     path: "/my-page",
     roles: ["system_admin", "hospital_admin"],
     group: "admin", // one of: overview, patient, clinical, credentials, claims, interop, admin
     groupLabel: "บริหารระบบ",
     groupLabelEn: "Administration",
   }
   ```
4. Add the icon import in `DashboardLayout.tsx` if not already imported.

### Menu Groups (Sidebar)

| Group ID | Thai Label | English Label | Visible To |
|----------|-----------|---------------|------------|
| `overview` | ภาพรวม | Overview | All authenticated |
| `patient` | บริการผู้ป่วย | Patient Services | All authenticated |
| `clinical` | บริการทางคลินิก | Clinical Services | Admin, Doctor, Nurse |
| `credentials` | ใบรับรองดิจิทัล | Digital Credentials | Admin, Doctor |
| `claims` | เคลมและการเงิน | Claims & Finance | Admin, Doctor, Nurse |
| `interop` | เชื่อมต่อและมาตรฐาน | Interoperability | Admin, IntegrationEngineer |
| `admin` | บริหารระบบ | Administration | Admin only |

### Frontend Patterns

```tsx
// Data fetching
const { data, isLoading } = trpc.hospital.list.useQuery();

// Mutations with optimistic update
const createMutation = trpc.hospital.create.useMutation({
  onSuccess: () => {
    trpc.useUtils().hospital.list.invalidate();
    toast.success("สร้างโรงพยาบาลสำเร็จ");
  },
  onError: (err) => {
    toast.error(err.message);
  },
});

// Auth check
const { user, isAuthenticated, loading } = useAuth();
if (!isAuthenticated) redirect to login;

// Role check in UI
{user?.systemRole === "system_admin" && <AdminPanel />}
```

---

## 7. Role-Based Access Control

### System Roles

| Role | Thai Label | Access Level |
|------|-----------|--------------|
| `system_admin` | ผู้ดูแลระบบ | Full access to all features |
| `hospital_admin` | ผู้ดูแลโรงพยาบาล | Full access within their hospital |
| `doctor` | แพทย์ | Clinical features, issue/verify VCs |
| `nurse` | พยาบาล | Clinical features, verify VCs |
| `integration_engineer` | วิศวกรเชื่อมต่อ | Integration, FHIR, terminology |
| `patient` | ผู้ป่วย | Wallet, consent, own data only |

### Enforcing Access

- **Backend:** Use `adminProcedure` for admin-only operations. For role-specific logic, check `ctx.user.systemRole` inside the procedure.
- **Frontend:** Menu visibility is controlled by `shared/menuConfig.ts` roles array. Additional UI gating uses `useAuth().user?.systemRole`.

---

## 8. Key Business Logic

### VC Issuance Flow

1. Staff selects credential template and patient
2. System pulls FHIR data from integration adapter (or manual input)
3. System creates SD-JWT VC with hospital's DID as issuer
4. VC stored in `credentials` table, card added to patient's `wallet_cards`
5. Audit event logged, notification sent to patient

### Referral State Machine

```
Requested → Accepted → InProgress → Completed → Replied
                                                ↗
Requested → Rejected
```

**CRITICAL:** This sequence MUST be followed. No state can be skipped.

### Consent Model

- Consent is **purpose-specific** (treatment, referral, research, insurance, public_health, emergency)
- Consent is **time-limited** (expiresAt)
- Consent is **revocable** at any time
- Emergency override (break-glass) creates consent with `consentMethod: "verbal_emergency"` and triggers owner notification

### SHL (Smart Health Links) Flow

1. Patient/staff creates SHL with: label, passcode, expiry, max access count, included resources
2. System generates unique URL with embedded token
3. Recipient accesses URL, provides passcode → receives FHIR Bundle
4. Each access logged in `shl_access_logs`
5. Auto-expires based on time or access count

---

## 9. Environment Variables

| Variable | Purpose | Where Used |
|----------|---------|-----------|
| `DATABASE_URL` | MySQL connection string | server/db.ts |
| `JWT_SECRET` | Session cookie signing | server/_core |
| `VITE_APP_ID` | Manus OAuth app ID | client |
| `OAUTH_SERVER_URL` | OAuth backend URL | server/_core |
| `VITE_OAUTH_PORTAL_URL` | Login portal URL | client |
| `OWNER_OPEN_ID` | Owner's OAuth ID | server (auto-admin) |
| `BUILT_IN_FORGE_API_URL` | LLM/Storage API URL | server |
| `BUILT_IN_FORGE_API_KEY` | LLM/Storage API key | server |
| `VITE_FRONTEND_FORGE_API_KEY` | Frontend API key | client |
| `VITE_FRONTEND_FORGE_API_URL` | Frontend API URL | client |

**DO NOT** create `.env` files or hardcode these values. They are injected by the platform.

---

## 10. Testing

### Running Tests

```bash
pnpm test          # Run all tests
pnpm test -- --watch  # Watch mode
```

### Test File Convention

- Test files: `server/*.test.ts`
- Use Vitest (`describe`, `it`, `expect`)
- Mock tRPC context for procedure testing:

```typescript
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createMockContext(overrides?: Partial<TrpcContext>): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      email: "test@example.com",
      name: "Test User",
      role: "admin",
      systemRole: "system_admin",
      // ...other fields
    },
    req: { protocol: "https", headers: {} } as any,
    res: { clearCookie: () => {} } as any,
    ...overrides,
  };
}

const caller = appRouter.createCaller(createMockContext());
const result = await caller.hospital.list();
```

### What to Test

- All new tRPC procedures (happy path + error cases)
- Input validation (Zod schemas)
- Role-based access (ensure admin procedures reject non-admin users)
- Business logic (state machine transitions, eligibility checks)

---

## 11. Development Workflow for PRs

### Branch Naming

```
feat/short-description     # New features
fix/short-description      # Bug fixes
refactor/short-description # Code improvements
docs/short-description     # Documentation
```

### Commit Messages

Follow conventional commits:
```
feat(claim): add pre-authorization workflow
fix(wallet): correct QR code generation for expired cards
refactor(integration): split adapter logic into separate module
docs: update AGENT_GUIDE with new claim flow
```

### PR Checklist

Before submitting a PR, ensure:

- [ ] `pnpm test` passes with no failures
- [ ] `npx tsc --noEmit` reports no TypeScript errors
- [ ] New database tables have corresponding migration SQL
- [ ] New procedures have Vitest tests
- [ ] New pages are registered in `App.tsx` routes
- [ ] New menu items are added to `shared/menuConfig.ts`
- [ ] Thai labels are provided for all patient-facing text
- [ ] Audit events are logged for all data mutations
- [ ] No files modified under `server/_core/` or `client/src/components/ui/`
- [ ] No images stored in `client/public/`
- [ ] No hardcoded port numbers

### PR Description Template

```markdown
## Summary
Brief description of changes.

## Changes
- Added X
- Modified Y
- Fixed Z

## Database Changes
- [ ] New migration required
- [ ] Migration SQL included in PR

## Testing
- [ ] Unit tests added/updated
- [ ] Manual testing performed

## Screenshots (if UI changes)
[Attach screenshots]
```

---

## 12. Roadmap (Planned Features)

### Phase 3.0 — Advanced Features (Next Priority)

| Feature | Description | Complexity |
|---------|-------------|-----------|
| Real-time Notifications | WebSocket/SSE push notifications for referral updates, VC expiry | Medium |
| Camera QR Scanner | In-browser camera scanning for Verifier Portal | Medium |
| Seed Data Script | Demo hospitals, patients, VCs for testing | Low |
| PDF Export | Export patient summary, referral letters as PDF | Medium |
| Multi-language Toggle | Full EN/TH toggle (currently Thai-first) | Medium |
| Batch VC Issuance | Issue VCs to multiple patients at once | Medium |
| VC Renewal Workflow | Auto-notify before expiry, one-click renewal | Medium |

### Phase 4.0 — Enterprise Features

| Feature | Description | Complexity |
|---------|-------------|-----------|
| FHIR Server Facade | Expose data as FHIR R4 endpoints for external systems | High |
| HL7v2 Message Broker | Real-time ADT/ORM message processing | High |
| Blockchain Anchor | Optional DID anchoring to Thai NDID or public chain | High |
| AI Clinical Decision Support | LLM-powered clinical alerts from patient data | High |
| Mobile App (React Native) | Native wallet app with biometric auth | High |
| Analytics & BI | Advanced reporting with drill-down dashboards | Medium |
| Scheduled Jobs | Auto-expire consents, SHL links, credential status checks | Medium |

### Phase 5.0 — Ecosystem

| Feature | Description | Complexity |
|---------|-------------|-----------|
| NHSO Integration | Connect to Thai National Health Security Office | High |
| Insurance API Gateway | Direct claim submission to major Thai insurers | High |
| Pharmacy Network | VC-based prescription verification at pharmacies | Medium |
| Lab Result Sharing | Cross-hospital lab result portability | Medium |
| Telemedicine Integration | VC-based identity for telehealth sessions | Medium |

---

## 13. Common Patterns & Anti-Patterns

### DO ✅

```typescript
// Always use trpc hooks for data fetching
const { data } = trpc.hospital.list.useQuery();

// Always log audit events for mutations
await db.createAuditEvent({ userId: ctx.user.id, action: "create", ... });

// Always validate with Zod schemas
.input(z.object({ name: z.string().min(1).max(200) }))

// Always handle loading states
if (isLoading) return <Skeleton />;

// Always use Thai labels for patient-facing UI
<Button>ยืนยัน</Button>  // Not "Confirm"

// Always invalidate queries after mutations
onSuccess: () => { trpc.useUtils().hospital.list.invalidate(); }
```

### DON'T ❌

```typescript
// Never use fetch/axios directly
const res = await fetch("/api/hospitals"); // ❌ Use trpc

// Never skip audit logging
await db.deleteHospital(id); // ❌ Missing audit event

// Never use unstable references in queries
trpc.items.list.useQuery({ date: new Date() }); // ❌ Infinite loop

// Never store files in database
content: blob("content"); // ❌ Use S3

// Never hardcode roles
if (user.role === "admin") // ❌ Use adminProcedure or check systemRole

// Never skip TypeScript types
const data: any = ...; // ❌ Use proper types from schema
```

---

## 14. LLM Integration

The system uses LLM for terminology mapping suggestions. Access via `server/_core/llm.ts`:

```typescript
import { invokeLLM } from "./server/_core/llm";

const response = await invokeLLM({
  messages: [
    { role: "system", content: "You are a medical terminology expert..." },
    { role: "user", content: `Map this local code to ICD-10: ${localCode}` },
  ],
  response_format: {
    type: "json_schema",
    json_schema: { /* structured output schema */ }
  }
});
```

**Rules:**
- Only call from server-side (inside tRPC procedures)
- Always use structured output (`response_format`) for parseable results
- Include confidence scoring in responses
- Cache results to avoid redundant calls

---

## 15. Notification System

Use `notifyOwner()` for critical events:

```typescript
import { notifyOwner } from "./server/_core/notification";

await notifyOwner({
  title: "🏥 โรงพยาบาลใหม่เข้าร่วมเครือข่าย",
  content: `${hospitalName} ได้เข้าร่วมเครือข่าย Trustcare แล้ว`,
});
```

**Trigger notifications for:**
- New hospital onboarded
- VC revocation
- Break-glass emergency access
- Data quality issues
- Integration adapter failures

---

## 16. File Storage (S3)

```typescript
import { storagePut } from "./server/storage";

// Upload
const { key, url } = await storagePut(
  `${userId}/documents/${filename}`,
  fileBuffer,
  "application/pdf"
);

// Store `key` and `url` in database
// Use `url` directly in frontend: <a href={url}>Download</a>
```

---

## 17. Deployment Notes

- **Hosting:** Autoscale (serverless) on Cloud Run
- **Build:** `vite build` (frontend) + `esbuild` (backend) → single `dist/` output
- **Runtime:** Node.js only — no Python, Go, or native binaries
- **Cold starts:** Instances scale to 0 when idle
- **Request timeout:** 180 seconds max
- **Memory:** 512 MiB
- **Database:** Persistent MySQL (TiDB) — data survives deploys

---

## 18. Quick Reference Commands

```bash
# Development
pnpm dev                    # Start dev server (auto-reload)
pnpm test                   # Run tests
pnpm check                  # TypeScript check
npx tsc --noEmit            # Full type check

# Database
pnpm drizzle-kit generate   # Generate migration from schema changes
# Then apply SQL via webdev_execute_sql or direct MySQL client

# Dependencies
pnpm add <package>          # Add runtime dependency
pnpm add -D <package>       # Add dev dependency
# Restart dev server after adding dependencies
```

---

## 19. Contact & Resources

| Resource | Link |
|----------|------|
| GitHub Repository | https://github.com/AEC-Infraconnect-2562/trustcare-hospital-network |
| Live Preview | https://trustcarehealth-tylvb5l8.manus.space |
| FHIR R4 Spec | https://hl7.org/fhir/R4/ |
| W3C VC Data Model | https://www.w3.org/TR/vc-data-model-2.0/ |
| SD-JWT Spec | https://datatracker.ietf.org/doc/draft-ietf-oauth-selective-disclosure-jwt/ |
| Smart Health Links | https://docs.smarthealthit.org/smart-health-links/ |
| Thai PDPA | https://www.pdpc.or.th/ |
| Drizzle ORM Docs | https://orm.drizzle.team/ |
| tRPC Docs | https://trpc.io/docs |
| shadcn/ui | https://ui.shadcn.com/ |

---

*This guide is maintained as part of the repository. Update it whenever significant architectural changes are made.*
