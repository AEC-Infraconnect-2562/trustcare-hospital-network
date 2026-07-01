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
