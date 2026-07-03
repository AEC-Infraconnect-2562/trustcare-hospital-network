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
CREATE INDEX `idx_pud_patient` ON `patient_uploaded_documents` (`patientId`);--> statement-breakpoint
CREATE INDEX `idx_pud_status` ON `patient_uploaded_documents` (`status`);--> statement-breakpoint
CREATE INDEX `idx_pud_context` ON `patient_uploaded_documents` (`context`);