const { Queue } = require('bullmq');
const IORedis = require('ioredis');
const env = require('../config/env');

function createConnection(worker = false) {
  const connection = new IORedis(env.redisUrl, {
    maxRetriesPerRequest: worker ? null : 1,
    enableOfflineQueue: worker,
    connectTimeout: 3000,
    ...(worker ? {} : { commandTimeout: 3000 }),
  });
  connection.on('error', () => console.error('[Redis] Koneksi antrean tidak tersedia.'));
  return connection;
}

function createMediaQueue(connection) {
  return new Queue('media', {
    connection, prefix: env.queuePrefix,
    defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { age: 86400, count: 1000 }, removeOnFail: false },
  });
}

async function dispatchPending(queue, repository) {
  for (const record of await repository.listUnfinished()) {
    // Only re-dispatch jobs that were never picked up by BullMQ (pending status).
    // Running jobs are handled by BullMQ's built-in stall detection — re-dispatching
    // them creates a race condition where a new claim overwrites the attemptToken,
    // causing STALE_ATTEMPT errors in the original worker.
    if (record.status === 'running') continue;

    const existing = await queue.getJob(record.id);
    if (existing) {
      const state = await existing.getState();
      if (state === 'failed' || state === 'completed') {
        // DB completion is committed before BullMQ completion. A remaining active
        // record indicates a stalled job or lost DB finalization.
        await repository.fail(record.id, record.attemptToken, 'WORKER_INTERRUPTED', true);
      }
      continue;
    }
    await queue.add(record.kind, {
      jobId: record.id, projectId: record.projectId, ...(record.clipId ? { clipId: record.clipId } : {}),
    }, { jobId: record.id });
  }
}

module.exports = { createConnection, createMediaQueue, dispatchPending };
