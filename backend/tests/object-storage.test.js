const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');
const { createObjectStorage, validateObjectKey, readConfig } = require('../src/services/object-storage.service');

const config = {
  r2AccountId: 'account-id',
  r2AccessKeyId: 'access-key',
  r2SecretAccessKey: 'secret-key',
  r2Bucket: 'cuplik-media-demo',
  r2Endpoint: 'https://account-id.r2.cloudflarestorage.com',
};

test('R2 configuration fails closed when credentials or endpoint are invalid', () => {
  assert.throws(() => readConfig({}), /belum lengkap/);
  assert.throws(() => readConfig({ ...config, r2Endpoint: 'http://account-id.r2.cloudflarestorage.com' }), /endpoint S3/);
  assert.throws(() => readConfig({ ...config, r2Endpoint: 'https://other.r2.cloudflarestorage.com' }), /endpoint S3/);
});

test('object keys reject traversal, absolute paths, backslashes, and empty segments', () => {
  assert.equal(validateObjectKey('sources/user/project/video.mp4'), 'sources/user/project/video.mp4');
  for (const key of ['', '/source.mp4', '../source.mp4', 'sources//source.mp4', 'sources\\source.mp4']) {
    assert.throws(() => validateObjectKey(key), /tidak valid/);
  }
});

test('storage signs private upload and download requests with bounded expiry', async () => {
  const signed = [];
  const storage = createObjectStorage({
    config,
    client: { send: async () => ({}) },
    signer: async (_client, command, options) => {
      signed.push({ name: command.constructor.name, input: command.input, options });
      return `https://signed.example/${signed.length}`;
    },
  });
  const upload = await storage.createUploadUrl({ key: 'sources/user/project/video.mp4', contentType: 'video/mp4' });
  const download = await storage.createDownloadUrl({
    key: 'exports/user/project/clip/video.mp4',
    responseContentDisposition: 'attachment; filename="clip.mp4"',
  });

  assert.deepEqual(upload, {
    url: 'https://signed.example/1',
    headers: { 'Content-Type': 'video/mp4' },
  });
  assert.equal(download, 'https://signed.example/2');
  assert.deepEqual(signed.map(({ name, options }) => ({ name, options })), [
    { name: 'PutObjectCommand', options: { expiresIn: 900 } },
    { name: 'GetObjectCommand', options: { expiresIn: 300 } },
  ]);
});

test('storage heads, downloads, uploads, and deletes private objects', async () => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'cuplik-r2-'));
  const source = path.join(temporary, 'source.mp4');
  const target = path.join(temporary, 'nested', 'download.mp4');
  await fs.writeFile(source, 'upload');
  const calls = [];
  const client = {
    async send(command) {
      calls.push({ name: command.constructor.name, input: command.input });
      if (command.constructor.name === 'HeadObjectCommand') {
        return { ContentLength: 6, ContentType: 'video/mp4', ETag: 'etag' };
      }
      if (command.constructor.name === 'GetObjectCommand') return { Body: Readable.from(['download']) };
      return {};
    },
  };
  const storage = createObjectStorage({ config, client });

  assert.deepEqual(await storage.head('sources/user/project/video.mp4'), {
    contentLength: 6, contentType: 'video/mp4', etag: 'etag',
  });
  await storage.downloadToFile('sources/user/project/video.mp4', target);
  assert.equal(await fs.readFile(target, 'utf8'), 'download');
  await storage.uploadFile({ key: 'exports/user/project/clip/video.mp4', filePath: source, contentType: 'video/mp4' });
  await storage.delete('sources/user/project/video.mp4');
  assert.deepEqual(calls.map((call) => call.name), [
    'HeadObjectCommand', 'GetObjectCommand', 'PutObjectCommand', 'DeleteObjectCommand',
  ]);
});
