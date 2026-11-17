#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));

function findBinary(name) {
  const result = spawnSync('which', [name], { encoding: 'utf8' });
  if (result.status === 0 && result.stdout.trim()) {
    return result.stdout.trim();
  }
  // Common installation directories if not in default PATH
  const common = [
    `/home/ai/.local/bin/${name}`,
    `/usr/lib/postgresql/17/bin/${name}`,
    `/usr/lib/postgresql/16/bin/${name}`,
    `/usr/local/bin/${name}`,
    `/usr/bin/${name}`
  ];
  for (const candidate of common) {
    const check = spawnSync('test', ['-x', candidate]);
    if (check.status === 0) return candidate;
  }
  return null;
}

const initdb = findBinary('initdb');
const pg_ctl = findBinary('pg_ctl');

if (!initdb || !pg_ctl) {
  console.error('ERROR: PostgreSQL binaries (initdb, pg_ctl) not found in PATH or standard locations.');
  console.error('TraceMigo real database tests require PostgreSQL 17 to execute without mocks.');
  process.exit(1);
}

let base = null;
let started = false;

async function cleanup() {
  if (started && base) {
    const data = path.join(base, 'data');
    try {
      spawnSync(pg_ctl, ['-D', data, '-m', 'fast', '-w', 'stop'], { stdio: 'ignore' });
      const status = spawnSync(pg_ctl, ['-D', data, 'status'], { stdio: 'ignore' });
      if (status.status !== 3) {
        // Fallback kill if fast stop did not exit
        const postmasterPidFile = path.join(data, 'postmaster.pid');
        try {
          const { readFileSync } = await import('node:fs');
          const pid = Number(readFileSync(postmasterPidFile, 'utf8').split('\n')[0]);
          if (pid > 1) process.kill(pid, 'SIGKILL');
        } catch {
          // Process already gone
        }
      }
    } catch {
      // Ignore stop errors during cleanup
    }
    started = false;
  }
  if (base) {
    try {
      await rm(base, { recursive: true, force: true });
    } catch {
      // Ignore directory removal errors
    }
  }
}

process.on('SIGINT', async () => {
  await cleanup();
  process.exit(130);
});

process.on('SIGTERM', async () => {
  await cleanup();
  process.exit(143);
});

try {
  base = await mkdtemp('/tmp/tracemigo-pg17-');
  const data = path.join(base, 'data');
  const socket = path.join(base, 'socket');
  await mkdir(socket, { mode: 0o700 });

  // 1. Initialize fresh temporary cluster
  const initResult = spawnSync(initdb, [
    '-D', data,
    '-U', 'tracemigo_bootstrap',
    '--no-locale',
    '--encoding=UTF8',
    '--auth-local=trust',
    '--auth-host=reject'
  ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

  if (initResult.status !== 0) {
    console.error('initdb failed:', initResult.stderr || initResult.stdout);
    process.exit(initResult.status ?? 1);
  }

  // 2. Start PostgreSQL strictly bound to the private Unix socket (no TCP listening)
  const logFile = path.join(base, 'postgres.log');
  const startResult = spawnSync(pg_ctl, [
    '-D', data,
    '-l', logFile,
    '-o', `-k "${socket}" -p 55432 -c listen_addresses='' -c unix_socket_permissions=0700`,
    '-w', 'start'
  ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

  if (startResult.status !== 0) {
    console.error('pg_ctl start failed:', startResult.stderr || startResult.stdout);
    try {
      const { readFileSync } = await import('node:fs');
      console.error(readFileSync(logFile, 'utf8'));
    } catch {}
    process.exit(startResult.status ?? 1);
  }

  started = true;

  // 3. Run integration tests against the private disposable cluster
  const testEnv = {
    ...process.env,
    TRACEMIGO_TEST_PG_SOCKET: socket,
    TRACEMIGO_TEST_PG_PORT: '55432',
    TRACEMIGO_TEST_PG_ADMIN: 'tracemigo_bootstrap'
  };

  const scriptToRun = process.argv[2]
    ? path.resolve(root, process.argv[2])
    : path.join(root, 'tools/db/integration.test.mjs');

  const testProcess = spawn(process.execPath, [scriptToRun], {
    cwd: root,
    env: testEnv,
    stdio: 'inherit'
  });

  const exitCode = await new Promise((resolve) => {
    testProcess.on('exit', (code) => resolve(code ?? 0));
    testProcess.on('error', (err) => {
      console.error('Failed to spawn integration tests:', err);
      resolve(1);
    });
  });

  await cleanup();
  process.exit(exitCode);
} catch (error) {
  console.error('Unexpected error in disposable PostgreSQL runner:', error);
  await cleanup();
  process.exit(1);
}
