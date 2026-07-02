# Avatar Mobile Debug - Key Findings

## Confirmed Working
- DB has correct avatarUrl: `/manus-storage/patient_male_realistic_opt_e9b1630b.jpg`
- Server returns 307 redirect to CloudFront signed URL
- CloudFront returns 200 with image/jpeg (18KB)
- Desktop shows image correctly
- auth.me returns full user object with avatarUrl field

## Mobile Issue Root Cause
The image IS accessible. Mobile issue is likely:
1. Service Worker cached old broken response (before DB was updated)
2. SW v1 → bumped to v2 to force cache invalidation
3. Mobile Safari may also have HTTP cache of the old response

## Fix Applied
- SW cache version bumped from v1 to v2 (forces old cache deletion on activate)
- Dialog added `max-h-[90vh] overflow-y-auto` for scroll on mobile

## Architecture
- Route: /profile (not /patient-profile)
- Demo login: POST /api/auth/demo-login with openId
- auth.me returns: { ...user, additionalRoles, activeRole } where user includes avatarUrl from DB
- PatientProfile.tsx line 63: `const currentAvatarUrl = previewUrl || (user as any)?.avatarUrl`
- CredentialRenderer receives patientPhotoUrl from `(auth as any)?.avatarUrl` in Wallet.tsx line 406

## VP Scroll Fix
- DialogContent now has: `className="max-w-lg max-h-[90vh] overflow-y-auto"`
- This allows the full credential card + buttons to be scrollable on mobile
