#!/usr/bin/env node
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// 1. Sanitize NODE_ENV: strip quotes, trim whitespace, ensure standard value
let nodeEnv = (process.env.NODE_ENV || 'production').replace(/['"]/g, '').trim();
if (!['production', 'development', 'test'].includes(nodeEnv)) {
  nodeEnv = 'production';
}

const env = {
  ...process.env,
  NODE_ENV: nodeEnv,
  NEXT_CPU_COUNT: '1',
  NEXT_TELEMETRY_DISABLED: '1',
  NODE_OPTIONS: process.env.NODE_OPTIONS || '--max-old-space-size=460',
};

console.log(`[build-frontend] Sanitized environment for Next.js build:`);
console.log(`  - NODE_ENV: ${env.NODE_ENV}`);
console.log(`  - NEXT_CPU_COUNT: ${env.NEXT_CPU_COUNT}`);
console.log(`  - NODE_OPTIONS: ${env.NODE_OPTIONS}`);

// Try finding next binary directly to avoid npx shell overhead
const nextBin = path.resolve(__dirname, '../node_modules/next/dist/bin/next');
const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';

let result;
if (fs.existsSync(nextBin)) {
  result = spawnSync(process.execPath, [nextBin, 'build'], {
    stdio: 'inherit',
    env,
    cwd: path.resolve(__dirname, '..'),
  });
} else {
  result = spawnSync(npxCmd, ['next', 'build'], {
    stdio: 'inherit',
    shell: true,
    env,
    cwd: path.resolve(__dirname, '..'),
  });
}

if (result.error) {
  console.error('[build-frontend] Build process error:', result.error);
  process.exit(1);
}

process.exit(result.status ?? 0);
