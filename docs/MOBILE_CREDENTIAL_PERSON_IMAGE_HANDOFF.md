# Mobile Credential Person Image Fix Handoff

Date: 2026-07-03

## Goal

Every person photo shown in wallet credentials, patient profile credentials, and credential detail renderers must use the real photo bound to the wallet owner or credential subject whenever available. Demo default real-photo assets are only a last-resort demo fallback, not the source of truth.

## Root Causes Found

1. `wallet.cardsByCategory` returned wallet cards and `credentialData`, but did not include the wallet owner's `users.avatarUrl`. UI code then guessed from the current session, which is not reliable for staff/verifier/prepare-service flows or for future wallet-owner contexts.
2. Credential UI components tried exactly one image URL and then hid the `<img>` on `onError`. On mobile this created blank photo frames in patient identity cards and compact wallet cards.
3. The service worker used cache-first behavior for `/manus-storage/*`. If a mobile browser cached a stale 404/non-image response, later production fixes could still show a blank image.
4. Photo URL handling was duplicated in `CredentialRenderer`, `Wallet`, and `PatientProfile`, so fixes could miss one surface.

## Code Changes

| Area | Change |
|------|--------|
| `shared/personImages.ts` | Centralized photo URL normalization, storage cache-busting, candidate ordering, and role/gender demo fallback rules. |
| `client/src/components/PersonPhoto.tsx` | Reusable image component that retries ordered photo sources before rendering an icon fallback. |
| `server/routers.ts` | Adds `patientAvatarUrl` to wallet card responses from the `users.avatarUrl` source of truth. |
| `client/src/components/CredentialRenderer.tsx` | Uses `PersonPhoto` for patient identity, medical certificate, patient summary, compact credential cards, and practitioner photos. |
| `client/src/pages/Wallet.tsx` | Uses `card.patientAvatarUrl` before session avatar and credential payload photo references. |
| `client/src/pages/PatientProfile.tsx` | Uses the same photo candidate logic for the profile card list and expanded credential renderers. |
| `client/public/sw.js` | Bumps service worker cache and changes `/manus-storage/*` to network-first, caching only successful `image/*` responses. |

## Runtime Photo Resolution Order

Production should succeed at step 1 or 2:

1. `wallet_cards` API response field `patientAvatarUrl`, sourced from `users.avatarUrl`.
2. Photo URL embedded in `issued_credentials.credentialData.credentialSubject.patient.*` or `humanDocument.renderData.patient.*`.
3. Demo-only real-photo fallback by patient gender or practitioner role.
4. Icon fallback only if every URL fails.

## Manus DB Validation Checklist

Run this before reseeding or deploying:

1. Confirm patient users have stable avatar URLs:

```sql
SELECT id, openId, name, systemRole, avatarUrl
FROM users
WHERE systemRole = 'patient'
ORDER BY id;
```

2. `avatarUrl` must be one of:

- `/manus-storage/<key>`
- `https://trustcarehealth-tylvb5l8.manus.space/manus-storage/<key>`

Do not store short-lived signed S3 URLs in `users.avatarUrl`.

3. Check each non-null avatar URL returns `200` and `Content-Type: image/*` through production:

```bash
curl -I "https://trustcarehealth-tylvb5l8.manus.space/manus-storage/<key>"
```

4. Check active photo-bearing credentials for the same patient:

```sql
SELECT id, credentialId, type, subjectId, JSON_EXTRACT(credentialData, '$.credentialSubject.patient.photoUrl') AS photoUrl
FROM issued_credentials
WHERE status = 'active'
  AND type IN ('patient_identity', 'medical_certificate', 'patient_summary')
ORDER BY subjectId, id;
```

5. If a patient credential has no `credentialSubject.patient.photoUrl`, it can still render from `users.avatarUrl`, but newly issued/reissued credentials should include a stable patient photo reference at issuance time when policy allows.

6. After changing `users.avatarUrl`, reseed or reissue demo VC/VP packages for affected photo-bearing documents so the credential payload and wallet owner source stay aligned.

## Manus Reseed Guidance

If production still shows a blank frame after this PR is merged:

1. Open `/` and login as `นายสมชาย ใจดี` patient.
2. Run DB validation above.
3. If `users.avatarUrl` is missing or points to a non-image, upload/reupload the patient photo to Manus storage and update `users.avatarUrl` to the returned stable `/manus-storage/...` path.
4. Reseed/reissue patient identity, medical certificate, and patient summary VCs for that patient through the real issuance path.
5. Deploy via `webdev_save_checkpoint`.
6. On mobile, hard refresh or unregister the old service worker once. New deployments use `trustcare-sw-v4-person-images`.

## Acceptance Criteria

- `/wallet`: patient identity compact card shows the real person photo on mobile.
- `/wallet` expanded credential detail: patient identity card photo frame shows the real person photo.
- `/patient-profile`: profile photo section, identity card list, and expanded credential all show the same real person photo.
- `/credential/:id` or credential detail pages show the same photo when `users.getPhoto` returns a valid URL.
- No blank photo frames are visible; icon fallback appears only if all configured URLs fail.
- Network panel confirms `/manus-storage/*` responses are `image/*`, not cached HTML/JSON error pages.
