export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';

/**
 * Singleton credential types: only one active instance per (patient, hospital, type).
 * Re-issuance automatically revokes the previous credential with reason "superseded".
 */
export const SINGLETON_CREDENTIAL_TYPES = [
  'patient_identity',
  'consent_receipt',
  'mpi_link_certificate',
  'patient_summary',
  'allergy_alert',
  'medication_summary',
  'insurance_eligibility',
] as const;

export type SingletonCredentialType = typeof SINGLETON_CREDENTIAL_TYPES[number];

export function isSingletonType(type: string): type is SingletonCredentialType {
  return SINGLETON_CREDENTIAL_TYPES.includes(type as SingletonCredentialType);
}
