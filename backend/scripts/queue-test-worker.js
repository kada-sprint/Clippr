// Child-process fixture for isolated integration tests. No real provider calls.
const { PrismaClient } = require('@prisma/client');
const fs = require('node:fs/promises');
const { Worker } = require('bullmq');
const IORedis = require('ioredis');

async function main() {
  if (process.env.QUEUE_INTEGRATION !== '1' ||
      process.env.DATABASE_URL !== 'postgresql://cuplik_test:local_test_only@127.0.0.1:15432/cuplik_queue_test' ||
      process.env.REDIS_URL !== 'redis://127.0.0.1:16379') throw new Error('Isolated test target required');
  const prisma = new PrismaClient();
  require('../src/config/prisma').getPrisma = () => prisma;
  const { createPipelineService } = require('../src/services/pipeline.service');
  const { curateClips } = require('../src/services/curation.service');
  const { createProcessor } = require('../src/workers/media.worker');
  const connection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
  const notify = (event, extra = {}) => process.send?.({ event, ...extra });
  const processJob = createPipelineService({
    files: { access: fs.access, unlink: async () => {} },
    extract: async (source) => { notify('extract'); return source; },
    transcribe: async () => {
      notify('transcribe');
      return { duration: 100, words: Array.from({ length: 100 }, (_, i) => ({ word: 'materi', start_time: i, end_time: i + 0.9, confidence: 1 })) };
    },
    curate: (id, transcript, options) => {
      notify('curate');
      return curateClips(id, transcript, { ...options, callLlm: async () => JSON.stringify({ segments: [0, 30, 60].map((start) => ({
        start_time_seconds: start, end_time_seconds: start + 25, duration: 25,
        concept_score: 85, suggested_title: 'Konsep pendidikan', pedagogical_reason: 'Penjelasan konsep lengkap.',
      })) }) });
    },
    render: async (project, clip) => {
      notify('render', { clipId: clip.id });
      if (process.env.TEST_INTERRUPT_RENDER === '1') await new Promise(() => {});
      const now = new Date();
      return { status: 'rendered', renderedAt: now, exportExpiresAt: new Date(now.getTime() + 86400000) };
    },
  });
  const worker = new Worker('media', createProcessor({ processJob }), {
    connection, prefix: process.env.QUEUE_PREFIX, concurrency: 1,
    lockDuration: 1000, stalledInterval: 1000, maxStalledCount: 2,
  });
  worker.on('error', () => notify('worker-error'));
  worker.on('failed', () => notify('failed'));
  await worker.waitUntilReady();
  notify('ready');
  process.on('message', async (message) => {
    if (message === 'close') {
      await worker.close();
      connection.disconnect();
      await prisma.$disconnect();
      process.disconnect();
    }
  });
}
main().catch((error) => { console.error(error.code || error.message); process.exit(1); });
