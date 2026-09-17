const { test } = require('node:test');
const assert = require('node:assert/strict');
const { dedupClips, normalizeScore, computeOverlap } = require('../src/services/curation.service');

test('normalizeScore converts 0-98 to 0-1', () => {
  assert.equal(normalizeScore(0), 0);
  assert.equal(normalizeScore(49), 0.5);
  assert.equal(normalizeScore(98), 1);
});

test('computeOverlap returns 0 for non-overlapping clips', () => {
  const clipA = { startTime: 100, endTime: 160 };
  const clipB = { startTime: 200, endTime: 260 };
  assert.equal(computeOverlap(clipA, clipB), 0);
});

test('computeOverlap returns 1 for identical clips', () => {
  const clipA = { startTime: 100, endTime: 160 };
  const clipB = { startTime: 100, endTime: 160 };
  assert.equal(computeOverlap(clipA, clipB), 1);
});

test('computeOverlap returns 0.5 for 50% IoU', () => {
  const clipA = { startTime: 100, endTime: 160 };
  const clipB = { startTime: 130, endTime: 190 };
  // intersection: 130-160 = 30s
  // union: 60 + 60 - 30 = 90s
  // IoU: 30/90 = 0.333...
  const expected = 30 / 90;
  assert.ok(Math.abs(computeOverlap(clipA, clipB) - expected) < 0.001);
});

test('computeOverlap handles clip fully inside another', () => {
  const clipA = { startTime: 100, endTime: 200 };
  const clipB = { startTime: 120, endTime: 150 };
  // intersection: 120-150 = 30s
  // union: 100 + 30 - 30 = 100s
  // IoU: 30/100 = 0.3
  const expected = 30 / 100;
  assert.ok(Math.abs(computeOverlap(clipA, clipB) - expected) < 0.001);
});

test('dedupClips removes overlapping clips, keeps higher score', () => {
  const clips = [
    { id: '1', startTime: 100, endTime: 160, concept_score: 80 },
    { id: '2', startTime: 100, endTime: 160, concept_score: 90 }, // identical
    { id: '3', startTime: 200, endTime: 260, concept_score: 70 },
  ];
  const deduped = dedupClips(clips);
  assert.equal(deduped.length, 2);
  assert.equal(deduped[0].id, '2'); // higher score kept
  assert.equal(deduped[1].id, '3');
});

test('dedupClips keeps clips with low overlap', () => {
  const clips = [
    { id: '1', startTime: 100, endTime: 160, concept_score: 80 },
    { id: '2', startTime: 190, endTime: 250, concept_score: 90 },
    { id: '3', startTime: 300, endTime: 360, concept_score: 70 },
  ];
  const deduped = dedupClips(clips);
  assert.equal(deduped.length, 3);
});

test('dedupClips handles empty array', () => {
  const deduped = dedupClips([]);
  assert.equal(deduped.length, 0);
});

test('dedupClips handles single clip', () => {
  const clips = [
    { id: '1', startTime: 100, endTime: 160, concept_score: 80 },
  ];
  const deduped = dedupClips(clips);
  assert.equal(deduped.length, 1);
});

test('dedupClips removes clip fully inside another', () => {
  const clips = [
    { id: '1', startTime: 100, endTime: 200, concept_score: 80 },
    { id: '2', startTime: 120, endTime: 150, concept_score: 90 },
  ];
  const deduped = dedupClips(clips);
  assert.equal(deduped.length, 1);
  assert.equal(deduped[0].id, '2');
});
