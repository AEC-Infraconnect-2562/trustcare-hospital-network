export interface ShlPasscodeAttemptState {
  failedAttempts: number;
  maxAttempts: number;
  remainingAttempts: number;
  locked: boolean;
}

export interface ShlAccessGrantSnapshot {
  currentAccessCount: number;
  maxAccessCount?: number;
  accessCountAfterGrant: number;
  remainingAccessCount: number | null;
  maxAccessReached: boolean;
}

export function buildShlPasscodeAttemptState(input: {
  failedAttempts?: number | null;
  maxAttempts?: number | null;
}): ShlPasscodeAttemptState {
  const failedAttempts = Math.max(0, Number(input.failedAttempts ?? 0));
  const maxAttempts = Math.max(1, Number(input.maxAttempts ?? 5));
  return {
    failedAttempts,
    maxAttempts,
    remainingAttempts: Math.max(maxAttempts - failedAttempts, 0),
    locked: failedAttempts >= maxAttempts,
  };
}

export function buildShlAccessGrantSnapshot(input: {
  currentAccessCount?: number | null;
  maxAccessCount?: number | null;
}): ShlAccessGrantSnapshot {
  const currentAccessCount = Math.max(0, Number(input.currentAccessCount ?? 0));
  const maxAccessCount = input.maxAccessCount === null || input.maxAccessCount === undefined
    ? undefined
    : Math.max(0, Number(input.maxAccessCount));
  const accessCountAfterGrant = currentAccessCount;
  return {
    currentAccessCount,
    maxAccessCount,
    accessCountAfterGrant,
    remainingAccessCount: maxAccessCount === undefined ? null : Math.max(maxAccessCount - accessCountAfterGrant, 0),
    maxAccessReached: maxAccessCount !== undefined && accessCountAfterGrant >= maxAccessCount,
  };
}

export function buildShortLivedObjectUrlPolicy(input: {
  ttlSeconds?: number;
  mode?: "placeholder" | "short_lived_url";
} = {}) {
  return {
    mode: input.mode ?? "placeholder",
    ttlSeconds: input.ttlSeconds ?? 300,
    pattern: "Resolve stored object references through an authenticated short-lived URL service before returning manifest file locations.",
    rawObjectCredentialReturned: false,
  };
}

export function redactShlSecretMetadata<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => redactShlSecretMetadata(item)) as T;
  if (!value || typeof value !== "object") return value;
  const redacted: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    redacted[key] = isShlSecretKey(key) ? "[REDACTED]" : redactShlSecretMetadata(item);
  }
  return redacted as T;
}

function isShlSecretKey(key: string): boolean {
  return /passcode/i.test(key)
    || /shl.*key/i.test(key)
    || /^key$/i.test(key)
    || /qrPayload/i.test(key)
    || /plaintext/i.test(key);
}
