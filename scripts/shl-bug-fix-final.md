# SHL Bug Fix - Final Root Cause

## Root Cause Confirmed
The `objectLinksJson` stored in `shl_manifest_documents` table for John Williams' SHL records (IDs 60055, 60042) contains **nested objects** instead of flat strings.

For example:
- `objectLinksJson.fhirDocumentReference` = `{resourceId: "DocumentReference/...", status: "current"}` (OBJECT)
- `objectLinksJson.fhirBundle` = `{context: "treatment", sourceBundleHash: "..."}` (OBJECT)
- `objectLinksJson.shlFile` = `{contentHash: "...", contentType: "...", fileId: "...", ...}` (OBJECT)

But the frontend `ObjectLink` component at line 1172-1177 renders these values directly in `<p>` tags, causing React error #31.

## Expected Shape (from seedShlManifestDocuments.ts lines 114-119)
```json
{
  "shlFile": "shl://60055/versions/1/files/file-60055-1",
  "fhirDocumentReference": "DocumentReference/60055-identity_document",
  "fhirBundle": "Bundle/shl-60055-source",
  "manifest": "shl://60055/manifest"
}
```

## Actual Shape (from DB for John Williams)
```json
{
  "fhirBundle": {"context": "treatment", "sourceBundleHash": "25c317..."},
  "fhirDocumentReference": {"resourceId": "DocumentReference/shl-60055-file-fhir-bundle-...", "status": "current"},
  "shlFile": {"contentHash": "f869f1...", "contentType": "application/fhir+json", "encryptedSizeBytes": 28372, "fileId": "fhir-bundle-25c317...", "plaintextHash": "25c317..."}
}
```

## Fix Strategy (Two-pronged)
1. **Frontend defense** (DONE): Updated `ObjectLink` and `ShlFieldLine` to safely handle both string and object values
2. **Data fix**: Re-seed the manifest documents with proper flat-string format using `seedShlManifestDocuments.ts`

## How to re-seed manifest documents
The `seedShlManifestDocuments.ts` function `generateManifestDocuments()` generates the correct flat-string format.
Need to delete existing manifest docs for these SHLs and re-insert with proper format.

## Files Modified
- `client/src/pages/SmartHealthLinks.tsx` - ObjectLink (line 1213) and ShlFieldLine (line 1222) now handle objects safely
