import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { CompactEncrypt, base64url, compactDecrypt } from "jose";
import type { JsonRecord } from "./types";
import { sha256, stableStringify, stripUndefined } from "./utils";

export const SHL_CONTENT_TYPES = [
  "application/fhir+json",
  "application/smart-health-card",
  "application/smart-api-access",
] as const;

export type ShlContentType = (typeof SHL_CONTENT_TYPES)[number];

export interface ShlinkPayload {
  url: string;
  key: string;
  exp?: number;
  flag?: string;
  label?: string;
  v?: 1;
}

export interface ShlManifestFile {
  fileId?: string;
  contentType: ShlContentType;
  embeddedJwe?: string | null;
  location?: string | null;
  contentHash?: string | null;
  plaintextHash?: string | null;
  version?: number | null;
}

export function randomBase64UrlBytes(byteLength = 32): string {
  return randomBytes(byteLength).toString("base64url");
}

export function generateNumericPasscode(length = 6): string {
  const digits = Array.from({ length }, () => String(randomBytes(1)[0] % 10));
  return digits.join("");
}

export function buildShlinkPayload(input: {
  manifestUrl: string;
  key: string;
  expiresAt?: Date | string | null;
  passcodeRequired?: boolean;
  longTerm?: boolean;
  singleFile?: boolean;
  label?: string | null;
  viewerBaseUrl?: string | null;
}): { payload: ShlinkPayload; qrPayload: string; viewerUrl: string } {
  if (input.singleFile && input.passcodeRequired) {
    throw new Error("SHL U flag cannot be combined with passcode-required P flag.");
  }
  const flags = [
    input.longTerm ? "L" : "",
    input.passcodeRequired ? "P" : "",
    input.singleFile ? "U" : "",
  ].filter(Boolean).sort().join("");
  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : undefined;
  const payload = stripUndefined({
    url: input.manifestUrl,
    key: input.key,
    exp: expiresAt ? Math.floor(expiresAt.getTime() / 1000) : undefined,
    flag: flags || undefined,
    label: input.label ? String(input.label).slice(0, 80) : undefined,
    v: 1 as const,
  });
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const qrPayload = `shlink:/${encoded}`;
  const viewerBaseUrl = input.viewerBaseUrl?.replace(/#$/, "");
  const viewerUrl = viewerBaseUrl ? `${viewerBaseUrl}#${qrPayload}` : qrPayload;
  return { payload, qrPayload, viewerUrl };
}

export function decodeShlinkPayload(value: string): ShlinkPayload {
  const encoded = value.includes("shlink:/")
    ? value.slice(value.indexOf("shlink:/") + "shlink:/".length)
    : value;
  return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
}

export function hashPasscode(passcode: string, salt = randomBase64UrlBytes(16)): { salt: string; hash: string } {
  const hash = scryptSync(passcode, salt, 32).toString("base64url");
  return { salt, hash };
}

export function verifyPasscode(passcode: string, salt: string, expectedHash: string): boolean {
  const actual = scryptSync(passcode, salt, 32);
  const expected = Buffer.from(expectedHash, "base64url");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function encryptShlFile(input: {
  key: string;
  contentType: ShlContentType;
  payload: unknown;
}): Promise<{ jwe: string; plaintextHash: string; contentHash: string; encryptedSizeBytes: number }> {
  const plaintext = typeof input.payload === "string"
    ? input.payload
    : stableStringify(input.payload);
  const jwe = await new CompactEncrypt(new TextEncoder().encode(plaintext))
    .setProtectedHeader({ alg: "dir", enc: "A256GCM", cty: input.contentType })
    .encrypt(base64url.decode(input.key));
  return {
    jwe,
    plaintextHash: sha256(plaintext),
    contentHash: sha256(jwe),
    encryptedSizeBytes: Buffer.byteLength(jwe, "utf8"),
  };
}

export async function decryptShlFile(input: {
  key: string;
  jwe: string;
}): Promise<{ protectedHeader: JsonRecord; payload: unknown; plaintext: string }> {
  const decrypted = await compactDecrypt(input.jwe, base64url.decode(input.key));
  const plaintext = new TextDecoder().decode(decrypted.plaintext);
  let payload: unknown = plaintext;
  try {
    payload = JSON.parse(plaintext);
  } catch {
    payload = plaintext;
  }
  return {
    protectedHeader: decrypted.protectedHeader as JsonRecord,
    payload,
    plaintext,
  };
}

export function buildManifestResponse(input: {
  files: ShlManifestFile[];
  embeddedLengthMax?: number | null;
  trustcare?: JsonRecord | null;
}): JsonRecord {
  const embeddedLengthMax = input.embeddedLengthMax ?? Number.MAX_SAFE_INTEGER;
  const files = input.files.map((file) => {
    const embedded = file.embeddedJwe && file.embeddedJwe.length <= embeddedLengthMax
      ? file.embeddedJwe
      : undefined;
    return stripUndefined({
      contentType: file.contentType,
      embedded,
      location: embedded ? undefined : file.location,
    });
  });
  return stripUndefined({
    files,
    trustcare: input.trustcare ?? undefined,
  });
}

export function manifestFileDigest(files: ShlManifestFile[]): string {
  return sha256(files.map((file) => ({
    contentType: file.contentType,
    contentHash: file.contentHash,
    plaintextHash: file.plaintextHash,
    version: file.version ?? 1,
  })));
}
