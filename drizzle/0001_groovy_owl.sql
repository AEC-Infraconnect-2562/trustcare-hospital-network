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
CREATE TABLE `credential_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`hospitalId` int,
	`name` varchar(255) NOT NULL,
	`nameEn` varchar(255),
	`type` enum('patient_identity','consent_receipt','patient_summary','allergy_alert','medication_summary','referral_vc','immunization') NOT NULL,
	`version` varchar(20) NOT NULL DEFAULT '1.0',
	`schema` json,
	`fhirResourceType` varchar(100),
	`validityDays` int DEFAULT 365,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `credential_templates_id` PRIMARY KEY(`id`)
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
CREATE TABLE `issued_credentials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`credentialId` varchar(255) NOT NULL,
	`templateId` int NOT NULL,
	`issuerId` int NOT NULL,
	`issuerHospitalId` int NOT NULL,
	`subjectId` int NOT NULL,
	`type` enum('patient_identity','consent_receipt','patient_summary','allergy_alert','medication_summary','referral_vc','immunization') NOT NULL,
	`status` enum('active','revoked','expired','suspended') NOT NULL DEFAULT 'active',
	`credentialData` json,
	`sdJwtVc` text,
	`issuedAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp,
	`revokedAt` timestamp,
	`revocationReason` text,
	`fhirResourceId` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `issued_credentials_id` PRIMARY KEY(`id`),
	CONSTRAINT `issued_credentials_credentialId_unique` UNIQUE(`credentialId`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`hospitalId` int,
	`type` enum('hospital_onboarded','vc_revoked','break_glass','data_quality','referral_update','consent_request','system') NOT NULL,
	`title` varchar(255) NOT NULL,
	`message` text,
	`isRead` boolean NOT NULL DEFAULT false,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
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
CREATE TABLE `wallet_cards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`patientId` int NOT NULL,
	`credentialId` int NOT NULL,
	`cardType` enum('allergy','medication','patient_summary','consent','identity','immunization','referral') NOT NULL,
	`displayName` varchar(255) NOT NULL,
	`displayNameEn` varchar(255),
	`issuerHospitalName` varchar(255),
	`cardColor` varchar(7) DEFAULT '#2563eb',
	`isPinned` boolean NOT NULL DEFAULT false,
	`lastPresentedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `wallet_cards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `systemRole` enum('system_admin','hospital_admin','doctor','nurse','integration_engineer','patient') DEFAULT 'patient' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `hospitalId` int;--> statement-breakpoint
ALTER TABLE `users` ADD `departmentId` int;--> statement-breakpoint
ALTER TABLE `users` ADD `thaiId` varchar(13);--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(20);--> statement-breakpoint
ALTER TABLE `users` ADD `avatarUrl` text;--> statement-breakpoint
ALTER TABLE `users` ADD `preferredLanguage` enum('th','en') DEFAULT 'th' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `isActive` boolean DEFAULT true NOT NULL;