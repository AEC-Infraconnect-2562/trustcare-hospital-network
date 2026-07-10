CREATE TABLE `adapter_health_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`adapterId` int NOT NULL,
	`status` enum('healthy','degraded','down') NOT NULL,
	`responseTimeMs` int,
	`errorMessage` text,
	`checkedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `adapter_health_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actorId` int,
	`actorRole` varchar(50),
	`hospitalId` int,
	`action` varchar(100) NOT NULL,
	`resourceType` varchar(100),
	`resourceId` varchar(255),
	`details` json,
	`ipAddress` varchar(45),
	`isBreakGlass` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `care_package_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`carePackageId` int NOT NULL,
	`itemType` enum('fhir_bundle','document_reference','legacy_file','vc','vp','shl_manifest','claim','invoice','receipt') NOT NULL,
	`title` varchar(255) NOT NULL,
	`resourceRef` varchar(255),
	`hash` varchar(128),
	`requiredForAcceptance` boolean NOT NULL DEFAULT false,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `care_package_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `care_packages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`caseType` enum('internal_referral','cross_branch','cross_border','external_partner','medical_tourist') NOT NULL,
	`caseId` int NOT NULL,
	`packageType` enum('referral','cross_border','medical_tourist','discharge','counter_referral','claim') NOT NULL,
	`status` enum('draft','ready_for_review','approved','sent','received','revoked') NOT NULL DEFAULT 'draft',
	`recipientType` enum('trustcare_hospital','partner_hospital','payer','patient','embassy','facilitator') NOT NULL DEFAULT 'partner_hospital',
	`recipientName` varchar(255),
	`recipientDid` varchar(255),
	`purpose` enum('referral','discharge','cross_border','medical_tourist','insurance','claim','follow_up') NOT NULL,
	`fhirBundleHash` varchar(128),
	`manifestHash` varchar(128),
	`shlId` int,
	`presentationId` varchar(255),
	`consentCredentialId` varchar(255),
	`accessPolicy` json,
	`costEstimate` json,
	`claimRef` varchar(255),
	`createdBy` int,
	`approvedBy` int,
	`approvedAt` timestamp,
	`sentAt` timestamp,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `care_packages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `care_transition_case_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`caseType` enum('internal_referral','cross_branch','cross_border','external_partner','medical_tourist') NOT NULL,
	`caseId` int NOT NULL,
	`eventType` enum('created','document_received','document_verified','task_updated','decision_recorded','package_generated','package_sent','status_changed','payment_updated','discharge_packet_generated') NOT NULL,
	`actorId` int,
	`actorRole` varchar(64),
	`fromStatus` varchar(80),
	`toStatus` varchar(80),
	`summary` varchar(500),
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `care_transition_case_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `case_decisions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`caseType` enum('internal_referral','cross_branch','cross_border','external_partner','medical_tourist') NOT NULL,
	`caseId` int NOT NULL,
	`decisionType` enum('clinical_acceptance','document_acceptance','financial_acceptance','legal_acceptance','admission_acceptance','discharge_clearance') NOT NULL,
	`outcome` enum('accepted','rejected','more_info_requested','conditional') NOT NULL,
	`reason` text,
	`conditions` json,
	`decidedBy` int,
	`decidedAt` timestamp NOT NULL DEFAULT (now()),
	`metadata` json,
	CONSTRAINT `case_decisions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `case_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`caseType` enum('internal_referral','cross_branch','cross_border','external_partner','medical_tourist') NOT NULL,
	`caseId` int NOT NULL,
	`bundleId` int,
	`direction` enum('inbound','outbound') NOT NULL DEFAULT 'inbound',
	`documentType` enum('referral_letter','patient_summary','lab_report','imaging_report','passport','insurance_card','guarantee_letter','quotation','visa_support_letter','consent','claim_document','invoice','receipt','discharge_summary','prescription','medical_certificate','other') NOT NULL,
	`title` varchar(255) NOT NULL,
	`sourceSystem` varchar(128),
	`sourcePartnerId` int,
	`fileName` varchar(255),
	`fileUrl` text,
	`fileKey` varchar(500),
	`mimeType` varchar(120) DEFAULT 'application/pdf',
	`fileSize` bigint,
	`sortOrder` int NOT NULL DEFAULT 0,
	`hash` varchar(128),
	`fhirDocumentReferenceId` varchar(255),
	`fhirDocumentReference` json,
	`verificationStatus` enum('received','needs_review','verified','rejected','converted_to_vc') NOT NULL DEFAULT 'received',
	`vcCredentialId` varchar(255),
	`receivedBy` int,
	`verifiedBy` int,
	`verifiedAt` timestamp,
	`notes` text,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `case_documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `case_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`caseType` enum('internal_referral','cross_branch','cross_border','external_partner','medical_tourist') NOT NULL,
	`caseId` int NOT NULL,
	`taskType` enum('mpi_match','consent_review','document_quality','clinical_triage','translation_review','financial_review','payer_review','legal_acceptance','appointment_scheduling','admission_readiness','vc_request','package_dispatch','discharge_packet','sync_back') NOT NULL,
	`title` varchar(255) NOT NULL,
	`status` enum('created','ready','in_progress','blocked','completed','failed','cancelled') NOT NULL DEFAULT 'ready',
	`priority` enum('routine','urgent','stat') NOT NULL DEFAULT 'routine',
	`ownerRole` varchar(64),
	`ownerId` int,
	`dueAt` timestamp,
	`completedAt` timestamp,
	`input` json,
	`output` json,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `case_tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `claim_cases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`patientId` int NOT NULL,
	`hospitalId` int NOT NULL,
	`payerAdapterId` int NOT NULL,
	`encounterRef` varchar(255),
	`claimType` enum('opd','ipd','dental','pharmacy','rehabilitation','emergency') NOT NULL DEFAULT 'opd',
	`status` enum('draft','validating','correction_required','ready_to_submit','submitted','accepted','rejected','more_info_requested','appeal','paid','closed') NOT NULL DEFAULT 'draft',
	`totalAmount` varchar(20),
	`approvedAmount` varchar(20),
	`diagnosisCodes` json,
	`procedureCodes` json,
	`serviceItems` json,
	`validationIssues` json,
	`payerClaimId` varchar(255),
	`submittedAt` timestamp,
	`respondedAt` timestamp,
	`paidAt` timestamp,
	`rejectionReason` text,
	`resubmissionCount` int NOT NULL DEFAULT 0,
	`claimReceiptVcId` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `claim_cases_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `claim_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`claimCaseId` int NOT NULL,
	`documentType` varchar(100) NOT NULL,
	`source` enum('patient_wallet','his','payer_portal','partner_portal','upload','finance') NOT NULL DEFAULT 'patient_wallet',
	`artifactType` enum('legacy_file','vc','vp','shl','fhir_bundle','invoice','receipt') NOT NULL DEFAULT 'legacy_file',
	`title` varchar(500) NOT NULL,
	`fileUrl` text,
	`credentialId` varchar(255),
	`presentationId` varchar(255),
	`shlId` varchar(255),
	`documentReference` json,
	`hash` varchar(128),
	`status` enum('received','verified','needs_review','accepted','rejected') NOT NULL DEFAULT 'received',
	`required` boolean NOT NULL DEFAULT true,
	`simulationFlag` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `claim_documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `claim_intake_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`patientId` int NOT NULL,
	`hospitalId` int NOT NULL,
	`claimCaseId` int,
	`intakeChannel` enum('wallet_vp','shl','legacy_upload','his_import','partner_portal') NOT NULL DEFAULT 'wallet_vp',
	`consentRef` varchar(255),
	`memberId` varchar(100),
	`payerAdapterId` int,
	`readinessScore` int DEFAULT 0,
	`status` enum('draft','ready','blocked','converted_to_claim') NOT NULL DEFAULT 'draft',
	`rawInput` json,
	`canonicalSummary` json,
	`simulationFlag` boolean NOT NULL DEFAULT false,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `claim_intake_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `claim_packages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`claimCaseId` int NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`fhirClaim` json,
	`fhirClaimHash` varchar(128),
	`evidenceHash` varchar(128),
	`claimPackageCredentialId` varchar(255),
	`credentialPayload` json,
	`status` enum('draft','issued','superseded','revoked') NOT NULL DEFAULT 'draft',
	`issuedBy` int,
	`issuedAt` timestamp,
	`supersedesPackageId` int,
	`simulationFlag` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `claim_packages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `claim_payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`claimCaseId` int NOT NULL,
	`payerClaimId` varchar(255),
	`paymentReference` varchar(255),
	`paymentDate` timestamp,
	`approvedAmount` varchar(20),
	`paidAmount` varchar(20),
	`currency` varchar(3) NOT NULL DEFAULT 'THB',
	`patientResponsibility` varchar(20),
	`paymentReconciliation` json,
	`claimReceiptCredentialId` varchar(255),
	`receiptCredentialPayload` json,
	`status` enum('pending','reconciled','mismatch','posted') NOT NULL DEFAULT 'pending',
	`simulationFlag` boolean NOT NULL DEFAULT false,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `claim_payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `claim_submission_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`claimCaseId` int NOT NULL,
	`claimPackageId` int,
	`payerAdapterId` int,
	`submissionId` varchar(255),
	`payerClaimId` varchar(255),
	`adapterMode` enum('api','portal','batch_file','email','rpa') NOT NULL DEFAULT 'api',
	`targetFormat` varchar(100),
	`requestDigest` varchar(128),
	`responseDigest` varchar(128),
	`status` enum('queued','submitted','accepted','rejected','more_info_requested','failed') NOT NULL DEFAULT 'queued',
	`requestPayload` json,
	`responsePayload` json,
	`submittedBy` int,
	`submittedAt` timestamp,
	`respondedAt` timestamp,
	`simulationFlag` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `claim_submission_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `consent_policies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`hospitalId` int,
	`name` varchar(255) NOT NULL,
	`nameEn` varchar(255),
	`description` text,
	`purpose` enum('treatment','referral','research','insurance','public_health','emergency') NOT NULL,
	`dataCategories` json,
	`retentionDays` int DEFAULT 365,
	`isRequired` boolean NOT NULL DEFAULT false,
	`isActive` boolean NOT NULL DEFAULT true,
	`version` varchar(20) NOT NULL DEFAULT '1.0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `consent_policies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `consent_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`patientId` int NOT NULL,
	`policyId` int NOT NULL,
	`grantedToHospitalId` int,
	`grantedToDoctorId` int,
	`status` enum('granted','revoked','expired') NOT NULL DEFAULT 'granted',
	`purpose` enum('treatment','referral','research','insurance','public_health','emergency') NOT NULL,
	`dataScope` json,
	`grantedAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp,
	`revokedAt` timestamp,
	`revocationReason` text,
	`consentMethod` enum('digital','paper','verbal_emergency') NOT NULL DEFAULT 'digital',
	`vcCredentialId` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `consent_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contract_artifacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`artifactId` varchar(255) NOT NULL,
	`contractId` varchar(255) NOT NULL,
	`artifactType` enum('questionnaire','questionnaire_response','document_reference_profile','vc_schema','shl_manifest_schema','openapi_doc','trust_policy','consent_template') NOT NULL,
	`title` varchar(255) NOT NULL,
	`titleEn` varchar(255),
	`version` varchar(64) NOT NULL,
	`contentJson` json,
	`status` enum('active','draft','deprecated') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `contract_artifacts_id` PRIMARY KEY(`id`),
	CONSTRAINT `contract_artifacts_artifactId_unique` UNIQUE(`artifactId`)
);
--> statement-breakpoint
CREATE TABLE `coverage_eligibility` (
	`id` int AUTO_INCREMENT NOT NULL,
	`patientId` int NOT NULL,
	`payerAdapterId` int NOT NULL,
	`coverageType` varchar(100),
	`memberId` varchar(255),
	`status` enum('eligible','ineligible','pending','expired') NOT NULL DEFAULT 'pending',
	`benefits` json,
	`limitations` json,
	`vcCredentialId` varchar(255),
	`checkedAt` timestamp NOT NULL DEFAULT (now()),
	`validUntil` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `coverage_eligibility_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `credential_issuance_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestId` varchar(255) NOT NULL,
	`templateId` int,
	`issuerHospitalId` int NOT NULL,
	`subjectId` int NOT NULL,
	`type` enum('patient_identity','staff_identity','consent_receipt','patient_summary','allergy_alert','medication_summary','referral_vc','immunization','medical_certificate','prescription','lab_result','diagnostic_report','discharge_summary','insurance_eligibility','claim_package','claim_receipt','travel_document_verification','shl_manifest','pharmacy_dispense','appointment','visa_support_letter','quotation','guarantee_letter','mpi_link_certificate','sync_receipt') NOT NULL,
	`status` enum('draft','submitted','changes_requested','approved','rejected','issued','cancelled') NOT NULL DEFAULT 'submitted',
	`makerId` int NOT NULL,
	`checkerId` int,
	`makerRole` varchar(64),
	`checkerRole` varchar(64),
	`holderDid` varchar(512),
	`issuerDid` varchar(512),
	`documentData` json,
	`canonicalReview` json,
	`checkerNotes` text,
	`issuedCredentialId` varchar(255),
	`issuedCredentialRowId` int,
	`submittedAt` timestamp NOT NULL DEFAULT (now()),
	`checkedAt` timestamp,
	`issuedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `credential_issuance_requests_id` PRIMARY KEY(`id`),
	CONSTRAINT `credential_issuance_requests_requestId_unique` UNIQUE(`requestId`)
);
--> statement-breakpoint
CREATE TABLE `credential_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestNumber` varchar(50) NOT NULL,
	`templateId` int NOT NULL,
	`patientId` int NOT NULL,
	`hospitalId` int,
	`makerId` int NOT NULL,
	`checkerId` int,
	`status` enum('draft','pending_review','approved','rejected','issued','cancelled') NOT NULL DEFAULT 'draft',
	`credentialData` json,
	`makerNotes` text,
	`checkerComment` text,
	`issuedCredentialId` int,
	`priority` enum('normal','urgent') NOT NULL DEFAULT 'normal',
	`submittedAt` timestamp,
	`reviewedAt` timestamp,
	`issuedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `credential_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `credential_status_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`credentialId` varchar(255) NOT NULL,
	`statusListIndex` varchar(64),
	`statusPurpose` enum('revocation','suspension') NOT NULL DEFAULT 'revocation',
	`status` enum('active','revoked','suspended') NOT NULL DEFAULT 'active',
	`reason` text,
	`actorId` int,
	`eventHash` varchar(128) NOT NULL,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `credential_status_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `credential_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`hospitalId` int,
	`name` varchar(255) NOT NULL,
	`nameEn` varchar(255),
	`type` enum('patient_identity','staff_identity','consent_receipt','patient_summary','allergy_alert','medication_summary','referral_vc','immunization','medical_certificate','prescription','lab_result','diagnostic_report','discharge_summary','insurance_eligibility','claim_package','claim_receipt','travel_document_verification','shl_manifest','pharmacy_dispense','appointment','visa_support_letter','quotation','guarantee_letter','mpi_link_certificate','sync_receipt') NOT NULL,
	`version` varchar(20) NOT NULL DEFAULT '1.0',
	`schema` json,
	`fhirResourceType` varchar(100),
	`documentCategory` varchar(64),
	`documentSubcategory` varchar(64),
	`defaultStoragePath` varchar(500),
	`validityDays` int DEFAULT 365,
	`schemaVersion` varchar(20) NOT NULL DEFAULT '1.0.0',
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `credential_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cross_border_referrals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`referralId` int,
	`referralType` enum('cross_branch','cross_border_outbound','cross_border_inbound','external_partner') NOT NULL,
	`partnerOrgId` int,
	`partnerOrgName` varchar(255),
	`partnerCountry` varchar(3),
	`language` enum('th','en','zh','ja','other') NOT NULL DEFAULT 'en',
	`jurisdiction` varchar(100),
	`ipsShlId` int,
	`referralVcId` varchar(255),
	`consentId` int,
	`translationRequired` boolean NOT NULL DEFAULT false,
	`translationStatus` enum('not_needed','pending','completed') NOT NULL DEFAULT 'not_needed',
	`legalDisclaimer` text,
	`expiresAt` timestamp,
	`status` enum('draft','consent_requested','consent_granted','packet_generated','sent','acknowledged','accepted','rejected','completed','counter_referral_received','closed') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cross_border_referrals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `departments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`hospitalId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`nameEn` varchar(255),
	`code` varchar(50),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `departments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `document_bundles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`caseType` enum('internal_referral','cross_branch','cross_border','external_partner','medical_tourist') NOT NULL,
	`caseId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`bundleType` enum('initial_submission','follow_up','lab_results','imaging','legal_documents','insurance','discharge','mixed') NOT NULL DEFAULT 'mixed',
	`status` enum('draft','submitted','under_review','accepted','rejected','archived') NOT NULL DEFAULT 'draft',
	`submittedBy` int,
	`reviewedBy` int,
	`reviewedAt` timestamp,
	`integrityHash` varchar(128),
	`fileCount` int NOT NULL DEFAULT 0,
	`totalSizeBytes` bigint NOT NULL DEFAULT 0,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `document_bundles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `external_wallet_api_keys` (
	`id` int AUTO_INCREMENT NOT NULL,
	`keyId` varchar(64) NOT NULL,
	`appId` varchar(128) NOT NULL,
	`keyHash` varchar(128) NOT NULL,
	`keyPrefix` varchar(12) NOT NULL,
	`label` varchar(128) NOT NULL,
	`scopes` json,
	`expiresAt` timestamp,
	`lastUsedAt` timestamp,
	`usageCount` bigint NOT NULL DEFAULT 0,
	`status` enum('active','expired','revoked') NOT NULL DEFAULT 'active',
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `external_wallet_api_keys_id` PRIMARY KEY(`id`),
	CONSTRAINT `external_wallet_api_keys_keyId_unique` UNIQUE(`keyId`)
);
--> statement-breakpoint
CREATE TABLE `external_wallet_apps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`appId` varchar(128) NOT NULL,
	`name` varchar(255) NOT NULL,
	`nameEn` varchar(255),
	`description` text,
	`organizationName` varchar(255) NOT NULL,
	`organizationDid` varchar(500),
	`contactEmail` varchar(255) NOT NULL,
	`contactPhone` varchar(64),
	`walletType` enum('personal_health','insurance','government','employer','pharmacy','research','other') NOT NULL,
	`platformType` enum('ios','android','web','cross_platform') NOT NULL DEFAULT 'cross_platform',
	`redirectUris` json,
	`webhookUrl` varchar(500),
	`logoUrl` varchar(500),
	`scopes` json NOT NULL,
	`allowedContractIds` json,
	`rateLimitPerMinute` int NOT NULL DEFAULT 60,
	`rateLimitPerDay` int NOT NULL DEFAULT 10000,
	`status` enum('pending_review','active','suspended','revoked') NOT NULL DEFAULT 'pending_review',
	`trustLevel` enum('unverified','basic','verified','certified') NOT NULL DEFAULT 'unverified',
	`complianceCertRef` varchar(255),
	`termsAcceptedAt` timestamp,
	`reviewedBy` int,
	`reviewedAt` timestamp,
	`reviewNotes` text,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `external_wallet_apps_id` PRIMARY KEY(`id`),
	CONSTRAINT `external_wallet_apps_appId_unique` UNIQUE(`appId`)
);
--> statement-breakpoint
CREATE TABLE `external_wallet_audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`appId` varchar(128) NOT NULL,
	`keyId` varchar(64),
	`sessionToken` varchar(128),
	`action` varchar(128) NOT NULL,
	`endpoint` varchar(255) NOT NULL,
	`method` varchar(10) NOT NULL,
	`statusCode` int,
	`requestBody` json,
	`responseStatus` enum('success','error','denied','rate_limited') NOT NULL,
	`errorMessage` text,
	`ipAddress` varchar(64),
	`userAgent` text,
	`durationMs` int,
	`patientId` int,
	`resourceType` varchar(64),
	`resourceId` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `external_wallet_audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `external_wallet_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionToken` varchar(128) NOT NULL,
	`appId` varchar(128) NOT NULL,
	`keyId` varchar(64) NOT NULL,
	`patientDid` varchar(500),
	`patientId` int,
	`scopes` json NOT NULL,
	`ipAddress` varchar(64),
	`userAgent` text,
	`expiresAt` timestamp NOT NULL,
	`lastActivityAt` timestamp,
	`status` enum('active','expired','revoked') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `external_wallet_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `external_wallet_sessions_sessionToken_unique` UNIQUE(`sessionToken`)
);
--> statement-breakpoint
CREATE TABLE `fhir_field_mappings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`hospitalId` int NOT NULL,
	`localFieldName` varchar(255) NOT NULL,
	`localFieldPath` varchar(500),
	`fhirResourceType` varchar(100) NOT NULL,
	`fhirFieldPath` varchar(500) NOT NULL,
	`transformRule` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`validationStatus` enum('valid','invalid','pending') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fhir_field_mappings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `hospitals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`nameEn` varchar(255),
	`code` varchar(20) NOT NULL,
	`did` varchar(512),
	`address` text,
	`province` varchar(100),
	`phone` varchar(50),
	`email` varchar(320),
	`logoUrl` text,
	`issuerEndpoint` text,
	`verifierEndpoint` text,
	`fhirEndpoint` text,
	`status` enum('active','inactive','pending') NOT NULL DEFAULT 'pending',
	`settings` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `hospitals_id` PRIMARY KEY(`id`),
	CONSTRAINT `hospitals_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `integration_adapters` (
	`id` int AUTO_INCREMENT NOT NULL,
	`hospitalId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`systemType` enum('his','emr','lis','ris','pacs','erp','crm','claim_system','legacy_db') NOT NULL,
	`connectorPattern` enum('api_rest','api_graphql','hl7v2','db_view','cdc','batch_file','dicomweb','portal_adapter') NOT NULL,
	`connectionConfig` json,
	`authMethod` enum('oauth2','api_key','mtls','basic','vpn','none') NOT NULL DEFAULT 'api_key',
	`status` enum('active','inactive','testing','error') NOT NULL DEFAULT 'testing',
	`lastHealthCheck` timestamp,
	`healthStatus` enum('healthy','degraded','down','unknown') NOT NULL DEFAULT 'unknown',
	`mappingVersionId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `integration_adapters_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `integration_event_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`adapterId` int NOT NULL,
	`eventType` varchar(100) NOT NULL,
	`direction` enum('inbound','outbound') NOT NULL,
	`resourceType` varchar(100),
	`resourceId` varchar(255),
	`status` enum('success','error','pending','retrying') NOT NULL DEFAULT 'pending',
	`payload` json,
	`errorDetails` text,
	`correlationId` varchar(255),
	`processedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `integration_event_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `international_cases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`patientId` int,
	`status` enum('inquiry','profile_created','documents_uploaded','identity_verified','clinical_pre_review','more_info_requested','quotation_prepared','insurance_review','appointment_confirmed','arrival_ready','patient_arrived','treatment_in_progress','discharge_prepared','follow_up_scheduled','closed') NOT NULL DEFAULT 'inquiry',
	`country` varchar(3),
	`language` enum('en','zh','ja','ar','ru','ko','de','fr','other') NOT NULL DEFAULT 'en',
	`passportNumber` varchar(50),
	`passportCountry` varchar(3),
	`insuranceProvider` varchar(255),
	`insurancePolicyNumber` varchar(100),
	`serviceLine` varchar(255),
	`preferredBranchId` int,
	`assignedCoordinatorId` int,
	`assignedInterpreterId` int,
	`contactEmail` varchar(320),
	`contactPhone` varchar(50),
	`contactMessenger` varchar(255),
	`clinicalNotes` text,
	`quotationAmount` varchar(20),
	`quotationCurrency` varchar(3) DEFAULT 'THB',
	`appointmentDate` timestamp,
	`arrivalDate` timestamp,
	`dischargeDate` timestamp,
	`followUpDate` timestamp,
	`dischargePacketShlId` int,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `international_cases_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `issued_credentials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`credentialId` varchar(255) NOT NULL,
	`templateId` int NOT NULL,
	`issuerId` int NOT NULL,
	`issuerHospitalId` int NOT NULL,
	`subjectId` int NOT NULL,
	`type` enum('patient_identity','staff_identity','consent_receipt','patient_summary','allergy_alert','medication_summary','referral_vc','immunization','medical_certificate','prescription','lab_result','diagnostic_report','discharge_summary','insurance_eligibility','claim_package','claim_receipt','travel_document_verification','shl_manifest','pharmacy_dispense','appointment','visa_support_letter','quotation','guarantee_letter','mpi_link_certificate','sync_receipt') NOT NULL,
	`status` enum('active','revoked','expired','suspended') NOT NULL DEFAULT 'active',
	`credentialData` json,
	`sdJwtVc` mediumtext,
	`sdJwtFull` mediumtext,
	`disclosureMap` json,
	`documentCategory` varchar(64),
	`documentSubcategory` varchar(64),
	`storageKey` varchar(500),
	`searchTags` json,
	`issuedAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp,
	`revokedAt` timestamp,
	`revocationReason` text,
	`fhirResourceId` varchar(255),
	`schemaVersion` varchar(20) NOT NULL DEFAULT '1.0.0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `issued_credentials_id` PRIMARY KEY(`id`),
	CONSTRAINT `issued_credentials_credentialId_unique` UNIQUE(`credentialId`)
);
--> statement-breakpoint
CREATE TABLE `issued_presentations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`presentationId` varchar(255) NOT NULL,
	`patientId` int NOT NULL,
	`holderDid` varchar(512) NOT NULL,
	`context` varchar(64) NOT NULL,
	`purpose` varchar(64) NOT NULL,
	`audience` text,
	`presentationJwt` mediumtext NOT NULL,
	`credentialIds` json,
	`credentialRowIds` json,
	`verifier` varchar(255),
	`status` enum('active','expired','revoked') NOT NULL DEFAULT 'active',
	`expiresAt` timestamp,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `issued_presentations_id` PRIMARY KEY(`id`),
	CONSTRAINT `issued_presentations_presentationId_unique` UNIQUE(`presentationId`)
);
--> statement-breakpoint
CREATE TABLE `mapping_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`adapterId` int NOT NULL,
	`resourceType` varchar(100) NOT NULL,
	`version` varchar(100) NOT NULL,
	`mappingConfig` json,
	`status` enum('draft','testing','published','deprecated') NOT NULL DEFAULT 'draft',
	`approvedBy` int,
	`approvedAt` timestamp,
	`publishedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mapping_versions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mpi_matches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`patientIdA` int NOT NULL,
	`patientIdB` int NOT NULL,
	`matchScore` int,
	`matchStatus` enum('confirmed','pending_review','rejected','auto_linked') NOT NULL DEFAULT 'pending_review',
	`matchedFields` json,
	`reviewedBy` int,
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mpi_matches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`hospitalId` int,
	`type` enum('hospital_onboarded','vc_revoked','break_glass','data_quality','referral_update','consent_request','consent_expiry_reminder','system','vc_request_created','vc_submitted_for_review','vc_approved','vc_rejected','vc_issued') NOT NULL,
	`title` varchar(255) NOT NULL,
	`message` text,
	`isRead` boolean NOT NULL DEFAULT false,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `partner_source_attestations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`caseDocumentId` int,
	`connectorId` int,
	`partnerOrgId` int,
	`partnerName` varchar(255) NOT NULL,
	`sourceMode` enum('partner_native_vc','structured_source','delegated_issuance','legacy_document') NOT NULL,
	`attestationStatus` enum('draft','submitted','verified','rejected') NOT NULL DEFAULT 'submitted',
	`sourceHash` varchar(128),
	`evidence` json,
	`sourceDid` varchar(255),
	`signerDid` varchar(255),
	`vcCredentialId` varchar(255),
	`reviewedBy` int,
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `partner_source_attestations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `partner_source_connectors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`partnerOrgId` int,
	`partnerName` varchar(255) NOT NULL,
	`connectorType` enum('fhir_rest','hl7v2_mllp','db_view','cdc','sftp_csv','smart_health_link','native_vc_vp','manual_portal') NOT NULL,
	`direction` enum('inbound','outbound','bidirectional') NOT NULL DEFAULT 'bidirectional',
	`status` enum('draft','testing','active','suspended','retired') NOT NULL DEFAULT 'draft',
	`endpointUrl` text,
	`authType` enum('none','api_key','oauth2_client_credentials','mutual_tls','signed_vp','basic') NOT NULL DEFAULT 'none',
	`credentialRef` varchar(255),
	`mappingProfile` varchar(255),
	`canonicalMapping` json,
	`supportedDocumentTypes` json,
	`supportedCredentialTypes` json,
	`lastValidatedAt` timestamp,
	`validationStatus` enum('not_tested','passed','warning','failed') NOT NULL DEFAULT 'not_tested',
	`validationReport` json,
	`metadata` json,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `partner_source_connectors_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `patient_identifiers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`patientId` int NOT NULL,
	`hospitalId` int,
	`identifierType` enum('thai_id','passport','health_id','hn','mrn','carepass_id','insurance_id') NOT NULL,
	`identifierValue` varchar(255) NOT NULL,
	`issuerOrg` varchar(255),
	`verifiedAt` timestamp,
	`verificationMethod` varchar(100),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `patient_identifiers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `patient_uploaded_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`uploadId` varchar(64) NOT NULL,
	`patientId` int NOT NULL,
	`context` enum('opd_visit','emergency','referral','cross_border','medical_tourist','insurance_claim','pharmacy_dispense') NOT NULL,
	`documentType` varchar(100) NOT NULL,
	`documentCategory` enum('identity','clinical','insurance','consent','legal','imaging','lab','other') NOT NULL DEFAULT 'other',
	`title` varchar(255) NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`mimeType` varchar(120) NOT NULL,
	`fileSize` bigint NOT NULL,
	`fileKey` varchar(500) NOT NULL,
	`fileUrl` text NOT NULL,
	`hash` varchar(128) NOT NULL,
	`fhirDocumentReference` json NOT NULL,
	`status` enum('uploaded','needs_review','verified','converted_to_vc','rejected') NOT NULL DEFAULT 'uploaded',
	`reviewPolicy` enum('auto_accept','manual_review') NOT NULL DEFAULT 'manual_review',
	`reviewedBy` int,
	`reviewedAt` timestamp,
	`reviewNotes` text,
	`walletDocumentRequestId` int,
	`credentialId` int,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `patient_uploaded_documents_id` PRIMARY KEY(`id`),
	CONSTRAINT `patient_uploaded_documents_uploadId_unique` UNIQUE(`uploadId`)
);
--> statement-breakpoint
CREATE TABLE `payer_adapters` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`payerType` enum('nhso','sso','csmbs','private_insurance','corporate','self_pay','travel_insurance') NOT NULL,
	`apiEndpoint` text,
	`authConfig` json,
	`submissionFormat` enum('api','portal','batch_file','email','rpa') NOT NULL DEFAULT 'api',
	`validationRules` json,
	`status` enum('active','inactive','testing') NOT NULL DEFAULT 'testing',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payer_adapters_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payer_rulesets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`payerAdapterId` int NOT NULL,
	`rulesetVersion` varchar(20) NOT NULL,
	`claimType` enum('opd','ipd','dental','pharmacy','rehabilitation','emergency') NOT NULL DEFAULT 'opd',
	`requiredDocuments` json,
	`fieldRules` json,
	`transformProfile` json,
	`effectiveFrom` timestamp,
	`effectiveTo` timestamp,
	`status` enum('draft','active','retired') NOT NULL DEFAULT 'draft',
	`simulationFlag` boolean NOT NULL DEFAULT false,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payer_rulesets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `presentation_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`patientId` int NOT NULL,
	`credentialId` int NOT NULL,
	`verifierName` varchar(255),
	`verifierHospitalId` int,
	`purpose` varchar(255),
	`disclosedFields` json,
	`presentedAt` timestamp NOT NULL DEFAULT (now()),
	`verificationResult` enum('valid','invalid','expired'),
	CONSTRAINT `presentation_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `referrals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`referralCode` varchar(50) NOT NULL,
	`patientId` int NOT NULL,
	`fromHospitalId` int NOT NULL,
	`toHospitalId` int NOT NULL,
	`fromDoctorId` int NOT NULL,
	`toDoctorId` int,
	`status` enum('requested','accepted','in_progress','completed','replied','rejected') NOT NULL DEFAULT 'requested',
	`priority` enum('routine','urgent','emergency') NOT NULL DEFAULT 'routine',
	`reason` text,
	`clinicalNotes` text,
	`diagnosis` varchar(500),
	`icdCode` varchar(20),
	`attachedCredentialIds` json,
	`shlPayload` text,
	`responseNotes` text,
	`acceptedAt` timestamp,
	`completedAt` timestamp,
	`rejectedAt` timestamp,
	`rejectionReason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `referrals_id` PRIMARY KEY(`id`),
	CONSTRAINT `referrals_referralCode_unique` UNIQUE(`referralCode`)
);
--> statement-breakpoint
CREATE TABLE `service_bundle_instances` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bundleId` varchar(255) NOT NULL,
	`templateId` varchar(255) NOT NULL,
	`patientId` int NOT NULL,
	`holderDid` varchar(255),
	`context` enum('opd_visit','emergency','referral','cross_border','medical_tourist','insurance_claim','pharmacy_dispense') NOT NULL,
	`audience` enum('patient','hospital') NOT NULL,
	`direction` enum('inbound','outbound','bidirectional') NOT NULL DEFAULT 'inbound',
	`status` enum('draft','building','ready','shared','deployed','expired','cancelled') NOT NULL DEFAULT 'draft',
	`readinessScore` int NOT NULL DEFAULT 0,
	`requiredMissingJson` json,
	`fhirBundleJson` json,
	`trustLayerJson` json,
	`presentationId` varchar(255),
	`shlId` varchar(255),
	`consentCredentialId` varchar(255),
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp,
	CONSTRAINT `service_bundle_instances_id` PRIMARY KEY(`id`),
	CONSTRAINT `service_bundle_instances_bundleId_unique` UNIQUE(`bundleId`)
);
--> statement-breakpoint
CREATE TABLE `service_bundle_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`templateId` varchar(255) NOT NULL,
	`contractId` varchar(255) NOT NULL,
	`audience` enum('patient','hospital') NOT NULL,
	`bundleType` varchar(128) NOT NULL,
	`direction` enum('inbound','outbound','bidirectional') NOT NULL DEFAULT 'inbound',
	`transportPolicyJson` json,
	`itemsJson` json,
	`status` enum('active','draft','deprecated') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `service_bundle_templates_id` PRIMARY KEY(`id`),
	CONSTRAINT `service_bundle_templates_templateId_unique` UNIQUE(`templateId`)
);
--> statement-breakpoint
CREATE TABLE `service_readiness_checks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`patientId` int NOT NULL,
	`context` enum('opd_visit','emergency','referral','cross_border','medical_tourist','insurance_claim','pharmacy_dispense') NOT NULL,
	`hospitalId` int,
	`serviceName` varchar(255),
	`score` int NOT NULL,
	`criticalReady` boolean NOT NULL DEFAULT false,
	`requiredMissing` json,
	`recommendedMissing` json,
	`selectedCredentialIds` json,
	`packetPresentationId` varchar(255),
	`shlId` int,
	`status` enum('draft','ready','shared','completed','cancelled') NOT NULL DEFAULT 'draft',
	`metadata` json,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `service_readiness_checks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `service_readiness_contracts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contractId` varchar(255) NOT NULL,
	`context` enum('opd_visit','emergency','referral','cross_border','medical_tourist','insurance_claim','pharmacy_dispense') NOT NULL,
	`version` varchar(64) NOT NULL,
	`status` enum('active','draft','deprecated') NOT NULL DEFAULT 'active',
	`patientLabel` varchar(255) NOT NULL,
	`patientLabelEn` varchar(255) NOT NULL,
	`hospitalLabel` varchar(255) NOT NULL,
	`hospitalLabelEn` varchar(255) NOT NULL,
	`patientVisible` boolean NOT NULL DEFAULT true,
	`hospitalVisible` boolean NOT NULL DEFAULT true,
	`patientBundleType` varchar(128) NOT NULL,
	`hospitalBundleType` varchar(128) NOT NULL,
	`requirementsJson` json,
	`questionnaireJson` json,
	`consentPolicyJson` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `service_readiness_contracts_id` PRIMARY KEY(`id`),
	CONSTRAINT `service_readiness_contracts_contractId_unique` UNIQUE(`contractId`)
);
--> statement-breakpoint
CREATE TABLE `shl_access_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shlId` int NOT NULL,
	`accessorName` varchar(255),
	`accessorOrg` varchar(255),
	`accessorCountry` varchar(3),
	`recipient` varchar(255),
	`result` enum('granted','denied','expired','revoked','bad_passcode','max_accessed','rate_limited') NOT NULL DEFAULT 'granted',
	`failureReason` text,
	`userAgent` text,
	`manifestRequestedAt` timestamp,
	`fileId` varchar(128),
	`countryHint` varchar(3),
	`verifiedVpResult` json,
	`ipAddress` varchar(45),
	`accessedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `shl_access_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shl_files` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shlId` int NOT NULL,
	`manifestVersion` int NOT NULL DEFAULT 1,
	`fileId` varchar(128) NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`contentType` enum('application/fhir+json','application/smart-health-card','application/smart-api-access') NOT NULL,
	`embeddedJwe` mediumtext,
	`location` text,
	`contentHash` varchar(128) NOT NULL,
	`plaintextHash` varchar(128),
	`encryptedSizeBytes` int,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `shl_files_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shl_manifest_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shlId` int NOT NULL,
	`manifestVersion` int NOT NULL DEFAULT 1,
	`documentId` varchar(128) NOT NULL,
	`sequence` int NOT NULL,
	`documentType` varchar(128) NOT NULL,
	`title` varchar(255) NOT NULL,
	`category` varchar(128) NOT NULL,
	`status` varchar(64) NOT NULL,
	`sourceRole` varchar(128) NOT NULL,
	`fhirResource` varchar(64) NOT NULL,
	`fhirDocumentReferenceId` varchar(255),
	`shlFileId` varchar(128),
	`contentHash` varchar(128),
	`plaintextHash` varchar(128),
	`sourceBundleHash` varchar(255),
	`manifestCredentialId` varchar(255),
	`presentationId` varchar(255),
	`objectLinksJson` json NOT NULL,
	`vcBindingJson` json NOT NULL,
	`accessBindingJson` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `shl_manifest_documents_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_shl_manifest_doc` UNIQUE(`shlId`,`manifestVersion`,`documentId`)
);
--> statement-breakpoint
CREATE TABLE `shl_manifest_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shlId` int NOT NULL,
	`manifestVersion` int NOT NULL DEFAULT 1,
	`contextHash` varchar(128) NOT NULL,
	`scopeHash` varchar(128),
	`sourceBundleHash` varchar(255),
	`manifestHash` varchar(255) NOT NULL,
	`manifestCredentialId` varchar(255),
	`presentationId` varchar(255),
	`status` enum('current','superseded','revoked') NOT NULL DEFAULT 'current',
	`changeReason` text,
	`createdBy` int,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `shl_manifest_versions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `smart_health_links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`patientId` int NOT NULL,
	`issuedBy` int NOT NULL,
	`hospitalId` int NOT NULL,
	`purpose` enum('referral','patient_summary','discharge','cross_border','medical_tourist','insurance','self_share') NOT NULL,
	`context` varchar(64),
	`label` varchar(80),
	`scope` json,
	`manifestHash` varchar(255),
	`manifestToken` varchar(128),
	`manifestUrl` text,
	`encryptionKey` text,
	`shlUrl` text,
	`qrPayload` text,
	`viewerUrl` text,
	`status` enum('pending_review','active','expired','revoked','disabled','max_accessed') NOT NULL DEFAULT 'active',
	`maxAccessCount` int,
	`currentAccessCount` int NOT NULL DEFAULT 0,
	`passcodeRequired` boolean NOT NULL DEFAULT true,
	`passcodeSalt` varchar(128),
	`passcodeHash` varchar(255),
	`passcodeFailedAttempts` int NOT NULL DEFAULT 0,
	`passcodeMaxAttempts` int NOT NULL DEFAULT 5,
	`longTerm` boolean NOT NULL DEFAULT false,
	`singleFile` boolean NOT NULL DEFAULT false,
	`recipientPolicy` json,
	`consentCredentialId` varchar(255),
	`manifestCredentialId` varchar(255),
	`presentationId` varchar(255),
	`sourceBundleHash` varchar(255),
	`policyDecision` json,
	`currentManifestVersion` int NOT NULL DEFAULT 1,
	`contextHash` varchar(128),
	`autoUpdatePolicy` varchar(32) DEFAULT 'manual_review',
	`lastAccessedAt` timestamp,
	`disabledReason` text,
	`expiresAt` timestamp,
	`revokedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `smart_health_links_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sync_reconciliation_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobId` varchar(255) NOT NULL,
	`planId` varchar(255) NOT NULL,
	`executionId` varchar(255) NOT NULL,
	`targetId` varchar(255) NOT NULL,
	`targetKind` varchar(50) NOT NULL,
	`status` enum('not_required','scheduled','manual_review','running','passed','failed','cancelled') NOT NULL DEFAULT 'scheduled',
	`runMode` enum('read_back','ack_replay','manual_review') NOT NULL,
	`reason` text,
	`checks` json,
	`attempts` int NOT NULL DEFAULT 0,
	`dueAt` timestamp,
	`completedAt` timestamp,
	`result` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sync_reconciliation_jobs_id` PRIMARY KEY(`id`),
	CONSTRAINT `sync_reconciliation_jobs_jobId_unique` UNIQUE(`jobId`)
);
--> statement-breakpoint
CREATE TABLE `tao_trust_policies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`credentialType` varchar(100) NOT NULL,
	`requiredTrustLevel` enum('accredited','recognized','self_declared','any') NOT NULL DEFAULT 'recognized',
	`requiredTrustAnchor` enum('etda','gdhcn','moph','nhso','any') NOT NULL DEFAULT 'any',
	`enforcementMode` enum('strict','advisory','off') NOT NULL DEFAULT 'advisory',
	`description` text,
	`descriptionEn` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tao_trust_policies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tao_trusted_issuers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`did` varchar(512) NOT NULL,
	`name` varchar(255) NOT NULL,
	`nameEn` varchar(255),
	`organizationType` enum('hospital','clinic','lab','pharmacy','government','insurance','international') NOT NULL,
	`country` varchar(3) NOT NULL DEFAULT 'THA',
	`jurisdiction` varchar(100),
	`trustLevel` enum('accredited','recognized','self_declared','pending','suspended','revoked') NOT NULL DEFAULT 'pending',
	`accreditationBody` varchar(255),
	`accreditationId` varchar(255),
	`accreditedAt` timestamp,
	`accreditationExpires` timestamp,
	`credentialTypesAllowed` json,
	`publicKeyJwk` json,
	`x509Certificate` text,
	`trustAnchor` enum('etda','gdhcn','moph','nhso','self') NOT NULL DEFAULT 'self',
	`contactEmail` varchar(320),
	`contactUrl` text,
	`hospitalId` int,
	`isActive` boolean NOT NULL DEFAULT true,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tao_trusted_issuers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tao_trusted_verifiers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`did` varchar(512) NOT NULL,
	`name` varchar(255) NOT NULL,
	`nameEn` varchar(255),
	`organizationType` enum('hospital','clinic','insurance','government','employer','border_control','research') NOT NULL,
	`country` varchar(3) NOT NULL DEFAULT 'THA',
	`trustLevel` enum('accredited','recognized','self_declared','pending','suspended','revoked') NOT NULL DEFAULT 'pending',
	`credentialTypesAccepted` json,
	`purposesAllowed` json,
	`trustAnchor` enum('etda','gdhcn','moph','nhso','self') NOT NULL DEFAULT 'self',
	`contactEmail` varchar(320),
	`hospitalId` int,
	`isActive` boolean NOT NULL DEFAULT true,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tao_trusted_verifiers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `terminology_mappings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`hospitalId` int NOT NULL,
	`localCode` varchar(100) NOT NULL,
	`localDisplay` varchar(500),
	`codeSystem` enum('icd10','snomed_ct','loinc','tmt','cvx') NOT NULL,
	`standardCode` varchar(100),
	`standardDisplay` varchar(500),
	`confidence` int,
	`mappingSource` enum('manual','llm_suggested','verified') NOT NULL DEFAULT 'manual',
	`status` enum('pending','accepted','rejected') NOT NULL DEFAULT 'pending',
	`reviewedBy` int,
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `terminology_mappings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `travel_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`caseId` int NOT NULL,
	`documentType` enum('passport','insurance_card','referral_letter','lab_report','imaging_report','medication_list','medical_certificate','visa_support_letter','quotation','guarantee_letter','other') NOT NULL,
	`fileName` varchar(255),
	`fileUrl` text,
	`fileKey` varchar(500),
	`verificationStatus` enum('pending','verified','unverified','rejected') NOT NULL DEFAULT 'pending',
	`verifiedBy` int,
	`verifiedAt` timestamp,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `travel_documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trust_registry` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entityType` enum('issuer','verifier','provider','payer','partner_hospital','foreign_hospital') NOT NULL,
	`entityName` varchar(255) NOT NULL,
	`entityNameEn` varchar(255),
	`did` varchar(512),
	`publicKeyJwk` json,
	`x509Certificate` text,
	`country` varchar(3),
	`jurisdiction` varchar(100),
	`trustLevel` enum('verified','self_declared','pending','revoked') NOT NULL DEFAULT 'pending',
	`credentialTypes` json,
	`contactEmail` varchar(320),
	`contactUrl` text,
	`verifiedAt` timestamp,
	`verifiedBy` int,
	`isActive` boolean NOT NULL DEFAULT true,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `trust_registry_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_roles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`role` varchar(64) NOT NULL,
	`scope` varchar(255),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_roles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`systemRole` enum('system_admin','hospital_admin','maker','checker','doctor','nurse','integration_engineer','patient') NOT NULL DEFAULT 'patient',
	`hospitalId` int,
	`departmentId` int,
	`thaiId` varchar(13),
	`phone` varchar(20),
	`avatarUrl` text,
	`credentialEntitlements` json,
	`preferredLanguage` enum('th','en') NOT NULL DEFAULT 'th',
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
CREATE TABLE `vc_schema_registry` (
	`id` int AUTO_INCREMENT NOT NULL,
	`credentialType` varchar(100) NOT NULL,
	`version` varchar(20) NOT NULL,
	`jsonSchema` json NOT NULL,
	`changelog` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `vc_schema_registry_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vc_vp_seed_batches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`batchId` varchar(255) NOT NULL,
	`sourceKit` varchar(255) NOT NULL,
	`inputHash` varchar(128) NOT NULL,
	`patientsPerHospital` int NOT NULL,
	`generatedCredentialCount` int NOT NULL DEFAULT 0,
	`generatedPresentationCount` int NOT NULL DEFAULT 0,
	`status` enum('running','completed','failed') NOT NULL DEFAULT 'running',
	`startedBy` int,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`summary` json,
	CONSTRAINT `vc_vp_seed_batches_id` PRIMARY KEY(`id`),
	CONSTRAINT `vc_vp_seed_batches_batchId_unique` UNIQUE(`batchId`)
);
--> statement-breakpoint
CREATE TABLE `walk_in_wallet_connections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`connectionId` varchar(255) NOT NULL,
	`patientId` int,
	`patientName` varchar(255),
	`holderDid` varchar(255) NOT NULL,
	`walletStatus` enum('invitation_sent','pending_verification','active','suspended','revoked') NOT NULL DEFAULT 'invitation_sent',
	`identityConfidence` enum('low','medium','high','verified') DEFAULT 'low',
	`consentRef` varchar(255),
	`hnMappingJson` json,
	`connectedBy` int,
	`connectedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `walk_in_wallet_connections_id` PRIMARY KEY(`id`),
	CONSTRAINT `walk_in_wallet_connections_connectionId_unique` UNIQUE(`connectionId`)
);
--> statement-breakpoint
CREATE TABLE `wallet_cards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`patientId` int NOT NULL,
	`credentialId` int NOT NULL,
	`cardType` enum('allergy','medication','patient_summary','consent','identity','immunization','referral','medical_certificate','prescription','lab_result','diagnostic_report','discharge_summary','coverage','claim','travel_document','shl_manifest','pharmacy_dispense','appointment','visa_support_letter','quotation','guarantee_letter','mpi_link_certificate','sync_receipt') NOT NULL,
	`displayName` varchar(255) NOT NULL,
	`displayNameEn` varchar(255),
	`issuerHospitalName` varchar(255),
	`issuerDid` varchar(512),
	`documentCategory` varchar(64),
	`cardColor` varchar(7) DEFAULT '#2563eb',
	`isPinned` boolean NOT NULL DEFAULT false,
	`lastPresentedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `wallet_cards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `wallet_document_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestId` varchar(255) NOT NULL,
	`patientId` int NOT NULL,
	`context` enum('opd_visit','emergency','referral','cross_border','medical_tourist','insurance_claim','pharmacy_dispense') NOT NULL,
	`documentType` varchar(100) NOT NULL,
	`documentCategory` varchar(64),
	`sourceType` enum('his','lis','ris','pacs','hospital_app','national_app','partner_portal','payer','patient_upload','personal_health_app','other') NOT NULL DEFAULT 'his',
	`sourceName` varchar(255),
	`targetHospitalId` int,
	`status` enum('draft','pending_consent','requested','imported','needs_review','converted_to_vc','rejected','cancelled') NOT NULL DEFAULT 'requested',
	`requestedBy` int,
	`consentRecordId` int,
	`caseDocumentId` int,
	`credentialRequestId` int,
	`notes` text,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `wallet_document_requests_id` PRIMARY KEY(`id`),
	CONSTRAINT `wallet_document_requests_requestId_unique` UNIQUE(`requestId`)
);
--> statement-breakpoint
CREATE TABLE `wallet_import_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`importId` varchar(255) NOT NULL,
	`patientId` int NOT NULL,
	`context` enum('opd_visit','emergency','referral','cross_border','medical_tourist','insurance_claim','pharmacy_dispense') NOT NULL,
	`sourceType` enum('patient_upload','fhir_native','vc_vp','shl_manifest','partner_portal','his_pull','lis_pull','ris_pull') NOT NULL,
	`documentType` varchar(128) NOT NULL,
	`consentRef` varchar(255),
	`status` enum('queued','processing','needs_review','ready','rejected','cancelled') NOT NULL DEFAULT 'queued',
	`dqiScore` int,
	`documentReferenceJson` json,
	`hash` varchar(128),
	`reviewPolicy` varchar(128),
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `wallet_import_jobs_id` PRIMARY KEY(`id`),
	CONSTRAINT `wallet_import_jobs_importId_unique` UNIQUE(`importId`)
);
--> statement-breakpoint
CREATE INDEX `idx_audit_actor` ON `audit_events` (`actorId`);--> statement-breakpoint
CREATE INDEX `idx_audit_action` ON `audit_events` (`action`);--> statement-breakpoint
CREATE INDEX `idx_audit_created` ON `audit_events` (`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_cir_status` ON `credential_issuance_requests` (`status`);--> statement-breakpoint
CREATE INDEX `idx_cir_maker` ON `credential_issuance_requests` (`makerId`);--> statement-breakpoint
CREATE INDEX `idx_cir_checker` ON `credential_issuance_requests` (`checkerId`);--> statement-breakpoint
CREATE INDEX `idx_cir_subject` ON `credential_issuance_requests` (`subjectId`);--> statement-breakpoint
CREATE INDEX `idx_cir_hospital` ON `credential_issuance_requests` (`issuerHospitalId`);--> statement-breakpoint
CREATE INDEX `idx_cr_status` ON `credential_requests` (`status`);--> statement-breakpoint
CREATE INDEX `idx_cr_maker` ON `credential_requests` (`makerId`);--> statement-breakpoint
CREATE INDEX `idx_cr_checker` ON `credential_requests` (`checkerId`);--> statement-breakpoint
CREATE INDEX `idx_cr_patient` ON `credential_requests` (`patientId`);--> statement-breakpoint
CREATE INDEX `idx_ewak_app` ON `external_wallet_api_keys` (`appId`);--> statement-breakpoint
CREATE INDEX `idx_ewak_prefix` ON `external_wallet_api_keys` (`keyPrefix`);--> statement-breakpoint
CREATE INDEX `idx_ewa_status` ON `external_wallet_apps` (`status`);--> statement-breakpoint
CREATE INDEX `idx_ewa_wallet_type` ON `external_wallet_apps` (`walletType`);--> statement-breakpoint
CREATE INDEX `idx_ewal_app` ON `external_wallet_audit_logs` (`appId`);--> statement-breakpoint
CREATE INDEX `idx_ewal_action` ON `external_wallet_audit_logs` (`action`);--> statement-breakpoint
CREATE INDEX `idx_ewal_created` ON `external_wallet_audit_logs` (`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_ewal_patient` ON `external_wallet_audit_logs` (`patientId`);--> statement-breakpoint
CREATE INDEX `idx_ews_app` ON `external_wallet_sessions` (`appId`);--> statement-breakpoint
CREATE INDEX `idx_ews_patient` ON `external_wallet_sessions` (`patientId`);--> statement-breakpoint
CREATE INDEX `idx_ews_expires` ON `external_wallet_sessions` (`expiresAt`);--> statement-breakpoint
CREATE INDEX `idx_ic_subject` ON `issued_credentials` (`subjectId`);--> statement-breakpoint
CREATE INDEX `idx_ic_hospital` ON `issued_credentials` (`issuerHospitalId`);--> statement-breakpoint
CREATE INDEX `idx_ic_status` ON `issued_credentials` (`status`);--> statement-breakpoint
CREATE INDEX `idx_ic_type` ON `issued_credentials` (`type`);--> statement-breakpoint
CREATE INDEX `idx_notif_user` ON `notifications` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_notif_user_read` ON `notifications` (`userId`,`isRead`);--> statement-breakpoint
CREATE INDEX `idx_pud_patient` ON `patient_uploaded_documents` (`patientId`);--> statement-breakpoint
CREATE INDEX `idx_pud_status` ON `patient_uploaded_documents` (`status`);--> statement-breakpoint
CREATE INDEX `idx_pud_context` ON `patient_uploaded_documents` (`context`);--> statement-breakpoint
CREATE INDEX `idx_ref_patient` ON `referrals` (`patientId`);--> statement-breakpoint
CREATE INDEX `idx_ref_from_hospital` ON `referrals` (`fromHospitalId`);--> statement-breakpoint
CREATE INDEX `idx_ref_to_hospital` ON `referrals` (`toHospitalId`);--> statement-breakpoint
CREATE INDEX `idx_ref_status` ON `referrals` (`status`);--> statement-breakpoint
CREATE INDEX `idx_smd_shl` ON `shl_manifest_documents` (`shlId`);--> statement-breakpoint
CREATE INDEX `idx_smd_type` ON `shl_manifest_documents` (`documentType`);--> statement-breakpoint
CREATE INDEX `idx_shl_patient` ON `smart_health_links` (`patientId`);--> statement-breakpoint
CREATE INDEX `idx_shl_status` ON `smart_health_links` (`status`);--> statement-breakpoint
CREATE INDEX `idx_shl_hospital` ON `smart_health_links` (`hospitalId`);--> statement-breakpoint
CREATE INDEX `idx_users_system_role` ON `users` (`systemRole`);--> statement-breakpoint
CREATE INDEX `idx_users_hospital_id` ON `users` (`hospitalId`);--> statement-breakpoint
CREATE INDEX `idx_users_is_active` ON `users` (`isActive`);--> statement-breakpoint
CREATE INDEX `idx_wc_patient` ON `wallet_cards` (`patientId`);