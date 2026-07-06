import { describe, it, expect } from "vitest";
import { importJWK, SignJWT, jwtVerify } from "jose";

describe("VC Signing Keys (ES256)", () => {
  it("should have TRUSTCARE_VC_SIGNING_PRIVATE_JWK configured", () => {
    const raw = process.env.TRUSTCARE_VC_SIGNING_PRIVATE_JWK;
    expect(raw).toBeTruthy();
    const jwk = JSON.parse(raw!);
    expect(jwk.kty).toBe("EC");
    expect(jwk.crv).toBe("P-256");
    expect(jwk.d).toBeTruthy(); // private key component
    expect(jwk.alg).toBe("ES256");
  });

  it("should have TRUSTCARE_VC_SIGNING_PUBLIC_JWK configured", () => {
    const raw = process.env.TRUSTCARE_VC_SIGNING_PUBLIC_JWK;
    expect(raw).toBeTruthy();
    const jwk = JSON.parse(raw!);
    expect(jwk.kty).toBe("EC");
    expect(jwk.crv).toBe("P-256");
    expect(jwk.d).toBeUndefined(); // no private key component in public JWK
    expect(jwk.alg).toBe("ES256");
  });

  it("should sign and verify a JWT with the configured keys", async () => {
    const privateJwk = JSON.parse(process.env.TRUSTCARE_VC_SIGNING_PRIVATE_JWK!);
    const publicJwk = JSON.parse(process.env.TRUSTCARE_VC_SIGNING_PUBLIC_JWK!);

    const privateKey = await importJWK(privateJwk, "ES256");
    const publicKey = await importJWK(publicJwk, "ES256");

    // Sign a test JWT
    const jwt = await new SignJWT({ test: true, vc: { type: "TestCredential" } })
      .setProtectedHeader({ alg: "ES256", typ: "vc+JWT", kid: privateJwk.kid })
      .setIssuer("did:web:trustcare.network")
      .setSubject("did:key:test-subject")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(privateKey);

    expect(jwt).toBeTruthy();
    expect(jwt.split(".")).toHaveLength(3);

    // Verify with public key
    const { payload, protectedHeader } = await jwtVerify(jwt, publicKey);
    expect(protectedHeader.alg).toBe("ES256");
    expect(protectedHeader.typ).toBe("vc+JWT");
    expect(payload.iss).toBe("did:web:trustcare.network");
    expect(payload.sub).toBe("did:key:test-subject");
    expect((payload as any).vc.type).toBe("TestCredential");
  });

  it("should have matching TRUSTCARE_VC_SIGNING_ALG and TRUSTCARE_VC_KEY_ID", () => {
    expect(process.env.TRUSTCARE_VC_SIGNING_ALG).toBe("ES256");
    expect(process.env.TRUSTCARE_VC_KEY_ID).toBe("did:web:trustcare.network#vc-signing-key-1");
  });
});
