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
ruby <<'RUBY'
required_variables = File.read("docker-compose.prod.yml").scan(/\$\{([A-Z][A-Z0-9_]*):\?/).flatten.uniq
example_variables = File.readlines(".env.example").filter_map do |line|
  match = line.match(/^([A-Z][A-Z0-9_]*)=/)
  match && match[1]
end
missing_variables = required_variables - example_variables
abort "Required production variables are missing from .env.example: #{missing_variables.join(', ')}" unless missing_variables.empty?
documented_variables = File.read("ENV.md").scan(/\|\s+\*\*([A-Z][A-Z0-9_]*)\*\*/).flatten.uniq
undocumented_variables = required_variables - documented_variables
abort "Required production variables are missing from ENV.md: #{undocumented_variables.join(', ')}" unless undocumented_variables.empty?
RUBY

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

env -i PATH="$PATH" HOME="$CONFIG_DIR/home" DOCKER_CONFIG="$DOCKER_CONFIG" \
  docker compose --env-file "$ROUNDTRIP_ENV" -f "$ROUNDTRIP_COMPOSE" config --environment > "$ROUNDTRIP_OUTPUT"

ruby - "$ROUNDTRIP_OUTPUT" <<'RUBY'
expected = {
  "CP_ROUNDTRIP_SPECIAL" => "dollar$literal # hash with spaces \"double\" 'single' backslash\\\"quote",
  "CP_ROUNDTRIP_TRAILING_BACKSLASH" => "trailing\\",
  "CP_ROUNDTRIP_CONTROLS" => "first\r\nsecond\ttab"
}
actual = File.binread(ARGV.fetch(0))
expected.each do |key, value|
  abort "Docker Compose .env value did not round-trip for #{key}" unless actual.include?("#{key}=#{value}\n")
end
RUBY

ruby <<'RUBY'
require "yaml"

prometheus = YAML.load_file("monitoring/prometheus/prometheus.yml")
prometheus_alerts = YAML.load_file("monitoring/prometheus/alerts.yml")
loki = YAML.load_file("monitoring/loki/config.yml")
grafana_alerts = YAML.load_file("monitoring/grafana/provisioning/alerting/alert-rules.yml")
YAML.load_file("monitoring/grafana/provisioning/datasources/datasources.yml")
YAML.load_file("monitoring/grafana/provisioning/dashboards/dashboards.yml")

expected_jobs = %w[cherryplay-server postgres host prometheus loki grafana alloy].sort
actual_jobs = prometheus.fetch("scrape_configs").map { |job| job.fetch("job_name") }.sort
abort "Prometheus scrape jobs are missing an expected monitoring target" unless (expected_jobs - actual_jobs).empty?
abort "Prometheus rules file is missing" unless prometheus.fetch("rule_files").include?("/etc/prometheus/alerts.yml")
abort "Prometheus retention is not seven days" unless File.read("docker-compose.prod.yml").include?("--storage.tsdb.retention.time=168h")

expected_alerts = %w[CherryPlayTargetDown CherryPlayHostDiskAlmostFull CherryPlayHostDiskCritical CherryPlayHostMemoryLow].sort
actual_alerts = prometheus_alerts.fetch("groups").flat_map { |group| group.fetch("rules") }.map { |rule| rule.fetch("alert") }.sort
abort "Prometheus infrastructure alert rules are incomplete" unless (expected_alerts - actual_alerts).empty?

limits = loki.fetch("limits_config")
abort "Loki retention must be 168 hours" unless limits.fetch("retention_period") == "168h"
abort "Loki ingestion rate limit changed" unless limits.fetch("ingestion_rate_mb") == 4 && limits.fetch("ingestion_burst_size_mb") == 8

grafana_rules = grafana_alerts.fetch("groups").flat_map { |group| group.fetch("rules") }
expected_grafana_rules = %w[cherryplay-http-5xx cherryplay-log-errors cherryplay-target-down cherryplay-host-disk-warning cherryplay-host-disk-critical cherryplay-host-memory-low]
actual_grafana_rules = grafana_rules.map { |rule| rule.fetch("uid") }
abort "Grafana infrastructure alert rules are incomplete" unless (expected_grafana_rules - actual_grafana_rules).empty?
application_error_expression = grafana_rules.find { |rule| rule.fetch("uid") == "cherryplay-log-errors" }.fetch("data").find { |query| query.fetch("refId") == "A" }.dig("model", "expr")
abort "Grafana application error alert must inspect backend JSON severity fields" unless application_error_expression.include?("| json | Category=~") && application_error_expression.include?("LogLevel=~\"Error|Critical\"")
http_5xx_expression = grafana_rules.find { |rule| rule.fetch("uid") == "cherryplay-http-5xx" }.fetch("data").find { |query| query.fetch("refId") == "A" }.dig("model", "expr")
abort "Grafana HTTP 5xx alert must query backend status metrics" unless http_5xx_expression.include?("http_requests_received_total") && http_5xx_expression.include?("code=\"5xx\"")
%w[cherryplay-log-errors cherryplay-http-5xx].each do |uid|
  rule = grafana_rules.find { |item| item.fetch("uid") == uid }
  abort "Grafana alert #{uid} must treat missing events as normal" unless rule.fetch("noDataState") == "OK"
end
notification_keys = %w[contactpoint contactpoints policy policies notificationpolicy notificationpolicies]
contains_notification_config = nil
contains_notification_config = lambda do |node|
  case node
  when Hash
    node.any? do |key, value|
      normalized_key = key.to_s.downcase.delete("_-")
      notification_keys.include?(normalized_key) || contains_notification_config.call(value)
    end
  when Array
    node.any? { |value| contains_notification_config.call(value) }
  else
    false
  end
end

abort "Grafana alert contact points or notification policies are configured" if contains_notification_config.call(grafana_alerts)

%w[monitoring/alloy/config.alloy monitoring/alloy/config.docker.alloy].each do |path|
  config = File.read(path)
  abort "Log redaction stages are missing from #{path}" unless config.scan("stage.replace").length >= 4
  abort "Email redaction is missing from #{path}" unless config.include?("REDACTED_EMAIL") && config.include?("[A-Z0-9._%+-]+@")
  abort "Credential query redaction is missing from #{path}" unless config.include?("REDACTED]") && %w[code state token access_token refresh_token client_secret id_token password secret authorization].all? { |key| config.include?(key) }
  abort "IPv4 or IPv6 redaction is missing from #{path}" unless config.include?("REDACTED_IP") && config.include?("client: )[0-9a-f:.]+") && config.include?('([0-9]{1,3}\\\\.){3}[0-9]{1,3}')
end

nginx = File.read("CherryPlayWeb/nginx.conf")
abort "Nginx access logging must remain disabled" unless nginx.match?(/^\s*access_log\s+off\s*;/)

alerting_files = Dir.children("monitoring/grafana/provisioning/alerting").select { |path| path.match?(/\.(yaml|yml)\z/i) }
alerting_configs = alerting_files.map { |path| YAML.load_file(File.join("monitoring/grafana/provisioning/alerting", path)) }
abort "Grafana notification contact points or policies are provisioned" if alerting_configs.any? { |config| contains_notification_config.call(config) }
RUBY

jq empty monitoring/grafana/dashboards/cherryplay-overview.json

jq -e '
  .time.from == "now-7d" and .time.to == "now"
  and any(.panels[]; .title == "Подключения к PartyHub по WebSocket"
    and any(.targets[]; .expr == "cherryplay_signalr_active_connections{transport=\"websocket\"}" and .instant == true)
    and any(.targets[]; .expr == "max_over_time(cherryplay_signalr_active_connections{transport=\"websocket\"}[$__range])" and .instant == true))
' monitoring/grafana/dashboards/cherryplay-overview.json >/dev/null

jq -e '
  .services.grafana.ports | any(.host_ip == "127.0.0.1" and .published == "3001" and .target == 3000)
' "$CONFIG_DIR/production.json" >/dev/null

jq -e '
  .services.grafana.ports | any(.host_ip == "127.0.0.1" and .published == "3001" and .target == 3000)
' "$CONFIG_DIR/local.json" >/dev/null

jq -e '
  . as $config
  | ($config.services.grafana.networks | has("cherryplay-network"))
  and ($config.services.alloy.networks | has("monitoring-internal"))
  and ($config.services.docker-socket-proxy.networks | has("monitoring-internal"))
  and ($config.services.docker-socket-proxy.volumes | any(.target == "/var/run/docker.sock" and .read_only == true))
  and ($config.services.alloy.volumes | any(.source | endswith("monitoring/alloy/config.docker.alloy")))
  and (($config.services."node-exporter".volumes // []) | length == 0)
' "$CONFIG_DIR/local.json" >/dev/null

jq -e '
  [.services.prometheus, .services.postgres-exporter, .services.node-exporter, .services.loki, .services.alloy, .services.docker-socket-proxy]
  | all(.[]; (.ports // []) | length == 0)
' "$CONFIG_DIR/local.json" >/dev/null

jq -e '
  [.services.prometheus, .services.postgres-exporter, .services.node-exporter, .services.loki, .services.alloy]
  | all(.[]; (.ports // []) | length == 0)
' "$CONFIG_DIR/production.json" >/dev/null

jq -e '
  .services.server.ports | length == 1
  and .[0].host_ip == "127.0.0.1"
  and .[0].published == "5000"
  and .[0].target == 8080
' "$CONFIG_DIR/production.json" >/dev/null

jq -e '
  any(.services.prometheus.command[]; . == "--storage.tsdb.retention.time=168h")
  and any(.services.prometheus.command[]; . == "--storage.tsdb.retention.size=2GB")
' "$CONFIG_DIR/production.json" >/dev/null

printf '%s\n' 'Monitoring Compose, privacy, observability, and YAML/JSON validation passed.'
