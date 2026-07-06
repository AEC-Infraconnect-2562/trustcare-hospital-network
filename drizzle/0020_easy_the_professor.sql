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
CREATE INDEX `idx_ews_expires` ON `external_wallet_sessions` (`expiresAt`);