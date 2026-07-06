# Architecture & API Doc Update Notes (v3.38.0)

## Changes to document:

### 1. Crypto/Signing (lines ~71, ~202, ~227, ~527-548)
- OLD: "Crypto: jose (JWT), HMAC-SHA256" → NEW: "Crypto: jose (JWT), ES256 (P-256) asymmetric signing"
- OLD: "Signs the credential as SD-JWT-VC using HMAC-SHA256 (dev) or asymmetric key" → NOW: Always ES256 in production
- OLD: "JWT signature verification (HMAC or asymmetric)" → NOW: ES256 asymmetric verification
- Key source: env vars TRUSTCARE_VC_SIGNING_PRIVATE_JWK, TRUSTCARE_VC_SIGNING_PUBLIC_JWK, TRUSTCARE_VC_SIGNING_ALG (ES256), TRUSTCARE_VC_KEY_ID

### 2. New Public Endpoints (add to External Wallet section ~2429-2492)
- `GET /.well-known/jwks.json` — Public JWKS with all network + hospital keys (Cache-Control: max-age=3600)
- `GET /.well-known/did.json` — DID Document for did:web:trustcare.network
- `GET /hospital/:code/.well-known/did.json` — Per-hospital DID Document
- `GET /.well-known/did-configuration.json` — DIF Domain Linkage Credential

### 3. Avatar System (lines ~835-909, ~1483-1530)
- OLD: 4-5 shared role-based photos → NEW: 19 unique AI-generated portraits per user
- USER_AVATAR_MAP in seed.ts maps each openId to unique /manus-storage/ URL
- Male nurses now have separate image (nurseMale added to PERSON_IMAGE_URLS)
- Mr. John Williams now has Western/Caucasian portrait

### 4. Seed Data (lines ~1727-1739)
- OLD: "16 demo users" → NEW: "19 demo users" (added 3 more)
- Each user has unique AI-generated portrait matching name/gender/ethnicity
- Staff credential reseed now updates sdJwtVc on duplicate key

### 5. Test Count
- OLD: "319 test cases" → NEW: "354 test cases across 32 test files"

### 6. API Docs Page
- Add Discovery endpoints to ApiDocs.tsx: JWKS, DID Document, DID Configuration
- These are public (no auth required)

### 7. Version
- Update to v3.38.0
- Migration count: 0020 (added external_wallet_contracts in 0014-0020)
- Table count: 67+ tables
