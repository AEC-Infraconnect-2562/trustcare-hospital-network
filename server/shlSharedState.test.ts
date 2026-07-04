import { describe, expect, it } from "vitest";
import {
  buildShlAccessGrantSnapshot,
  buildShlPasscodeAttemptState,
  buildShortLivedObjectUrlPolicy,
  redactShlSecretMetadata,
} from "./shlSharedState";

describe("SHL shared state helpers", () => {
  it("computes remaining passcode attempts and lock state", () => {
    expect(buildShlPasscodeAttemptState({ failedAttempts: 2, maxAttempts: 5 })).toEqual({
      failedAttempts: 2,
      maxAttempts: 5,
      remainingAttempts: 3,
      locked: false,
    });

    expect(buildShlPasscodeAttemptState({ failedAttempts: 5, maxAttempts: 5 })).toMatchObject({
      remainingAttempts: 0,
      locked: true,
    });
  });

  it("reports the persisted access count after an atomic grant", () => {
    expect(buildShlAccessGrantSnapshot({ currentAccessCount: 3, maxAccessCount: 5 })).toEqual({
      currentAccessCount: 3,
      maxAccessCount: 5,
      accessCountAfterGrant: 3,
      remainingAccessCount: 2,
      maxAccessReached: false,
    });

    expect(buildShlAccessGrantSnapshot({ currentAccessCount: 5, maxAccessCount: 5 })).toMatchObject({
      remainingAccessCount: 0,
      maxAccessReached: true,
    });
  });

  it("documents short-lived object URL policy without returning object credentials", () => {
    expect(buildShortLivedObjectUrlPolicy()).toMatchObject({
      mode: "placeholder",
      ttlSeconds: 300,
      rawObjectCredentialReturned: false,
    });
  });

  it("redacts raw SHL key, passcode, QR, and plaintext metadata recursively", () => {
    expect(redactShlSecretMetadata({
      passcode: "123456",
      shlKey: "raw-key",
      key: "jwe-key",
      qrPayload: "shlink:/secret",
      nested: {
        plaintextHash: "hash-value",
        safe: "kept",
      },
    })).toEqual({
      passcode: "[REDACTED]",
      shlKey: "[REDACTED]",
      key: "[REDACTED]",
      qrPayload: "[REDACTED]",
      nested: {
        plaintextHash: "[REDACTED]",
        safe: "kept",
      },
    });
  });
});
