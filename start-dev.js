const { spawn } = require('child_process');
const path = require('path');

const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';

console.log('\x1b[36m%s\x1b[0m', '============================================================');
console.log('\x1b[36m%s\x1b[0m', '        KRONOS AI WORK OPERATING SYSTEM - DEV RUNNER        ');
console.log('\x1b[36m%s\x1b[0m', '============================================================');
console.log('\x1b[32m%s\x1b[0m', ' -> Frontend Web App : http://localhost:3001 (or http://localhost:3000)');
console.log('\x1b[34m%s\x1b[0m', ' -> Backend API      : http://localhost:4000');
console.log('\x1b[36m%s\x1b[0m', '============================================================\n');

// 1. Backend (port 4000 + port 3000 redirector)
const backend = spawn(npmCmd, ['run', 'dev'], {
  cwd: path.resolve(__dirname, 'backend'),
  shell: true,
  stdio: 'pipe',
  env: { ...process.env },
});

backend.stdout.on('data', (data) => {
  process.stdout.write(`\x1b[34m[backend]\x1b[0m ${data.toString()}`);
});

backend.stderr.on('data', (data) => {
  process.stderr.write(`\x1b[31m[backend-err]\x1b[0m ${data.toString()}`);
});

// 2. Frontend (port 3001)
const frontend = spawn(npmCmd, ['run', 'dev'], {
  cwd: path.resolve(__dirname, 'frontend'),
  shell: true,
  stdio: 'pipe',
  env: { ...process.env, PORT: '3001' },
});

frontend.stdout.on('data', (data) => {
  process.stdout.write(`\x1b[32m[frontend]\x1b[0m ${data.toString()}`);
});

frontend.stderr.on('data', (data) => {
  process.stderr.write(`\x1b[33m[frontend-err]\x1b[0m ${data.toString()}`);
});

function cleanup() {
  console.log('\nShutting down KRONOS servers...');
  try {
    if (backend && !backend.killed) {
      if (isWin) {
        spawn('taskkill', ['/pid', backend.pid, '/f', '/t']);
      } else {
        backend.kill('SIGINT');
      }
    }
  } catch {}

  try {
    if (frontend && !frontend.killed) {
      if (isWin) {
        spawn('taskkill', ['/pid', frontend.pid, '/f', '/t']);
      } else {
        frontend.kill('SIGINT');
      }
    }
  } catch {}

  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);
