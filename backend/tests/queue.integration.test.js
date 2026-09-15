const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { fork } = require('node:child_process');
const { once } = require('node:events');
const { setTimeout: delay } = require('node:timers/promises');

test('real PostgreSQL + Redis + child worker: admission, crash recovery, fencing and selective render', {
  skip: process.env.QUEUE_INTEGRATION !== '1', timeout: 60000,
}, async (t) => {
  assert.equal(process.env.DATABASE_URL, 'postgresql://cuplik_test:local_test_only@127.0.0.1:15432/cuplik_queue_test');
  assert.equal(process.env.REDIS_URL, 'redis://127.0.0.1:16379');
  process.env.QUEUE_PREFIX = `cuplik-test-${randomUUID()}`;
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  require('../src/config/prisma').getPrisma = () => prisma;
  const jobs = require('../src/models/processing-job.model');
  const uploads = require('../src/models/upload.model');
  const clips = require('../src/models/clip.model');
  const projects = require('../src/models/project.model');
  const { createConnection, createMediaQueue, dispatchPending } = require('../src/queues/media.queue');
  const connection = createConnection();
  const queue = createMediaQueue(connection);
  await queue.waitUntilReady();
  const children = [];
  t.after(async () => {
    for (const child of children) {
      if (child.exitCode === null && !child.killed) {
        const exited = once(child, 'exit');
        child.kill();
        await exited;
      }
    }
    await queue.close(); connection.disconnect(); await prisma.$disconnect();
  });
  async function until(read, predicate) {
    for (let i = 0; i < 250; i++) {
      const value = await read();
      if (predicate(value)) return value;
      await delay(100);
    }
    assert.fail('Timed out waiting for test state');
  }
  function start(interrupt = false) {
    const child = fork(path.resolve(__dirname, '../scripts/queue-test-worker.js'), [], {
      env: { ...process.env, TEST_INTERRUPT_RENDER: interrupt ? '1' : '0' }, silent: true,
    });
    child.messages = [];
    child.errors = '';
    child.on('message', (message) => child.messages.push(message));
    child.stderr.on('data', (chunk) => { child.errors += chunk; });
    child.stdout.resume();
    children.push(child);
    return child;
  }
  const userId = `queue-test-${randomUUID()}`;
  await prisma.user.create({ data: { id: userId, email: 'queue-test@example.invalid', displayName: 'Queue test' } });
  const project = await prisma.project.create({ data: { userId } });
  const source = path.resolve(__dirname, 'fixtures/sample_talking_head.mp4');
  const originalCreate = jobs.create;
  try {
    jobs.create = async () => { throw new Error('simulated job persistence failure'); };
    await assert.rejects(uploads.attachSource({ id: project.id, userId, sourceVideoPath: source }), /persistence failure/);
    const rolledBack = await prisma.project.findUnique({ where: { id: project.id } });
    assert.equal(rolledBack.status, 'idle');
    assert.equal(rolledBack.sourceVideoPath, null);
  } finally { jobs.create = originalCreate; }
  const accepted = await uploads.attachSource({ id: project.id, userId, sourceVideoPath: source, selectedLayout: 'talking-head', customVocabulary: '' });
  assert.equal(accepted.status, 'processing');
  const [job] = await prisma.processingJob.findMany({ where: { projectId: project.id } });
  assert.equal(job.status, 'pending');
  assert.equal(await queue.getJob(job.id), undefined);
  assert.equal((await projects.deleteIfInactive(project.id, userId, () => assert.fail())).state, 'busy');
  assert.equal(await uploads.findUploadTarget(project.id, 'other-user'), null);

  // Simulate API exit after DB commit: no producer call until the dispatcher runs.
  const ownJobs = { ...jobs, listUnfinished: () => prisma.processingJob.findMany({ where: { projectId: project.id, status: { in: jobs.activeStatuses } } }) };
  await dispatchPending(queue, ownJobs);
  await dispatchPending(queue, ownJobs);
  assert.equal(await queue.getWaitingCount(), 1);

  const first = start(true);
  await until(async () => first.messages, (messages) => messages.some((message) => message.event === 'render'));
  const active = await prisma.processingJob.findUnique({ where: { id: job.id } });
  assert.equal(active.checkpoint, 'analyze');
  const firstClips = await prisma.clip.findMany({ where: { projectId: project.id }, orderBy: { id: 'asc' } });
  assert.equal(firstClips.length, 3);
  await assert.rejects(clips.claimRender(firstClips[0].id, 'other-user'), { code: 'CLIP_NOT_FOUND' });
  await assert.rejects(clips.claimRender(firstClips[0].id, userId), { code: 'PROJECT_BUSY' });
  await assert.rejects(clips.updateIfInactive(firstClips[0].id, userId, { title: 'changed' }), { code: 'PROJECT_BUSY' });
  const stopped = once(first, 'exit'); first.kill(); await stopped;

  const second = start();
  await until(() => prisma.processingJob.findUnique({ where: { id: job.id } }), (row) => row.status === 'completed');
  assert.equal(second.messages.some((message) => ['extract', 'transcribe', 'curate'].includes(message.event)), false);
  assert.equal(await prisma.clip.count({ where: { projectId: project.id } }), 3);
  await assert.rejects(jobs.guarded(job.id, active.attemptToken, () => assert.fail()), { code: 'STALE_ATTEMPT' });
  const completed = await prisma.project.findUnique({ where: { id: project.id } });
  assert.equal(completed.status, 'idle');
  assert.equal(completed.processingStage, null);
  assert.equal(completed.sourceExpiresAt.getTime(), accepted.sourceExpiresAt.getTime());

  const before = await prisma.clip.findMany({ where: { projectId: project.id }, orderBy: { id: 'asc' } });
  await clips.claimRender(before[0].id, userId);
  const rerender = await prisma.processingJob.findFirst({ where: { projectId: project.id, kind: 'render-clip' } });
  second.messages.length = 0;
  await dispatchPending(queue, ownJobs);
  await until(() => prisma.processingJob.findUnique({ where: { id: rerender.id } }), (row) => row.status === 'completed');
  assert.deepEqual(second.messages.filter((message) => message.event === 'render').map((message) => message.clipId), [before[0].id]);
  const after = await prisma.clip.findMany({ where: { projectId: project.id }, orderBy: { id: 'asc' } });
  assert.deepEqual(after.slice(1), before.slice(1));

  const closed = once(second, 'exit'); second.send('close'); await closed;
  assert.equal((await projects.deleteIfInactive(project.id, userId, async () => {})).state, 'deleted');
  assert.equal(await prisma.processingJob.count({ where: { projectId: project.id } }), 0);
  await prisma.user.delete({ where: { id: userId } });
});
