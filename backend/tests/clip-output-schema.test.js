const { test } = require('node:test');
const assert = require('node:assert/strict');
const clipOutputSchema = require('../src/utils/clip-output-schema');

function validSegment(overrides = {}) {
  return {
    start_time_seconds: 100,
    end_time_seconds: 140,
    duration: 40,
    concept_score: 85,
    suggested_title: 'Test Clip',
    pedagogical_reason: 'Valid pedagogical reason for testing.',
    ...overrides,
  };
}

function validPayload(segments) {
  return { segments: segments || [validSegment(), validSegment(), validSegment()] };
}

test('valid mock payload passes validation', () => {
  const result = clipOutputSchema.validate(validPayload(), { abortEarly: false });
  assert.equal(result.error, undefined);
  assert.equal(result.value.segments.length, 3);
});

test('duration below 25 seconds fails with distinct error', () => {
  const badDuration = validPayload([
    validSegment({ duration: 10, end_time_seconds: 110 }),
    validSegment({ clip_id: 'clip_02' }),
    validSegment({ clip_id: 'clip_03' }),
  ]);
  const result = clipOutputSchema.validate(badDuration, { abortEarly: false });
  assert.notEqual(result.error, null);
  const durationError = result.error.details.find(d => d.path.includes('duration'));
  assert.notEqual(durationError, undefined, 'should have a duration error');
  assert.match(durationError.type, /number\.min|any\.invalid/);
});

test('missing pedagogical_reason fails with distinct error', () => {
  const missing = { segments: [
    { start_time_seconds: 100, end_time_seconds: 140, duration: 40, concept_score: 85, suggested_title: 'Clip' },
    validSegment(),
    validSegment(),
  ]};
  const result = clipOutputSchema.validate(missing, { abortEarly: false });
  assert.notEqual(result.error, null);
  const missingError = result.error.details.find(d => d.path.includes('pedagogical_reason'));
  assert.notEqual(missingError, undefined, 'should have a pedagogical_reason error');
  assert.equal(missingError.type, 'any.required');
});

test('empty segments array passes validation', () => {
  const result = clipOutputSchema.validate({ segments: [] }, { abortEarly: false });
  assert.equal(result.error, undefined);
});

test('concept_score as float fails validation', () => {
  const bad = validPayload([validSegment({ concept_score: 0.85 })]);
  const result = clipOutputSchema.validate(bad, { abortEarly: false });
  assert.notEqual(result.error, null);
  const scoreError = result.error.details.find(d => d.path.includes('concept_score'));
  assert.notEqual(scoreError, undefined, 'should have a concept_score error');
});

test('concept_score above 98 fails validation', () => {
  const bad = validPayload([validSegment({ concept_score: 99 })]);
  const result = clipOutputSchema.validate(bad, { abortEarly: false });
  assert.notEqual(result.error, null);
  const scoreError = result.error.details.find(d => d.path.includes('concept_score'));
  assert.notEqual(scoreError, undefined, 'should have a concept_score error');
});
