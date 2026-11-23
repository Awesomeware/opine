# Community configuration

Each Opine installation serves one community. Configure its public name and link in `config/community.json`, and its rules in `config/rules.md`. Both files ship with usable defaults. Opine keeps its own wordmark beside the community name; no settings editor or configuration table is needed.

The current `render` branch configures the installation for **EQ: Legends**, linking to the [official EverQuest Legends website](https://www.everquestlegends.com/). These checked-in files also apply to local runs of this branch. Forks can replace them with their own community settings.

## Configuration files

Edit `config/community.json`:

```json
{
  "name": "Pine Valley",
  "url": "https://example.com/community",
  "footerDisclaimer": "An independent fan community, not affiliated with the game's developers or publishers."
}
```

`name` must be a nonempty string. `url` is optional: omit it or use an empty string to hide the community link. When supplied, it must be an absolute HTTP or HTTPS address without embedded credentials. This navigation link is separate from the application's origin, configured through `BETTER_AUTH_URL`.

`footerDisclaimer` is optional plain text displayed below the footer links on every page. Omit it or use an empty string to hide it. HTML and Markdown are displayed literally. The EQ: Legends installation uses this field to state that it is not officially affiliated with GameJawn, Daybreak Games or EQ: Legends. Other installations should replace it with their own wording. Restart the server after changing it; on Render, commit and deploy the updated configuration.

Write the community rules as Markdown in `config/rules.md`, for example:

```markdown
## Give constructive feedback

Criticism, disagreement and negative feedback are welcome.

- Discuss the **game and ideas** respectfully.
- Do not harass or threaten people.
- Do not post hate speech, personal information or spam.

For general discussion, visit [our community](https://example.com/community).
```

The rules file must contain nonempty text. The server uses [markdown-it](https://github.com/markdown-it/markdown-it) to render headings, lists, emphasis, links, code blocks and images. Raw HTML is disabled and the renderer's default URL filtering remains enabled. This Markdown support applies to installation rules; feedback posts and comments remain plain text.

The page supplies the `h1` (“Community rules”); start sections with `##` and keep heading levels in order. Use descriptive link text and meaningful alternative text for informative images so the configured content remains accessible.

The public `GET /api/community` endpoint returns only the name, URL, footer disclaimer and rendered rules HTML. Extra JSON keys and raw configuration files are not exposed. Missing files, malformed JSON or invalid settings fail server startup with a configuration error; there is no environment-variable fallback.

## Apply settings

The server reads both files once at startup from `config/` relative to its working directory. For local development, run `pnpm dev` from the repository root. Restart the server after editing either file and reload open browser pages. No rebuild is needed.

For production, place or mount your `config/` directory in the installation's working directory and start the built server from there. For example, with configuration under `/srv/opine/config/` and the build under `/srv/opine/app/.output/`:

```sh
cd /srv/opine
node /srv/opine/app/.output/server/index.mjs
```

Deploy the configuration files alongside the application; copying `.output/` alone is insufficient. Keep deployment-specific versions of these files in your installation configuration and backup process. Authentication and database credentials remain environment settings. The built server does not load `.env` automatically; use the deployment environment or Node's `--env-file` option for those settings.

The public `/rules` page is accessible without signing in. The footer links to it on every page, and post and comment forms link to it where people contribute. There is no mandatory acceptance checkbox or moderation-review contact workflow in this release.

## Complete installation setup

Public community settings complement the existing configuration paths:

- [Local setup and database migrations](../README.md#local-development): Node/pnpm, PostgreSQL, `DATABASE_URL` and migration commands.
- [Discord and authentication secrets](authentication.md#configure-discord): application origin, callback URL, `BETTER_AUTH_SECRET`, `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET`. These remain server-only.
- [First administrator](authentication.md#grant-the-first-administrator) and [role management](authentication.md#administrator-role-management): `pnpm auth:role grant|revoke <user-id> <role>` for operators, or the authenticated administrator API. Administrator and community-manager permissions are independent.
- [Tags](feedback.md#tags): administrators use **Tags** in the application navigation to create, rename, disable and re-enable the available tags.
- [Posting limits](feedback.md#posting-limits) and [sign-in limits](authentication.md#sign-in-rate-limits): server-only environment settings tune creation and authentication limits.

Keep installation environment files out of source control and include configuration in the operator's backup process. Follow [Deployment and recovery](deployment.md) for production operation and backup restoration. Account-retention procedures remain tracked in [TODO #10](TODO.md#10-complete-final-deployment-and-retention-checks).
