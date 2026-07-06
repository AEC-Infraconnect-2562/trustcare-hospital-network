import { reseedTrustcareVcVpDatabase } from "../server/portability/reseed.ts";

async function main() {
  console.log("Starting reseed with ES256...");
  console.log("ALG:", process.env.TRUSTCARE_VC_SIGNING_ALG);
  console.log("KEY_ID:", process.env.TRUSTCARE_VC_KEY_ID);
  console.log("Private JWK configured:", process.env.TRUSTCARE_VC_SIGNING_PRIVATE_JWK ? "YES" : "NO");
  
  const result = await reseedTrustcareVcVpDatabase({
    patientsPerHospital: 4,
    resetExistingSeed: true,
  });
  
  console.log("Reseed complete:", JSON.stringify(result).slice(0, 1000));
  process.exit(0);
}

main().catch((err) => {
  console.error("Reseed failed:", err);
  process.exit(1);
});
