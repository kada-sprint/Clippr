const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createChunker } = require('../src/services/chunker');
const sampleTranscript = require('./fixtures/sample_transcript_mock.json');

function makeWords(startSec, count, gap = 0.5) {
  const words = [];
  for (let i = 0; i < count; i++) {
    const start = startSec + i * gap;
    words.push({ word: `word${i}`, start_time: start, end_time: start + 0.4, confidence: 0.95 });
  }
  return words;
}

test('chunker produces non-overlapping scored ranges', () => {
  const chunker = createChunker({ chunkDurationSec: 10, contextPaddingSec: 2 });
  const transcript = { words: makeWords(0, 100, 0.5) };
  const chunks = chunker(transcript);

  for (let i = 0; i < chunks.length - 1; i++) {
    assert.ok(
      chunks[i].scoredRange.end <= chunks[i + 1].scoredRange.start,
      `chunk ${i} scoredRange.end (${chunks[i].scoredRange.end}) should be <= chunk ${i + 1} scoredRange.start (${chunks[i + 1].scoredRange.start})`
    );
  }
});

test('context range extends beyond scored range', () => {
  const chunker = createChunker({ chunkDurationSec: 10, contextPaddingSec: 5 });
  const transcript = { words: makeWords(0, 100, 0.5) };
  const chunks = chunker(transcript);

  for (const chunk of chunks) {
    assert.ok(
      chunk.contextRange.start <= chunk.scoredRange.start,
      'contextRange.start should be <= scoredRange.start'
    );
    assert.ok(
      chunk.contextRange.end >= chunk.scoredRange.end,
      'contextRange.end should be >= scoredRange.end'
    );
  }
});

test('short transcript shorter than one chunk produces single chunk', () => {
  const chunker = createChunker({ chunkDurationSec: 300, contextPaddingSec: 30 });
  const transcript = { words: makeWords(0, 5, 0.5) };
  const chunks = chunker(transcript);

  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].chunkIndex, 0);
  assert.equal(chunks[0].transcriptSlice.length, 5);
});

test('configurable chunk size produces different chunk counts', () => {
  const transcript = { words: makeWords(0, 200, 0.5) };

  const smallChunker = createChunker({ chunkDurationSec: 10, contextPaddingSec: 2 });
  const largeChunker = createChunker({ chunkDurationSec: 50, contextPaddingSec: 2 });

  const smallChunks = smallChunker(transcript);
  const largeChunks = largeChunker(transcript);

  assert.ok(smallChunks.length > largeChunks.length, 'smaller chunks should produce more chunks');
});

test('empty transcript returns empty array', () => {
  const chunker = createChunker();
  assert.deepEqual(chunker({ words: [] }), []);
  assert.deepEqual(chunker(null), []);
  assert.deepEqual(chunker(undefined), []);
});

test('sample transcript produces correctly-offset chunks', () => {
  const chunker = createChunker({ chunkDurationSec: 30, contextPaddingSec: 5 });
  const chunks = chunker(sampleTranscript);

  assert.ok(chunks.length > 0, 'should produce at least one chunk');

  for (const chunk of chunks) {
    const firstWord = chunk.transcriptSlice[0];
    const lastWord = chunk.transcriptSlice[chunk.transcriptSlice.length - 1];
    assert.ok(
      firstWord.start_time >= chunk.contextRange.start,
      'first word should be within context range'
    );
    assert.ok(
      lastWord.start_time < chunk.contextRange.end,
      'last word should be within context range'
    );
  }
});

test('no word appears in two scored ranges', () => {
  const chunker = createChunker({ chunkDurationSec: 10, contextPaddingSec: 5 });
  const transcript = { words: makeWords(0, 100, 0.5) };
  const chunks = chunker(transcript);

  const scoredWordSets = chunks.map(chunk =>
    new Set(chunk.transcriptSlice
      .filter(w => w.start_time >= chunk.scoredRange.start && w.start_time < chunk.scoredRange.end)
      .map(w => w.start_time))
  );

  for (let i = 0; i < scoredWordSets.length; i++) {
    for (let j = i + 1; j < scoredWordSets.length; j++) {
      for (const ts of scoredWordSets[i]) {
        assert.ok(!scoredWordSets[j].has(ts), `word at ${ts} should not appear in both chunk ${i} and ${j}`);
      }
    }
  }
});
