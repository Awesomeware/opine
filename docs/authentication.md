# Authentication and access

Opine uses Better Auth's built-in Discord provider, its PostgreSQL Drizzle adapter, and database-backed sessions. The implementation lives in [layers/auth](../layers/auth/README.md). Discord is the only enabled sign-in method; there is no password registration endpoint.

## Configure Discord

1. Create an application in the [Discord Developer Portal](https://discord.com/developers/applications).
2. Under OAuth2, add the exact redirect URL `http://localhost:3000/api/auth/callback/discord` for local development. Use your HTTPS application origin followed by `/api/auth/callback/discord` in production.
3. Copy the client ID and client secret to `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` in `.env`. Keep secrets out of source control.
4. Set `BETTER_AUTH_URL` to the application origin, without a trailing slash. Generate `BETTER_AUTH_SECRET` with `openssl rand -base64 32`; keep it stable across restarts. Rotating it invalidates signed sessions and affects encrypted provider tokens.
5. Run `pnpm db:migrate`, start `pnpm dev`, and select **Sign in with Discord**. Approve the requested identity and email permissions. A Discord account needs an email address for this provider flow.

The built production server reads environment variables supplied by the deployment; it does not load `.env` automatically. HTTPS is required outside localhost. Better Auth sets HTTP-only session cookies, using secure cookies on HTTPS. Sign-out deletes the server session. Expired or revoked sessions no longer authorize requests, and cookie caching is disabled.

Failed or cancelled sign-in returns to `/sign-in` with a generic recovery message. Application logs distinguish OAuth, database, session, and unclassified internal failures using fixed categories. They omit raw authentication errors, which can contain credentials or private account details. Diagnose configuration by checking required variable names, the exact callback URL, and migrations; do not log tokens.

## Internal identities and roles

Opine creates an internal user ID and links the Discord provider identity to it. Names and email addresses do not grant privileges. Automatic account linking is disabled, as is the linking interface for this release. Enabling future providers must preserve internal user IDs and require an explicit authenticated linking flow with proof of account ownership.

| Role              | Access                                               |
| ----------------- | ---------------------------------------------------- |
| Visitor           | Public browsing; no authenticated writes             |
| Member            | Ordinary authenticated participation                 |
| Community manager | Member access plus official responses and moderation |
| Administrator     | Member access plus role administration               |

Member access is implicit for every authenticated account. An account can hold both privileged roles. Administrator access alone never permits official responses or moderation. Later feature steps implement those protected operations using these role boundaries.

## Grant the first administrator

The intended administrator must sign in once. While signed in, open `/api/access` on the application origin and copy `user.id`. This endpoint returns only the current caller's identity and roles. An operator with database access then runs:

```sh
pnpm auth:role grant <user-id> administrator
```

The CLI reads `.env` and uses `DATABASE_URL` (an exported value takes precedence). It requires an existing internal user ID. It can also grant or revoke either privileged role for routine operator administration and recovery:

```sh
pnpm auth:role grant <user-id> community-manager
pnpm auth:role revoke <user-id> community-manager
pnpm auth:role revoke <user-id> administrator
```

The CLI is an operator tool authorized through database credentials, not a user-facing endpoint. Restrict those credentials accordingly. Repeat grants and revocations are harmless. Revoking the final administrator is allowed; an operator can restore access with the CLI.

## Administrator role management

An authenticated administrator can grant and revoke roles without database credentials using `POST /api/access/roles`. No settings UI is required yet. In the browser console on the application origin, while signed in as an administrator:

```js
const response = await fetch('/api/access/roles', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'TARGET_INTERNAL_USER_ID',
    role: 'community-manager', // or 'administrator'
    action: 'grant', // or 'revoke'
  }),
})
console.log(response.status, await response.json())
```

The browser sends the session cookie and same-origin `Origin` header. Success returns `200` with `{ "success": true }`; visitors receive `401`, non-administrators or invalid origins `403`, invalid input `400`, and unknown target IDs `404`. The endpoint reads and validates the request body before checking the session and administrator role. Authorization applies to that request: once authorized it may finish even if the actor's role is subsequently revoked; later requests must pass a fresh check. Role mutation itself does not recheck the caller or lock identities to coordinate revocation. The operator CLI invokes the same persistence operation using its database credentials.

## Sign-in rate limits

`AUTH_SIGN_IN_MAX` (default `10`) controls sign-in starts per client IP within `AUTH_SIGN_IN_WINDOW_SECONDS` (default `60`). Both must be positive integers. Other authentication endpoints have a default limit of 100 requests per minute, with Better Auth's endpoint-specific rules where applicable. Counters are stored in PostgreSQL, including in development.

The Nitro adapter overwrites the rate-limit IP header with the socket's remote address. Client-supplied forwarding headers cannot select another bucket. Behind a reverse proxy, callers share the proxy's bucket: configure per-client limits at that trusted proxy and tune the application limit for the deployment. Do not start trusting arbitrary forwarding headers to work around shared limits.

## Verification

Run `pnpm test`, `pnpm test:integration`, and `pnpm test:e2e`. Tests use isolated PostgreSQL databases, generated test secrets, and dummy Discord credentials. Integration tests control Discord's token/profile responses; browser tests exercise the application with genuine seeded database sessions. No test login endpoint or production authentication bypass is installed.

A real Discord consent round trip still requires an application registered with Discord and its credentials. Before a public pilot, verify sign-in, refresh, and sign-out on the configured public HTTPS origin; this final deployed check is tracked in [TODO #10](TODO.md#10-complete-final-deployment-and-retention-checks).

References: [Better Auth Nuxt integration](https://better-auth.com/docs/integrations/nuxt), [Discord provider](https://better-auth.com/docs/authentication/discord), [sessions](https://better-auth.com/docs/concepts/session-management), [account linking](https://better-auth.com/docs/concepts/users-accounts#account-linking), and [rate limits](https://better-auth.com/docs/concepts/rate-limit).
