# TrustCare Hospital Network — API Reference

**Version:** 5.42 (SD-JWT Selective Disclosure, Wallet Sync API, DID Shortcut Routes, VP Context Mapping)  
**Last updated:** 2026-07-06  
**Base URL:** `https://trustcarehealth.live`

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Wallet Sync API](#2-wallet-sync-api)
3. [Credential Verification API](#3-credential-verification-api)
4. [SD-JWT Selective Disclosure](#4-sd-jwt-selective-disclosure)
5. [DID Resolution Endpoints](#5-did-resolution-endpoints)
6. [Well-Known Endpoints](#6-well-known-endpoints)
7. [External Wallet API (v1)](#7-external-wallet-api-v1)
8. [Error Handling](#8-error-handling)

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
| `patientId` | number | No | Optional consistency check only; it must match the authenticated patient and is never used to select another patient |
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
      "holderDid": "did:key:z...",
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

## 4. SD-JWT Selective Disclosure

SD-JWT (Selective Disclosure JWT) allows wallets to present only selected fields from a credential without revealing the full payload. This follows the IETF SD-JWT specification (draft-ietf-oauth-selective-disclosure-jwt).

### 4.1 Disclosure Policy

**`GET /api/wallet/sync/sd-jwt/policy/:credentialType`** (Public)

Returns the selective disclosure policy for a credential type.

**Response:**
```json
{
  "credentialType": "patient_identity",
  "policy": {
    "alwaysDisclosed": ["documentType", "brand", "label"],
    "selectableFields": ["patient", "clinical", "organization"],
    "neverDisclosed": ["trustcareSubjectId", "fontPolicy", "documentHash"]
  }
}
```

| Policy Category | Description |
|----------------|-------------|
| `alwaysDisclosed` | Fields always visible in any presentation (metadata) |
| `selectableFields` | Fields the holder can choose to reveal or withhold |
| `neverDisclosed` | Internal fields never included in presentations |

### 4.2 Issue SD-JWT On-Demand

**`POST /api/wallet/sync/sd-jwt/issue`** (Authenticated)

Generates an SD-JWT for an existing credential. If already generated, returns the cached version.

**Request:**
```json
{
  "credentialId": "urn:uuid:tcc-appt-416-1"
}
```

**Response:**
```json
{
  "credentialId": "urn:uuid:tcc-appt-416-1",
  "sdJwtFull": "eyJhbGciOiJFUzI1NiJ9.eyJpc3MiOi...~WyJzYWx0IiwicGF0aWVudF9uYW1lIiwiU29tY2hhaSJd~...",
  "disclosureMap": {
    "patient_name": "WyJzYWx0IiwicGF0aWVudF9uYW1lIiwiU29tY2hhaSJd",
    "date_of_birth": "WyJzYWx0IiwiZGF0ZV9vZl9iaXJ0aCIsIjE5OTAtMDEtMTUiXQ"
  },
  "policy": {
    "alwaysDisclosed": ["documentType", "brand"],
    "selectableFields": ["patient", "clinical"]
  },
  "cached": false
}
```

### 4.3 Create Selective Presentation

**`POST /api/wallet/sync/present`** (Public)

The wallet selects which fields to reveal and receives a derived SD-JWT containing only those disclosures.

**Request:**
```json
{
  "sdJwtFull": "eyJhbGciOiJFUzI1NiJ9...~disc1~disc2~disc3~",
  "selectedFields": ["patient_name", "date_of_birth"]
}
```

**Response:**
```json
{
  "presentation": "eyJhbGciOiJFUzI1NiJ9...~disc1~disc2~",
  "disclosedFields": ["patient_name", "date_of_birth"],
  "withheldFields": ["thai_id", "blood_type"],
  "totalDisclosures": 4
}
```

### 4.4 Verify Selective Presentation

**`POST /api/wallet/sync/verify-selective`** (Public)

Verifier submits a derived SD-JWT to check signature validity and disclosed claim integrity.

**Request:**
```json
{
  "presentation": "eyJhbGciOiJFUzI1NiJ9...~disc1~disc2~"
}
```

**Response:**
```json
{
  "verified": true,
  "trustLevel": "green",
  "disclosedClaims": {
    "patient_name": "สมชาย ใจดี",
    "date_of_birth": "1990-01-15"
  },
  "withheldFields": ["thai_id", "blood_type"],
  "issuer": "did:web:trustcare.network:hospital:TCC",
  "credentialType": "patient_identity",
  "dbStatus": null,
  "warnings": [],
  "errors": []
}
```

| Trust Level | Meaning |
|-------------|--------|
| `green` | Signature valid, issuer trusted, credential active |
| `yellow` | Signature valid but with warnings (e.g., HMAC signing) |
| `red` | Signature invalid, issuer untrusted, or credential revoked/suspended |

### 4.5 Sync Response — selectiveDisclosure Field

When syncing credentials via `POST /api/wallet/sync`, each credential now includes a `selectiveDisclosure` field:

```json
{
  "selectiveDisclosure": {
    "sdJwtFull": "eyJhbGciOiJFUzI1NiJ9...~disc1~disc2~...",
    "disclosureMap": {
      "patient_name": "WyJzYWx0IiwicGF0aWVudF9uYW1lIiwiU29tY2hhaSJd"
    },
    "policy": {
      "alwaysDisclosed": ["documentType"],
      "selectableFields": ["patient", "clinical"]
    }
  }
}
```

If the credential does not have an SD-JWT yet, `selectiveDisclosure` will be `null`. Use the `/sd-jwt/issue` endpoint to generate one on demand.

### 4.6 Full Flow Example

```
1. Wallet syncs credentials → POST /api/wallet/sync
2. Wallet checks policy      → GET /api/wallet/sync/sd-jwt/policy/patient_identity
3. Wallet issues SD-JWT       → POST /api/wallet/sync/sd-jwt/issue (if not cached)
4. Patient selects fields     → UI shows selectable fields from policy
5. Wallet creates presentation→ POST /api/wallet/sync/present
6. Verifier checks            → POST /api/wallet/sync/verify-selective
7. Verifier sees only selected fields + trust level
```

---
## 5. DID Resolution Endpoints

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

## 6. Well-Known Endpoints

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

## 7. External Wallet API (v1)

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

## 8. Error Handling

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

---

## Wallet Provisioning and OIDC Holder Binding

The Wallet must discover the Portal contract at:

`GET /api/wallet/provisioning/configuration`

The response is public metadata only. It advertises the configured Keycloak issuer, audience, required role, sandbox login endpoints, holder binding endpoints, and sync endpoint. An empty OIDC issuer must be treated as a deployment configuration error; Wallet clients must not invent an issuer or silently fall back to a different identity system.

### Sandbox login

Sandbox login is available only when `TRUSTCARE_KEYCLOAK_TEST_LOGIN_ENABLED=true`, a Wallet OIDC issuer is configured, and a test password is present on the server. The identities endpoint returns patient-only synthetic identities and never returns a password:

```http
GET /api/wallet/test-identities
POST /api/wallet/test-login
Content-Type: application/json

{"identityId":"demo-patient-001"}
```

The login response contains `accessToken`, `tokenType`, `expiresIn`, and the selected synthetic identity. Wallets must keep the access token in their normal session store and must use `Authorization: Bearer <accessToken>` for subsequent calls.

### Holder binding

The private holder key is generated and retained by the Wallet. Portal receives only the public JWK. The Wallet first requests a challenge:

```http
POST /api/wallet/keys/challenges
Authorization: Bearer <accessToken>
Content-Type: application/json

{"holderDid":"did:key:z...","publicKeyJwk":{"kty":"OKP","crv":"Ed25519","x":"...","alg":"EdDSA"}}
```

The Wallet signs a JWT with `iss=holderDid`, `aud=challengeId`, and payload claims `challengeId`, `nonce`, and `holderDid`, then submits it to:

`POST /api/wallet/keys/challenges/{challengeId}/complete`

Portal verifies the signature with the stored public JWK, persists the active binding, and never stores the private key. Only after this step should the Wallet proceed to credential request/submission flows. `/api/wallet/identity` and `/api/wallet/provisioning` expose the current binding state.

### OIDC security boundary

`POST /api/wallet/sync` resolves the patient from the verified OIDC token. A request-body `patientId` is never accepted as an identity selector and, if supplied, must match the authenticated patient. The same rule applies to on-demand SD-JWT issuance. Required OIDC role claims are checked from Keycloak `realm_access.roles` and the configured client resource roles.

### Wallet discovery

`GET /api/wallet/v2` returns the versioned exchange endpoints and protocol metadata. Wallet clients should discover endpoints from this response or the provisioning configuration rather than hardcoding Railway hostnames.
