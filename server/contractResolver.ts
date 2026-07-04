import type { ReadinessContext } from "@shared/readiness";
import {
  buildDataMappingV2Profiles,
  buildServiceReadinessContracts,
  type BundleTransport,
  type ServiceReadinessContract,
} from "./prepareService";

export interface ContractResolverInput {
  context?: ReadinessContext;
  contractId?: string;
  contractVersion?: string;
  tenantId?: string;
  hospitalId?: number;
}

export interface ResolvedContractArtifact {
  kind: "fhir_resource" | "document_reference" | "credential_type" | "vp_package" | "shl_packet" | "operation_outcome";
  id: string;
  required: boolean;
}

export interface ResolvedIntegrationContract {
  tenantId: string;
  hospitalId?: number;
  context: ReadinessContext;
  contractId: string;
  contractVersion: string;
  contract: ServiceReadinessContract;
  mappingProfile: Record<string, unknown>;
  consentPolicy: ServiceReadinessContract["consentPolicy"];
  outputArtifacts: ResolvedContractArtifact[];
  transportPolicy: {
    recommendedTransports: BundleTransport[];
    directVpAllowed: boolean;
    shlPacketAllowed: boolean;
  };
  fallbackUsed: boolean;
  warnings: string[];
}

const DEFAULT_TENANT_ID = "trustcare-network";
const DEFAULT_CONTEXT: ReadinessContext = "opd_visit";

export function resolveIntegrationContract(input: ContractResolverInput = {}): ResolvedIntegrationContract {
  const contracts = buildServiceReadinessContracts();
  const warnings: string[] = [];

  let contract = resolveByContractId(contracts, input.contractId, input.contractVersion);
  let fallbackUsed = false;

  if (!contract && input.contractId) {
    fallbackUsed = true;
    warnings.push(`Contract ${input.contractId} was not found; falling back to context ${input.context ?? DEFAULT_CONTEXT}.`);
  }

  if (!contract && input.context) {
    contract = contracts.find((candidate) => candidate.context === input.context);
  }

  if (!contract) {
    fallbackUsed = true;
    contract = contracts.find((candidate) => candidate.context === DEFAULT_CONTEXT) ?? contracts[0];
    warnings.push(`No context was supplied; falling back to ${contract.context}.`);
  }

  if (input.contractVersion && input.contractVersion !== contract.version) {
    fallbackUsed = true;
    warnings.push(`Version ${input.contractVersion} was not found for ${contract.contractId}; using ${contract.version}.`);
  }

  const mappingProfile = findMappingProfile(contract);

  return {
    tenantId: input.tenantId?.trim() || DEFAULT_TENANT_ID,
    hospitalId: input.hospitalId,
    context: contract.context,
    contractId: contract.contractId,
    contractVersion: contract.version,
    contract,
    mappingProfile,
    consentPolicy: contract.consentPolicy,
    outputArtifacts: buildOutputArtifacts(contract),
    transportPolicy: {
      recommendedTransports: contract.recommendedTransports,
      directVpAllowed: contract.recommendedTransports.includes("vp"),
      shlPacketAllowed: contract.recommendedTransports.includes("shl"),
    },
    fallbackUsed,
    warnings,
  };
}

function resolveByContractId(
  contracts: ServiceReadinessContract[],
  contractId?: string,
  contractVersion?: string,
): ServiceReadinessContract | undefined {
  if (!contractId) return undefined;
  const matches = contracts.filter((contract) => contract.contractId === contractId);
  if (contractVersion) {
    return matches.find((contract) => contract.version === contractVersion);
  }
  return matches[0];
}

function findMappingProfile(contract: ServiceReadinessContract): Record<string, unknown> {
  const profiles = buildDataMappingV2Profiles().profiles;
  return profiles.find((profile) => profile.contractId === contract.contractId) ?? {
    mappingProfileId: `map.${contract.context}.fallback`,
    contractId: contract.contractId,
    context: contract.context,
    requiredOutputs: [],
    validation: {
      dqiThreshold: 85,
      operationOutcome: true,
    },
  };
}

function buildOutputArtifacts(contract: ServiceReadinessContract): ResolvedContractArtifact[] {
  const artifacts: ResolvedContractArtifact[] = [
    { kind: "operation_outcome", id: `OperationOutcome/${contract.context}`, required: true },
  ];

  for (const resourceType of contract.fhirResources) {
    artifacts.push({ kind: "fhir_resource", id: resourceType, required: true });
  }
  for (const vcType of contract.vcTypes) {
    artifacts.push({ kind: "credential_type", id: vcType, required: true });
  }
  if (contract.recommendedTransports.includes("document_reference")) {
    artifacts.push({ kind: "document_reference", id: `DocumentReference/${contract.context}`, required: true });
  }
  if (contract.recommendedTransports.includes("vp")) {
    artifacts.push({ kind: "vp_package", id: `VP/${contract.context}`, required: false });
  }
  if (contract.recommendedTransports.includes("shl")) {
    artifacts.push({ kind: "shl_packet", id: `SHL/${contract.context}`, required: false });
  }

  return artifacts;
}
