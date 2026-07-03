CREATE TABLE `shl_manifest_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shlId` int NOT NULL,
	`manifestVersion` int NOT NULL DEFAULT 1,
	`documentId` varchar(128) NOT NULL,
	`sequence` int NOT NULL,
	`documentType` varchar(128) NOT NULL,
	`title` varchar(255) NOT NULL,
	`category` varchar(128) NOT NULL,
	`status` varchar(64) NOT NULL,
	`sourceRole` varchar(128) NOT NULL,
	`fhirResource` varchar(64) NOT NULL,
	`fhirDocumentReferenceId` varchar(255),
	`shlFileId` varchar(128),
	`contentHash` varchar(128),
	`plaintextHash` varchar(128),
	`sourceBundleHash` varchar(255),
	`manifestCredentialId` varchar(255),
	`presentationId` varchar(255),
	`objectLinksJson` json NOT NULL,
	`vcBindingJson` json NOT NULL,
	`accessBindingJson` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `shl_manifest_documents_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_shl_manifest_doc` UNIQUE(`shlId`,`manifestVersion`,`documentId`)
);
--> statement-breakpoint
CREATE INDEX `idx_smd_shl` ON `shl_manifest_documents` (`shlId`);--> statement-breakpoint
CREATE INDEX `idx_smd_type` ON `shl_manifest_documents` (`documentType`);