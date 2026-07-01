import { reseedTrustcareVcVpDatabase } from "./server/portability/reseed.ts";

console.log("[Reseed] Starting VC/VP seed into database...");
console.time("[Reseed] Total time");

try {
  const result = await reseedTrustcareVcVpDatabase({
    patientsPerHospital: 12,
    resetExistingSeed: true,
  });
  console.log("[Reseed] Complete! Summary:");
  console.log(JSON.stringify(result, null, 2));
} catch (err) {
  console.error("[Reseed] ERROR:", err);
  process.exit(1);
} finally {
  console.timeEnd("[Reseed] Total time");
  process.exit(0);
}
