import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const hasGit = existsSync('.git');

if (!hasGit) {
  console.log('Skipping husky install because no .git directory was found.');
  process.exit(0);
}

const result = spawnSync('npx', ['husky', 'install'], {
  stdio: 'inherit',
  shell: true,
});

process.exit(result.status ?? 0);
