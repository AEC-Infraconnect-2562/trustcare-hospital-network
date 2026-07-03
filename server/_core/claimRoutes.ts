import type { Express, Request, Response } from "express";
import {
  buildClaimPublicApiExamples,
  buildClaimWorkbench,
  buildPayerAdjudicationEnvelope,
  buildPaymentReconciliationEnvelope,
  buildPayerSubmissionEnvelope,
} from "../claimCenter";

function mockPacket() {
  return buildClaimWorkbench({ now: new Date().toISOString() }).seedPackets[0];
}

function respond(res: Response, payload: unknown, status = 200) {
  res.set("Cache-Control", "no-store");
  res.status(status).json(payload);
}

export function registerClaimRoutes(app: Express) {
  app.get("/api/public/claim-center/v1", (_req: Request, res: Response) => {
    const packet = mockPacket();
    respond(res, {
      simulationMode: true,
      notForProduction: true,
      message:
        "TrustCare public claim API mock. Production endpoints must require partner authentication, request signing, consent scope, and payer contract configuration.",
      ...buildClaimPublicApiExamples(packet),
    });
  });

  app.post("/api/public/claim-center/v1/eligibility-check", (_req: Request, res: Response) => {
    const packet = mockPacket();
    respond(res, buildClaimPublicApiExamples(packet).endpoints[0].response, 202);
  });

  app.post("/api/public/claim-center/v1/claim-packages", (req: Request, res: Response) => {
    const packet = mockPacket();
    const mode = typeof req.body?.adapterMode === "string" ? req.body.adapterMode : undefined;
    respond(res, buildPayerSubmissionEnvelope(packet, mode), 202);
  });

  app.post("/api/public/claim-center/v1/payer-responses", (req: Request, res: Response) => {
    const packet = mockPacket();
    const decision = req.body?.decision === "rejected" || req.body?.decision === "more_info_requested"
      ? req.body.decision
      : "accepted";
    const reason = typeof req.body?.reason === "string" ? req.body.reason : undefined;
    respond(res, buildPayerAdjudicationEnvelope(packet, decision, reason), 202);
  });

  app.post("/api/public/claim-center/v1/payments", (req: Request, res: Response) => {
    const packet = mockPacket();
    const paidAmount = Number(req.body?.paidAmount);
    respond(res, buildPaymentReconciliationEnvelope(packet, Number.isFinite(paidAmount) ? paidAmount : undefined), 202);
  });
}
