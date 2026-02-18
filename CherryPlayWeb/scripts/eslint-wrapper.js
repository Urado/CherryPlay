#!/usr/bin/env node

/**
 * ESLint wrapper script to filter out "Multiple projects" warning
 * This warning appears due to TypeScript project references and doesn't affect functionality
 */

import { spawn } from 'child_process';

const args = process.argv.slice(2);
const eslintProcess = spawn('eslint', args, {
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: true,
});

let stdout = '';
let stderr = '';

eslintProcess.stdout.on('data', (data) => {
  stdout += data.toString();
});

eslintProcess.stderr.on('data', (data) => {
  const output = data.toString();
  // Filter out "Multiple projects" warning
  if (!output.includes('Multiple projects found')) {
    stderr += output;
  }
});

eslintProcess.on('close', (code) => {
  process.stdout.write(stdout);
  process.stderr.write(stderr);
  process.exit(code ?? 0);
});
