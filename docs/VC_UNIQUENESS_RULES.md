# VC Uniqueness Rules — TrustCare Hospital Network

## Principle

Based on W3C VC Lifecycle, FHIR DocumentReference `relatesTo.code=replaces` semantics, and healthcare credential best practices:

> **Singleton credentials** represent a "current state" about a patient. When re-issued, the previous version MUST be revoked and archived to `history`. Only one active instance per (patient, hospital, documentType) tuple is valid at any time.

> **Accumulative credentials** represent discrete events or transactions. Multiple active instances per patient are valid and expected.

---

## Classification

### Singleton (Unique per patient per hospital — re-issue revokes previous)

| Document Type | Rationale |
|---------------|-----------|
| `patient_identity` | A patient has exactly one active identity card per hospital. Re-registration supersedes. |
| `consent_receipt` | Only the latest consent state is authoritative. Previous consent is superseded. |
| `mpi_link_certificate` | One active MPI link per patient per hospital. Re-linking supersedes. |
| `patient_summary` | IPS (International Patient Summary) is a point-in-time snapshot. New summary replaces old. |
| `allergy_alert` | Current allergy profile. Updated profile supersedes previous. |
| `medication_summary` | Current medication list. Updated list supersedes previous. |
| `insurance_eligibility` | Current coverage status. New eligibility check supersedes old. |

### Singleton (Unique per patient NETWORK-WIDE)

| Document Type | Rationale |
|---------------|-----------|
| `patient_identity` | If MPI-linked, only one canonical identity across the network. |

### Accumulative (Multiple active allowed)

| Document Type | Rationale |
|---------------|-----------|
| `immunization` | Each vaccination is a separate event. Multiple records expected. |
| `medical_certificate` | Each certificate is for a specific purpose/date. |
| `prescription` | Each prescription is a discrete order. |
| `pharmacy_dispense` | Each dispense event is separate. |
| `lab_result` | Each lab test is a discrete result. |
| `diagnostic_report` | Each imaging/diagnostic study is separate. |
| `referral_vc` | Each referral is a discrete care transition event. |
| `discharge_summary` | Each admission/discharge is a separate episode. |
| `claim_package` | Each claim submission is separate. |
| `claim_receipt` | Each claim response is separate. |
| `travel_document_verification` | Each verification event is separate. |
| `visa_support_letter` | Each letter is for a specific trip/purpose. |
| `quotation` | Each quotation is a separate offer. |
| `guarantee_letter` | Each guarantee is for a specific episode. |
| `shl_manifest` | Each SHL package is a separate sharing event. |
| `sync_receipt` | Each sync-back event is separate. |
| `appointment` | Each appointment is a discrete scheduled event. |

---

## Implementation

### Enforcement Logic

```typescript
const SINGLETON_CREDENTIAL_TYPES = [
  'patient_identity',
  'consent_receipt',
  'mpi_link_certificate',
  'patient_summary',
  'allergy_alert',
  'medication_summary',
  'insurance_eligibility',
] as const;

type SingletonCredentialType = typeof SINGLETON_CREDENTIAL_TYPES[number];

function isSingletonType(type: string): type is SingletonCredentialType {
  return SINGLETON_CREDENTIAL_TYPES.includes(type as SingletonCredentialType);
}
```

### On Issuance (Maker/Checker flow)

1. Before issuing a new credential, check if `isSingletonType(documentType)`.
2. If singleton: query for existing active credential with same `(subjectId, issuerHospitalId, type)`.
3. If found: automatically revoke the old credential with reason `"superseded"` and set `revokedAt = now()`.
4. The old credential remains in `issued_credentials` with `status = 'revoked'` for audit/history.
5. The wallet card for the old credential is marked `status = 'revoked'` (not deleted).
6. Issue the new credential normally.

### On Wallet Display

- Revoked singleton credentials appear in a "History" section with visual indicator (strikethrough, grey, "superseded" badge).
- Active credentials appear in the main view.
- Filter: "Show history" toggle reveals superseded credentials.

### On Verification

- Verifier checks `credentialStatus` — revoked credentials fail verification with reason `"superseded"`.
- The verification result should indicate: "This credential has been superseded by a newer version issued on [date]."

---

## FHIR Alignment

This follows FHIR DocumentReference lifecycle:
- `relatesTo.code = "replaces"` — new document replaces old
- Old document status → `entered-in-error` or `superseded`
- IHE MHD: Document replacement creates a new DocumentReference with `relatesTo` pointing to the replaced document

---

## Edge Cases

1. **Cross-hospital singleton**: `patient_identity` is singleton per hospital. If MPI-linked, the network-level identity is also singleton but managed by the MPI system, not individual hospitals.
2. **Consent versioning**: Consent receipts are singleton per (patient, hospital, purpose). If consent has multiple purposes, each purpose has its own singleton.
3. **Allergy updates**: When a new allergy is discovered, the entire allergy profile is re-issued (not just the new allergy). The old profile is superseded.
4. **Insurance re-verification**: When insurance is re-verified (e.g., annually), the old eligibility credential is superseded.

---

## Audit Trail

All revocations due to supersession are logged in `audit_logs` with:
- `action = "credential_superseded"`
- `details = { oldCredentialId, newCredentialId, reason: "superseded" }`
- `performedBy` = the issuer who created the new credential
