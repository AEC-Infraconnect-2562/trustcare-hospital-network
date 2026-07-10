import type { JsonRecord } from "./types";
import { sha256 } from "./utils";
import { ENV } from "../_core/env";

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/**
 * Pre-generated deterministic ES256 key pairs for each hospital.
 * These are demo/seed keys — production uses env-based TRUSTCARE_VC_SIGNING_PRIVATE_JWK.
 * Generated using jose generateKeyPair("ES256") then stored as constants for reproducibility.
 */
export interface HospitalKeyPair {
  hospitalCode: string;
  did: string;
  kid: string;
  publicJwk: JsonRecord;
  privateJwk: JsonRecord;
}

const HOSPITAL_KEYS: Record<string, HospitalKeyPair> = {
  TCC: {
    hospitalCode: "TCC",
    did: "did:web:trustcare.network:hospital:tcc",
    kid: "did:web:trustcare.network:hospital:tcc#vc-signing-key",
    publicJwk: {
      kty: "EC",
      crv: "P-256",
      x: "L9NBcc2q5_9NgppWVHMhif6HRQCN9DvmK17UCok6udo",
      y: "AZT-yBTrctZyxSfql6iyuHM4xE6-Le51NC1vEqFdqOs",
      kid: "did:web:trustcare.network:hospital:tcc#vc-signing-key",
      use: "sig",
      alg: "ES256",
    },
    privateJwk: {
      kty: "EC",
      crv: "P-256",
      x: "L9NBcc2q5_9NgppWVHMhif6HRQCN9DvmK17UCok6udo",
      y: "AZT-yBTrctZyxSfql6iyuHM4xE6-Le51NC1vEqFdqOs",
      d: "ZVOWH-VF95mF-AxgALpV_i_hOdo5DsB8FYzKTMjWB98",
      kid: "did:web:trustcare.network:hospital:tcc#vc-signing-key",
      use: "sig",
      alg: "ES256",
    },
  },
  TCP: {
    hospitalCode: "TCP",
    did: "did:web:trustcare.network:hospital:tcp",
    kid: "did:web:trustcare.network:hospital:tcp#vc-signing-key",
    publicJwk: {
      kty: "EC",
      crv: "P-256",
      x: "DQu6z6E4a5TkDqZtSdGsxR619vBjK2DzPn1t2D7U2fg",
      y: "9pMRAVE-ByGMFblgWQCgR3SPaNwp0VIwA0-WHzbUD5w",
      kid: "did:web:trustcare.network:hospital:tcp#vc-signing-key",
      use: "sig",
      alg: "ES256",
    },
    privateJwk: {
      kty: "EC",
      crv: "P-256",
      x: "DQu6z6E4a5TkDqZtSdGsxR619vBjK2DzPn1t2D7U2fg",
      y: "9pMRAVE-ByGMFblgWQCgR3SPaNwp0VIwA0-WHzbUD5w",
      d: "-R1CaVOUNgqW12uAxcuW_aFihmQn7TGBsd2QNZ54pbU",
      kid: "did:web:trustcare.network:hospital:tcp#vc-signing-key",
      use: "sig",
      alg: "ES256",
    },
  },
  TCM: {
    hospitalCode: "TCM",
    did: "did:web:trustcare.network:hospital:tcm",
    kid: "did:web:trustcare.network:hospital:tcm#vc-signing-key",
    publicJwk: {
      kty: "EC",
      crv: "P-256",
      x: "sDv5tqIS8x8plIE9r-xsbhr41F8KG4PBKnRFPNut89k",
      y: "hADCcgeZwYtmCnvd9RF6PLlEX5ySHR-CPDknPeBCuJI",
      kid: "did:web:trustcare.network:hospital:tcm#vc-signing-key",
      use: "sig",
      alg: "ES256",
    },
    privateJwk: {
      kty: "EC",
      crv: "P-256",
      x: "sDv5tqIS8x8plIE9r-xsbhr41F8KG4PBKnRFPNut89k",
      y: "hADCcgeZwYtmCnvd9RF6PLlEX5ySHR-CPDknPeBCuJI",
      d: "s5ocnPj1DEhvkk-SXxJOzM1xnPYZ-3_vXZlL0Vj47UQ",
      kid: "did:web:trustcare.network:hospital:tcm#vc-signing-key",
      use: "sig",
      alg: "ES256",
    },
  },
};

/** Get the key pair for a hospital code. Falls back to TCC if unknown. */
export function getHospitalKeyPair(hospitalCode: string): HospitalKeyPair {
  const stored = HOSPITAL_KEYS[hospitalCode.toUpperCase()] ?? HOSPITAL_KEYS.TCC;
  const did = hospitalDidWeb(stored.hospitalCode);
  const kid = `${did}#vc-signing-key`;
  return {
    ...stored,
    did,
    kid,
    publicJwk: { ...stored.publicJwk, kid },
    privateJwk: { ...stored.privateJwk, kid },
  };
}

/** Get all hospital key pairs for JWKS endpoint */
export function getAllHospitalPublicKeys(): JsonRecord[] {
  return Object.keys(HOSPITAL_KEYS).map(code => getHospitalKeyPair(code).publicJwk);
}

/** Get public JWK for a specific hospital */
export function getHospitalPublicJwk(hospitalCode: string): JsonRecord {
  return getHospitalKeyPair(hospitalCode).publicJwk;
}

export function networkDidWeb(domain = ENV.didDomain): string {
  return `did:web:${domain}`;
}

export function hospitalDidWeb(hospitalCode: string, domain = ENV.didDomain): string {
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
  const domain = input.domain ?? ENV.didDomain;
  const did = hospitalDidWeb(input.hospitalCode, domain);
  const keyId = `${did}#vc-signing-key`;
  const hospitalKey = getHospitalKeyPair(input.hospitalCode);
  return {
    "@context": ["https://www.w3.org/ns/did/v1", "https://w3id.org/security/jwk/v1"],
    id: did,
    alsoKnownAs: [`${ENV.publicUrl}/hospital/${input.hospitalCode.toLowerCase()}`],
    verificationMethod: [
      {
        id: keyId,
        type: "JsonWebKey2020",
        controller: did,
        publicKeyJwk: input.publicJwk ?? hospitalKey.publicJwk,
      },
    ],
    assertionMethod: [keyId],
    authentication: [keyId],
    service: [
      {
        id: `${did}#trustcare-portability`,
        type: "TrustCarePortabilityEndpoint",
        serviceEndpoint: `${ENV.publicUrl}/api/portability/${input.hospitalCode.toLowerCase()}`,
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

/** @deprecated Use getHospitalPublicJwk instead */
export function demoPublicJwk(hospitalCode: string): JsonRecord {
  return getHospitalPublicJwk(hospitalCode);
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
