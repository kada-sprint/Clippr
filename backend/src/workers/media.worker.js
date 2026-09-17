const { Worker, UnrecoverableError } = require('bullmq');
const env = require('../config/env');
const repository = require('../models/processing-job.model');
const { createPipelineService } = require('../services/pipeline.service');
const { createConnection, createMediaQueue, dispatchPending } = require('../queues/media.queue');

function isTransient(error) {
  return [429, 502, 503, 504].includes(error.status) ||
    ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'EAI_AGAIN', 'P1001', 'P1002', 'P1017', 'P2034', 'LLM_TIMEOUT'].includes(error.code) ||
    error.name === 'TimeoutError';
}

function createProcessor({ jobs = repository, processJob = createPipelineService() } = {}) {
  return async (queued) => {
    if (queued.data.jobId !== queued.id) throw new UnrecoverableError('INVALID_JOB');
    let job = await jobs.claim(queued.id);
    if (!job) return;
    if (job.projectId !== queued.data.projectId || (job.clipId || undefined) !== queued.data.clipId || job.kind !== queued.name) {
      await jobs.fail(job.id, job.attemptToken, 'INVALID_JOB', true);
      throw new UnrecoverableError('INVALID_JOB');
    }
    const startedAt = Date.now();
    try {
      if (job.attempts > 3) throw new UnrecoverableError('ATTEMPTS_EXHAUSTED');
      await processJob(job);
      console.log(JSON.stringify({ jobId: job.id, projectId: job.projectId, status: 'completed', durationMs: Date.now() - startedAt }));
    } catch (error) {
      // STALE_ATTEMPT: BullMQ re-dispatched the job while the original worker was
      // still processing (e.g. during a long STT call). The claim() guard now
      // rejects re-claiming running jobs, so this happens when the original worker's
      // token is stale. Fail as non-terminal so BullMQ retries from the last checkpoint.
      const stale = error.code === 'STALE_ATTEMPT';
      const terminal = (stale ? false : !isTransient(error)) || job.attempts >= 3;
      const code = error.code || 'PROCESSING_FAILED';
      await jobs.fail(job.id, job.attemptToken, code, terminal);
      console.error(JSON.stringify({ jobId: job.id, projectId: job.projectId, code, terminal, durationMs: Date.now() - startedAt }));
      if (terminal) throw new UnrecoverableError(code);
      throw new Error(code);
    }
  };
}

async function startWorker() {
  // Fail startup clearly if the required migration/configuration is missing.
  await repository.listUnfinished();
  const producer = createConnection();
  const consumer = createConnection(true);
  const queue = createMediaQueue(producer);
  // Queue-wide limit protects FFmpeg even if a second worker is accidentally started.
  await queue.setGlobalConcurrency(1);
  const worker = new Worker('media', createProcessor(), {
    connection: consumer, prefix: env.queuePrefix, concurrency: 1, maxStalledCount: 2,
    lockDuration: 300_000,
    stalledInterval: 120_000,
  });
  worker.on('error', () => console.error('[Worker] Antrean terganggu; koneksi akan dicoba kembali.'));
  worker.on('failed', (job) => console.error(JSON.stringify({ jobId: job?.id, status: 'queue-failed' })));
  let dispatching;
  let stopping = false;
  function dispatch() {
    if (dispatching || stopping) return dispatching;
    dispatching = dispatchPending(queue, repository)
      .catch(() => console.error('[Worker] Pengiriman job tertunda; akan dicoba kembali.'))
      .finally(() => { dispatching = null; });
    return dispatching;
  }
  await dispatch();
  const timer = setInterval(dispatch, 5000);
  return async function close() {
    stopping = true;
    clearInterval(timer);
    await dispatching;
    await worker.close();
    await queue.close();
    producer.disconnect();
    consumer.disconnect();
  };
}

module.exports = { startWorker, createProcessor, isTransient };
