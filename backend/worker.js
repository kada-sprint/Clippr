require('./src/config/env');
const { startWorker } = require('./src/workers/media.worker');
const { disconnectPrisma } = require('./src/config/prisma');

startWorker().then((close) => {
  console.log('Cuplik worker siap.');
  let stopping = false;
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => {
    if (stopping) return;
    stopping = true;
    await close();
    await disconnectPrisma();
  });
}).catch(async () => {
  console.error('Worker gagal dimulai. Periksa Redis, database, dan migrasi processing_jobs.');
  await disconnectPrisma();
  process.exit(1);
});
