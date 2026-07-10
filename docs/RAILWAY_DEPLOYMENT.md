# Railway Deployment

TrustCare can run independently of the Manus WebDev sandbox on Railway. The
recommended production-shaped test environment contains three resources in one
Railway project:

- `trustcare-portal`: Node.js web service deployed from this GitHub repository
- `MySQL`: private MySQL database service
- `trustcare-files`: private S3-compatible Railway Bucket

## Deployment contract

`railway.json` defines the build, migration, start, health check, and restart
policy. Railway runs Drizzle migrations and the guarded demo bootstrap as
pre-deploy commands, where private networking and service variables are
available.

The web service must reference these service variables:

```text
DATABASE_URL=${{MySQL.MYSQL_URL}}
BUCKET=${{trustcare-files.BUCKET}}
ACCESS_KEY_ID=${{trustcare-files.ACCESS_KEY_ID}}
SECRET_ACCESS_KEY=${{trustcare-files.SECRET_ACCESS_KEY}}
REGION=${{trustcare-files.REGION}}
ENDPOINT=${{trustcare-files.ENDPOINT}}
```

Set these application variables directly on the web service:

```text
NODE_ENV=production
STORAGE_BACKEND=s3
VITE_APP_ID=trustcare-railway
JWT_SECRET=<random value, at least 32 characters>
TRUSTCARE_VC_SIGNING_SECRET=<separate random value>
TRUSTCARE_PUBLIC_URL=https://<generated-domain>.up.railway.app
TRUSTCARE_DID_DOMAIN=<generated-domain>.up.railway.app
BOOTSTRAP_DEMO_DATA=true
ALLOW_PUBLIC_DEMO_SEED=false
VITE_ENABLE_DEMO_SEED_UI=false
```

For asymmetric network-level VC signing, also set:

```text
TRUSTCARE_VC_SIGNING_PRIVATE_JWK=<private P-256 JWK JSON>
TRUSTCARE_VC_SIGNING_PUBLIC_JWK=<public P-256 JWK JSON>
TRUSTCARE_VC_KEY_ID=did:web:<generated-domain>.up.railway.app#vc-signing-key-1
TRUSTCARE_VC_SIGNING_ALG=ES256
```

Never commit real secrets or private JWK material.

## Database and seed lifecycle

Fresh Railway databases use the clean migration stream in
`drizzle-production/`. This baseline is generated from the canonical
`drizzle/schema.ts` and deliberately does not rewrite the legacy Manus
migration history in `drizzle/`.

The pre-deploy sequence is:

1. `pnpm db:migrate:production` applies the production baseline and subsequent
   production migrations.
2. `pnpm bootstrap:railway` runs only when `BOOTSTRAP_DEMO_DATA=true`.
3. Bootstrap stages write versioned markers to `audit_events`, so later
   deployments do not automatically revoke and recreate seeded VC/VP records.
4. `auditTrustcareVcVpSeedDatabase()` validates hospitals, patients,
   credentials, wallet cards, presentations, source connectors, DID policy, and
   patient Maker/Checker violations. A failed audit stops deployment.

To intentionally rebuild demo VC/VP data, use the authenticated system-admin
reseed flow or bump the bootstrap version in
`server/scripts/bootstrapRailway.ts` after reviewing the impact. Public reseed
is disabled in production.

For a schema change, update `drizzle/schema.ts`, run
`pnpm db:generate:production`, review the generated SQL, and commit the new
production migration. The legacy stream remains available only for existing
Manus databases during the cutover period.

## Storage lifecycle

Demo portraits are version-controlled under `client/public/seed-avatars` and do
not depend on Manus storage. User uploads and generated files use the private
Railway Bucket through the S3 adapter. Browser access remains same-origin via
`/api/storage-proxy/*`; the server creates a short-lived signed object URL and
streams the response with content-type and cache headers.

## Runtime verification

Railway calls `GET /api/health`. A healthy response requires both a successful
`SELECT 1` against MySQL and a configured storage backend. After deployment,
also verify:

- demo login and role-aware redirects
- patient Wallet cards and portrait images
- VC issuance and VP verification
- SHL manifest, QR, files, and associated VC/VP
- upload/download through `/api/storage-proxy/*`
- `/.well-known/did.json`, `/.well-known/jwks.json`, and hospital DID routes

The Railway-generated domain is the initial public URL. Custom DNS can be added
later only after updating `TRUSTCARE_PUBLIC_URL`, `TRUSTCARE_DID_DOMAIN`, signing
key IDs, and reseeding credentials whose issuer DID is domain-bound.
