# SHL Manifest Document Bundle and Wallet Handoff

Version: v6.0-draft
Date: 2026-07-03
Owner: TrustCare Hospital Network

## Purpose

This note documents the SHL manifest document-bundle model added for Wallet and Smart Health Links. TrustCare should keep SMART Health Links as the transport layer: the QR or `shlink:/...` points to a manifest and encrypted health files. VC/VP remains the trust layer around that manifest: issuer trust, holder consent, manifest integrity, and access receipt.

The implementation now lets `/shl` and `/wallet` open an SHL package, view its QR code, inspect the manifest files, expand the clinical/administrative documents associated with the manifest, and verify the VC/VP IDs associated with the manifest.

## Research Anchors

- SMART Health Links Protocol: SHL lets a sharing user decide what to share, passcode, and expiry. A SHLink resolves to a manifest of files such as `application/fhir+json`, `application/smart-health-card`, or `application/smart-api-access`. Manifest files are encrypted with SHL-specific keys, and file locations are short-lived.
- HL7 FHIR R4 DocumentReference: DocumentReference is the FHIR resource used to index and describe document objects. It carries identifiers, status, type/category, subject, author/authenticator/custodian, security labels, content attachment, and clinical context.
- TrustCare architecture position: SHL is transport/share-link. VC/VP proves trust around the manifest. The raw SHLink itself should not be forced to be a VC.

## Runtime Contract

`shl.getById` now returns:

```ts
{
  ...shlRecord,
  files: ShlFile[],
  versions: ShlVersion[],
  accessLogs: ShlAccessLog[],
  documentBundle: {
    bundleId: string,
    manifestVersion: number,
    source: "derived_from_shl_manifest_and_fhir_bundle",
    bindingModel: string,
    standards: string[],
    status: string,
    documents: ShlManifestDocument[],
    files: ShlManifestFileObject[]
  }
}
```

Each `ShlManifestDocument` has:

```ts
{
  id: string,
  sequence: number,
  title: string,
  documentType: string,
  category: string,
  status: "available_in_manifest" | "linked_to_inactive_shl",
  sourceRole: string,
  fhirResource: string,
  contentType: string,
  manifestFileId?: string,
  manifestFileDbId?: number,
  manifestVersion: number,
  hash: {
    contentHash?: string,
    plaintextHash?: string,
    sourceBundleHash?: string
  },
  objectLinks: {
    manifest?: string,
    shlFile?: string,
    fhirDocumentReference: string,
    fhirBundle?: string,
    manifestCredential?: string,
    holderPresentation?: string,
    futureApi: string
  },
  vcBinding: {
    recommendedCredentialType?: string,
    manifestCredentialId?: string,
    presentationId?: string
  },
  accessBinding: {
    passcodeRequired: boolean,
    expiresAt?: string,
    currentAccessCount: number,
    maxAccessCount?: number
  }
}
```

## Object Link Binding Model

Use this binding chain for production data:

1. `SHL package`
2. `manifest version`
3. `manifest file` (`shl_files.file_id`, content type, encrypted hash, plaintext hash)
4. `FHIR Bundle` or `DocumentReference`
5. `ShlManifestCredential` (`manifestCredentialId`)
6. `Holder VP` (`presentationId`)
7. `access policy` (passcode, expiry, max access, revocation, audit logs)

The UI displays each manifest document with these object links:

- FHIR object: `DocumentReference/shl-{shlId}-{manifestVersion}-{documentType}`
- Manifest file: `shl://{shlId}/versions/{manifestVersion}/files/{fileId}`
- FHIR bundle: `Bundle/{sourceBundleHash}`
- Manifest VC: `Credential/{manifestCredentialId}`
- Holder VP: `Presentation/{presentationId}`
- Future object API: `/api/shl/{shlId}/manifest-documents/{documentType}`

## Current Code Path

- `server/shlDocumentManifest.ts` builds `documentBundle` from the real `shl` row and real `shl_files` rows.
- `server/routers.ts` attaches `documentBundle` in `shl.getById`.
- `client/src/pages/SmartHealthLinks.tsx` shows friendly SHL context, inline mobile details, manifest documents, object links, and VC/VP trust checks.
- `client/src/pages/Wallet.tsx` adds a Wallet SHL Packages tab with SHL list, QR, manifest documents, manifest files, technical links, and VP verification action.

## Recommended DB Upgrade for Manus

The current code derives documents from SHL context and `shl_files` so the feature can work immediately. For production-grade persistence, add a table or JSON metadata so seeded and imported SHLs carry explicit manifest document objects.

Preferred table:

```sql
CREATE TABLE shl_manifest_documents (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  shl_id BIGINT NOT NULL,
  manifest_version INT NOT NULL,
  document_id VARCHAR(128) NOT NULL,
  sequence INT NOT NULL,
  document_type VARCHAR(128) NOT NULL,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(128) NOT NULL,
  status VARCHAR(64) NOT NULL,
  source_role VARCHAR(128) NOT NULL,
  fhir_resource VARCHAR(64) NOT NULL,
  fhir_document_reference_id VARCHAR(255) NULL,
  shl_file_id VARCHAR(128) NULL,
  content_hash VARCHAR(128) NULL,
  plaintext_hash VARCHAR(128) NULL,
  source_bundle_hash VARCHAR(255) NULL,
  manifest_credential_id VARCHAR(255) NULL,
  presentation_id VARCHAR(255) NULL,
  object_links_json JSON NOT NULL,
  vc_binding_json JSON NOT NULL,
  access_binding_json JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_shl_manifest_document (shl_id, manifest_version, document_id)
);
```

Acceptable transitional approach:

- Add `metadata.documentManifest[]` to each `shl_files` row.
- Keep `documentManifest[].objectLinks` and `documentManifest[].vcBinding` in the same shape as the runtime contract above.
- Reseed all active SHLs so every manifest has realistic documents, not only a generic FHIR file.

## Seed/Reseed Requirements

Each seeded SHL should include at least these manifest documents:

- Medical tourist intake: travel identity, patient summary, treatment estimate, guarantee letter, visa/support letter.
- E-claim or insurance: coverage eligibility, claim package, invoice, receipt/payment evidence, clinical evidence or medical certificate.
- Referral or cross-branch referral: referral document, patient summary, lab results, diagnostic report, referral consent receipt.
- Cross-border referral: referral document, bilingual patient summary, consent receipt, travel identity.
- Emergency: patient identity, allergies, current medications, critical conditions summary.
- OPD or treatment share: patient identity, recent summary, current medications, allergies.

Every reseed must ensure:

- `shl.manifestCredentialId` is present for active trusted packets.
- `shl.presentationId` is present when the share is patient/holder consent-bound.
- `shl_files.contentHash`, `plaintextHash`, and `sourceBundleHash` are non-empty.
- Document objects point to an existing manifest version and file ID.
- Revoked/superseded SHLs keep document history but display `linked_to_inactive_shl`.

## Verification Flow

Verifier flow should be:

1. Decode SHLink and fetch manifest.
2. Validate passcode, expiry, max access, revocation, and audit policy.
3. Decrypt SHL file with the SHLink key.
4. Recalculate encrypted and plaintext hashes.
5. Verify Manifest VC matches manifest hash, source bundle hash, purpose, expiry, and file hashes.
6. Verify Holder VP binds the patient/holder DID and consent to this manifest or packet.
7. Open FHIR Bundle and resolve DocumentReference objects.
8. Display documents only after hash and trust checks pass.

## UX Acceptance Criteria

- `/shl` mobile: tapping an SHL item opens its detail directly under that item.
- `/shl` desktop: the selected item updates the right detail panel with context-specific copy and manifest documents.
- `/wallet`: Wallet has an SHL Packages tab, lists SHLs, shows QR for the selected package, and lets the user open manifest document bundle items.
- `/wallet`: each manifest document shows object links and VC/VP binding status.
- `/prepare-service`: only one workbench use case is selected at a time, and detail content changes by bundle type.
- Technical IDs such as `0/10` must be displayed with labels like `opened 0 of 10` or `0 opens of 10`.

## Manus Workspace Prompt

Use this prompt if Manus needs to apply DB and seed work:

```
Read docs/SHL_MANIFEST_DOCUMENT_BUNDLE_WALLET_HANDOFF.md, docs/ARCHITECTURE.md, docs/CONTRIBUTING.md, and docs/SHL_VC_VP_PACKET_TRUST_LAYER_HANDOFF.md first.

Implement persistent SHL manifest document storage for TrustCare production data. Add either shl_manifest_documents table exactly as specified in the handoff doc or a compatible metadata.documentManifest[] field on shl_files if a migration is too risky for this checkpoint. Reseed all active SHL packages so every SHL has realistic manifest documents by scenario: medical tourist, e-claim/insurance, referral/cross-branch/cross-border, emergency, OPD/treatment, pharmacy. Preserve history for revoked/superseded SHLs.

Ensure shl.getById returns documentBundle.documents with objectLinks to FHIR DocumentReference, SHL file, FHIR Bundle/sourceBundleHash, Manifest VC, Holder VP, and future object API. Ensure active trusted SHLs have manifestCredentialId, presentationId, contentHash, plaintextHash, and sourceBundleHash. Run DB validation/reseed through the real issuance path, not mock-only paths. Then test /shl and /wallet on mobile and desktop: each SHL must show QR, manifest files, manifest document bundle, and VC/VP verification status.
```
