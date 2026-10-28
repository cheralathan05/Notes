const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

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

function copyDirSafely(src, dest) {
  if (!fs.existsSync(src)) return;
  try {
    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        copyDirSafely(srcPath, destPath);
      } else {
        try {
          fs.copyFileSync(srcPath, destPath);
        } catch (err) {
          if (err.code !== 'EPERM' && err.code !== 'EBUSY') {
            console.warn(`[prisma-generate] Notice on ${entry.name}:`, err.message);
          }
        }
      }
    }
  } catch (err) {
    console.warn(`[prisma-generate] Notice syncing ${src} -> ${dest}:`, err.message);
  }
}

function syncClientArtifacts() {
  const rootNodeModules = path.resolve(__dirname, '../../node_modules');
  const backendNodeModules = path.resolve(__dirname, '../node_modules');

  const rootPrisma = path.join(rootNodeModules, '.prisma');
  const rootClient = path.join(rootNodeModules, '@prisma', 'client');
  const backendPrisma = path.join(backendNodeModules, '.prisma');
  const backendClient = path.join(backendNodeModules, '@prisma', 'client');

  if (fs.existsSync(rootPrisma)) {
    console.log('[prisma-generate] Syncing generated .prisma to backend/node_modules/.prisma...');
    copyDirSafely(rootPrisma, backendPrisma);
  }
  if (fs.existsSync(rootClient)) {
    console.log('[prisma-generate] Syncing generated @prisma/client to backend/node_modules/@prisma/client...');
    copyDirSafely(rootClient, backendClient);
  }
}

function main() {
  const prismaCli = findPrismaCli();
  const schemaPath = findSchema();

  console.log(`[prisma-generate] Schema path: ${schemaPath}`);

  let cmd = process.execPath;
  let args = [];

  if (prismaCli) {
    console.log(`[prisma-generate] Using Prisma CLI at: ${prismaCli}`);
    args = [prismaCli, 'generate', `--schema=${schemaPath}`];
  } else {
    console.log('[prisma-generate] Using npx prisma');
    cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    args = ['prisma', 'generate', `--schema=${schemaPath}`];
  }

  const child = spawn(cmd, args, {
    stdio: 'inherit',
    env: process.env,
    shell: !prismaCli,
  });

  child.on('close', (code) => {
    if (code === 0) {
      syncClientArtifacts();
      console.log('[prisma-generate] ✅ Prisma client generated & synchronized successfully.');
      process.exit(0);
    } else {
      console.error(`[prisma-generate] ❌ Prisma generate exited with code ${code}`);
      process.exit(code || 1);
    }
  });

  child.on('error', (err) => {
    console.error('[prisma-generate] ❌ Spawn error:', err.message);
    process.exit(1);
  });
}

main();
