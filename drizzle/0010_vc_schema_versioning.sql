-- Migration 0010: VC Schema Versioning
-- Adds vc_schema_registry table and schemaVersion columns to credential_templates and issued_credentials

CREATE TABLE IF NOT EXISTS `vc_schema_registry` (
  `id` int AUTO_INCREMENT NOT NULL,
  `credentialType` varchar(100) NOT NULL,
  `version` varchar(20) NOT NULL,
  `jsonSchema` json NOT NULL,
  `changelog` text,
  `isActive` boolean NOT NULL DEFAULT true,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY(`id`)
);

ALTER TABLE `credential_templates` ADD COLUMN IF NOT EXISTS `schemaVersion` varchar(20) NOT NULL DEFAULT '1.0.0';
ALTER TABLE `issued_credentials` ADD COLUMN IF NOT EXISTS `schemaVersion` varchar(20) NOT NULL DEFAULT '1.0.0';
