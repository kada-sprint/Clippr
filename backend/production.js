const env = require('./src/config/env');
const { createApp } = require('./src/app');
const { disconnectPrisma } = require('./src/config/prisma');
const { startWorkerRuntime } = require('./src/workers/worker-runtime');

async function startProduction() {
  if (!Number.isInteger(env.port) || env.port < 1 || env.port > 65535) {
    throw new Error('PORT harus berada pada rentang 1-65535.');
  }

  const closeWorker = await startWorkerRuntime();
  const server = createApp().listen(env.port, env.host, () => {
    console.log(`Cuplik API dan worker siap pada port ${env.port}.`);
  });
  server.timeout = 1800000;
  server.keepAliveTimeout = 1800000;

  let stopping = false;
  async function stop(exitCode = 0) {
    if (stopping) return;
    stopping = true;
    await new Promise((resolve) => server.close(resolve));
    await closeWorker();
    await disconnectPrisma();
    process.exit(exitCode);
  }

  server.on('error', (error) => {
    console.error('API gagal dijalankan:', error.message);
    stop(1);
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => stop(0));
}

startProduction().catch(async (error) => {
  console.error('Runtime production gagal dimulai:', error.message);
  await disconnectPrisma();
  process.exit(1);
});
