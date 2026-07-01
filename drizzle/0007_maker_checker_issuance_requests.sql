ALTER TABLE `users` MODIFY COLUMN `systemRole` enum('system_admin','hospital_admin','maker','checker','doctor','nurse','integration_engineer','patient') NOT NULL DEFAULT 'patient';
--> statement-breakpoint
ALTER TABLE `users` ADD `credentialEntitlements` json;
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
