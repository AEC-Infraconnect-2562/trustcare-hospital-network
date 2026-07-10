const publicUrl = (process.env.TRUSTCARE_PUBLIC_URL ?? "https://trustcare.network").replace(/\/+$/, "");
const inferredDidDomain = (() => {
  try {
    return new URL(publicUrl).host;
  } catch {
    return "trustcare.network";
  }
})();

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  storageBackend: process.env.STORAGE_BACKEND ?? "auto",
  storageBucket: process.env.S3_BUCKET ?? process.env.BUCKET ?? "",
  storageAccessKeyId: process.env.S3_ACCESS_KEY_ID ?? process.env.ACCESS_KEY_ID ?? "",
  storageSecretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? process.env.SECRET_ACCESS_KEY ?? "",
  storageRegion: process.env.S3_REGION ?? process.env.REGION ?? "auto",
  storageEndpoint: process.env.S3_ENDPOINT ?? process.env.ENDPOINT ?? "",
  allowPublicDemoSeed: process.env.ALLOW_PUBLIC_DEMO_SEED === "true",
  bootstrapDemoData: process.env.BOOTSTRAP_DEMO_DATA === "true",
  publicUrl,
  didDomain: process.env.TRUSTCARE_DID_DOMAIN ?? inferredDidDomain,
};
