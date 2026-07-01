-- Migration 0011: Smart Health Links transport hardening + VC/VP trust layer
-- Adds standards-aligned SHL manifest/file storage, passcode controls, and manifest version history.

ALTER TABLE `smart_health_links`
  MODIFY COLUMN `status` enum('pending_review','active','expired','revoked','disabled','max_accessed') NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS `context` varchar(64),
  ADD COLUMN IF NOT EXISTS `label` varchar(80),
  ADD COLUMN IF NOT EXISTS `manifestToken` varchar(128),
  ADD COLUMN IF NOT EXISTS `manifestUrl` text,
  ADD COLUMN IF NOT EXISTS `viewerUrl` text,
  ADD COLUMN IF NOT EXISTS `passcodeRequired` boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS `passcodeSalt` varchar(128),
  ADD COLUMN IF NOT EXISTS `passcodeHash` varchar(255),
  ADD COLUMN IF NOT EXISTS `passcodeFailedAttempts` int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `passcodeMaxAttempts` int NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS `longTerm` boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS `singleFile` boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS `recipientPolicy` json,
  ADD COLUMN IF NOT EXISTS `consentCredentialId` varchar(255),
  ADD COLUMN IF NOT EXISTS `manifestCredentialId` varchar(255),
  ADD COLUMN IF NOT EXISTS `presentationId` varchar(255),
  ADD COLUMN IF NOT EXISTS `sourceBundleHash` varchar(255),
  ADD COLUMN IF NOT EXISTS `policyDecision` json,
  ADD COLUMN IF NOT EXISTS `currentManifestVersion` int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS `contextHash` varchar(128),
  ADD COLUMN IF NOT EXISTS `autoUpdatePolicy` varchar(32) DEFAULT 'manual_review',
  ADD COLUMN IF NOT EXISTS `lastAccessedAt` timestamp,
  ADD COLUMN IF NOT EXISTS `disabledReason` text,
  ADD COLUMN IF NOT EXISTS `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS `shl_files` (
  `id` int AUTO_INCREMENT NOT NULL,
  `shlId` int NOT NULL,
  `manifestVersion` int NOT NULL DEFAULT 1,
  `fileId` varchar(128) NOT NULL,
  `version` int NOT NULL DEFAULT 1,
  `contentType` enum('application/fhir+json','application/smart-health-card','application/smart-api-access') NOT NULL,
  `embeddedJwe` mediumtext,
  `location` text,
  `contentHash` varchar(128) NOT NULL,
  `plaintextHash` varchar(128),
  `encryptedSizeBytes` int,
  `metadata` json,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY(`id`)
);

CREATE TABLE IF NOT EXISTS `shl_manifest_versions` (
  `id` int AUTO_INCREMENT NOT NULL,
  `shlId` int NOT NULL,
  `manifestVersion` int NOT NULL DEFAULT 1,
  `contextHash` varchar(128) NOT NULL,
  `scopeHash` varchar(128),
  `sourceBundleHash` varchar(255),
  `manifestHash` varchar(255) NOT NULL,
  `manifestCredentialId` varchar(255),
  `presentationId` varchar(255),
  `status` enum('current','superseded','revoked') NOT NULL DEFAULT 'current',
  `changeReason` text,
  `createdBy` int,
  `metadata` json,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY(`id`)
);

ALTER TABLE `shl_access_logs`
  ADD COLUMN IF NOT EXISTS `recipient` varchar(255),
  ADD COLUMN IF NOT EXISTS `result` enum('granted','denied','expired','revoked','bad_passcode','max_accessed','rate_limited') NOT NULL DEFAULT 'granted',
  ADD COLUMN IF NOT EXISTS `failureReason` text,
  ADD COLUMN IF NOT EXISTS `userAgent` text,
  ADD COLUMN IF NOT EXISTS `manifestRequestedAt` timestamp,
  ADD COLUMN IF NOT EXISTS `fileId` varchar(128),
  ADD COLUMN IF NOT EXISTS `countryHint` varchar(3),
  ADD COLUMN IF NOT EXISTS `verifiedVpResult` json;
