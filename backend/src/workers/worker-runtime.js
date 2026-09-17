const { startWorker } = require('./media.worker');
const { createRetentionService } = require('../services/retention.service');
const retentionRepository = require('../models/retention.model');
const env = require('../config/env');

const RETENTION_INTERVAL_MS = 30 * 60 * 1000;
const RETENTION_INITIAL_DELAY_MS = 60 * 1000;

async function startWorkerRuntime({
  startMediaWorker = startWorker,
  createRetention = createRetentionService,
  repository = retentionRepository,
  mediaRoot = env.mediaRoot,
  initialDelayMs = RETENTION_INITIAL_DELAY_MS,
  intervalMs = RETENTION_INTERVAL_MS,
  setTimeoutFn = setTimeout,
  setIntervalFn = setInterval,
  clearTimeoutFn = clearTimeout,
  clearIntervalFn = clearInterval,
} = {}) {
  const closeWorker = await startMediaWorker();
  const retention = createRetention({ repository, mediaRoot });
  let interval;
  let closing;

  async function runRetention() {
    try {
      const results = await retention.runOnce();
      const cleaned = results.filter((result) => result.status === 'cleaned').length;
      const deferred = results.filter((result) => result.status === 'deferred').length;
      const failed = results.filter((result) => result.status === 'failed').length;
      if (results.length > 0) {
        console.log(`[Retention] Pembersihan selesai: ${cleaned} dibersihkan, ${deferred} ditunda, ${failed} gagal.`);
      }
    } catch (error) {
      console.error('[Retention] Pembersihan gagal:', error.message);
    }
  }

  const initialTimer = setTimeoutFn(() => {
    runRetention();
    interval = setIntervalFn(runRetention, intervalMs);
  }, initialDelayMs);

  return async function close() {
    if (closing) return closing;
    closing = (async () => {
      clearTimeoutFn(initialTimer);
      if (interval) clearIntervalFn(interval);
      await closeWorker();
    })();
    return closing;
  };
}

module.exports = {
  startWorkerRuntime,
  RETENTION_INTERVAL_MS,
  RETENTION_INITIAL_DELAY_MS,
};
