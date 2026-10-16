import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const isCI = process.env.CI === 'true' || process.env.DOCKER === 'true' || process.env.NODE_ENV === 'production';
const hasGit = existsSync('.git');

if (isCI || !hasGit) {
  if (isCI) {
    console.log('Skipping husky install in CI/Docker environment.');
  } else {
    console.log('Skipping husky install because no .git directory was found.');
  }
  process.exit(0);
}

try {
  const result = spawnSync('npx', ['husky', 'install'], {
    stdio: 'inherit',
    shell: true,
  });

  if (result.status !== 0) {
    console.log('Husky install skipped (non-critical).');
    process.exit(0);
  }

  process.exit(0);
} catch {
  console.log('Husky install skipped (non-critical).');
  process.exit(0);
}
