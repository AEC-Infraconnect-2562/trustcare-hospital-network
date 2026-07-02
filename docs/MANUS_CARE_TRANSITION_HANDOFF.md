# Manus Handoff: Care Transition and Partner Portal

Use this when applying the Codex care-transition PR in the Manus workspace.

## What Changed

- Added unified Care Transition backend router.
- Added Partner Portal backend router.
- Added Partner Portal page at `/partner-portal`.
- Upgraded `/referral`, `/cross-border`, and `/international` to use Care Transition Workspace for documents, tasks, and CP/SHL package generation.
- Added DB migration `drizzle/0012_care_transition_partner_portal.sql`.
- Added reference doc `docs/CARE_TRANSITION_PARTNER_PORTAL.md`.

## Migration Order

Apply after existing migration `0011_shl_transport_vc_trust_layer.sql`.

```sql
-- Expected new tables after 0012
care_transition_case_events
case_documents
case_tasks
partner_source_connectors
partner_source_attestations
care_packages
care_package_items
case_decisions
```

## DB Validation SQL

Run after applying migration:

```sql
SHOW TABLES LIKE 'care_transition_case_events';
SHOW TABLES LIKE 'case_documents';
SHOW TABLES LIKE 'case_tasks';
SHOW TABLES LIKE 'partner_source_connectors';
SHOW TABLES LIKE 'partner_source_attestations';
SHOW TABLES LIKE 'care_packages';
SHOW TABLES LIKE 'care_package_items';
SHOW TABLES LIKE 'case_decisions';
```

Then verify key columns:

```sql
SHOW COLUMNS FROM case_documents LIKE 'fhirDocumentReference';
SHOW COLUMNS FROM partner_source_connectors LIKE 'connectorType';
SHOW COLUMNS FROM care_packages LIKE 'manifestHash';
SHOW COLUMNS FROM case_tasks LIKE 'taskType';
```

## Seed / Smoke Data Prompt

After migration, create at least:

1. One `partner_source_connectors` record per mode:
   - `fhir_rest`
   - `hl7v2_mllp`
   - `sftp_csv`
   - `smart_health_link`
   - `native_vc_vp`
   - `manual_portal`
2. One partner inbound cross-border case using `partnerPortal.submitCase`.
3. One medical tourist case using `partnerPortal.submitCase`.
4. One internal referral case using existing `/referral` create flow.
5. At least three `case_documents` per case:
   - referral letter or patient summary
   - lab/imaging or clinical evidence
   - finance/insurance/guarantee/quotation document where applicable
6. Initialize tasks for every case using `careTransition.initializeCase`.
7. Verify at least one document and submit a VC request using `careTransition.verifyDocument({ createVcRequest: true })`.
8. Generate one care package with SHL for each flow using `careTransition.generatePackage`.

## UX Smoke Test

1. Login as staff, not patient.
2. Open `/partner-portal`.
3. Save a connector.
4. Validate connector.
5. Activate connector.
6. Submit inbound partner case with one document.
7. Open Workbench tab and verify the new case appears.
8. Verify the uploaded document.
9. Submit the document as VC request.
10. Generate care package and confirm SHL id or pending Checker review is returned.
11. Open `/referral`, select a referral, confirm workspace appears.
12. Open `/cross-border`, confirm no old hardcoded `patientId=1` packet button remains.
13. Open `/international`, select a case, add passport/insurance/quotation/discharge documents.

## Production Checks

- `pnpm check`
- `pnpm test`
- `pnpm build`

CI does not need to be overly strict for agent PRs, but these checks should pass before Manus deploy.

## Important Notes

- Do not issue clinical VC directly from partner-uploaded PDFs. Store as `DocumentReference` first, then use Maker/Checker.
- SHL is the transport. VC/VP is the trust layer around package/manifest/source claims.
- If a case has no patient id, package generation should request a patient binding before creating patient-bound SHL.
- Keep patient role blocked from Partner Portal and Maker/Checker operations.
