# v3.20.0 Implementation Notes

## Core Principles (from Agent Guide)

1. **SHL** = secure transport for large/mixed packets via QR/URL
2. **VC** = trust layer for verifying issuer, holder, schema, status, proof
3. **VP** = patient-controlled presentation of multiple VCs from wallet
4. **FHIR** = canonical data model
5. **DocumentReference** = wrapper for legacy PDF/scan/image with hash + provenance
6. **Contract Hub** = shared schema/policy/mapping understanding

## Document Upload Flow Requirements

Legacy File → Upload → Calculate hash → Create FHIR DocumentReference → Attach source/provenance → DQI review → Optional VC issuance after trusted review → Include in SHL DocumentReference Bundle

### DO NOT:
- Mark legacy files as verified without source/provenance/review
- Automatically issue VC from uploaded PDF unless policy allows
- Include raw PDF in VC credentialSubject
- Expose raw file URLs without short-lived access control

### FHIR DocumentReference must include:
- resourceType: "DocumentReference"
- status: "current" | "preliminary" | "superseded"
- type (document category)
- subject (Patient reference)
- date
- author
- content[].attachment.contentType
- content[].attachment.url (trustcare://document/file/{id})
- content[].attachment.hash (base64-sha256)
- content[].attachment.title
- content[].attachment.creation
- context.encounter (if applicable)

## QR Code Check-in Flow

### Patient flow:
1. Patient opens Prepare for Service
2. Selects use case
3. System loads readiness contract
4. Wallet scanned for required/optional VCs
5. Missing documents shown
6. Patient confirms contextual consent
7. System builds VP or SHL packet
8. Patient shows QR/URL to hospital

### Transport decision:
- Small packet (identity + allergy + medication) → Direct VP QR
- Large/mixed packet → SHL + VP + FHIR Bundle + DocumentReference Bundle

### QR payload structure:
- Direct VP: verifier URL with VP ID
- SHL: shlink:/ + base64url(JSON{url, key, exp, flag, label, v})

## Contract Admin CRUD Requirements

Contract types to support:
- readiness_contract
- service_packet_contract
- document_bundle_contract
- vc_schema_contract
- mapping_contract
- consent_policy_contract

Minimum fields:
- contractId, version, status, effectiveFrom
- context, requiredDocuments[], optionalDocuments[]
- vcTypes[], fhirProfiles[]
- consentPurpose, defaultExpiryMinutes
- schemaRefs{}

API endpoints needed:
- contract.list / contract.getLatest / contract.getById
- contract.publish / contract.retire / contract.validatePayload
