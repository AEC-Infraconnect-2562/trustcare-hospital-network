// Direct reseed invocation with debug logging
import { reseedTrustcareVcVpDatabase } from "../server/portability/reseed.ts";

// Patch console to add timestamps
const origLog = console.log;
console.log = (...args) => origLog(`[${new Date().toISOString()}]`, ...args);

async function main() {
  console.log("Starting reseed...");
  try {
    const result = await reseedTrustcareVcVpDatabase({
      actorId: 1,
      patientsPerHospital: 12,
      resetExistingSeed: true,
    });
    console.log("Reseed complete:", JSON.stringify(result?.counts ?? result, null, 2));
  } catch (err) {
    console.error("Reseed error:", err.message);
    console.error(err.stack);
  }
  process.exit(0);
}

// Force exit after 5 minutes
setTimeout(() => {
  console.error("TIMEOUT: reseed took more than 5 minutes, forcing exit");
  process.exit(1);
}, 5 * 60 * 1000);

main();
