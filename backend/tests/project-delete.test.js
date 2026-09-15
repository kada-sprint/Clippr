const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const os = require('node:os');
const { createProjectMediaCleanup } = require('../src/services/project-media-cleanup');
const { isProjectBusy } = require('../src/utils/project-status');
const prismaModule = require('../src/config/prisma');

let database;
prismaModule.getPrisma = () => database;
const projects = require('../src/models/project.model');
const uploads = require('../src/models/upload.model');
const clips = require('../src/models/clip.model');
const { createProjectService } = require('../src/services/project.service');

const id = '11111111-1111-4111-8111-111111111111';
const clipId = '22222222-2222-4222-8222-222222222222';
const userId = 'test-owner';
const seed = () => ({ id, userId, status: 'idle', processingStage: null, sourceVideoPath: null, transcriptJson: null, clips: [], _count: { clips: 0 } });

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

// Transaction double models row-lock serialization; no shared database writes.
function repositoryDatabase(row) {
  let tail = Promise.resolve();
  const events = [];
  const project = {
    findFirst: async ({ where }) => row && where.id === row.id && where.userId === row.userId ? structuredClone(row) : null,
    findMany: async ({ where, orderBy }) => {
      assert.deepEqual(orderBy, { createdAt: 'desc' });
      return row?.userId === where.userId ? [structuredClone(row)] : [];
    },
    updateMany: async ({ where, data }) => {
      if (!row || !Object.entries(where).every(([key, value]) => value?.not ? row[key] !== value.not : row[key] === value)) return { count: 0 };
      Object.assign(row, data);
      events.push('upload');
      return { count: 1 };
    },
    update: async ({ data }) => { Object.assign(row, data); events.push('deleting'); },
    delete: async () => { events.push('project'); row = null; },
  };
  const clip = {
    findFirst: async ({ where }) => {
      const found = row?.userId === where.project.userId && row.clips.find((item) => item.id === where.id);
      return found ? { ...structuredClone(found), project: { ...structuredClone(row), clips: undefined } } : null;
    },
    update: async ({ where, data }) => { Object.assign(row.clips.find((item) => item.id === where.id), data); events.push('render'); },
    deleteMany: async ({ where }) => { assert.equal(where.projectId, id); events.push('clips'); row.clips = []; },
  };
  database = {
    project, clip,
    async $transaction(action) {
      let release;
      let locked = false;
      const tx = {
        project, clip,
        processingJob: {
          findFirst: async () => row?.processingJobs?.find((job) => ['pending', 'running'].includes(job.status)) || null,
          create: async ({ data }) => { row.processingJobs = [...(row.processingJobs || []), { ...data, status: 'pending' }]; },
          deleteMany: async () => { row.processingJobs = []; },
        },
        llmCall: { deleteMany: async ({ where }) => { assert.equal(where.projectId, id); events.push('llmCalls'); } },
        async $queryRaw(strings, projectId, owner) {
          assert.match(strings.join('?'), /FOR UPDATE/);
          assert.equal(projectId, id);
          assert.equal(owner, userId);
          const previous = tail;
          tail = new Promise((done) => { release = done; });
          await previous;
          locked = true;
          events.push('lock');
          return row ? [{ id }] : [];
        },
      };
      try { return await action(tx); }
      finally { if (locked) release(); }
    },
  };
  return { events, row: () => row };
}

test('busy includes every active pipeline stage, transitional status and clip rendering', () => {
  for (const processingStage of ['ingest', 'transcribe', 'curate', 'analyze', 'render']) {
    assert.equal(isProjectBusy({ ...seed(), status: 'processing', processingStage }), true);
  }
  assert.equal(isProjectBusy({ ...seed(), status: 'TRANSCRIBED' }), true);
  assert.equal(isProjectBusy({ ...seed(), clips: [{ status: 'rendering' }] }), true);
  assert.equal(isProjectBusy({ ...seed(), status: 'unknown' }), true);
  assert.equal(isProjectBusy({ ...seed(), status: 'error', clips: [{ status: 'error' }] }), false);
  assert.equal(isProjectBusy({ ...seed(), clips: [{ status: 'pending' }] }), false);
});

test('list remains owner-scoped, newest-first and includes isBusy without private fields', async () => {
  repositoryDatabase({ ...seed(), sourceVideoPath: 'private.mp4', clips: [{ status: 'rendering' }] });
  const service = createProjectService();
  assert.deepEqual(await service.list('someone-else'), []);
  const [project] = await service.list(userId);
  assert.equal(project.isBusy, true);
  assert.equal('sourceVideoPath' in project, false);
  assert.equal('clips' in project, false);
});

test('nonactive completed and failed projects remove media before clips, logs and project', async () => {
  for (const status of ['idle', 'error']) {
    const db = repositoryDatabase({ ...seed(), status, transcriptJson: { words: [] }, clips: [{ id: clipId, status: 'rendered' }] });
    const result = await projects.deleteIfInactive(id, userId, async () => { db.events.push('media'); });
    assert.equal(result.state, 'deleted');
    assert.deepEqual(db.events, ['lock', 'deleting', 'lock', 'media', 'clips', 'llmCalls', 'project']);
    assert.equal(db.row(), null);
  }
});

test('busy and missing projects never reach media cleanup', async () => {
  repositoryDatabase({ ...seed(), clips: [{ id: clipId, status: 'rendering' }] });
  const cleanup = () => assert.fail('must not delete media');
  assert.equal((await projects.deleteIfInactive(id, userId, cleanup)).state, 'busy');
  repositoryDatabase(null);
  assert.equal((await projects.deleteIfInactive(id, userId, cleanup)).state, 'missing');
});

test('cleanup failure retains metadata and relationships for retry', async () => {
  const db = repositoryDatabase({ ...seed(), clips: [{ id: clipId, status: 'rendered' }] });
  await assert.rejects(projects.deleteIfInactive(id, userId, async () => { throw new Error('disk failure'); }), /disk failure/);
  assert.equal(db.row().clips.length, 1);
  assert.equal(db.row().status, 'deleting');
  assert.deepEqual(db.events, ['lock', 'deleting', 'lock']);
  assert.equal(await uploads.attachSource({ id, userId, sourceVideoPath: 'new.mp4' }), null);
  assert.equal((await uploads.markFailed(id, userId, 'curate')).count, 0);
  assert.equal(db.row().status, 'deleting');
  await assert.rejects(clips.claimRender(clipId, userId), { code: 'PROJECT_BUSY' });
  assert.equal((await projects.deleteIfInactive(id, userId, async () => {})).state, 'deleted');
});

test('delete holding the project lock wins against concurrent upload and render admission', async () => {
  const db = repositoryDatabase({ ...seed(), clips: [{ id: clipId, status: 'pending' }] });
  const entered = deferred();
  const proceed = deferred();
  const deletion = projects.deleteIfInactive(id, userId, async () => { entered.resolve(); await proceed.promise; });
  await entered.promise;
  const upload = uploads.attachSource({ id, userId, sourceVideoPath: 'source.mp4' });
  const render = clips.claimRender(clipId, userId);
  // Register rejection handling before releasing the shared lock.
  const renderRejected = assert.rejects(render, { code: 'CLIP_NOT_FOUND' });
  proceed.resolve();
  assert.equal((await deletion).state, 'deleted');
  assert.equal(await upload, null);
  await renderRejected;
  assert.equal(db.events.includes('render'), false);
  assert.equal(db.events.includes('upload'), false);
});

test('upload or render admitted first blocks deletion under the same lock', async () => {
  repositoryDatabase(seed());
  await uploads.attachSource({ id, userId, sourceVideoPath: 'source.mp4' });
  assert.equal((await projects.deleteIfInactive(id, userId, () => assert.fail())).state, 'busy');
  repositoryDatabase({ ...seed(), sourceVideoPath: 'source.mp4', clips: [{ id: clipId, status: 'pending' }] });
  await clips.claimRender(clipId, userId);
  assert.equal((await projects.deleteIfInactive(id, userId, () => assert.fail())).state, 'busy');
});

test('real isolated files: delete source, exports, and failed-render leftovers; retry missing files', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'clippr-delete-'));
  const sourceDir = path.join(root, 'uploads', 'videos');
  const clipDir = path.join(root, id, clipId);
  await fs.mkdir(sourceDir, { recursive: true });
  await fs.mkdir(clipDir, { recursive: true });
  const source = path.join(sourceDir, 'source.mp4');
  const vertical = path.join(clipDir, 'vertical.mp4');
  const srt = path.join(clipDir, 'export.srt');
  const ass = path.join(clipDir, '_subtitles_123.ass');
  await Promise.all([fs.writeFile(source, 'test'), fs.writeFile(vertical, 'test'), fs.writeFile(srt, 'test'), fs.writeFile(ass, 'test')]);
  const project = { ...seed(), sourceVideoPath: source, clips: [{ id: clipId, srtPath: path.relative(root, srt) }] };
  const cleanup = createProjectMediaCleanup({ mediaRoot: root });
  await cleanup(project);
  await cleanup(project);
  assert.deepEqual(await fs.readdir(sourceDir), []);
  assert.deepEqual(await fs.readdir(clipDir), []);
});

test('outside paths, cross-project paths and symlink ancestors fail before unlink', async () => {
  const root = path.resolve(os.tmpdir(), 'clippr-safe-root');
  let unlinks = 0;
  const files = {
    lstat: async () => ({ isSymbolicLink: () => true }),
    unlink: async () => { unlinks += 1; },
  };
  const cleanup = createProjectMediaCleanup({ mediaRoot: root, files });
  await assert.rejects(cleanup({ ...seed(), sourceVideoPath: path.resolve(root, '../private.mp4') }), { code: 'UNSAFE_MEDIA_PATH' });
  await assert.rejects(cleanup({ ...seed(), clips: [{ id: clipId, clipVideoPath: path.join('other-project', clipId, 'vertical.mp4') }] }), { code: 'UNSAFE_MEDIA_PATH' });
  await assert.rejects(cleanup({ ...seed(), sourceVideoPath: path.join(root, 'uploads/videos/source.mp4') }), { code: 'UNSAFE_MEDIA_PATH' });
  assert.equal(unlinks, 0);
});

test('partial filesystem failure reports retry and missing parents are harmless', async () => {
  const root = path.resolve(os.tmpdir(), 'clippr-partial-root');
  const files = {
    lstat: async (target) => ({ isSymbolicLink: () => false, isDirectory: () => !path.extname(target), isFile: () => Boolean(path.extname(target)) }),
    readdir: async () => [],
    unlink: async (target) => { if (target.endsWith('subtitled.mp4')) throw Object.assign(new Error('locked'), { code: 'EBUSY' }); },
  };
  const cleanup = createProjectMediaCleanup({ mediaRoot: root, files });
  await assert.rejects(cleanup({ ...seed(), clips: [{ id: clipId }] }), (error) => error.code === 'PROJECT_CLEANUP_FAILED' && error.message.includes('Sebagian media'));
  files.lstat = async () => { throw Object.assign(new Error('gone'), { code: 'ENOENT' }); };
  await cleanup({ ...seed(), clips: [{ id: clipId }] });
});
