# TrustCare Agent Instructions

## North Star

TrustCare is a Wallet-first interoperability bridge for portable, verifiable, secure, patient-controlled health documents. It is not a HIS/EMR replacement, central health data lake, health super app, or health app aggregator.

Every integration must be contract-scoped to a real service-readiness use case and must help patients prepare, carry, request, and present trustworthy documents from their Patient Wallet while hospitals keep their existing systems of record.

## Mandatory Reading Before Any Change

- `docs/ARCHITECTURE.md`
- `docs/CONTRIBUTING.md`
- `docs/SHL_CONTEXT_VERSIONING.md` when touching SHL, manifest, passcode, access policy, or VC/VP binding
- `docs/TRUSTCARE_SYSTEM_REALIGNMENT_HANDOFF.md` when touching Service Readiness, Wallet document requests, contextual consent, or VP packets

Before code changes, inspect the current implementation that is relevant to the change. Common starting points are:

- `server/routers.ts`
- `server/db.ts`
- `drizzle/schema.ts`
- `server/prepareService.ts`
- `server/portability/*`
- `shared/rolePolicy.ts`
- `shared/menuConfig.ts`
- `client/src/pages/*`
- `client/src/components/*`
- latest migrations and seed/reseed logic

## Contribution Rules

- Never overwrite `server/routers.ts` or `drizzle/schema.ts` wholesale.
- Make incremental patches only.
- If schema changes, add a new migration and update `docs/ARCHITECTURE.md`.
- If architecture changes, update `docs/ARCHITECTURE.md`.
- If role/menu changes, update `shared/rolePolicy.ts` and `shared/menuConfig.ts`.
- If VC type changes, update all relevant enums, labels, builders, storage mappings, and tests.
- Add or update tests for every meaningful change.
- Run `pnpm check`, `pnpm test`, and `pnpm build` where possible.
- Do not merge to `main`; open draft PRs and let Manus review/merge.

## Review Guidelines

- Do not log PHI, raw Thai ID, passport, SHL key, passcode, plaintext clinical payload, JWT sensitive payload, or production secrets.
- Use synthetic seed/demo patients only in tests, docs, logs, screenshots, and PR comments.
- Verify authentication and effective role checks on every new endpoint.
- Verify patient users cannot perform issuer, Maker, Checker, or hospital staff operations.
- Verify SHL is treated as transport only; VC/VP remains the trust layer.
- Verify heavy work is async/job-based and does not block API requests.
- Verify idempotency, audit, retry, and error handling for jobs and sync-back.
- Verify migration and seed/reseed compatibility.

## Codex to Manus Workflow

See `docs/CODEX_MANUS_COLLABORATION_RULES.md`.
