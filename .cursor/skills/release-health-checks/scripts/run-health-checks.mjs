#!/usr/bin/env node
/**
 * CherryPlay release health checks.
 * Step order and commands mirror GitHub Actions (build-images.yml, release-and-deploy.yml)
 * and Dockerfiles (CherryPlayServer/Dockerfile, CherryPlayWeb/Dockerfile).
 * Run from repo root: node .cursor/skills/release-health-checks/scripts/run-health-checks.mjs
 * Options: --docker (include Docker image builds); --skip-ci (skip npm ci in Components).
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

function exec(cmd, cwd = repoRoot) {
  execSync(cmd, { cwd, stdio: "inherit", shell: true });
}

const args = process.argv.slice(2);
const withDocker = args.includes("--docker");
const skipCi = args.includes("--skip-ci");

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

// --- Components (order matches CherryPlayWeb/Dockerfile first stage: npm ci → lint → build)
if (!skipCi) {
  run("Components: npm ci", () =>
    exec("npm ci", resolve(repoRoot, "CherryPlayComponents")),
  );
}
run("Components: lint", () =>
  exec("npm run lint", resolve(repoRoot, "CherryPlayComponents")),
);
run("Components: build", () =>
  exec("npm run build", resolve(repoRoot, "CherryPlayComponents")),
);

// --- Web (order matches CherryPlayWeb/Dockerfile: lint:fix → lint → build)
run("Web: lint:fix", () =>
  exec("npm run lint:fix", resolve(repoRoot, "CherryPlayWeb")),
);
run("Web: lint", () =>
  exec("npm run lint", resolve(repoRoot, "CherryPlayWeb")),
);
run("Web: build", () =>
  exec("npm run build", resolve(repoRoot, "CherryPlayWeb")),
);

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
