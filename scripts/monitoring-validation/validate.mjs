import { readFile } from 'node:fs/promises';

const yamlModule = await import('yaml').catch(() => import('../../CherryPlayList/node_modules/yaml/dist/index.js'));
const { parse: load } = yamlModule;

const readText = (path) => readFile(path, 'utf8');
const fail = (message) => {
  throw new Error(message);
};
const assert = (condition, message) => {
  if (!condition) fail(message);
};
const parseYaml = async (path) => load(await readText(path));
const flattenRules = (config) => config.groups.flatMap((group) => group.rules);
const includesAll = (actual, expected) => expected.every((item) => actual.includes(item));

const containsNotificationConfig = (node) => {
  const notificationKeys = new Set([
    'contactpoint',
    'contactpoints',
    'policy',
    'policies',
    'notificationpolicy',
    'notificationpolicies',
  ]);

  if (Array.isArray(node)) return node.some(containsNotificationConfig);
  if (node && typeof node === 'object') {
    return Object.entries(node).some(([key, value]) => {
      const normalizedKey = key.toLowerCase().replaceAll('_', '').replaceAll('-', '');
      return notificationKeys.has(normalizedKey) || containsNotificationConfig(value);
    });
  }

  return false;
};

const validateEnvironmentDocumentation = async () => {
  const compose = await readText('docker-compose.prod.yml');
  const example = await readText('.env.example');
  const docs = await readText('ENV.md');
  const requiredVariables = [...new Set([...compose.matchAll(/\$\{([A-Z][A-Z0-9_]*):\?/g)].map((match) => match[1]))];
  const exampleVariables = [...example.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((match) => match[1]);
  const documentedVariables = [...docs.matchAll(/\|\s+\*\*([A-Z][A-Z0-9_]*)\*\*/g)].map((match) => match[1]);
  const missingExampleVariables = requiredVariables.filter((name) => !exampleVariables.includes(name));
  const missingDocumentedVariables = requiredVariables.filter((name) => !documentedVariables.includes(name));

  assert(missingExampleVariables.length === 0, `Required production variables are missing from .env.example: ${missingExampleVariables.join(', ')}`);
  assert(missingDocumentedVariables.length === 0, `Required production variables are missing from ENV.md: ${missingDocumentedVariables.join(', ')}`);
};

const validateRoundtrip = async (path) => {
  const actual = await readText(path);
  const expected = {
    CP_ROUNDTRIP_SPECIAL: `dollar$literal # hash with spaces "double" 'single' backslash\\"quote`,
    CP_ROUNDTRIP_TRAILING_BACKSLASH: 'trailing\\',
    CP_ROUNDTRIP_CONTROLS: 'first\r\nsecond\ttab',
  };

  for (const [key, value] of Object.entries(expected)) {
    assert(actual.includes(`${key}=${value}\n`), `Docker Compose .env value did not round-trip for ${key}`);
  }
};

const validateConfigurations = async (productionPath, localPath) => {
  await validateEnvironmentDocumentation();

  const [prometheus, prometheusAlerts, loki, grafanaAlerts] = await Promise.all([
    parseYaml('monitoring/prometheus/prometheus.yml'),
    parseYaml('monitoring/prometheus/alerts.yml'),
    parseYaml('monitoring/loki/config.yml'),
    parseYaml('monitoring/grafana/provisioning/alerting/alert-rules.yml'),
    parseYaml('monitoring/grafana/provisioning/datasources/datasources.yml'),
    parseYaml('monitoring/grafana/provisioning/dashboards/dashboards.yml'),
  ]).then((values) => values.slice(0, 4));

  const expectedJobs = ['cherryplay-server', 'postgres', 'host', 'prometheus', 'loki', 'grafana', 'alloy'];
  const actualJobs = prometheus.scrape_configs.map((job) => job.job_name);
  assert(includesAll(actualJobs, expectedJobs), 'Prometheus scrape jobs are missing an expected monitoring target');
  assert(prometheus.rule_files.includes('/etc/prometheus/alerts.yml'), 'Prometheus rules file is missing');
  assert((await readText('docker-compose.prod.yml')).includes('--storage.tsdb.retention.time=168h'), 'Prometheus retention is not seven days');

  const expectedPrometheusAlerts = ['CherryPlayTargetDown', 'CherryPlayHostDiskAlmostFull', 'CherryPlayHostDiskCritical', 'CherryPlayHostMemoryLow'];
  const actualPrometheusAlerts = prometheusAlerts.groups.flatMap((group) => group.rules.map((rule) => rule.alert));
  assert(includesAll(actualPrometheusAlerts, expectedPrometheusAlerts), 'Prometheus infrastructure alert rules are incomplete');

  assert(loki.limits_config.retention_period === '168h', 'Loki retention must be 168 hours');
  assert(loki.limits_config.ingestion_rate_mb === 4 && loki.limits_config.ingestion_burst_size_mb === 8, 'Loki ingestion rate limit changed');

  const grafanaRules = flattenRules(grafanaAlerts);
  const expectedGrafanaRules = ['cherryplay-http-5xx', 'cherryplay-log-errors', 'cherryplay-target-down', 'cherryplay-host-disk-warning', 'cherryplay-host-disk-critical', 'cherryplay-host-memory-low'];
  const actualGrafanaRules = grafanaRules.map((rule) => rule.uid);
  assert(includesAll(actualGrafanaRules, expectedGrafanaRules), 'Grafana infrastructure alert rules are incomplete');

  const applicationErrorRule = grafanaRules.find((rule) => rule.uid === 'cherryplay-log-errors');
  const applicationErrorExpression = applicationErrorRule.data.find((query) => query.refId === 'A').model.expr;
  assert(applicationErrorExpression.includes('| json | Category=~') && applicationErrorExpression.includes('LogLevel=~"Error|Critical"'), 'Grafana application error alert must inspect backend JSON severity fields');

  const http5xxRule = grafanaRules.find((rule) => rule.uid === 'cherryplay-http-5xx');
  const http5xxExpression = http5xxRule.data.find((query) => query.refId === 'A').model.expr;
  assert(http5xxExpression.includes('http_requests_received_total') && http5xxExpression.includes('code="5xx"'), 'Grafana HTTP 5xx alert must query backend status metrics');
  for (const uid of ['cherryplay-log-errors', 'cherryplay-http-5xx']) {
    assert(grafanaRules.find((rule) => rule.uid === uid).noDataState === 'OK', `Grafana alert ${uid} must treat missing events as normal`);
  }

  assert(!containsNotificationConfig(grafanaAlerts), 'Grafana alert contact points or notification policies are configured');

  for (const path of ['monitoring/alloy/config.alloy', 'monitoring/alloy/config.docker.alloy']) {
    const config = await readText(path);
    const ipv4Expression = String.raw`([0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3})`;
    assert((config.match(/stage\.replace/g) ?? []).length >= 4, `Log redaction stages are missing from ${path}`);
    assert(config.includes('REDACTED_EMAIL') && config.includes('[A-Z0-9._%+-]+@'), `Email redaction is missing from ${path}`);
    assert(config.includes('[?&][A-Z0-9_.-]+=') && config.includes('[REDACTED_QUERY]'), `Credential query redaction is missing from ${path}`);
    assert(config.includes('REDACTED_IP') && config.includes('client: [0-9a-f:.]+)') && config.includes(ipv4Expression), `IPv4 or IPv6 redaction is missing from ${path}`);
  }

  const nginx = await readText('CherryPlayWeb/nginx.conf');
  assert(/^\s*access_log\s+off\s*;/m.test(nginx), 'Nginx access logging must remain disabled');

  const alertingDirectory = 'monitoring/grafana/provisioning/alerting';
  const alertingFiles = ['alert-rules.yml'];
  const alertingConfigs = await Promise.all(alertingFiles.map((path) => parseYaml(`${alertingDirectory}/${path}`)));
  assert(!alertingConfigs.some(containsNotificationConfig), 'Grafana notification contact points or policies are provisioned');

  const dashboard = JSON.parse(await readText('monitoring/grafana/dashboards/cherryplay-overview.json'));
  assert(dashboard.time.from === 'now-7d' && dashboard.time.to === 'now', 'Grafana dashboard time range must cover the last seven days');
  const websocketPanel = dashboard.panels.find((panel) => panel.title === 'Подключения к PartyHub по WebSocket');
  assert(websocketPanel?.targets.some((target) => target.expr === 'cherryplay_signalr_active_connections{transport="websocket"}' && target.instant === true), 'Grafana dashboard must show current PartyHub WebSocket connections');
  assert(websocketPanel?.targets.some((target) => target.expr === 'max_over_time(cherryplay_signalr_active_connections{transport="websocket"}[$__range])' && target.instant === true), 'Grafana dashboard must show peak PartyHub WebSocket connections');

  const production = JSON.parse(await readText(productionPath));
  const local = JSON.parse(await readText(localPath));
  const hasGrafanaLoopback = (config) => config.services.grafana.ports.some((port) => port.host_ip === '127.0.0.1' && port.published === '3001' && port.target === 3000);
  assert(hasGrafanaLoopback(production), 'Production Grafana must bind to localhost on port 3001');
  assert(hasGrafanaLoopback(local), 'Local Grafana must bind to localhost on port 3001');

  assert(Object.hasOwn(local.services.grafana.networks, 'cherryplay-network'), 'Grafana must use the CherryPlay network');
  assert(Object.hasOwn(local.services.alloy.networks, 'monitoring-internal'), 'Alloy must use the internal monitoring network');
  assert(Object.hasOwn(local.services['docker-socket-proxy'].networks, 'monitoring-internal'), 'Docker socket proxy must use the internal monitoring network');
  assert(local.services['docker-socket-proxy'].volumes.some((volume) => volume.target === '/var/run/docker.sock' && volume.read_only === true), 'Docker socket proxy mount must be read-only');
  assert(local.services.alloy.volumes.some((volume) => volume.source.replaceAll('\\', '/').endsWith('monitoring/alloy/config.docker.alloy')), 'Local Alloy configuration is not mounted');
  assert((local.services['node-exporter'].volumes ?? []).length === 0, 'Local node-exporter must not mount host filesystems');

  const localInternalServices = ['prometheus', 'postgres-exporter', 'node-exporter', 'loki', 'alloy', 'docker-socket-proxy'];
  assert(localInternalServices.every((name) => (local.services[name].ports ?? []).length === 0), 'Local monitoring services must not publish ports');
  const productionInternalServices = ['prometheus', 'postgres-exporter', 'node-exporter', 'loki', 'alloy'];
  assert(productionInternalServices.every((name) => (production.services[name].ports ?? []).length === 0), 'Production monitoring services must not publish ports');

  const serverPorts = production.services.server.ports;
  assert(serverPorts.length === 1 && serverPorts[0].host_ip === '127.0.0.1' && serverPorts[0].published === '5000' && serverPorts[0].target === 8080, 'Production server must bind only to localhost on port 5000');
  assert(production.services.prometheus.command.includes('--storage.tsdb.retention.time=168h') && production.services.prometheus.command.includes('--storage.tsdb.retention.size=2GB'), 'Production Prometheus retention limits changed');
};

try {
  if (process.argv[2] === '--roundtrip') {
    await validateRoundtrip(process.argv[3]);
  } else {
    await validateConfigurations(process.argv[2], process.argv[3]);
  }
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
