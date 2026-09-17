const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('sub-second audio tail stays in the preceding ASR chunk without losing audio', async (t) => {
  const file = path.join(os.tmpdir(), `cuplik-stt-boundary-${process.pid}.mp3`);
  fs.writeFileSync(file, 'test audio');
  t.after(() => { if (fs.existsSync(file)) fs.unlinkSync(file); });
  const ranges = [];
  const ffmpeg = require('../src/utils/ffmpeg');
  const env = require('../src/config/env');
  t.mock.method(ffmpeg, 'getAudioDuration', async () => 360.1);
  t.mock.method(ffmpeg, 'splitAudioChunk', async (_file, start, duration) => {
    ranges.push([start, duration]);
    fs.writeFileSync(file, 'test audio');
    return file;
  });
  const originalKey = env.eliceApiKey;
  env.eliceApiKey = 'test-only';
  t.after(() => { env.eliceApiKey = originalKey; });
  t.mock.method(globalThis, 'fetch', async () => {
    const duration = ranges.at(-1)[1];
    return new Response(JSON.stringify({ words: [{ word: 'Halo', start: 0, end: duration < 1 ? 0 : 1 }] }));
  });
  const { transcribeAudioChunked } = require('../src/services/stt.service');
  const transcript = await transcribeAudioChunked(file);
  assert.equal(ranges.length, 3);
  assert.deepEqual(ranges.map(([start]) => start), [0, 120, 240]);
  assert.ok(Math.abs(ranges.at(-1)[1] - 120.1) < 0.00001);
  assert.ok(transcript.words.every(word => word.end_time > word.start_time));
});
