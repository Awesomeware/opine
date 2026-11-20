# Authentication feature

This Nuxt layer owns Discord sign-in, sessions, linked identities, and Opine roles. Root infrastructure provides its database connection. See [authentication setup](../../docs/authentication.md) for configuration and administration.

## Public entrypoints

- `server/access.ts`: `getAccess(headers)` resolves a signed database session into `{ user: { id, name }, roles }`, or `null` for a visitor. Protected endpoints must reject visitors (401), then check the required role (403). Resolve access on each request; never accept an actor ID or role claims from request data.
- `shared/roles.ts`: `hasRole`, `isPrivilegedRole`, and role types are browser-safe. Client checks control presentation only. `administrator` never implies `community-manager`.
- `server/schema.ts`: `user.id` is the internal identity for foreign keys from other features. External Discord IDs live in `account`; email and provider IDs must not own content.
- `server/roles.ts`: `getUserRoles` reads current roles. Authenticated endpoints use `setUserRoleAsAdministrator(actorId, userId, role, grant)`, supplying the session actor, to check administrator authority and mutate atomically. It returns `updated`, `not-found`, or `forbidden`. `setUserRole` is operator-only and relies on database credentials; never use it directly for an HTTP caller. See [role-change concurrency](../../docs/authentication.md#administrator-role-management).

In Nitro endpoints, pass `fromNodeHeaders(event.node.req.headers)` from `better-auth/node` to `getAccess`. Do not call `toWebRequest` merely to obtain headers before `readBody`: it starts consuming the request body.

`GET /api/access` returns the caller's identity and roles without email or provider tokens. `POST /api/access/roles` requires an administrator session and the configured same-origin `Origin` header. Better Auth owns `/api/auth/**`, including its session and OAuth endpoints. These responses must not be cached.

Every existing authenticated account has the member role implicitly. The database stores only independently assignable privileged roles. Role changes are read immediately, without session claims or a role cache. Future moderation must add participation restrictions to the relevant protected use cases; this step does not implement suspension.

Do not import `server/` modules into browser code. The UI uses the same-origin Better Auth Vue client. `tests/fixtures.ts` is test-only and must never be imported by production code.
