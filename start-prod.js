const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';

// The port exposed to the outside world (Render assigns PORT, default 3000)
const PUBLIC_PORT = process.env.PORT || '3000';
const BACKEND_INTERNAL_PORT = '4000';

console.log('============================================================');
console.log('       KRONOS SAAS - PRODUCTION FULL-STACK RUNNER           ');
console.log('============================================================');
console.log(` -> Frontend (Public Web) : Port ${PUBLIC_PORT}`);
console.log(` -> Backend (Internal API): Port ${BACKEND_INTERNAL_PORT}`);
console.log('============================================================\n');

// 1. Run database schema sync first
function runDbPush() {
  return new Promise((resolve) => {
    console.log('[start-prod] Synchronizing database schema with PostgreSQL...');
    const child = spawn(npmCmd, ['run', 'prisma:db:push'], {
      cwd: path.resolve(__dirname, 'backend'),
      shell: true,
      stdio: 'inherit',
      env: { ...process.env },
    });
    child.on('close', (code) => {
      if (code === 0) {
        console.log('[start-prod] ✅ Database schema sync successful.');
        resolve(true);
      } else {
        console.warn(`[start-prod] ⚠️ Database sync exited with code ${code}. Proceeding with startup.`);
        resolve(false);
      }
    });
    child.on('error', (err) => {
      console.warn(`[start-prod] ⚠️ Database sync error: ${err.message}. Proceeding.`);
      resolve(false);
    });
  });
}

function waitForBackend(url, timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve) => {
    const check = () => {
      http.get(url, (res) => {
        if (res.statusCode === 200) {
          console.log('[start-prod] ✅ Backend is healthy and ready.');
          resolve(true);
        } else {
          retry();
        }
      }).on('error', () => {
        retry();
      });
    };
    const retry = () => {
      if (Date.now() - start > timeoutMs) {
        console.warn('[start-prod] ⚠️ Backend healthcheck timed out. Starting frontend anyway.');
        resolve(false);
      } else {
        setTimeout(check, 1000);
      }
    };
    check();
  });
}

let backendProc = null;
let frontendProc = null;

function shutdown() {
  console.log('\n[start-prod] Shutting down services...');
  try {
    if (backendProc && !backendProc.killed) {
      if (isWin) spawn('taskkill', ['/pid', backendProc.pid, '/f', '/t']);
      else backendProc.kill('SIGTERM');
    }
  } catch {}
  try {
    if (frontendProc && !frontendProc.killed) {
      if (isWin) spawn('taskkill', ['/pid', frontendProc.pid, '/f', '/t']);
      else frontendProc.kill('SIGTERM');
    }
  } catch {}
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

async function start() {
  await runDbPush();

  // 2. Start Backend on port 4000
  console.log('[start-prod] Starting backend on internal port 4000...');
  backendProc = spawn(npmCmd, ['run', 'start'], {
    cwd: path.resolve(__dirname, 'backend'),
    shell: true,
    stdio: 'inherit',
    env: {
      ...process.env,
      PORT: BACKEND_INTERNAL_PORT,
      NODE_ENV: 'production',
    },
  });

  backendProc.on('exit', (code) => {
    console.error(`[start-prod] Backend process exited with code ${code}`);
    if (code !== 0 && code !== null) {
      shutdown();
    }
  });

  // 3. Wait for backend health
  await waitForBackend(`http://127.0.0.1:${BACKEND_INTERNAL_PORT}/api/health`, 30000);

  // 4. Start Frontend on PUBLIC_PORT with proxy pointed to internal backend
  console.log(`[start-prod] Starting Next.js frontend on public port ${PUBLIC_PORT}...`);
  frontendProc = spawn(npmCmd, ['run', 'start'], {
    cwd: path.resolve(__dirname, 'frontend'),
    shell: true,
    stdio: 'inherit',
    env: {
      ...process.env,
      PORT: PUBLIC_PORT,
      BACKEND_INTERNAL_URL: `http://127.0.0.1:${BACKEND_INTERNAL_PORT}`,
      NODE_ENV: 'production',
    },
  });

  frontendProc.on('exit', (code) => {
    console.error(`[start-prod] Frontend process exited with code ${code}`);
    if (code !== 0 && code !== null) {
      shutdown();
    }
  });
}

start();
