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
CREATE TABLE `mapping_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`adapterId` int NOT NULL,
	`resourceType` varchar(100) NOT NULL,
	`version` varchar(20) NOT NULL,
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
CREATE TABLE `payer_adapters` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`payerType` enum('nhso','sso','csmbs','private_insurance','corporate','self_pay') NOT NULL,
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
CREATE TABLE `shl_access_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shlId` int NOT NULL,
	`accessorName` varchar(255),
	`accessorOrg` varchar(255),
	`accessorCountry` varchar(3),
	`ipAddress` varchar(45),
	`accessedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `shl_access_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `smart_health_links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`patientId` int NOT NULL,
	`issuedBy` int NOT NULL,
	`hospitalId` int NOT NULL,
	`purpose` enum('referral','patient_summary','discharge','cross_border','medical_tourist','insurance','self_share') NOT NULL,
	`scope` json,
	`manifestHash` varchar(255),
	`encryptionKey` text,
	`shlUrl` text,
	`qrPayload` text,
	`status` enum('active','expired','revoked') NOT NULL DEFAULT 'active',
	`maxAccessCount` int,
	`currentAccessCount` int NOT NULL DEFAULT 0,
	`expiresAt` timestamp,
	`revokedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `smart_health_links_id` PRIMARY KEY(`id`)
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
