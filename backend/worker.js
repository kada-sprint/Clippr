require('./src/config/env');
const { startWorkerRuntime } = require('./src/workers/worker-runtime');
const { disconnectPrisma } = require('./src/config/prisma');

startWorkerRuntime().then((close) => {
  console.log('Cuplik worker siap.');
  let stopping = false;
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => {
    if (stopping) return;
    stopping = true;
    await close();
    await disconnectPrisma();
    process.exit(0);
  });
}).catch(async () => {
  console.error('Worker gagal dimulai. Periksa Redis, database, dan migrasi processing_jobs.');
  await disconnectPrisma();
  process.exit(1);
});
