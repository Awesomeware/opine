# Railway hosting trial

Evaluate Railway from branch **`railway`**, keeping `main` unchanged until the trial is accepted. The repository contains the application [Dockerfile](../Dockerfile), GitHub CI workflow and the deployment settings below. These are local deployment preparation, not evidence of a live installation: connecting accounts, running hosted CI and deploying remain outstanding in [TODO #10](TODO.md#10-complete-final-deployment-and-retention-checks).

Opine is one Node service serving both the SPA and Nitro API, with PostgreSQL 18 in the same Railway project, environment and region. Start with one application replica. The app needs no volume: PostgreSQL holds mutable data, while `config/community.json` and `config/rules.md` ship in the image. Edit those public files in Git and deploy to change this installation's name, community link or rules. Keep all credentials in Railway variables.

## Validate the image locally

With Docker, Node and curl available:

```sh
docker build --tag opine:railway .
bash scripts/test-deployment.sh opine:railway
```

The smoke check creates its own network and PostgreSQL container. It applies
migrations twice, runs the example-data operator command against that disposable
database, verifies the image runs without root or local secrets, and checks the
packaged server's configuration and HTTP endpoints on a random loopback port.
It removes its containers, database volume and network on exit. It does not use
the development database or real Discord credentials. CI runs the same check.

## Provision the trial

1. Make the branch available in a GitHub repository and grant the Railway GitHub integration access. Keep the repository private until its license is chosen.
2. Create a Railway project/environment for the trial. Add PostgreSQL and verify its major version is **18** before creating data. Use Railway's supported database image and volume configuration; do not change the major version of an existing database volume.
3. Add the application from the GitHub repository, selecting **`railway`** as its source branch and the repository root as its root directory. Use the checked-in Dockerfile and configure the dashboard fields below. Place app and database in the same region.
4. Configure the variables below, generate a stable HTTPS domain, and register its exact Discord callback URL.
5. Enable **Wait for CI** in the app's service settings. Confirm the push workflow runs on `railway` and succeeds before enabling automatic deployments. Observe the actual commit being built and deployed, rather than assuming a green local run proves the integration.

Railway [autodeploys](https://docs.railway.com/deployments/github-autodeploys) can track a selected branch and wait for GitHub Actions. Wait for CI evaluates workflow conclusions: skipped/neutral workflows do not block, and cancellation has special handling. Keep required checks unconditional for branch pushes; migrations additionally run as a deployment prerequisite. The CI workflow also covers `main` and pull requests so the same checks remain after a later merge.

### Application service settings

Railway's legacy `railway.json` / `railway.toml` configuration is [deprecated and unavailable to new services](https://docs.railway.com/config-as-code/reference), with removal scheduled for 1 December 2026. This trial uses the Dockerfile and explicit dashboard settings instead of introducing a new infrastructure tool.

| Setting               | Trial value                        |
| --------------------- | ---------------------------------- |
| Source branch         | `railway`                          |
| Root directory        | Repository root                    |
| Build                 | Dockerfile                         |
| Wait for CI           | Enabled                            |
| Pre-deploy command    | `pnpm db:migrate`                  |
| Pre-deploy timeout    | 300 seconds                        |
| Start command         | `node .output/server/index.mjs`    |
| Healthcheck path      | `/api/ready`                       |
| Healthcheck timeout   | 300 seconds                        |
| Replicas              | 1                                  |
| Serverless / sleeping | Disabled; keep the service running |

These settings are deployment prerequisites, not automatically applied by committing the Dockerfile. Record the configured service/environment and deployed revision in the installation's operator records.

## Variables and domain

Set these on the **application** service, not in build arguments or committed files:

| Variable                | Value                                                                                                                                                                            |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`          | `${{Postgres.DATABASE_URL}}`, replacing `Postgres` with the actual database service name. Verify the referenced URL uses its private Railway hostname, not the public TCP proxy. |
| `BETTER_AUTH_URL`       | The stable HTTPS application origin, e.g. `https://feedback.example.com`, without a trailing slash.                                                                              |
| `BETTER_AUTH_SECRET`    | A generated secret, retained across deployments and recovery. Generate locally with `openssl rand -base64 32`.                                                                   |
| `DISCORD_CLIENT_ID`     | The Discord application's client ID.                                                                                                                                             |
| `DISCORD_CLIENT_SECRET` | Its client secret.                                                                                                                                                               |

Railway supplies `PORT`; the image binds the Node server on all interfaces and consumes that port. Do not copy local `NITRO_HOST=127.0.0.1`, local port overrides or Compose credentials into the service. Runtime database access uses Railway's [private network](https://docs.railway.com/networking/private-networking); building the image does not require database or Discord credentials.

A Railway-generated HTTPS hostname is sufficient for the trial, or attach a custom domain. Register `https://YOUR-HOST/api/auth/callback/discord` in Discord and keep `BETTER_AUTH_URL` on that same origin. See [authentication setup](authentication.md#configure-discord). Changing hosts later requires updating both settings.

Opine currently uses the socket address for [sign-in rate limits](authentication.md#sign-in-rate-limits), so people behind the same Railway proxy share a coarse throttle. The default is only 10 sign-in starts per 60 seconds. Explicitly tune `AUTH_SIGN_IN_MAX` and `AUTH_SIGN_IN_WINDOW_SECONDS` for expected aggregate trial traffic, then verify the effect through the public proxy before admitting pilot users. This does not provide a per-person limit behind Railway. Forwarded-header trust has not been established for this installation; do not enable arbitrary header trust to bypass the shared bucket.

## Deploy and operate

The deployment sequence is CI, image build, **`pnpm db:migrate`**, then **`node .output/server/index.mjs`**. The image includes the migration history, migration tooling and role/category operator commands as well as the built server and public configuration.

Railway [pre-deploy commands](https://docs.railway.com/deployments/pre-deploy-command) run with service variables and private networking. A failed command stops deployment. Existing traffic may still reach the previous application while migrations execute, so schema changes must remain compatible with that version. For incompatible changes, arrange a maintenance window and stop writes before migration. Redeploying an older image does not undo an applied migration; use the [migration guide](migrations.md) and a rehearsed recovery plan.

The readiness path configured above is `/api/ready`. It must return HTTP 200 before Railway switches traffic to the new deployment. Verify `/api/health`, `/api/ready`, public feedback and `/rules` through the actual HTTPS origin. Railway's [healthcheck](https://docs.railway.com/deployments/healthchecks) gates startup; it is not ongoing uptime monitoring. Configure ongoing monitoring and alerts for failed requests, database availability and failed backups separately.

After signing in once, copy your internal ID from `/api/access`. Open a shell in the **application** service using the Railway dashboard's **Copy SSH Command**, then run:

```sh
pnpm auth:role grant YOUR_INTERNAL_USER_ID administrator
pnpm auth:role grant YOUR_INTERNAL_USER_ID community-manager
```

The roles are independent; grant only those needed. The [Railway CLI SSH command](https://docs.railway.com/cli#ssh) runs inside the deployed service, where its private database URL is reachable. `railway run` executes locally with injected variables; it does not make private Railway DNS reachable from your laptop. Use [category commands](feedback.md#category-configuration) and the Tags UI for subsequent setup. Do not seed or reset the public database as part of deployment.

## Recovery and costs

Explicitly enable PostgreSQL **PITR** in the database Backups tab, confirm its first usable backup and archiving health, and set the required volume-backup schedule. [Railway PITR](https://docs.railway.com/volumes/point-in-time-recovery) starts coverage after enablement; recovery creates a separate database service and requires a deliberate connection cutover. Archive storage and upload traffic contribute to costs.

Retain the deployed Git revision, public configuration and a protected copy of deployment secrets separately: database recovery does not recreate the complete installation. Rehearse recovery into an isolated database/application, verifying accounts, roles, contributions and locked/archived visibility before a public pilot. Keep the original database available until verification and cutover are complete; enable recovery protection on the restored database too.

The portable [backup and restore commands](deployment.md#back-up-an-installation) remain an alternative for operator-managed exports. They require PostgreSQL 18 client tools and explicit native connection settings on an operator host; do not assume the application image contains those tools or a persistent backup directory.

Set Railway usage notifications and a deliberate spending limit in the workspace. A hard limit can stop services, so choose it with the desired availability in mind. Review app/database memory, storage, backups and traffic after the trial has realistic use. See [cost control](https://docs.railway.com/pricing/cost-control).

Before accepting the trial, record a successful hosted CI/deploy, a recovery rehearsal, real Discord sign-in/reload/sign-out, and the operational error-reporting review in [TODO #10](TODO.md#10-complete-final-deployment-and-retention-checks). Merge into `main` only after deciding to keep Railway, then deliberately change the Railway source branch to `main` and verify its first deployment.

## Local validation record

On 2026-11-21, lint, formatting, migration-history checks, both typechecks,
unit tests, database integration suites, production E2E journeys and Storybook
component tests passed locally. Production/Storybook builds used isolated output
directories to preserve the development server. The Docker image also passed the
isolated deployment smoke check described above, including repeat migrations and
operator seeding. Review found no outstanding blocking issues.

This is local evidence only. GitHub-hosted CI, Railway service settings, the public
proxy, real Discord consent and hosted recovery have not been exercised. This
checkout has no Git remote configured yet; provisioning remains the next step.
