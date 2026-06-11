#!/usr/bin/env node
/**
 * CherryPlay release health checks.
 * Step order and commands mirror GitHub Actions (build-images.yml, release-and-deploy.yml)
 * and Dockerfiles (CherryPlayServer/Dockerfile, CherryPlayWeb/Dockerfile).
 * Run from repo root: node .cursor/skills/release-health-checks/scripts/run-health-checks.mjs
 * Options:
 *   --docker (include Docker image builds)
 *   --skip-ci (skip npm ci in Components)
 */

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Repo root: directory containing CherryPlayServer and CherryPlayWeb
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

const args = process.argv.slice(2);
const withDocker = args.includes("--docker");
const skipCi = args.includes("--skip-ci");

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
    // Container may not exist.
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
  integrationDbAdminConnectionString = `Host=127.0.0.1;Port=${publishedPort};Username=postgres;Password=postgres;Database=postgres`;
}

// --- Server (order matches CherryPlayServer/Dockerfile: restore → format → build)
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
    'dotnet test CherryPlayServer.Tests/CherryPlayServer.Tests.csproj -c Release --filter "Category!=IntegrationDb" --no-build',
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
      'dotnet test CherryPlayServer.Tests/CherryPlayServer.Tests.csproj -c Release --filter "Category=IntegrationDb" --no-build',
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

// --- Components (order matches CherryPlayWeb/Dockerfile first stage: npm ci → lint → build)
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
  exec("npx eslint . --max-warnings=0", componentsDir),
);
run("Components: test", () => exec("npm test", componentsDir));
run("Components: build", () => exec("npx tsc", componentsDir));

// --- Web (order matches CherryPlayWeb/Dockerfile: lint:fix → lint → build)
run("Web: lint:fix", () =>
  exec("npm run lint:fix", resolve(repoRoot, "CherryPlayWeb")),
);
run("Web: lint", () =>
  exec("npm run lint", resolve(repoRoot, "CherryPlayWeb")),
);
run("Web: test", () => exec("npm test", resolve(repoRoot, "CherryPlayWeb")));
run("Web: build", () =>
  exec("npm run build", resolve(repoRoot, "CherryPlayWeb")),
);

// --- CherryPlayList (desktop app unit tests)
const cherryPlayListDir = resolve(repoRoot, "CherryPlayList");
run("CherryPlayList: test", () => exec("npm test", cherryPlayListDir));

// --- Optional Docker
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

// --- Summary
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
