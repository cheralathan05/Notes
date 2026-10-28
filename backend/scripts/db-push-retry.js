/**
 * db-push-retry.js
 * Retries `prisma db push` on deployment to ensure PostgreSQL has finished
 * initializing before Express starts up. Critical for fresh Render deployments.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const MAX_RETRIES = 20;
const DELAY_MS = 4000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function findPrismaCli() {
  const candidates = [
    path.resolve(__dirname, '../node_modules/prisma/build/index.js'),
    path.resolve(__dirname, '../../node_modules/prisma/build/index.js'),
    path.resolve(process.cwd(), 'node_modules/prisma/build/index.js'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function findSchema() {
  const candidates = [
    path.resolve(__dirname, '../../prisma/schema.prisma'),
    path.resolve(__dirname, '../prisma/schema.prisma'),
    path.resolve(process.cwd(), 'prisma/schema.prisma'),
    path.resolve(process.cwd(), '../prisma/schema.prisma'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return path.resolve(__dirname, '../../prisma/schema.prisma');
}

function runDbPush() {
  return new Promise((resolve) => {
    const prismaCli = findPrismaCli();
    const schemaPath = findSchema();

    let cmd = process.execPath;
    let args = [];

    if (prismaCli) {
      args = [
        prismaCli,
        'db',
        'push',
        `--schema=${schemaPath}`,
        '--accept-data-loss',
      ];
      console.log(`[db-push-retry] Running: node ${prismaCli} db push --schema=${schemaPath} --accept-data-loss`);
    } else {
      cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
      args = [
        'prisma',
        'db',
        'push',
        `--schema=${schemaPath}`,
        '--accept-data-loss',
      ];
      console.log(`[db-push-retry] Running: npx prisma db push --schema=${schemaPath} --accept-data-loss`);
    }

    const child = spawn(cmd, args, {
      stdio: 'inherit',
      env: process.env,
      shell: !prismaCli,
    });

    child.on('close', (code) => {
      resolve(code === 0);
    });

    child.on('error', (err) => {
      console.error('[db-push-retry] Process error:', err.message);
      resolve(false);
    });
  });
}

async function main() {
  console.log('[db-push-retry] Starting database schema synchronization...');

  if (!process.env.DATABASE_URL) {
    console.warn('[db-push-retry] ⚠️ Warning: DATABASE_URL environment variable is not defined. Skipping database sync.');
    process.exit(0);
  }

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    console.log(`[db-push-retry] Synchronization attempt ${attempt}/${MAX_RETRIES}...`);
    const success = await runDbPush();

    if (success) {
      console.log('[db-push-retry] ✅ Database schema successfully synchronized with PostgreSQL!');
      process.exit(0);
    }

    if (attempt < MAX_RETRIES) {
      console.log(`[db-push-retry] Database not ready or sync failed. Retrying in ${DELAY_MS / 1000}s...`);
      await sleep(DELAY_MS);
    }
  }

  console.error('[db-push-retry] ❌ Failed to synchronize database after maximum retries.');
  process.exit(1);
}

main();
