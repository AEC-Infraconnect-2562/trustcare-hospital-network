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
