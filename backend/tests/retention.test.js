const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { createRetentionService } = require('../src/services/retention.service');

const uploadedAt = new Date('2026-09-13T00:00:00Z');
const expiry = new Date('2026-09-14T00:00:00Z');

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cuplik-retention-'));
  const source = path.join(root, 'source.mp4');
  const mp4 = path.join(root, 'clip.mp4');
  const srt = path.join(root, 'clip.srt');
  await Promise.all([fs.writeFile(source, 'source'), fs.writeFile(mp4, 'export'), fs.writeFile(srt, 'subtitle')]);
  async function remove(file) {
    try { await fs.unlink(file); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  t.after(async () => {
    await remove(source);
    await remove(mp4);
    await remove(srt);
    await fs.rmdir(root);
  });
  const rows = [
    { id: 'project', kind: 'source', path: source, expiresAt: expiry },
    { id: 'clip', kind: 'mp4', path: mp4, expiresAt: new Date(expiry.getTime() + 3600000) },
    { id: 'clip', kind: 'srt', path: srt, expiresAt: new Date(expiry.getTime() + 3600000) },
  ];
  for (const row of rows) {
    Object.assign(row, { title: 'Webinar', transcriptJson: [{ word: 'Halo' }], lastEditActivityAt: uploadedAt });
  }
  const state = { now: new Date(expiry.getTime() - 1), active: false, held: false, failClear: false };
  const repository = {
    async listExpired(now) {
      return rows.filter((row) => row.path && row.expiresAt <= now).map((row) => ({ ...row }));
    },
    async withCleanupClaim(candidate, now, callback) {
      if (state.active || state.held) return;
      state.held = true;
      try {
        const row = rows.find((item) => item.id === candidate.id && item.kind === candidate.kind);
        await callback({
          media: { ...row },
          clearPath: async () => {
            assert.equal(state.held, true);
            if (state.failClear) throw new Error('private database detail');
            row.path = null;
          },
        });
      } finally {
        state.held = false;
      }
    },
  };
  const options = { repository, mediaRoot: root, clock: () => state.now };
  return { root, source, mp4, srt, rows, state, repository, options,
    service: createRetentionService(options) };
}

test('source expires at 24h; later MP4/SRT expire independently, preserving metadata and transcript', async (t) => {
  const f = await fixture(t);
  const expectedRows = structuredClone(f.rows).map((row) => ({ ...row, path: null }));
  assert.deepEqual(await f.service.runOnce(), []);
  assert.equal(await fs.readFile(f.source, 'utf8'), 'source');
  f.state.now = expiry;
  assert.deepEqual(await f.service.runOnce(), [{ id: 'project', kind: 'source', status: 'cleaned' }]);
  await assert.rejects(fs.stat(f.source), { code: 'ENOENT' });
  assert.equal(f.rows[0].path, null);
  assert.equal(await fs.readFile(f.mp4, 'utf8'), 'export');
  f.state.now = new Date(expiry.getTime() + 3600000);
  assert.equal((await f.service.runOnce()).filter((result) => result.status === 'cleaned').length, 2);
  assert.ok(f.rows.every((row) => row.path === null));
  assert.deepEqual(f.rows, expectedRows);
  assert.equal(f.rows[0].expiresAt.getTime() - uploadedAt.getTime(), 86400000);
  assert.deepEqual(await f.service.runOnce(), []);
});

test('queued/active media remain until the exclusive claim becomes available', async (t) => {
  const f = await fixture(t);
  f.state.now = expiry;
  f.state.active = true;
  assert.equal((await f.service.runOnce())[0].status, 'deferred');
  assert.equal(await fs.readFile(f.source, 'utf8'), 'source');
  f.state.active = false;
  assert.equal((await f.service.runOnce())[0].status, 'cleaned');
});

test('a fresh snapshot prevents cleanup after a source re-upload extends expiry', async (t) => {
  const f = await fixture(t);
  f.state.now = expiry;
  const list = f.repository.listExpired;
  f.repository.listExpired = async (now) => {
    const candidates = await list(now);
    f.rows[0].expiresAt = new Date(now.getTime() + 86400000);
    return candidates;
  };
  assert.equal((await f.service.runOnce())[0].status, 'deferred');
  assert.equal(await fs.readFile(f.source, 'utf8'), 'source');
});

test('a missing file clears its stale path and repeated cleanup is harmless', async (t) => {
  const f = await fixture(t);
  await fs.unlink(f.source);
  f.state.now = expiry;
  assert.equal((await f.service.runOnce())[0].status, 'missing');
  assert.equal(f.rows[0].path, null);
  assert.deepEqual(await f.service.runOnce(), []);
});

test('unlink failure preserves the path and does not stop other expired exports', async (t) => {
  const f = await fixture(t);
  f.state.now = new Date(expiry.getTime() + 3600000);
  const service = createRetentionService({ ...f.options, files: { ...fs, unlink: async (file) => {
    if (file === f.source) throw Object.assign(new Error('private path'), { code: 'EACCES' });
    return fs.unlink(file);
  } } });
  const results = await service.runOnce();
  assert.deepEqual(results.map((result) => result.status), ['failed', 'cleaned', 'cleaned']);
  assert.doesNotMatch(JSON.stringify(results), /private|EACCES/);
  assert.equal(f.rows[0].path, f.source);
});

test('database failure after unlink keeps the path for safe retry of the missing file', async (t) => {
  const f = await fixture(t);
  f.state.now = expiry;
  f.state.failClear = true;
  assert.equal((await f.service.runOnce())[0].status, 'failed');
  assert.equal(f.rows[0].path, f.source);
  f.state.failClear = false;
  assert.equal((await f.service.runOnce())[0].status, 'missing');
  assert.equal(f.rows[0].path, null);
});

test('external, traversal, relative, root, and unsupported paths are never removed or cleared', async (t) => {
  const f = await fixture(t);
  f.state.now = expiry;
  for (const unsafe of [path.join(`${f.root}-other`, 'source.mp4'), path.join(f.root, '..', 'source.mp4'),
    'source.mp4', f.root, path.join(f.root, 'secret.txt')]) {
    f.rows[0].path = unsafe;
    const result = (await f.service.runOnce())[0];
    assert.equal(result.code, 'UNSAFE_MEDIA_PATH');
    assert.equal(f.rows[0].path, unsafe);
  }
  assert.equal(await fs.readFile(f.source, 'utf8'), 'source');
});

test('resolved target escape and symlink files fail closed before unlink', async (t) => {
  const f = await fixture(t);
  f.state.now = expiry;
  for (const files of [
    { ...fs, lstat: async () => ({ isFile: () => false, isSymbolicLink: () => true }) },
    { ...fs, realpath: async (target) => target === f.source ? path.join(path.dirname(f.root), 'external.mp4') : fs.realpath(target) },
  ]) {
    const result = await createRetentionService({ ...f.options, files }).runOnce();
    assert.equal(result[0].code, 'UNSAFE_MEDIA_PATH');
    assert.equal(f.rows[0].path, f.source);
  }
});

test('a parent junction escaping the media root cannot authorize deletion or clearing', async (t) => {
  const f = await fixture(t);
  f.state.now = expiry;
  const parent = path.join(f.root, 'junction');
  f.rows[0].path = path.join(parent, 'source.mp4');
  const files = { ...fs, realpath: async (target) => target === parent ? path.dirname(f.root) : fs.realpath(target) };
  assert.equal((await createRetentionService({ ...f.options, files }).runOnce())[0].code, 'UNSAFE_MEDIA_PATH');
  assert.equal(f.rows[0].path, path.join(parent, 'source.mp4'));
});

test('missing clearPath capability fails before a file can be removed', async (t) => {
  const f = await fixture(t);
  f.state.now = expiry;
  f.repository.withCleanupClaim = async (candidate, now, callback) => callback({ media: candidate });
  assert.equal((await f.service.runOnce())[0].status, 'failed');
  assert.equal(await fs.readFile(f.source, 'utf8'), 'source');
});

test('simultaneous cleanup runs retain the claim through unlink and path clearing', async (t) => {
  const f = await fixture(t);
  f.state.now = expiry;
  let release;
  let entered;
  const started = new Promise((resolve) => { entered = resolve; });
  const gate = new Promise((resolve) => { release = resolve; });
  let removals = 0;
  const service = createRetentionService({ ...f.options, files: { ...fs, unlink: async (file) => {
    assert.equal(f.state.held, true);
    entered();
    await gate;
    removals += 1;
    return fs.unlink(file);
  } } });
  const first = service.runOnce();
  await started;
  assert.equal((await service.runOnce())[0].status, 'deferred');
  release();
  assert.equal((await first)[0].status, 'cleaned');
  assert.equal(removals, 1);
});

test('retention cannot be constructed without an explicit exclusive-claim repository', () => {
  assert.throws(() => createRetentionService({ repository: { listExpired() {} }, mediaRoot: os.tmpdir() }), TypeError);
});
