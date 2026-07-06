// Direct reseed invocation without auth
import { reseedTrustcareVcVpDatabase } from "../server/portability/reseed.ts";

async function main() {
  console.log("Starting reseed...");
  const result = await reseedTrustcareVcVpDatabase({
    actorId: 1,
    patientsPerHospital: 12,
    resetExistingSeed: true,
  });
  console.log("Reseed complete:", JSON.stringify(result, null, 2));
  process.exit(0);
}

main().catch(err => {
  console.error("Reseed failed:", err);
  process.exit(1);
});
