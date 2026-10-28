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
      console.log('[prisma-generate] ✅ Prisma client generated successfully.');
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
