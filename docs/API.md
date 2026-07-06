# TrustCare Hospital Network — API Reference

**Version:** 5.30 (Wallet Sync API, DID Shortcut Routes, VP Context Mapping)  
**Last updated:** 2026-07-06  
**Base URL:** `https://trustcarehealth.live`

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Wallet Sync API](#2-wallet-sync-api)
3. [DID Resolution Endpoints](#3-did-resolution-endpoints)
4. [Well-Known Endpoints](#4-well-known-endpoints)
5. [External Wallet API (v1)](#5-external-wallet-api-v1)
6. [Error Handling](#6-error-handling)

---

## 1. Authentication

TrustCare supports multiple authentication methods depending on the endpoint:

| Method | Format | Used By |
|--------|--------|---------|
| External Wallet Session | `Authorization: Bearer ews_<token>` | Wallet Sync API, External Wallet API |
| Portal Session Cookie | `trustcare_session=<jwt>` | tRPC procedures, Wallet Sync API |
| API Key | `X-API-Key: ewk_<key>` | External Wallet API (v1) |
| Public (no auth) | None | DID Resolution, JWKS, DID-Resolve |

### External Wallet Session Token

Obtained via `POST /api/v1/wallet/authenticate`. Tokens have the prefix `ews_` and expire after the configured session duration (default: 24 hours).

### Portal Session Cookie

Set automatically after Manus OAuth login at `/api/oauth/callback`. The session cookie is signed with `JWT_SECRET` and contains the user's OpenID.

---

## 2. Wallet Sync API

The Wallet Sync API enables external wallet applications to pull credentials and presentations for a patient. All endpoints are mounted under `/api/wallet/sync`.

### 2.1 POST /api/wallet/sync

Pull all credentials for a patient in wallet-compatible format. Supports incremental sync via the `since` parameter.

**Authentication:** Required (Bearer token or session cookie)

**Request Body:**

```json
{
  "patientId": 123,
  "since": "2026-07-01T00:00:00Z",
  "includePresentations": true,
  "limit": 100
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `patientId` | number | No | Patient ID (resolved from auth if not provided) |
| `since` | string (ISO 8601) | No | Only return credentials issued after this timestamp |
| `includePresentations` | boolean | No | Include VP records in response (default: false) |
| `limit` | number | No | Max credentials to return (default: 500, max: 1000) |

**Success Response (200):**

```json
{
  "credentials": [
    {
      "id": 1,
      "cardType": "prescription",
      "displayName": "ใบสั่งยา",
      "displayNameEn": "Prescription",
      "documentCategory": "treatment",
      "credentialId": "vc-abc123",
      "credentialStatus": "active",
      "credentialData": { "...": "..." },
      "credentialType": "prescription",
      "issuerHospitalName": "TrustCare Central Hospital",
      "issuerDid": "did:web:trustcare.network:hospital:tcc",
      "holderDid": null,
      "patientId": 123,
      "sourceSystem": "trustcare_portal",
      "issuedAt": "2026-07-01T10:00:00.000Z",
      "expiresAt": null,
      "createdAt": "2026-07-01T10:00:00.000Z",
      "lastPresentedAt": null,
      "pinned": false
    }
  ],
  "presentations": [],
  "syncedAt": "2026-07-06T12:00:00.000Z",
  "total": 15,
  "hasMore": false,
  "nextSince": null
}
```

**Error Responses:**

| Status | Error Code | Description |
|--------|-----------|-------------|
| 401 | `authentication_required` | No valid auth token or session |
| 503 | `service_unavailable` | Database not available |
| 500 | `internal_error` | Unexpected server error |

**Example (cURL):**

```bash
curl -X POST https://trustcarehealth.live/api/wallet/sync \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ews_your_session_token" \
  -d '{"includePresentations": true, "limit": 50}'
```

---

### 2.2 GET /api/wallet/sync/status

Check sync availability and statistics for the authenticated patient.

**Authentication:** Required (Bearer token or session cookie)

**Success Response (200):**

```json
{
  "patientId": 123,
  "available": true,
  "stats": {
    "totalCards": 12,
    "totalCredentials": 15,
    "activeCredentials": 10,
    "totalPresentations": 5
  },
  "lastCredentialAt": "2026-07-05T14:30:00.000Z",
  "lastPresentationAt": "2026-07-04T09:15:00.000Z"
}
```

**Error Responses:**

| Status | Error Code | Description |
|--------|-----------|-------------|
| 401 | `authentication_required` | No valid auth token or session |
| 503 | `service_unavailable` | Database not available |

---

### 2.5 POST /api/wallet/sync/did-resolve

Resolve a DID and return the public keys for credential verification. This endpoint is **public** (no authentication required) to enable any wallet to verify issuer keys.

**Authentication:** None required

**Request Body:**

```json
{
  "did": "did:web:trustcare.network:hospital:tcc"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `did` | string | Yes | The DID to resolve (must be `did:web:trustcare.network:hospital:<code>`) |

**Success Response (200):**

```json
{
  "did": "did:web:trustcare.network:hospital:tcc",
  "resolved": true,
  "verificationMethod": [
    {
      "id": "did:web:trustcare.network:hospital:tcc#vc-signing-key",
      "type": "JsonWebKey2020",
      "controller": "did:web:trustcare.network:hospital:tcc",
      "publicKeyJwk": {
        "kty": "EC",
        "crv": "P-256",
        "x": "L9NBcc2q5_9NgppWVHMhif6HRQCN9DvmK17UCok6udo",
        "y": "AZT-yBTrctZyxSfql6iyuHM4xE6-Le51NC1vEqFdqOs",
        "kid": "did:web:trustcare.network:hospital:tcc#vc-signing-key",
        "use": "sig",
        "alg": "ES256"
      }
    }
  ],
  "hospitalCode": "TCC"
}
```

**Error Responses:**

| Status | Error Code | Description |
|--------|-----------|-------------|
| 400 | `missing_did` | The `did` field is missing or empty |
| 404 | `unsupported_did` | DID method or domain not supported |

---

## 3. Credential Verification API

The verification flow for external wallets is:

1. **Sync** credentials via `POST /api/wallet/sync` — each credential includes a `proof` object with the signed JWT
2. **Verify** the JWT locally using the public key from `POST /api/wallet/sync/did-resolve` or `GET /hospital/:code/did/jwks.json`
3. **Confirm** with the issuer via `POST /api/wallet/sync/verify` for real-time revocation/suspension checks

The `proof` field in each synced credential contains:

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Always `"jwt"` |
| `jwt` | string | The complete signed SD-JWT-VC (ES256) |
| `alg` | string | Signing algorithm (from JWT header) |
| `kid` | string | Key ID (from JWT header) |

If a credential does not have a signed JWT (legacy data), `proof` will be `null`.

---

## 4. DID Resolution Endpoints

These endpoints provide standard W3C DID Web Method resolution for external verifiers and wallets.

### 4.1 GET /hospital/:code/did.json

**Shortcut route** for per-hospital DID resolution. Equivalent to `/hospital/:code/.well-known/did.json` but with a simpler URL for wallet integration.

**Authentication:** None required  
**Cache:** `public, max-age=3600`  
**Content-Type:** `application/did+ld+json`

**Path Parameters:**

| Parameter | Description |
|-----------|-------------|
| `code` | Hospital code (case-insensitive), e.g., `tcc`, `tcp`, `tcm` |

**Success Response (200):**

```json
{
  "@context": [
    "https://www.w3.org/ns/did/v1",
    "https://w3id.org/security/suites/jws-2020/v1"
  ],
  "id": "did:web:trustcare.network:hospital:tcc",
  "verificationMethod": [
    {
      "id": "did:web:trustcare.network:hospital:tcc#vc-signing-key",
      "type": "JsonWebKey2020",
      "controller": "did:web:trustcare.network:hospital:tcc",
      "publicKeyJwk": {
        "kty": "EC",
        "crv": "P-256",
        "x": "...",
        "y": "...",
        "alg": "ES256"
      }
    }
  ],
  "assertionMethod": ["did:web:trustcare.network:hospital:tcc#vc-signing-key"],
  "authentication": ["did:web:trustcare.network:hospital:tcc#vc-signing-key"],
  "service": [...]
}
```

**Error Response (404):**

```json
{
  "error": "Hospital not found",
  "did": "did:web:trustcare.network:hospital:unknown",
  "hint": "No hospital with code \"unknown\" exists in the Trustcare network."
}
```

---

### 4.2 GET /hospital/:code/did/jwks.json

Per-hospital JWKS endpoint. Returns the public signing key(s) for a specific hospital. External wallets use this to verify VC signatures from a specific issuer without resolving the full DID document.

**Authentication:** None required  
**Cache:** `public, max-age=3600`  
**Content-Type:** `application/json`

**Path Parameters:**

| Parameter | Description |
|-----------|-------------|
| `code` | Hospital code (case-insensitive), e.g., `tcc`, `tcp`, `tcm` |

**Success Response (200):**

```json
{
  "keys": [
    {
      "kty": "EC",
      "crv": "P-256",
      "x": "L9NBcc2q5_9NgppWVHMhif6HRQCN9DvmK17UCok6udo",
      "y": "AZT-yBTrctZyxSfql6iyuHM4xE6-Le51NC1vEqFdqOs",
      "kid": "did:web:trustcare.network:hospital:tcc#vc-signing-key",
      "use": "sig",
      "alg": "ES256"
    }
  ],
  "issuer": "did:web:trustcare.network:hospital:tcc",
  "hospitalCode": "TCC"
}
```

---

### 4.3 GET /hospital/:code/.well-known/did.json

Standard W3C DID Web Method resolution path for per-hospital DIDs. Same response as `/hospital/:code/did.json`.

---

## 5. Well-Known Endpoints

### 5.1 GET /.well-known/jwks.json

Returns a JSON Web Key Set containing all active public keys in the TrustCare network, including the network-level signing key and per-hospital keys.

**Response includes:**
- Network-level key: `did:web:trustcare.network#vc-signing-key-1`
- Per-hospital keys: `did:web:trustcare.network:hospital:<code>#vc-signing-key`

### 5.2 GET /.well-known/did.json

Returns the DID Document for `did:web:trustcare.network` (the network-level identity).

### 5.3 GET /.well-known/did-configuration.json

Returns a DIF Domain Linkage Credential proving that `trustcarehealth.live` is controlled by `did:web:trustcare.network`.

---

## 6. External Wallet API (v1)

The External Wallet API provides REST endpoints for third-party wallet applications under `/api/v1/`. Authentication uses API keys with scope-based authorization.

### Key Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/info` | API information and capabilities |
| POST | `/api/v1/wallet/authenticate` | Authenticate and obtain session token |
| GET | `/api/v1/contracts` | List available service contracts |
| POST | `/api/v1/credentials/present` | Present credentials to verifier |
| POST | `/api/v1/credentials/request` | Request new credentials |
| POST | `/api/v1/shl/resolve` | Resolve a Smart Health Link |
| POST | `/api/v1/shl/access` | Access SHL content |
| POST | `/api/v1/identity/link` | Link patient identity |
| POST | `/api/v1/identity/verify` | Verify patient identity |

For detailed documentation, visit the interactive API docs at `/docs/api`.

---

## 7. Error Handling

All API endpoints return consistent error responses:

```json
{
  "error": "error_code",
  "message": "Human-readable error description"
}
```

### Common Error Codes

| HTTP Status | Error Code | Description |
|-------------|-----------|-------------|
| 400 | `missing_did` | Required DID field not provided |
| 400 | `invalid_request` | Malformed request body |
| 401 | `authentication_required` | Valid authentication not provided |
| 403 | `forbidden` | Insufficient permissions |
| 404 | `not_found` | Resource not found |
| 404 | `unsupported_did` | DID method not supported |
| 429 | `rate_limited` | Too many requests |
| 500 | `internal_error` | Unexpected server error |
| 503 | `service_unavailable` | Backend service unavailable |

---

## Appendix: VP Context Mapping

When presenting credentials, the system maps `cardType` to a meaningful VP context using `contextForWalletCardType()`:

| Card Type | VP Context |
|-----------|-----------|
| `appointment` | `appointment` |
| `prescription` | `prescription` |
| `lab_result` | `lab_result` |
| `diagnostic_report` | `diagnostic_report` |
| `discharge_summary` | `discharge_summary` |
| `medical_certificate` | `medical_certificate` |
| `referral` | `referral` |
| `immunization` | `immunization` |
| `allergy` | `allergy_alert` |
| `medication` | `medication` |
| `patient_summary` | `patient_summary` |
| `consent` | `consent` |
| `identity`, `patient_identity`, `staff_identity` | `identity` |
| `coverage`, `insurance_eligibility` | `insurance` |
| `claim`, `claim_package`, `claim_receipt` | `claim` |
| `travel_document`, `travel_document_verification` | `travel_document` |
| `shl_manifest` | `shl_package` |
| `pharmacy_dispense` | `pharmacy` |
| `visa_support_letter` | `visa_support` |
| `quotation` | `quotation` |
| `guarantee_letter` | `guarantee_letter` |
| `mpi_link_certificate` | `identity_link` |
| `sync_receipt` | `sync_receipt` |

Unknown card types fall back to using the card type string itself as the context.

---

## Appendix: Wallet Deduplication Logic

The wallet display uses a deduplication algorithm to show only the most relevant credentials:

**Active Cards (Health Cards tab):**
- Cards are sorted by `issuedAt` descending (newest first)
- Only `active` status credentials are considered
- Dedup key: `${cardType}::${issuerHospitalName || 'unknown'}`
- Only the first (newest) card per dedup key is shown

**Superseded Cards (Superseded tab):**
- Includes all `revoked`, `expired`, and `suspended` credentials
- Includes older active duplicates (same cardType + issuer) marked with reason `"superseded"`
- Sorted by date descending (newest superseded first)

This ensures patients see only their most current credential per type per issuer, while maintaining full history in the Superseded tab.
