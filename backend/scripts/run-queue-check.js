const path = require('node:path');
const { spawnSync } = require('node:child_process');

// Fixed disposable local target. Never inherit DATABASE_URL from .env or shell.
const environment = { ...process.env,
  DATABASE_URL: 'postgresql://cuplik_test:local_test_only@127.0.0.1:15432/cuplik_queue_test',
  REDIS_URL: 'redis://127.0.0.1:16379', QUEUE_INTEGRATION: '1',
};
const root = path.resolve(__dirname, '..');
for (const args of [
  [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'],
  ['--test', 'tests/queue.integration.test.js'],
]) {
  const result = spawnSync(process.execPath, args, { cwd: root, env: environment, stdio: 'inherit' });
  if (result.status !== 0) { process.exitCode = result.status || 1; break; }
}
