CREATE TABLE `integration_dead_letter_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobId` varchar(255) NOT NULL,
	`tenantId` varchar(100) NOT NULL DEFAULT 'trustcare-network',
	`hospitalId` int,
	`correlationId` varchar(255) NOT NULL,
	`reason` text NOT NULL,
	`lastErrorCode` varchar(100),
	`lastErrorMessage` text,
	`lastPayloadHash` varchar(128),
	`attempts` int NOT NULL DEFAULT 0,
	`metadata` json,
	`status` enum('open','requeued','resolved','ignored') NOT NULL DEFAULT 'open',
	`resolvedAt` timestamp,
	`resolvedBy` int,
	`resolutionNote` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `integration_dead_letter_jobs_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_integration_dead_letter_job` UNIQUE(`jobId`)
);
--> statement-breakpoint
CREATE TABLE `integration_job_artifacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`artifactId` varchar(255) NOT NULL,
	`jobId` varchar(255) NOT NULL,
	`artifactType` enum('source_payload','canonical_fhir','document_reference','dqi_summary','vc_request','issued_vc','vp_package','shl_packet','sync_plan','sync_receipt','operation_outcome','object_reference') NOT NULL,
	`objectRef` text,
	`fhirReference` varchar(255),
	`hash` varchar(128),
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `integration_job_artifacts_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_integration_job_artifacts_artifact` UNIQUE(`artifactId`)
);
--> statement-breakpoint
CREATE TABLE `integration_job_attempts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobId` varchar(255) NOT NULL,
	`attemptNo` int NOT NULL,
	`status` enum('running','succeeded','failed','retry_scheduled','dead_lettered') NOT NULL DEFAULT 'running',
	`workerId` varchar(255),
	`correlationId` varchar(255) NOT NULL,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`finishedAt` timestamp,
	`durationMs` int,
	`errorCode` varchar(100),
	`errorMessage` text,
	`retryAt` timestamp,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `integration_job_attempts_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_integration_job_attempt` UNIQUE(`jobId`,`attemptNo`)
);
--> statement-breakpoint
CREATE TABLE `integration_job_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobId` varchar(255) NOT NULL,
	`eventType` varchar(100) NOT NULL,
	`level` enum('info','warning','error','debug') NOT NULL DEFAULT 'info',
	`status` varchar(64),
	`message` text,
	`correlationId` varchar(255) NOT NULL,
	`metadata` json,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `integration_job_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `integration_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobId` varchar(255) NOT NULL,
	`tenantId` varchar(100) NOT NULL DEFAULT 'trustcare-network',
	`hospitalId` int,
	`patientId` int,
	`adapterId` int,
	`context` enum('opd_visit','emergency','referral','cross_border','medical_tourist','insurance_claim','pharmacy_dispense'),
	`contractId` varchar(255),
	`contractVersion` varchar(64),
	`jobType` enum('import.source_payload','mapping.canonicalize_fhir','dqi.evaluate','document.create_reference','maker_checker.route_review','vc.issue','vp.build','shl.build_packet','sync_back.plan','sync_back.execute','reconciliation.run','adapter.health_check','noop') NOT NULL,
	`sourceType` enum('his_db_view','hl7v2','csv','fhir_native','patient_upload','document_metadata','smart_health_link','native_vc_vp','sync_back','adapter_health','manual') NOT NULL,
	`status` enum('queued','claimed','running','succeeded','failed','needs_review','dead_lettered','cancelled') NOT NULL DEFAULT 'queued',
	`priority` enum('low','normal','high','urgent') NOT NULL DEFAULT 'normal',
	`correlationId` varchar(255) NOT NULL,
	`idempotencyKey` varchar(255) NOT NULL,
	`payloadHash` varchar(128),
	`payload` json,
	`result` json,
	`errorCode` varchar(100),
	`errorMessage` text,
	`attempts` int NOT NULL DEFAULT 0,
	`maxAttempts` int NOT NULL DEFAULT 3,
	`availableAt` timestamp NOT NULL DEFAULT (now()),
	`lockedBy` varchar(255),
	`lockedAt` timestamp,
	`createdBy` int,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `integration_jobs_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_integration_jobs_job_id` UNIQUE(`jobId`),
	CONSTRAINT `uq_integration_jobs_idempotency` UNIQUE(`tenantId`,`idempotencyKey`)
);
--> statement-breakpoint
CREATE INDEX `idx_integration_dead_letter_tenant` ON `integration_dead_letter_jobs` (`tenantId`);--> statement-breakpoint
CREATE INDEX `idx_integration_dead_letter_status` ON `integration_dead_letter_jobs` (`status`);--> statement-breakpoint
CREATE INDEX `idx_integration_dead_letter_correlation` ON `integration_dead_letter_jobs` (`correlationId`);--> statement-breakpoint
CREATE INDEX `idx_integration_job_artifacts_job` ON `integration_job_artifacts` (`jobId`);--> statement-breakpoint
CREATE INDEX `idx_integration_job_artifacts_type` ON `integration_job_artifacts` (`artifactType`);--> statement-breakpoint
CREATE INDEX `idx_integration_job_attempts_job` ON `integration_job_attempts` (`jobId`);--> statement-breakpoint
CREATE INDEX `idx_integration_job_attempts_status` ON `integration_job_attempts` (`status`);--> statement-breakpoint
CREATE INDEX `idx_integration_job_events_job` ON `integration_job_events` (`jobId`);--> statement-breakpoint
CREATE INDEX `idx_integration_job_events_correlation` ON `integration_job_events` (`correlationId`);--> statement-breakpoint
CREATE INDEX `idx_integration_job_events_type` ON `integration_job_events` (`eventType`);--> statement-breakpoint
CREATE INDEX `idx_integration_jobs_status` ON `integration_jobs` (`status`);--> statement-breakpoint
CREATE INDEX `idx_integration_jobs_hospital` ON `integration_jobs` (`hospitalId`);--> statement-breakpoint
CREATE INDEX `idx_integration_jobs_patient` ON `integration_jobs` (`patientId`);--> statement-breakpoint
CREATE INDEX `idx_integration_jobs_context` ON `integration_jobs` (`context`);--> statement-breakpoint
CREATE INDEX `idx_integration_jobs_correlation` ON `integration_jobs` (`correlationId`);--> statement-breakpoint
CREATE INDEX `idx_integration_jobs_available` ON `integration_jobs` (`status`,`availableAt`);