-- Migration 0009: Change TEXT to MEDIUMTEXT for large JWT columns
-- Reason: VP JWTs that bundle multiple VC JWTs can exceed the 65535 byte TEXT limit
-- presentationJwt in issued_presentations and sdJwtVc in issued_credentials need MEDIUMTEXT (16MB)

ALTER TABLE `issued_presentations` MODIFY COLUMN `presentationJwt` MEDIUMTEXT NOT NULL;
ALTER TABLE `issued_credentials` MODIFY COLUMN `sdJwtVc` MEDIUMTEXT NOT NULL;
