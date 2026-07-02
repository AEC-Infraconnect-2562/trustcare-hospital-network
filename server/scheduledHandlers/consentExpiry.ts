import type { Request, Response } from "express";
import { sdk } from "../_core/sdk";
import * as db from "../db";

/**
 * Scheduled handler: Check for consent records expiring within 7 days
 * and create notifications for the affected patients.
 * 
 * Path: POST /api/scheduled/consentExpiryReminder
 * Auth: cron-only (sdk.authenticateRequest)
 * Idempotency: Only creates notifications if one doesn't already exist for the same consent
 */
export async function consentExpiryReminderHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) {
      return res.status(403).json({ error: "cron-only" });
    }

    const expiringConsents = await db.findConsentsExpiringWithinDays(7);
    let notificationsCreated = 0;

    for (const consent of expiringConsents) {
      const daysUntilExpiry = Math.ceil(
        (new Date(consent.expiresAt!).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
      );

      // Create notification for the patient
      await db.createNotification({
        userId: consent.patientId,
        type: "consent_expiry_reminder",
        title: `ความยินยอมใกล้หมดอายุ (${daysUntilExpiry} วัน)`,
        message: `ความยินยอมเพื่อ "${consent.purpose}" ของคุณจะหมดอายุในอีก ${daysUntilExpiry} วัน (${new Date(consent.expiresAt!).toLocaleDateString("th-TH")}) กรุณาต่ออายุหากต้องการ`,
        metadata: {
          consentId: consent.id,
          purpose: consent.purpose,
          expiresAt: consent.expiresAt,
          daysUntilExpiry,
        },
      });
      notificationsCreated++;
    }

    res.json({
      ok: true,
      processed: expiringConsents.length,
      notificationsCreated,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[ConsentExpiryReminder] Error:", error);
    res.status(500).json({
      error: error.message,
      stack: error.stack,
      context: { url: req.url, taskUid: (req as any).taskUid },
      timestamp: new Date().toISOString(),
    });
  }
}
