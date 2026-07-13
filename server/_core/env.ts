export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // Wallet OIDC is intentionally explicit. An empty issuer must make the
  // provisioning contract unavailable instead of silently using a demo value.
  walletOidcIssuer: process.env.TRUSTCARE_WALLET_OIDC_ISSUER ?? "",
  walletOidcAudience: process.env.TRUSTCARE_WALLET_OIDC_AUDIENCE ?? "trustcare-wallet-api",
  walletOidcRequiredRole: process.env.TRUSTCARE_WALLET_OIDC_REQUIRED_ROLE ?? "wallet_access",
  walletOidcPatientRefClaim: process.env.TRUSTCARE_WALLET_OIDC_PATIENT_REF_CLAIM ?? "trustcare_patient_ref",
  walletOidcClientId: process.env.TRUSTCARE_WALLET_OIDC_CLIENT_ID ?? "trustcare-wallet-web",
  keycloakTestLoginEnabled: process.env.TRUSTCARE_KEYCLOAK_TEST_LOGIN_ENABLED === "true",
  keycloakTestUserPassword: process.env.TRUSTCARE_KEYCLOAK_TEST_USER_PASSWORD ?? "",
  walletTestLoginClientId: process.env.TRUSTCARE_WALLET_TEST_LOGIN_CLIENT_ID ?? process.env.TRUSTCARE_WALLET_OIDC_CLIENT_ID ?? "trustcare-wallet-web",
};
