/**
 * Runner script for care transition seed
 * Usage: npx tsx server/run-seed-care-transition.mjs
 */
import { seedCareTransitionData } from "./seedCareTransition.ts";

try {
  const result = await seedCareTransitionData();
  console.log("\nSeed result:", JSON.stringify(result.cases, null, 2));
  process.exit(0);
} catch (error) {
  console.error("Seed failed:", error);
  process.exit(1);
}
