#!/usr/bin/env bash
set -euo pipefail
umask 077

if [[ $# != 3 || $2 != --confirm || -z ${PGDATABASE:-} || $3 != "$PGDATABASE" ]]; then
  echo 'Usage: PGDATABASE=<database-name> pnpm restore <backup-dir> --confirm <database-name>' >&2
  echo 'Create a fresh database first. The confirmation must match PGDATABASE.' >&2
  exit 1
fi

if [[ $PGDATABASE == *'='* || $PGDATABASE == *'://'* ]]; then
  echo 'PGDATABASE must be a database name, not a connection string.' >&2
  exit 1
fi

backup=$1
trap 'echo "Restore failed. Check the backup, PostgreSQL connection and target permissions." >&2' ERR
test -s "$backup/database.dump"
test -f "$backup/.env"
test -s "$backup/config/community.json"
test -s "$backup/config/rules.md"
command -v pg_restore >/dev/null

# Ignore personal psql startup files and confirm the actual connected database,
# rather than relying only on environment settings or service configuration.
actual=$(psql -X --no-password --tuples-only --no-align --set=ON_ERROR_STOP=1 \
  --command='select current_database()' 2>/dev/null)
if [[ $actual != "$3" ]]; then
  echo 'Connected database does not match the confirmation. Nothing changed.' >&2
  exit 1
fi

# A template0 database has an empty public schema. Refuse existing application
# objects or other user schemas; restoring must never merge with a live install.
occupied=$(psql -X --no-password --tuples-only --no-align --set=ON_ERROR_STOP=1 \
  --command="select exists (
    select 1 from pg_namespace n
    where n.nspname !~ '^pg_' and n.nspname <> 'information_schema'
      and (n.nspname <> 'public'
        or exists (select 1 from pg_class where relnamespace = n.oid)
        or exists (select 1 from pg_proc where pronamespace = n.oid)
        or exists (select 1 from pg_type where typnamespace = n.oid))
  )" 2>/dev/null)
if [[ $occupied != f ]]; then
  echo 'Target database is not empty. Nothing changed.' >&2
  exit 1
fi

# A failed restore rolls back its changes. Original role names and grants are
# intentionally replaced by ownership under the destination connection role.
pg_restore --dbname="$PGDATABASE" --single-transaction --no-owner --no-acl \
  --no-password < "$backup/database.dump" 2>/dev/null
echo 'Database restored. Copy configuration into a new installation and update its DATABASE_URL before starting it.'
