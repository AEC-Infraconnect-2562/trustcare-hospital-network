import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decodeProtectedHeader, importJWK, jwtVerify } from "jose";
import {
  createShareGatewayPublication,
  createShareGatewayRouter,
  normalizePublicationRequest,
} from "./shareGatewayApi";
import { getHospitalKeyPair } from "./portability/did";

const previousEnv: Record<string, string | undefined> = {};
const shareGatewayEnvKeys = [
  "TRUSTCARE_SHARE_GATEWAY_PRIVATE_JWK",
  "TRUSTCARE_SHARE_GATEWAY_SIGNING_ALG",
  "TRUSTCARE_SHARE_GATEWAY_ISSUER_DID",
  "TRUSTCARE_SHARE_GATEWAY_KEY_ID",
  "TRUSTCARE_VC_SIGNING_PRIVATE_JWK",
  "TRUSTCARE_VC_SIGNING_ALG",
  "TRUSTCARE_VC_KEY_ID",
];

describe("Share Gateway API", () => {
  beforeEach(() => {
    for (const key of shareGatewayEnvKeys) previousEnv[key] = process.env[key];
    const demoKey = getHospitalKeyPair("TCC");
    process.env.TRUSTCARE_SHARE_GATEWAY_PRIVATE_JWK = JSON.stringify(
      demoKey.privateJwk,
    );
    process.env.TRUSTCARE_SHARE_GATEWAY_SIGNING_ALG = "ES256";
    process.env.TRUSTCARE_SHARE_GATEWAY_ISSUER_DID = demoKey.did;
    process.env.TRUSTCARE_SHARE_GATEWAY_KEY_ID = demoKey.kid;
  });

  afterEach(() => {
    for (const key of shareGatewayEnvKeys) {
      const value = previousEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("normalizes and validates publication requests", () => {
    const request = normalizePublicationRequest({
      artifactId: "vp_test_001",
      kind: "vp",
      contentType: "application/vp+json",
      payload: { id: "vp_test_001" },
      ownerUserId: 414,
      holderDid: "did:key:holder",
      accessPolicy: { maxAccessCount: 1 },
    });

    expect(request).toMatchObject({
      artifactId: "vp_test_001",
      kind: "vp",
      contentType: "application/vp+json",
      ownerUserId: 414,
      holderDid: "did:key:holder",
      accessPolicy: { maxAccessCount: 1 },
    });
    expect(() =>
      normalizePublicationRequest({
        artifactId: "raw",
        kind: "service_bundle_envelope",
        contentType: "application/json",
        payload: {},
      }),
    ).toThrow("Unsupported share gateway artifact kind");
  });

  it("signs VP artifacts and returns resolver QR URLs plus JWKS metadata", async () => {
    const demoKey = getHospitalKeyPair("TCC");
    const gatewayBaseUrl = "https://trustcarehealth.live/api/share-gateway";
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
    const publication = await createShareGatewayPublication({
      gatewayBaseUrl,
      now,
      request: {
        artifactId: "vp_demo_001",
        kind: "vp",
        contentType: "application/vp+json",
        payload: {
          "@context": ["https://www.w3.org/ns/credentials/v2"],
          id: "vp_demo_001",
          type: ["VerifiablePresentation", "PurposeVP"],
          holder: "did:key:holder",
          verifiableCredential: ["vc.jwt.value"],
        },
        holderDid: "did:key:holder",
        context: "opd_visit",
        purpose: "เตรียมเข้ารับบริการ OPD",
        recipient: "https://verifier.example",
        expiresAt,
      },
    });

    expect(publication.response).toMatchObject({
      ok: true,
      mode: "portal_backend",
      artifactId: "vp_demo_001",
      kind: "vp",
      publicUrl: `${gatewayBaseUrl}/presentations/vp_demo_001.jwt`,
      qrPayload: `${gatewayBaseUrl}/presentations/vp_demo_001.jwt`,
      jwksUrl: `${gatewayBaseUrl}/.well-known/jwks.json`,
    });
    expect(publication.signedJwt).toBeTruthy();
    const header = decodeProtectedHeader(publication.signedJwt ?? "");
    expect(header).toMatchObject({
      alg: "ES256",
      typ: "vp+JWT",
      kid: demoKey.kid,
      jku: `${gatewayBaseUrl}/.well-known/jwks.json`,
    });

    const publicKey = await importJWK(demoKey.publicJwk as any, "ES256");
    const verified = await jwtVerify(publication.signedJwt ?? "", publicKey, {
      issuer: demoKey.did,
      audience: "https://verifier.example",
    });
    expect(verified.payload.jti).toBe("vp_demo_001");
    expect((verified.payload.vp as any).holder).toBe("did:key:holder");
    expect((verified.payload.trustcare_share_gateway as any).payloadHash).toBe(
      publication.payloadHash,
    );
  });

  it("fails clearly when signing material is not configured", async () => {
    for (const key of shareGatewayEnvKeys) delete process.env[key];
    const now = new Date();

    await expect(
      createShareGatewayPublication({
        gatewayBaseUrl: "https://trustcarehealth.live/api/share-gateway",
        now,
        request: {
          artifactId: "vp_missing_key",
          kind: "vp",
          contentType: "application/vp+json",
          payload: {
            type: ["VerifiablePresentation"],
            holder: "did:key:holder",
          },
          expiresAt: new Date(now.getTime() + 10 * 60 * 1000).toISOString(),
        },
      }),
    ).rejects.toThrow("Share Gateway signing key is not configured");
  });

  it("publishes SHL manifests as resolver JSON without turning SHL into the VP QR", async () => {
    const gatewayBaseUrl = "https://trustcarehealth.live/api/share-gateway";
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
    const publication = await createShareGatewayPublication({
      gatewayBaseUrl,
      now,
      request: {
        artifactId: "shl_demo_001",
        kind: "certified_shl_manifest",
        contentType: "application/json",
        payload: {
          files: [],
          trustcare: { manifestVp: { id: "vp_manifest" } },
        },
        holderDid: "did:key:holder",
        context: "cross_border",
        purpose: "ส่งต่อข้ามเครือข่าย/ข้ามแดน",
        recipient: "Verifier",
        expiresAt,
      },
    });

    expect(publication.signedJwt).toBeNull();
    expect(publication.response.manifestUrl).toBe(
      `${gatewayBaseUrl}/manifests/shl_demo_001.json`,
    );
    expect(publication.response.qrPayload).toBe(
      `${gatewayBaseUrl}/manifests/shl_demo_001.json`,
    );
  });

  it("registers the production share gateway routes", () => {
    const router = createShareGatewayRouter();
    const routes = ((router as any).stack ?? [])
      .filter((layer: any) => layer.route)
      .map((layer: any) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods),
      }));

    expect(routes).toContainEqual(
      expect.objectContaining({
        path: "/api/share-gateway/artifacts",
        methods: expect.arrayContaining(["post"]),
      }),
    );
    expect(routes).toContainEqual(
      expect.objectContaining({
        path: "/api/share-gateway/presentations/:artifactId.jwt",
        methods: expect.arrayContaining(["get"]),
      }),
    );
    expect(routes).toContainEqual(
      expect.objectContaining({
        path: "/api/share-gateway/.well-known/jwks.json",
        methods: expect.arrayContaining(["get"]),
      }),
    );
  });
});
