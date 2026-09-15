// Real providers/media, isolated PostgreSQL + Redis. Never uses the shared DB.
const path = require('node:path');
const fs = require('node:fs/promises');
const { randomUUID } = require('node:crypto');
const { fork, execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { setTimeout: delay } = require('node:timers/promises');

process.env.DATABASE_URL = 'postgresql://cuplik_test:local_test_only@127.0.0.1:15432/cuplik_queue_test';
process.env.REDIS_URL = 'redis://127.0.0.1:16379';
const env = require('../src/config/env');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
require('../src/config/prisma').getPrisma = () => prisma;

async function main() {
  if (process.argv[2] === '--worker') {
    const { startWorker } = require('../src/workers/media.worker');
    const close = await startWorker();
    process.send?.('ready');
    process.once('message', async (message) => {
      if (message === 'close') { await close(); await prisma.$disconnect(); process.disconnect(); }
    });
    return;
  }
  if (!process.argv[2]) throw new Error('Pass a source video path. This check calls configured ASR/LLM providers.');
  if (!env.eliceApiKey || !env.llmApiKey) throw new Error('ASR/LLM credentials required');
  if (await prisma.processingJob.count({ where: { status: { in: ['pending', 'running'] } } })) {
    throw new Error('Isolated database has unfinished jobs; inspect before starting another live check.');
  }
  const source = path.resolve(process.argv[2]);
  await fs.access(source);
  const runId = randomUUID();
  process.env.QUEUE_PREFIX = `cuplik-live-${runId}`;
  const output = path.resolve(__dirname, '../uploads/verification/live-queue', runId);
  await fs.mkdir(output, { recursive: true });
  const sample = path.resolve(__dirname, '../uploads/videos', `live-source-${runId}.mp4`);
  await promisify(execFile)(env.ffmpegPath || require('ffmpeg-static'), [
    '-v', 'error', '-ss', '300', '-i', source, '-t', '360', '-c', 'copy', sample,
  ], { timeout: 60000, windowsHide: true });
  const userId = `live-queue-check-${runId}`;
  await prisma.user.create({ data: { id: userId, email: `${userId}@example.invalid`, displayName: 'Isolated live queue check' } });
  const { createUploadService } = require('../src/services/upload.service');
  const acceptedAt = Date.now();
  const project = await createUploadService().directUpload({ userId, file: { path: sample }, selectedLayout: 'slide-only', customVocabulary: '' });
  const job = await prisma.processingJob.findFirst({ where: { projectId: project.id } });
  const report = { runId, projectId: project.id, jobId: job.id, queuePrefix: process.env.QUEUE_PREFIX,
    database: 'cuplik_queue_test', providers: 'real', browser: false, sourceStartSeconds: 300,
    sourceSampleSeconds: 360, admissionMs: Date.now() - acceptedAt };
  await fs.writeFile(path.join(output, 'result.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ event: 'accepted', ...report }));
  const child = fork(__filename, ['--worker'], { env: process.env, stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
  const startedAt = Date.now();
  let previous;
  try {
    for (;;) {
      const current = await prisma.processingJob.findUnique({ where: { id: job.id }, include: { project: { include: { clips: true } } } });
      const state = JSON.stringify({ status: current.status, stage: current.project.processingStage, checkpoint: current.checkpoint,
        clips: current.project.clips.map((clip) => clip.status) });
      if (state !== previous) { console.log(state); previous = state; }
      if (['completed', 'failed'].includes(current.status)) {
        report.status = current.status; report.errorCode = current.errorCode; report.elapsedMs = Date.now() - startedAt;
        report.transcriptWords = current.project.transcriptJson?.words?.length || 0;
        const { getVideoMetadata } = require('../src/utils/ffprobeUtils');
        report.clips = [];
        for (const clip of current.project.clips) {
          const metadata = clip.subtitledVideoPath ? await getVideoMetadata(clip.subtitledVideoPath) : null;
          const srt = clip.srtPath ? await fs.readFile(clip.srtPath, 'utf8') : '';
          report.clips.push({ id: clip.id, status: clip.status, title: clip.title,
            plannedDuration: Number(clip.endTime) - Number(clip.startTime), metadata,
            mp4: clip.subtitledVideoPath, srt: clip.srtPath, srtValid: srt.includes('-->'),
            retentionHours: clip.renderedAt && (clip.exportExpiresAt - clip.renderedAt) / 3600000 });
        }
        await fs.writeFile(path.join(output, 'result.json'), JSON.stringify(report, null, 2));
        console.log(JSON.stringify({ event: 'result', ...report }));
        if (report.status !== 'completed') process.exitCode = 1;
        break;
      }
      if (child.exitCode !== null) throw new Error('Live worker exited before completion');
      if (Date.now() - startedAt > 30 * 60 * 1000) throw new Error('Live check exceeded 30 minutes');
      await delay(5000);
    }
  } finally {
    if (child.connected) child.send('close');
    await prisma.$disconnect();
  }
}

main().catch(async (error) => { console.error(error.code || error.message); process.exitCode = 1; await prisma.$disconnect(); });
