# Deployment and recovery

Opine runs as one Node application backed by PostgreSQL 18. Keep Nitro in the deployment: the client-rendered SPA still needs its authentication and API endpoints. The selected managed host is Render; see the [Render deployment](render.md), developed on branch `render`. This guide remains the Linux-host alternative using systemd and nginx, and the canonical guide for the portable backup/restore commands; provisioning the host, database and TLS certificate is installation-specific.

## Install

Use Node **26.7.0**, pnpm **12.21.0**, and PostgreSQL **18**, including its `pg_dump`, `pg_restore` and `psql` client tools on the operator host. Build from a reviewed Git commit with the committed lockfile. Provision a dedicated PostgreSQL database and login that owns it, without superuser privileges. Do not use the development Compose credentials in production. Limit database network access to the application and operator hosts; configure verified TLS when the database connection crosses an untrusted network.

Use this installation layout, owned by the dedicated `opine` service account:

```text
/srv/opine/
  .env                        Production environment, mode 0600
  config/community.json       Public name and community link
  config/rules.md             Community rules
  app/                        Checkout of the deployed Git revision
    .env -> /srv/opine/.env    Environment for migration/operator commands
    .output/                  Production build
```

Copy `.env.example` into the installation directory and replace its development settings. Configure `DATABASE_URL`, the exact HTTPS `BETTER_AUTH_URL`, a stable `BETTER_AUTH_SECRET`, and Discord credentials following [Authentication](authentication.md#configure-discord). Add `NODE_ENV=production`, `NITRO_HOST=127.0.0.1` and `NITRO_PORT=3000`. Configure public files following [Community configuration](community.md). Keep the environment file and database password out of Git and shell history.

From `/srv/opine/app`, with the pinned Node/pnpm versions available:

```sh
ln -s /srv/opine/.env .env
pnpm install --frozen-lockfile
pnpm build
pnpm db:migrate
```

The symlink is for a fresh checkout without an existing `.env`. Migration and operator commands read that file; an exported `DATABASE_URL` overrides it, so check the target environment before running them. Migrations are explicit and never run on application startup. Save the deployed commit ID with the installation's operational records.

Configure `/etc/systemd/system/opine.service`:

```ini
[Unit]
Description=Opine community feedback
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=opine
Group=opine
WorkingDirectory=/srv/opine
ExecStart=/usr/local/bin/node --env-file=/srv/opine/.env /srv/opine/app/.output/server/index.mjs
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Replace `/usr/local/bin/node` with the absolute path to the pinned Node binary. systemd does not load an interactive shell or nvm configuration. The working directory is intentional: the server loads `config/` from there. The built server does not load `.env` unless explicitly instructed. After installing the unit, run `sudo systemctl daemon-reload` and `sudo systemctl enable --now opine`.

## HTTPS and proxy

Terminate HTTPS at a trusted reverse proxy and expose only its HTTPS/HTTP ports publicly. Keep Nitro bound to loopback. Register `https://feedback.example.com/api/auth/callback/discord` with Discord and set `BETTER_AUTH_URL=https://feedback.example.com` for this example.

An nginx site with an already provisioned certificate can use:

```nginx
server {
    listen 80;
    server_name feedback.example.com;
    return 301 https://feedback.example.com$request_uri;
}

server {
    listen 443 ssl;
    server_name feedback.example.com;
    ssl_certificate /etc/letsencrypt/live/feedback.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/feedback.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $remote_addr;
    }
}
```

Replace the hostname and certificate paths, validate with `sudo nginx -t`, then reload nginx. Arrange certificate renewal and alert on renewal failures. Configure per-client request limits at the trusted proxy, particularly for `/api/auth/`. Opine deliberately uses the socket address for authentication rate limits, so all proxied clients share its application bucket; forwarding headers do not change that. Tune the shared allowance for expected traffic and retain proxy limits. See [sign-in limits](authentication.md#sign-in-rate-limits).

Check `/api/health` for process liveness and `/api/ready` for database readiness through HTTPS. Readiness should return HTTP 200 with `{"status":"ok"}`. A passing readiness check does not prove Discord OAuth: the real deployed sign-in, reload and sign-out check remains in [TODO #10](TODO.md#10-complete-final-deployment-and-retention-checks).

This deployment follows Nuxt's [Node server deployment](https://nuxt.com/docs/4.x/getting-started/deployment) and nginx's [proxy directives](https://nginx.org/en/docs/http/ngx_http_proxy_module.html).

## Back up an installation

The backup command creates a new private directory containing `.env`, `config/community.json`, `config/rules.md` and `database.dump`. The dump contains the whole database, including authentication identities and sessions, roles, feedback and discussion, notifications, moderation state, events and Drizzle migration history. It is not a public content export. PostgreSQL cluster roles, server configuration, certificates and the application source/build are not included; retain the deployed Git revision and infrastructure configuration separately.

Use the PostgreSQL 18 client tools. Configure `PGHOST`, `PGPORT`, `PGUSER` and `PGDATABASE` explicitly for the same database as the installation's `DATABASE_URL`. `PGDATABASE` must be a plain database name. These commands do **not** read `DATABASE_URL` or source `.env`. Put the password in the operator's `~/.pgpass` (or `PGPASSFILE`), with mode `0600`; see PostgreSQL's [password file format](https://www.postgresql.org/docs/18/libpq-pgpass.html). Set `PGSSLMODE=verify-full` and the appropriate `PGSSLROOTCERT` for a remote TLS database.

```sh
export PGHOST=127.0.0.1 PGPORT=5432 PGUSER=opine PGDATABASE=opine
cd /srv/opine/app
pnpm backup /srv/opine /var/backups/opine/2026-11-21-before-upgrade
```

The destination must not exist. Run as an operator who can read the installation files and create the backup directory. Keep installation configuration unchanged during the backup. PostgreSQL provides a consistent database snapshot while the application runs; stopping the application first also prevents later writes while taking a pre-upgrade recovery point.

The bundle contains credentials and private account/content data, including archived content. Store backups outside the repository, encrypt copies off-host, restrict access and set a retention schedule appropriate to the installation. Monitor backup failures and available space. Do not treat a partial failed directory as a usable backup; use a new destination for the next attempt. Backups need periodic restoration drills, not just successful command exits. The command uses PostgreSQL's [custom archive format](https://www.postgresql.org/docs/18/app-pgdump.html).

## Restore into an isolated installation

Restore only a trusted backup into a **new, empty PostgreSQL 18 database**, owned by the restoring login. Keep the application stopped and prevent other clients from writing to the target. The restore command refuses a nonempty database and requires its name; it never drops or clears existing application data.

Provision the empty database separately, then select it explicitly:

```sh
export PGHOST=127.0.0.1 PGPORT=5432 PGUSER=opine PGDATABASE=opine_restore
cd /srv/opine/app
pnpm restore /var/backups/opine/2026-11-21-before-upgrade --confirm opine_restore
```

Restoration uses one transaction with `pg_restore --single-transaction --no-owner --no-acl`; failures roll back the database changes. Objects belong to the restoring login. Original cluster roles and grants are not recreated. Do **not** run migrations against the empty target before restoring: the archive already includes schema and migration history. See PostgreSQL's [restore reference](https://www.postgresql.org/docs/18/app-pgrestore.html).

The command restores only the database. For a recovery drill, create a separate installation directory, copy the backup's `.env` and `config/` there, and deploy the same application revision used by the backup. Preserve private file permissions. Change `DATABASE_URL` to the restored database, choose an unused loopback port, and adjust `BETTER_AUTH_URL` for the isolated origin. Keep **the original `BETTER_AUTH_SECRET`**: changing it invalidates signed sessions and affects encrypted provider tokens. Do not expose the recovery instance publicly or send it real production traffic.

Start the restored server with that installation as its working directory and its `.env` explicitly loaded. Check readiness and the public configuration. Verify populated posts and contributions, accounts and privileged-role assignments, official responses, follows/notifications, and locked/archived timestamps. Locked posts must remain read-only; archived content must remain absent from application queries and notifications. Check migration history and events were retained. Record the backup revision, database/client versions, date, checks and result. A restart-only test is not restoration evidence.

For actual recovery, validate the isolated instance before switching traffic or applying newer migrations. Recovering an old backup loses writes made after its snapshot; make that recovery-point decision explicitly. Leave the original database intact until recovery has been accepted.

## Upgrades and routine operation

For an upgrade, review release notes and migrations, test the target revision against a restored copy, and arrange a maintenance window. Stop Opine, take a fresh backup, update the checkout to the chosen revision, install with the frozen lockfile, build, and apply committed migrations. Keep installation `.env` and public configuration separate from checkout defaults. Start the service and check readiness, public configuration and a representative feedback journey. Record the revision and results.

Do not assume older application code works with a newer schema. If migration or validation fails, keep traffic stopped, diagnose the failure and use a validated recovery database if rollback is necessary. There is no automatic down-migration procedure.

Monitor service restarts, readiness failures, database connections/storage, backup age and certificate expiry. Use `systemctl status opine` and `journalctl -u opine` for service diagnosis; restrict log access. Avoid putting credentials, cookies or full request bodies into proxy logs. The broader operational error-reporting audit remains in [TODO #10](TODO.md#10-complete-final-deployment-and-retention-checks).

Restart the service after changing installation configuration. Use the documented [role commands](authentication.md#grant-the-first-administrator) and Tags UI for routine administration. Account deletion/anonymization requires the separately tracked operator process in #10; do not improvise user deletion SQL that bypasses contribution-retention constraints.

## Restoration evidence

Successful local recovery drill on **2026-11-21**, using PostgreSQL server and clients **18.7** (`postgres:18`, Debian 18.7-1.pgdg13+2). The application build used the code from `225946e`; the backup scripts and regression test are committed with this record. All databases and installation files were disposable. No development or production data was used.

- The [backup integration test](../server/db/backup.integration.ts), run by `pnpm test:integration`, restored a custom archive into a fresh database inside the existing database suite's container. Every row in the public and Drizzle schemas matched, including accounts, sessions, roles, contributions, official responses, follows, notifications, moderation timestamps and events.
- Copied environment/configuration files retained their exact contents and private backup permissions. A separate installation directory loaded the restored public settings and rules. The saved auth secret validated the restored signed session; application reads retained privileged roles and lock/archive visibility.
- Existing backup destinations, mismatched confirmations and occupied restore targets were refused. A truncated archive failed without leaving partial tables.
- A separate production-build smoke rehearsal started `.output/server/index.mjs` from the restored installation directory with its copied `.env` and updated database URL. HTTP checks passed: readiness 200, restored community settings/rules, authenticated identity and roles, readable locked feedback, locked comment creation rejected with 423, and archived feedback returning 404. The process and temporary databases/files were then removed.

The automated record checks remain part of the database suite. Repeat the production smoke steps above when rehearsing a particular deployment. This local drill does not validate a real HTTPS proxy or Discord consent round trip; those deployed checks remain in #10.
