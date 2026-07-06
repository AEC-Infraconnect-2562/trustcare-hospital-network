/**
 * Generate ES256 (P-256) key pair for Trustcare VC/VP signing.
 * Outputs the private JWK and public JWK as JSON strings ready for env vars.
 *
 * Usage: node scripts/generate-vc-keys.mjs
 */
import { generateKeyPair, exportJWK } from "jose";

async function main() {
  const { publicKey, privateKey } = await generateKeyPair("ES256", {
    extractable: true,
  });

  const privateJwk = await exportJWK(privateKey);
  const publicJwk = await exportJWK(publicKey);

  // Add metadata
  const kid = "did:web:trustcare.network#vc-signing-key-1";
  privateJwk.kid = kid;
  privateJwk.alg = "ES256";
  privateJwk.use = "sig";
  publicJwk.kid = kid;
  publicJwk.alg = "ES256";
  publicJwk.use = "sig";

  console.log("=== ES256 Key Pair Generated ===\n");
  console.log("TRUSTCARE_VC_SIGNING_PRIVATE_JWK:");
  console.log(JSON.stringify(privateJwk));
  console.log("\nTRUSTCARE_VC_SIGNING_PUBLIC_JWK:");
  console.log(JSON.stringify(publicJwk));
  console.log("\nTRUSTCARE_VC_SIGNING_ALG=ES256");
  console.log("TRUSTCARE_VC_KEY_ID=" + kid);
  console.log("\n=== Done ===");
}

main().catch(console.error);
