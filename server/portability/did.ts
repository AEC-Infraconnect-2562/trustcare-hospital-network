import type { JsonRecord } from "./types";
import { sha256 } from "./utils";

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function hospitalDidWeb(hospitalCode: string, domain = "trustcare.network"): string {
  return `did:web:${domain}:hospital:${hospitalCode.toLowerCase()}`;
}

export function patientDidKey(seed: string): string {
  const digest = hexToBytes(sha256(`trustcare-patient:${seed}`)).slice(0, 32);
  const ed25519Multicodec = new Uint8Array(34);
  ed25519Multicodec[0] = 0xed;
  ed25519Multicodec[1] = 0x01;
  ed25519Multicodec.set(digest, 2);
  return `did:key:z${base58Encode(ed25519Multicodec)}`;
}

export function didWebDocument(input: {
  hospitalCode: string;
  name: string;
  nameEn: string;
  publicJwk?: JsonRecord;
  domain?: string;
}): JsonRecord {
  const did = hospitalDidWeb(input.hospitalCode, input.domain);
  const keyId = `${did}#vc-signing-key`;
  return {
    "@context": ["https://www.w3.org/ns/did/v1", "https://w3id.org/security/jwk/v1"],
    id: did,
    alsoKnownAs: [`https://${input.domain ?? "trustcare.network"}/hospital/${input.hospitalCode.toLowerCase()}`],
    verificationMethod: [
      {
        id: keyId,
        type: "JsonWebKey2020",
        controller: did,
        publicKeyJwk: input.publicJwk ?? demoPublicJwk(input.hospitalCode),
      },
    ],
    assertionMethod: [keyId],
    authentication: [keyId],
    service: [
      {
        id: `${did}#trustcare-portability`,
        type: "TrustCarePortabilityEndpoint",
        serviceEndpoint: `https://${input.domain ?? "trustcare.network"}/api/portability/${input.hospitalCode.toLowerCase()}`,
      },
    ],
    trustcare: {
      hospitalCode: input.hospitalCode,
      name: input.name,
      nameEn: input.nameEn,
      syntheticTestData: true,
    },
  };
}

export function didKeyDocument(input: { seed: string; patientRef?: string; carepassId?: string }): JsonRecord {
  const did = patientDidKey(input.seed);
  const keyId = `${did}#key-1`;
  return {
    "@context": ["https://www.w3.org/ns/did/v1"],
    id: did,
    verificationMethod: [
      {
        id: keyId,
        type: "Ed25519VerificationKey2020",
        controller: did,
        publicKeyMultibase: did.replace("did:key:", ""),
      },
    ],
    authentication: [keyId],
    assertionMethod: [keyId],
    trustcare: {
      patientRef: input.patientRef,
      carepassId: input.carepassId,
      syntheticTestData: true,
    },
  };
}

function demoPublicJwk(hospitalCode: string): JsonRecord {
  return {
    kty: "EC",
    crv: "P-256",
    kid: `${hospitalDidWeb(hospitalCode)}#vc-signing-key`,
    x: base64Url(hexToBytes(sha256(`${hospitalCode}:x`)).slice(0, 32)),
    y: base64Url(hexToBytes(sha256(`${hospitalCode}:y`)).slice(0, 32)),
    use: "sig",
    alg: "ES256",
  };
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

function base64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

function base58Encode(bytes: Uint8Array): string {
  let digits = [0];
  for (let byteIndex = 0; byteIndex < bytes.length; byteIndex += 1) {
    const byte = bytes[byteIndex];
    let carry = byte;
    for (let i = 0; i < digits.length; i += 1) {
      carry += digits[i] << 8;
      digits[i] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  for (let byteIndex = 0; byteIndex < bytes.length; byteIndex += 1) {
    const byte = bytes[byteIndex];
    if (byte === 0) digits.push(0);
    else break;
  }
  return digits.reverse().map((digit) => BASE58_ALPHABET[digit]).join("");
}
