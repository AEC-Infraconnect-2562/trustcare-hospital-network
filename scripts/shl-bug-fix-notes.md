# SHL Bug Fix Notes

## Root Cause
React error #31: "Objects are not valid as a React child (found: object with keys {hash, token, url})"

The error occurs on the `/shl` page when a user (e.g., Mr. John Williams / wichai@gmail.com) views their SHL records.

## Problem Location
The error is in `client/src/pages/SmartHealthLinks.tsx`:

1. **Line 1172-1177**: `ObjectLink` component renders `doc.objectLinks?.fhirDocumentReference` etc.
   - In DB, `objectLinksJson.fhirDocumentReference` is an OBJECT like `{resourceId: "...", status: "current"}` 
   - NOT a string like `"DocumentReference/xxx"`
   - Similarly `objectLinksJson.fhirBundle` is `{context: "treatment", sourceBundleHash: "..."}`
   - And `objectLinksJson.shlFile` is `{contentHash, contentType, fileId, ...}`

2. **Line 639**: `{selected.context}` in Badge - this is always a string (verified), NOT the issue.

## Fix Applied
- Updated `ObjectLink` component (line 1213) to handle object values by extracting `.url`, `.resourceId`, `.fileId`, `.hash` or falling back to JSON.stringify
- Updated `ShlFieldLine` component (line 1222) to handle object values by JSON.stringify

## Additional Notes
- The error message in production mentions `{resourceId, status}` which matches `objectLinksJson.fhirDocumentReference`
- The browser console log shows `{hash, token, url}` which might be from a different SHL record's objectLinks
- `doc.status` is always a string ("available_in_manifest") - verified
- `vcBindingJson` sub-fields are all strings (manifestCredentialId, holderPresentationId, etc.)
- `accessBindingJson` sub-fields are primitives (boolean, number, string)

## Files Modified
- `client/src/pages/SmartHealthLinks.tsx` - ObjectLink and ShlFieldLine components

## Status
- TypeScript: 0 errors after fix
- Need to run tests and checkpoint
