CREATE TABLE `wallet_holder_bindings` (
  `id` int AUTO_INCREMENT NOT NULL,
  `bindingId` varchar(128) NOT NULL,
  `patientId` int NOT NULL,
  `holderDid` varchar(512) NOT NULL,
  `publicKeyJwk` json NOT NULL,
  `status` enum('active','revoked') NOT NULL DEFAULT 'active',
  `boundAt` timestamp NOT NULL DEFAULT (now()),
  `lastVerifiedAt` timestamp,
  `metadata` json,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `wallet_holder_bindings_id` PRIMARY KEY(`id`),
  CONSTRAINT `wallet_holder_bindings_bindingId_unique` UNIQUE(`bindingId`)
);
--> statement-breakpoint
CREATE INDEX `idx_whb_patient` ON `wallet_holder_bindings` (`patientId`);
CREATE INDEX `idx_whb_holder` ON `wallet_holder_bindings` (`holderDid`);
CREATE INDEX `idx_whb_status` ON `wallet_holder_bindings` (`status`);
--> statement-breakpoint
CREATE TABLE `wallet_binding_challenges` (
  `id` int AUTO_INCREMENT NOT NULL,
  `challengeId` varchar(128) NOT NULL,
  `patientId` int NOT NULL,
  `holderDid` varchar(512) NOT NULL,
  `nonce` varchar(128) NOT NULL,
  `publicKeyJwk` json NOT NULL,
  `status` enum('issued','completed','expired','cancelled') NOT NULL DEFAULT 'issued',
  `expiresAt` timestamp NOT NULL,
  `completedAt` timestamp,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `wallet_binding_challenges_id` PRIMARY KEY(`id`),
  CONSTRAINT `wallet_binding_challenges_challengeId_unique` UNIQUE(`challengeId`)
);
--> statement-breakpoint
CREATE INDEX `idx_wbc_patient` ON `wallet_binding_challenges` (`patientId`);
CREATE INDEX `idx_wbc_expires` ON `wallet_binding_challenges` (`expiresAt`);
