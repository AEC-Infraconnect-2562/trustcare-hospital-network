/**
 * /.well-known/jwks.json — Public JWKS endpoint for external verifiers
 * /.well-known/did.json — DID document for did:web:trustcare.network
 * /hospital/:code/.well-known/did.json — Per-hospital DID document resolution
 *
 * These endpoints allow external wallets and verifiers to resolve public keys
 * according to DID Web Method (did:web) and JWKS standards.
 */
import { Router } from "express";
import { localIssuerJwks } from "./portability/vc";
import { hospitalDidWeb, didWebDocument } from "./portability/did";
import { getDb } from "./db";
import { hospitals, trustRegistry } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

const CACHE_MAX_AGE = 3600; // 1 hour

export function createWellKnownRouter(): Router {
  const router = Router();

  /**
   * GET /.well-known/jwks.json
   * Returns the JSON Web Key Set containing all active public keys for the Trustcare network.
   * External verifiers use this to validate VC/VP signatures.
   */
  router.get("/.well-known/jwks.json", async (_req, res) => {
    try {
      const networkJwks = await localIssuerJwks("did:web:trustcare.network");
      const db = await getDb();

      // Collect public keys from trust registry entries (partner hospitals)
      let registryKeys: any[] = [];
      if (db) {
        const entries = await db
          .select({
            did: trustRegistry.did,
            publicKeyJwk: trustRegistry.publicKeyJwk,
            metadata: trustRegistry.metadata,
            isActive: trustRegistry.isActive,
          })
          .from(trustRegistry)
          .where(eq(trustRegistry.isActive, true));

        for (const entry of entries) {
          if (entry.publicKeyJwk && typeof entry.publicKeyJwk === "object") {
            registryKeys.push(entry.publicKeyJwk);
          }
          // Also check metadata.jwks array
          const metadata = entry.metadata as any;
          if (metadata?.jwks && Array.isArray(metadata.jwks)) {
            for (const jwk of metadata.jwks) {
              if (jwk && typeof jwk === "object" && jwk.kty) {
                registryKeys.push(jwk);
              }
            }
          }
          // Check metadata.didDocument.verificationMethod
          if (metadata?.didDocument?.verificationMethod) {
            for (const vm of metadata.didDocument.verificationMethod) {
              if (vm?.publicKeyJwk && typeof vm.publicKeyJwk === "object") {
                registryKeys.push(vm.publicKeyJwk);
              }
            }
          }
        }
      }

      // Deduplicate by kid
      const allKeys = [...(networkJwks.keys || []), ...registryKeys];
      const seen = new Set<string>();
      const dedupedKeys = allKeys.filter((key: any) => {
        const kid = key.kid || `${key.kty}:${key.crv}:${key.x}`;
        if (seen.has(kid)) return false;
        seen.add(kid);
        return true;
      });

      res.set("Cache-Control", `public, max-age=${CACHE_MAX_AGE}`);
      res.set("Content-Type", "application/json");
      res.json({
        keys: dedupedKeys,
        issuer: "did:web:trustcare.network",
        updated: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error("[JWKS] Error:", err.message);
      res.status(500).json({ error: "Failed to generate JWKS" });
    }
  });

  /**
   * GET /.well-known/did.json
   * DID Document for did:web:trustcare.network (network-level issuer)
   * Follows the DID Web Method specification: https://w3c-ccg.github.io/did-method-web/
   */
  router.get("/.well-known/did.json", async (_req, res) => {
    try {
      const networkJwks = await localIssuerJwks("did:web:trustcare.network");
      const did = "did:web:trustcare.network";
      const keyId = process.env.TRUSTCARE_VC_KEY_ID || `${did}#vc-signing-key-1`;

      const publicKey = (networkJwks.keys as any[])?.[0] || null;

      const didDocument: any = {
        "@context": [
          "https://www.w3.org/ns/did/v1",
          "https://w3id.org/security/jwk/v1",
          "https://w3id.org/security/suites/jws-2020/v1",
        ],
        id: did,
        alsoKnownAs: ["https://trustcarehealth.live"],
        verificationMethod: publicKey
          ? [
              {
                id: keyId,
                type: "JsonWebKey2020",
                controller: did,
                publicKeyJwk: publicKey,
              },
            ]
          : [],
        assertionMethod: publicKey ? [keyId] : [],
        authentication: publicKey ? [keyId] : [],
        capabilityDelegation: publicKey ? [keyId] : [],
        service: [
          {
            id: `${did}#trustcare-portability`,
            type: "TrustCarePortabilityEndpoint",
            serviceEndpoint: "https://trustcarehealth.live/api/portability",
          },
          {
            id: `${did}#jwks`,
            type: "JsonWebKeySet",
            serviceEndpoint: "https://trustcarehealth.live/.well-known/jwks.json",
          },
          {
            id: `${did}#external-wallet-api`,
            type: "ExternalWalletAPI",
            serviceEndpoint: "https://trustcarehealth.live/api/v1",
          },
        ],
        trustcare: {
          network: "Trustcare Hospital Network",
          country: "TH",
          jurisdiction: "Thailand",
          standards: ["W3C VC Data Model 2.0", "SD-JWT VC", "SMART Health Links"],
        },
      };

      res.set("Cache-Control", `public, max-age=${CACHE_MAX_AGE}`);
      res.set("Content-Type", "application/did+ld+json");
      res.json(didDocument);
    } catch (err: any) {
      console.error("[DID] Error:", err.message);
      res.status(500).json({ error: "Failed to generate DID document" });
    }
  });

  /**
   * GET /hospital/:code/.well-known/did.json
   * Per-hospital DID document resolution for did:web:trustcare.network:hospital:<code>
   */
  router.get("/hospital/:code/.well-known/did.json", async (req, res) => {
    try {
      const code = req.params.code.toLowerCase();
      const db = await getDb();
      if (!db) {
        return res.status(503).json({ error: "Database unavailable" });
      }

      // Look up hospital in DB
      const [hospital] = await db
        .select()
        .from(hospitals)
        .where(eq(hospitals.code, code))
        .limit(1);

      if (!hospital) {
        return res.status(404).json({
          error: "Hospital not found",
          did: hospitalDidWeb(code),
          hint: `No hospital with code "${code}" exists in the Trustcare network.`,
        });
      }

      // Check if hospital has a stored DID document in settings
      const settings = hospital.settings as any;
      if (settings?.didDocument) {
        // Use the stored DID document but ensure it has the real public key
        const storedDoc = { ...settings.didDocument };

        // If the network-level key is configured, add it to the hospital's verification methods
        const networkJwks = await localIssuerJwks(hospitalDidWeb(code));
        if (networkJwks.keys?.length) {
          const keyId = `${hospitalDidWeb(code)}#vc-signing-key`;
          const existingVm = storedDoc.verificationMethod || [];
          const hasNetworkKey = existingVm.some((vm: any) => vm.publicKeyJwk?.kid === (networkJwks.keys as any[])[0]?.kid);
          if (!hasNetworkKey) {
            storedDoc.verificationMethod = [
              ...existingVm,
              {
                id: keyId,
                type: "JsonWebKey2020",
                controller: hospitalDidWeb(code),
                publicKeyJwk: (networkJwks.keys as any[])[0],
              },
            ];
            if (!storedDoc.assertionMethod?.includes(keyId)) {
              storedDoc.assertionMethod = [...(storedDoc.assertionMethod || []), keyId];
            }
          }
        }

        res.set("Cache-Control", `public, max-age=${CACHE_MAX_AGE}`);
        res.set("Content-Type", "application/did+ld+json");
        return res.json(storedDoc);
      }

      // Generate DID document from hospital data
      const networkJwks = await localIssuerJwks(hospitalDidWeb(code));
      const publicKey = (networkJwks.keys as any[])?.[0] || undefined;

      const doc = didWebDocument({
        hospitalCode: code,
        name: hospital.name || code,
        nameEn: hospital.nameEn || hospital.name || code,
        publicJwk: publicKey,
      });

      res.set("Cache-Control", `public, max-age=${CACHE_MAX_AGE}`);
      res.set("Content-Type", "application/did+ld+json");
      res.json(doc);
    } catch (err: any) {
      console.error("[DID:Hospital] Error:", err.message);
      res.status(500).json({ error: "Failed to generate hospital DID document" });
    }
  });

  /**
   * GET /.well-known/did-configuration.json
   * DID Configuration (Domain Linkage Credential) per DIF Well-Known DID Configuration spec
   * Proves that trustcarehealth.live is controlled by did:web:trustcare.network
   */
  router.get("/.well-known/did-configuration.json", async (_req, res) => {
    try {
      res.set("Cache-Control", `public, max-age=${CACHE_MAX_AGE}`);
      res.set("Content-Type", "application/json");
      res.json({
        "@context": "https://identity.foundation/.well-known/did-configuration/v1",
        linked_dids: [
          {
            "@context": [
              "https://www.w3.org/2018/credentials/v1",
              "https://identity.foundation/.well-known/did-configuration/v1",
            ],
            issuer: "did:web:trustcare.network",
            issuanceDate: "2026-07-01T00:00:00Z",
            type: ["VerifiableCredential", "DomainLinkageCredential"],
            credentialSubject: {
              id: "did:web:trustcare.network",
              origin: "https://trustcarehealth.live",
            },
          },
        ],
      });
    } catch (err: any) {
      console.error("[DID-Config] Error:", err.message);
      res.status(500).json({ error: "Failed to generate DID configuration" });
    }
  });

  return router;
}
