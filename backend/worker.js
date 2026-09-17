require('./src/config/env');
const { startWorker } = require('./src/workers/media.worker');
const { disconnectPrisma } = require('./src/config/prisma');
const { createRetentionService } = require('./src/services/retention.service');
const retentionRepository = require('./src/models/retention.model');
const env = require('./src/config/env');

const RETENTION_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const RETENTION_INITIAL_DELAY_MS = 60 * 1000; // 60 seconds after worker start

startWorker().then((close) => {
  console.log('Cuplik worker siap.');

  const retentionService = createRetentionService({
    repository: retentionRepository,
    mediaRoot: env.mediaRoot,
  });

  async function runRetention() {
    try {
      const results = await retentionService.runOnce();
      const cleaned = results.filter((r) => r.status === 'cleaned').length;
      const deferred = results.filter((r) => r.status === 'deferred').length;
      const failed = results.filter((r) => r.status === 'failed').length;
      if (results.length > 0) {
        console.log(`[Retention] Pembersihan selesai: ${cleaned} dibersihkan, ${deferred} ditunda, ${failed} gagal.`);
      }
    } catch (error) {
      console.error('[Retention] Pembersihan gagal:', error.message);
    }
  }

  setTimeout(() => {
    runRetention();
    const retentionTimer = setInterval(runRetention, RETENTION_INTERVAL_MS);

    let stopping = false;
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => {
      if (stopping) return;
      stopping = true;
      clearInterval(retentionTimer);
      await close();
      await disconnectPrisma();
    });
  }, RETENTION_INITIAL_DELAY_MS);
}).catch(async () => {
  console.error('Worker gagal dimulai. Periksa Redis, database, dan migrasi processing_jobs.');
  await disconnectPrisma();
  process.exit(1);
});
