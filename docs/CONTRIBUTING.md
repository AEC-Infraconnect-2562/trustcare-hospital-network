# Contributing to TrustCare Hospital Network

## Branch Strategy

| Branch | Purpose | Merge Target |
|--------|---------|-------------|
| `main` | Production-ready code | — |
| `codex/*` | AI-generated feature branches | `main` via PR |
| `feature/*` | Manual feature development | `main` via PR |
| `fix/*` | Bug fixes | `main` via PR |

---

## Pre-PR Checklist

Before opening a Pull Request, ensure:

- [ ] `pnpm check` (TypeScript) passes with zero errors
- [ ] `pnpm test` passes all unit tests
- [ ] `pnpm test:e2e` passes all e2e tests
- [ ] `pnpm build` succeeds (Vite bundle-size warnings are acceptable)
- [ ] New migrations are generated if schema changed
- [ ] `docs/ARCHITECTURE.md` is updated if:
  - New tables are added
  - New credential types are introduced
  - Router structure changes
  - Portability module is modified
  - New reusable components are added (e.g., QRScanner)
  - Verification flow changes

---

## Schema Change Protocol

When modifying `drizzle/schema.ts`:

1. **Never** modify existing migration SQL files
2. Run `pnpm drizzle-kit generate` to create a new migration
3. Review the generated SQL in `drizzle/` directory
4. Apply via `webdev_execute_sql` in development
5. Update `docs/ARCHITECTURE.md` Section 4 (Schema) and Section 5 (Migration Order)
6. If adding new enum values, update **all tables** that share the same enum

### Tables Sharing Credential Type Enum

These tables must stay in sync when adding new credential types:

- `credential_templates.type`
- `issued_credentials.type`
- `credential_issuance_requests.type`
- `wallet_cards.cardType` (uses different naming convention)

---

## Router Organization

The `server/routers.ts` file contains 25 routers. When it exceeds 2500 lines, split into:

```
server/routers/
  ├── index.ts          (appRouter composition)
  ├── auth.ts
  ├── portability.ts
  ├── makerChecker.ts
  └── ...
```

### Adding a New Router

1. Define the router in `server/routers.ts` (or split file)
2. Use `protectedProcedure` for authenticated endpoints
3. Use `adminProcedure` for admin-only operations
4. Add corresponding page in `client/src/pages/`
5. Register route in `client/src/App.tsx`
6. Add navigation entry in `DashboardLayout.tsx`

---

## Portability Module Guidelines

The `server/portability/` directory is the VC/VP engine. Key rules:

1. **Types first** — All new types go in `types.ts`
2. **Pure functions** — Portability functions should be pure (no DB access) except `reseed.ts`
3. **FHIR compliance** — Clinical documents must follow HL7 FHIR R4 profiles
4. **Labels required** — Every new document type needs entries in `labels.ts`:
   - `DOCUMENT_TYPE_LABELS`
   - `DOCUMENT_STORAGE_MAP`
5. **DID consistency** — Hospital DIDs use `did:web`, patient DIDs use `did:key`

---

## Maker/Checker Changes

When modifying the authorization matrix:

1. Update `systemRole` enum in `drizzle/schema.ts` if adding new roles
2. Update `requireMaker()` / `requireChecker()` helper functions
3. Update `hasCredentialEntitlement()` if changing entitlement structure
4. Update `docs/ARCHITECTURE.md` Section 3 (Authorization Matrix)
5. Add appropriate notification types for new workflow states

---

## Testing Requirements

| Change Type | Required Tests |
|-------------|---------------|
| New tRPC procedure | Unit test in `server/*.test.ts` |
| Schema change | Migration test (apply + verify) |
| VC issuance logic | Portability test with mock data |
| UI component | Manual verification via screenshot |
| Auth flow | `auth.logout.test.ts` pattern |
| QR/Scanner feature | `server/qrScanner.test.ts` pattern (data parsing + format detection) |
| Verifier changes | Ensure both `verify` and `verifyQrScan` endpoints are tested |

---

## Conflict Prevention

Common sources of merge conflicts and how to avoid them:

| File | Risk | Mitigation |
|------|------|-----------|
| `server/routers.ts` | High — multiple features touch this | Add new routers at the end, before `executiveDashboard` |
| `drizzle/schema.ts` | High — enum changes | Always extend enums, never reorder |
| `client/src/App.tsx` | Medium — route additions | Add routes alphabetically |
| `server/db.ts` | Medium — new helpers | Append new functions at the end |
| `DashboardLayout.tsx` | Low — menu items | Add items in logical groups |

### Critical Rule

> **Never overwrite `server/routers.ts` or `drizzle/schema.ts` entirely.** Always merge incrementally. These files contain accumulated business logic from multiple PRs.

---

## Environment Variables

Never hardcode secrets. Use `webdev_request_secrets` for new environment variables. Current system envs:

- `DATABASE_URL` — Database connection
- `JWT_SECRET` — Session + VC signing
- `TRUSTCARE_VC_SIGNING_SECRET` — Optional dedicated VC signing key
- `VITE_APP_ID` — OAuth app ID
- `OAUTH_SERVER_URL` — OAuth backend
