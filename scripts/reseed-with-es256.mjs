/**
 * Re-seed the VC/VP database using the configured ES256 asymmetric keys.
 * This replaces all existing HMAC-signed credentials with ES256-signed ones.
 *
 * Usage: node --import tsx scripts/reseed-with-es256.mjs
 * Or: npx tsx scripts/reseed-with-es256.mjs
 */
import { reseedTrustcareVcVpDatabase } from "../server/portability/reseed.ts";

async function main() {
  console.log("Starting reseed with ES256 asymmetric keys...");
  console.log("TRUSTCARE_VC_SIGNING_ALG:", process.env.TRUSTCARE_VC_SIGNING_ALG);
  console.log("TRUSTCARE_VC_KEY_ID:", process.env.TRUSTCARE_VC_KEY_ID);
  console.log("Private JWK configured:", !!process.env.TRUSTCARE_VC_SIGNING_PRIVATE_JWK);
  console.log("");

  const result = await reseedTrustcareVcVpDatabase({
    patientsPerHospital: 12,
    resetExistingSeed: true,
  });

  console.log("\n=== Reseed Complete ===");
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error("Reseed failed:", err);
  process.exit(1);
});
