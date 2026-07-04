# Codex to Manus Collaboration Rules for TrustCare

## Roles

### Codex

- Implements scoped changes in `codex/*` branches.
- Opens draft PRs with tests, migrations, docs, acceptance notes, and Manus verification steps.
- Does not merge to `main`.
- Does not deploy.
- Fixes review comments or CI failures on the same PR branch.

### Manus

- Reviews PRs in Manus Workspace.
- Runs `pnpm check`, `pnpm test`, and `pnpm build`.
- Performs manual UI/workflow verification when needed.
- Confirms migration and seed/reseed impact.
- Merges to `main` only after evidence is recorded.
- Deploys and smoke-tests `main` after merge when appropriate.

## Branch Naming

- `codex/<phase>-<short-task>` for Codex work.
- `manus/<review-or-hotfix>-<short-task>` for Manus-originated fixes.
- `hotfix/<incident-id>` for urgent fixes.

## PR Rules

- One PR equals one reviewable feature slice.
- Keep PRs small enough for Manus to validate in isolation.
- Avoid changing `server/routers.ts`, `drizzle/schema.ts`, `shared/menuConfig.ts`, and `shared/rolePolicy.ts` together unless the change genuinely requires it.
- Schema PRs must include a migration and architecture update.
- Role/menu PRs must include role/menu tests.
- SHL PRs must review `docs/SHL_CONTEXT_VERSIONING.md` and include SHL tests.
- Heavy work must move toward async job/worker execution instead of long API requests.

## Stacked PR Rules

- Dependent PRs must be explicitly marked as stacked.
- PR titles should include the phase name and, when helpful, the base dependency.
- Manus must merge stacked PRs one by one in dependency order.
- After each merge, Codex should rebase downstream PRs onto updated `main` if conflicts appear.
- Manus should not batch-merge schema/router-heavy PRs.

## Required PR Description Sections

- Purpose
- Files changed
- Schema / migration impact
- Role / menu impact
- SHL / VC / VP / consent impact
- Tests run
- Manual Manus verification steps
- Known limitations
- Dependency on previous stacked PRs
- Rollback plan

## Manus Verification Checklist

- [ ] Confirm branch is stacked on the expected base branch
- [ ] Review diff size and scope
- [ ] pnpm check
- [ ] pnpm test
- [ ] pnpm build
- [ ] Apply migration if applicable
- [ ] Run seed/reseed if applicable
- [ ] Manual UI smoke test if applicable
- [ ] Verify no PHI/raw SHL key/passcode/plaintext appears in logs
- [ ] Verify role/menu visibility if applicable
- [ ] Verify docs/ARCHITECTURE.md updated if architecture changed
- [ ] Verify docs/SHL_CONTEXT_VERSIONING.md was reviewed if SHL changed
- [ ] Safe to merge in order: yes/no

## Bugfix / Incident Rules

Every bugfix PR must include:

- Symptom
- Reproduction steps
- Root cause
- Minimal fix
- Regression test or manual verification
- Rollback plan

## PHI / PDPA Safety

Do not paste production PHI into PR comments, prompts, logs, screenshots, fixtures, or docs. Use synthetic or masked data.
