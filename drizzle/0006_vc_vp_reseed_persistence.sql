CREATE TABLE `issued_presentations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`presentationId` varchar(255) NOT NULL,
	`patientId` int NOT NULL,
	`holderDid` varchar(512) NOT NULL,
	`context` varchar(64) NOT NULL,
	`purpose` varchar(64) NOT NULL,
	`audience` text,
	`presentationJwt` text NOT NULL,
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
