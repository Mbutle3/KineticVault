import { spawnSync } from 'node:child_process';
import { platform } from 'node:os';
import process from 'node:process';

const isWin = platform() === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, {
    stdio: 'inherit',
    shell: false,
    ...opts,
  });
  if (res.status !== 0) {
    process.exit(res.status ?? 1);
  }
}

function pickPython() {
  const candidates = ['python3', 'python'];
  for (const c of candidates) {
    const r = spawnSync(c, ['--version'], { stdio: 'ignore' });
    if (r.status === 0) return c;
  }
  return null;
}

console.log('== Kinetic Vault demo bootstrap ==');
console.log('This installs deps and starts the MOCK UI (no FastAPI).');
console.log('');

console.log('');
console.log('-- Installing root JS deps');
run(npmCmd, ['install']);

console.log('');
console.log('-- Installing client JS deps');
run(npmCmd, ['install'], { cwd: 'client' });

console.log('');
console.log('-- Starting MOCK UI only (Ctrl+C to stop)');
console.log('This mode does NOT start FastAPI and does NOT touch your filesystem.');
console.log('Tip: for the real app, set KV_API_TOKEN in server/.env and run: npm run dev');
console.log('');
run(npmCmd, ['run', 'dev:web'], {
  env: { ...process.env, VITE_MOCK_MODE: '1' },
});

