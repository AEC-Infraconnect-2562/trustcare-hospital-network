import * as db from "./db";
import { buildManifestResponse, verifyPasscode } from "./portability";

export class ShlAccessError extends Error {
  statusCode: number;
  trpcCode: "NOT_FOUND" | "FORBIDDEN" | "UNAUTHORIZED" | "BAD_REQUEST";
  details?: Record<string, unknown>;

  constructor(message: string, statusCode = 403, trpcCode: ShlAccessError["trpcCode"] = "FORBIDDEN", details?: Record<string, unknown>) {
    super(message);
    this.name = "ShlAccessError";
    this.statusCode = statusCode;
    this.trpcCode = trpcCode;
    this.details = details;
  }
}

export async function resolveShlManifestAccessPacket(input: {
  shl: any;
  recipient: string;
  passcode?: string;
  embeddedLengthMax?: number | null;
  accessorName?: string | null;
  accessorOrg?: string | null;
  accessorCountry?: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
}) {
  const shl = input.shl;
  const requestedAt = new Date();
  const recipient = input.recipient || input.accessorOrg || input.accessorName || "unknown-recipient";

  const deny = async (result: string, message: string, statusCode = 403, trpcCode: ShlAccessError["trpcCode"] = "FORBIDDEN", details?: Record<string, unknown>) => {
    await db.createShlAccessLog({
      shlId: shl.id,
      recipient,
      accessorName: input.accessorName ?? undefined,
      accessorOrg: input.accessorOrg ?? undefined,
      accessorCountry: input.accessorCountry ?? undefined,
      result,
      failureReason: message,
      userAgent: input.userAgent ?? undefined,
      ipAddress: input.ipAddress ?? undefined,
      manifestRequestedAt: requestedAt,
      countryHint: input.accessorCountry ?? undefined,
    });
    throw new ShlAccessError(message, statusCode, trpcCode, details);
  };

  if (!shl || !shl.id) {
    throw new ShlAccessError("SHL not found", 404, "NOT_FOUND");
  }
  if (shl.status === "revoked") {
    await deny("revoked", "Smart Health Link has been revoked.", 410, "FORBIDDEN");
  }
  if (shl.status === "disabled") {
    await deny("denied", shl.disabledReason ?? "Smart Health Link is disabled.", 423, "FORBIDDEN");
  }
  if (shl.status === "pending_review") {
    await deny("denied", "Smart Health Link is waiting for Checker review.", 403, "FORBIDDEN");
  }
  if (shl.status !== "active") {
    await deny("denied", `Smart Health Link status is ${shl.status}.`, 403, "FORBIDDEN");
  }

  const expiresAt = shl.expiresAt ? new Date(shl.expiresAt) : undefined;
  if (expiresAt && expiresAt.getTime() <= requestedAt.getTime()) {
    await db.updateSmartHealthLink(shl.id, { status: "expired" } as any);
    await deny("expired", "Smart Health Link has expired.", 410, "FORBIDDEN");
  }

  const accessCount = Number(shl.currentAccessCount ?? 0);
  const maxAccessCount = shl.maxAccessCount ? Number(shl.maxAccessCount) : undefined;
  if (maxAccessCount !== undefined && accessCount >= maxAccessCount) {
    await db.updateSmartHealthLink(shl.id, { status: "max_accessed", disabledReason: "Maximum access count reached" } as any);
    await deny("max_accessed", "Smart Health Link maximum access count has been reached.", 429, "FORBIDDEN");
  }

  if (shl.passcodeRequired) {
    if (!input.passcode || !shl.passcodeSalt || !shl.passcodeHash) {
      const maxAttempts = Number(shl.passcodeMaxAttempts ?? 5);
      const failedAttempts = Number(shl.passcodeFailedAttempts ?? 0);
      await deny("bad_passcode", "Passcode is required.", 401, "UNAUTHORIZED", {
        remainingAttempts: Math.max(maxAttempts - failedAttempts, 0),
      });
    }
    const passcode = input.passcode;
    const passcodeSalt = shl.passcodeSalt;
    const passcodeHash = shl.passcodeHash;
    if (!passcode || !passcodeSalt || !passcodeHash) {
      await deny("bad_passcode", "Passcode is required.", 401, "UNAUTHORIZED");
    }
    const verified = verifyPasscode(passcode as string, passcodeSalt as string, passcodeHash as string);
    if (!verified) {
      const failedAttempts = Number(shl.passcodeFailedAttempts ?? 0) + 1;
      const maxAttempts = Number(shl.passcodeMaxAttempts ?? 5);
      await db.updateSmartHealthLink(shl.id, {
        passcodeFailedAttempts: failedAttempts,
        ...(failedAttempts >= maxAttempts ? { status: "disabled", disabledReason: "Passcode failure limit reached" } : {}),
      } as any);
      const remainingAttempts = Math.max(maxAttempts - failedAttempts, 0);
      await deny(
        "bad_passcode",
        failedAttempts >= maxAttempts ? "Passcode failure limit reached." : "Passcode is incorrect.",
        401,
        "UNAUTHORIZED",
        { remainingAttempts },
      );
    }
  }

  const manifestVersion = Number(shl.currentManifestVersion ?? 1);
  const [files, manifestCredential, presentation] = await Promise.all([
    db.listShlFiles(shl.id, manifestVersion),
    shl.manifestCredentialId ? db.getIssuedCredentialByCredentialId(shl.manifestCredentialId) : Promise.resolve(undefined),
    shl.presentationId ? db.getIssuedPresentationByPresentationId(shl.presentationId) : Promise.resolve(undefined),
  ]);

  const manifest = buildManifestResponse({
    files: files.map((file: any) => ({
      fileId: file.fileId,
      contentType: file.contentType,
      embeddedJwe: file.embeddedJwe,
      location: file.location,
      contentHash: file.contentHash,
      plaintextHash: file.plaintextHash,
      version: file.version,
    })),
    embeddedLengthMax: input.embeddedLengthMax,
    trustcare: {
      trustLayer: "vc-vp-around-shl",
      manifestVersion,
      manifestHash: shl.manifestHash,
      sourceBundleHash: shl.sourceBundleHash,
      manifestCredentialId: shl.manifestCredentialId,
      manifestCredentialJwt: manifestCredential?.sdJwtVc,
      presentationId: shl.presentationId,
      presentationJwt: presentation?.presentationJwt,
      context: shl.context,
      purpose: shl.purpose,
      maxAccessCount: shl.maxAccessCount,
      accessCountAfterGrant: accessCount + 1,
      remainingAccessCount: maxAccessCount === undefined ? null : Math.max(maxAccessCount - accessCount - 1, 0),
      status: shl.status,
      consentCredentialId: shl.consentCredentialId,
    },
  });

  await db.incrementShlAccessCount(shl.id);
  await db.createShlAccessLog({
    shlId: shl.id,
    recipient,
    accessorName: input.accessorName ?? undefined,
    accessorOrg: input.accessorOrg ?? undefined,
    accessorCountry: input.accessorCountry ?? undefined,
    result: "granted",
    userAgent: input.userAgent ?? undefined,
    ipAddress: input.ipAddress ?? undefined,
    manifestRequestedAt: requestedAt,
    countryHint: input.accessorCountry ?? undefined,
  });

  return manifest;
}
