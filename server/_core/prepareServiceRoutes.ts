import type { Express, Request, Response } from "express";
import {
  buildAudienceUseCases,
  buildPrepareServicePublicApiExamples,
  buildPrepareServiceWorkbench,
  buildServiceBundleEnvelope,
  buildServiceReadinessContracts,
  buildWalletDeploymentEnvelope,
  buildWalkInWalletConnection,
  simulatePrepareServiceImport,
} from "../prepareService";
import { readinessContextValues, type ReadinessContext } from "../../shared/readiness";

function respond(res: Response, payload: unknown, status = 200) {
  res.set("Cache-Control", "no-store");
  res.status(status).json(payload);
}

function parseContext(value: unknown): ReadinessContext {
  return readinessContextValues.includes(value as ReadinessContext)
    ? (value as ReadinessContext)
    : "opd_visit";
}

function parseWalletMode(value: unknown) {
  return value === "appointment_list" || value === "cohort" || value === "walk_in" || value === "external_wallet"
    ? value
    : value === "single"
      ? "single"
      : undefined;
}

export function registerPrepareServiceRoutes(app: Express) {
  app.get("/api/public/prepare-service/v1", (_req: Request, res: Response) => {
    respond(res, {
      simulationMode: true,
      notForProduction: true,
      message:
        "TrustCare Prepare for Service public API mock. Production requires partner authentication, patient consent, role checks, audit, and Contract Hub persistence.",
      ...buildPrepareServicePublicApiExamples(),
    });
  });

  app.get("/api/public/prepare-service/v1/contexts", (_req: Request, res: Response) => {
    respond(res, {
      simulationMode: true,
      ...buildAudienceUseCases(),
    });
  });

  app.get("/api/public/prepare-service/v1/contracts", (_req: Request, res: Response) => {
    respond(res, {
      simulationMode: true,
      contracts: buildServiceReadinessContracts(),
    });
  });

  app.post("/api/public/prepare-service/v1/assess", (req: Request, res: Response) => {
    const context = parseContext(req.body?.context);
    respond(res, buildPrepareServiceWorkbench({ context, patientId: Number(req.body?.patientId) || 1 }), 202);
  });

  app.post("/api/public/prepare-service/v1/import", (req: Request, res: Response) => {
    respond(
      res,
      simulatePrepareServiceImport({
        context: parseContext(req.body?.context),
        sourceType: typeof req.body?.sourceType === "string" ? req.body.sourceType : undefined,
        documentType: typeof req.body?.documentType === "string" ? req.body.documentType : undefined,
        patientId: Number(req.body?.patientId) || 1,
        consentRef: typeof req.body?.consentRef === "string" ? req.body.consentRef : undefined,
      }),
      202,
    );
  });

  app.post("/api/public/prepare-service/v1/packets", (req: Request, res: Response) => {
    const context = parseContext(req.body?.context);
    respond(
      res,
      buildServiceBundleEnvelope({
        context,
        audience: req.body?.audience === "hospital" ? "hospital" : "patient",
        patientId: Number(req.body?.patientId) || 1,
        receiver: typeof req.body?.receiver === "string" ? req.body.receiver : undefined,
      }),
      202,
    );
  });

  app.post("/api/public/prepare-service/v1/wallet-deployments", (req: Request, res: Response) => {
    respond(
      res,
      buildWalletDeploymentEnvelope({
        context: parseContext(req.body?.context),
        hospitalId: Number(req.body?.hospitalId) || 1,
        targetPatientIds: Array.isArray(req.body?.targetPatientIds)
          ? req.body.targetPatientIds.map(Number).filter(Number.isFinite)
          : undefined,
        targetWalletMode: parseWalletMode(req.body?.targetWalletMode),
        issueDocuments: Array.isArray(req.body?.issueDocuments) ? req.body.issueDocuments.map(String) : undefined,
      }),
      202,
    );
  });

  app.post("/api/public/prepare-service/v1/walk-in-wallets", (req: Request, res: Response) => {
    respond(
      res,
      buildWalkInWalletConnection({
        patientName: typeof req.body?.patientName === "string" ? req.body.patientName : undefined,
        phone: typeof req.body?.phone === "string" ? req.body.phone : undefined,
        passport: typeof req.body?.passport === "string" ? req.body.passport : undefined,
        consentAttested: Boolean(req.body?.consentAttested),
      }),
      202,
    );
  });
}
