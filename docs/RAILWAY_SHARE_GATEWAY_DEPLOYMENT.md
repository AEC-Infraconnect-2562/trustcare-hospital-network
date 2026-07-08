# Railway Share Gateway Deployment

This Railway service is the production-shaped TrustCare Portal backend required by the wallet Share Gateway contract.

## Service

- Repository: `AEC-Infraconnect-2562/trustcare-hospital-network`
- Branch: `codex/share-gateway-backend`
- Build command: `pnpm build`
- Start command: `pnpm start`
- Public API base after deploy: `https://<railway-domain>/api/share-gateway`

## Required Railway Variables

Set these variables on the Railway service before using cross-device wallet QR flows:

- `DATABASE_URL`: MySQL connection string from the Railway database service. If the Railway database service is named `MySQL`, set this as `${{MySQL.MYSQL_URL}}`.
- `JWT_SECRET`: strong random secret for session signing.
- `TRUSTCARE_SHARE_GATEWAY_PRIVATE_JWK`: ES256 private JWK JSON used to sign `vp+JWT` artifacts.
- `TRUSTCARE_SHARE_GATEWAY_KEY_ID`: optional key id, for example `did:web:<railway-domain>#share-gateway-signing-key`.
- `TRUSTCARE_SHARE_GATEWAY_ISSUER_DID`: optional issuer DID, for example `did:web:<railway-domain>`.
- `TRUSTCARE_SHARE_GATEWAY_PUBLIC_URL`: public gateway base, for example `https://<railway-domain>/api/share-gateway`.

Do not commit `.env` or private JWK material to git.

## Wallet Variable

After Railway provides a domain, set the wallet deployment variable:

- `VITE_TRUSTCARE_SHARE_GATEWAY_URL=https://<railway-domain>/api/share-gateway`

Mobile uses the same value under:

- `EXPO_PUBLIC_TRUSTCARE_SHARE_GATEWAY_URL=https://<railway-domain>/api/share-gateway`

## Smoke Checks

After deploy and variables are set:

```bash
curl https://<railway-domain>/api/share-gateway/.well-known/jwks.json
```

Expected: HTTP 200 with a JWKS `keys` array.

Then publish a VP from the wallet and confirm the QR payload is a resolver URL under `/api/share-gateway/presentations/*.jwt`.
