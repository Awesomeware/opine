#!/usr/bin/env bash
set -euo pipefail

# Exercise the shipped image against a disposable database, never DATABASE_URL.
image=${1:-opine:local}
artifacts=$(mktemp -d -t opine-deployment-XXXXXXXX)
network=$(basename "$artifacts")
postgres_id=
application_id=
network_created=false

cleanup() {
  result=$?
  if [[ -n "$application_id" ]]; then
    if [[ $result != 0 ]]; then docker logs "$application_id" >&2 || true; fi
    docker rm --force --volumes "$application_id" >/dev/null
  fi
  if [[ -n "$postgres_id" ]]; then docker rm --force --volumes "$postgres_id" >/dev/null; fi
  if [[ "$network_created" == true ]]; then docker network rm "$network" >/dev/null; fi
  rm -rf "$artifacts"
  exit "$result"
}
trap cleanup EXIT

docker network create "$network" >/dev/null
network_created=true
postgres_id=$(docker run --detach --network "$network" --network-alias database \
  --env POSTGRES_PASSWORD=opine-test-password --env POSTGRES_DB=opine_test postgres:18)

# Wait for TCP: the image briefly starts a socket-only server during initialization.
for attempt in {1..60}; do
  if docker exec "$postgres_id" pg_isready --host 127.0.0.1 --username postgres --dbname opine_test >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec "$postgres_id" pg_isready --host 127.0.0.1 --username postgres --dbname opine_test

cat > "$artifacts/environment" <<'ENV'
DATABASE_URL=postgresql://postgres:opine-test-password@database:5432/opine_test
BETTER_AUTH_URL=http://localhost:8080
BETTER_AUTH_SECRET=opine-deployment-test-secret-not-for-production
DISCORD_CLIENT_ID=opine-deployment-test-client
DISCORD_CLIENT_SECRET=opine-deployment-test-secret
PORT=8080
ENV

# The hosting platform runs migrations before starting the new application.
docker run --rm --network "$network" --env-file "$artifacts/environment" "$image" pnpm db:migrate
docker run --rm --network "$network" --env-file "$artifacts/environment" "$image" pnpm db:migrate
docker run --rm --network "$network" --env-file "$artifacts/environment" "$image" pnpm db:seed
docker run --rm "$image" node --input-type=module -e '
  import assert from "node:assert/strict";
  import { existsSync, statSync } from "node:fs";
  import { homedir } from "node:os";
  assert.notEqual(process.getuid(), 0);
  const ssh = statSync(`${homedir()}/.ssh`);
  assert.ok(ssh.isDirectory());
  assert.equal(ssh.uid, process.getuid());
  assert.equal(ssh.mode & 0o777, 0o700);
  for (const path of [".env", ".git", ".github"]) assert.equal(existsSync(path), false);
'

application_id=$(docker run --detach --network "$network" --env-file "$artifacts/environment" \
  --publish 127.0.0.1::8080 "$image")
base_url="http://$(docker port "$application_id" 8080/tcp)"

for attempt in {1..60}; do
  if curl --fail --silent --max-time 5 "$base_url/api/ready" >/dev/null; then break; fi
  sleep 1
done
curl --fail --silent --max-time 5 "$base_url/api/ready" >/dev/null

OPINE_SMOKE_URL="$base_url" node --input-type=module <<'JS'
import assert from 'node:assert/strict'

const base = process.env.OPINE_SMOKE_URL
for (const path of ['/', '/favicon.svg', '/api/health', '/api/ready', '/api/auth/get-session']) {
  assert.equal((await fetch(`${base}${path}`)).status, 200, path)
}
const community = await (await fetch(`${base}/api/community`)).json()
assert.ok(community.name)
assert.ok(community.rulesHtml)
const posts = await (await fetch(`${base}/api/feedback/posts`)).json()
assert.ok(posts.posts.length > 0, 'seeded posts must be readable through the packaged API')
console.log('Deployment image passed migrations, operator seeding, configuration and HTTP checks.')
JS
