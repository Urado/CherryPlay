#!/usr/bin/env node
import { execSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const repoRoot = resolve(__dirname, "../../../../");
if (
  !existsSync(resolve(repoRoot, "CherryPlayServer/CherryPlayServer.csproj"))
) {
  console.error(
    "Run from repo root. Expected CherryPlayServer/CherryPlayServer.csproj at",
    repoRoot,
  );
  process.exit(1);
}

const results = [];

function run(name, fn) {
  process.stdout.write(`\n--- ${name} ---\n`);
  try {
    fn();
    results.push([name, true]);
    return true;
  } catch (e) {
    results.push([name, false]);
    if (e.stdout) process.stdout.write(e.stdout);
    if (e.stderr) process.stderr.write(e.stderr);
    return false;
  }
}

function exec(cmd, cwd = repoRoot, env = {}) {
  execSync(cmd, {
    cwd,
    stdio: "inherit",
    shell: true,
    env: { ...process.env, ...env },
  });
}

function execCapture(cmd, cwd = repoRoot) {
  return execSync(cmd, { cwd, encoding: "utf8", shell: true }).trim();
}

function resolvePowerShell() {
  try {
    execCapture("pwsh -NoProfile -Command \"$PSVersionTable.PSVersion.Major\"");
    return "pwsh";
  } catch {
    return "powershell";
  }
}

const args = process.argv.slice(2);
const withDocker = args.includes("--docker");
const skipCi = args.includes("--skip-ci");
const powerShell = resolvePowerShell();

const SERVER_FAST_TEST_FILTER =
  "Category!=IntegrationDb&Category!=ContainerIntegration&Category!=ContainerRestartPrepare&Category!=ContainerRestartVerify&Category!=ContainerRestartFreezePrepare&Category!=ContainerRestartFreezeVerify&Category!=ContainerRetentionPrepare&Category!=ContainerRetentionVerify";

const INTEGRATION_DB_CONTAINER = "cherryplay-healthcheck-postgres";
const INTEGRATION_DB_IMAGE = "postgres:16-alpine";
let integrationDbAdminConnectionString = "";

function stopIntegrationDbContainer() {
  try {
    execSync(`docker rm -f ${INTEGRATION_DB_CONTAINER}`, {
      cwd: repoRoot,
      stdio: "ignore",
      shell: true,
    });
  } catch {
  }
}

function startIntegrationDbContainer() {
  stopIntegrationDbContainer();
  exec(
    `docker run -d --name ${INTEGRATION_DB_CONTAINER} -p 0:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres -e POSTGRES_DB=postgres ${INTEGRATION_DB_IMAGE}`,
  );
  exec(
    `docker exec ${INTEGRATION_DB_CONTAINER} sh -c "until pg_isready -U postgres; do sleep 1; done"`,
  );
  const publishedPort = execCapture(
    `docker port ${INTEGRATION_DB_CONTAINER} 5432/tcp`,
  )
    .split("\n")[0]
    .split(":")
    .pop();
  integrationDbAdminConnectionString = `Host=127.0.0.1;Port=${publishedPort};Username=postgres;Password=postgres;Database=postgres;SslMode=Disable`;
}

run("Server: restore", () =>
  exec("dotnet restore CherryPlayServer/CherryPlayServer.csproj"),
);
run("Server: format", () =>
  exec(
    "dotnet format --verify-no-changes --verbosity minimal",
    resolve(repoRoot, "CherryPlayServer"),
  ),
);
run("Server: build (Release)", () =>
  exec(
    "dotnet build CherryPlayServer/CherryPlayServer.csproj -c Release --no-restore",
  ),
);
run("Server: tests (fast)", () =>
  exec(
    `dotnet test CherryPlayServer.Tests/CherryPlayServer.Tests.csproj -c Release --filter "${SERVER_FAST_TEST_FILTER}" --no-build`,
  ),
);
run("Server: Docker daemon", () => exec("docker info"));
run("Server: IntegrationDb postgres image", () => {
  try {
    execCapture(`docker image inspect ${INTEGRATION_DB_IMAGE}`);
    process.stdout.write(
      `using locally cached ${INTEGRATION_DB_IMAGE}; docker pull skipped\n`,
    );
  } catch {
    try {
      exec(`docker pull ${INTEGRATION_DB_IMAGE}`);
    } catch {
      throw new Error(
        `${INTEGRATION_DB_IMAGE} is not available locally and docker pull failed`,
      );
    }
  }
});
run("Server: IntegrationDb postgres container", () => {
  startIntegrationDbContainer();
});
run("Server: build tests (IntegrationDb)", () =>
  exec(
    "dotnet build CherryPlayServer.Tests/CherryPlayServer.Tests.csproj -c Release --no-restore",
  ),
);
run("Server: tests (IntegrationDb)", () => {
  try {
    exec(
      'dotnet test CherryPlayServer.Tests/CherryPlayServer.Tests.csproj -c Release -p:CherryPlayUseDefaultTestFilter=false --filter "Category=IntegrationDb" --no-build',
      repoRoot,
      {
        CHERRYPLAY_INTEGRATION_DB_ADMIN_CONNECTION_STRING:
          integrationDbAdminConnectionString,
      },
    );
  } finally {
    stopIntegrationDbContainer();
  }
});
run("Server: container integrations", () =>
  exec(
    `${powerShell} -NoProfile -ExecutionPolicy Bypass -File scripts/backend-container-integration.ps1`,
  ),
);

const componentsDir = resolve(repoRoot, "CherryPlayComponents");
if (!skipCi) {
  run("Components: npm ci", () => {
    try {
      exec("npm ci", componentsDir);
    } catch (e) {
      process.stdout.write(
        "npm ci failed (e.g. EPERM on Windows), falling back to npm install...\n",
      );
      exec("npm install", componentsDir);
    }
  });
}
run("Components: lint", () =>
  exec("npm run lint", componentsDir),
);
run("Components: production audit", () =>
  exec("npm audit --omit=dev", componentsDir),
);
run("Components: test", () => exec("npm test", componentsDir));
run("Components: build", () => {
  const outputDirectory = mkdtempSync(join(tmpdir(), "cherryplay-components-build-"));
  try {
    exec(`npx tsc --outDir "${outputDirectory}"`, componentsDir);
    exec(`node scripts/copy-css.mjs "${outputDirectory}"`, componentsDir);
  } finally {
    rmSync(outputDirectory, { force: true, recursive: true });
  }
});

run("Web: lint:fix", () =>
  exec("npm run lint:fix", resolve(repoRoot, "CherryPlayWeb")),
);
run("Web: lint", () =>
  exec("npm run lint", resolve(repoRoot, "CherryPlayWeb")),
);
run("Web: production audit", () =>
  exec("npm audit --omit=dev", resolve(repoRoot, "CherryPlayWeb")),
);
run("Web: test", () => exec("npm test", resolve(repoRoot, "CherryPlayWeb")));
run("Web: build", () =>
  exec("npm run build", resolve(repoRoot, "CherryPlayWeb")),
);

const cherryPlayListDir = resolve(repoRoot, "CherryPlayList");
run("CherryPlayList: lint", () => exec("npm run lint", cherryPlayListDir));
run("CherryPlayList: production audit", () =>
  exec("npm audit --omit=dev", cherryPlayListDir),
);
run("CherryPlayList: build", () =>
  exec("npm run build:electron", cherryPlayListDir),
);
run("CherryPlayList: test", () => exec("npm test", cherryPlayListDir));

if (withDocker) {
  run("Docker: server image", () =>
    exec(
      "docker build -f CherryPlayServer/Dockerfile -t cherryplay-server:test ./CherryPlayServer",
    ),
  );
  run("Docker: web image", () =>
    exec("docker build -f CherryPlayWeb/Dockerfile -t cherryplay-web:test ."),
  );
}

stopIntegrationDbContainer();

console.log("\n--- Summary ---\n");
const status = (ok) => (ok ? "✅" : "❌");
console.log("| Check | Status |");
console.log("|-------|--------|");
for (const [name, ok] of results) {
  console.log(`| ${name} | ${status(ok)} |`);
}
const failed = results.filter(([, ok]) => !ok).length;
if (failed > 0) {
  console.log(`\n${failed} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll checks passed.");
