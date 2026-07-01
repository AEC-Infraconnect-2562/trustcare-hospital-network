ALTER TABLE `credential_templates` ADD `documentCategory` varchar(64);
--> statement-breakpoint
ALTER TABLE `credential_templates` ADD `documentSubcategory` varchar(64);
--> statement-breakpoint
ALTER TABLE `credential_templates` ADD `defaultStoragePath` varchar(500);
--> statement-breakpoint
ALTER TABLE `issued_credentials` ADD `documentCategory` varchar(64);
--> statement-breakpoint
ALTER TABLE `issued_credentials` ADD `documentSubcategory` varchar(64);
--> statement-breakpoint
ALTER TABLE `issued_credentials` ADD `storageKey` varchar(500);
--> statement-breakpoint
ALTER TABLE `issued_credentials` ADD `searchTags` json;
--> statement-breakpoint
ALTER TABLE `wallet_cards` ADD `documentCategory` varchar(64);
