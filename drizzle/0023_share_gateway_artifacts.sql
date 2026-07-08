CREATE TABLE `share_gateway_artifacts` (
  `id` int AUTO_INCREMENT NOT NULL,
  `artifactId` varchar(255) NOT NULL,
  `kind` varchar(64) NOT NULL,
  `contentType` varchar(120) NOT NULL,
  `payloadJson` json NOT NULL,
  `signedJwt` mediumtext,
  `payloadHash` varchar(128) NOT NULL,
  `ownerUserId` varchar(128),
  `holderDid` varchar(512),
  `context` varchar(64),
  `purpose` varchar(255),
  `recipient` varchar(255),
  `publicUrl` text,
  `qrPayload` text,
  `accessPolicyJson` json,
  `trustcareJson` json,
  `status` varchar(32) NOT NULL DEFAULT 'active',
  `expiresAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `share_gateway_artifacts_id` PRIMARY KEY(`id`),
  CONSTRAINT `uq_share_gateway_artifact_kind` UNIQUE(`artifactId`,`kind`)
);
--> statement-breakpoint
CREATE INDEX `idx_sga_kind` ON `share_gateway_artifacts` (`kind`);
--> statement-breakpoint
CREATE INDEX `idx_sga_status` ON `share_gateway_artifacts` (`status`);
--> statement-breakpoint
CREATE INDEX `idx_sga_expires` ON `share_gateway_artifacts` (`expiresAt`);
