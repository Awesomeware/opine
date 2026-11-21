# Community configuration

Each Opine installation serves one community. Configure its public name, rules and community link through the server environment; no settings editor or configuration table is needed. Opine keeps its own wordmark beside the community name.

## Public settings

These values are exposed to every browser through Nuxt's `runtimeConfig.public.community`. Never put credentials, private contact details or other secrets in them.

| Environment variable          | Meaning                                                                        | Default                     |
| ----------------------------- | ------------------------------------------------------------------------------ | --------------------------- |
| `NUXT_PUBLIC_COMMUNITY_NAME`  | Public game or community name, shown in the application header and rules page. | `Community`                 |
| `NUXT_PUBLIC_COMMUNITY_URL`   | Optional community website, forum or Discord invite, linked from the footer.   | No link                     |
| `NUXT_PUBLIC_COMMUNITY_RULES` | Plain-text rules displayed at `/rules`.                                        | General participation rules |

For local development, set these in `.env` alongside the existing installation variables:

```dotenv
NUXT_PUBLIC_COMMUNITY_NAME="Pine Valley"
NUXT_PUBLIC_COMMUNITY_URL="https://example.com/community"
NUXT_PUBLIC_COMMUNITY_RULES="Criticism, disagreement and negative feedback are welcome.
Discuss the game and ideas respectfully. Do not harass or threaten people.
Do not post hate speech, personal information or spam."
```

Quoted `.env` values can span multiple lines. Rules preserve line breaks and are rendered as escaped text: HTML and Markdown are not interpreted. The default rules welcome criticism, disagreement and negative feedback while prohibiting harassment, threats, hate speech, sharing personal information and spam. Empty or non-string names and rules fall back to the defaults.

The community URL must be an absolute HTTP or HTTPS address without embedded credentials. Empty, invalid and unsupported URLs produce no community link. This setting is a navigation link, not the application's origin; configure `BETTER_AUTH_URL` separately.

Nuxt parses environment values, so a name consisting solely of a number or a boolean-like word needs an explicit JSON string to remain text, for example `NUXT_PUBLIC_COMMUNITY_NAME='"1984"'` in `.env`.

## Apply settings

Nuxt loads `.env` for local development. Restart the development server after changing these settings. For production, provide the same environment variables through the deployment environment before starting the built server:

```sh
node .output/server/index.mjs
```

The built server does not load `.env` automatically. To test a production build locally with the file, use:

```sh
node --env-file=.env .output/server/index.mjs
```

Changing public configuration requires restarting the running server and reloading open browser pages, but does not require rebuilding the application. These settings use Nuxt's matching `NUXT_PUBLIC_*` runtime overrides, rather than reading a differently named build-time variable. See the official [runtime configuration](https://nuxt.com/docs/4.x/guide/going-further/runtime-config) and [environment file](https://nuxt.com/docs/4.x/directory-structure/env) documentation.

The public `/rules` page is accessible without signing in. The footer links to it on every page, and post and comment forms link to it where people contribute. There is no mandatory acceptance checkbox or moderation-review contact workflow in this release.

## Complete installation setup

Public community settings complement the existing configuration paths:

- [Local setup and database migrations](../README.md#local-development): Node/pnpm, PostgreSQL, `DATABASE_URL` and migration commands.
- [Discord and authentication secrets](authentication.md#configure-discord): application origin, callback URL, `BETTER_AUTH_SECRET`, `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET`. These remain server-only.
- [First administrator](authentication.md#grant-the-first-administrator) and [role management](authentication.md#administrator-role-management): `pnpm auth:role grant|revoke <user-id> <role>` for operators, or the authenticated administrator API. Administrator and community-manager permissions are independent.
- [Categories](feedback.md#category-configuration): `pnpm feedback:category upsert|enable|disable ...` controls names, ordering and availability.
- [Tags](feedback.md#tags): administrators use **Tags** in the application navigation to create, rename, disable and re-enable the available tags.
- [Posting limits](feedback.md#posting-limits) and [sign-in limits](authentication.md#sign-in-rate-limits): server-only environment settings tune creation and authentication limits.

Keep installation environment files out of source control and include configuration in the operator's backup process. Production operation, backup restoration and account-retention procedures remain tracked in [TODO #8](TODO.md#8-complete-operational-readiness-and-retention).
