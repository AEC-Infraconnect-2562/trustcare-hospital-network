import { issueCredential, verifyCredential, createPresentation, verifyPresentation } from "../server/portability/vc.ts";

async function main() {
  console.log("Testing ES256 signing and verification...");
  console.log("ALG:", process.env.TRUSTCARE_VC_SIGNING_ALG);
  
  // Issue a VC with ES256
  const vc = await issueCredential({
    type: "PatientIdentityCredential",
    issuer: { did: "did:web:trustcare.network", name: "Trustcare Network", trustDomain: "trustcare-network", country: "TH" },
    subjectId: "P001",
    subjectDid: "did:key:z6MkTest",
    claims: { patient: { id: "P001", name: "Test Patient" } },
  });
  console.log("VC issued - alg:", vc.alg, "keyMode:", vc.keyMode);
  
  // Verify the VC
  const vcResult = await verifyCredential({ jwt: vc.jwt });
  console.log("VC Verification - trustLevel:", vcResult.trustLevel, "warnings:", vcResult.warnings.length, "errors:", vcResult.errors.length);
  if (vcResult.warnings.length) console.log("  Warnings:", vcResult.warnings);
  if (vcResult.errors.length) console.log("  Errors:", vcResult.errors);

  // Create a VP
  const vp = await createPresentation({
    holderDid: "did:key:z6MkTest",
    credentials: [vc],
    purpose: "treatment",
  });
  console.log("VP created");

  // Verify the VP
  const vpResult = await verifyPresentation({ jwt: vp.jwt });
  console.log("VP Verification - trustLevel:", vpResult.trustLevel, "warnings:", vpResult.warnings.length, "errors:", vpResult.errors.length);
  if (vpResult.warnings.length) console.log("  Warnings:", vpResult.warnings);
  if (vpResult.errors.length) console.log("  Errors:", vpResult.errors);

  console.log("\nFinal result:", vpResult.trustLevel === "green" ? "GREEN BADGE ACHIEVED" : "Still has warnings/errors");
  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
