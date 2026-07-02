# Healthcare Document Bundle Standards Research

## Overview

This document summarizes the key healthcare interoperability standards relevant to the Trustcare Hospital Network's File Bundle system for Care Transition Cases.

## 1. IHE XDS (Cross-Enterprise Document Sharing)

IHE XDS.b is the foundational standard for sharing clinical documents across healthcare enterprises. Key concepts:

- **Document Source**: Produces and registers documents
- **Document Repository**: Stores documents and makes them available for retrieval
- **Document Registry**: Maintains metadata about documents (who, what, when, where)
- **Document Consumer**: Queries and retrieves documents

**Relevance to our Bundle system**: Our `document_bundles` table acts as a lightweight registry, and S3 storage acts as the repository. The bundle metadata (title, type, status, integrity hash) mirrors XDS metadata concepts.

## 2. FHIR DocumentReference

The FHIR DocumentReference resource is the modern equivalent of XDS metadata. It indexes any document type:

- CDA documents, FHIR Compositions
- PDF, scanned paper, faxes
- Clinical notes
- Images (JPEG, GIF, TIFF, DICOM)
- Video/Audio files
- Non-standard formats (CSV, RTF, Word)

**Key fields mapped to our schema**:
| FHIR DocumentReference | Our bundle_files table |
|---|---|
| content.attachment.url | fileKey (S3 reference) |
| content.attachment.contentType | mimeType |
| content.attachment.size | fileSize |
| content.attachment.hash | integrityHash (SHA-256) |
| type | fileType enum |
| status | bundle status |
| category | bundleType |
| subject | caseId + caseType |
| author | submittedBy |

## 3. IHE MHD (Mobile access to Health Documents)

IHE MHD provides a FHIR-based API for document sharing, designed for mobile/constrained devices. It uses FHIR Bundle resources to submit document sets:

- **Provide Document Bundle**: Transaction bundle containing DocumentReference + Binary resources
- **Find Document References**: Search for documents by patient, date, type
- **Retrieve Document**: Get the actual document content

**Relevance**: Our `/api/upload/bundle-file` endpoint mirrors the MHD "Provide Document Bundle" transaction pattern.

## 4. SMART Health Links (SHL)

SHL is a secure, shareable URL/QR code protocol for health data sharing:

- **Manifest**: JSON listing files available via the SHL
- **Encryption**: AES-256 with a key embedded in the SHL URI
- **File types supported**:
  - `application/smart-health-card`: Verifiable Credentials (JWS)
  - `application/fhir+json`: Any FHIR resource or Bundle
  - `application/smart-api-access`: SMART Access Token for live queries
- **Flags**: L (long-term), P (passcode), U (single-file direct access)
- **Expiration**: Optional epoch timestamp

**Relevance**: Our system already uses SHL for care package sharing. The File Bundle system extends this by allowing bundle → SHL generation (select files from bundle → create encrypted FHIR Bundle → generate SHL link).

## 5. Document Integrity Verification

Healthcare document integrity uses cryptographic hashing:

- **SHA-256**: Standard for healthcare document hashing (256-bit output)
- **Per-file hash**: Each file gets its own SHA-256 hash stored in `bundle_files.metadata`
- **Bundle-level hash**: Concatenate all file hashes → SHA-256 of the concatenation → stored in `document_bundles.integrityHash`
- **Verification**: Recompute hash at any time to verify no tampering

## 6. VC/VP Integration with Document Bundles

Verifiable Credentials and Presentations within bundles follow W3C VC Data Model:

- **VC files**: Linked to `issued_credentials.id` for trust verification
- **VP files**: Linked to `issued_presentations.id` for presentation verification
- **Trust chain**: Bundle file → VC credential → Issuer DID → Trust Registry → Trust Level

## Design Decisions for Trustcare

1. **Bundle = logical grouping** (like IHE XDS Folder/SubmissionSet)
2. **Files stored in S3** (like XDS Document Repository)
3. **Metadata in PostgreSQL** (like XDS Document Registry)
4. **SHA-256 integrity hash** per bundle (industry standard)
5. **SHL as transport** for sharing bundles externally
6. **VC/VP as trust proof** for clinical documents within bundles
7. **Status workflow**: draft → submitted → under_review → accepted/rejected/archived
