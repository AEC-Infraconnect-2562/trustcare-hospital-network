ALTER TABLE `credential_templates` MODIFY COLUMN `type` enum('patient_identity','consent_receipt','patient_summary','allergy_alert','medication_summary','referral_vc','immunization','medical_certificate','prescription','claim_package','sync_receipt') NOT NULL;
--> statement-breakpoint
ALTER TABLE `issued_credentials` MODIFY COLUMN `type` enum('patient_identity','consent_receipt','patient_summary','allergy_alert','medication_summary','referral_vc','immunization','medical_certificate','prescription','claim_package','sync_receipt') NOT NULL;
--> statement-breakpoint
ALTER TABLE `wallet_cards` MODIFY COLUMN `cardType` enum('allergy','medication','patient_summary','consent','identity','immunization','referral','medical_certificate','prescription','claim','sync_receipt') NOT NULL;
