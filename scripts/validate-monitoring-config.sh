#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
DOCKER_CONFIG=$(mktemp -d)
CONFIG_DIR=$(mktemp -d)
trap 'rm -rf "$DOCKER_CONFIG" "$CONFIG_DIR"' EXIT
export DOCKER_CONFIG
export POSTGRES_PASSWORD=validation-postgres-password
export JWT_SECRET_KEY=validation-jwt-secret-minimum-32-characters
export PGADMIN_EMAIL=validation@example.invalid
export PGADMIN_PASSWORD=validation-pgadmin-password
export GRAFANA_ADMIN_PASSWORD=validation-grafana-password
export GRAFANA_HOST_PORT=3001
export VERSION=validation
export IMAGE_NAME_SERVER=owner/repo/server
export IMAGE_NAME_WEB=owner/repo/web

cd "$ROOT_DIR"
source scripts/compose-env.sh
docker compose -f docker-compose.prod.yml config --format json > "$CONFIG_DIR/production.json"
docker compose --env-file .env.monitoring.local.example -f docker-compose.yml -f docker-compose.monitoring.local.yml config --format json > "$CONFIG_DIR/local.json"

ROUNDTRIP_ENV="$CONFIG_DIR/roundtrip.env"
ROUNDTRIP_COMPOSE="$CONFIG_DIR/roundtrip.yml"
ROUNDTRIP_OUTPUT="$CONFIG_DIR/roundtrip-output.txt"
mkdir -p "$CONFIG_DIR/home"
roundtrip_special=$'dollar$literal # hash with spaces "double" \'single\' backslash\\"quote'
roundtrip_trailing_backslash=$'trailing\\'
roundtrip_controls=$'first\r\nsecond\ttab'
write_compose_env CP_ROUNDTRIP_SPECIAL "$roundtrip_special" "$ROUNDTRIP_ENV"
write_compose_env CP_ROUNDTRIP_TRAILING_BACKSLASH "$roundtrip_trailing_backslash" "$ROUNDTRIP_ENV"
write_compose_env CP_ROUNDTRIP_CONTROLS "$roundtrip_controls" "$ROUNDTRIP_ENV"

cat > "$ROUNDTRIP_COMPOSE" <<'COMPOSE'
services:
  env-check:
    image: busybox
    environment:
      CP_ROUNDTRIP_SPECIAL: ${CP_ROUNDTRIP_SPECIAL:?required}
      CP_ROUNDTRIP_TRAILING_BACKSLASH: ${CP_ROUNDTRIP_TRAILING_BACKSLASH:?required}
      CP_ROUNDTRIP_CONTROLS: ${CP_ROUNDTRIP_CONTROLS:?required}
COMPOSE

(
  unset POSTGRES_PASSWORD JWT_SECRET_KEY PGADMIN_EMAIL PGADMIN_PASSWORD GRAFANA_ADMIN_PASSWORD GRAFANA_HOST_PORT VERSION IMAGE_NAME_SERVER IMAGE_NAME_WEB
  export HOME="$(cygpath -w "$CONFIG_DIR/home")"
  export DOCKER_CONFIG="$(cygpath -w "$DOCKER_CONFIG")"
  docker compose --env-file "$ROUNDTRIP_ENV" -f "$ROUNDTRIP_COMPOSE" config --environment
) > "$ROUNDTRIP_OUTPUT"

node scripts/monitoring-validation/validate.mjs --roundtrip "$ROUNDTRIP_OUTPUT"
node scripts/monitoring-validation/validate.mjs "$CONFIG_DIR/production.json" "$CONFIG_DIR/local.json"

printf '%s\n' 'Monitoring Compose, privacy, observability, and YAML/JSON validation passed.'
