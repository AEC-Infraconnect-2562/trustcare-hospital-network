# Smart Health Links Context Versioning and VC/VP Reissue Policy

**Status:** Reference architecture decision  
**Last updated:** 2026-07-01  
**Scope:** TrustCare Smart Health Links, SHL manifest versions, `ShlManifestCredential`, VP packages, consent, audit, and user notification.

## 1. Decision Summary

TrustCare uses Smart Health Links (SHL) as the transport and access mechanism. VC/VP remains the trust layer around the SHL, not a replacement for the `shlink:/...` payload.

When SHL content or context changes, TrustCare must not blindly revoke every older VC/VP and reissue a replacement. Instead, TrustCare uses a versioned SHL manifest model:

- **Supersede** older manifest versions when they were valid at the time but have been replaced by a newer package.
- **Revoke or suspend** manifest credentials only when TrustCare no longer stands behind the old claim, such as consent withdrawal, security compromise, or data correction.
- **Issue new SHL links** when purpose, context, scope, recipient policy, or risk class materially changes.
- **Create VP packages just-in-time** where possible because VPs are purpose-bound, audience-bound, and short-lived.

This preserves clinical and legal auditability while keeping active sharing safe.

## 2. Standards Basis

SMART Health Links explicitly allows the sharing user to configure what is shared, whether passcode is required, whether a link expires, and whether long-term links can evolve over time. A SHLink points to a manifest and the manifest resolves to encrypted files with standard content types:

- `application/fhir+json`
- `application/smart-health-card`
- `application/smart-api-access`

SHL files are encrypted using JOSE JWE compact serialization with `alg=dir` and `enc=A256GCM`.

The W3C Verifiable Credentials trust model expects issuers to stand behind their claims and revoke credentials quickly if they no longer stand behind those claims. For TrustCare this means revocation is a trust decision, not merely a versioning operation.

References:

- SMART Health Links Protocol Specification: https://docs.smarthealthit.org/smart-health-links/spec/
- SMART Health Cards Framework: https://spec.smarthealth.cards/
- W3C Verifiable Credentials Data Model 2.0: https://www.w3.org/TR/vc-data-model-2.0/
- RFC 7516 JSON Web Encryption: https://www.rfc-editor.org/rfc/rfc7516

## 3. State Model

### 3.1 SHL Link State

The `smart_health_links` row is the current operational state for a share link.

Recommended statuses:

| Status | Meaning |
|---|---|
| `pending_review` | SHL transport/package exists, but high-risk trust credential is waiting for Checker issuance. |
| `active` | Manifest can be resolved if passcode, expiry, and access policy checks pass. |
| `expired` | Link lifetime ended. Manifest should return not found or denied. |
| `revoked` | Sharing user/admin intentionally revoked the link. |
| `disabled` | System disabled the link due to security, bad passcode lockout, or policy violation. |
| `max_accessed` | Link reached its allowed access count. |

### 3.2 Manifest Version State

The `shl_manifest_versions` table records each immutable trust snapshot.

Recommended statuses:

| Status | Meaning |
|---|---|
| `current` | Latest active manifest for the SHL. |
| `superseded` | Older version replaced by a newer valid version. It remains audit-valid for its issuance time. |
| `revoked` | Older version should no longer be trusted due to correction, consent, security, or legal reason. |

### 3.3 File State

The `shl_files` table stores encrypted JWE files for each manifest version. Each file includes:

- `contentType`
- `embeddedJwe` or short-lived `location`
- `contentHash`
- `plaintextHash`
- `manifestVersion`
- `version`

The manifest returned to generic SHL clients must expose only standard SHL content types. TrustCare VC/VP details belong in TrustCare-specific metadata, wallet records, or verifier APIs, not as non-standard manifest file entries.

## 4. Change Classification

### 4.1 Content Refresh Within Same Context

Examples:

- New lab result arrives within a long-term treatment summary scope.
- Medication list updates within the same consent and purpose.
- FHIR bundle is regenerated from the same source-of-truth mapping.

Action:

1. Keep the same SHLink if the `L` flag / long-term policy permits updates.
2. Generate a new manifest version.
3. Encrypt new files with the existing SHL key.
4. Issue a new `ShlManifestCredential` for the new manifest hash.
5. Mark the previous manifest version as `superseded`, not `revoked`.
6. Notify the patient and relevant staff.

Reason:

The old manifest was truthful at the time it was issued. It is no longer current, but it should remain audit evidence.

### 4.2 Material Context or Scope Change

Examples:

- `self_share` changes to `cross_border`.
- A patient summary SHL expands to include claim/insurance data.
- Recipient policy changes from generic treatment to a named payer or foreign provider.
- Scope expands from summary-only to discharge/referral packet.

Action:

1. Create a new SHL with a new manifest token and key.
2. Use Maker/Checker for high-risk contexts.
3. Keep or revoke the old SHL based on user/admin decision.
4. Link old and new SHLs in audit metadata.
5. Notify the patient that a new link is required due to changed sharing context.

Reason:

The SHLink payload carries access material. Changing context/scope materially changes the trust and consent boundary. Silent mutation creates compatibility, privacy, and audit risk.

### 4.3 Consent Withdrawal or Patient Revocation

Examples:

- Patient revokes consent for treatment/referral sharing.
- Patient manually revokes the SHL.
- Consent credential is revoked or expires.

Action:

1. Revoke or disable the SHL immediately.
2. Mark current manifest version `revoked`.
3. Revoke or suspend related `ShlManifestCredential`.
4. Expire/revoke active VP packages tied to the SHL.
5. Log audit events and notify patient/staff.

Reason:

The active trust claim depends on consent. Once consent is no longer valid, TrustCare should no longer stand behind active access to the manifest.

### 4.4 Security Event

Examples:

- Passcode brute-force lockout.
- Link forwarded outside intended recipient policy.
- Suspected key compromise.
- Manifest token leak.

Action:

1. Disable or revoke the SHL.
2. Mark current manifest version `revoked`.
3. Revoke manifest VC and VP packages.
4. Require a new SHL with a new key and passcode.
5. Notify patient and hospital security/admin roles.

Reason:

SHL keys are bearer access material. A compromised key cannot be repaired by reissuing only VC metadata.

### 4.5 Data Correction or Mapping Error

Examples:

- Allergy or medication data was wrong.
- Canonical mapping produced an incorrect FHIR resource.
- Manifest hash or source bundle hash was wrong.

Action:

1. Mark the affected version `revoked`.
2. Revoke the affected `ShlManifestCredential`.
3. Issue corrected SHL manifest version or new SHL after review.
4. Add correction reason and source-of-truth reconciliation reference.
5. Notify user and recipients if required by policy.

Reason:

TrustCare no longer stands behind the older claim. This is different from normal clinical evolution.

## 5. VP Strategy

VPs should generally be short-lived and created just-in-time:

- At share time.
- At manifest access time for TrustCare-aware verifier flows.
- At explicit user request for a named recipient/audience.

Do not maintain long-lived VPs for every manifest version unless a specific cross-organization workflow requires it.

Recommended VP behavior:

| Scenario | VP Action |
|---|---|
| Normal SHL manifest request by generic client | No VP required. Return standards-compliant encrypted files. |
| TrustCare-aware receiver | Create/return verification metadata or a short-lived VP reference. |
| Manifest version superseded | Expire old VP naturally; do not revoke unless trust claim is invalid. |
| Consent/security/correction event | Revoke/expire related active VPs immediately. |

## 6. User Notification Policy

Every material SHL state change should create a notification and audit event.

Recommended messages:

- Content refresh: "Smart Health Link was updated to version N because new data is available within the same consent scope."
- Context change: "A new Smart Health Link is required because the sharing purpose or recipient policy changed."
- Revocation: "Smart Health Link was revoked and can no longer be accessed."
- Security lockout: "Smart Health Link was disabled after failed passcode attempts."
- Correction: "A previous Smart Health Link package was corrected and the old trust credential was revoked."

## 7. Backend Policy Function

Implement a policy helper that classifies SHL changes before update:

```ts
type ShlChangeAction =
  | "refresh_same_link"
  | "new_link_required"
  | "revoke_and_reissue"
  | "disable_no_reissue";

function classifyShlContextChange(input: {
  oldContextHash: string;
  newContextHash: string;
  oldScopeHash: string;
  newScopeHash: string;
  reason:
    | "source_content_refresh"
    | "scope_expanded"
    | "context_changed"
    | "consent_revoked"
    | "patient_revoked"
    | "security_event"
    | "data_correction";
  longTerm: boolean;
}): ShlChangeAction;
```

Default mapping:

| Reason | Action |
|---|---|
| `source_content_refresh` + same context/scope + `longTerm=true` | `refresh_same_link` |
| `scope_expanded` | `new_link_required` |
| `context_changed` | `new_link_required` |
| `consent_revoked` | `disable_no_reissue` |
| `patient_revoked` | `disable_no_reissue` |
| `security_event` | `disable_no_reissue` |
| `data_correction` | `revoke_and_reissue` |

## 8. Acceptance Criteria

- SHL content updates create immutable manifest versions.
- Superseded versions remain inspectable in admin/audit UI.
- Revoke is used only when the old trust claim should not be trusted.
- Context/scope expansion creates a new SHL instead of silently mutating access scope.
- Patient can see history and status changes.
- Access logs never expose passcode, raw SHL key, or plaintext clinical payload.
- Generic SHL manifest output remains standards-compatible.
