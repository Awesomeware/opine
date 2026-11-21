#!/usr/bin/env bash
set -euo pipefail
umask 077

if [[ $# != 2 || -z ${PGDATABASE:-} ]]; then
  echo 'Usage: PGDATABASE=<database-name> pnpm backup <installation-dir> <new-backup-dir>' >&2
  echo 'Configure PostgreSQL connection settings with PGHOST, PGPORT, PGUSER and a password file.' >&2
  exit 1
fi

if [[ $PGDATABASE == *'='* || $PGDATABASE == *'://'* ]]; then
  echo 'PGDATABASE must be a database name, not a connection string.' >&2
  exit 1
fi

installation=$1
backup=$2
trap 'echo "Backup failed. The destination may be incomplete; use a new directory when retrying." >&2' ERR

# Keep configuration and secrets beside the database archive so a replacement
# installation can use the same auth secret. Never reuse an existing backup.
test -f "$installation/.env"
test -s "$installation/config/community.json"
test -s "$installation/config/rules.md"
command -v pg_dump >/dev/null
mkdir -- "$backup"
mkdir -- "$backup/config"
cp -- "$installation/.env" "$backup/.env"
cp -- "$installation/config/community.json" "$backup/config/community.json"
cp -- "$installation/config/rules.md" "$backup/config/rules.md"
chmod 600 "$backup/.env" "$backup/config/community.json" "$backup/config/rules.md"

# No schema filter: authentication, event history and Drizzle's migration schema
# all belong to the backup. Only publish the archive after pg_dump succeeds.
pg_dump --format=custom --no-password > "$backup/database.dump.partial" 2>/dev/null
mv -- "$backup/database.dump.partial" "$backup/database.dump"
echo 'Backup complete. Store this directory securely; it contains credentials and private data.'
