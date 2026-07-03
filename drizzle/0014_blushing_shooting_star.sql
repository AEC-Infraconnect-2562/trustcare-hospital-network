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
CREATE TABLE `credential_issuance_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestId` varchar(255) NOT NULL,
	`templateId` int,
	`issuerHospitalId` int NOT NULL,
	`subjectId` int NOT NULL,
	`type` enum('patient_identity','consent_receipt','patient_summary','allergy_alert','medication_summary','referral_vc','immunization','medical_certificate','prescription','lab_result','diagnostic_report','discharge_summary','insurance_eligibility','claim_package','claim_receipt','travel_document_verification','shl_manifest','pharmacy_dispense','appointment','visa_support_letter','quotation','guarantee_letter','mpi_link_certificate','sync_receipt') NOT NULL,
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
ALTER TABLE `credential_requests` DROP INDEX `credential_requests_requestNumber_unique`;--> statement-breakpoint
ALTER TABLE `credential_templates` MODIFY COLUMN `type` enum('patient_identity','consent_receipt','patient_summary','allergy_alert','medication_summary','referral_vc','immunization','medical_certificate','prescription','lab_result','diagnostic_report','discharge_summary','insurance_eligibility','claim_package','claim_receipt','travel_document_verification','shl_manifest','pharmacy_dispense','appointment','visa_support_letter','quotation','guarantee_letter','mpi_link_certificate','sync_receipt') NOT NULL;--> statement-breakpoint
ALTER TABLE `issued_credentials` MODIFY COLUMN `type` enum('patient_identity','consent_receipt','patient_summary','allergy_alert','medication_summary','referral_vc','immunization','medical_certificate','prescription','lab_result','diagnostic_report','discharge_summary','insurance_eligibility','claim_package','claim_receipt','travel_document_verification','shl_manifest','pharmacy_dispense','appointment','visa_support_letter','quotation','guarantee_letter','mpi_link_certificate','sync_receipt') NOT NULL;--> statement-breakpoint
ALTER TABLE `issued_credentials` MODIFY COLUMN `sdJwtVc` mediumtext;--> statement-breakpoint
ALTER TABLE `mapping_versions` MODIFY COLUMN `version` varchar(100) NOT NULL;--> statement-breakpoint
ALTER TABLE `notifications` MODIFY COLUMN `type` enum('hospital_onboarded','vc_revoked','break_glass','data_quality','referral_update','consent_request','consent_expiry_reminder','system','vc_request_created','vc_submitted_for_review','vc_approved','vc_rejected','vc_issued') NOT NULL;--> statement-breakpoint
ALTER TABLE `smart_health_links` MODIFY COLUMN `status` enum('pending_review','active','expired','revoked','disabled','max_accessed') NOT NULL DEFAULT 'active';--> statement-breakpoint
ALTER TABLE `user_roles` MODIFY COLUMN `role` varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE `user_roles` MODIFY COLUMN `scope` varchar(255);--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `systemRole` enum('system_admin','hospital_admin','maker','checker','doctor','nurse','integration_engineer','patient') NOT NULL DEFAULT 'patient';--> statement-breakpoint
ALTER TABLE `wallet_cards` MODIFY COLUMN `cardType` enum('allergy','medication','patient_summary','consent','identity','immunization','referral','medical_certificate','prescription','lab_result','diagnostic_report','discharge_summary','coverage','claim','travel_document','shl_manifest','pharmacy_dispense','appointment','visa_support_letter','quotation','guarantee_letter','mpi_link_certificate','sync_receipt') NOT NULL;--> statement-breakpoint
ALTER TABLE `credential_templates` ADD `documentCategory` varchar(64);--> statement-breakpoint
ALTER TABLE `credential_templates` ADD `documentSubcategory` varchar(64);--> statement-breakpoint
ALTER TABLE `credential_templates` ADD `defaultStoragePath` varchar(500);--> statement-breakpoint
ALTER TABLE `credential_templates` ADD `schemaVersion` varchar(20) DEFAULT '1.0.0' NOT NULL;--> statement-breakpoint
ALTER TABLE `issued_credentials` ADD `documentCategory` varchar(64);--> statement-breakpoint
ALTER TABLE `issued_credentials` ADD `documentSubcategory` varchar(64);--> statement-breakpoint
ALTER TABLE `issued_credentials` ADD `storageKey` varchar(500);--> statement-breakpoint
ALTER TABLE `issued_credentials` ADD `searchTags` json;--> statement-breakpoint
ALTER TABLE `issued_credentials` ADD `schemaVersion` varchar(20) DEFAULT '1.0.0' NOT NULL;--> statement-breakpoint
ALTER TABLE `shl_access_logs` ADD `recipient` varchar(255);--> statement-breakpoint
ALTER TABLE `shl_access_logs` ADD `result` enum('granted','denied','expired','revoked','bad_passcode','max_accessed','rate_limited') DEFAULT 'granted' NOT NULL;--> statement-breakpoint
ALTER TABLE `shl_access_logs` ADD `failureReason` text;--> statement-breakpoint
ALTER TABLE `shl_access_logs` ADD `userAgent` text;--> statement-breakpoint
ALTER TABLE `shl_access_logs` ADD `manifestRequestedAt` timestamp;--> statement-breakpoint
ALTER TABLE `shl_access_logs` ADD `fileId` varchar(128);--> statement-breakpoint
ALTER TABLE `shl_access_logs` ADD `countryHint` varchar(3);--> statement-breakpoint
ALTER TABLE `shl_access_logs` ADD `verifiedVpResult` json;--> statement-breakpoint
ALTER TABLE `smart_health_links` ADD `context` varchar(64);--> statement-breakpoint
ALTER TABLE `smart_health_links` ADD `label` varchar(80);--> statement-breakpoint
ALTER TABLE `smart_health_links` ADD `manifestToken` varchar(128);--> statement-breakpoint
ALTER TABLE `smart_health_links` ADD `manifestUrl` text;--> statement-breakpoint
ALTER TABLE `smart_health_links` ADD `viewerUrl` text;--> statement-breakpoint
ALTER TABLE `smart_health_links` ADD `passcodeRequired` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `smart_health_links` ADD `passcodeSalt` varchar(128);--> statement-breakpoint
ALTER TABLE `smart_health_links` ADD `passcodeHash` varchar(255);--> statement-breakpoint
ALTER TABLE `smart_health_links` ADD `passcodeFailedAttempts` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `smart_health_links` ADD `passcodeMaxAttempts` int DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE `smart_health_links` ADD `longTerm` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `smart_health_links` ADD `singleFile` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `smart_health_links` ADD `recipientPolicy` json;--> statement-breakpoint
ALTER TABLE `smart_health_links` ADD `consentCredentialId` varchar(255);--> statement-breakpoint
ALTER TABLE `smart_health_links` ADD `manifestCredentialId` varchar(255);--> statement-breakpoint
ALTER TABLE `smart_health_links` ADD `presentationId` varchar(255);--> statement-breakpoint
ALTER TABLE `smart_health_links` ADD `sourceBundleHash` varchar(255);--> statement-breakpoint
ALTER TABLE `smart_health_links` ADD `policyDecision` json;--> statement-breakpoint
ALTER TABLE `smart_health_links` ADD `currentManifestVersion` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `smart_health_links` ADD `contextHash` varchar(128);--> statement-breakpoint
ALTER TABLE `smart_health_links` ADD `autoUpdatePolicy` varchar(32) DEFAULT 'manual_review';--> statement-breakpoint
ALTER TABLE `smart_health_links` ADD `lastAccessedAt` timestamp;--> statement-breakpoint
ALTER TABLE `smart_health_links` ADD `disabledReason` text;--> statement-breakpoint
ALTER TABLE `smart_health_links` ADD `updatedAt` timestamp DEFAULT (now()) NOT NULL ON UPDATE CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE `user_roles` ADD `createdAt` timestamp DEFAULT (now()) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `credentialEntitlements` json;--> statement-breakpoint
ALTER TABLE `wallet_cards` ADD `documentCategory` varchar(64);--> statement-breakpoint
ALTER TABLE `user_roles` DROP COLUMN `assignedBy`;--> statement-breakpoint
ALTER TABLE `user_roles` DROP COLUMN `assignedAt`;--> statement-breakpoint
ALTER TABLE `user_roles` DROP COLUMN `expiresAt`;